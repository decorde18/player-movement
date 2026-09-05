"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  getEventsDashboardData,
  createSeason,
  createEvent,
  updateEvent,
  createSession,
  deleteEvent,
  deleteSession,
} from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import {
  CalendarRange,
  Plus,
  Edit2,
  Trash2,
  CalendarDays,
  Target,
  Loader2,
  AlertCircle,
  FolderDot,
  PlayCircle,
  HelpCircle,
  Users,
  Filter,
  CheckSquare,
  Square,
  Award
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

  // Age group filter for events column
  const [ageGroupFilter, setAgeGroupFilter] = useState<number | "all">("all");

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
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<number[]>([]);

  const [sessionName, setSessionName] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [selectedSessionDivisionIds, setSelectedSessionDivisionIds] = useState<number[]>([]);

  // Modal deletion state
  const [activeDeleteTarget, setActiveDeleteTarget] = useState<{ type: "event" | "session"; id: number; name: string } | null>(null);

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

  const [eventScopeType, setEventScopeType] = useState<"division" | "team">("division");
  const [selectedTeamIdForEvent, setSelectedTeamIdForEvent] = useState<string>("");

  // Edit Event State
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [editEventName, setEditEventName] = useState("");
  const [editEventType, setEditEventType] = useState<"tryout" | "ranking">("tryout");
  const [editDivisionIds, setEditDivisionIds] = useState<number[]>([]);

  const handleStartEditEvent = (evtItem: any) => {
    setEditingEvent(evtItem);
    setEditEventName(evtItem.name);
    setEditEventType(evtItem.event_type || "tryout");
    setEditDivisionIds(evtItem.event_divisions?.map((ed: any) => ed.season_age_group_id) || []);
  };

  const handleUpdateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    if (!editEventName.trim()) {
      toast.error("Event Name is required.");
      return;
    }

    startTransition(async () => {
      const res = await updateEvent({
        id: editingEvent.id,
        name: editEventName,
        event_type: editEventType,
        season_age_group_ids: editDivisionIds,
      });

      if (res.success) {
        toast.success(`Event "${editEventName}" updated successfully.`);
        setEditingEvent(null);
        loadData();
      } else {
        toast.error(res.error || "Failed to update event.");
      }
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId || !data) return;
    if (!eventName.trim()) {
      toast.error("Event Name is required.");
      return;
    }
    
    if (eventScopeType === "division" && selectedDivisionIds.length === 0) {
      toast.error("Select at least one age group for this event.");
      return;
    }

    if (eventScopeType === "team" && !selectedTeamIdForEvent) {
      toast.error("Select a team for this team-level ranking event.");
      return;
    }

    const inputName = eventName.trim();
    const inputType = eventType;
    const inputDivIds = [...selectedDivisionIds];
    const targetSeasonId = selectedSeasonId;
    const inputTeamId = selectedTeamIdForEvent;
    const scopeType = eventScopeType;
    const previousData = data;

    // Build optimistic event object
    const activeSeason = data.seasons?.find((s: any) => s.id === targetSeasonId);
    const tempEventId = -Date.now();
    const eventDivisions = inputDivIds.map((sagId) => {
      const sag = activeSeason?.season_age_groups?.find((d: any) => d.id === sagId);
      return {
        event_id: tempEventId,
        season_age_group_id: sagId,
        season_age_groups: sag || null,
      };
    });

    const optimisticEvent = {
      id: tempEventId,
      season_id: targetSeasonId,
      name: inputName,
      event_type: inputType,
      created_at: new Date().toISOString(),
      event_divisions: eventDivisions,
      sessions: [],
    };

    // Optimistically update local data state immediately
    setData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        seasons: prev.seasons.map((s: any) => {
          if (s.id !== targetSeasonId) return s;
          return {
            ...s,
            events: [optimisticEvent, ...(s.events || [])],
          };
        }),
      };
    });

    setSelectedEventId(tempEventId);
    setEventName("");
    setEventType("tryout");
    setSelectedDivisionIds([]);
    setSelectedTeamIdForEvent("");
    setEventScopeType("division");
    setShowEventForm(false);
    toast.success(`Event "${inputName}" created.`);

    startTransition(async () => {
      const res = await createEvent({
        season_id: targetSeasonId,
        name: inputName,
        event_type: inputType,
        season_age_group_ids: scopeType === "division" ? inputDivIds : undefined,
        season_team_id: scopeType === "team" ? Number(inputTeamId) : undefined,
      });

      if (res.success) {
        const reloaded = await getEventsDashboardData();
        setData(reloaded);
        if (res.event) {
          setSelectedEventId(res.event.id);
        }
      } else {
        setData(previousData);
        toast.error(res.error || "Failed to create event.");
      }
    });
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !data) return;
    if (!sessionName.trim() || !sessionDate) {
      toast.error("Session Name and Date are required.");
      return;
    }

    const inputName = sessionName.trim();
    const inputDate = sessionDate;
    const selectedSagIds = [...selectedSessionDivisionIds];
    const targetEventId = selectedEventId;
    const previousData = data;

    // Build optimistic session objects
    const activeSeason = data.seasons?.find((s: any) => s.id === selectedSeasonId);
    const optimisticSessions: any[] = [];
    if (selectedSagIds.length > 0) {
      for (const sagId of selectedSagIds) {
        const sag = activeSeason?.season_age_groups?.find((d: any) => d.id === sagId);
        const sagName = sag?.age_groups?.name || sag?.name || "";
        const sagGender = sag?.gender || "";
        const appendedName = `${inputName} - ${sagName} (${sagGender})`;
        optimisticSessions.push({
          id: -Date.now() - Math.floor(Math.random() * 10000),
          event_id: targetEventId,
          season_age_group_id: sagId,
          name: appendedName,
          session_date: new Date(inputDate).toISOString(),
          season_age_groups: sag || null,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      optimisticSessions.push({
        id: -Date.now(),
        event_id: targetEventId,
        season_age_group_id: null,
        name: inputName,
        session_date: new Date(inputDate).toISOString(),
        season_age_groups: null,
        created_at: new Date().toISOString(),
      });
    }

    // Optimistically update UI state immediately
    setData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        seasons: prev.seasons.map((season: any) => {
          if (season.id !== selectedSeasonId) return season;
          return {
            ...season,
            events: season.events.map((evt: any) => {
              if (evt.id !== targetEventId) return evt;
              return {
                ...evt,
                sessions: [...(evt.sessions || []), ...optimisticSessions],
              };
            }),
          };
        }),
      };
    });

    const count = optimisticSessions.length;
    toast.success(count > 1 ? `Created ${count} division-specific sessions.` : `Session "${inputName}" created.`);
    setSessionName("");
    setSessionDate("");
    setSelectedSessionDivisionIds([]);
    setShowSessionForm(false);

    startTransition(async () => {
      const res = await createSession({
        event_id: targetEventId,
        name: inputName,
        session_date: inputDate,
        season_age_group_ids: selectedSagIds,
      });

      if (res.success) {
        const reloaded = await getEventsDashboardData();
        setData(reloaded);
      } else {
        setData(previousData);
        toast.error(res.error || "Failed to create session.");
      }
    });
  };

  // Deletion Subhandlers
  const handleDeleteEvent = (id: number, name: string) => {
    setActiveDeleteTarget({ type: "event", id, name });
  };

  const handleDeleteSession = (id: number, name: string) => {
    setActiveDeleteTarget({ type: "session", id, name });
  };

  const handleConfirmDelete = async () => {
    if (!activeDeleteTarget || !data) return;

    const { type, id, name } = activeDeleteTarget;
    const previousData = data;
    setActiveDeleteTarget(null);

    if (type === "event") {
      // Optimistically remove event from local state immediately
      setData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          seasons: prev.seasons.map((season: any) => ({
            ...season,
            events: season.events.filter((e: any) => e.id !== id),
          })),
        };
      });

      if (selectedEventId === id) {
        setSelectedEventId(null);
      }
      toast.success(`Deleted Event "${name}"`);

      startTransition(async () => {
        const res = await deleteEvent(id);
        if (res.success) {
          const reloaded = await getEventsDashboardData();
          setData(reloaded);
        } else {
          setData(previousData);
          toast.error(res.error || "Failed to delete event.");
        }
      });
    } else {
      // Optimistically remove session from local state immediately
      setData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          seasons: prev.seasons.map((season: any) => ({
            ...season,
            events: season.events.map((evt: any) => ({
              ...evt,
              sessions: evt.sessions.filter((s: any) => s.id !== id),
            })),
          })),
        };
      });
      toast.success(`Deleted Session "${name}"`);

      startTransition(async () => {
        const res = await deleteSession(id);
        if (res.success) {
          const reloaded = await getEventsDashboardData();
          setData(reloaded);
        } else {
          setData(previousData);
          toast.error(res.error || "Failed to delete session.");
        }
      });
    }
  };

  // Toggle division selection
  const toggleDivision = (id: number) => {
    setSelectedDivisionIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-background text-text gap-3'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading events planner...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-background text-text gap-3'>
        <span className='font-bold text-muted'>Failed to load events. Please refresh the page.</span>
      </div>
    );
  }

  const { seasons, userScope } = data;


  // Active object finders
  const activeSeason = seasons.find((s: any) => s.id === selectedSeasonId);
  const activeEvent = activeSeason?.events.find((e: any) => e.id === selectedEventId);

  // Get available divisions for the active season (for the event creation form)
  const seasonDivisions = activeSeason?.season_age_groups || [];

  // Filtered events based on age group filter
  const filteredEvents = activeSeason?.events.filter((e: any) => {
    if (ageGroupFilter === "all") return true;
    return e.event_divisions?.some(
      (ed: any) => ed.season_age_groups?.age_group_id === ageGroupFilter
    );
  }) || [];

  // Build unique age groups for the filter dropdown from the active season
  const filterAgeGroups = seasonDivisions.reduce((acc: any[], div: any) => {
    const agId = div.age_groups?.id;
    if (agId && !acc.find((a: any) => a.id === agId)) {
      acc.push({ id: agId, name: div.age_groups.name });
    }
    return acc;
  }, []);

  return (
    <div className='min-h-screen bg-background text-text p-4 md:p-8 animate-fadeIn'>
      <div className='w-full max-w-full min-w-0 space-y-6'>
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
                      setAgeGroupFilter("all");
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
              <div className='flex items-center gap-1.5'>
                {/* Age Group Filter */}
                {selectedSeasonId && filterAgeGroups.length > 0 && (
                  <div className='relative'>
                    <select
                      value={ageGroupFilter}
                      onChange={(e) => setAgeGroupFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                      className='text-[0.6rem] font-bold bg-surface border border-border rounded-lg pl-6 pr-2 py-1.5 text-text appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary'
                      title='Filter events by age group'
                    >
                      <option value='all'>All Groups</option>
                      {filterAgeGroups.map((ag: any) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.name}
                        </option>
                      ))}
                    </select>
                    <Filter size={12} className='absolute left-1.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none' />
                  </div>
                )}
                {selectedSeasonId && (
                  <button
                    onClick={() => {
                      const nextShow = !showEventForm;
                      setShowEventForm(nextShow);
                      setShowSeasonForm(false);
                      setShowSessionForm(false);
                      if (nextShow) {
                        setSelectedDivisionIds(seasonDivisions.map((d: any) => d.id));
                      } else {
                        setSelectedDivisionIds([]);
                      }
                    }}
                    className='p-1.5 rounded-lg border border-border bg-surface text-text hover:bg-background transition-all cursor-pointer'
                    title='Create Event'
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
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
                      <h3 className='text-xs font-bold text-text mb-1'>New Event in &quot;{activeSeason?.name}&quot;</h3>
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

                      {/* Event Scope Type Toggle */}
                      <div>
                        <label className='block text-[0.65rem] font-bold text-muted uppercase mb-1'>
                          Target Roster Scope
                        </label>
                        <div className='grid grid-cols-2 gap-2'>
                          <button
                            type='button'
                            onClick={() => setEventScopeType("division")}
                            className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              eventScopeType === "division"
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-background border-border text-muted hover:text-text"
                            }`}
                          >
                            Age Group Division
                          </button>
                          <button
                            type='button'
                            onClick={() => setEventScopeType("team")}
                            className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              eventScopeType === "team"
                                ? "bg-blue-500/10 border-blue-500 text-blue-600"
                                : "bg-background border-border text-muted hover:text-text"
                            }`}
                          >
                            Specific Team Only
                          </button>
                        </div>
                      </div>

                      {/* Team Selector if Scope is Team */}
                      {eventScopeType === "team" ? (
                        <div>
                          <label className='block text-[0.65rem] font-bold text-muted uppercase mb-1'>
                            Select Team Roster
                          </label>
                          <select
                            value={selectedTeamIdForEvent}
                            onChange={(e) => setSelectedTeamIdForEvent(e.target.value)}
                            className='w-full text-xs font-bold bg-background border border-border rounded-lg p-2 text-text focus:outline-none cursor-pointer'
                          >
                            <option value=''>-- Select Team --</option>
                            {(data.seasonTeams || []).map((st: any) => (
                              <option key={st.id} value={st.id.toString()}>
                                {st.teams?.name} ({st.season_age_groups?.age_groups?.name || ""})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <div className='flex items-center justify-between mb-1'>
                            <label className='block text-[0.65rem] font-bold text-muted uppercase'>
                              Combine Age Group Divisions ({selectedDivisionIds.length}/{seasonDivisions.length})
                            </label>
                            {seasonDivisions.length > 0 && (
                              <div className='flex items-center gap-1 text-[0.6rem] font-bold'>
                                <button
                                  type='button'
                                  onClick={() => setSelectedDivisionIds(seasonDivisions.map((d: any) => d.id))}
                                  className='text-primary hover:underline cursor-pointer'
                                >
                                  Select All
                                </button>
                                <span className='text-muted/40'>|</span>
                                <button
                                  type='button'
                                  onClick={() => setSelectedDivisionIds([])}
                                  className='text-muted hover:text-text hover:underline cursor-pointer'
                                >
                                  Deselect All
                                </button>
                              </div>
                            )}
                          </div>
                          <p className='text-[0.55rem] text-muted mb-2'>
                            Select multiple age groups to combine them (allowing lower age groups to register and evaluate with older age groups).
                          </p>
                          {seasonDivisions.length === 0 ? (
                            <p className='text-xs text-muted italic'>No divisions configured for this season.</p>
                          ) : (
                            <div className='grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-1 bg-background rounded-lg border border-border'>
                              {seasonDivisions.map((div: any) => {
                                const isSelected = selectedDivisionIds.includes(div.id);
                                const isMale = div.gender === "Male" || div.gender === "Boys";
                                const isFemale = div.gender === "Female" || div.gender === "Girls";
                                const genderColor = isMale
                                  ? "text-blue-500"
                                  : isFemale
                                    ? "text-pink-500"
                                    : "text-emerald-500";
                                const displayGender = isMale ? "Male" : isFemale ? "Female" : div.gender;
                                return (
                                  <button
                                    key={div.id}
                                    type='button'
                                    onClick={() => toggleDivision(div.id)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[0.65rem] font-semibold transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-primary/10 text-primary border border-primary/30"
                                        : "hover:bg-background text-text border border-transparent"
                                    }`}
                                  >
                                    {isSelected ? (
                                      <CheckSquare size={14} className='text-primary flex-shrink-0' />
                                    ) : (
                                      <Square size={14} className='text-muted/40 flex-shrink-0' />
                                    )}
                                    <span>{div.age_groups?.name || div.name}</span>
                                    <span className={`${genderColor} text-[0.55rem]`}>({displayGender})</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {selectedDivisionIds.length > 0 && (
                            <p className='text-[0.55rem] text-muted mt-1'>
                              {selectedDivisionIds.length} division(s) selected
                            </p>
                          )}
                        </div>
                      )}

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
                          {isPending ? (
                            <span className='flex items-center gap-1'>
                              <Loader2 className='animate-spin' size={12} /> Creating...
                            </span>
                          ) : (
                            "Create Event"
                          )}
                        </Button>
                      </div>
                    </form>
                  )}

                  {filteredEvents.length === 0 ? (
                    <div className='text-center py-12 text-muted/60 text-xs italic'>
                      {ageGroupFilter !== "all"
                        ? "No events match the selected age group filter."
                        : "No events registered for this season."}
                    </div>
                  ) : (
                    filteredEvents.map((e: any) => (
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

                        {/* Division badges */}
                        {e.event_divisions && e.event_divisions.length > 0 && (
                          <div className='flex flex-wrap gap-1 mt-1.5'>
                            {e.event_divisions.map((ed: any) => {
                              const isMale = ed.season_age_groups?.gender === "Male" || ed.season_age_groups?.gender === "Boys";
                              const isFemale = ed.season_age_groups?.gender === "Female" || ed.season_age_groups?.gender === "Girls";
                              const genderColor = isMale
                                ? "bg-blue-50 text-blue-600 border-blue-200"
                                : isFemale
                                  ? "bg-pink-50 text-pink-600 border-pink-200"
                                  : "bg-emerald-50 text-emerald-600 border-emerald-200";
                              const displayGender = isMale ? "Male" : isFemale ? "Female" : ed.season_age_groups?.gender;
                              return (
                                <span
                                  key={`${ed.event_id}-${ed.season_age_group_id}`}
                                  className={`px-1.5 py-0.5 text-[0.55rem] font-bold rounded-full border ${genderColor}`}
                                >
                                  {ed.season_age_groups?.age_groups?.name || "?"} ({displayGender})
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className='flex items-center justify-between mt-2 pt-2 border-t border-border/40'>
                          <span className='text-[0.65rem] text-muted'>
                            {e.sessions.length} evaluation session{e.sessions.length !== 1 ? "s" : ""}
                          </span>
                          <Link href={`/admin/events/${e.id}/rankings`} onClick={(evt) => evt.stopPropagation()}>
                            <span className='text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-1 rounded-lg border border-primary/20 hover:bg-primary hover:text-white transition-all flex items-center gap-1 cursor-pointer'>
                              <Award size={10} />
                              Rankings
                            </span>
                          </Link>
                        </div>

                        <div className='absolute right-2 top-3 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-all'>
                          <button
                            onClick={(evt) => {
                              evt.stopPropagation();
                              handleStartEditEvent(e);
                            }}
                            className='p-1.5 rounded-lg text-muted/60 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer'
                            title='Edit Event'
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={(evt) => {
                              evt.stopPropagation();
                              handleDeleteEvent(e.id, e.name);
                            }}
                            className='p-1.5 rounded-lg text-muted/60 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer'
                            title='Delete Event'
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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
                    const nextShow = !showSessionForm;
                    setShowSessionForm(nextShow);
                    setShowSeasonForm(false);
                    setShowEventForm(false);
                    if (nextShow && activeEvent) {
                      const prevSessions = activeEvent.sessions || [];
                      let defaultSagIds: number[] = [];
                      if (prevSessions.length > 0) {
                        // Find the most recently created session(s) in this event
                        const sorted = [...prevSessions].sort((a: any, b: any) => {
                          const idDiff = (b.id || 0) - (a.id || 0);
                          if (idDiff !== 0) return idDiff;
                          const timeA = new Date(a.created_at || a.session_date).getTime();
                          const timeB = new Date(b.created_at || b.session_date).getTime();
                          return timeB - timeA;
                        });
                        const lastSession = sorted[0];
                        const lastBaseName = lastSession.name?.split(" - ")[0];
                        const latestBatch = sorted.filter((s: any) =>
                          lastBaseName
                            ? s.name?.startsWith(lastBaseName)
                            : (s.created_at || s.session_date) === (lastSession.created_at || lastSession.session_date)
                        );
                        const sagIdsFromBatch = latestBatch
                          .map((s: any) => s.season_age_group_id)
                          .filter((id: any): id is number => typeof id === "number");

                        if (sagIdsFromBatch.length > 0) {
                          defaultSagIds = Array.from(new Set(sagIdsFromBatch));
                        } else {
                          const allPrevSagIds = prevSessions
                            .map((s: any) => s.season_age_group_id)
                            .filter((id: any): id is number => typeof id === "number");
                          if (allPrevSagIds.length > 0) {
                            defaultSagIds = Array.from(new Set(allPrevSagIds));
                          } else if (activeEvent.event_divisions) {
                            defaultSagIds = activeEvent.event_divisions.map((ed: any) => Number(ed.season_age_groups.id));
                          }
                        }
                      } else if (activeEvent.event_divisions) {
                        defaultSagIds = activeEvent.event_divisions.map((ed: any) => Number(ed.season_age_groups.id));
                      }
                      setSelectedSessionDivisionIds(defaultSagIds);
                    } else {
                      setSelectedSessionDivisionIds([]);
                    }
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

                      {/* Division selection for session */}
                      {activeEvent?.event_divisions && activeEvent.event_divisions.length > 0 && (
                        <div>
                          <div className='flex items-center justify-between mb-1.5'>
                            <label className='block text-[0.65rem] font-bold text-text-label'>
                              Target Age Group / Division ({selectedSessionDivisionIds.length}/{activeEvent.event_divisions.length})
                            </label>
                            <div className='flex items-center gap-1 text-[0.6rem] font-bold'>
                              <button
                                type='button'
                                onClick={() =>
                                  setSelectedSessionDivisionIds(
                                    activeEvent.event_divisions.map((ed: any) => Number(ed.season_age_groups.id))
                                  )
                                }
                                className='text-primary hover:underline cursor-pointer'
                              >
                                Select All
                              </button>
                              <span className='text-muted/40'>|</span>
                              <button
                                type='button'
                                onClick={() => setSelectedSessionDivisionIds([])}
                                className='text-muted hover:text-text hover:underline cursor-pointer'
                              >
                                Deselect All
                              </button>
                            </div>
                          </div>
                          <p className='text-[0.55rem] text-muted mb-2'>
                            Select specific divisions to create separate sessions simultaneously, or leave all blank to include all divisions.
                          </p>
                          <div className='max-h-36 overflow-y-auto border border-border rounded-lg p-2 bg-background/50 space-y-1.5 custom-scrollbar'>
                            {activeEvent.event_divisions.map((ed: any) => {
                              const div = ed.season_age_groups;
                              const isSelected = selectedSessionDivisionIds.includes(div.id);
                              return (
                                <button
                                  key={div.id}
                                  type='button'
                                  onClick={() => {
                                    setSelectedSessionDivisionIds(prev =>
                                      prev.includes(div.id) ? prev.filter(id => id !== div.id) : [...prev, div.id]
                                    );
                                  }}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[0.65rem] font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-primary/10 text-primary border border-primary/30"
                                      : "hover:bg-background text-text border border-transparent"
                                  }`}
                                >
                                  {isSelected ? (
                                    <CheckSquare size={14} className='text-primary flex-shrink-0' />
                                  ) : (
                                    <Square size={14} className='text-muted/40 flex-shrink-0' />
                                  )}
                                  <span>{div.age_groups?.name || div.name}</span>
                                  <span className='text-[0.55rem] opacity-70'>({div.gender})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
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
                            <div className='flex flex-wrap items-center gap-1.5 mt-0.5'>
                              <span className='text-[0.65rem] text-muted flex items-center gap-1'>
                                <CalendarDays size={12} className='text-muted/60' />
                                {new Date(sess.session_date).toLocaleDateString()}
                              </span>
                              {sess.season_age_groups && (
                                <span className='px-1.5 py-0.5 text-[0.55rem] font-bold rounded-full border bg-primary/10 text-primary border-primary/20'>
                                  {sess.season_age_groups.age_groups?.name} ({sess.season_age_groups.gender})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className='flex items-center gap-1 opacity-0 group-hover/sess:opacity-100 transition-all'>
                          {sess.id < 0 ? (
                            <span className='px-2 py-1 text-[0.65rem] font-bold text-muted flex items-center gap-1 bg-surface border border-border rounded-lg'>
                              <Loader2 size={12} className='animate-spin text-primary' />
                              Saving...
                            </span>
                          ) : (
                            <Link
                              href={`/admin/sessions/${sess.id}`}
                              className='p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-all cursor-pointer flex items-center gap-1 text-[0.65rem] font-bold'
                              title='Manage Roster & Attendance'
                            >
                              <Users size={14} />
                              Roster
                            </Link>
                          )}
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
      {/* Modal Dialog for Event/Session Deletion Confirmation */}
      <Modal
        isOpen={!!activeDeleteTarget}
        onClose={() => setActiveDeleteTarget(null)}
        title={activeDeleteTarget?.type === "event" ? "Confirm Delete Event" : "Confirm Delete Session"}
        size='sm'
        footer={
          <>
            <Button variant='outline' onClick={() => setActiveDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant='danger' onClick={handleConfirmDelete} disabled={isPending}>
              Delete
            </Button>
          </>
        }
      >
        <p className='text-sm text-text font-medium leading-relaxed flex items-start gap-2.5'>
          <AlertCircle className='text-danger shrink-0' size={20} />
          <span>
            Are you sure you want to delete the {activeDeleteTarget?.type} <strong className='text-primary'>&quot;{activeDeleteTarget?.name}&quot;</strong>?
            {activeDeleteTarget?.type === "event" && " This will permanently delete all associated evaluation sessions as well."} This action cannot be undone.
          </span>
        </p>
      </Modal>

      {/* Modal Dialog for Editing Event */}
      {editingEvent && (
        <Modal
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
          title={`Edit Event: ${editingEvent.name}`}
          className='max-w-md'
        >
          <form onSubmit={handleUpdateEventSubmit} className='space-y-4 mt-3'>
            <div>
              <label className='block text-xs font-bold text-text-label mb-1'>Event Name</label>
              <Input
                placeholder='Event Name (e.g. 2026 Fall Tryouts)'
                value={editEventName}
                onChange={(e) => setEditEventName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className='block text-xs font-bold text-text-label mb-1'>Event Type</label>
              <select
                value={editEventType}
                onChange={(e) => setEditEventType(e.target.value as "tryout" | "ranking")}
                className='w-full text-xs font-semibold bg-surface py-2 px-3 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary'
              >
                <option value='tryout'>Tryout Event</option>
                <option value='ranking'>Ranking / Evaluation Event</option>
              </select>
            </div>

            <div>
              <label className='block text-xs font-bold text-text-label mb-1.5'>
                Target Divisions / Age Groups
              </label>
              {seasonDivisions.length === 0 ? (
                <p className='text-xs text-muted italic'>No divisions configured for this season.</p>
              ) : (
                <div className='grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 bg-background rounded-lg border border-border'>
                  {seasonDivisions.map((div: any) => {
                    const isSelected = editDivisionIds.includes(div.id);
                    const isMale = div.gender === "Male" || div.gender === "Boys";
                    const isFemale = div.gender === "Female" || div.gender === "Girls";
                    const genderColor = isMale
                      ? "text-blue-500"
                      : isFemale
                        ? "text-pink-500"
                        : "text-emerald-500";
                    const displayGender = isMale ? "Male" : isFemale ? "Female" : div.gender;
                    return (
                      <button
                        key={div.id}
                        type='button'
                        onClick={() =>
                          setEditDivisionIds((prev) =>
                            prev.includes(div.id) ? prev.filter((id) => id !== div.id) : [...prev, div.id]
                          )
                        }
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[0.65rem] font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 text-primary border border-primary/30"
                            : "hover:bg-background text-text border border-transparent"
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare size={14} className='text-primary flex-shrink-0' />
                        ) : (
                          <Square size={14} className='text-muted/40 flex-shrink-0' />
                        )}
                        <span>{div.age_groups?.name || div.name}</span>
                        <span className={`${genderColor} text-[0.55rem]`}>({displayGender})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className='flex gap-2 pt-3 justify-end border-t border-border'>
              <Button
                variant='outline'
                size='sm'
                type='button'
                onClick={() => setEditingEvent(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button variant='primary' size='sm' type='submit' disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
