import prisma from "@/lib/prisma";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function toDateString(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "string") return val.slice(0, 10);
  return null;
}

function toDateTimeString(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Seasons {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
}
export interface Clubs {
  id: number;
  name: string;
}
export interface AgeGroups {
  id: number;
  name: string;
  dob_start: string | null;
  dob_end: string | null;
}

export async function getSeasons(): Promise<Seasons[]> {
  const bodies = await prisma.seasons.findMany({
    orderBy: { name: "asc" },
  });
  return bodies.map((r) => ({
    id: r.id,
    name: r.name,
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
  }));
}
export async function getClubs(): Promise<Clubs[]> {
  const bodies = await prisma.clubs.findMany({
    orderBy: { name: "asc" },
  });
  return bodies.map((r) => ({
    id: r.id,
    name: r.name,
  }));
}
export async function getAgeGroups(): Promise<AgeGroups[]> {
  const bodies = await prisma.age_groups.findMany({
    orderBy: { name: "asc" },
  });
  return bodies.map((r) => ({
    id: r.id,
    name: r.name,
    dob_start: r.dob_start ?? null,
    dob_end: r.dob_end ?? null,
  }));
}
