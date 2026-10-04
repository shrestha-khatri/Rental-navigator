import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyUrls() {
  const docs = await prisma.legalDocument.findMany();
  console.log(`Verifying ${docs.length} URLs...`);

  let allValid = true;

  for (const doc of docs) {
    try {
      const response = await fetch(doc.source_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      
      if (response.ok) {
        console.log(`✅ [VALID] ${doc.title}`);
      } else {
        console.error(`❌ [INVALID - Status ${response.status}] ${doc.title} - ${doc.source_url}`);
        allValid = false;
      }
    } catch (e: any) {
      console.error(`❌ [ERROR] ${doc.title} - ${e.message}`);
      allValid = false;
    }
  }

  if (allValid) {
    console.log('\nAll source URLs are valid and reachable.');
  } else {
    console.log('\nSome source URLs failed verification.');
    process.exit(1);
  }
}

verifyUrls().finally(() => prisma.$disconnect());
