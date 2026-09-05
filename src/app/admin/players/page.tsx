"use client";

import React, { useEffect, useState } from "react";
import { getPlayersData, createPlayer, deletePlayer, syncSeasonRosters } from "./actions";
import CrudDashboard, { ColumnConfig } from "@/components/admin/CrudDashboard";
import Input from "@/components/ui/Input";
import { Users, Calendar, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function PlayersAdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleSyncRosters = async () => {
    setIsSyncing(true);
    try {
      const res = await syncSeasonRosters();
      if (res.success) {
        toast.success(`Rosters synchronized! Added ${res.eventPlayersAdded} event player links and ${res.sessionPlayersAdded} session player links.`);
        loadData();
      } else {
        toast.error(res.error || "Failed to sync rosters.");
      }
    } catch (err: any) {
      toast.error("Sync error: " + err.message);
    } finally {
      setIsSyncing(false);
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

  const { players, clubs, seasonAgeGroups, seasons, events, activeSeasonId, userScope } = data;

  const handleSave = async (form: any) => {
    const res = await createPlayer({
      id: form.id ? Number(form.id) : undefined,
      first_name: form.first_name,
      last_name: form.last_name,
      date_of_birth: form.date_of_birth,
      gender: form.gender || "Male",
      club_id: Number(form.club_id),
      season_age_group_id: form.season_age_group_id ? Number(form.season_age_group_id) : undefined,
      tryout_number: form.tryout_number || undefined,
      position: form.position || undefined,
      rating: form.rating ? Number(form.rating) : 0,
      playing_up: form.playing_up || false,
      parent_first_name: form.parent_first_name || undefined,
      parent_last_name: form.parent_last_name || undefined,
      parent_email: form.parent_email || undefined,
      parent_phone: form.parent_phone || undefined,
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
      key: "parent_contact",
      label: "Parent / Guardian Contact",
      type: "custom",
      render: (p: any) => {
        const guardian = p.primaryGuardian || p.player_guardians?.[0]?.guardians;
        const name = guardian ? `${guardian.first_name} ${guardian.last_name}`.trim() : p.parent_name;
        const email = guardian?.email || p.parent_email;
        const phone = guardian?.phone || p.parent_phone;

        if (!name && !email && !phone) {
          return <span className='text-muted/40 italic text-xs'>No Parent Listed</span>;
        }

        return (
          <div className='text-xs space-y-0.5'>
            {name && <div className='font-bold text-text-label'>{name}</div>}
            {email && (
              <div className='text-primary hover:underline text-[0.7rem] truncate max-w-[180px]'>
                <a href={`mailto:${email}`}>{email}</a>
              </div>
            )}
            {phone && <div className='text-muted text-[0.7rem]'>{phone}</div>}
          </div>
        );
      },
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
        { value: "female", label: "Female" },
        { value: "male", label: "Male" },
        { value: "Female", label: "Female" },
        { value: "Male", label: "Male" },
        { value: "Coed", label: "Coed" },
      ],
      render: (p: any) => {
        const normalized = (p.gender || "").toLowerCase();
        const displayLabel =
          normalized === "female" || normalized === "girl"
            ? "Female"
            : normalized === "male" || normalized === "boy"
            ? "Male"
            : p.gender || "N/A";
        return (
          <span
            className={`text-[0.7rem] font-bold px-2 py-0.5 rounded-full ${
              normalized === "male" || normalized === "boy"
                ? "bg-primary/10 text-primary border border-primary/20"
                : normalized === "female" || normalized === "girl"
                ? "bg-purple/10 text-purple border border-purple/20"
                : "bg-muted/10 text-muted"
            }`}
          >
            {displayLabel}
          </span>
        );
      },
    },
    {
      key: "position",
      label: "Position",
      type: "text",
      render: (p: any) => {
        const pos = p.season_players?.[0]?.position;
        return pos ? (
          <span className='inline-block text-[0.65rem] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'>
            Pos: {pos}
          </span>
        ) : (
          <span className='text-muted/40 italic'>--</span>
        );
      },
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
                className={`px-2 py-0.5 border text-text-label font-bold rounded flex items-center gap-1 ${
                  sp.playing_up
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                    : "bg-background border-border"
                }`}
              >
                {sp.season_age_groups?.age_groups?.name} ({sp.season_age_groups?.gender})
                {sp.playing_up && (
                  <span className='text-[0.55rem] font-extrabold uppercase px-1 py-0.2 rounded bg-amber-500 text-white'>
                    Train Up
                  </span>
                )}
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
        seasons,
        events,
        activeSeasonId: activeSeasonId || undefined,
        defaultClubId: userScope.clubId || undefined,
        onImportSuccess: loadData,
      }}
      extraAddFields={(formState, setFormState) => (
        <div className='space-y-4 border-t border-border pt-4 animate-fadeIn col-span-2'>
          <div className='p-4 bg-primary/5 rounded-xl border border-primary/15 space-y-3'>
            <h4 className='text-xs font-bold text-primary uppercase tracking-wider'>Parent / Guardian Information</h4>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <Input
                label='Parent First Name'
                placeholder='e.g. Mary'
                value={formState.parent_first_name || ""}
                onChange={(e: any) =>
                  setFormState((prev: any) => ({ ...prev, parent_first_name: e.target.value }))
                }
              />
              <Input
                label='Parent Last Name'
                placeholder='e.g. Smith'
                value={formState.parent_last_name || ""}
                onChange={(e: any) =>
                  setFormState((prev: any) => ({ ...prev, parent_last_name: e.target.value }))
                }
              />
              <Input
                label='Parent Email'
                type='email'
                placeholder='e.g. mary.smith@example.com'
                value={formState.parent_email || ""}
                onChange={(e: any) =>
                  setFormState((prev: any) => ({ ...prev, parent_email: e.target.value }))
                }
              />
              <Input
                label='Parent Phone'
                type='tel'
                placeholder='e.g. (555) 123-4567'
                value={formState.parent_phone || ""}
                onChange={(e: any) =>
                  setFormState((prev: any) => ({ ...prev, parent_phone: e.target.value }))
                }
              />
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-bold text-text-label mb-1'>
                Assigned Season Age Group
              </label>
              <select
                value={formState.season_age_group_id || ""}
                onChange={(e) =>
                  setFormState((prev: any) => ({ ...prev, season_age_group_id: e.target.value }))
                }
                className='text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-primary'
              >
                <option value=''>-- Unassigned --</option>
                {seasonAgeGroups.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    [{g.seasons.name}] {g.age_groups.name} ({g.gender})
                  </option>
                ))}
              </select>
            </div>
          </div>

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
                Rating (0-10)
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
            <div className='col-span-3 pt-2 border-t border-border/40 mt-1 flex items-center gap-2'>
              <input
                type='checkbox'
                id='playing_up_check'
                checked={!!formState.playing_up}
                onChange={(e) => setFormState((prev: any) => ({ ...prev, playing_up: e.target.checked }))}
                className='rounded text-primary focus:ring-primary bg-background border border-border cursor-pointer'
              />
              <label htmlFor='playing_up_check' className='text-xs font-bold text-text-label cursor-pointer flex items-center gap-1.5'>
                <span className='px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30 text-[0.65rem] uppercase font-extrabold'>
                  Train Up / Play Up
                </span>
                Registering player in an older age group division
              </label>
            </div>
          </div>
        </div>
      )}
    />
  );
}

