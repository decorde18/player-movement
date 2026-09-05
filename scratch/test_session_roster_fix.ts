import db from '../src/lib/db';

async function test() {
  const session = await db.sessions.findUnique({
    where: { id: 9 }, // Session 1 - 2015 (Female)
    include: {
      events: {
        include: {
          event_divisions: true,
        },
      },
      season_age_groups: {
        include: {
          age_groups: true,
        },
      },
    },
  });

  if (!session) {
    console.log("Session not found");
    return;
  }

  const targetDobEnd = session.season_age_group_id && session.season_age_groups?.age_groups?.dob_end
    ? new Date(session.season_age_groups.age_groups.dob_end)
    : null;

  console.log("Session details:", {
    sessionName: session.name,
    targetDobEnd: targetDobEnd?.toISOString().split("T")[0],
    seasonId: session.events.season_id,
  });

  const players = await db.players.findMany({
    where: { id: { in: [400, 485] } },
    include: {
      season_players: {
        where: {
          season_age_groups: { season_id: session.events.season_id },
        },
        include: {
          season_age_groups: true,
        },
      },
    },
  });

  for (const p of players) {
    const playerDob = p.date_of_birth ? new Date(p.date_of_birth) : null;
    const isTrainUp =
      p.season_players.some((sp: any) => sp.playing_up === true) ||
      (targetDobEnd && playerDob && playerDob > targetDobEnd);

    console.log(`Player ${p.first_name} ${p.last_name} (ID ${p.id}):`, {
      dob: p.date_of_birth?.toISOString().split("T")[0],
      isTrainUp: !!isTrainUp,
      divisionsInEventSeason: p.season_players.map((sp: any) => sp.season_age_groups.name),
    });
  }
}

test().catch(console.error).finally(() => db.$disconnect());
