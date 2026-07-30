const { PrismaClient } = require('@prisma/client');
(async () => {
  const db = new PrismaClient();
  try {
    const events = await db.events.findMany({ include: { sessions: true } });
    console.log('Events:', events);
    const divs = await db.event_divisions.findMany();
    console.log('Event Divisions:', divs);
  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
})();
