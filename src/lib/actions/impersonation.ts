"use server";

import db from "@/lib/db";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function getUsersForImpersonation() {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        club_id: true,
        assigned_team_id: true,
        assigned_age_group_id: true,
        season_teams: {
          include: { teams: true }
        },
        age_groups: {
          select: { name: true }
        }
      },
      orderBy: [
        { role: "asc" },
        { name: "asc" }
      ]
    });

    return { success: true, users };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to load users for impersonation." };
  }
}

export async function setImpersonatedUser(userId: number | null) {
  try {
    const cookieStore = await cookies();

    if (userId === null) {
      cookieStore.delete("impersonateUserId");
    } else {
      cookieStore.set("impersonateUserId", userId.toString(), {
        path: "/",
        maxAge: 86400, // 24 hours
        httpOnly: true,
        sameSite: "lax",
      });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to set impersonation cookie." };
  }
}
