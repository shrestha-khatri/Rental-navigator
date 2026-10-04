import { prisma } from '@/db';
import { RetrievalQuery, LegalEvidence } from './types';

// Simple heuristic for topic classification based on question keywords
export function classifyTopic(question: string): string | null {
  const q = question.toLowerCase();
  if (q.includes('rent increase') || q.includes('raise my rent') || q.includes('cap')) return 'rent_increase';
  if (q.includes('security deposit') || q.includes('deposit')) return 'security_deposit';
  if (q.includes('enter') || q.includes('entry') || q.includes('notice to enter')) return 'landlord_entry';
  if (q.includes('evict') || q.includes('kick out')) return 'eviction';
  return null;
}

// Simple text relevance scorer (simulating semantic retrieval for MVP)
function calculateTextRelevance(text: string, question: string): number {
  const qTerms = question.toLowerCase().split(/\W+/).filter(t => t.length > 3);
  let score = 0;
  const lowerText = text.toLowerCase();
  for (const term of qTerms) {
    if (lowerText.includes(term)) {
      score += 0.2;
    }
  }
  return Math.min(score, 1.0); // Normalize to max 1.0
}

function getAuthorityWeight(level: string): number {
  if (level === 'PRIMARY') return 1.0;
  if (level === 'OFFICIAL_GUIDANCE') return 0.7;
  if (level === 'SECONDARY') return 0.4;
  return 0.1;
}

export async function retrieveLegalEvidence(query: RetrievalQuery): Promise<LegalEvidence[]> {
  const { question, jurisdictions, targetDate, topic } = query;

  // 1. Topic Classification
  const resolvedTopic = topic || classifyTopic(question);

  // 2. Geographic Filter
  const jurisdictionNames = jurisdictions.map(j => j.name);

  // Query DB with hard Geographic and Topic filters
  const rawDocs = await prisma.legalDocument.findMany({
    where: {
      jurisdiction: {
        name: { in: jurisdictionNames }
      },
      ...(resolvedTopic ? {
        topics: {
          some: { name: resolvedTopic }
        }
      } : {})
    },
    include: {
      jurisdiction: true,
      topics: true,
    }
  });

  const evidence: LegalEvidence[] = [];

  for (const doc of rawDocs) {
    // 3. Temporal Filter (Date Applicability)
    if (targetDate < doc.effective_from) continue;
    if (doc.effective_until && targetDate > doc.effective_until) continue;

    // 4. Semantic / Text Retrieval (simulated scoring)
    const textRelevance = calculateTextRelevance(doc.text, question);
    
    // Drop documents with absolutely 0 relevance to the question
    if (question && textRelevance === 0) continue;

    // 5. Authority Ranking (Weighting)
    const authorityWeight = getAuthorityWeight(doc.authority_level);
    
    // In local housing law, City laws often override State laws if they are stricter 
    // (e.g. San Francisco Rent Control overrides AB 1482).
    // We add a slight geographic specificity boost for City/County over State.
    let geoBoost = 0;
    if (doc.jurisdiction.level === 'City') geoBoost = 0.3;
    if (doc.jurisdiction.level === 'County') geoBoost = 0.15;

    // Final Relevance Score
    const finalScore = (textRelevance * 0.4) + (authorityWeight * 0.4) + geoBoost;

    evidence.push({
      documentId: doc.id,
      title: doc.title,
      jurisdiction: doc.jurisdiction.name,
      topic: doc.topics[0]?.name || 'unknown',
      relevantText: doc.text, // In a real system, extract just the relevant snippet
      sourceUrl: doc.source_url,
      effectiveFrom: doc.effective_from,
      effectiveUntil: doc.effective_until,
      status: doc.status,
      authorityLevel: doc.authority_level,
      relevanceScore: parseFloat(finalScore.toFixed(3))
    });
  }

  // 6. Sort by Final Relevance Score descending
  evidence.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return evidence;
}
