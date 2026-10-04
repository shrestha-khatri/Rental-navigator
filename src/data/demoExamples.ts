export interface DemoExample {
    id: string;
    title: string;
    description: string;
    address: string;
    question: string;
    topic: string;
    category: string;
    isFeatured?: boolean;
}

export const DEMO_EXAMPLES: DemoExample[] = [
    // --- RECOMMENDED DEMO ---
    {
        id: 'demo-1',
        title: 'SF Rent Control & Temporal Limits',
        description: 'Complete pipeline: Resolves local SF ordinance, checks current cap, and allows future-date diffing.',
        address: '123 Main St, San Francisco, CA',
        question: 'Can my landlord increase my rent?',
        topic: 'rent_increase',
        category: 'Rent',
        isFeatured: true
    },
    // --- JURISDICTION COMPARISON ---
    {
        id: 'demo-2',
        title: 'San Jose Rent Control',
        description: 'Compares to the SF demo to prove the address determines the law (5% cap in SJ vs 60% CPI in SF).',
        address: '456 Tech Way, San Jose, CA',
        question: 'Can my landlord increase my rent?',
        topic: 'rent_increase',
        category: 'Rent'
    },
    {
        id: 'demo-3',
        title: 'State Baseline (Cupertino)',
        description: 'Address with no local city ordinance defaults to the State AB 1482 cap.',
        address: 'Apple Park, Cupertino, CA',
        question: 'Can my landlord increase my rent?',
        topic: 'rent_increase',
        category: 'Rent'
    },
    // --- RENT INCREASE ---
    {
        id: 'rent-1',
        title: 'Rent Control Applicability',
        description: 'Checks if rent control generally applies to the property.',
        address: '123 Main St, San Francisco, CA',
        question: 'Is there a limit on how much my rent can increase?',
        topic: 'rent_increase',
        category: 'Rent'
    },
    {
        id: 'rent-2',
        title: 'Lease Rent Increase',
        description: 'General query about increasing rent during a lease.',
        address: '456 Tech Way, San Jose, CA',
        question: 'Does rent control apply to this property?',
        topic: 'rent_increase',
        category: 'Rent'
    },
    // --- SECURITY DEPOSITS ---
    {
        id: 'dep-1',
        title: 'Deposit Limits (AB 12)',
        description: 'Retrieves the new 2024 California limit of exactly one month’s rent.',
        address: 'Apple Park, Cupertino, CA',
        question: 'How much can my landlord charge as a security deposit?',
        topic: 'security_deposit',
        category: 'Deposits'
    },
    {
        id: 'dep-2',
        title: 'Cleaning Costs Deduction',
        description: 'Asks a specific question about security deposit deductions.',
        address: '123 Main St, San Francisco, CA',
        question: 'What deductions are allowed from my deposit?',
        topic: 'security_deposit',
        category: 'Deposits'
    },
    // --- FUTURE LAW (TEMPORAL) ---
    {
        id: 'fut-1',
        title: 'Future Rent Caps (2027)',
        description: 'Forces the temporal engine to evaluate upcoming legislation taking effect next year.',
        address: 'Apple Park, Cupertino, CA',
        question: 'What rental rules will apply to this property on January 1, 2027?',
        topic: 'rent_increase',
        category: 'Future Laws'
    },
    {
        id: 'fut-2',
        title: 'Pending Eviction Freeze',
        description: 'Checks for pending tenant protections (Winter Eviction Freeze).',
        address: '123 Main St, San Francisco, CA',
        question: 'Are there any upcoming changes to tenant protections or evictions?',
        topic: 'eviction',
        category: 'Future Laws'
    },
    // --- LANDLORD ENTRY ---
    {
        id: 'entry-1',
        title: 'Notice for Entry',
        description: 'Checks CA Civil Code 1954 for the 24-hour reasonable notice rule.',
        address: '456 Tech Way, San Jose, CA',
        question: 'Can my landlord enter my apartment without notice?',
        topic: 'landlord_entry',
        category: 'Tenant Rights'
    },
    {
        id: 'entry-2',
        title: 'Landlord Inspections',
        description: 'Checks exceptions for landlord entry (emergencies, repairs, exhibiting).',
        address: '123 Main St, San Francisco, CA',
        question: 'What are the rules for landlord inspections?',
        topic: 'landlord_entry',
        category: 'Tenant Rights'
    },
    // --- EDGE CASES ---
    {
        id: 'edge-1',
        title: 'Unsupported Jurisdiction',
        description: 'Demonstrates graceful failure when querying an out-of-state address.',
        address: '100 Congress Ave, Austin, TX',
        question: 'Can my landlord raise my rent?',
        topic: 'rent_increase',
        category: 'Edge Cases'
    },
    {
        id: 'edge-2',
        title: 'Insufficient Evidence',
        description: 'Asks a housing question for which we deliberately lack seeded data.',
        address: '123 Main St, San Francisco, CA',
        question: 'What fees can my landlord legally charge for late rent?',
        topic: 'fees',
        category: 'Edge Cases'
    },
    {
        id: 'edge-3',
        title: 'Unrelated Question',
        description: 'Tests the AI hallucination firewall against non-housing trivia.',
        address: 'Apple Park, Cupertino, CA',
        question: 'What is the capital of France?',
        topic: 'unrelated',
        category: 'Edge Cases'
    },
    {
        id: 'edge-4',
        title: 'Ambiguous Address',
        description: 'Demonstrates handling of incomplete geographical data.',
        address: 'Fake Street 99',
        question: 'Can I terminate my lease early?',
        topic: 'lease_termination',
        category: 'Edge Cases'
    }
];
