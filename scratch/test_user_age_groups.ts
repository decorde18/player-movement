import db from '../src/lib/db';

async function test() {
  const ags = await db.age_groups.findMany({
    include: {
      season_age_groups: {
        select: { gender: true },
      },
    },
  });

  const formatted = ags.map((ag) => {
    const genders = Array.from(new Set(ag.season_age_groups.map((s) => s.gender))).filter(Boolean);
    const genderStr = genders.length > 0 ? ` (${genders.join(", ")})` : "";
    return `${ag.name}${genderStr}`;
  });

  console.log("Formatted Age Groups with Genders sample:", formatted.filter(f => f.includes("(")));
}

test().catch(console.error).finally(() => db.$disconnect());
