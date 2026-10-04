import { retrieveLegalEvidence } from '../src/services/retrieval';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTests() {
  console.log('Running Legal Retrieval Tests...\n');

  const TODAY = new Date('2024-10-01T00:00:00Z'); // Assuming today is after July 1, 2024

  // --- Test 1: Jurisdiction & Topic Filtering ---
  console.log('Test 1: Jurisdiction & Topic (San Francisco Rent Increase)');
  const res1 = await retrieveLegalEvidence({
    question: 'How much can my landlord raise my rent?',
    jurisdictions: [
      { name: 'California', level: 'State' },
      { name: 'San Francisco', level: 'City' }
    ],
    targetDate: TODAY
  });
  
  if (res1.length === 0) throw new Error('Failed to retrieve evidence');
  
  // The San Francisco ordinance (City) should outrank the California AB 1482 (State)
  // due to our geographic specificity boost.
  console.log(`Rank 1: ${res1[0].title} (Score: ${res1[0].relevanceScore})`);
  if (res1.length > 1) console.log(`Rank 2: ${res1[1].title} (Score: ${res1[1].relevanceScore})`);
  
  if (!res1[0].title.includes('San Francisco')) {
      throw new Error('Ranking failure: City law should outrank State law for rent increases in SF.');
  }
  console.log('✅ Passed: Proper jurisdiction filtering and ranking.\n');

  // --- Test 2: Temporal Filtering (Past/Current Date) ---
  console.log('Test 2: Temporal Filtering (Security Deposit limit before AB 12 takes effect)');
  const res2 = await retrieveLegalEvidence({
    question: 'How much can my landlord ask for a security deposit?',
    jurisdictions: [{ name: 'California', level: 'State' }],
    targetDate: new Date('2023-01-01T00:00:00Z') // Before July 1, 2024
  });

  // The AB 12 law is only effective from 2024-07-01. It should NOT be returned here.
  const hasAB12 = res2.some(e => e.title.includes('1950.5'));
  if (hasAB12) {
      throw new Error('Temporal failure: Retrieved a law that was not effective yet.');
  }
  console.log('✅ Passed: Proper date exclusion (Future law not applied).\n');

  // --- Test 3: Temporal Filtering (Future Date) ---
  console.log('Test 3: Temporal Filtering (Security Deposit limit AFTER AB 12 takes effect)');
  const res3 = await retrieveLegalEvidence({
    question: 'How much can my landlord ask for a security deposit?',
    jurisdictions: [{ name: 'California', level: 'State' }],
    targetDate: new Date('2025-01-01T00:00:00Z') // After July 1, 2024
  });

  const hasAB12_future = res3.some(e => e.title.includes('1950.5'));
  if (!hasAB12_future) {
      throw new Error('Temporal failure: Failed to retrieve law that is currently effective.');
  }
  console.log('✅ Passed: Proper date inclusion (Current law applied).\n');

  // --- Test 4: Pure Topic Exclusion ---
  console.log('Test 4: Pure Topic Exclusion');
  const res4 = await retrieveLegalEvidence({
    question: 'How much notice before they enter?',
    jurisdictions: [{ name: 'California', level: 'State' }],
    targetDate: TODAY
  });

  const allAreEntry = res4.every(e => e.topic === 'landlord_entry');
  if (!allAreEntry || res4.length === 0) {
      throw new Error('Topic failure: Retrieved unrelated laws.');
  }
  console.log(`✅ Passed: Only retrieved ${res4[0].title}.\n`);

  console.log('🎉 All Retrieval Tests Passed!');
}

runTests()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
