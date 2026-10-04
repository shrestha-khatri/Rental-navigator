import { resolveAddress, resolveJurisdictions } from '../src/services/jurisdiction';
import { retrieveLegalEvidence } from '../src/services/retrieval';
import { getApplicableLaw } from '../src/services/temporal';
import { generateAnswer } from '../src/services/ai';
import { validateCitations } from '../src/services/citation';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const TEST_DATASET = [
  {
    id: 1,
    description: "Standard Rent Control (City vs State conflict resolution)",
    address: "123 Main St, San Francisco, CA",
    question: "How much can my landlord raise my rent?",
    targetDate: new Date('2024-10-01T00:00:00Z'),
    expectedJurisdiction: "San Francisco",
    expectedTopic: "rent_increase",
    expectedSourceKeywords: ["37.3", "Rent Limitations"], // SF Admin Code
    expectAnswer: true
  },
  {
    id: 2,
    description: "Temporal Filtering (Current AB 12 Law)",
    address: "Apple Park, Cupertino, CA",
    question: "How much can my landlord ask for a security deposit?",
    targetDate: new Date('2024-10-01T00:00:00Z'), // After July 1, 2024
    expectedJurisdiction: "California",
    expectedTopic: "security_deposit",
    expectedSourceKeywords: ["AB 12", "one month"],
    expectAnswer: true
  },
  {
    id: 3,
    description: "Temporal Filtering (Past/Repealed Law)",
    address: "Apple Park, Cupertino, CA",
    question: "How much can my landlord ask for a security deposit?",
    targetDate: new Date('2023-01-01T00:00:00Z'), // Before July 1, 2024
    expectedJurisdiction: "California",
    expectedTopic: "security_deposit",
    expectedSourceKeywords: ["Pre-2024", "two months"],
    expectAnswer: true
  },
  {
    id: 4,
    description: "Unrelated Legal Question (Out of bounds)",
    address: "123 Main St, San Francisco, CA",
    question: "What is the penalty for grand theft auto?",
    targetDate: new Date('2024-10-01T00:00:00Z'),
    expectedJurisdiction: "San Francisco",
    expectedTopic: null,
    expectedSourceKeywords: [],
    expectAnswer: false
  }
];

async function runEvaluation() {
  console.log("Starting Evaluation Suite...\n");
  
  const results = {
    addressResolution: { pass: 0, fail: 0 },
    jurisdictionAccuracy: { pass: 0, fail: 0 },
    retrievalRelevance: { pass: 0, fail: 0 },
    temporalFiltering: { pass: 0, fail: 0 },
    citationCoverageRates: [] as number[],
    unsupportedClaims: 0,
    totalClaims: 0
  };

  for (const test of TEST_DATASET) {
    console.log(`Evaluating Test ${test.id}: ${test.description}`);
    try {
      // 1. Address Resolution
      const location = await resolveAddress(test.address);
      if (location) results.addressResolution.pass++;
      else { results.addressResolution.fail++; continue; }

      // 2. Jurisdiction Accuracy
      const jurisdictions = resolveJurisdictions(location);
      const hasExpectedJuris = jurisdictions.some(j => j.name === test.expectedJurisdiction);
      if (hasExpectedJuris) results.jurisdictionAccuracy.pass++;
      else results.jurisdictionAccuracy.fail++;

      // 3. Retrieval & 4. Temporal Filtering
      const evidence = await retrieveLegalEvidence({
        question: test.question,
        jurisdictions,
        targetDate: test.targetDate
      });

      if (!test.expectAnswer) {
          if (evidence.length === 0) {
              results.retrievalRelevance.pass++;
              results.temporalFiltering.pass++;
          } else {
              results.retrievalRelevance.fail++;
          }
          continue;
      }

      if (evidence.length > 0 && evidence[0].topic === test.expectedTopic && test.expectedSourceKeywords.some(k => evidence[0].title.includes(k) || evidence[0].relevantText.includes(k))) {
          results.retrievalRelevance.pass++;
          results.temporalFiltering.pass++;
      } else {
          results.retrievalRelevance.fail++;
          results.temporalFiltering.fail++;
      }

      // 5. Answer Generation & Citation Validation
      const temporalContext = await getApplicableLaw({
          jurisdiction: { name: evidence[0].jurisdiction, level: '' },
          topic: evidence[0].topic,
          targetDate: test.targetDate
      });

      const answer = await generateAnswer({
          question: test.question,
          targetDate: test.targetDate,
          address: test.address,
          jurisdictions,
          evidence,
          pendingChanges: temporalContext.pending
      });

      const validation = await validateCitations(answer.claims || [], evidence, test.targetDate);
      
      results.citationCoverageRates.push(validation.citationCoverage);
      results.unsupportedClaims += validation.unsupportedClaimCount;
      results.totalClaims += (answer.claims?.length || 0);

      console.log(`  -> Checked. Citation Coverage: ${(validation.citationCoverage * 100).toFixed(0)}%\n`);

    } catch (e: any) {
      console.error(`  -> Failed unexpectedly: ${e.message}`);
    }
  }

  const avgCoverage = results.citationCoverageRates.length > 0 
      ? (results.citationCoverageRates.reduce((a,b) => a+b, 0) / results.citationCoverageRates.length) * 100
      : 100; // If no claims made, technically 100% covered

  const report = `
# Rental Housing Law Navigator - Evaluation Report
Date: ${new Date().toISOString()}

## 1. Automated Metrics
- Address Resolution Accuracy: ${results.addressResolution.pass}/${results.addressResolution.pass + results.addressResolution.fail}
- Jurisdiction Accuracy: ${results.jurisdictionAccuracy.pass}/${results.jurisdictionAccuracy.pass + results.jurisdictionAccuracy.fail}
- Retrieval Relevance: ${results.retrievalRelevance.pass}/${results.retrievalRelevance.pass + results.retrievalRelevance.fail}
- Temporal Filtering Accuracy: ${results.temporalFiltering.pass}/${results.temporalFiltering.pass + results.temporalFiltering.fail}
- Citation Coverage (Avg): ${avgCoverage.toFixed(2)}%
- Total Claims Generated: ${results.totalClaims}
- Unsupported Claim Count: ${results.unsupportedClaims}

## 2. Limitations
* Automated assessment of "Answer Groundedness" is limited because validating if an LLM truly accurately translated a legal text (without nuance loss) requires human legal review or a highly advanced specialized LLM judge (LLM-as-a-judge). Currently, we use deterministic existence checks and basic NLI logic.
* The test dataset is small and heavily localized to CA/SF. Nationwide scale testing would require a massive matrix of local municipal codes.
`;

  console.log(report);
  fs.writeFileSync('evaluation_report.md', report.trim());
}

runEvaluation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
