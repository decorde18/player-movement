"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { 
  getTeamsForPlacement, 
  assignPlayerToTeam, 
  bulkAssignPlayersToTeam,
  createTeamForAgeGroup
} from "./actions";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import FilterBar from "@/components/ui/FilterBar";
import SortControl from "@/components/ui/SortControl";
import { 
  Loader2, 
  ArrowLeft, 
  Shirt, 
  UserX, 
  Users, 
  CheckSquare, 
  Square, 
  ArrowRightLeft, 
  X,
  HelpCircle,
  Plus,
  Trophy,
  Star,
  Mail
} from "lucide-react";
import { toast } from "sonner";
import { smartCompare } from "@/lib/utils/smartSort";
import { STANDARD_POSITIONS } from "@/lib/utils/positionPresets";

export default function StandaloneTeamPlacementPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<number | undefined>(undefined);
  const [playersList, setPlayersList] = useState<any[]>([]);

  // Modal for team creation
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Sorting state per team column: Record<colKey, { key: string, direction: "asc" | "desc" }>
  const [columnSorts, setColumnSorts] = useState<Record<string, { key: string; direction: "asc" | "desc" }>>({});

  // Global Roster Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [ratingRangeFilter, setRatingRangeFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Bulk Selection State
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [bulkTargetTeamId, setBulkTargetTeamId] = useState<string>("");

  // Drag states
  const [draggedPlayerId, setDraggedPlayerId] = useState<number | null>(null);

  // Mobile/Tap selection state
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  const loadData = async (agId?: number) => {
    try {
      setLoading(true);
      const res = await getTeamsForPlacement(agId);
      setData(res);
      setSelectedAgeGroupId(res.selectedAgeGroupId);
      setPlayersList(res.seasonPlayers || []);
      setSelectedPlayerIds(new Set());
    } catch (e: any) {
      toast.error(e.message || "Failed to load team placement board.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAgeGroupChange = (agId: number) => {
    loadData(agId);
  };

  const handleCreateTeam = async () => {
    if (!selectedAgeGroupId || !newTeamName.trim()) {
      toast.error("Please enter a valid team name.");
      return;
    }

    setCreatingTeam(true);
    try {
      const res = await createTeamForAgeGroup(selectedAgeGroupId, newTeamName);
      if (res.success) {
        toast.success(`Team "${newTeamName.trim()}" created successfully!`);
        setNewTeamName("");
        setShowCreateTeamModal(false);
        await loadData(selectedAgeGroupId);
      } else {
        toast.error(res.error || "Failed to create team.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error creating team.");
    } finally {
      setCreatingTeam(false);
    }
  };

  // Bulk Checkbox Toggles
  const handleToggleSelectPlayer = (seasonPlayerId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(seasonPlayerId)) {
        next.delete(seasonPlayerId);
      } else {
        next.add(seasonPlayerId);
      }
      return next;
    });
  };

  const handleSelectAllColumn = (playersList: any[]) => {
    const allSelected = playersList.every(p => selectedPlayerIds.has(p.id));
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      playersList.forEach(p => {
        if (allSelected) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      });
      return next;
    });
  };

  const handleBulkMove = (targetTeamIdStr: string) => {
    if (selectedPlayerIds.size === 0 || !targetTeamIdStr) return;

    const teamIdVal = targetTeamIdStr === "unassign" ? null : Number(targetTeamIdStr);
    const selectedArray = Array.from(selectedPlayerIds);

    startTransition(async () => {
      const res = await bulkAssignPlayersToTeam(selectedArray, teamIdVal);
      if (res.success) {
        toast.success(`Moved ${selectedArray.length} players.`);
        loadData(selectedAgeGroupId);
      } else {
        toast.error(res.error || "Failed to move players.");
      }
    });
  };

  // Reordering drag & drop logic
  const handleDragStart = (e: React.DragEvent, seasonPlayerId: number) => {
    setDraggedPlayerId(seasonPlayerId);
    e.dataTransfer.setData("text/plain", seasonPlayerId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleColumnDrop = (e: React.DragEvent, targetTeamId: number | null) => {
    e.preventDefault();
    const sourceId = Number(e.dataTransfer.getData("text/plain") || draggedPlayerId);
    if (!sourceId) return;

    movePlayerToTeam(sourceId, targetTeamId);
  };

  const movePlayerToTeam = (seasonPlayerId: number, targetTeamId: number | null) => {
    startTransition(async () => {
      // Optimistic local update
      setPlayersList(prev => prev.map(p => p.id === seasonPlayerId ? { ...p, season_team_id: targetTeamId } : p));
      const res = await assignPlayerToTeam(seasonPlayerId, targetTeamId);
      if (res.success) {
        toast.success("Player team assignment updated.");
      } else {
        toast.error(res.error || "Failed to update team.");
        loadData(selectedAgeGroupId);
      }
    });
    setDraggedPlayerId(null);
    setSelectedPlayerId(null);
  };

  // Tap-to-Select Fallback
  const handlePlayerTap = (seasonPlayerId: number) => {
    if (selectedPlayerId === seasonPlayerId) {
      setSelectedPlayerId(null);
    } else {
      setSelectedPlayerId(seasonPlayerId);
      toast.info("Player selected. Tap any team column to move them.");
    }
  };

  const handleColumnClick = (targetTeamId: number | null) => {
    if (selectedPlayerId !== null) {
      movePlayerToTeam(selectedPlayerId, targetTeamId);
    }
  };

  if (loading || !data) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center gap-3 text-text'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading Team Placement Board...</span>
      </div>
    );
  }

  const { seasonAgeGroups, seasonTeams } = data;

  const currentAgeGroup = seasonAgeGroups.find((sag: any) => sag.id === selectedAgeGroupId);

  // Predicate filter helper
  const matchesFilter = (sp: any) => {
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const fullName = `${sp.players?.first_name} ${sp.players?.last_name}`.toLowerCase();
      const tryout = (sp.tryout_number || "").toString().toLowerCase();
      if (!fullName.includes(q) && !tryout.includes(q)) return false;
    }

    if (positionFilter !== "all") {
      const posVal = (sp.position || "").trim();
      if (posVal !== positionFilter && !posVal.startsWith(`${positionFilter} `) && !posVal.startsWith(`${positionFilter}-`)) {
        return false;
      }
    }

    if (tierFilter !== "all") {
      if (sp.eventTier !== tierFilter) return false;
    }

    if (ratingRangeFilter === "unrated") {
      const ratVal = sp.rating || 0;
      if (ratVal > 0) return false;
    } else if (ratingRangeFilter.startsWith("score_")) {
      const targetScore = parseInt(ratingRangeFilter.replace("score_", ""), 10);
      const ratVal = sp.rating || 0;
      if (Math.floor(ratVal) !== targetScore) return false;
    }

    return true;
  };

  const getPlayersForTeam = (seasonTeamId: number | null, teamColKey: string) => {
    const list = playersList.filter(sp => (sp.season_team_id || null) === seasonTeamId && matchesFilter(sp));
    const sortConfig = columnSorts[teamColKey] || { key: "rank", direction: "asc" };
    const { key, direction } = sortConfig;

    return [...list].sort((a, b) => {
      if (key === "rank") {
        const TIER_ORDER: Record<string, number> = {
          "Gold": 1,
          "Competitive": 2,
          "Development": 3,
          "Silver": 4,
          "Bronze": 5,
        };

        const getTierPriority = (t: string | null): number => {
          if (!t) return 999;
          return TIER_ORDER[t] ?? 500;
        };

        const tierA = getTierPriority(a.eventTier);
        const tierB = getTierPriority(b.eventTier);

        // 1. Sort by Tier order first (Gold > Competitive > Development...)
        if (tierA !== tierB) {
          return direction === "asc" ? tierA - tierB : tierB - tierA;
        }

        // 2. Sort by Rank # within the same Tier
        const rankA = a.eventRank !== null && a.eventRank !== undefined ? a.eventRank : 999;
        const rankB = b.eventRank !== null && b.eventRank !== undefined ? b.eventRank : 999;
        return direction === "asc" ? rankA - rankB : rankB - rankA;
      }
      if (key === "name") {
        const nameA = `${a.players?.last_name} ${a.players?.first_name}`.toLowerCase();
        const nameB = `${b.players?.last_name} ${b.players?.first_name}`.toLowerCase();
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
        return smartCompare(a.tryout_number, b.tryout_number, direction);
      }
      return 0;
    });
  };

  const sortOptions = [
    { value: "rank", label: "Event Tier & Rank #" },
    { value: "rating", label: "Rating" },
    { value: "name", label: "Name" },
    { value: "tryout", label: "Tryout #" },
    { value: "position", label: "Position" },
  ];

  // Dynamic tier options computed from players list
  const activeTiersList = Array.from(
    new Set(
      playersList
        .map((sp: any) => sp.eventTier)
        .filter((t: string | null): t is string => Boolean(t))
    )
  );

  // Dynamic rating options computed from players list
  const activeRatingsList = playersList
    .map((sp: any) => sp.rating || 0)
    .filter((r: number) => r > 0);

  const ratingRangeFilterOptions = [
    { value: "all", label: "All Ratings" },
    { value: "unrated", label: "Unrated Only" },
    ...Array.from<number>(new Set(activeRatingsList.map((r: number) => Math.floor(r))))
      .sort((a, b) => b - a)
      .map((score: number) => {
        const count = activeRatingsList.filter((r: number) => Math.floor(r) === score).length;
        return {
          value: `score_${score}`,
          label: `Score ${score}.0 - ${score}.9 (${count})`
        };
      })
  ];

  const filterGroups = [
    {
      id: "tier",
      label: "Tier",
      value: tierFilter,
      options: [
        { value: "all", label: "All Tiers" },
        ...activeTiersList.map(t => ({ value: t, label: `Tier: ${t}` }))
      ],
      onChange: setTierFilter,
    },
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
      value: ratingRangeFilter,
      options: ratingRangeFilterOptions,
      onChange: setRatingRangeFilter,
    },
  ];

  const handleResetFilters = () => {
    setSearchQuery("");
    setPositionFilter("all");
    setRatingRangeFilter("all");
    setTierFilter("all");
    setSelectedPlayerIds(new Set());
  };

  // Build team columns: Unassigned (null) + seasonTeams
  const columns = [
    { id: null, key: "unassigned", name: "Unassigned Roster" },
    ...seasonTeams.map((st: any) => ({
      id: st.id,
      key: `team_${st.id}`,
      name: st.teams?.name || "Unnamed Team"
    }))
  ];

  return (
    <div className='w-full flex-1 flex flex-col min-h-0 animate-fadeIn relative space-y-4 pb-2'>
      
      {/* Stationary Top Controls Group */}
      <div className='shrink-0 space-y-4'>
        {/* Top Header & Age Group Selector */}
        <div className='flex flex-wrap items-center justify-between gap-4 bg-surface/60 border border-border p-4 rounded-2xl shadow-sm backdrop-blur-md'>
          <div className='flex items-center gap-3'>
            <Link
              href={`/admin/events`}
              className='p-2 rounded-lg border border-border bg-background text-muted hover:text-text transition-all cursor-pointer'
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <span className='text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full border border-blue-500/20'>
                Permanent Team Placement Board
              </span>
              <h1 className='text-xl font-extrabold text-text mt-0.5 flex items-center gap-2'>
                <Shirt className='text-blue-500' size={20} />
                Team Roster Management
              </h1>
            </div>
          </div>

          <div className='flex items-center gap-3 flex-wrap'>
            <div className='flex items-center gap-2'>
              <span className='text-xs font-bold text-muted uppercase tracking-wider'>Age Group:</span>
              <select
                value={selectedAgeGroupId || ""}
                onChange={(e) => handleAgeGroupChange(Number(e.target.value))}
                className='text-xs font-extrabold bg-background border border-border rounded-xl px-3 py-2 text-text focus:outline-none cursor-pointer'
              >
                {seasonAgeGroups.map((sag: any) => (
                  <option key={sag.id} value={sag.id}>
                    {sag.name} ({sag.gender}) — {sag.age_groups?.name || ""}
                  </option>
                ))}
              </select>
            </div>

            <Link href='/admin/invitations'>
              <Button
                variant='outline'
                size='sm'
                className='flex items-center gap-1.5 font-bold text-xs border-purple-500/30 text-purple-600 hover:bg-purple-500/10'
              >
                <Mail size={15} />
                <span>Invitations & Uniforms</span>
              </Button>
            </Link>

            <Button
              onClick={() => setShowCreateTeamModal(true)}
              variant='primary'
              size='sm'
              className='flex items-center gap-1.5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white border-none'
            >
              <Plus size={15} />
              <span>Create Team</span>
            </Button>
          </div>
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
          <div className='sticky top-0 z-40 bg-surface/95 border-2 border-primary/40 shadow-2xl p-4 rounded-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4 animate-slideUp'>
            <div className='flex items-center gap-2 text-xs font-bold text-text'>
              <span className='w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black'>
                {selectedPlayerIds.size}
              </span>
              <span>Player{selectedPlayerIds.size > 1 ? "s" : ""} Selected for Team Assignment</span>
            </div>

            <div className='flex items-center gap-3 flex-wrap'>
              <div className='flex items-center gap-2'>
                <span className='text-[10px] font-extrabold uppercase text-muted tracking-wider'>Assign to Team:</span>
                <select
                  value={bulkTargetTeamId}
                  onChange={(e) => setBulkTargetTeamId(e.target.value)}
                  className='text-xs font-bold bg-background border border-border rounded-xl px-3 py-1.5 text-text focus:outline-none cursor-pointer'
                >
                  <option value=''>-- Select Destination Team --</option>
                  <option value='unassign'>Unassigned Roster</option>
                  {seasonTeams.map((st: any) => (
                    <option key={st.id} value={st.id.toString()}>
                      {st.teams?.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                variant='primary'
                size='sm'
                disabled={!bulkTargetTeamId}
                onClick={() => handleBulkMove(bulkTargetTeamId)}
                className='flex items-center gap-1.5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white border-none'
              >
                <Shirt size={14} />
                <span>Move to Team</span>
              </Button>

              <button
                onClick={() => setSelectedPlayerIds(new Set())}
                className='text-xs font-bold text-muted hover:text-text flex items-center gap-1 p-1 cursor-pointer'
              >
                <X size={14} />
                <span>Clear Selection</span>
              </button>
            </div>
          </div>
        )}

        {/* Helper Banner */}
        <Card className='p-3 bg-surface/50 border-border flex items-center justify-between gap-3 text-xs text-muted font-medium'>
          <div className='flex items-center gap-2.5'>
            <HelpCircle size={18} className='text-blue-500 shrink-0' />
            <span>
              Drag & drop players between permanent team columns or use checkboxes for bulk team assignments. Player cards display both Rating and Event Rank to inform team placement decisions.
            </span>
          </div>
          <span className='text-[10px] font-extrabold uppercase bg-surface px-2.5 py-1 rounded-full border border-border shrink-0'>
            {playersList.length} Registered Players
          </span>
        </Card>
      </div>

      {/* Team Columns Grid (Scrolls vertically inside columns, header stays stationary) */}
      <div className='flex gap-6 overflow-x-auto pb-2 custom-scrollbar flex-1 min-h-0 items-stretch w-full'>
        {columns.map((col, colIdx) => {
          const isUnassigned = col.id === null;
          const sortedList = getPlayersForTeam(col.id, col.key);
          const colSort = columnSorts[col.key] || { key: "rank", direction: "asc" };
          const allColSelected = sortedList.length > 0 && sortedList.every(p => selectedPlayerIds.has(p.id));

          return (
            <div
              key={col.key}
              onDragOver={handleDragOver}
              onDrop={(e) => handleColumnDrop(e, col.id)}
              onClick={() => handleColumnClick(col.id)}
              className={`flex flex-col bg-surface/40 border rounded-2xl p-4 space-y-4 min-w-[320px] max-w-[360px] flex-1 transition-all ${
                isUnassigned 
                  ? "border-primary/20 bg-primary/[0.02]" 
                  : "border-border hover:border-blue-500/40"
              } ${
                selectedPlayerId !== null ? "hover:border-blue-500 cursor-pointer ring-2 ring-blue-500/20" : ""
              }`}
            >
              {/* Header */}
              <div className='flex flex-col gap-2 border-b border-border pb-3 shrink-0'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    {sortedList.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAllColumn(sortedList);
                        }}
                        className='text-muted hover:text-blue-500 transition-colors cursor-pointer'
                        title={allColSelected ? "Deselect All in Column" : "Select All in Column"}
                      >
                        {allColSelected ? (
                          <CheckSquare size={16} className='text-blue-500' />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    )}

                    <h3 className='font-extrabold text-sm text-text flex items-center gap-1.5'>
                      {isUnassigned ? (
                        <UserX size={16} className='text-primary' />
                      ) : (
                        <Shirt size={16} className='text-blue-500' />
                      )}
                      {col.name}
                    </h3>
                  </div>

                  <span className='text-[10px] font-bold text-muted'>
                    {sortedList.length} {sortedList.length === 1 ? "Player" : "Players"}
                  </span>
                </div>

                {/* Column SortControl */}
                <div className='print:hidden' onClick={(e) => e.stopPropagation()}>
                  <SortControl
                    options={sortOptions}
                    sortKey={colSort.key}
                    sortDirection={colSort.direction}
                    onSortChange={(k, d) => setColumnSorts(prev => ({ ...prev, [col.key]: { key: k, direction: d } }))}
                    label=''
                    size='xs'
                    className='w-full justify-between bg-background'
                  />
                </div>
              </div>

              {/* Scrollable Player List */}
              <div className='flex-1 space-y-2.5 min-h-[35vh] overflow-y-auto max-h-[60vh] custom-scrollbar p-1'>
                {sortedList.length === 0 ? (
                  <div className='text-center py-16 text-xs text-muted/40 font-bold border border-dashed border-border/30 rounded-xl flex flex-col items-center justify-center gap-2'>
                    <span>No players in {isUnassigned ? "unassigned roster" : col.name}.</span>
                    <span className='text-[10px] text-muted/30 font-normal'>
                      Drag & drop players here to assign them.
                    </span>
                  </div>
                ) : (
                  sortedList.map((sp) => {
                    const isCardSelected = selectedPlayerIds.has(sp.id);
                    const isTapSelected = selectedPlayerId === sp.id;

                    return (
                      <div
                        key={sp.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, sp.id)}
                        onDragOver={handleDragOver}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayerTap(sp.id);
                        }}
                        className={`p-3 bg-surface border rounded-xl flex items-center justify-between gap-3 shadow-xs select-none transition-all cursor-grab active:cursor-grabbing ${
                          isCardSelected
                            ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                            : isTapSelected
                            ? "border-blue-500 ring-2 ring-blue-500/40 bg-blue-50/5"
                            : "border-border hover:border-blue-500/40"
                        }`}
                      >
                        <div className='flex items-center gap-2.5 min-w-0'>
                          {/* Checkbox for Bulk Selection */}
                          <button
                            onClick={(e) => handleToggleSelectPlayer(sp.id, e)}
                            className='text-muted hover:text-blue-500 transition-colors cursor-pointer shrink-0'
                          >
                            {isCardSelected ? (
                              <CheckSquare size={16} className='text-blue-500' />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>

                          <div className='min-w-0'>
                            <span className='block text-xs font-bold text-text truncate'>
                              {sp.players?.last_name}, {sp.players?.first_name}
                            </span>
                            <span className='block text-[10px] font-bold text-muted mt-0.5 truncate'>
                              Tryout #{sp.tryout_number || "N/A"} • Pos: {sp.position || "N/A"}
                            </span>
                          </div>
                        </div>

                        {/* Player Metrics Badges: Rating + Event Rank & Tier */}
                        <div className='flex flex-col items-end gap-1 shrink-0'>
                          <span className='text-[10px] font-extrabold bg-accent/10 text-accent px-1.5 py-0.5 rounded border border-accent/20'>
                            {sp.rating ? sp.rating.toFixed(1) : "0.0"}
                          </span>
                          {sp.eventRank !== null && sp.eventRank !== undefined && (
                            <span 
                              className='inline-flex items-center gap-1 text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20'
                              title={`Event: ${sp.eventName || 'Ranking Event'}`}
                            >
                              <Trophy size={10} /> #{sp.eventRank} {sp.eventTier ? `(${sp.eventTier})` : ""}
                            </span>
                          )}
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

      {/* Modal for Creating New Permanent Team */}
      <Modal
        isOpen={showCreateTeamModal}
        onClose={() => setShowCreateTeamModal(false)}
        title={`Create Team for ${currentAgeGroup?.name || 'Age Group'}`}
        size='md'
        footer={
          <>
            <Button 
              variant='outline' 
              size='sm' 
              onClick={() => setShowCreateTeamModal(false)}
            >
              Cancel
            </Button>
            <Button 
              variant='primary' 
              size='sm' 
              onClick={handleCreateTeam}
              disabled={creatingTeam || !newTeamName.trim()}
              className='bg-blue-600 hover:bg-blue-700 text-white border-none'
            >
              {creatingTeam ? "Creating..." : "Create Team"}
            </Button>
          </>
        }
      >
        <div className='space-y-4 text-xs font-bold text-text'>
          <div>
            <label className='block text-muted mb-1 uppercase tracking-wider text-[10px]'>Team Name</label>
            <input
              type='text'
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder='e.g., 2012 Boys Gold, 2012 Boys Premier'
              className='w-full bg-background border border-border rounded-xl p-2.5 text-xs font-bold text-text focus:outline-none focus:border-blue-500'
              autoFocus
            />
            <span className='block text-[10px] font-normal text-muted mt-1'>
              Creating this team will add a new team column to the placement board for {currentAgeGroup?.name || 'this age group'}.
            </span>
          </div>
        </div>
      </Modal>

    </div>
  );
}
