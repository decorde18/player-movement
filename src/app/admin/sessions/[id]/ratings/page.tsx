"use client";

import React, { useEffect, useState, use, useTransition } from "react";
import { getRatingsForSession, submitPlayerRating, carryForwardEventRatings } from "./actions";
import { 
  Loader2, 
  ArrowLeft, 
  Star, 
  Save, 
  Users, 
  TrendingUp, 
  UserCheck,
  ShieldCheck,
  Award,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import FilterBar from "@/components/ui/FilterBar";
import SortControl from "@/components/ui/SortControl";
import { smartCompare } from "@/lib/utils/smartSort";
import { STANDARD_POSITIONS } from "@/lib/utils/positionPresets";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SessionRatingsPage(props: PageProps) {
  const params = use(props.params);
  const sessionId = parseInt(params.id, 10);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Local state for rating inputs: Record<sessionPlayerId, string>
  const [ratingInputs, setRatingInputs] = useState<Record<number, string>>({});
  // Saving states per player to show small loaders on blur: Record<sessionPlayerId, boolean>
  const [savingPlayers, setSavingPlayers] = useState<Record<number, boolean>>({});

  // Coordinator toggle to show details of all coaches' ratings
  const [showAllCoaches, setShowAllCoaches] = useState(true);

  // Filter & Search states
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [ratingStatusFilter, setRatingStatusFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [ratingRangeFilter, setRatingRangeFilter] = useState<string>("all");

  // Sort states
  const [sortKey, setSortKey] = useState<string>("tryout");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Dynamically compute rating range options based on actual values present in this session
  const ratingRangeFilterOptions = React.useMemo(() => {
    if (!data?.session?.session_players) {
      return [
        { value: "all", label: "All Ratings" },
        { value: "unrated", label: "Unrated Only" },
      ];
    }

    const allRatings: number[] = [];
    (data.session.session_players || []).forEach((sp: any) => {
      const inputVal = parseFloat(ratingInputs[sp.id] || "0");
      const dbRating = sp.rating || 0;
      const coachRatings = (sp.session_player_ratings || []).map((r: any) => r.rating || 0);
      const maxRating = Math.max(inputVal, dbRating, ...coachRatings, 0);
      if (maxRating > 0) {
        allRatings.push(maxRating);
      }
    });

    if (allRatings.length === 0) {
      return [
        { value: "all", label: "All Ratings" },
        { value: "unrated", label: "Unrated Only" },
      ];
    }

    const uniqueScores = Array.from<number>(
      new Set(allRatings.map((r: number) => Math.floor(r)))
    ).sort((a: number, b: number) => b - a);

    const options = [
      { value: "all", label: "All Ratings" },
      { value: "unrated", label: "Unrated Only" },
    ];

    uniqueScores.forEach((score: number) => {
      const count = allRatings.filter((r: number) => Math.floor(r) === score).length;
      options.push({
        value: `score_${score}`,
        label: `Score ${score}.0 - ${score}.9 (${count})`,
      });
    });

    return options;
  }, [data, ratingInputs]);

  const loadData = async () => {
    try {
      const res = await getRatingsForSession(sessionId);
      setData(res);

      // Pre-fill local rating input state with active coach's existing ratings
      const inputs: Record<number, string> = {};
      (res.session?.session_players || []).forEach((sp: any) => {
        const coachRating = sp.session_player_ratings?.find(
          (r: any) => r.coach_id === res.coachEmail
        );
        inputs[sp.id] = coachRating ? coachRating.rating.toString() : "";
      });
      setRatingInputs(inputs);
    } catch (e: any) {
      toast.error(e.message || "Failed to load ratings dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const handleRatingChange = (spId: number, val: string) => {
    if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
      setRatingInputs((prev) => ({ ...prev, [spId]: val }));
    }
  };

  const handleRatingBlur = async (spId: number) => {
    const valStr = ratingInputs[spId];
    if (valStr === "") return;

    const ratingVal = parseFloat(valStr);
    if (isNaN(ratingVal) || ratingVal < 0 || ratingVal > 10) {
      toast.error("Rating must be a number between 0 and 10.");
      return;
    }

    setSavingPlayers((prev) => ({ ...prev, [spId]: true }));
    try {
      const res = await submitPlayerRating(sessionId, spId, ratingVal);
      if (res.success) {
        toast.success("Rating saved successfully.");
        const updated = await getRatingsForSession(sessionId);
        setData(updated);
      } else {
        toast.error(res.error || "Failed to save rating.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error saving rating.");
    } finally {
      setSavingPlayers((prev) => ({ ...prev, [spId]: false }));
    }
  };

  const handleCarryForward = () => {
    if (!data?.session?.event_id) return;
    if (
      !confirm(
        "Are you sure you want to carry forward final average ratings for this entire event to the player registry? This will update general ratings for all active season players."
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await carryForwardEventRatings(data.session.event_id);
      if (res.success) {
        toast.success("Successfully carried forward and aggregated ratings to Registry!");
      } else {
        toast.error(res.error || "Failed to carry forward ratings.");
      }
    });
  };

  if (loading || !data) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center gap-3 text-text'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading Ratings Panel...</span>
      </div>
    );
  }

  const { session, coachEmail, coachName, userScope } = data;
  const isCoordinator =
    userScope.role === "admin" || userScope.role === "coordinator" || userScope.isSystemAdmin;

  const fields = session.session_fields || [];
  const players = session.session_players || [];

  // Get all unique represented season age groups
  const representedAgeGroups = Array.from(
    new Map(
      players
        .flatMap((sp: any) => sp.players?.season_players || [])
        .map((sp: any) => sp.season_age_groups)
        .filter(Boolean)
        .map((sag: any) => [sag.id, sag])
    ).values()
  );

  // Filter & Search predicate
  const matchesFilters = (sp: any) => {
    // Age Group filter
    if (selectedAgeGroup !== "all") {
      const isMatch = sp.players?.season_players?.some(
        (spRec: any) => spRec.season_age_group_id === Number(selectedAgeGroup)
      );
      if (!isMatch) return false;
    }

    // Position filter
    if (positionFilter !== "all") {
      const posVal = (sp.players?.position || "").trim();
      if (posVal !== positionFilter && !posVal.startsWith(`${positionFilter} `) && !posVal.startsWith(`${positionFilter}-`)) {
        return false;
      }
    }

    // Search query filter (Name or Tryout #)
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const fullName = `${sp.players.first_name} ${sp.players.last_name}`.toLowerCase();
      const tryout = (sp.players.tryout_number || "").toString().toLowerCase();
      if (!fullName.includes(q) && !tryout.includes(q)) {
        return false;
      }
    }

    // Rating Status filter
    if (ratingStatusFilter === "rated") {
      const hasRating = ratingInputs[sp.id] && ratingInputs[sp.id].trim() !== "";
      if (!hasRating) return false;
    } else if (ratingStatusFilter === "unrated") {
      const hasRating = ratingInputs[sp.id] && ratingInputs[sp.id].trim() !== "";
      if (hasRating) return false;
    }

    // Rating Range filter (dynamically matched to actual session data)
    const inputVal = parseFloat(ratingInputs[sp.id] || "0");
    const dbRating = sp.rating || 0;
    const coachRatings = (sp.session_player_ratings || []).map((r: any) => r.rating || 0);
    const ratVal = Math.max(inputVal, dbRating, ...coachRatings, 0);

    if (ratingRangeFilter === "unrated") {
      if (ratVal > 0) return false;
    } else if (ratingRangeFilter.startsWith("score_")) {
      const targetScore = parseInt(ratingRangeFilter.replace("score_", ""), 10);
      if (Math.floor(ratVal) !== targetScore) return false;
    }

    return true;
  };

  // Sorting helper
  const sortPlayersList = (list: any[]) => {
    return [...list].sort((a: any, b: any) => {
      if (sortKey === "name") {
        const nameA = `${a.players.last_name} ${a.players.first_name}`.toLowerCase();
        const nameB = `${b.players.last_name} ${b.players.first_name}`.toLowerCase();
        return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortKey === "tryout") {
        return smartCompare(a.players.tryout_number, b.players.tryout_number, sortDirection);
      }
      if (sortKey === "rating") {
        const valA = parseFloat(ratingInputs[a.id] || "0") || a.rating || 0;
        const valB = parseFloat(ratingInputs[b.id] || "0") || b.rating || 0;
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
      if (sortKey === "position") {
        const posA = a.players.position || "";
        const posB = b.players.position || "";
        return sortDirection === "asc" ? posA.localeCompare(posB) : posB.localeCompare(posA);
      }
      return 0;
    });
  };

  const sortOptions = [
    { value: "tryout", label: "Tryout #" },
    { value: "name", label: "Player Name" },
    { value: "rating", label: "Rating" },
    { value: "position", label: "Position" },
  ];

  const ageGroupFilterOptions = [
    { value: "all", label: "All Age Groups" },
    ...representedAgeGroups.map((sag: any) => ({
      value: sag.id.toString(),
      label: `${sag.age_groups?.name} (${sag.gender})`,
    })),
  ];

  const positionFilterOptions = [
    { value: "all", label: "All Positions" },
    ...STANDARD_POSITIONS.map(p => ({ value: p, label: `Pos: ${p}` })),
  ];

  const ratingStatusOptions = [
    { value: "all", label: "All Rating Statuses" },
    { value: "rated", label: "Rated Only" },
    { value: "unrated", label: "Unrated Only" },
  ];

  const filterGroups = [
    {
      id: "ageGroup",
      label: "Age Group",
      value: selectedAgeGroup,
      options: ageGroupFilterOptions,
      onChange: setSelectedAgeGroup,
    },
    {
      id: "position",
      label: "Position",
      value: positionFilter,
      options: positionFilterOptions,
      onChange: setPositionFilter,
    },
    {
      id: "ratingStatus",
      label: "Status",
      value: ratingStatusFilter,
      options: ratingStatusOptions,
      onChange: setRatingStatusFilter,
    },
    {
      id: "ratingRange",
      label: "Rating Range",
      value: ratingRangeFilter,
      options: ratingRangeFilterOptions,
      onChange: setRatingRangeFilter,
    },
  ];

  const handleResetFilters = () => {
    setSelectedAgeGroup("all");
    setPositionFilter("all");
    setSearchQuery("");
    setRatingStatusFilter("all");
    setRatingRangeFilter("all");
    setSortKey("tryout");
    setSortDirection("asc");
  };

  return (
    <div className='w-full flex-1 flex flex-col min-h-0 animate-fadeIn space-y-4 pb-2'>
      
      {/* Stationary Top Controls Group */}
      <div className='shrink-0 space-y-4'>
        {/* Top Breadcrumb Bar */}
        <div className='flex items-center justify-between bg-surface/60 border border-border p-4 rounded-2xl shadow-sm backdrop-blur-md flex-wrap gap-3'>
          <div className='flex items-center gap-3'>
            <Link
              href={`/admin/events`}
              className='p-2 rounded-lg border border-border bg-background text-muted hover:text-text transition-all cursor-pointer'
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className='flex items-center gap-2'>
                <span className='text-[10px] font-extrabold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20'>
                  {session.events.name}
                </span>
                <ChevronRight size={12} className='text-muted' />
                <span className='text-xs font-bold text-muted'>
                  {new Date(session.session_date).toLocaleDateString()}
                </span>
              </div>
              <h1 className='text-xl font-extrabold text-text mt-0.5'>
                {session.name} — Evaluation Ratings
              </h1>
            </div>
          </div>

          <div className='flex items-center gap-2.5 flex-wrap'>
            {isCoordinator && (
              <Button
                onClick={handleCarryForward}
                variant='primary'
                size='sm'
                disabled={isPending}
                className='flex items-center gap-1.5 font-bold text-xs bg-accent hover:bg-accent-hover text-white'
              >
                <TrendingUp size={14} />
                <span>Carry Forward Averages to Registry</span>
              </Button>
            )}
            <Link href={`/admin/sessions/${sessionId}`}>
              <Button variant='outline' size='sm' className='font-bold text-xs'>
                <Users size={14} className='mr-1' /> Roster Management
              </Button>
            </Link>
          </div>
        </div>

        {/* Info Stats Ribbon */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <Card className='p-3 flex items-center gap-3 bg-surface/50 border-border'>
            <div className='w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0'>
              <UserCheck size={18} />
            </div>
            <div>
              <span className='text-[10px] font-extrabold text-muted uppercase tracking-wider block'>Active Evaluator</span>
              <span className='text-xs font-bold text-text truncate max-w-[180px] block'>{coachName}</span>
            </div>
          </Card>

          <Card className='p-3 flex items-center gap-3 bg-surface/50 border-border'>
            <div className='w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0'>
              <Award size={18} />
            </div>
            <div>
              <span className='text-[10px] font-extrabold text-muted uppercase tracking-wider block'>Players Present</span>
              <span className='text-xs font-bold text-text block'>{players.length} Players</span>
            </div>
          </Card>

          {isCoordinator && (
            <Card className='p-3 flex items-center justify-between bg-surface/50 border-border'>
              <div className='flex items-center gap-3'>
                <div className='w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0'>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <span className='text-[10px] font-extrabold text-muted uppercase tracking-wider block'>Coordinator View</span>
                  <span className='text-xs font-bold text-text block'>Detailed Multi-Coach View</span>
                </div>
              </div>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={showAllCoaches}
                  onChange={() => setShowAllCoaches(!showAllCoaches)}
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </Card>
          )}
        </div>

        {/* Age Group Filter Tabs */}
        {representedAgeGroups && representedAgeGroups.length > 1 && (
          <div className='flex items-center gap-2 bg-surface/60 border border-border p-2.5 rounded-2xl shadow-sm overflow-x-auto'>
            <span className='text-xs font-bold text-muted uppercase tracking-wider px-2 shrink-0'>Age Group Filter:</span>
            <button
              type='button'
              onClick={() => setSelectedAgeGroup("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                selectedAgeGroup === "all"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-background text-muted hover:text-text border border-border"
              }`}
            >
              All Combined ({players.length})
            </button>
            {representedAgeGroups.map((sag: any) => {
              const count = players.filter((sp: any) =>
                sp.players?.season_players?.some((spRec: any) => spRec.season_age_group_id === sag.id)
              ).length;
              return (
                <button
                  key={sag.id}
                  type='button'
                  onClick={() => setSelectedAgeGroup(sag.id.toString())}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    selectedAgeGroup === sag.id.toString()
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

        {/* Reusable Filter & Sort Control Toolbar */}
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <FilterBar
            filters={filterGroups}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder='Search player name or tryout #...'
            onResetFilters={handleResetFilters}
            className='flex-1 min-w-[280px]'
          />

          <SortControl
            options={sortOptions}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={(key, dir) => {
              setSortKey(key);
              setSortDirection(dir);
            }}
            label='Sort Roster'
            size='sm'
          />
        </div>
      </div>

      {/* Scrollable Fields & Roster Ratings Area */}
      <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-6 pr-1'>
        {[...fields, { id: null, name: "Unassigned" }].map((field: any) => {
          const rawFieldPlayers = players.filter((p: any) => p.field_id === field.id && matchesFilters(p));
          if (rawFieldPlayers.length === 0 && field.id === null) return null; // Hide empty unassigned column

          const fieldPlayers = sortPlayersList(rawFieldPlayers);

          return (
            <Card key={field.id ?? "unassigned"} className='p-5 bg-surface/80 border-border shadow-sm flex flex-col space-y-4'>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <h3 className='font-extrabold text-sm text-text flex items-center gap-2'>
                  <span className='w-2.5 h-2.5 rounded-full bg-primary' />
                  {field.name}
                </h3>
                <span className='text-xs font-bold px-2 py-0.5 rounded-full bg-muted/20 text-muted'>
                  {fieldPlayers.length} {fieldPlayers.length === 1 ? "Player" : "Players"} Present
                </span>
              </div>

              {fieldPlayers.length > 0 && (
                <div className='flex items-center gap-3 bg-primary/5 border border-primary/10 p-3 rounded-xl max-w-md'>
                  <span className='text-xs font-bold text-primary shrink-0'>Bulk Assign Ratings:</span>
                  <input
                    type='text'
                    placeholder='Enter rating (0-10)...'
                    id={`bulk-rating-input-${field.id ?? "unassigned"}`}
                    className='w-32 py-1 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary'
                  />
                  <Button
                    variant='primary'
                    size='xs'
                    onClick={async () => {
                      const inputEl = document.getElementById(`bulk-rating-input-${field.id ?? "unassigned"}`) as HTMLInputElement | null;
                      const valStr = inputEl?.value || "";
                      const val = parseFloat(valStr);
                      if (isNaN(val) || val < 0 || val > 10) {
                        toast.error("Please enter a valid rating between 0 and 10.");
                        return;
                      }
                      setIsBulkSaving(true);
                      try {
                        for (const sp of fieldPlayers) {
                          await submitPlayerRating(sessionId, sp.id, val);
                        }
                        toast.success(`Successfully assigned rating of ${val} to all players on ${field.name}!`);
                        if (inputEl) inputEl.value = "";
                        const updated = await getRatingsForSession(sessionId);
                        setData(updated);
                        const inputs = { ...ratingInputs };
                        updated.session.session_players.forEach((sp: any) => {
                          const coachRating = sp.session_player_ratings.find(
                            (r: any) => r.coach_id === updated.coachEmail
                          );
                          inputs[sp.id] = coachRating ? coachRating.rating.toString() : "";
                        });
                        setRatingInputs(inputs);
                      } catch (err: any) {
                        toast.error("Failed to assign bulk ratings: " + err.message);
                      } finally {
                        setIsBulkSaving(false);
                      }
                    }}
                    disabled={isBulkSaving}
                    className='font-bold text-xs h-[30px]'
                  >
                    {isBulkSaving ? "Saving..." : "Apply to All"}
                  </Button>
                </div>
              )}

              {fieldPlayers.length === 0 ? (
                <div className='text-center py-6 text-xs text-muted/50 italic font-medium'>
                  No players placed in this field matching current filters.
                </div>
              ) : (
                <div className='border border-border rounded-xl overflow-hidden bg-background/25'>
                  <table className='w-full text-left text-xs'>
                    <thead className='bg-background font-bold text-text-label border-b border-border'>
                      <tr>
                        <th className='p-3.5'>Player</th>
                        <th className='p-3.5 text-center'>Tryout #</th>
                        <th className='p-3.5 text-center w-36'>Your Rating (0-10)</th>
                        {isCoordinator && showAllCoaches && (
                          <>
                            <th className='p-3.5'>Coaches Ratings Breakdown</th>
                            <th className='p-3.5 text-center w-24'>Session Avg</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-border bg-surface'>
                      {fieldPlayers.map((sp: any) => {
                        const isSaving = savingPlayers[sp.id] || false;
                        
                        return (
                          <tr key={sp.id} className='hover:bg-background/20 transition-all'>
                            <td className='p-3.5 font-bold text-text'>
                              {sp.players.first_name} {sp.players.last_name}
                            </td>
                            <td className='p-3.5 text-center font-extrabold text-accent'>
                              {sp.players.tryout_number ? `#${sp.players.tryout_number}` : "--"}
                            </td>
                            <td className='p-3.5 text-center'>
                              <div className='flex items-center justify-center gap-2.5'>
                                <input
                                  type='text'
                                  value={ratingInputs[sp.id] || ""}
                                  onChange={(e) => handleRatingChange(sp.id, e.target.value)}
                                  onBlur={() => handleRatingBlur(sp.id)}
                                  placeholder='--'
                                  className='w-16 text-center text-xs font-bold py-1 px-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary'
                                  disabled={isSaving}
                                />
                                {isSaving ? (
                                  <Loader2 className='animate-spin text-primary shrink-0' size={14} />
                                ) : (
                                  <Save size={14} className='text-muted/40 shrink-0' />
                                )}
                              </div>
                            </td>
                            {isCoordinator && showAllCoaches && (
                              <>
                                <td className='p-3.5 max-w-xs'>
                                  <div className='flex flex-wrap gap-1.5'>
                                    {sp.session_player_ratings.length === 0 ? (
                                      <span className='text-[10px] text-muted italic'>No ratings submitted</span>
                                    ) : (
                                      sp.session_player_ratings.map((r: any) => (
                                        <span 
                                          key={r.id} 
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                                            r.coach_id === coachEmail 
                                              ? "bg-primary/5 text-primary border-primary/20" 
                                              : "bg-muted/10 text-muted border-border"
                                          }`}
                                          title={`Coach: ${r.coach_name}`}
                                        >
                                          <Star size={8} className='fill-current' />
                                          {r.rating} ({r.coach_name})
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </td>
                                <td className='p-3.5 text-center font-extrabold text-primary text-sm'>
                                  {sp.rating ? sp.rating.toFixed(2) : "--"}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

    </div>
  );
}
