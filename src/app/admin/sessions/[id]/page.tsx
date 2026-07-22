"use client";

import React, { useEffect, useState, use } from "react";
import { getSessionRoster, updateEventAvailability, updateSessionAttendance } from "./actions";
import { Users, AlertCircle, ArrowLeft, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
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

  const loadData = async () => {
    try {
      const res = await getSessionRoster(sessionId);
      setData(res);
    } catch (e: any) {
      toast.error(e.message || "Failed to load roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const handleAvailabilityChange = async (playerId: number, currentStatus: string) => {
    if (!data) return;
    const newStatus = currentStatus === "available" ? "unavailable" : "available";
    
    // Optimistic Update
    setData((prev: any) => ({
      ...prev,
      roster: prev.roster.map((p: any) => 
        p.player.id === playerId ? { ...p, availability_status: newStatus } : p
      )
    }));

    try {
      await updateEventAvailability(data.event.id, playerId, newStatus);
      toast.success("Event availability updated.");
    } catch (e) {
      toast.error("Failed to update availability.");
      loadData(); // Revert on failure
    }
  };

  const handleAttendanceChange = async (playerId: number, newStatus: string) => {
    if (!data) return;
    
    // Optimistic Update
    setData((prev: any) => ({
      ...prev,
      roster: prev.roster.map((p: any) => 
        p.player.id === playerId ? { ...p, attendance_status: newStatus } : p
      )
    }));

    try {
      await updateSessionAttendance(sessionId, playerId, newStatus);
      toast.success("Attendance updated.");
    } catch (e) {
      toast.error("Failed to update attendance.");
      loadData(); // Revert on failure
    }
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
  const filteredRoster = showUnavailable 
    ? roster 
    : roster.filter((r: any) => r.availability_status === "available");

  const totalPlayers = roster.length;
  const availablePlayers = roster.filter((r: any) => r.availability_status === "available").length;
  const presentPlayers = roster.filter((r: any) => r.availability_status === "available" && r.attendance_status === "present").length;

  return (
    <div className='min-h-screen bg-background text-text p-4 md:p-8 animate-fadeIn'>
      <div className='max-w-7xl mx-auto space-y-6'>
        
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
                  <th className='p-4'>Club / Divisions</th>
                  <th className='p-4 text-center'>Event Availability</th>
                  <th className='p-4 text-center'>Session Attendance</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-surface'>
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={4} className='p-8 text-center text-muted font-bold'>
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
    </div>
  );
}
