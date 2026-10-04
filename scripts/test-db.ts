import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTests() {
  console.log('Running Database Tests...');

  // Test 1: Check if Jurisdictions exist
  const jurisdictions = await prisma.jurisdiction.count();
  if (jurisdictions === 0) throw new Error('Test Failed: No jurisdictions found');
  console.log(`✅ Passed: Found ${jurisdictions} jurisdictions`);

  // Test 2: Check if Topics exist
  const topics = await prisma.legalTopic.count();
  if (topics === 0) throw new Error('Test Failed: No topics found');
  console.log(`✅ Passed: Found ${topics} legal topics`);

  // Test 3: Check if Documents exist and map properly
  const docs = await prisma.legalDocument.findMany({
    include: { jurisdiction: true, topics: true }
  });
  
  if (docs.length === 0) throw new Error('Test Failed: No documents found');
  
  for (const doc of docs) {
    if (!doc.jurisdiction) throw new Error(`Test Failed: Document ${doc.id} missing jurisdiction`);
    if (doc.topics.length === 0) throw new Error(`Test Failed: Document ${doc.id} missing topics`);
    if (!['PRIMARY', 'OFFICIAL_GUIDANCE', 'SECONDARY'].includes(doc.authority_level)) {
      throw new Error(`Test Failed: Invalid authority level ${doc.authority_level}`);
    }
  }
  console.log(`✅ Passed: Verified ${docs.length} documents have correct relations and enums`);

  console.log('\n🎉 All Database Tests Passed!');
}

runTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
