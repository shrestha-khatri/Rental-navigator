export interface RetrievalQuery {
  question: string;
  jurisdictions: { name: string; level: string }[];
  targetDate: Date;
  topic?: string;
}

export interface LegalEvidence {
  documentId: string;
  title: string;
  jurisdiction: string;
  topic: string;
  relevantText: string;
  sourceUrl: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  status: string;
  authorityLevel: string;
  relevanceScore: number;
}
