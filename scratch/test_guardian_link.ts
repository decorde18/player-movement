import db from '../src/lib/db';

async function test() {
  console.log("Testing direct guardian creation & sibling linking in Prisma...");

  const clubs = await db.clubs.findMany({ take: 1 });
  if (clubs.length === 0) {
    console.log("No clubs found");
    return;
  }

  // Create Guardian Sarah Smith
  const guardian = await db.guardians.create({
    data: {
      first_name: "Sarah",
      last_name: "Smith",
      email: "sarah.smith@example.com",
      phone: "(555) 987-6543",
    },
  });

  // Create Player 1 (Timmy)
  const p1 = await db.players.create({
    data: {
      first_name: "Timmy",
      last_name: "Smith",
      date_of_birth: new Date("2015-04-10"),
      gender: "Male",
      player_guardians: {
        create: {
          guardian_id: guardian.id,
          relationship: "parent",
        },
      },
    },
  });

  // Create Player 2 (Tommy - sibling linked to SAME guardian)
  const p2 = await db.players.create({
    data: {
      first_name: "Tommy",
      last_name: "Smith",
      date_of_birth: new Date("2017-06-15"),
      gender: "Male",
      player_guardians: {
        create: {
          guardian_id: guardian.id,
          relationship: "parent",
        },
      },
    },
  });

  console.log("Created players:", p1.id, p2.id, "linked to guardian:", guardian.id);

  const guardiansCount = await db.guardians.count();
  const playerGuardiansCount = await db.player_guardians.count();
  console.log("Counts in DB -> Guardians:", guardiansCount, "| Player Guardians links:", playerGuardiansCount);

  // Fetch guardian with players
  const fetchedGuardian = await db.guardians.findUnique({
    where: { id: guardian.id },
    include: {
      player_guardians: {
        include: {
          players: true,
        },
      },
    },
  });

  console.log("Children of Sarah Smith:", fetchedGuardian?.player_guardians.map((pg) => `${pg.players.first_name} ${pg.players.last_name}`));

  // Cleanup test records
  await db.players.deleteMany({});
  await db.guardians.deleteMany({});
  console.log("Test cleanup complete!");
}

test().catch(console.error).finally(() => db.$disconnect());
