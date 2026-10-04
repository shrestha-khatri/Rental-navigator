export interface AIAnswerRequest {
  question: string;
  targetDate: Date;
  address: string;
  jurisdictions: { name: string, level: string }[];
  evidence: any[]; 
  pendingChanges?: any[]; // optional, from the temporal engine
}

export interface Claim {
  text: string;
  citations: string[]; // List of documentIds
}

export interface AIAnswerResponse {
  shortAnswer: string;
  applicableJurisdictions: string[];
  explanation: string;
  claims: Claim[];
  confidence: 'High' | 'Medium' | 'Low';
  limitations: string;
  futureChanges: string | null;
}
