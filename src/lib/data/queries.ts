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
