import { EntityShell } from "@/components/entities/EntityShell";
import { getSeasons } from "@/lib/data/queries";
import { seasonConfig } from "@/lib/entities/season";
import { injectOptions, attachCreatable } from "@/lib/utils/formHelpers";
import {
  createSeason,
  updateSeason,
  deleteSeason,
} from "@/lib/actions/season-actions";

export default async function SeasonsPage() {
  const seasons = await getSeasons();

  let config = { ...seasonConfig };

  config = injectOptions(
    config,
    "seasons",
    seasons.map((gb) => ({ label: gb.name, value: String(gb.id) })),
  );

  return (
    <EntityShell
      config={seasonConfig}
      data={seasons}
      onCreate={createSeason}
      onUpdate={updateSeason}
      onDelete={deleteSeason}
    >
      try
    </EntityShell>
  );
}
