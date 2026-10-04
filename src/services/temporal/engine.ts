import { prisma } from '@/db';

export interface ApplicableLawQuery {
    jurisdiction: { name: string; level: string };
    topic: string;
    targetDate: Date;
}

export interface LegalStateComparison {
    address: string;
    topic: string;
    dateA: Date;
    dateB: Date;
}

export interface ComparisonResult {
    rulesOnDateA: any[];
    rulesOnDateB: any[];
    provisionsChanged: any[];
    provisionsIntroduced: any[];
    provisionsRemoved: any[];
    explanation: string;
    pendingLegislation: any[]; // Important: Show separately
}

export async function getApplicableLaw(query: ApplicableLawQuery) {
    const { jurisdiction, topic, targetDate } = query;

    const rawDocs = await prisma.legalDocument.findMany({
        where: {
            jurisdiction: { name: jurisdiction.name },
            topics: { some: { name: topic } },
        }
    });

    const applicable = [];
    const pending = [];

    for (const doc of rawDocs) {
        // PENDING legislation must be shown separately and must not be represented as current law.
        if (doc.status === 'PENDING') {
            pending.push(doc);
            continue;
        }

        // A CURRENT provision applies if: effective_from <= targetDate AND effective_until is null OR effective_until >= targetDate
        // A FUTURE provision should not be treated as current before its effective date.
        // A REPEALED provision should not be treated as currently applicable after repeal.
        
        const isEffective = targetDate >= doc.effective_from && 
                           (doc.effective_until === null || targetDate <= doc.effective_until);

        if (isEffective) {
            applicable.push(doc);
        }
    }

    return {
        applicable,
        pending
    };
}

export async function compareLegalState(query: LegalStateComparison): Promise<ComparisonResult> {
    const { address, topic, dateA, dateB } = query;

    // We assume the caller already resolved jurisdictions for this address.
    // For this engine abstraction, we'll fetch docs for ALL jurisdictions matching this topic.
    // (In a real app, we'd pass the jurisdictions array from the resolver).
    
    // For MVP, we'll just query the whole DB for this topic to demonstrate temporal diffing,
    // simulating an address resolving to California.
    
    const docs = await prisma.legalDocument.findMany({
        where: { topics: { some: { name: topic } } }
    });

    const rulesOnDateA = docs.filter(doc => 
        doc.status !== 'PENDING' &&
        dateA >= doc.effective_from && 
        (doc.effective_until === null || dateA <= doc.effective_until)
    );

    const rulesOnDateB = docs.filter(doc => 
        doc.status !== 'PENDING' &&
        dateB >= doc.effective_from && 
        (doc.effective_until === null || dateB <= doc.effective_until)
    );

    const pendingLegislation = docs.filter(doc => doc.status === 'PENDING');

    // Diff logic
    const aIds = rulesOnDateA.map(d => d.id);
    const bIds = rulesOnDateB.map(d => d.id);

    const provisionsIntroduced = rulesOnDateB.filter(d => !aIds.includes(d.id));
    const provisionsRemoved = rulesOnDateA.filter(d => !bIds.includes(d.id));
    
    // Find provisions that share the same topic/jurisdiction but changed ID 
    // (e.g. Rent Control replaced by new Rent Control)
    const provisionsChanged: any[] = [];
    
    for (const removed of provisionsRemoved) {
        const replacement = provisionsIntroduced.find(intro => 
            intro.jurisdictionId === removed.jurisdictionId && 
            intro.title.includes(removed.title.split(' ')[0]) // fuzzy match on title base
        );
        if (replacement) {
            provisionsChanged.push({
                from: removed,
                to: replacement
            });
        }
    }

    // Filter out the changed ones from introduced/removed to keep lists clean
    const changedIntroIds = provisionsChanged.map(c => c.to.id);
    const changedRemovedIds = provisionsChanged.map(c => c.from.id);
    
    const pureIntroduced = provisionsIntroduced.filter(d => !changedIntroIds.includes(d.id));
    const pureRemoved = provisionsRemoved.filter(d => !changedRemovedIds.includes(d.id));

    // Explanation (Simulated LLM synthesis for MVP structure)
    let explanation = "The legal landscape remains unchanged between these dates.";
    if (provisionsChanged.length > 0 || pureIntroduced.length > 0 || pureRemoved.length > 0) {
        explanation = `Between ${dateA.toISOString().split('T')[0]} and ${dateB.toISOString().split('T')[0]}, the laws changed. `;
        if (pureIntroduced.length > 0) explanation += `${pureIntroduced.length} new provision(s) took effect. `;
        if (pureRemoved.length > 0) explanation += `${pureRemoved.length} provision(s) were repealed. `;
        if (provisionsChanged.length > 0) explanation += `${provisionsChanged.length} provision(s) were amended/replaced.`;
    }

    return {
        rulesOnDateA,
        rulesOnDateB,
        provisionsChanged,
        provisionsIntroduced: pureIntroduced,
        provisionsRemoved: pureRemoved,
        explanation,
        pendingLegislation
    };
}
