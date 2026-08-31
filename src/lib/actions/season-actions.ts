"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "../auth/auth-utils";
import prisma from "../prisma";
import { seasonSchema } from "../validations/schemas";
import { cookies } from "next/headers";

export async function createSeason(data: Record<string, string>) {
  await verifyAdmin();

  // Validate server-side with Zod
  const parsedData = seasonSchema.parse(data);

  try {
    const newBody = await prisma.$transaction(async (tx) => {
      const season = await tx.seasons.create({
        data: {
          name: parsedData.name,
          start_date: parsedData.start_date ? new Date(parsedData.start_date) : null,
          end_date: parsedData.end_date ? new Date(parsedData.end_date) : null,
        },
      });

      const allClubs = await tx.clubs.findMany({ select: { id: true } });
      if (allClubs.length > 0) {
        await tx.club_seasons.createMany({
          data: allClubs.map((club) => ({
            club_id: club.id,
            season_id: season.id,
          })),
          skipDuplicates: true,
        });
      }

      return season;
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin");
    revalidatePath("/admin/seasons");
    revalidatePath("/admin/events");
    revalidatePath("/admin/players");
    return newBody; // Return the created object so nested configs get the ID!
  } catch (error) {
    console.error("Error creating season:", error);
    throw new Error("Failed to create season");
  }
}

export async function updateSeason(id: unknown, data: Record<string, string>) {
  await verifyAdmin();
  const numId = Number(id);
  if (!numId) throw new Error("ID required");

  // Partial validation for updates
  const parsedData = seasonSchema.partial().parse(data);

  await prisma.seasons.update({
    where: { id: numId },
    data: {
      name: parsedData.name,
      start_date: parsedData.start_date ? new Date(parsedData.start_date) : undefined,
      end_date: parsedData.end_date ? new Date(parsedData.end_date) : undefined,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/seasons");
  revalidatePath("/admin/players");
}

export async function deleteSeason(id: unknown) {
  await verifyAdmin();
  const numId = Number(id);
  if (!numId) throw new Error("ID required");

  await prisma.seasons.delete({
    where: { id: numId },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/seasons");
  revalidatePath("/admin/players");
}

export async function getActiveSeasonId() {
  const cookieStore = await cookies();
  const activeSeasonId = cookieStore.get("activeSeasonId")?.value;
  if (activeSeasonId) return parseInt(activeSeasonId);

  const firstSeason = await prisma.seasons.findFirst({
    orderBy: { start_date: "desc" },
    select: { id: true },
  });
  return firstSeason ? firstSeason.id : null;
}

export async function setActiveSeason(seasonId: string) {
  const cookieStore = await cookies();
  cookieStore.set("activeSeasonId", seasonId, { path: "/" });
  revalidatePath("/", "layout");
}
