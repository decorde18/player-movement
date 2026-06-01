"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "../auth/auth-utils";
import prisma from "../prisma";
import { seasonSchema } from "../validations/schemas";

export async function createSeason(data: Record<string, string>) {
  await verifyAdmin();

  // Validate server-side with Zod
  const parsedData = seasonSchema.parse(data);

  try {
    const newBody = await prisma.seasons.create({
      data: {
        name: parsedData.name,
        start_date: parsedData.start_date,
        end_date: parsedData.end_date,
      },
    });

    revalidatePath("/seasons");
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
    data: parsedData,
  });

  revalidatePath("/seasons");
}

export async function deleteSeason(id: unknown) {
  await verifyAdmin();
  const numId = Number(id);
  if (!numId) throw new Error("ID required");

  await prisma.seasons.delete({
    where: { id: numId },
  });

  revalidatePath("/seasons");
}
