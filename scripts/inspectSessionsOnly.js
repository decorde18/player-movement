const { PrismaClient } = require('@prisma/client');
(async () => {
  const db = new PrismaClient();
  try {
    const sessions = await db.sessions.findMany();
    console.log('Sessions:', sessions);
  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
})();
