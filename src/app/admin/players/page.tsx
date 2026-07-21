"use client";

import React, { useEffect, useState } from "react";
import { getPlayersData, createPlayer, deletePlayer } from "./actions";
import CrudDashboard, { ColumnConfig } from "@/components/admin/CrudDashboard";
import Input from "@/components/ui/Input";
import { Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function PlayersAdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await getPlayersData();
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load player data: " + e.message);
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
        <span className='font-bold text-muted'>Loading player registry...</span>
      </div>
    );
  }

  const { players, clubs, seasonAgeGroups, userScope } = data;

  const handleSave = async (form: any) => {
    const res = await createPlayer({
      id: form.id ? Number(form.id) : undefined,
      first_name: form.first_name,
      last_name: form.last_name,
      date_of_birth: form.date_of_birth,
      gender: form.gender || "Boy",
      club_id: Number(form.club_id),
      season_age_group_id: form.season_age_group_id ? Number(form.season_age_group_id) : undefined,
      tryout_number: form.tryout_number || undefined,
      position: form.position || undefined,
      rating: form.rating ? Number(form.rating) : 0,
    });

    if (res.success) {
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleDelete = async (id: any) => {
    const res = await deletePlayer(Number(id));
    if (res.success) {
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // 1. Column configuration mapping
  const columns: ColumnConfig[] = [
    {
      key: "first_name",
      label: "First Name",
      type: "text",
      required: true,
      render: (p: any) => (
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase'>
            {p.first_name[0]}
            {p.last_name[0]}
          </div>
          <div>
            <Link 
              href={`/admin/players/${p.id}`}
              className='block font-bold text-primary hover:underline hover:text-primary-hover cursor-pointer transition-colors'
            >
              {p.first_name} {p.last_name}
            </Link>
            {p.season_players?.[0]?.tryout_number && (
              <span className='inline-block text-[0.65rem] font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent mt-0.5'>
                Tryout #{p.season_players[0].tryout_number}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "last_name",
      label: "Last Name",
      type: "text",
      required: true,
      // Hidden in display since it's merged in First Name render, but required in Form
    },
    {
      key: "club_id",
      label: "Club",
      type: "select",
      required: true,
      options: clubs.map((c: any) => ({ value: c.id, label: c.name })),
      render: (p: any) => {
        if (p.season_players && p.season_players.length > 0) {
          const clubNames = Array.from(new Set(p.season_players.map((sp: any) => sp.clubs?.name).filter(Boolean)));
          if (clubNames.length > 0) {
            return (
              <div className='flex flex-wrap gap-1'>
                {clubNames.map((name: any, idx) => (
                  <span key={idx} className='inline-block text-[0.65rem] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20'>
                    {name}
                  </span>
                ))}
              </div>
            );
          }
        }
        return <span className='text-xs font-semibold text-muted'>{p.clubs?.name || "No Club"}</span>;
      },
    },
    {
      key: "date_of_birth",
      label: "Birth Date",
      type: "date",
      render: (p: any) => (
        <span className='flex items-center gap-1.5 text-xs text-muted'>
          <Calendar size={14} className='text-muted/60' />
          {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      key: "gender",
      label: "Gender",
      type: "select",
      options: [
        { value: "Boy", label: "Boy" },
        { value: "Girl", label: "Girl" },
        { value: "Coed", label: "Coed" },
      ],
      render: (p: any) => (
        <span
          className={`text-[0.7rem] font-bold px-2 py-0.5 rounded-full ${
            p.gender === "Boy"
              ? "bg-primary/10 text-primary border border-primary/20"
              : p.gender === "Girl"
              ? "bg-purple/10 text-purple border border-purple/20"
              : "bg-muted/10 text-muted"
          }`}
        >
          {p.gender}
        </span>
      ),
    },
    {
      key: "season_players",
      label: "Active Assignments",
      type: "custom",
      render: (p: any) => (
        <div className='flex flex-wrap gap-1 text-xs'>
          {p.season_players && p.season_players.length > 0 ? (
            p.season_players.map((sp: any) => (
              <span
                key={sp.id}
                className='px-2 py-0.5 bg-background border border-border text-text-label font-bold rounded'
              >
                {sp.season_age_groups?.age_groups?.name} ({sp.season_age_groups?.gender})
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
      title='Player Registry'
      icon={<Users size={32} className='text-primary' />}
      description={`Manage player registry accounts, view listings, and mass import rosters.`}
      items={players}
      columns={columns}
      onSave={handleSave}
      onDelete={handleDelete}
      searchPlaceholder='Search players by first/last name...'
      csvImportConfig={{
        clubs,
        seasonAgeGroups,
        defaultClubId: userScope.clubId || undefined,
        onImportSuccess: loadData,
      }}
      extraAddFields={(formState, setFormState) => (
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4 animate-fadeIn'>
          <div>
            <label className='block text-xs font-bold text-text-label mb-1'>
              Initial Season Age Group (Optional)
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
            <div className='grid grid-cols-3 gap-2 col-span-2 p-4 bg-background/50 rounded-xl border border-border animate-fadeIn'>
              <Input
                label='Tryout Number'
                placeholder='e.g. 104'
                value={formState.tryout_number || ""}
                onChange={(e: any) =>
                  setFormState((prev: any) => ({ ...prev, tryout_number: e.target.value }))
                }
              />
              <Input
                label='Position'
                placeholder='e.g. Defender'
                value={formState.position || ""}
                onChange={(e: any) =>
                  setFormState((prev: any) => ({ ...prev, position: e.target.value }))
                }
              />
              <div>
                <label className='block text-xs font-medium text-text-label mb-1'>
                  Initial Rating (0-10)
                </label>
                <select
                  value={formState.rating || "0"}
                  onChange={(e) => setFormState((prev: any) => ({ ...prev, rating: e.target.value }))}
                  className='text-xs bg-surface font-semibold py-1.5 px-2 border border-border rounded w-full'
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    />
  );
}

// Inline Loader component helper since it was inside actions
function Loader2({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size || 24}
      height={size || 24}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M21 12a9 9 0 1 1-6.219-8.56' />
    </svg>
  );
}
