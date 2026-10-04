import { Claim } from '../ai/types';
import { LegalEvidence } from '../retrieval/types';

export interface ValidatedClaim extends Claim {
  isValid: boolean;
  validationReason: string;
}

export interface ValidationResult {
  validatedClaims: ValidatedClaim[];
  citationCoverage: number; // 0 to 1
  unsupportedClaimCount: number;
  isFullyEvidenceBacked: boolean;
}
