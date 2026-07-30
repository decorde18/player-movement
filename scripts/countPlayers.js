const { PrismaClient } = require('@prisma/client');
(async () => {
  const db = new PrismaClient();
  try {
    const count = await db.players.count();
    console.log('players count', count);
  } catch (e) {
    console.error('error', e);
  } finally {
    await db.$disconnect();
  }
})();
