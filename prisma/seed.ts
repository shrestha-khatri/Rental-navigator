import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOPICS = [
  { name: 'rent_increase', description: 'Rules around raising rent' },
  { name: 'rent_control', description: 'Local rent control limits' },
  { name: 'security_deposit', description: 'Deposit limits and return rules' },
  { name: 'eviction', description: 'Just cause eviction rules' },
  { name: 'notice_period', description: 'Required notices for various actions' },
  { name: 'landlord_entry', description: 'Rules for landlord entering the unit' },
  { name: 'lease_termination', description: 'Ending a tenancy' },
  { name: 'habitability', description: 'Maintenance and living conditions' },
  { name: 'fees', description: 'Late fees and other charges' },
  { name: 'tenant_protection', description: 'General tenant rights' },
  { name: 'disclosures', description: 'Required lease disclosures' },
];

async function main() {
  console.log('Seeding Database for Extensive Demos...');

  // 1. Seed Topics
  for (const topic of TOPICS) {
    await prisma.legalTopic.upsert({
      where: { name: topic.name },
      update: {},
      create: topic,
    });
  }

  const rentIncreaseTopic = await prisma.legalTopic.findUnique({ where: { name: 'rent_increase' } });
  const securityDepositTopic = await prisma.legalTopic.findUnique({ where: { name: 'security_deposit' } });
  const landlordEntryTopic = await prisma.legalTopic.findUnique({ where: { name: 'landlord_entry' } });
  const evictionTopic = await prisma.legalTopic.findUnique({ where: { name: 'eviction' } });

  // 2. Seed Jurisdictions
  const caState = await prisma.jurisdiction.upsert({
    where: { id: 'ca-state' },
    update: {},
    create: { id: 'ca-state', name: 'California', level: 'State' }
  });

  const sfCity = await prisma.jurisdiction.upsert({
    where: { id: 'sf-city' },
    update: {},
    create: { id: 'sf-city', name: 'San Francisco', level: 'City' }
  });

  const sjCity = await prisma.jurisdiction.upsert({
    where: { id: 'sj-city' },
    update: {},
    create: { id: 'sj-city', name: 'San Jose', level: 'City' }
  });

  // Wipe old docs
  await prisma.legalDocument.deleteMany({});

  // --- CALIFORNIA (STATE) ---
  await prisma.legalDocument.create({
    data: {
      title: 'California Civil Code Section 1950.5 - Security Deposits (Pre-2024)',
      jurisdictionId: caState.id,
      jurisdictionLevel: 'State',
      text: `A landlord may demand a security deposit up to two months' rent for an unfurnished property, and three months' rent for a furnished property.`,
      source_url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5.',
      authority_level: 'PRIMARY',
      effective_from: new Date('2000-01-01T00:00:00Z'),
      effective_until: new Date('2024-06-30T23:59:59Z'), 
      status: 'REPEALED',
      topics: { connect: [{ id: securityDepositTopic!.id }] }
    }
  });

  await prisma.legalDocument.create({
    data: {
      title: 'California Civil Code Section 1950.5 - Security Deposits (AB 12)',
      jurisdictionId: caState.id,
      jurisdictionLevel: 'State',
      text: `A landlord may not demand or receive security in an amount or value in excess of an amount equal to one month’s rent, for both furnished and unfurnished property.`,
      source_url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5.',
      authority_level: 'PRIMARY',
      effective_from: new Date('2024-07-01T00:00:00Z'),
      status: 'CURRENT',
      topics: { connect: [{ id: securityDepositTopic!.id }] }
    }
  });

  await prisma.legalDocument.create({
    data: {
      title: 'California Civil Code Section 1947.12 - Rent Limits (AB 1482)',
      jurisdictionId: caState.id,
      jurisdictionLevel: 'State',
      text: `An owner of residential real property shall not increase the gross rental rate for a dwelling more than 5 percent plus the percentage change in the cost of living, or 10 percent, whichever is lower.`,
      source_url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1947.12.',
      authority_level: 'PRIMARY',
      effective_from: new Date('2020-01-01T00:00:00Z'),
      effective_until: new Date('2026-12-31T23:59:59Z'), 
      status: 'CURRENT',
      topics: { connect: [{ id: rentIncreaseTopic!.id }] }
    }
  });

  await prisma.legalDocument.create({
    data: {
      title: 'California Civil Code Section 1947.12 - Strict Rent Limits (SB X)',
      jurisdictionId: caState.id,
      jurisdictionLevel: 'State',
      text: `An owner of residential real property shall not increase the gross rental rate for a dwelling more than 5 percent absolute, irrespective of the cost of living index.`,
      source_url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1947.12.',
      authority_level: 'PRIMARY',
      effective_from: new Date('2027-01-01T00:00:00Z'),
      status: 'FUTURE',
      topics: { connect: [{ id: rentIncreaseTopic!.id }] }
    }
  });

  await prisma.legalDocument.create({
    data: {
      title: 'Proposed Assembly Bill 999 - Winter Eviction Freeze',
      jurisdictionId: caState.id,
      jurisdictionLevel: 'State',
      text: `A landlord shall not terminate a tenancy or file an unlawful detainer action against a tenant during the months of December, January, and February, regardless of fault.`,
      source_url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1946.2.',
      authority_level: 'PRIMARY',
      effective_from: new Date('2028-01-01T00:00:00Z'), 
      status: 'PENDING',
      topics: { connect: [{ id: evictionTopic!.id }] }
    }
  });

  await prisma.legalDocument.create({
    data: {
      title: 'California Civil Code Section 1954 - Landlord Entry',
      jurisdictionId: caState.id,
      jurisdictionLevel: 'State',
      text: `A landlord may enter the dwelling unit only in the following cases: In case of emergency, to make necessary repairs, or to exhibit the unit to prospective tenants. The landlord shall give the tenant reasonable notice in writing of their intent to enter. Twenty-four hours shall be presumed to be reasonable notice.`,
      source_url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1954.',
      authority_level: 'PRIMARY',
      effective_from: new Date('1975-01-01T00:00:00Z'),
      status: 'CURRENT',
      topics: { connect: [{ id: landlordEntryTopic!.id }] }
    }
  });

  // --- SAN FRANCISCO (CITY) ---
  await prisma.legalDocument.create({
    data: {
      title: 'San Francisco Administrative Code Section 37.3 - Rent Limitations',
      jurisdictionId: sfCity.id,
      jurisdictionLevel: 'City',
      text: `Landlords may impose annual rent increases which shall not exceed 60% of the percentage increase in the Consumer Price Index for All Urban Consumers in the San Francisco-Oakland-San Jose region.`,
      source_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_admin/0-0-0-15555',
      authority_level: 'PRIMARY',
      effective_from: new Date('1979-06-13T00:00:00Z'),
      status: 'CURRENT',
      topics: { connect: [{ id: rentIncreaseTopic!.id }] }
    }
  });

  // --- SAN JOSE (CITY) ---
  await prisma.legalDocument.create({
    data: {
      title: 'San Jose Municipal Code Section 17.23.310 - Allowable Rent Increases',
      jurisdictionId: sjCity.id,
      jurisdictionLevel: 'City',
      text: `A landlord may not increase the rent of any rent-stabilized unit by more than five percent (5%) in any twelve-month period.`,
      source_url: 'https://library.municode.com/ca/san_jose/codes/code_of_ordinances',
      authority_level: 'PRIMARY',
      effective_from: new Date('2017-01-01T00:00:00Z'),
      status: 'CURRENT',
      topics: { connect: [{ id: rentIncreaseTopic!.id }] }
    }
  });

  console.log('Seeding Complete! Added robust CA, SF, and SJ local laws.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
