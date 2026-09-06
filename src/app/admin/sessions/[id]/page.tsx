"use client";

import React, { useEffect, useState, use, useTransition } from "react";
import { getSessionRoster, updateSessionRosterBatch, addTrainUpPlayerToSession } from "./actions";
import { Users, AlertCircle, ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, Save, Trash, Star, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import FilterBar from "@/components/ui/FilterBar";
import SortControl from "@/components/ui/SortControl";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SessionRosterPage(props: PageProps) {
  const params = use(props.params);
  const sessionId = parseInt(params.id, 10);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Train up modal state
  const [showAddTrainUpModal, setShowAddTrainUpModal] = useState(false);
  const [selectedTrainUpPlayerId, setSelectedTrainUpPlayerId] = useState("");
  const [trainUpSearch, setTrainUpSearch] = useState("");

  // Sort / search / filter
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [attendanceFilter, setAttendanceFilter] = useState("all");

  // Local state to keep track of modifications before batch saving
  // Format: Record<playerId, { availabilityStatus?, attendanceStatus?, tryoutUpdates: { seasonAgeGroupId, clubId, tryoutNumber }[] }>
  const [pendingChanges, setPendingChanges] = useState<Record<number, any>>({});

  const loadData = async () => {
    try {
      const res = await getSessionRoster(sessionId);
      setData(res);
      setPendingChanges({});
    } catch (e: any) {
      toast.error(e.message || "Failed to load roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const handleAvailabilityChange = (playerId: number, currentStatus: string) => {
    const defaultStatus = currentStatus === "available" ? "unavailable" : "available";
    const nextStatus = pendingChanges[playerId]?.availabilityStatus 
      ? (pendingChanges[playerId].availabilityStatus === "available" ? "unavailable" : "available")
      : defaultStatus;

    setPendingChanges((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        availabilityStatus: nextStatus,
      },
    }));
  };

  const handleAttendanceChange = (playerId: number, newStatus: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        attendanceStatus: newStatus,
      },
    }));
  };

  const handleTryoutNumberChange = (playerId: number, seasonAgeGroupId: number, clubId: number | null, value: string) => {
    setPendingChanges((prev) => {
      const currentUpdates = prev[playerId]?.tryoutUpdates || [];
      const filtered = currentUpdates.filter((tu: any) => tu.seasonAgeGroupId !== seasonAgeGroupId);
      
      return {
        ...prev,
        [playerId]: {
          ...prev[playerId],
          tryoutUpdates: [
            ...filtered,
            { seasonAgeGroupId, clubId, tryoutNumber: value },
          ],
        },
      };
    });
  };

  const handleDiscardChanges = () => {
    setPendingChanges({});
    toast.info("Pending changes discarded.");
  };

  const handleAddTrainUpPlayer = async () => {
    if (!selectedTrainUpPlayerId) {
      toast.error("Please select a player to add.");
      return;
    }
    startTransition(async () => {
      const res = await addTrainUpPlayerToSession(sessionId, Number(selectedTrainUpPlayerId));
      if (res.success) {
        toast.success("Train-Up player added to session roster!");
        setShowAddTrainUpModal(false);
        setSelectedTrainUpPlayerId("");
        loadData();
      } else {
        toast.error(res.error || "Failed to add train-up player.");
      }
    });
  };

  const handleSaveChanges = () => {
    if (Object.keys(pendingChanges).length === 0) return;

    startTransition(async () => {
      const updates = Object.entries(pendingChanges).map(([playerIdStr, change]: [string, any]) => ({
        playerId: parseInt(playerIdStr, 10),
        availabilityStatus: change.availabilityStatus,
        attendanceStatus: change.attendanceStatus,
        tryoutUpdates: change.tryoutUpdates,
      }));

      try {
        const res = await updateSessionRosterBatch(sessionId, data.event.id, updates);
        if (res.success) {
          toast.success("Successfully saved all changes in one batch!");
          loadData();
        } else {
          toast.error("Failed to save batch changes.");
        }
      } catch (err: any) {
        toast.error("Error saving changes: " + err.message);
      }
    });
  };

  if (loading) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-background text-text gap-3'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading Session Roster...</span>
      </div>
    );
  }

  if (!data || !data.session) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-background text-text gap-3'>
        <AlertCircle className='text-danger' size={44} />
        <span className='font-bold text-muted'>Session not found.</span>
        <Link href='/admin/events'>
          <Button variant='outline' className='mt-4'>Go Back</Button>
        </Link>
      </div>
    );
  }

  const { session, event, roster, sessionDivisions = [] } = data;

  // Resolve display values considering pendingChanges locally
  const resolvedRoster = roster.map((item: any) => {
    const pid = item.player.id;
    const pending = pendingChanges[pid];
    
    let availability_status = item.availability_status;
    let attendance_status = item.attendance_status;
    let seasonAssignments = item.seasonAssignments;

    if (pending) {
      if (pending.availabilityStatus !== undefined) {
        availability_status = pending.availabilityStatus;
      }
      if (pending.attendanceStatus !== undefined) {
        attendance_status = pending.attendanceStatus;
      }
      if (pending.tryoutUpdates !== undefined) {
        seasonAssignments = item.seasonAssignments.map((sa: any) => {
          const match = pending.tryoutUpdates.find((tu: any) => tu.seasonAgeGroupId === sa.season_age_group_id);
          return match ? { ...sa, tryout_number: match.tryoutNumber } : sa;
        });
      }
    }

    return {
      ...item,
      availability_status,
      attendance_status,
      seasonAssignments,
    };
  });

  // Base filter: Age Group selection & unavailable toggle
  const ageGroupFilteredRoster = selectedAgeGroupId === "all"
    ? resolvedRoster
    : resolvedRoster.filter((r: any) =>
        r.seasonAssignments?.some((sa: any) => sa.season_age_group_id === Number(selectedAgeGroupId))
      );

  const baseRoster = showUnavailable
    ? ageGroupFilteredRoster
    : ageGroupFilteredRoster.filter((r: any) => r.availability_status === "available");

  // Apply search
  const afterSearch = baseRoster.filter((r: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = `${r.player.first_name} ${r.player.last_name}`.toLowerCase();
    const tryout = r.seasonAssignments?.map((sa: any) => sa.tryout_number || "").join(" ").toLowerCase();
    return name.includes(q) || tryout.includes(q);
  });

  // Apply attendance filter
  const afterAttendanceFilter = attendanceFilter === "all"
    ? afterSearch
    : afterSearch.filter((r: any) => r.attendance_status === attendanceFilter);

  // Apply sort
  const filteredRoster = [...afterAttendanceFilter].sort((a: any, b: any) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    if (sortKey === "name") {
      const na = `${a.player.last_name} ${a.player.first_name}`.toLowerCase();
      const nb = `${b.player.last_name} ${b.player.first_name}`.toLowerCase();
      return na.localeCompare(nb) * dir;
    }
    if (sortKey === "tryout") {
      const ta = parseInt(a.seasonAssignments?.[0]?.tryout_number || "9999", 10);
      const tb = parseInt(b.seasonAssignments?.[0]?.tryout_number || "9999", 10);
      if (!isNaN(ta) && !isNaN(tb)) return (ta - tb) * dir;
      const tsa = (a.seasonAssignments?.[0]?.tryout_number || "").toLowerCase();
      const tsb = (b.seasonAssignments?.[0]?.tryout_number || "").toLowerCase();
      return tsa.localeCompare(tsb) * dir;
    }
    if (sortKey === "attendance") {
      const aa = a.attendance_status || "";
      const ab = b.attendance_status || "";
      return aa.localeCompare(ab) * dir;
    }
    return 0;
  });

  const totalPlayers = resolvedRoster.length;
  const availablePlayers = resolvedRoster.filter((r: any) => r.availability_status === "available").length;
  const presentPlayers = resolvedRoster.filter((r: any) => r.availability_status === "available" && r.attendance_status === "present").length;

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const filterGroups = [
    {
      id: "attendance",
      label: "Attendance",
      value: attendanceFilter,
      options: [
        { value: "all", label: "All" },
        { value: "not_checked_in", label: "Not Checked In" },
        { value: "present", label: "Present" },
        { value: "absent", label: "Absent" },
        { value: "excused", label: "Excused" },
      ],
      onChange: setAttendanceFilter,
    },
  ];

  const sortOptions = [
    { value: "name", label: "Name" },
    { value: "tryout", label: "Tryout #" },
    { value: "attendance", label: "Attendance" },
  ];

  return (
    <div className='min-h-screen bg-background text-text p-4 md:p-8 animate-fadeIn pb-24'>
      <div className='w-full max-w-full min-w-0 space-y-6'>
        
        {/* Header */}
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/80 border border-border p-6 rounded-2xl shadow-sm backdrop-blur-md'>
          <div className='flex items-start gap-4'>
            <Link href='/admin/events' className='mt-1 p-2 bg-background border border-border rounded-xl text-muted hover:text-text transition-all'>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className='flex items-center gap-2 mb-1'>
                <span className='inline-block text-[0.65rem] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase border border-primary/20'>
                  {event.event_type} EVENT
                </span>
                <span className='text-xs font-bold text-muted'>
                  {event.seasons?.name || "No Season"}
                </span>
              </div>
              <h1 className='text-2xl font-bold flex items-center gap-2'>
                {session.name}
              </h1>
              <p className='text-sm text-muted font-medium flex items-center gap-1.5 mt-1'>
                <Clock size={14} className='text-muted/60' />
                {new Date(session.session_date).toLocaleDateString()}
                <span className='mx-2 opacity-30'>|</span>
                Part of: <strong>{event.name}</strong>
              </p>
            </div>
          </div>
          
          <div className='flex items-center gap-3 self-center'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowAddTrainUpModal(true)}
              className='font-bold text-xs flex items-center gap-1.5 h-[38px] border-amber-500/40 text-amber-600 hover:bg-amber-500/10'
            >
              <Plus size={14} /> Add Train-Up Player
            </Button>
            
            <Link href={`/admin/sessions/${sessionId}/ratings`}>
              <Button variant='primary' size='sm' className='font-bold text-xs bg-accent hover:bg-accent-hover text-white flex items-center gap-1.5 h-[38px]'>
                <Star size={14} /> Evaluation Ratings
              </Button>
            </Link>
            
            <div className='flex gap-4 text-center md:text-right'>
              <div className='bg-background border border-border px-4 py-2 rounded-xl'>
                <span className='block text-[0.65rem] font-bold text-muted uppercase'>Event Roster</span>
                <span className='text-lg font-bold text-text'>{availablePlayers} <span className='text-sm text-muted/60 font-medium'>/ {totalPlayers}</span></span>
              </div>
              <div className='bg-background border border-border px-4 py-2 rounded-xl'>
                <span className='block text-[0.65rem] font-bold text-muted uppercase'>Session Attendance</span>
                <span className='text-lg font-bold text-primary'>{presentPlayers} <span className='text-sm text-muted/60 font-medium'>present</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Age Group Filter Tabs */}
        {sessionDivisions && sessionDivisions.length > 1 && (
          <div className='flex items-center gap-2 bg-surface/60 border border-border p-2.5 rounded-2xl shadow-sm overflow-x-auto'>
            <span className='text-xs font-bold text-muted uppercase tracking-wider px-2 shrink-0'>Age Group Filter:</span>
            <button
              type='button'
              onClick={() => setSelectedAgeGroupId("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                selectedAgeGroupId === "all"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-background text-muted hover:text-text border border-border"
              }`}
            >
              All Combined ({resolvedRoster.length})
            </button>
            {sessionDivisions.map((sag: any) => {
              const count = resolvedRoster.filter((r: any) =>
                r.seasonAssignments?.some((sa: any) => sa.season_age_group_id === sag.id)
              ).length;
              return (
                <button
                  key={sag.id}
                  type='button'
                  onClick={() => setSelectedAgeGroupId(sag.id.toString())}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    selectedAgeGroupId === sag.id.toString()
                      ? "bg-primary text-white shadow-sm"
                      : "bg-background text-muted hover:text-text border border-border"
                  }`}
                >
                  {sag.age_groups?.name || sag.name} ({sag.gender}) <span className='opacity-70'>({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filters Row */}
        <div className='flex flex-wrap items-center justify-between gap-3 px-2'>
          <div className='flex items-center gap-4'>
            <h2 className='text-base font-bold flex items-center gap-2 text-text'>
              <Users size={17} className='text-primary' />
              Player Registry
            </h2>
            <label className='flex items-center gap-1.5 cursor-pointer'>
              <input 
                type='checkbox' 
                checked={showUnavailable} 
                onChange={(e) => setShowUnavailable(e.target.checked)}
                className='rounded text-primary focus:ring-primary bg-background border-border cursor-pointer'
              />
              <span className='text-xs font-bold text-muted'>Show Unavailable</span>
            </label>
          </div>
          <div className='flex items-center gap-2 flex-wrap'>
            <FilterBar
              filters={filterGroups}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder='Search name or tryout #...'
              onResetFilters={() => { setSearchQuery(""); setAttendanceFilter("all"); setSelectedAgeGroupId("all"); }}
              className='min-w-[200px]'
            />
            <SortControl
              options={sortOptions}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}
              size='sm'
            />
          </div>
        </div>

        {/* Roster Table */}
        <div className='bg-surface border border-border rounded-2xl shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm border-collapse'>
              <thead className='bg-background text-text-label font-bold border-b border-border text-xs'>
                <tr>
                  <th className='p-4'>Player Name</th>
                  <th className='p-4'>Tryout #</th>
                  <th className='p-4'>Club / Divisions</th>
                  <th className='p-4 text-center'>Event Availability</th>
                  <th className='p-4 text-center'>Session Attendance</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-surface'>
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={5} className='p-8 text-center text-muted font-bold'>
                      No players found for this event&apos;s age groups.
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((item: any) => {
                    const isAvailable = item.availability_status === "available";
                    return (
                      <tr key={item.player.id} className={`hover:bg-background/20 transition-all ${!isAvailable ? "opacity-50 grayscale bg-background/10" : ""}`}>
                        <td className='p-4 font-semibold text-text'>
                          <div className='flex items-center gap-3'>
                            <div className='w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase'>
                              {item.player.first_name[0]}{item.player.last_name[0]}
                            </div>
                            <div>
                              <div className='flex items-center gap-1.5 flex-wrap'>
                                <Link href={`/admin/players/${item.player.id}`} className='text-text hover:text-primary transition-colors block font-bold'>
                                  {item.player.first_name} {item.player.last_name}
                                </Link>
                                {item.isTrainUp && (
                                  <span className='inline-block text-[0.55rem] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30'>
                                    Train Up
                                  </span>
                                )}
                              </div>
                              <span className='text-[0.65rem] text-muted'>ID: {item.player.id}</span>
                            </div>
                          </div>
                        </td>
                        {/* Tryout Number Editable Input */}
                        <td className='p-4 align-middle'>
                          {item.seasonAssignments.map((sp: any) => (
                            <div key={sp.id} className='flex items-center gap-1.5 mb-1 last:mb-0'>
                              <span className='text-[0.6rem] font-bold text-muted w-10 truncate'>
                                {sp.season_age_groups?.age_groups?.name}:
                              </span>
                              <input
                                type='text'
                                disabled={!isAvailable}
                                value={sp.tryout_number || ""}
                                placeholder='N/A'
                                onChange={(e) => handleTryoutNumberChange(item.player.id, sp.season_age_group_id, sp.club_id, e.target.value)}
                                className='w-16 px-1.5 py-0.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50'
                              />
                            </div>
                          ))}
                        </td>
                        <td className='p-4'>
                          <div className='font-bold text-xs text-text mb-1'>
                            {item.club?.name || "No Club"}
                          </div>
                          <div className='flex flex-wrap gap-1'>
                            {item.seasonAssignments.map((sp: any) => (
                              <span key={sp.id} className='inline-block px-1.5 py-0.5 bg-background border border-border text-muted font-bold text-[0.65rem] rounded'>
                                {sp.season_age_groups?.age_groups?.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        
                        {/* Event Availability Toggle */}
                        <td className='p-4 text-center align-middle'>
                          <button
                            onClick={() => handleAvailabilityChange(item.player.id, item.availability_status)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                              isAvailable 
                                ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" 
                                : "bg-danger/10 text-danger border-danger/20 hover:bg-danger/20"
                            }`}
                          >
                            {isAvailable ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {isAvailable ? "Available" : "Unavailable"}
                          </button>
                        </td>

                        {/* Session Attendance — Select dropdown + quick check-in */}
                        <td className='p-4 text-center align-middle'>
                          <div className='flex items-center justify-center gap-2'>
                            <select
                              disabled={!isAvailable}
                              value={item.attendance_status}
                              onChange={(e) => handleAttendanceChange(item.player.id, e.target.value)}
                              className={`text-xs font-bold py-1 px-2 rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                item.attendance_status === "present"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                                  : item.attendance_status === "absent"
                                  ? "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400"
                                  : item.attendance_status === "excused"
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                                  : "bg-slate-500/10 text-slate-600 border-slate-300 dark:border-slate-700 dark:text-slate-400"
                              }`}
                            >
                              <option value='not_checked_in'>Not Checked In</option>
                              <option value='present'>Present</option>
                              <option value='absent'>Absent</option>
                              <option value='excused'>Excused</option>
                            </select>
                            {item.attendance_status === "not_checked_in" && isAvailable && (
                              <button
                                type='button'
                                onClick={() => handleAttendanceChange(item.player.id, "present")}
                                className='px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm shrink-0'
                                title='Quick Check In'
                              >
                                Check In
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Batch Actions Bar */}
      {hasPendingChanges && (
        <div className='fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface/90 border border-border rounded-full shadow-2xl px-6 py-4 flex items-center gap-6 backdrop-blur-md z-[100] animate-fadeIn'>
          <div className='flex items-center gap-2'>
            <AlertCircle size={16} className='text-primary animate-pulse' />
            <span className='text-xs font-bold text-text-label'>
              {Object.keys(pendingChanges).length} players modified locally
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleDiscardChanges}
              disabled={isPending}
              className='flex items-center gap-1 text-xs font-bold'
            >
              <Trash size={14} /> Discard
            </Button>
            <Button
              variant='primary'
              size='sm'
              onClick={handleSaveChanges}
              disabled={isPending}
              className='flex items-center gap-1 text-xs font-bold'
            >
              {isPending ? (
                <>
                  <Loader2 className='animate-spin' size={14} /> Saving...
                </>
              ) : (
                <>
                  <Save size={14} /> Save Batch Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Modal for Adding Individual Train-Up Player */}
      <Modal
        isOpen={showAddTrainUpModal}
        onClose={() => {
          setShowAddTrainUpModal(false);
          setSelectedTrainUpPlayerId("");
          setTrainUpSearch("");
        }}
        title='Add Individual Train-Up Player'
        size='md'
        footer={
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setShowAddTrainUpModal(false);
                setSelectedTrainUpPlayerId("");
                setTrainUpSearch("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant='primary'
              size='sm'
              onClick={handleAddTrainUpPlayer}
              disabled={isPending || !selectedTrainUpPlayerId}
            >
              {isPending ? "Adding..." : "Add to Session"}
            </Button>
          </div>
        }
      >
        <div className='space-y-4'>
          <p className='text-xs text-muted font-medium'>
            Select any player from your club roster to allow them to train up in this evaluation session.
          </p>
          <div>
            <label className='block text-xs font-bold text-text-label mb-1'>Search Player</label>
            <input
              type='text'
              placeholder='Search by name or birth year...'
              value={trainUpSearch}
              onChange={(e) => setTrainUpSearch(e.target.value)}
              className='w-full text-xs p-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary mb-2'
            />
            <div className='border border-border rounded-lg max-h-56 overflow-y-auto bg-surface divide-y divide-border/50'>
              {((data?.allClubPlayers || []).filter((p: any) => {
                if (!trainUpSearch.trim()) return true;
                const q = trainUpSearch.toLowerCase();
                const name = `${p.first_name} ${p.last_name}`.toLowerCase();
                const ags = p.season_players
                  ?.map((sp: any) => sp.season_age_groups?.age_groups?.name || "")
                  .join(" ")
                  .toLowerCase();
                return name.includes(q) || ags.includes(q);
              })).length === 0 ? (
                <div className='p-4 text-center text-xs text-muted italic'>
                  No players found matching your search.
                </div>
              ) : (
                (data?.allClubPlayers || [])
                  .filter((p: any) => {
                    if (!trainUpSearch.trim()) return true;
                    const q = trainUpSearch.toLowerCase();
                    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
                    const ags = p.season_players
                      ?.map((sp: any) => sp.season_age_groups?.age_groups?.name || "")
                      .join(" ")
                      .toLowerCase();
                    return name.includes(q) || ags.includes(q);
                  })
                  .map((p: any) => {
                    const isSelected = selectedTrainUpPlayerId === p.id.toString();
                    const agNames = p.season_players
                      ?.map((sp: any) => `${sp.season_age_groups?.age_groups?.name || ""} (${sp.season_age_groups?.gender || ""})`)
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedTrainUpPlayerId(p.id.toString())}
                        className={`flex items-center justify-between p-2.5 text-xs cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10 font-bold text-primary" : "hover:bg-background/80 text-text"
                        }`}
                      >
                        <div className='flex items-center gap-2'>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-primary bg-primary text-white" : "border-border"
                            }`}
                          >
                            {isSelected && <Check size={10} />}
                          </div>
                          <div>
                            <div className='font-bold text-text'>
                              {p.first_name} {p.last_name}
                            </div>
                            {agNames && <div className='text-[0.65rem] text-muted'>{agNames}</div>}
                          </div>
                        </div>
                        {p.gender && (
                          <span className='text-[0.65rem] px-1.5 py-0.5 rounded bg-background border border-border text-muted font-semibold'>
                            {p.gender}
                          </span>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
