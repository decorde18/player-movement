"use client";

import React, { useEffect, useState, useTransition, use } from "react";
import Link from "next/link";
import { getPlayerDetailData } from "./actions";
import { addCoachNote, deleteCoachNote } from "@/lib/actions/notes";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { 
  Loader2, 
  ArrowLeft, 
  User, 
  Shirt, 
  Award, 
  Mail, 
  Calendar, 
  MessageSquare, 
  Send, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Trophy
} from "lucide-react";
import { toast } from "sonner";

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const playerId = Number(resolvedParams.id);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getPlayerDetailData(playerId);
      if (res.success) {
        setData(res);
      } else {
        toast.error(res.error || "Failed to load player details.");
      }
    } catch {
      toast.error("Error loading player profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [playerId]);

  const handleAddNote = async () => {
    if (!newNoteText.trim()) {
      toast.error("Please enter a note.");
      return;
    }

    startTransition(async () => {
      const res = await addCoachNote({
        playerId,
        noteText: newNoteText
      });

      if (res.success) {
        toast.success("Coach note added!");
        setNewNoteText("");
        loadData();
      } else {
        toast.error(res.error || "Failed to add note.");
      }
    });
  };

  const handleDeleteNote = async (noteId: number) => {
    startTransition(async () => {
      const res = await deleteCoachNote(noteId);
      if (res.success) {
        toast.success("Note deleted.");
        loadData();
      } else {
        toast.error(res.error || "Failed to delete note.");
      }
    });
  };

  if (loading || !data) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center gap-3 text-text'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading Player Profile & Notes...</span>
      </div>
    );
  }

  const { player, seasonPlayers, eventRankings, notes } = data;
  const currentSeasonPlayer = seasonPlayers[0];
  const assignedTeam = currentSeasonPlayer?.season_teams?.teams;
  const latestInv = currentSeasonPlayer?.team_invitations?.[0];

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "pending":
        return <span className='inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20'><Clock size={12} /> Pending</span>;
      case "accepted":
        return <span className='inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20'><CheckCircle2 size={12} /> Accepted</span>;
      case "declined":
        return <span className='inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20'><XCircle size={12} /> Declined</span>;
      default:
        return <span className='text-xs font-medium text-muted bg-surface px-2.5 py-1 rounded-full border border-border'>Not Sent</span>;
    }
  };

  return (
    <div className='w-full flex-1 flex flex-col min-h-0 animate-fadeIn relative space-y-6 pb-6'>
      
      {/* Top Breadcrumb & Header */}
      <div className='flex flex-wrap items-center justify-between gap-4 bg-surface/60 border border-border p-4 rounded-2xl shadow-sm backdrop-blur-md'>
        <div className='flex items-center gap-3'>
          <Link
            href={`/admin/invitations`}
            className='p-2 rounded-lg border border-border bg-background text-muted hover:text-text transition-all cursor-pointer'
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className='flex items-center gap-2'>
              <span className='text-[10px] font-extrabold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20'>
                Player Profile & Notes Feed
              </span>
              {player.gender && (
                <span className='text-[10px] font-bold text-muted bg-surface px-2 py-0.5 rounded-full border border-border'>
                  {player.gender}
                </span>
              )}
            </div>
            <h1 className='text-2xl font-extrabold text-text mt-0.5 flex items-center gap-2'>
              <User size={22} className='text-primary' />
              {player.first_name} {player.last_name}
            </h1>
          </div>
        </div>

        <div className='flex items-center gap-3 flex-wrap'>
          <Link href='/admin/invitations'>
            <Button variant='outline' size='sm' className='font-bold text-xs flex items-center gap-1.5 border-purple-500/30 text-purple-600 hover:bg-purple-500/10'>
              <Mail size={15} />
              <span>Invitations Dashboard</span>
            </Button>
          </Link>
          <Link href='/admin/teams/placement'>
            <Button variant='outline' size='sm' className='font-bold text-xs flex items-center gap-1.5 border-blue-500/30 text-blue-600 hover:bg-blue-500/10'>
              <Shirt size={15} />
              <span>Team Board</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Roster Metrics & Profile Summary Cards */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card className='p-4 bg-surface/50 border-border space-y-1'>
          <span className='text-[10px] font-extrabold uppercase text-muted tracking-wider block'>Permanent Team</span>
          {assignedTeam ? (
            <span className='text-sm font-extrabold text-blue-600 flex items-center gap-1.5 mt-1'>
              <Shirt size={16} /> {assignedTeam.name}
            </span>
          ) : (
            <span className='text-xs font-medium text-muted/60 italic block mt-1'>Unassigned Roster</span>
          )}
        </Card>

        <Card className='p-4 bg-surface/50 border-border space-y-1'>
          <span className='text-[10px] font-extrabold uppercase text-muted tracking-wider block'>Tryout # & Position</span>
          <span className='text-sm font-extrabold text-text block mt-1'>
            Tryout #{currentSeasonPlayer?.tryout_number || "N/A"} • Pos: {currentSeasonPlayer?.position || "N/A"}
          </span>
        </Card>

        <Card className='p-4 bg-surface/50 border-border space-y-1'>
          <span className='text-[10px] font-extrabold uppercase text-muted tracking-wider block'>Uniform Number</span>
          <span className='text-sm font-extrabold text-purple-600 block mt-1'>
            {currentSeasonPlayer?.uniform_number ? `#${currentSeasonPlayer.uniform_number}` : "Not Assigned"}
          </span>
        </Card>

        <Card className='p-4 bg-surface/50 border-border space-y-1'>
          <span className='text-[10px] font-extrabold uppercase text-muted tracking-wider block'>Invitation Status</span>
          <div className='mt-1'>{getStatusBadge(latestInv?.status)}</div>
        </Card>
      </div>

      {/* Main Content Layout: Left Profile Details, Right Notes Feed */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0'>
        
        {/* Left Column: Event Rankings History */}
        <div className='space-y-6 lg:col-span-1'>
          <Card className='p-4 bg-surface/80 border-border space-y-3'>
            <h3 className='font-extrabold text-sm text-text flex items-center gap-2 border-b border-border pb-2'>
              <Trophy size={16} className='text-amber-500' />
              Event Placement Rankings
            </h3>

            {eventRankings.length === 0 ? (
              <p className='text-xs text-muted/60 italic py-4 text-center'>
                No event rankings recorded yet.
              </p>
            ) : (
              <div className='space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1'>
                {eventRankings.map((er: any) => (
                  <div key={er.id} className='p-2.5 bg-background border border-border rounded-xl flex items-center justify-between text-xs'>
                    <div>
                      <span className='font-bold text-text block'>{er.events?.name}</span>
                      <span className='text-[10px] text-muted block mt-0.5'>
                        Tier: {er.tier || "Unassigned"}
                      </span>
                    </div>
                    <span className='font-black text-xs text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20'>
                      Rank #{er.rank}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Unified Coach Notes Feed */}
        <div className='space-y-4 lg:col-span-2 flex flex-col min-h-0'>
          <Card className='p-5 bg-surface/80 border-border space-y-4 flex-1 flex flex-col min-h-0'>
            <h3 className='font-extrabold text-base text-text flex items-center gap-2 border-b border-border pb-3 shrink-0'>
              <MessageSquare size={18} className='text-primary' />
              Coach Notes & Evaluation Feed ({notes.length})
            </h3>

            {/* Note Entry Area */}
            <div className='space-y-2 bg-background border border-border p-3.5 rounded-2xl shrink-0'>
              <label className='block text-muted text-[10px] uppercase tracking-wider font-extrabold'>Add Coach Note for {player.first_name}</label>
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder={`Type evaluation notes or observations for ${player.first_name}...`}
                className='w-full bg-surface border border-border rounded-xl p-2.5 text-xs font-bold text-text focus:outline-none focus:border-primary h-20 resize-none'
              />
              <div className='flex justify-end'>
                <Button
                  variant='primary'
                  size='xs'
                  onClick={handleAddNote}
                  disabled={isPending || !newNoteText.trim()}
                  className='flex items-center gap-1 font-bold'
                >
                  {isPending ? <Loader2 size={12} className='animate-spin' /> : <Send size={12} />}
                  <span>Post Note</span>
                </Button>
              </div>
            </div>

            {/* Scrollable Feed */}
            <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3 pr-1'>
              {notes.length === 0 ? (
                <div className='py-12 text-center text-muted/60 font-normal italic border border-dashed border-border/40 rounded-xl'>
                  No coach notes posted for {player.first_name} {player.last_name} yet.
                </div>
              ) : (
                notes.map((note: any) => {
                  const authorName = note.users?.name || note.users?.email || "Coach";
                  const dateStr = note.created_at ? new Date(note.created_at).toLocaleString() : "";

                  return (
                    <div key={note.id} className='p-3.5 bg-background border border-border rounded-xl space-y-2 transition-all hover:border-primary/40'>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2'>
                          <span className='w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black'>
                            <User size={14} />
                          </span>
                          <div>
                            <span className='font-bold text-text text-xs block'>{authorName}</span>
                            <span className='text-[10px] text-muted font-normal block'>{dateStr}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className='text-muted hover:text-red-500 transition-colors p-1 cursor-pointer'
                          title='Delete Note'
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <p className='text-xs font-normal text-text leading-relaxed bg-surface/60 p-2.5 rounded-xl border border-border/30 whitespace-pre-wrap'>
                        {note.note_text}
                      </p>

                      {/* Context Badges */}
                      {(note.events || note.sessions || note.invitations) && (
                        <div className='flex items-center gap-1.5 flex-wrap text-[9px] font-extrabold pt-1'>
                          {note.events && (
                            <span className='inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20'>
                              <Award size={10} /> Event: {note.events.name}
                            </span>
                          )}
                          {note.sessions && (
                            <span className='inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded border border-emerald-500/20'>
                              <Calendar size={10} /> Session: {note.sessions.name}
                            </span>
                          )}
                          {note.invitations && (
                            <span className='inline-flex items-center gap-1 bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded border border-purple-500/20'>
                              <Mail size={10} /> Inv: {note.invitations.season_teams?.teams?.name || "Team"} ({note.invitations.status})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </Card>
        </div>

      </div>

    </div>
  );
}
