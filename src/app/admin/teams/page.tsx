"use client";

import React, { useEffect, useState } from "react";
import { getTeamsData, createTeam, deleteTeam } from "./actions";
import CrudDashboard, { ColumnConfig, SubtableConfig } from "@/components/admin/CrudDashboard";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

  const { teams, clubs, seasonAgeGroups, userScope } = data;

  const handleSave = async (form: any) => {
    const res = await createTeam({
      id: form.id ? Number(form.id) : undefined,
      name: form.name,
      club_id: Number(form.club_id),
      season_age_group_id: form.season_age_group_id ? Number(form.season_age_group_id) : undefined,
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
          <span className='font-bold text-primary'>
            {t.name}
          </span>
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
        <div className='flex flex-wrap gap-1 text-xs'>
          {t.season_teams && t.season_teams.length > 0 ? (
            t.season_teams.map((st: any) => (
              <span
                key={st.id}
                className='px-2 py-0.5 bg-background border border-border text-text-label font-bold rounded'
              >
                [{st.season_age_groups?.seasons?.name}] {st.season_age_groups?.age_groups?.name} ({st.season_age_groups?.gender})
              </span>
            ))
          ) : (
            <span className='text-muted/40 italic'>Unassigned</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <CrudDashboard
      title='Teams Management'
      icon={<Shield size={32} className='text-primary' />}
      description={`Manage permanent club teams and assign them to seasons/age-groups.`}
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
        </div>
      )}
    />
  );
}
