import db from '../src/lib/db';

async function testDirectBatchImport() {
  console.log("Testing batch transaction chunking & guardian caching...");

  const club = await db.clubs.findFirst();
  if (!club) {
    console.error("No club found");
    return;
  }

  // Create 50 synthetic players with parent details
  const syntheticPlayers = [];
  for (let i = 1; i <= 50; i++) {
    const parentId = Math.ceil(i / 2); // 2 siblings per parent
    syntheticPlayers.push({
      first_name: `TestPlayer${i}`,
      last_name: `Family${parentId}`,
      date_of_birth: `2015-0${(i % 9) + 1}-15`,
      gender: i % 2 === 0 ? "Female" : "Male",
      club_id: club.id,
      parent_first_name: `ParentFirst${parentId}`,
      parent_last_name: `Family${parentId}`,
      parent_email: `parent${parentId}@testfamily.com`,
      parent_phone: `555-010${parentId}`,
    });
  }

  // Pre-fetch guardians cache
  const allGuardians = await db.guardians.findMany();
  const guardianCache = {
    emailMap: new Map<string, any>(),
    nameMap: new Map<string, any>(),
  };
  allGuardians.forEach((g) => {
    if (g.email) guardianCache.emailMap.set(g.email.trim().toLowerCase(), g);
    if (g.first_name && g.last_name) {
      guardianCache.nameMap.set(`${g.first_name.trim().toLowerCase()}:${g.last_name.trim().toLowerCase()}`, g);
    }
  });

  const BATCH_SIZE = 15;
  const startTime = Date.now();

  for (let i = 0; i < syntheticPlayers.length; i += BATCH_SIZE) {
    const chunk = syntheticPlayers.slice(i, i + BATCH_SIZE);
    await db.$transaction(
      async (tx) => {
        for (const p of chunk) {
          const birthDate = new Date(p.date_of_birth);
          const player = await tx.players.create({
            data: {
              first_name: p.first_name,
              last_name: p.last_name,
              date_of_birth: birthDate,
              gender: p.gender,
            },
          });

          // Guardian logic with cache
          const fName = p.parent_first_name.trim();
          const lName = p.parent_last_name.trim();
          const emailStr = p.parent_email.trim().toLowerCase();
          const phoneStr = p.parent_phone.trim();

          let guardian = null;
          if (emailStr && guardianCache.emailMap.has(emailStr)) {
            guardian = guardianCache.emailMap.get(emailStr);
          } else {
            guardian = await tx.guardians.create({
              data: {
                first_name: fName,
                last_name: lName,
                email: emailStr,
                phone: phoneStr,
              },
            });
            guardianCache.emailMap.set(emailStr, guardian);
          }

          await tx.player_guardians.create({
            data: {
              player_id: player.id,
              guardian_id: guardian.id,
              relationship: "parent",
              is_primary: true,
            },
          });
        }
      },
      {
        maxWait: 30000,
        timeout: 180000,
      }
    );
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`50 players batch imported in ${elapsed} seconds!`);

  const playersCount = await db.players.count();
  const guardiansCount = await db.guardians.count();
  const playerGuardiansCount = await db.player_guardians.count();
  console.log({ playersCount, guardiansCount, playerGuardiansCount });

  // Cleanup test data
  await db.players.deleteMany({ where: { last_name: { startsWith: "Family" } } });
  await db.guardians.deleteMany({ where: { last_name: { startsWith: "Family" } } });
  console.log("Cleanup complete!");
}

testDirectBatchImport().catch(console.error).finally(() => db.$disconnect());
