const { PrismaClient } = require('@prisma/client');
(async () => {
  const db = new PrismaClient();
  try {
    const seasons = await db.seasons.findMany();
    console.log('Seasons:', seasons);
    const groups = await db.age_groups.findMany();
    console.log('Age Groups:', groups);
    const sGroups = await db.season_age_groups.findMany({
      include: { seasons: true, age_groups: true }
    });
    console.log('Season Age Groups:', sGroups);
    const clubs = await db.clubs.findMany();
    console.log('Clubs:', clubs);
  } catch (e) {
    console.error('error', e);
  } finally {
    await db.$disconnect();
  }
})();
