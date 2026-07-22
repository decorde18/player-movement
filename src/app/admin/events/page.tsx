"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  getEventsDashboardData,
  createSeason,
  createEvent,
  createSession,
  deleteEvent,
  deleteSession,
} from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  CalendarRange,
  Plus,
  Trash2,
  CalendarDays,
  Target,
  Loader2,
  AlertCircle,
  FolderDot,
  PlayCircle,
  HelpCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function EventsAdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Active Hierarchical Selection State
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Inline Forms Visibility States
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);

  // Form Inputs
  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");

  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState<"tryout" | "ranking">("tryout");

  const [sessionName, setSessionName] = useState("");
  const [sessionDate, setSessionDate] = useState("");

  const loadData = async () => {
    try {
      const res = await getEventsDashboardData();
      setData(res);

      // Auto-select first season if none selected
      if (res.seasons.length > 0 && selectedSeasonId === null) {
        setSelectedSeasonId(res.seasons[0].id);
        if (res.seasons[0].events.length > 0) {
          setSelectedEventId(res.seasons[0].events[0].id);
        }
      }
    } catch (e: any) {
      toast.error("Failed to load events data: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Creation Subhandlers
  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonName.trim()) {
      toast.error("Season Name is required.");
      return;
    }

    startTransition(async () => {
      const res = await createSeason({
        name: seasonName,
        start_date: seasonStart || undefined,
        end_date: seasonEnd || undefined,
      });

      if (res.success) {
        toast.success(`Season "${seasonName}" created successfully.`);
        setSeasonName("");
        setSeasonStart("");
        setSeasonEnd("");
        setShowSeasonForm(false);
        // Reload and set active
        const reloaded = await getEventsDashboardData();
        setData(reloaded);
        if (res.season) {
          setSelectedSeasonId(res.season.id);
          setSelectedEventId(null);
        }
      } else {
        toast.error(res.error || "Failed to create season.");
      }
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId) return;
    if (!eventName.trim()) {
      toast.error("Event Name is required.");
      return;
    }

    startTransition(async () => {
      const res = await createEvent({
        season_id: selectedSeasonId,
        name: eventName,
        event_type: eventType,
      });

      if (res.success) {
        toast.success(`Event "${eventName}" created.`);
        setEventName("");
        setEventType("tryout");
        setShowEventForm(false);
        // Reload and set active
        const reloaded = await getEventsDashboardData();
        setData(reloaded);
        if (res.event) {
          setSelectedEventId(res.event.id);
        }
      } else {
        toast.error(res.error || "Failed to create event.");
      }
    });
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;
    if (!sessionName.trim() || !sessionDate) {
      toast.error("Session Name and Date are required.");
      return;
    }

    startTransition(async () => {
      const res = await createSession({
        event_id: selectedEventId,
        name: sessionName,
        session_date: sessionDate,
      });

      if (res.success) {
        toast.success(`Session "${sessionName}" created.`);
        setSessionName("");
        setSessionDate("");
        setShowSessionForm(false);
        loadData();
      } else {
        toast.error(res.error || "Failed to create session.");
      }
    });
  };

  // Deletion Subhandlers
  const handleDeleteEvent = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete Event "${name}" and all associated sessions?`)) return;

    const res = await deleteEvent(id);
    if (res.success) {
      toast.success(`Deleted Event "${name}"`);
      setSelectedEventId(null);
      loadData();
    } else {
      toast.error(res.error || "Failed to delete event.");
    }
  };

  const handleDeleteSession = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete Session "${name}"?`)) return;

    const res = await deleteSession(id);
    if (res.success) {
      toast.success(`Deleted Session "${name}"`);
      loadData();
    } else {
      toast.error(res.error || "Failed to delete session.");
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-background text-text gap-3'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading events planner...</span>
      </div>
    );
  }

  const { seasons, userScope } = data;

  // Active object finders
  const activeSeason = seasons.find((s: any) => s.id === selectedSeasonId);
  const activeEvent = activeSeason?.events.find((e: any) => e.id === selectedEventId);

  return (
    <div className='min-h-screen bg-background text-text p-4 md:p-8 animate-fadeIn'>
      <div className='max-w-7xl mx-auto space-y-6'>
        {/* Top Header Panel */}
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/80 border border-border p-6 rounded-2xl shadow-sm backdrop-blur-md'>
          <div>
            <h1 className='text-3xl font-bold flex items-center gap-2 mb-1'>
              <CalendarRange size={32} className='text-primary animate-pulse' />
              Timeline & Events Manager
            </h1>
            <p className='text-xs text-muted font-medium'>
              Configure Seasons, register Tryout/Ranking Events, and schedule active evaluating Sessions.
            </p>
          </div>
          <span className='inline-block text-[0.7rem] font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase self-start md:self-center'>
            Role Scope: {userScope.role.replace("_", " ")}
          </span>
        </div>

        {/* 3-COLUMN CASCADING TIMELINE CONFIGURATOR */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 items-start'>
          {/* COLUMN 1: SEASONS */}
          <div className='bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]'>
            <div className='p-4 border-b border-border bg-background/50 flex justify-between items-center'>
              <h2 className='font-bold text-sm text-text-label flex items-center gap-1.5'>
                <FolderDot size={18} className='text-primary' />
                1. Seasons
              </h2>
              <button
                onClick={() => {
                  setShowSeasonForm(!showSeasonForm);
                  setShowEventForm(false);
                  setShowSessionForm(false);
                }}
                className='p-1.5 rounded-lg border border-border bg-surface text-text hover:bg-background transition-all cursor-pointer'
                title='Create Season'
              >
                <Plus size={16} />
              </button>
            </div>

            {/* List and Form Container */}
            <div className='flex-1 overflow-y-auto p-3 space-y-3'>
              {showSeasonForm && (
                <form
                  onSubmit={handleCreateSeason}
                  className='bg-background/80 border border-border p-4 rounded-xl space-y-3 animate-fadeIn'
                >
                  <h3 className='text-xs font-bold text-text mb-1'>Create New Season</h3>
                  <Input
                    placeholder='Season Name (e.g. Fall 2026)'
                    value={seasonName}
                    onChange={(e) => setSeasonName(e.target.value)}
                    required
                    size='sm'
                  />
                  <div className='grid grid-cols-2 gap-2'>
                    <Input
                      label='Start Date'
                      type='date'
                      value={seasonStart}
                      onChange={(e) => setSeasonStart(e.target.value)}
                      size='sm'
                    />
                    <Input
                      label='End Date'
                      type='date'
                      value={seasonEnd}
                      onChange={(e) => setSeasonEnd(e.target.value)}
                      size='sm'
                    />
                  </div>
                  <div className='flex gap-2 pt-1.5 justify-end'>
                    <Button
                      variant='outline'
                      size='xs'
                      type='button'
                      onClick={() => setShowSeasonForm(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button variant='primary' size='xs' type='submit' disabled={isPending}>
                      Create
                    </Button>
                  </div>
                </form>
              )}

              {seasons.length === 0 ? (
                <div className='text-center py-12 text-muted/60 text-xs italic'>
                  No seasons configured yet.
                </div>
              ) : (
                seasons.map((s: any) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSeasonId(s.id);
                      setSelectedEventId(null);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedSeasonId === s.id
                        ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20"
                        : "bg-surface border-border hover:bg-background/50"
                    }`}
                  >
                    <div className='flex items-center justify-between'>
                      <span className='font-bold text-sm text-text'>{s.name}</span>
                      <span className='text-[0.65rem] font-bold text-muted'>
                        {s.events.length} event{s.events.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {s.start_date && (
                      <span className='block text-[0.65rem] text-muted mt-1'>
                        {new Date(s.start_date).toLocaleDateString()} -{" "}
                        {s.end_date ? new Date(s.end_date).toLocaleDateString() : "Ongoing"}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: EVENTS */}
          <div className='bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]'>
            <div className='p-4 border-b border-border bg-background/50 flex justify-between items-center'>
              <h2 className='font-bold text-sm text-text-label flex items-center gap-1.5'>
                <Target size={18} className='text-primary' />
                2. Events
              </h2>
              {selectedSeasonId && (
                <button
                  onClick={() => {
                    setShowEventForm(!showEventForm);
                    setShowSeasonForm(false);
                    setShowSessionForm(false);
                  }}
                  className='p-1.5 rounded-lg border border-border bg-surface text-text hover:bg-background transition-all cursor-pointer'
                  title='Create Event'
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* List and Form Container */}
            <div className='flex-1 overflow-y-auto p-3 space-y-3'>
              {!selectedSeasonId ? (
                <div className='h-full flex flex-col items-center justify-center text-center p-6 text-muted/60 text-xs italic gap-1.5'>
                  <HelpCircle size={28} className='text-muted/40 animate-pulse' />
                  Select a season from the left to configure events.
                </div>
              ) : (
                <>
                  {showEventForm && (
                    <form
                      onSubmit={handleCreateEvent}
                      className='bg-background/80 border border-border p-4 rounded-xl space-y-3 animate-fadeIn'
                    >
                      <h3 className='text-xs font-bold text-text mb-1'>New Event in "{activeSeason?.name}"</h3>
                      <Input
                        placeholder='Event Name (e.g. U12 Tryout 2026)'
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        required
                        size='sm'
                      />
                      <div>
                        <label className='block text-[0.65rem] font-bold text-text-label mb-1'>Event Type</label>
                        <div className='flex gap-1.5'>
                          {["tryout", "ranking"].map((t) => (
                            <button
                              key={t}
                              type='button'
                              onClick={() => setEventType(t as any)}
                              className={`flex-1 py-1.5 rounded-lg text-[0.65rem] font-bold border transition-all cursor-pointer capitalize ${
                                eventType === t
                                  ? "bg-primary text-white border-primary shadow-xs"
                                  : "bg-surface border-border text-muted hover:text-text"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className='flex gap-2 pt-1.5 justify-end'>
                        <Button
                          variant='outline'
                          size='xs'
                          type='button'
                          onClick={() => setShowEventForm(false)}
                          disabled={isPending}
                        >
                          Cancel
                        </Button>
                        <Button variant='primary' size='xs' type='submit' disabled={isPending}>
                          Create
                        </Button>
                      </div>
                    </form>
                  )}

                  {activeSeason?.events.length === 0 ? (
                    <div className='text-center py-12 text-muted/60 text-xs italic'>
                      No events registered for this season.
                    </div>
                  ) : (
                    activeSeason?.events.map((e: any) => (
                      <div
                        key={e.id}
                        onClick={() => setSelectedEventId(e.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer group/item relative ${
                          selectedEventId === e.id
                            ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20"
                            : "bg-surface border-border hover:bg-background/50"
                        }`}
                      >
                        <div className='flex items-center justify-between pr-6'>
                          <span className='font-bold text-sm text-text'>{e.name}</span>
                          <span
                            className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded uppercase ${
                              e.event_type === "tryout"
                                ? "bg-accent/10 text-accent"
                                : "bg-purple/10 text-purple"
                            }`}
                          >
                            {e.event_type}
                          </span>
                        </div>
                        <span className='block text-[0.65rem] text-muted mt-1'>
                          Contains {e.sessions.length} evaluation session{e.sessions.length !== 1 ? "s" : ""}
                        </span>

                        <button
                          onClick={(evt) => {
                            evt.stopPropagation();
                            handleDeleteEvent(e.id, e.name);
                          }}
                          className='absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted/40 hover:text-danger hover:bg-danger/10 transition-all opacity-0 group-hover/item:opacity-100 cursor-pointer'
                          title='Delete Event'
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>

          {/* COLUMN 3: SESSIONS */}
          <div className='bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]'>
            <div className='p-4 border-b border-border bg-background/50 flex justify-between items-center'>
              <h2 className='font-bold text-sm text-text-label flex items-center gap-1.5'>
                <CalendarDays size={18} className='text-primary' />
                3. Sessions
              </h2>
              {selectedEventId && (
                <button
                  onClick={() => {
                    setShowSessionForm(!showSessionForm);
                    setShowSeasonForm(false);
                    setShowEventForm(false);
                  }}
                  className='p-1.5 rounded-lg border border-border bg-surface text-text hover:bg-background transition-all cursor-pointer'
                  title='Create Session'
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* List and Form Container */}
            <div className='flex-1 overflow-y-auto p-3 space-y-3'>
              {!selectedEventId ? (
                <div className='h-full flex flex-col items-center justify-center text-center p-6 text-muted/60 text-xs italic gap-1.5'>
                  <AlertCircle size={28} className='text-muted/40 animate-pulse' />
                  Select an event from the center column to schedule evaluation sessions.
                </div>
              ) : (
                <>
                  {showSessionForm && (
                    <form
                      onSubmit={handleCreateSession}
                      className='bg-background/80 border border-border p-4 rounded-xl space-y-3 animate-fadeIn'
                    >
                      <h3 className='text-xs font-bold text-text mb-1'>Add Evaluation Session</h3>
                      <Input
                        placeholder='Session Name (e.g. Scrimmage 1)'
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        required
                        size='sm'
                      />
                      <Input
                        label='Session Date *'
                        type='date'
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        required
                        size='sm'
                      />
                      <div className='flex gap-2 pt-1.5 justify-end'>
                        <Button
                          variant='outline'
                          size='xs'
                          type='button'
                          onClick={() => setShowSessionForm(false)}
                          disabled={isPending}
                        >
                          Cancel
                        </Button>
                        <Button variant='primary' size='xs' type='submit' disabled={isPending}>
                          Create
                        </Button>
                      </div>
                    </form>
                  )}

                  {activeEvent?.sessions.length === 0 ? (
                    <div className='text-center py-12 text-muted/60 text-xs italic'>
                      No sessions scheduled for this event.
                    </div>
                  ) : (
                    activeEvent?.sessions.map((sess: any) => (
                      <div
                        key={sess.id}
                        className='p-4 bg-background/30 border border-border rounded-xl flex items-center justify-between group/sess'
                      >
                        <div className='flex items-center gap-3'>
                          <div className='w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center'>
                            <PlayCircle size={16} />
                          </div>
                          <div>
                            <span className='font-bold text-sm text-text block'>{sess.name}</span>
                            <span className='text-[0.65rem] text-muted flex items-center gap-1 mt-0.5'>
                              <CalendarDays size={12} className='text-muted/60' />
                              {new Date(sess.session_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className='flex items-center gap-1 opacity-0 group-hover/sess:opacity-100 transition-all'>
                          <Link
                            href={`/admin/sessions/${sess.id}`}
                            className='p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-all cursor-pointer flex items-center gap-1 text-[0.65rem] font-bold'
                            title='Manage Roster & Attendance'
                          >
                            <Users size={14} />
                            Roster
                          </Link>
                          <button
                            onClick={() => handleDeleteSession(sess.id, sess.name)}
                            className='p-1.5 rounded-lg text-muted/40 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer'
                            title='Delete Session'
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
