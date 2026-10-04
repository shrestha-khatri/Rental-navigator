const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function seedRules() {
  const sfProps = await prisma.mapProperty.findMany({ where: { city: 'San Francisco' }});
  const sjProps = await prisma.mapProperty.findMany({ where: { city: 'San Jose' }});

  await prisma.ruleCache.deleteMany();

  for(const p of sfProps) {
    await prisma.ruleCache.create({
      data: {
        propertyId: p.id,
        topic: 'eviction_notice',
        target_date: new Date('2026-10-04T00:00:00Z'),
        value: 30,
        unit: 'days',
        status: 'MEETS',
        depends_reason: null,
        document_ids: JSON.stringify(['doc_sf_eviction']),
        evidence_anchors: JSON.stringify(['Section 37.9']),
        confidence: 'High'
      }
    });
  }

  for(const p of sjProps) {
    await prisma.ruleCache.create({
      data: {
        propertyId: p.id,
        topic: 'eviction_notice',
        target_date: new Date('2026-10-04T00:00:00Z'),
        value: 21, 
        unit: 'days',
        status: 'DEPENDS',
        depends_reason: 'Depends on tenancy length',
        document_ids: JSON.stringify(['doc_sj_eviction']),
        evidence_anchors: JSON.stringify(['Section 17.23']),
        confidence: 'High'
      }
    });
  }

  console.log('RuleCache seeded.');
}
seedRules().catch(console.error).finally(()=>prisma.$disconnect());
