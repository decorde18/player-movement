const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAgeGroups() {
  console.log('Seeding Age Groups (2007 - 2018)...');

  const startYear = 2007;
  const endYear = 2018;

  for (let year = startYear; year <= endYear; year++) {
    // 1. Calendar Year Age Group (1/1 - 12/31)
    const calName = `${year} (1/1 - 12/31)`;
    const calDobStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const calDobEnd = new Date(`${year}-12-31T23:59:59.999Z`);

    const existingCal = await prisma.age_groups.findFirst({
      where: {
        cutoff_type: 'calendar',
        dob_start: calDobStart,
      },
    });

    if (existingCal) {
      await prisma.age_groups.update({
        where: { id: existingCal.id },
        data: {
          name: calName,
          dob_start: calDobStart,
          dob_end: calDobEnd,
          cutoff_type: 'calendar',
        },
      });
      console.log(`Updated Calendar Age Group: ${calName}`);
    } else {
      await prisma.age_groups.create({
        data: {
          name: calName,
          dob_start: calDobStart,
          dob_end: calDobEnd,
          cutoff_type: 'calendar',
        },
      });
      console.log(`Created Calendar Age Group: ${calName}`);
    }

    // 2. Seasonal Year Age Group (8/1 - 7/31)
    const seasName = `${year} (8/1 - 7/31)`;
    const seasDobStart = new Date(`${year}-08-01T00:00:00.000Z`);
    const seasDobEnd = new Date(`${year + 1}-07-31T23:59:59.999Z`);

    const existingSeas = await prisma.age_groups.findFirst({
      where: {
        cutoff_type: 'seasonal',
        dob_start: seasDobStart,
      },
    });

    if (existingSeas) {
      await prisma.age_groups.update({
        where: { id: existingSeas.id },
        data: {
          name: seasName,
          dob_start: seasDobStart,
          dob_end: seasDobEnd,
          cutoff_type: 'seasonal',
        },
      });
      console.log(`Updated Seasonal Age Group: ${seasName}`);
    } else {
      await prisma.age_groups.create({
        data: {
          name: seasName,
          dob_start: seasDobStart,
          dob_end: seasDobEnd,
          cutoff_type: 'seasonal',
        },
      });
      console.log(`Created Seasonal Age Group: ${seasName}`);
    }
  }

  // Set cutoff_type on any remaining existing age groups if null
  const remainingNulls = await prisma.age_groups.findMany({
    where: { cutoff_type: null },
  });
  for (const ag of remainingNulls) {
    await prisma.age_groups.update({
      where: { id: ag.id },
      data: { cutoff_type: 'calendar' },
    });
  }

  console.log('Age Groups seeding complete!');
}

seedAgeGroups()
  .catch((e) => {
    console.error('Error seeding age groups:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
