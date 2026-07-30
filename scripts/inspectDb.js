const { PrismaClient } = require('@prisma/client');
(async () => {
  const db = new PrismaClient();
  try {
    const users = await db.user.findMany();
    console.log('Users:', users);
    const players = await db.players.findMany();
    console.log('Players:', players);
    const seasonPlayers = await db.season_players.findMany();
    console.log('Season Players:', seasonPlayers);
  } catch (e) {
    console.error('error', e);
  } finally {
    await db.$disconnect();
  }
})();
