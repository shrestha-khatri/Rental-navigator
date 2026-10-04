import { GoogleGenAI } from '@google/genai';
import { config } from '@/config/env';
import { Claim } from '../ai/types';
import { LegalEvidence } from '../retrieval/types';
import { ValidatedClaim, ValidationResult } from './types';

export async function validateCitations(
  claims: Claim[],
  evidence: LegalEvidence[],
  targetDate: Date
): Promise<ValidationResult> {
  const validatedClaims: ValidatedClaim[] = [];
  let unsupportedClaimCount = 0;

  for (const claim of claims) {
    let isValid = false;
    let validationReason = 'No valid citations provided.';

    if (claim.citations.length === 0) {
      validationReason = 'Claim lacks any citations.';
    } else {
      // Check each citation for this claim
      for (const citationId of claim.citations) {
        const doc = evidence.find(e => e.documentId === citationId);
        
        if (!doc) {
          validationReason = `Citation [${citationId}] does not exist in the retrieved evidence.`;
          continue;
        }

        // Verify temporal applicability explicitly (redundant check for safety)
        const isEffective = targetDate >= doc.effectiveFrom && 
                            (doc.effectiveUntil === null || targetDate <= doc.effectiveUntil);
        if (!isEffective) {
          validationReason = `Citation [${citationId}] is not legally effective on the target date.`;
          continue;
        }

        // Semantic cross-check: Does the evidence text support the claim?
        const supports = await checkTextSupport(claim.text, doc.relevantText);
        if (supports) {
          isValid = true;
          validationReason = 'Supported by evidence.';
          break; // One valid piece of evidence is sufficient
        } else {
          validationReason = `Evidence text from [${citationId}] does not substantiate this claim.`;
        }
      }
    }

    if (!isValid) unsupportedClaimCount++;

    validatedClaims.push({
      ...claim,
      isValid,
      validationReason
    });
  }

  const citationCoverage = claims.length > 0 
    ? (claims.length - unsupportedClaimCount) / claims.length 
    : 1.0;

  return {
    validatedClaims,
    citationCoverage,
    unsupportedClaimCount,
    isFullyEvidenceBacked: unsupportedClaimCount === 0 && claims.length > 0
  };
}

async function checkTextSupport(claimText: string, evidenceText: string): Promise<boolean> {
  const isInvalidKey = !config.geminiApiKey || config.geminiApiKey === 'your_api_key_here';
  
  if (isInvalidKey) {
    // Simulated keyword fallback if no API key
    const keywords = claimText.toLowerCase().split(/\W+/).filter(k => k.length > 4);
    if (keywords.length === 0) return true;
    const evidenceLower = evidenceText.toLowerCase();
    const matchCount = keywords.filter(k => evidenceLower.includes(k)).length;
    return (matchCount / keywords.length) > 0.3; // Very loose heuristic
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const prompt = `You are a strict legal validation engine. 
Determine if the EVIDENCE TEXT explicitly supports the CLAIM. 
Return ONLY "YES" or "NO".

CLAIM: ${claimText}
EVIDENCE TEXT: ${evidenceText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.0 } // 0 temperature for binary logic
    });

    const answer = response.text?.trim().toUpperCase();
    return answer === 'YES';
  } catch (error) {
    console.error("Citation Validation Error:", error);
    // If the LLM fails, we assume it's unverified (fail securely)
    return false;
  }
}
