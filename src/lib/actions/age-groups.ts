"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createAgeGroup(data: {
  name: string;
  dob_start: string;
  dob_end: string;
  cutoff_type?: string;
}) {
  try {
    await db.age_groups.create({
      data: {
        name: data.name,
        dob_start: new Date(data.dob_start),
        dob_end: new Date(data.dob_end),
        cutoff_type: data.cutoff_type || "seasonal",
      },
    });
    revalidatePath("/admin/age-groups");
    revalidatePath("/admin/seasons");
    return { success: true };
  } catch (error) {
    console.error("Failed to create age group:", error);
    throw error;
  }
}

export async function updateAgeGroup(
  id: number,
  data: { name: string; dob_start: string; dob_end: string; cutoff_type?: string },
) {
  try {
    await db.age_groups.update({
      where: { id },
      data: {
        name: data.name,
        dob_start: new Date(data.dob_start),
        dob_end: new Date(data.dob_end),
        cutoff_type: data.cutoff_type,
      },
    });
    revalidatePath("/admin/age-groups");
    revalidatePath("/admin/seasons");
    return { success: true };
  } catch (error) {
    console.error("Failed to update age group:", error);
    throw error;
  }
}

export async function deleteAgeGroup(id: number) {
  try {
    // Check if linked to seasons
    const linked = await db.season_age_groups.findFirst({
      where: { age_group_id: id },
    });

    if (linked) {
      throw new Error(
        "Cannot delete age group because it is linked to one or more seasons.",
      );
    }

    await db.age_groups.delete({
      where: { id },
    });
    revalidatePath("/admin/age-groups");
    revalidatePath("/admin/seasons");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete age group:", error);
    throw error;
  }
}
