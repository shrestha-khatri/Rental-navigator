import { validateCitations } from '../src/services/citation';
import { Claim } from '../src/services/ai/types';
import { LegalEvidence } from '../src/services/retrieval/types';

async function runTests() {
  console.log('Running Citation Validation Tests...\n');

  const targetDate = new Date('2024-10-01T00:00:00Z');

  // Mock Evidence (e.g. from retrieval layer)
  const mockEvidence: LegalEvidence[] = [
    {
      documentId: 'doc_123',
      title: 'AB 12',
      jurisdiction: 'California',
      topic: 'security_deposit',
      relevantText: 'A landlord may not demand or receive security in an amount or value in excess of an amount equal to one month’s rent.',
      sourceUrl: 'http://example.com',
      effectiveFrom: new Date('2024-07-01T00:00:00Z'),
      effectiveUntil: null,
      status: 'CURRENT',
      authorityLevel: 'PRIMARY',
      relevanceScore: 0.9
    }
  ];

  // Test 1: Valid claim with valid citation
  const claim1: Claim = {
    text: "The security deposit is limited to one month's rent.",
    citations: ['doc_123']
  };

  // Test 2: Invalid claim (made up text not supported by evidence)
  const claim2: Claim = {
    text: "Landlords can also charge a $500 pet deposit on top of rent.",
    citations: ['doc_123']
  };

  // Test 3: Citation does not exist in evidence
  const claim3: Claim = {
    text: "Evictions require 60 days notice.",
    citations: ['fake_doc_999']
  };

  console.log('Validating claims against evidence...\n');

  const result = await validateCitations([claim1, claim2, claim3], mockEvidence, targetDate);

  for (const c of result.validatedClaims) {
      const status = c.isValid ? '✅ VALID' : '❌ INVALID';
      console.log(`[${status}] Claim: "${c.text}"`);
      console.log(`          Reason: ${c.validationReason}`);
  }

  console.log('\n--- Final Validation Metrics ---');
  console.log(`Citation Coverage: ${(result.citationCoverage * 100).toFixed(0)}%`);
  console.log(`Unsupported Claims: ${result.unsupportedClaimCount}`);
  console.log(`Is Fully Evidence Backed: ${result.isFullyEvidenceBacked}`);

  if (result.unsupportedClaimCount !== 2 || !result.validatedClaims[0].isValid) {
      console.error('\nTest Failed: Validation logic did not catch the unsupported claims properly.');
      process.exit(1);
  }

  console.log('\n🎉 Validation Tests Passed!');
}

runTests();
