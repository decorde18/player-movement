"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createAgeGroup(data: {
  name: string;
  dob_start: string;
  dob_end: string;
}) {
  const connection = await db.getConnection();
  try {
    await connection.query(
      `INSERT INTO age_groups (name, dob_start, dob_end) VALUES (?, ?, ?)`,
      [data.name, data.dob_start, data.dob_end],
    );
    revalidatePath("/admin/age-groups");
    revalidatePath("/admin/seasons");
    return { success: true };
  } catch (error) {
    console.error("Failed to create age group:", error);
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateAgeGroup(
  id: number,
  data: { name: string; dob_start: string; dob_end: string },
) {
  const connection = await db.getConnection();
  try {
    await connection.query(
      `UPDATE age_groups SET name = ?, dob_start = ?, dob_end = ? WHERE id = ?`,
      [data.name, data.dob_start, data.dob_end, id],
    );
    revalidatePath("/admin/age-groups");
    revalidatePath("/admin/seasons");
    return { success: true };
  } catch (error) {
    console.error("Failed to update age group:", error);
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteAgeGroup(id: number) {
  const connection = await db.getConnection();
  try {
    // Check if linked to seasons
    const [linked]: any = await connection.query(
      `SELECT id FROM season_age_groups WHERE age_group_id = ? LIMIT 1`,
      [id],
    );

    if (linked.length > 0) {
      throw new Error(
        "Cannot delete age group because it is linked to one or more seasons.",
      );
    }

    await connection.query(`DELETE FROM age_groups WHERE id = ?`, [id]);
    revalidatePath("/admin/age-groups");
    revalidatePath("/admin/seasons");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete age group:", error);
    throw error;
  } finally {
    connection.release();
  }
}
