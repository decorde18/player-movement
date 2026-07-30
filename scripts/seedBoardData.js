const { PrismaClient } = require('@prisma/client');
(async () => {
  const db = new PrismaClient();
  try {
    // 1. Link Event 1 to Season Age Group 1
    const division = await db.event_divisions.upsert({
      where: {
        event_id_season_age_group_id: {
          event_id: 1,
          season_age_group_id: 1
        }
      },
      update: {},
      create: {
        event_id: 1,
        season_age_group_id: 1
      }
    });
    console.log('Linked division:', division);

    // 2. Assign Player 1 to Season Age Group 1 and Club 1
    const seasonPlayer = await db.season_players.upsert({
      where: {
        player_id_season_age_group_id_club_id: {
          player_id: 1,
          season_age_group_id: 1,
          club_id: 1
        }
      },
      update: {},
      create: {
        player_id: 1,
        season_age_group_id: 1,
        club_id: 1,
        tryout_number: '101',
        position: 'Forward',
        rating: 8,
        player_status: 'none'
      }
    });
    console.log('Assigned player:', seasonPlayer);

  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
})();
