import { retrieveLegalEvidence } from '../src/services/retrieval';
import { getApplicableLaw } from '../src/services/temporal';
import { generateAnswer } from '../src/services/ai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTest() {
  console.log('Running Evidence-Grounded AI Answer Test...\n');

  const question = "How much can my landlord raise my rent?";
  const targetDate = new Date('2024-10-01T00:00:00Z');
  const jurisdictions = [
    { name: 'California', level: 'State' },
    { name: 'San Francisco', level: 'City' }
  ];
  const address = "123 Main St, San Francisco, CA";

  console.log('1. Retrieving Evidence...');
  const evidence = await retrieveLegalEvidence({
    question,
    jurisdictions,
    targetDate
  });

  if (evidence.length === 0) {
      throw new Error("No evidence found. Cannot test AI.");
  }
  console.log(`Found ${evidence.length} relevant documents.\n`);

  console.log('2. Fetching Temporal/Pending Context...');
  const temporal = await getApplicableLaw({
      jurisdiction: { name: 'California', level: 'State' },
      topic: 'rent_increase',
      targetDate
  });
  console.log(`Found ${temporal.pending.length} pending laws.\n`);

  console.log('3. Generating Answer with LLM...');
  const answer = await generateAnswer({
      question,
      targetDate,
      address,
      jurisdictions,
      evidence,
      pendingChanges: temporal.pending
  });

  console.log('\n--- AI RESPONSE ---');
  console.log('SHORT ANSWER:', answer.shortAnswer);
  console.log('APPLICABLE JURISDICTIONS:', answer.applicableJurisdictions.join(', '));
  console.log('EXPLANATION:', answer.explanation);
  console.log('CONFIDENCE:', answer.confidence);
  console.log('LIMITATIONS:', answer.limitations);
  console.log('FUTURE CHANGES:', answer.futureChanges);
  
  console.log('\nCLAIMS:');
  answer.claims.forEach(c => {
      console.log(`- ${c.text}`);
      console.log(`  Citations: [${c.citations.join(', ')}]`);
  });

  console.log('\n✅ Test complete.');
}

runTest()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
