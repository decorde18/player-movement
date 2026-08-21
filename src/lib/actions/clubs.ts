"use server";

import db from "@/lib/db";
import { cookies } from "next/headers";
import { getServerAuthSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "../auth/auth-utils";

export async function getActiveClubId() {
  const session = await getServerAuthSession();
  if (!session?.user) return null;

  const user = session.user as any;
  if (user.role === "system_admin") {
    const cookieStore = await cookies();
    const activeClubId = cookieStore.get("activeClubId")?.value;
    if (activeClubId) return parseInt(activeClubId);

    const firstClub = await db.clubs.findFirst({
      orderBy: { name: "asc" },
      select: { id: true },
    });
    return firstClub ? firstClub.id : null;
  }

  return user.clubId || null;
}

export async function setActiveClub(clubId: string) {
  const session = await getServerAuthSession();
  if ((session?.user as any)?.role === "system_admin") {
    const cookieStore = await cookies();
    cookieStore.set("activeClubId", clubId, { path: "/" });
    revalidatePath("/", "layout");
  }
}

export async function createClub(formData: FormData) {
  await verifyAdmin();

  const name = formData.get("name") as string;
  if (!name) throw new Error("Club name is required");

  await db.clubs.create({
    data: { name },
  });
  revalidatePath("/admin/clubs");
}
