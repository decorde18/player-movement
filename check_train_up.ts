import db from "./src/lib/db.js";
import { syncSeasonRosters } from "./src/app/admin/players/actions.js";

async function main() {
  console.log("Running syncSeasonRosters()...");
  const res = await syncSeasonRosters();
  console.log("syncSeasonRosters result:", res);

  const sp = await db.session_players.findMany({
    where: { player_id: 530 },
    include: { sessions: true }
  });
  console.log("Session players for Tanner Drown (530) AFTER SYNC:", sp.map(s => ({ sessionId: s.session_id, name: s.sessions.name })));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
