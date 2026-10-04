const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const docs = await prisma.legalDocument.findMany();
    for(const doc of docs) {
        await prisma.legalDocument.update({
            where: { id: doc.id },
            data: {
                snapshot_text: '[OFFICIAL DOCUMENT RECORD]\nTitle: ' + doc.title + '\nJurisdiction: ' + doc.jurisdictionLevel + '\n\n' + doc.text + '\n\n[END OF RECORD]',
                content_hash: 'hash_' + Math.random().toString(36).substr(2, 9),
                retrieved_at: new Date()
            }
        });
    }
    console.log('Backfilled ' + docs.length + ' documents');
}
main().catch(console.error).finally(()=>prisma.$disconnect());
