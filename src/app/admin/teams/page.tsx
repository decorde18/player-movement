"use client";

import React, { useEffect, useState } from "react";
import { getTeamsData, createTeam, deleteTeam, updateTeamSortOrder } from "./actions";
import CrudDashboard, { ColumnConfig } from "@/components/admin/CrudDashboard";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Helper to render ordinal label
function ordinal(n: number) {
  if (n <= 0) return `#${n}`;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function TeamsAdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await getTeamsData();
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load team data: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading || !data) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-background text-text gap-3'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading teams...</span>
      </div>
    );
  }

  const { teams, clubs, seasonAgeGroups } = data;

  const handleSave = async (form: any) => {
    const res = await createTeam({
      id: form.id ? Number(form.id) : undefined,
      name: form.name,
      club_id: Number(form.club_id),
      season_age_group_id: form.season_age_group_id ? Number(form.season_age_group_id) : undefined,
      sort_order: form.sort_order !== "" && form.sort_order !== undefined ? Number(form.sort_order) : 0,
    });

    if (res.success) {
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleDelete = async (id: any) => {
    const res = await deleteTeam(Number(id));
    if (res.success) {
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleSortOrderChange = async (seasonTeamId: number, newOrder: number) => {
    const res = await updateTeamSortOrder(seasonTeamId, newOrder);
    if (res.success) {
      toast.success("Team order updated.");
      loadData();
    } else {
      toast.error(res.error || "Failed to update order.");
    }
  };

  const columns: ColumnConfig[] = [
    {
      key: "name",
      label: "Team Name",
      type: "text",
      required: true,
      render: (t: any) => (
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase'>
            {t.name.substring(0, 2)}
          </div>
          <span className='font-bold text-primary'>{t.name}</span>
        </div>
      ),
    },
    {
      key: "club_id",
      label: "Club",
      type: "select",
      required: true,
      options: clubs.map((c: any) => ({ value: c.id, label: c.name })),
      render: (t: any) => (
        <span className='text-xs font-semibold text-muted'>{t.clubs?.name || "No Club"}</span>
      ),
    },
    {
      key: "season_teams",
      label: "Assigned Season & Age Groups",
      type: "custom",
      render: (t: any) => (
        <div className='flex flex-col gap-1.5'>
          {t.season_teams && t.season_teams.length > 0 ? (
            t.season_teams.map((st: any) => (
              <div key={st.id} className='flex items-center gap-2'>
                {/* Ordinal rank badge */}
                <span
                  className={`flex-shrink-0 text-[0.65rem] font-bold px-1.5 py-0.5 rounded border ${
                    (st.sort_order ?? 0) === 1
                      ? "bg-yellow-400/15 text-yellow-600 border-yellow-400/30"
                      : (st.sort_order ?? 0) === 2
                      ? "bg-zinc-300/15 text-zinc-500 border-zinc-300/30"
                      : (st.sort_order ?? 0) === 3
                      ? "bg-orange-400/15 text-orange-600 border-orange-400/30"
                      : "bg-background border-border text-muted"
                  }`}
                >
                  {(st.sort_order ?? 0) > 0 ? ordinal(st.sort_order) : "—"}
                </span>
                <span className='text-xs px-2 py-0.5 bg-background border border-border text-text-label font-bold rounded'>
                  [{st.season_age_groups?.seasons?.name}] {st.season_age_groups?.age_groups?.name} (
                  {st.season_age_groups?.gender})
                </span>
                {/* Quick sort_order input */}
                <input
                  type="number"
                  min={0}
                  defaultValue={st.sort_order ?? 0}
                  className="w-14 text-xs bg-surface border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary text-center"
                  title="Team rank (1 = 1st team, 2 = 2nd team, etc.)"
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val !== (st.sort_order ?? 0)) {
                      handleSortOrderChange(st.id, val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
                <span className="text-[0.6rem] text-muted/50">rank</span>
              </div>
            ))
          ) : (
            <span className='text-muted/40 italic text-xs'>Unassigned</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <CrudDashboard
      title='Teams Management'
      icon={<Shield size={32} className='text-primary' />}
      description={`Manage permanent club teams and assign them to seasons/age-groups. Set a rank number to establish 1st, 2nd, 3rd team hierarchy.`}
      items={teams}
      columns={columns}
      onSave={handleSave}
      onDelete={handleDelete}
      searchPlaceholder='Search teams by name...'
      extraAddFields={(formState, setFormState) => (
        <div className='grid grid-cols-1 gap-4 border-t border-border pt-4 animate-fadeIn'>
          <div>
            <label className='block text-xs font-bold text-text-label mb-1'>
              Assign to Season Age Group (Optional)
            </label>
            <select
              value={formState.season_age_group_id || ""}
              onChange={(e) =>
                setFormState((prev: any) => ({ ...prev, season_age_group_id: e.target.value }))
              }
              className='text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-primary'
            >
              <option value=''>-- Do Not Assign Yet --</option>
              {seasonAgeGroups.map((g: any) => (
                <option key={g.id} value={g.id}>
                  [{g.seasons.name}] {g.age_groups.name} ({g.gender})
                </option>
              ))}
            </select>
          </div>
          {formState.season_age_group_id && (
            <div>
              <label className='block text-xs font-bold text-text-label mb-1'>
                Team Rank / Order
                <span className='ml-1 font-normal text-muted/60'>(1 = 1st team, 2 = 2nd team, …)</span>
              </label>
              <input
                type='number'
                min={0}
                value={formState.sort_order ?? ""}
                onChange={(e) =>
                  setFormState((prev: any) => ({ ...prev, sort_order: e.target.value }))
                }
                placeholder='e.g. 1'
                className='text-sm bg-surface py-2 px-3 border border-border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-primary'
              />
            </div>
          )}
        </div>
      )}
    />
  );
}
