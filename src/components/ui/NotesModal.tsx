"use client";

import React, { useEffect, useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { MessageSquare, Send, Trash2, Loader2, Calendar, Award, Mail, User } from "lucide-react";
import { addCoachNote, getPlayerNotes, deleteCoachNote } from "@/lib/actions/notes";
import { toast } from "sonner";

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: number | null;
  playerName?: string;
  context?: {
    eventId?: number;
    eventName?: string;
    sessionId?: number;
    sessionName?: string;
    invitationId?: number;
    invitationTeamName?: string;
  };
}

export default function NotesModal({
  isOpen,
  onClose,
  playerId,
  playerName = "Player",
  context
}: NotesModalProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [isPending, startTransition] = useTransition();

  const fetchNotes = async (pid: number) => {
    setLoading(true);
    try {
      const res = await getPlayerNotes(pid);
      if (res.success) {
        setNotes(res.notes || []);
      }
    } catch {
      toast.error("Failed to load notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && playerId) {
      fetchNotes(playerId);
      setNewNoteText("");
    }
  }, [isOpen, playerId]);

  const handleAddNote = async () => {
    if (!playerId || !newNoteText.trim()) {
      toast.error("Please enter a valid note.");
      return;
    }

    startTransition(async () => {
      const res = await addCoachNote({
        playerId,
        noteText: newNoteText,
        eventId: context?.eventId,
        sessionId: context?.sessionId,
        invitationId: context?.invitationId
      });

      if (res.success) {
        toast.success("Coach note added!");
        setNewNoteText("");
        fetchNotes(playerId);
      } else {
        toast.error(res.error || "Failed to add note.");
      }
    });
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!playerId) return;

    startTransition(async () => {
      const res = await deleteCoachNote(noteId);
      if (res.success) {
        toast.success("Note deleted.");
        fetchNotes(playerId);
      } else {
        toast.error(res.error || "Failed to delete note.");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Coach Notes for ${playerName}`}
      size='lg'
    >
      <div className='space-y-4 text-xs font-bold text-text'>
        
        {/* Context indicator tag */}
        {context && (context.eventName || context.sessionName || context.invitationTeamName) && (
          <div className='flex items-center gap-2 flex-wrap bg-surface p-2.5 rounded-xl border border-border text-[10px] text-muted'>
            <span className='uppercase font-black text-primary'>Active Context Tag:</span>
            {context.eventName && (
              <span className='inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20'>
                <Award size={10} /> {context.eventName}
              </span>
            )}
            {context.sessionName && (
              <span className='inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded border border-emerald-500/20'>
                <Calendar size={10} /> {context.sessionName}
              </span>
            )}
            {context.invitationTeamName && (
              <span className='inline-flex items-center gap-1 bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded border border-purple-500/20'>
                <Mail size={10} /> Inv: {context.invitationTeamName}
              </span>
            )}
          </div>
        )}

        {/* Add Note Input Area */}
        <div className='space-y-2 bg-surface/50 border border-border p-3 rounded-2xl'>
          <label className='block text-muted text-[10px] uppercase tracking-wider font-extrabold'>Add New Coach Note</label>
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder={`Enter evaluation observations or notes for ${playerName}...`}
            className='w-full bg-background border border-border rounded-xl p-2.5 text-xs font-bold text-text focus:outline-none focus:border-primary h-20 resize-none'
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

        {/* Notes Feed Timeline */}
        <div className='space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1'>
          <h4 className='text-[10px] font-extrabold uppercase text-muted tracking-wider mb-2 flex items-center gap-1.5'>
            <MessageSquare size={12} className='text-primary' /> Note History ({notes.length})
          </h4>

          {loading ? (
            <div className='py-8 flex items-center justify-center gap-2 text-muted'>
              <Loader2 className='animate-spin text-primary' size={20} />
              <span>Loading notes...</span>
            </div>
          ) : notes.length === 0 ? (
            <div className='py-8 text-center text-muted/60 font-normal italic border border-dashed border-border/40 rounded-xl'>
              No coach notes recorded for {playerName} yet.
            </div>
          ) : (
            notes.map((note) => {
              const authorName = note.users?.name || note.users?.email || "Coach";
              const dateStr = note.created_at ? new Date(note.created_at).toLocaleString() : "";

              return (
                <div key={note.id} className='p-3 bg-surface border border-border rounded-xl space-y-1.5 transition-all hover:border-primary/30'>
                  <div className='flex items-center justify-between gap-2'>
                    <div className='flex items-center gap-2'>
                      <span className='w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black'>
                        <User size={12} />
                      </span>
                      <div>
                        <span className='font-bold text-text text-xs block'>{authorName}</span>
                        <span className='text-[9px] text-muted font-normal block'>{dateStr}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className='text-muted hover:text-red-500 transition-colors p-1 cursor-pointer'
                      title='Delete Note'
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <p className='text-xs font-normal text-text leading-relaxed bg-background/50 p-2 rounded-lg border border-border/30 whitespace-pre-wrap'>
                    {note.note_text}
                  </p>

                  {/* Context Badges */}
                  {(note.events || note.sessions || note.invitations) && (
                    <div className='flex items-center gap-1.5 flex-wrap text-[9px] font-extrabold pt-0.5'>
                      {note.events && (
                        <span className='bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20'>
                          Event: {note.events.name}
                        </span>
                      )}
                      {note.sessions && (
                        <span className='bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-500/20'>
                          Session: {note.sessions.name}
                        </span>
                      )}
                      {note.invitations && (
                        <span className='bg-purple-500/10 text-purple-600 px-1.5 py-0.5 rounded border border-purple-500/20'>
                          Inv: {note.invitations.season_teams?.teams?.name || "Team"} ({note.invitations.status})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </Modal>
  );
}
