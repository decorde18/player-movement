"use client";

import React, { useEffect, useState, useTransition, use } from "react";
import { getPlayerData, createPlayerNote, deletePlayerNote } from "./actions";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Trash2, 
  Plus, 
  MessageSquare, 
  Award, 
  Building2, 
  Loader2, 
  ShieldCheck, 
  UserCheck 
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { toast } from "sonner";

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const playerId = Number(resolvedParams.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Note form state
  const [noteText, setNoteText] = useState("");
  const [eventId, setEventId] = useState("");

  const loadData = async () => {
    try {
      const res = await getPlayerData(playerId);
      if (res.success) {
        setData(res);
        if (res.events && res.events.length > 0) {
          setEventId(res.events[0].id.toString());
        }
      } else {
        toast.error(res.error || "Failed to load player details");
        router.push("/admin/players");
      }
    } catch (e: any) {
      toast.error("Error loading data: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [playerId]);

  if (loading || !data) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-background text-text gap-3'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading player profile...</span>
      </div>
    );
  }

  const { player, events, currentUser } = data;

  const calculateAge = (dob: Date | string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) {
      toast.error("Note text cannot be empty.");
      return;
    }
    if (!eventId) {
      toast.error("Please select an event to link this note.");
      return;
    }

    startTransition(async () => {
      const res = await createPlayerNote(playerId, {
        note_text: noteText,
        event_id: Number(eventId),
      });

      if (res.success) {
        toast.success("Coach note added successfully.");
        setNoteText("");
        loadData();
      } else {
        toast.error(res.error || "Failed to save note.");
      }
    });
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm("Are you sure you want to delete this note?")) {
      return;
    }

    try {
      const res = await deletePlayerNote(noteId, playerId);
      if (res.success) {
        toast.success("Note deleted successfully.");
        loadData();
      } else {
        toast.error(res.error || "Failed to delete note.");
      }
    } catch (e: any) {
      toast.error("Failed to delete: " + e.message);
    }
  };

  const roleLabels: Record<string, string> = {
    system_admin: "System Admin",
    club_admin: "Club Admin",
    age_group_admin: "Coordinator",
    coach: "Coach",
  };

  return (
    <div className='min-h-screen bg-background text-text p-4 sm:p-6 lg:p-8 animate-fadeIn space-y-6'>
      {/* Header / Navigation Row */}
      <div className='flex items-center justify-between border-b border-border/60 pb-4'>
        <div className='flex items-center gap-3'>
          <Button 
            variant='outline' 
            size='sm' 
            onClick={() => router.push("/admin/players")}
            className='flex items-center gap-2'
          >
            <ArrowLeft size={16} />
            <span>Back to Registry</span>
          </Button>
          <h1 className='text-2xl font-extrabold tracking-tight bg-gradient-to-r from-text via-primary to-accent bg-clip-text text-transparent'>
            Player Profile
          </h1>
        </div>
      </div>

      {/* Main Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 items-start'>
        {/* Left Side: Summary Card */}
        <div className='space-y-6 lg:col-span-1'>
          <Card className='relative border-border bg-surface/50 backdrop-blur-xl overflow-hidden p-6 space-y-6'>
            {/* Soft background light */}
            <div className='absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none' />

            {/* Profile Avatar & Name */}
            <div className='flex flex-col items-center text-center space-y-3 pb-6 border-b border-border/60'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-inner'>
                <User size={38} className='text-primary' />
              </div>
              <div>
                <h2 className='text-xl font-bold text-text'>{player.first_name} {player.last_name}</h2>
                <span className='text-xs font-semibold px-2 py-0.5 rounded-full border border-accent/20 bg-accent/5 text-accent'>
                  {player.gender} Division
                </span>
              </div>
            </div>

            {/* Profile Metrics */}
            <div className='space-y-4 text-sm'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2 text-muted'>
                  <Calendar size={16} />
                  <span>Date of Birth</span>
                </div>
                <span className='font-semibold text-text/90'>
                  {new Date(player.date_of_birth).toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })} ({calculateAge(player.date_of_birth)} yrs old)
                </span>
              </div>

              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2 text-muted'>
                  <Award size={16} />
                  <span>Overall Rating</span>
                </div>
                <span className='font-extrabold text-primary text-base'>
                  {player.season_players?.[0]?.rating || "0"}
                </span>
              </div>

              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2 text-muted'>
                  <Building2 size={16} />
                  <span>Clubs Registered</span>
                </div>
                <span className='font-semibold text-text/80'>
                  {player.season_players?.map((sp: any) => sp.clubs?.name).filter(Boolean).join(", ") || "None"}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side: Registry & Notes */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Seasonal Placements Section */}
          <Card className='p-6 bg-surface/50 border-border backdrop-blur-xl space-y-4'>
            <h3 className='text-lg font-bold text-text flex items-center gap-2'>
              <UserCheck size={20} className='text-primary' />
              Seasonal Placements
            </h3>

            {player.season_players && player.season_players.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {player.season_players.map((sp: any) => (
                  <div 
                    key={sp.id} 
                    className='relative p-4 rounded-xl border border-border/80 bg-background/50 space-y-3 shadow-sm'
                  >
                    <div className='flex items-center justify-between pb-2 border-b border-border/40'>
                      <span className='font-bold text-sm text-text/90'>{sp.season_age_groups?.seasons?.name || "Active Season"}</span>
                      <span className='text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary uppercase'>
                        {sp.season_age_groups?.gender}
                      </span>
                    </div>

                    <div className='space-y-1.5 text-xs text-muted'>
                      <div className='flex justify-between'>
                        <span>Club:</span>
                        <span className='font-semibold text-text/80'>{sp.clubs?.name || "None"}</span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Age Division:</span>
                        <span className='font-semibold text-text/80'>{sp.season_age_groups?.age_groups?.name || "N/A"}</span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Tryout No:</span>
                        <span className='font-semibold text-text/85'>{sp.tryout_number || "Unassigned"}</span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Position:</span>
                        <span className='font-semibold text-text/85'>{sp.position || "N/A"}</span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Assigned Team:</span>
                        <span className='font-bold text-accent'>
                          {sp.season_teams?.teams?.name || "No Assignment"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-6 text-muted text-sm'>
                No active seasonal registrations found for this player.
              </div>
            )}
          </Card>

          {/* Evaluation Ratings History Section */}
          <Card className='p-6 bg-surface/50 border-border backdrop-blur-xl space-y-4'>
            <h3 className='text-lg font-bold text-text flex items-center gap-2'>
              <Award size={20} className='text-primary' />
              Evaluation Ratings & Attendance History
            </h3>

            {player.session_players && player.session_players.length > 0 ? (
              <div className='border border-border rounded-xl overflow-hidden bg-background/20'>
                <table className='w-full text-left text-xs'>
                  <thead className='bg-background text-text-label font-bold border-b border-border'>
                    <tr>
                      <th className='p-3'>Event / Session</th>
                      <th className='p-3 text-center'>Date</th>
                      <th className='p-3 text-center'>Attendance</th>
                      <th className='p-3 text-center'>Rank</th>
                      <th className='p-3 text-center'>Avg Rating</th>
                      <th className='p-3'>Evaluators Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-border bg-surface'>
                    {player.session_players.map((sp: any) => (
                      <tr key={sp.id} className='hover:bg-background/10 transition-all'>
                        <td className='p-3 font-semibold text-text'>
                          <span className='block text-[10px] font-extrabold uppercase text-primary mb-0.5'>
                            {sp.sessions?.events?.name}
                          </span>
                          <span className='text-xs'>{sp.sessions?.name}</span>
                        </td>
                        <td className='p-3 text-center text-muted'>
                          {sp.sessions?.session_date ? new Date(sp.sessions.session_date).toLocaleDateString() : "--"}
                        </td>
                        <td className='p-3 text-center'>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            sp.attendance_status === "present"
                              ? "bg-green-500/10 text-green-600 border border-green-500/20"
                              : sp.attendance_status === "absent"
                                ? "bg-danger/10 text-danger border border-danger/20"
                                : "bg-orange-500/10 text-orange-600 border border-orange-500/20"
                          }`}>
                            {sp.attendance_status}
                          </span>
                        </td>
                        <td className='p-3 text-center font-extrabold text-accent'>
                          {sp.rank ? `#${sp.rank}` : "--"}
                        </td>
                        <td className='p-3 text-center font-extrabold text-primary text-sm'>
                          {sp.rating ? sp.rating.toFixed(2) : "--"}
                        </td>
                        <td className='p-3'>
                          <div className='flex flex-wrap gap-1'>
                            {sp.session_player_ratings?.length === 0 ? (
                              <span className='text-[10px] text-muted italic'>No ratings submitted</span>
                            ) : (
                              sp.session_player_ratings.map((r: any) => (
                                <span 
                                  key={r.id}
                                  className='inline-flex items-center gap-0.5 bg-muted/10 border border-border px-1.5 py-0.5 rounded text-[9px] font-bold text-muted'
                                  title={`Coach: ${r.coach_name}`}
                                >
                                  {r.rating} ({r.coach_name})
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-center py-6 text-muted text-xs italic'>
                No session evaluations or ratings recorded for this player yet.
              </div>
            )}
          </Card>

          {/* Coach Notes Timeline Section */}
          <Card className='p-6 bg-surface/50 border-border backdrop-blur-xl space-y-6'>
            <h3 className='text-lg font-bold text-text flex items-center gap-2'>
              <MessageSquare size={20} className='text-primary' />
              Evaluator Feed & Notes
            </h3>

            {/* Note Entry Form */}
            {events && events.length > 0 ? (
              <form onSubmit={handleAddNote} className='space-y-3 bg-background/40 p-4 rounded-xl border border-border/60'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <div>
                    <label className='block text-xs font-bold text-text-label mb-1 uppercase tracking-wider'>
                      Linked Evaluation Event
                    </label>
                    <select
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                      className='w-full text-xs font-semibold bg-surface py-2.5 px-3 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary cursor-pointer'
                    >
                      {events.map((ev: any) => (
                        <option key={ev.id} value={ev.id}>
                          [{ev.seasons?.name}] {ev.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className='block text-xs font-bold text-text-label mb-1 uppercase tracking-wider'>
                    Comments & Evaluation Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder='Write feedback about player tryout, skill rating, work rate, attitude...'
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className='w-full text-xs bg-surface p-3 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary'
                  />
                </div>

                <div className='flex justify-end'>
                  <Button
                    type='submit'
                    variant='primary'
                    size='sm'
                    disabled={isPending}
                    className='flex items-center gap-1.5 font-bold'
                  >
                    <Plus size={16} />
                    <span>Add Note</span>
                  </Button>
                </div>
              </form>
            ) : (
              <div className='p-4 rounded-lg bg-red/10 border border-red/20 text-xs text-red text-center font-semibold'>
                No active evaluation events scope. Please create an event before adding notes.
              </div>
            )}

            {/* Notes List */}
            <div className='space-y-4'>
              {player.coach_notes && player.coach_notes.length > 0 ? (
                player.coach_notes.map((note: any) => {
                  const isNoteAuthor = note.coach_id === currentUser.id;
                  const canDelete = isNoteAuthor || currentUser.role === "system_admin";

                  return (
                    <div 
                      key={note.id} 
                      className='relative p-4 rounded-xl border border-border/60 bg-background/20 space-y-2 hover:border-border transition-colors'
                    >
                      <div className='flex items-start justify-between'>
                        <div className='flex items-center gap-2'>
                          <span className='font-bold text-xs text-text'>{note.users?.name}</span>
                          <span className='text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border/80 text-muted font-bold uppercase'>
                            {roleLabels[note.users?.role] || note.users?.role}
                          </span>
                          <span className='text-[10px] text-muted/80'>
                            {new Date(note.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className='p-1 rounded-md text-muted hover:text-red hover:bg-red/10 cursor-pointer transition-colors'
                            title='Delete Note'
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className='text-xs text-muted/60 flex items-center gap-1.5 font-semibold'>
                        <span>Linked Event:</span>
                        <span className='text-text/80 font-bold'>{note.events?.name}</span>
                      </div>

                      <p className='text-xs text-text/90 leading-relaxed font-medium whitespace-pre-wrap'>
                        {note.note_text}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className='text-center py-8 text-muted text-sm bg-background/10 rounded-xl border border-dashed border-border/60'>
                  <MessageSquare size={32} className='mx-auto text-muted/30 mb-2' />
                  <span>No notes recorded for this player yet.</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
