"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function getActiveAgeGroupId() {
  const cookieStore = await cookies();
  const activeAgeGroupId = cookieStore.get("activeAgeGroupId")?.value;
  if (activeAgeGroupId) return parseInt(activeAgeGroupId);

  // Fallback to first available season_age_group in active season
  const activeSeasonId = cookieStore.get("activeSeasonId")?.value;
  const whereFilter = activeSeasonId ? { season_id: parseInt(activeSeasonId) } : {};
  
  const firstGroup = await db.season_age_groups.findFirst({
    where: whereFilter,
    orderBy: { age_group_id: "asc" },
    select: { id: true },
  });
  return firstGroup ? firstGroup.id : null;
}

export async function setActiveAgeGroup(ageGroupId: string) {
  const cookieStore = await cookies();
  cookieStore.set("activeAgeGroupId", ageGroupId, { path: "/" });
  revalidatePath("/", "layout");
}
