"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  getEventRankings, 
  updateRankings, 
  finalizeRankings,
  unlockRankings,
  updateEventRankingSettings,
  assignEventPlayerToTeam,
  bulkAssignEventPlayersToTeam
} from "./actions";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import FilterBar from "@/components/ui/FilterBar";
import SortControl from "@/components/ui/SortControl";
import { 
  Loader2, 
  ArrowLeft, 
  ShieldCheck, 
  Lock, 
  LockOpen, 
  Users, 
  Save, 
  Printer, 
  HelpCircle, 
  SlidersHorizontal,
  UserX,
  CheckSquare,
  Square,
  ArrowRightLeft,
  X,
  Shirt,
  Shield,
  GripVertical
} from "lucide-react";
import { toast } from "sonner";
import { smartCompare } from "@/lib/utils/smartSort";
import { STANDARD_POSITIONS } from "@/lib/utils/positionPresets";

export default function EventRankingsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = Number(params.id);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  // View Grouping Mode: "tier" (default) or "team" (Final Team Rankings)
  const [rankingViewGroup, setRankingViewGroup] = useState<"tier" | "team">("tier");

  // Active coach rankings being viewed/edited
  const [selectedCoach, setSelectedCoach] = useState<string>("");
  const [rankingsList, setRankingsList] = useState<any[]>([]);

  // Sorting state per column: Record<colName, { key: string, direction: "asc" | "desc" }>
  const [columnSorts, setColumnSorts] = useState<Record<string, { key: string; direction: "asc" | "desc" }>>({});

  // Global Roster Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");

  // Bulk Selection State
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [bulkTargetTier, setBulkTargetTier] = useState<string>("");
  const [bulkTargetTeamId, setBulkTargetTeamId] = useState<string>("");

  const handleBulkAssignTeam = async () => {
    if (selectedPlayerIds.size === 0) return;
    const teamIdVal = bulkTargetTeamId === "unassign" ? null : (bulkTargetTeamId ? Number(bulkTargetTeamId) : null);
    
    const seasonPlayerIds = rankingsList
      .filter(p => selectedPlayerIds.has(p.playerId))
      .map(p => p.seasonPlayerId)
      .filter(Boolean);

    if (seasonPlayerIds.length === 0) return;

    startTransition(async () => {
      const res = await bulkAssignEventPlayersToTeam(eventId, seasonPlayerIds, teamIdVal);
      if (res.success) {
        toast.success(`Assigned ${seasonPlayerIds.length} players to permanent team.`);
        setSelectedPlayerIds(new Set());
        setBulkTargetTeamId("");
        loadData(selectedCoach);
      } else {
        toast.error(res.error || "Failed to assign players to team.");
      }
    });
  };

  const handleSingleAssignTeam = async (seasonPlayerId: number, seasonTeamId: number | null) => {
    startTransition(async () => {
      const res = await assignEventPlayerToTeam(eventId, seasonPlayerId, seasonTeamId);
      if (res.success) {
        toast.success("Player permanent team updated.");
        loadData(selectedCoach);
      } else {
        toast.error(res.error || "Failed to update team.");
      }
    });
  };

  // Drag states
  const [draggedPlayerId, setDraggedPlayerId] = useState<number | null>(null);

  // Mobile/Tap selection state
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  // Modal states
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Settings form states
  const [settingsRatingDir, setSettingsRatingDir] = useState<"high_is_best" | "low_is_best">("high_is_best");
  const [settingsTiersInput, setSettingsTiersInput] = useState<string>("Gold, Competitive, Development");

  // Dynamically compute rating filter options (must be top-level hook before early return)
  const ratingFilterOptions = React.useMemo(() => {
    const activeEventRatings = rankingsList
      .map((p: any) => p.rating || 0)
      .filter((r: number) => r > 0);

    if (activeEventRatings.length === 0) {
      return [
        { value: "all", label: "All Ratings" },
        { value: "unrated", label: "Unrated Only" },
      ];
    }

    const sortFn = settingsRatingDir === "low_is_best" 
      ? (a: number, b: number) => a - b 
      : (a: number, b: number) => b - a;

    const uniqueScores = Array.from<number>(
      new Set(activeEventRatings.map((r: number) => Math.floor(r)))
    ).sort(sortFn);

    const options = [
      { value: "all", label: "All Ratings" },
      { value: "unrated", label: "Unrated Only" },
    ];

    uniqueScores.forEach((score: number, idx: number) => {
      const count = activeEventRatings.filter((r: number) => Math.floor(r) === score).length;
      let label = `Score ${score}.0 - ${score}.9 (${count})`;
      if (idx === 0) {
        label += settingsRatingDir === "low_is_best" ? " (Top Score 1)" : " (Top Score 10)";
      }
      options.push({
        value: `score_${score}`,
        label,
      });
    });

    return options;
  }, [rankingsList, settingsRatingDir]);

  const loadData = async (coachEmail?: string) => {
    try {
      setLoading(true);
      const res = await getEventRankings(eventId, coachEmail);
      setData(res);
      setSelectedCoach(res.activeCoach || "");
      setRankingsList(res.rankings || []);
      setSettingsRatingDir((res.ratingDirection === "low_is_best" ? "low_is_best" : "high_is_best"));
      setSettingsTiersInput(res.eventTiers ? res.eventTiers.join(", ") : "Gold, Competitive, Development");
      setSelectedPlayerIds(new Set());
    } catch (e: any) {
      toast.error(e.message || "Failed to load event rankings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      loadData();
    }
  }, [eventId]);

  const handleCoachChange = (email: string) => {
    loadData(email);
  };

  // Bulk Checkbox Toggles
  const handleToggleSelectPlayer = (playerId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (data?.isFinalized) return;

    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const handleSelectAllColumn = (playersList: any[]) => {
    if (data?.isFinalized) return;
    const allSelected = playersList.every(p => selectedPlayerIds.has(p.playerId));
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      playersList.forEach(p => {
        if (allSelected) {
          next.delete(p.playerId);
        } else {
          next.add(p.playerId);
        }
      });
      return next;
    });
  };

  const handleBulkMove = (targetTier: string) => {
    if (selectedPlayerIds.size === 0 || !targetTier) return;
    if (data?.isFinalized) return;

    const updatedList = [...rankingsList];

    selectedPlayerIds.forEach(pid => {
      const playerObj = updatedList.find(p => p.playerId === pid);
      if (playerObj) {
        playerObj.tier = targetTier;
      }
    });

    // Re-index ranks for target tier if not Unassigned
    if (targetTier !== "Unassigned") {
      const tierPlayers = updatedList.filter(p => p.tier === targetTier);
      tierPlayers.forEach((p, idx) => {
        p.rank = idx + 1;
      });
    } else {
      selectedPlayerIds.forEach(pid => {
        const playerObj = updatedList.find(p => p.playerId === pid);
        if (playerObj) playerObj.rank = 0;
      });
    }

    setRankingsList(updatedList);
    toast.success(`Moved ${selectedPlayerIds.size} players to ${targetTier}.`);
    setSelectedPlayerIds(new Set());
    setBulkTargetTier("");
  };

  // Reordering drag & drop logic
  const handleDragStart = (e: React.DragEvent, playerId: number, currentTier: string) => {
    setDraggedPlayerId(playerId);
    e.dataTransfer.setData("text/plain", playerId.toString());

    // Switch sort mode to rank if not already set
    const currentSort = columnSorts[currentTier];
    if (!currentSort || currentSort.key !== "rank") {
      setColumnSorts(prev => ({ ...prev, [currentTier]: { key: "rank", direction: "asc" } }));
      toast.info(`Switched ${currentTier} sorting to Rank for manual reordering.`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Drop onto column container (empty space or header)
  const handleColumnDrop = (e: React.DragEvent, targetTier: string) => {
    e.preventDefault();
    const sourceId = Number(e.dataTransfer.getData("text/plain") || draggedPlayerId);
    if (!sourceId) return;

    movePlayerToTier(sourceId, targetTier, null);
  };

  // Drop onto specific player card inside column
  const handleCardDrop = (e: React.DragEvent, targetPlayerId: number, targetTier: string) => {
    e.preventDefault();
    e.stopPropagation(); // prevent triggering column drop
    const sourceId = Number(e.dataTransfer.getData("text/plain") || draggedPlayerId);
    if (!sourceId || sourceId === targetPlayerId) return;

    movePlayerToTier(sourceId, targetTier, targetPlayerId);
  };

  // Helper to update player placement in local rankingsList state
  const movePlayerToTier = (sourcePlayerId: number, targetTier: string, targetPlayerId: number | null) => {
    const currentSort = columnSorts[targetTier];
    if (!currentSort || currentSort.key !== "rank") {
      setColumnSorts(prev => ({ ...prev, [targetTier]: { key: "rank", direction: "asc" } }));
    }

    const sourcePlayer = rankingsList.find(p => p.playerId === sourcePlayerId);
    if (!sourcePlayer) return;

    // Remove source player from rankings list temporarily
    const updatedList = rankingsList.filter(p => p.playerId !== sourcePlayerId);

    // Update tier
    sourcePlayer.tier = targetTier;

    if (targetPlayerId !== null && targetPlayerId !== sourcePlayerId) {
      // Find position of target player
      const targetIdx = updatedList.findIndex(p => p.playerId === targetPlayerId);
      if (targetIdx !== -1) {
        updatedList.splice(targetIdx, 0, sourcePlayer);
      } else {
        updatedList.push(sourcePlayer);
      }
    } else {
      // Append to tier
      updatedList.push(sourcePlayer);
    }

    // Re-index ranks for the target tier
    if (targetTier !== "Unassigned") {
      const tierPlayers = updatedList.filter(p => p.tier === targetTier);
      tierPlayers.forEach((p, idx) => {
        p.rank = idx + 1;
      });
    } else {
      sourcePlayer.rank = 0;
    }

    setRankingsList([...updatedList]);
    setDraggedPlayerId(null);
    setSelectedPlayerId(null);
  };

  // Tap-to-Select Fallback
  const handlePlayerTap = (playerId: number) => {
    if (data?.isFinalized) return;
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
    } else {
      setSelectedPlayerId(playerId);
      toast.info("Player selected. Tap any tier column to move them.");
    }
  };

  const handleColumnClick = (targetTier: string) => {
    if (selectedPlayerId !== null && !data?.isFinalized) {
      movePlayerToTier(selectedPlayerId, targetTier, null);
      toast.success(`Moved player to ${targetTier}`);
    }
  };

  const handleSaveRankings = async () => {
    setSaving(true);
    try {
      const payload = rankingsList.map(r => ({
        playerId: r.playerId,
        rank: r.rank,
        tier: r.tier
      }));
      const res = await updateRankings(eventId, payload, selectedCoach);
      if (res.success) {
        toast.success("Rankings saved successfully.");
        await loadData(selectedCoach);
      } else {
        toast.error(res.error || "Failed to save rankings.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error saving rankings.");
    } finally {
      setSaving(false);
    }
  };

  const confirmFinalize = () => {
    setShowFinalizeModal(false);
    startTransition(async () => {
      const res = await finalizeRankings(eventId);
      if (res.success) {
        toast.success("Event rankings finalized successfully!");
        loadData(selectedCoach);
      } else {
        toast.error(res.error || "Failed to finalize rankings.");
      }
    });
  };

  const confirmUnlock = () => {
    setShowUnlockModal(false);
    startTransition(async () => {
      const res = await unlockRankings(eventId);
      if (res.success) {
        toast.success("Event rankings unlocked!");
        loadData(selectedCoach);
      } else {
        toast.error(res.error || "Failed to unlock rankings.");
      }
    });
  };

  const handleSaveSettings = () => {
    const parsedTiers = settingsTiersInput
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    if (parsedTiers.length === 0) {
      toast.error("Please enter at least one tier name.");
      return;
    }

    startTransition(async () => {
      const res = await updateEventRankingSettings(eventId, settingsRatingDir, parsedTiers);
      if (res.success) {
        toast.success("Event ranking settings updated successfully!");
        setShowSettingsModal(false);
        loadData(selectedCoach);
      } else {
        toast.error(res.error || "Failed to update settings.");
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || !data) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center gap-3 text-text'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading Event Rankings Workspace...</span>
      </div>
    );
  }

  const { 
    event, 
    otherCoaches, 
    isCoordinator, 
    isFinalized, 
    finalizedBy, 
    finalizedAt,
    eventTiers,
    ratingDirection,
    seasonTeams
  } = data;

  const handleMoveRankByStep = (playerId: number, colName: string, step: number) => {
    if (data?.isFinalized) return;
    const currentList = getPlayersForColumn(colName);
    const currentIndex = currentList.findIndex(p => p.playerId === playerId);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + step;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const targetPlayer = currentList[targetIndex];
    movePlayerToTier(playerId, colName, targetPlayer.playerId);
  };

  const handleJumpToRank = (playerId: number, colName: string, newRankStr: string) => {
    if (data?.isFinalized) return;
    const newRank = parseInt(newRankStr, 10);
    if (isNaN(newRank) || newRank < 1) return;

    const currentList = getPlayersForColumn(colName);
    const targetIdx = Math.min(newRank - 1, currentList.length - 1);
    const targetPlayer = currentList[targetIdx];

    if (targetPlayer && targetPlayer.playerId !== playerId) {
      movePlayerToTier(playerId, colName, targetPlayer.playerId);
    }
  };

  const activeScoresList = Array.from(
    new Set<number>(
      rankingsList
        .map((p) => p.rating || 0)
        .filter((r: number) => r > 0)
    )
  ).sort((a, b) => b - a);

  const ratingGroupColumns = [
    "Unassigned",
    ...activeScoresList.map((sc) => `Rating ${sc.toFixed(1)}`),
  ];

  const teamNames: string[] = Array.from(new Set<string>((seasonTeams || []).map((st: any) => (st.teams?.name || `Team ${st.id}`) as string)));
  const allColumns: string[] = rankingViewGroup === "team"
    ? [...teamNames, "Unassigned Team"]
    : ratingGroupColumns;

  // Predicate filter helper
  const matchesFilter = (p: any) => {
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const tryout = (p.tryoutNumber || "").toString().toLowerCase();
      if (!fullName.includes(q) && !tryout.includes(q)) return false;
    }

    if (positionFilter !== "all") {
      const posVal = (p.position || "").trim();
      if (posVal !== positionFilter && !posVal.startsWith(`${positionFilter} `) && !posVal.startsWith(`${positionFilter}-`)) {
        return false;
      }
    }

    if (ratingFilter === "unrated") {
      const ratVal = p.rating || 0;
      if (ratVal > 0) return false;
    } else if (ratingFilter.startsWith("score_")) {
      const targetScore = parseInt(ratingFilter.replace("score_", ""), 10);
      const ratVal = p.rating || 0;
      if (Math.floor(ratVal) !== targetScore) return false;
    }

    return true;
  };

  const getPlayersForColumn = (columnName: string) => {
    let list: any[] = [];
    if (rankingViewGroup === "team") {
      if (columnName === "Unassigned Team") {
        list = rankingsList.filter(p => (!p.teamName || p.teamName === "Unassigned Team") && matchesFilter(p));
      } else {
        list = rankingsList.filter(p => p.teamName === columnName && matchesFilter(p));
      }
    } else {
      if (columnName === "Unassigned") {
        list = rankingsList.filter(p => (!p.rating || p.rating === 0) && matchesFilter(p));
      } else {
        list = rankingsList.filter(p => p.rating && `Rating ${p.rating.toFixed(1)}` === columnName && matchesFilter(p));
      }
    }

    const sortConfig = columnSorts[columnName] || { key: "rank", direction: "asc" };
    const { key, direction } = sortConfig;

    return [...list].sort((a, b) => {
      if (key === "name") {
        const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
        const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
        return direction === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (key === "rating") {
        const valA = a.rating || 0;
        const valB = b.rating || 0;
        return direction === "asc" ? valA - valB : valB - valA;
      }
      if (key === "position") {
        const posA = a.position || "";
        const posB = b.position || "";
        return direction === "asc" ? posA.localeCompare(posB) : posB.localeCompare(posA);
      }
      if (key === "tryout") {
        return smartCompare(a.tryoutNumber, b.tryoutNumber, direction);
      }
      // default: rank
      return direction === "asc" ? a.rank - b.rank : b.rank - a.rank;
    });
  };

  const sortOptions = [
    { value: "rank", label: "Rank #" },
    { value: "rating", label: "Rating" },
    { value: "name", label: "Name" },
    { value: "tryout", label: "Tryout #" },
    { value: "position", label: "Position" },
  ];

  const filterGroups = [
    {
      id: "position",
      label: "Position",
      value: positionFilter,
      options: [
        { value: "all", label: "All Positions" },
        ...STANDARD_POSITIONS.map(p => ({ value: p, label: `Pos: ${p}` }))
      ],
      onChange: setPositionFilter,
    },
    {
      id: "rating",
      label: "Rating",
      value: ratingFilter,
      options: ratingFilterOptions,
      onChange: setRatingFilter,
    },
  ];

  const handleResetFilters = () => {
    setSearchQuery("");
    setPositionFilter("all");
    setRatingFilter("all");
    setSelectedPlayerIds(new Set());
  };

  return (
    <div className='w-full flex-1 flex flex-col min-h-0 animate-fadeIn print:bg-white print:text-black space-y-4 pb-2'>
      
      {/* Stationary Top Controls Group */}
      <div className='shrink-0 space-y-4 print:hidden'>
        {/* Top Navigation Bar */}
        <div className='flex flex-wrap items-center justify-between gap-3 bg-surface/60 border border-border p-4 rounded-2xl shadow-sm backdrop-blur-md'>
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
                  Event Rankings Dashboard
                </span>
                <span className='text-[10px] font-bold text-muted bg-surface px-2 py-0.5 rounded-full border border-border'>
                  {ratingDirection === "low_is_best" ? "Scale: 1 is High" : "Scale: 10 is High"}
                </span>
              </div>
              <h1 className='text-xl font-extrabold text-text mt-0.5'>
                {event.name}
              </h1>
            </div>
          </div>

          <div className='flex items-center gap-2.5 flex-wrap'>
            <div className='flex items-center bg-background border border-border p-1 rounded-xl shadow-xs'>
              <button
                type='button'
                onClick={() => setRankingViewGroup("tier")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  rankingViewGroup === "tier"
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted hover:text-text"
                }`}
              >
                Group by Tiers
              </button>
              <button
                type='button'
                onClick={() => setRankingViewGroup("team")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  rankingViewGroup === "team"
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted hover:text-text"
                }`}
              >
                Group by Final Team
              </button>
            </div>
            {isCoordinator && (
              <Link href='/admin/teams/placement'>
                <Button
                  variant='outline'
                  size='sm'
                  className='flex items-center gap-1.5 font-bold text-xs border-blue-500/30 text-blue-600 hover:bg-blue-500/10'
                >
                  <Shirt size={14} />
                  <span>Team Board</span>
                </Button>
              </Link>
            )}

            {isCoordinator && (
              <Button
                onClick={() => setShowSettingsModal(true)}
                variant='outline'
                size='sm'
                className='flex items-center gap-1.5 font-bold text-xs'
              >
                <SlidersHorizontal size={14} />
                <span>Settings & Tiers</span>
              </Button>
            )}

            <Button
              onClick={handlePrint}
              variant='outline'
              size='sm'
              className='flex items-center gap-1.5 font-bold text-xs'
            >
              <Printer size={14} />
              <span>Print Rankings</span>
            </Button>

            {!isFinalized && (
              <Button
                onClick={handleSaveRankings}
                variant='primary'
                size='sm'
                disabled={saving}
                className='flex items-center gap-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-none'
              >
                <Save size={14} />
                <span>{saving ? "Saving..." : "Save Ranks"}</span>
              </Button>
            )}

            {isCoordinator && !isFinalized && (
              <Button
                onClick={() => setShowFinalizeModal(true)}
                variant='primary'
                size='sm'
                disabled={isPending}
                className='flex items-center gap-1.5 font-bold text-xs bg-accent hover:bg-accent-hover text-white border-none'
              >
                <Lock size={14} />
                <span>Finalize Placement Ranks</span>
              </Button>
            )}

            {isCoordinator && isFinalized && (
              <Button
                onClick={() => setShowUnlockModal(true)}
                variant='outline'
                size='sm'
                disabled={isPending}
                className='flex items-center gap-1.5 font-bold text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10'
              >
                <LockOpen size={14} />
                <span>Unlock Placement Ranks</span>
              </Button>
            )}
          </div>
        </div>

        {/* Workspace Tabs Sub-Navigation */}
        <div className='flex items-center gap-2 bg-surface/80 border border-border p-2 rounded-2xl shadow-sm overflow-x-auto shrink-0 print:hidden'>
          <Link
            href={`/player-board`}
            className='px-4 py-2 text-xs font-bold rounded-xl transition-all bg-background text-muted hover:text-text border border-border flex items-center gap-2 shrink-0'
          >
            <Users size={14} className='text-emerald-500' />
            Check-in
          </Link>
          <Link
            href={`/player-board`}
            className='px-4 py-2 text-xs font-bold rounded-xl transition-all bg-background text-muted hover:text-text border border-border flex items-center gap-2 shrink-0'
          >
            <Users size={14} className='text-amber-500' />
            Rating
          </Link>
          <Link
            href={`/player-board`}
            className='px-4 py-2 text-xs font-bold rounded-xl transition-all bg-background text-muted hover:text-text border border-border flex items-center gap-2 shrink-0'
          >
            <Users size={14} className='text-primary' />
            Field Assignment
          </Link>
          <button
            type='button'
            className='px-4 py-2 text-xs font-bold rounded-xl transition-all bg-primary text-white shadow-sm flex items-center gap-2 shrink-0 cursor-pointer'
          >
            <ShieldCheck size={14} />
            Ranking
          </button>
          <Link
            href={`/admin/events/${eventId}/placement`}
            className='px-4 py-2 text-xs font-bold rounded-xl transition-all bg-background text-muted hover:text-text border border-border flex items-center gap-2 shrink-0'
          >
            <Users size={14} className='text-blue-500' />
            Final Placement
          </Link>
        </div>

        {/* Reusable Filter Toolbar */}
        <FilterBar
          filters={filterGroups}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder='Search player name or tryout #...'
          onResetFilters={handleResetFilters}
        />

        {/* Floating Bulk Move Toolbar */}
        {selectedPlayerIds.size > 0 && (
          <div className='sticky top-0 z-40 bg-surface/95 border-2 border-primary/40 shadow-2xl p-4 rounded-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4 animate-slideUp print:hidden'>
            <div className='flex items-center gap-2 text-xs font-bold text-text'>
              <span className='w-6 h-6 rounded-lg bg-primary text-white flex items-center justify-center text-xs font-black'>
                {selectedPlayerIds.size}
              </span>
              <span>Player{selectedPlayerIds.size > 1 ? "s" : ""} Selected</span>
            </div>

            <div className='flex items-center gap-4 flex-wrap'>
              {/* Move to Tier (Draft mode) */}
              {!isFinalized && (
                <div className='flex items-center gap-2 border-r border-border pr-4'>
                  <span className='text-[10px] font-extrabold uppercase text-muted tracking-wider'>Tier:</span>
                  <select
                    value={bulkTargetTier}
                    onChange={(e) => setBulkTargetTier(e.target.value)}
                    className='text-xs font-bold bg-background border border-border rounded-xl px-2.5 py-1.5 text-text focus:outline-none cursor-pointer'
                  >
                    <option value=''>-- Select Tier --</option>
                    {allColumns.map(col => (
                      <option key={col} value={col}>
                        {col === "Unassigned" ? "Unassigned Roster" : `${col} Tier`}
                      </option>
                    ))}
                  </select>

                  <Button
                    variant='primary'
                    size='sm'
                    disabled={!bulkTargetTier}
                    onClick={() => handleBulkMove(bulkTargetTier)}
                    className='flex items-center gap-1 font-bold text-xs bg-primary hover:bg-primary/90 text-white'
                  >
                    <ArrowRightLeft size={14} />
                    <span>Move Tier</span>
                  </Button>
                </div>
              )}

              {/* Place on Permanent Team */}
              <div className='flex items-center gap-2'>
                <span className='text-[10px] font-extrabold uppercase text-muted tracking-wider'>Team:</span>
                <select
                  value={bulkTargetTeamId}
                  onChange={(e) => setBulkTargetTeamId(e.target.value)}
                  className='text-xs font-bold bg-background border border-border rounded-xl px-2.5 py-1.5 text-text focus:outline-none cursor-pointer'
                >
                  <option value=''>-- Assign Permanent Team --</option>
                  <option value='unassign'>Unassigned Team</option>
                  {(seasonTeams || []).map((st: any) => (
                    <option key={st.id} value={st.id}>
                      {st.teams?.name} ({st.season_age_groups?.age_groups?.name || ""})
                    </option>
                  ))}
                </select>

                <Button
                  variant='primary'
                  size='sm'
                  disabled={!bulkTargetTeamId}
                  onClick={handleBulkAssignTeam}
                  className='flex items-center gap-1 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white border-none'
                >
                  <Shirt size={14} />
                  <span>Place on Team</span>
                </Button>
              </div>

              <button
                onClick={() => {
                  setSelectedPlayerIds(new Set());
                  setBulkTargetTier("");
                  setBulkTargetTeamId("");
                }}
                className='text-xs font-bold text-muted hover:text-text flex items-center gap-1 p-1 cursor-pointer'
              >
                <X size={14} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}

        {/* Finalization status alert */}
        {isFinalized && (
          <div className='bg-red-500/10 border border-red-500/20 p-3 rounded-2xl flex items-center justify-between gap-3 text-red-600 text-xs font-bold print:border-red-600'>
            <div className='flex items-center gap-3'>
              <Lock size={18} />
              <div>
                <span className='block text-xs font-extrabold'>Rankings Finalized & Locked</span>
                <span className='block text-[10px] font-bold text-muted mt-0.5'>
                  Finalized by {finalizedBy} on {new Date(finalizedAt).toLocaleString()}
                </span>
              </div>
            </div>

            {isCoordinator && (
              <Button
                onClick={() => setShowUnlockModal(true)}
                variant='outline'
                size='xs'
                className='bg-surface border-red-500/30 text-red-600 hover:bg-red-500/10 font-bold'
              >
                Unlock Rankings
              </Button>
            )}
          </div>
        )}

        {/* Mobile / Tap selection indicator banner */}
        {selectedPlayerId !== null && !isFinalized && (
          <div className='bg-primary/10 border border-primary/20 p-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-primary animate-fadeIn'>
            <span>Player Selected. Tap any Tier column container or header to move them.</span>
            <button 
              onClick={() => setSelectedPlayerId(null)}
              className='underline text-[10px] text-muted hover:text-text cursor-pointer'
            >
              Cancel Selection
            </button>
          </div>
        )}
      </div>

      {/* Print-only Header */}
      <div className='hidden print:block mb-6 border-b pb-4'>
        <h1 className='text-2xl font-bold'>{event.name} — Placement Rankings List</h1>
        <p className='text-sm text-gray-600 mt-1'>
          Finalized Status: {isFinalized ? `Finalized by ${finalizedBy} on ${new Date(finalizedAt).toLocaleDateString()}` : "Draft rankings"}
        </p>
      </div>

      {/* Main rankings columns grid (Scrolls vertically inside columns, header stays stationary) */}
      <div className='flex gap-6 overflow-x-auto pb-2 custom-scrollbar flex-1 min-h-0 items-stretch w-full'>
        {allColumns.map((colName: string, colIdx: number) => {
          const isUnassigned = colName === "Unassigned" || colName === "Unassigned Team";
          const sortedList = getPlayersForColumn(colName);
          const colSort = columnSorts[colName] || { key: "rank", direction: "asc" };
          const allColSelected = sortedList.length > 0 && sortedList.every(p => selectedPlayerIds.has(p.playerId));
          
          return (
            <div 
              key={colName}
              onDragOver={handleDragOver}
              onDrop={(e) => handleColumnDrop(e, colName)}
              onClick={() => handleColumnClick(colName)}
              className={`flex flex-col bg-surface/40 border rounded-2xl p-4 space-y-4 min-w-[310px] max-w-[360px] flex-1 transition-all ${
                isUnassigned 
                  ? "border-primary/20 bg-primary/[0.02]" 
                  : "border-border"
              } ${
                selectedPlayerId !== null ? "hover:border-primary cursor-pointer ring-2 ring-primary/20" : ""
              } print:border-gray-300 print:bg-white`}
            >
              {/* Header */}
              <div className='flex flex-col gap-2 border-b border-border pb-3 shrink-0'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    {!isFinalized && sortedList.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAllColumn(sortedList);
                        }}
                        className='text-muted hover:text-primary transition-colors cursor-pointer'
                        title={allColSelected ? "Deselect All in Column" : "Select All in Column"}
                      >
                        {allColSelected ? (
                          <CheckSquare size={16} className='text-primary' />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    )}
                    <h3 className='font-extrabold text-sm text-text flex items-center gap-1.5'>
                      {isUnassigned ? (
                        <UserX size={16} className='text-primary' />
                      ) : (
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          colIdx === 1 ? "bg-amber-400" : colIdx === 2 ? "bg-blue-400" : "bg-zinc-400"
                        }`} />
                      )}
                      {isUnassigned ? "Unassigned" : `${colName} Tier`}
                    </h3>
                  </div>

                  <span className='text-[10px] font-bold text-muted'>
                    {sortedList.length} {sortedList.length === 1 ? "Player" : "Players"}
                  </span>
                </div>

                {/* Reusable SortControl for Column */}
                <div className='print:hidden' onClick={(e) => e.stopPropagation()}>
                  <SortControl
                    options={sortOptions}
                    sortKey={colSort.key}
                    sortDirection={colSort.direction}
                    onSortChange={(k, d) => setColumnSorts(prev => ({ ...prev, [colName]: { key: k, direction: d } }))}
                    label=''
                    size='xs'
                    className='w-full justify-between bg-background'
                  />
                </div>
              </div>

              {/* Scrollable list & Drop zone */}
              <div className='flex-1 space-y-2.5 min-h-[35vh] overflow-y-auto max-h-[60vh] custom-scrollbar p-1'>
                {sortedList.length === 0 ? (
                  <div className='text-center py-16 text-xs text-muted/40 font-bold border border-dashed border-border/30 rounded-xl flex flex-col items-center justify-center gap-2'>
                    <span>No players in {isUnassigned ? "unassigned roster" : `${colName} tier`}.</span>
                    {!isFinalized && (
                      <span className='text-[10px] text-muted/30 font-normal'>
                        Drag & drop players here to place them.
                      </span>
                    )}
                  </div>
                ) : (
                  sortedList.map((p) => {
                    const isCardSelected = selectedPlayerIds.has(p.playerId);
                    const isTapSelected = selectedPlayerId === p.playerId;

                    return (
                      <div
                        key={p.playerId}
                        draggable={!isFinalized}
                        onDragStart={(e) => handleDragStart(e, p.playerId, colName)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleCardDrop(e, p.playerId, colName)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayerTap(p.playerId);
                        }}
                        className={`p-3 bg-surface border rounded-xl flex items-center justify-between gap-3 shadow-xs select-none transition-all ${
                          isCardSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : isTapSelected
                            ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                            : "border-border hover:border-primary/40"
                        } ${
                          !isFinalized ? "cursor-grab active:cursor-grabbing" : ""
                        } print:border-gray-300 print:shadow-none`}
                      >
                        <div className='flex items-center gap-2 min-w-0'>
                          {/* Drag handle for desktop */}
                          {!isFinalized && (
                            <span className='cursor-grab active:cursor-grabbing text-muted hover:text-text p-0.5 print:hidden' title='Drag to reorder'>
                              <GripVertical size={14} />
                            </span>
                          )}

                          {/* Checkbox for Bulk Selection */}
                          {!isFinalized && (
                            <button
                              onClick={(e) => handleToggleSelectPlayer(p.playerId, e)}
                              className='text-muted hover:text-primary transition-colors cursor-pointer shrink-0'
                            >
                              {isCardSelected ? (
                                <CheckSquare size={16} className='text-primary' />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          )}

                          {/* Editable Rank Input + Touch Up/Down Buttons */}
                          {isUnassigned ? (
                            <span className='w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 border bg-surface text-muted border-border'>
                              -
                            </span>
                          ) : (
                            <div className='flex items-center gap-1 shrink-0' onClick={(e) => e.stopPropagation()}>
                              <input
                                type='number'
                                min='1'
                                max={sortedList.length}
                                disabled={isFinalized}
                                value={p.rank || ""}
                                onChange={(e) => handleJumpToRank(p.playerId, colName, e.target.value)}
                                className='w-10 px-1 py-0.5 text-center text-xs font-black bg-background border border-primary/30 text-primary rounded-lg focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60'
                                title='Type rank number to jump position'
                              />
                              {!isFinalized && (
                                <div className='flex flex-col gap-0.5 print:hidden'>
                                  <button
                                    type='button'
                                    onClick={() => handleMoveRankByStep(p.playerId, colName, -1)}
                                    className='w-4 h-3.5 flex items-center justify-center bg-background hover:bg-surface border border-border rounded text-[9px] font-extrabold text-muted hover:text-primary transition-all'
                                    title='Move Rank Up'
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type='button'
                                    onClick={() => handleMoveRankByStep(p.playerId, colName, 1)}
                                    className='w-4 h-3.5 flex items-center justify-center bg-background hover:bg-surface border border-border rounded text-[9px] font-extrabold text-muted hover:text-primary transition-all'
                                    title='Move Rank Down'
                                  >
                                    ▼
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div className='min-w-0'>
                            <span className='block text-base font-extrabold text-text truncate'>
                              {p.firstName} {p.lastName}
                            </span>
                            <span className='block text-[10px] font-bold text-muted mt-0.5 truncate'>
                              Tryout #{p.tryoutNumber || "N/A"} • Pos: {p.position || "N/A"}
                            </span>

                            <div className='flex items-center gap-1.5 mt-1 flex-wrap'>
                              {p.teamName ? (
                                <span className='inline-flex items-center gap-1 text-[9px] font-extrabold bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded border border-blue-500/20'>
                                  <Shirt size={10} /> {p.teamName}
                                </span>
                              ) : (
                                <span className='inline-flex items-center gap-1 text-[9px] font-semibold text-muted/60 bg-surface border border-border px-1.5 py-0.5 rounded'>
                                  No Team
                                </span>
                              )}

                              {isCoordinator && (
                                <select
                                  value={p.seasonTeamId || ""}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const val = e.target.value;
                                    handleSingleAssignTeam(p.seasonPlayerId, val ? Number(val) : null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className='text-[9px] font-bold bg-background border border-border rounded px-1 py-0.5 text-text focus:outline-none cursor-pointer'
                                >
                                  <option value=''>-- Team --</option>
                                  {(seasonTeams || []).map((st: any) => (
                                    <option key={st.id} value={st.id}>
                                      {st.teams?.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className='flex items-center gap-1.5 shrink-0'>
                          <span className='text-[10px] font-extrabold bg-accent/10 text-accent px-1.5 py-0.5 rounded border border-accent/20'>
                            {p.rating ? p.rating.toFixed(1) : "0.0"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Finalize Confirmation Modal */}
      <Modal
        isOpen={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        title='Finalize Event Placement Rankings'
        size='md'
        footer={
          <>
            <Button 
              variant='outline' 
              size='sm' 
              onClick={() => setShowFinalizeModal(false)}
            >
              Cancel
            </Button>
            <Button 
              variant='primary' 
              size='sm' 
              onClick={confirmFinalize}
              disabled={isPending}
              className='bg-accent hover:bg-accent-hover text-white border-none'
            >
              {isPending ? "Finalizing..." : "Finalize Placement Ranks"}
            </Button>
          </>
        }
      >
        <p className='text-sm font-medium text-text leading-relaxed'>
          Are you sure you want to finalize event placement rankings? This will lock all rankings and allow placing players onto teams.
        </p>
      </Modal>

      {/* Custom Unlock Confirmation Modal */}
      <Modal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        title='Unlock Placement Rankings'
        size='md'
        footer={
          <>
            <Button 
              variant='outline' 
              size='sm' 
              onClick={() => setShowUnlockModal(false)}
            >
              Cancel
            </Button>
            <Button 
              variant='primary' 
              size='sm' 
              onClick={confirmUnlock}
              disabled={isPending}
              className='bg-amber-600 hover:bg-amber-700 text-white border-none'
            >
              {isPending ? "Unlocking..." : "Unlock Placement Ranks"}
            </Button>
          </>
        }
      >
        <p className='text-sm font-medium text-text leading-relaxed'>
          Are you sure you want to unlock event placement rankings? This will allow coaches to edit and re-order rankings again.
        </p>
      </Modal>

      {/* Event Ranking Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title='Event Ranking Settings & Custom Tiers'
        size='md'
        footer={
          <>
            <Button 
              variant='outline' 
              size='sm' 
              onClick={() => setShowSettingsModal(false)}
            >
              Cancel
            </Button>
            <Button 
              variant='primary' 
              size='sm' 
              onClick={handleSaveSettings}
              disabled={isPending}
            >
              Save Settings
            </Button>
          </>
        }
      >
        <div className='space-y-4 text-xs font-bold text-text'>
          <div>
            <label className='block text-muted mb-1 uppercase tracking-wider text-[10px]'>Rating Scale Direction</label>
            <select
              value={settingsRatingDir}
              onChange={(e) => setSettingsRatingDir(e.target.value as any)}
              className='w-full bg-background border border-border rounded-lg p-2 text-xs font-bold text-text focus:outline-none'
            >
              <option value='high_is_best'>10 is Highest Score (Traditional 1-10)</option>
              <option value='low_is_best'>1 is Highest Score (Rank 1 / Lowest Number is Best)</option>
            </select>
          </div>

          <div>
            <label className='block text-muted mb-1 uppercase tracking-wider text-[10px]'>Custom Tiers (Comma-separated)</label>
            <input
              type='text'
              value={settingsTiersInput}
              onChange={(e) => setSettingsTiersInput(e.target.value)}
              placeholder='e.g., Gold, Competitive, Development or Tier 1, Tier 2, Tier 3'
              className='w-full bg-background border border-border rounded-lg p-2 text-xs font-bold text-text focus:outline-none'
            />
            <span className='block text-[10px] font-normal text-muted mt-1'>
              Define the tier column names for this event. Default: Gold, Competitive, Development.
            </span>
          </div>
        </div>
      </Modal>

    </div>
  );
}
