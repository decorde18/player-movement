import db from '../src/lib/db';

async function main() {
  console.log("Starting deletion of all player data...");

  // Delete all players (foreign keys will cascade delete related entries in season_players, event_players, session_players, etc.)
  const deletedPlayers = await db.players.deleteMany({});
  console.log(`Successfully deleted ${deletedPlayers.count} players.`);

  const deletedGuardians = await db.guardians.deleteMany({});
  console.log(`Successfully deleted ${deletedGuardians.count} guardians.`);

  console.log("Database player wipe complete.");
}

main()
  .catch((err) => {
    console.error("Error wiping player data:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
