"use client";

import React, { useEffect, useState, use, useTransition } from "react";
import { getSessionRoster, updateSessionRosterBatch } from "./actions";
import { Users, AlertCircle, ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, Save, Trash, Star } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import Button from "@/components/ui/Button";

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

  const { session, event, roster } = data;

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

  const filteredRoster = showUnavailable 
    ? resolvedRoster 
    : resolvedRoster.filter((r: any) => r.availability_status === "available");

  const totalPlayers = resolvedRoster.length;
  const availablePlayers = resolvedRoster.filter((r: any) => r.availability_status === "available").length;
  const presentPlayers = resolvedRoster.filter((r: any) => r.availability_status === "available" && r.attendance_status === "present").length;

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

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

        {/* Filters */}
        <div className='flex justify-between items-center px-2'>
          <h2 className='text-lg font-bold flex items-center gap-2 text-text'>
            <Users size={20} className='text-primary' />
            Player Registry
          </h2>
          <label className='flex items-center gap-2 cursor-pointer'>
            <input 
              type='checkbox' 
              checked={showUnavailable} 
              onChange={(e) => setShowUnavailable(e.target.checked)}
              className='rounded text-primary focus:ring-primary bg-background border-border cursor-pointer'
            />
            <span className='text-sm font-bold text-muted'>Show Unavailable Players</span>
          </label>
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
                      No players found for this event's age groups.
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
                              <Link href={`/admin/players/${item.player.id}`} className='text-text hover:text-primary transition-colors block'>
                                {item.player.first_name} {item.player.last_name}
                              </Link>
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

                        {/* Session Attendance Select */}
                        <td className='p-4 text-center align-middle'>
                          <select
                            disabled={!isAvailable}
                            value={item.attendance_status}
                            onChange={(e) => handleAttendanceChange(item.player.id, e.target.value)}
                            className={`text-xs font-bold py-1.5 px-2 border rounded outline-none transition-all cursor-pointer ${
                              !isAvailable 
                                ? "opacity-50 cursor-not-allowed bg-background border-border text-muted" 
                                : item.attendance_status === "present"
                                  ? "bg-green-500/10 text-green-600 border-green-500/20 focus:ring-1 focus:ring-green-500/50"
                                  : item.attendance_status === "absent"
                                    ? "bg-danger/10 text-danger border-danger/20 focus:ring-1 focus:ring-danger/50"
                                    : "bg-orange-500/10 text-orange-600 border-orange-500/20 focus:ring-1 focus:ring-orange-500/50"
                            }`}
                          >
                            <option value='present'>✓ Present</option>
                            <option value='absent'>✗ Absent</option>
                            <option value='excused'>! Excused</option>
                          </select>
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
    </div>
  );
}
