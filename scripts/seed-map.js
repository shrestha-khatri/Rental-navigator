const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function seedMapAndSocial() {
  await prisma.friendship.deleteMany();
  await prisma.userPropertyAction.deleteMany();
  await prisma.user.deleteMany();
  await prisma.ruleCache.deleteMany();
  await prisma.mapProperty.deleteMany();

  await prisma.mapProperty.createMany({
    data: [
      { street: '123 Main St', city: 'San Francisco', county: 'SF County', state: 'CA', zip: '94105', latitude: 37.791, longitude: -122.393, neighbourhood: 'SOMA', rent_controlled: true },
      { street: '456 Tech Way', city: 'San Jose', county: 'Santa Clara County', state: 'CA', zip: '95113', latitude: 37.33, longitude: -121.88, neighbourhood: 'Downtown' },
    ]
  });

  const u1 = await prisma.user.create({ data: { email: 'alice@example.com', name: 'Alice Demo' } });
  const u2 = await prisma.user.create({ data: { email: 'bob@example.com', name: 'Bob Demo' } });
  const u3 = await prisma.user.create({ data: { email: 'charlie@example.com', name: 'Charlie Demo' } });

  await prisma.friendship.create({ data: { userAId: u1.id, userBId: u2.id, status: 'ACCEPTED' } });
  await prisma.friendship.create({ data: { userAId: u1.id, userBId: u3.id, status: 'PENDING' } });

  const p1 = await prisma.mapProperty.findFirst({ where: { street: '123 Main St' }});
  
  await prisma.userPropertyAction.create({
    data: {
      userId: u1.id,
      propertyId: p1.id,
      is_liked: true,
      living_status: 'CURRENT',
      visibility: 'ALL_FRIENDS',
      precision: 'EXACT'
    }
  });

  console.log('Map and Social seed complete.');
}
seedMapAndSocial().catch(console.error).finally(() => prisma.$disconnect());
