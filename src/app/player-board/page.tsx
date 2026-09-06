"use client";

import React, { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  getSelectorData, 
  getBoardData, 
  createField, 
  renameField, 
  deleteField, 
  carryOverPreviousSession,
  savePlacements,
  getPlayerSessionHistory
} from "./actions";
import Modal from "@/components/ui/Modal";
import { toast } from "sonner";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Users, 
  Grid, 
  RefreshCw,
  Loader2,
  MapPin,
  Check,
  Save,
  Undo2,
  AlertTriangle,
  FileText,
  ArrowUpDown,
  Filter,
  CheckSquare,
  Square,
  ArrowRightLeft,
  Award,
  Star
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { smartCompare } from "@/lib/utils/smartSort";
import { STANDARD_POSITIONS } from "@/lib/utils/positionPresets";

export default function PlayerBoardPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Workspace Tab State: "checkin" | "rating" | "fields" | "ranking" | "placement"
  const [activeTab, setActiveTab] = useState<"checkin" | "rating" | "fields" | "ranking" | "placement">("checkin");

  // Selectors State
  const [selectors, setSelectors] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");

  // Board Data State
  const [boardData, setBoardData] = useState<any>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);

  // Local Placements Cache State (offline/rapid changes)
  const [localPlacements, setLocalPlacements] = useState<Record<number, number | null>>({});

  // Sorting columns State
  // Format: Record<fieldId | "unassigned", { key: "tryout_number" | "name" | "rating" | "rank" | "position", direction: "asc" | "desc" }>
  const [columnSorts, setColumnSorts] = useState<Record<string, { key: string; direction: "asc" | "desc" }>>({
    unassigned: { key: "tryout_number", direction: "asc" },
  });

  // Position & Rating Filters State
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [filterRating, setFilterRating] = useState<string>("all");

  // Bulk Checkbox Selection State
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());

  // Field Editing State
  const [newFieldName, setNewFieldName] = useState("");
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [editingFieldName, setEditingFieldName] = useState("");

  // Field Deletion Dialog State
  const [fieldToDelete, setFieldToDelete] = useState<{ id: number; name: string } | null>(null);

  // Mobile Tap Fallback State
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  // Notes Modal Popup State
  const [notePlayer, setNotePlayer] = useState<any | null>(null);
  const [noteHistory, setNoteHistory] = useState<any[]>([]);
  const [notePlayerNotes, setNotePlayerNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Custom Leave Confirmation Dialog State
  const [pendingLeaveUrl, setPendingLeaveUrl] = useState<string | null>(null);

  const pathname = usePathname();
  const router = useRouter();

  // Load Seasons and Events initially
  useEffect(() => {
    async function loadSelectors() {
      try {
        const data = await getSelectorData();
        setSelectors(data);
        if (data.seasons.length > 0) {
          setSelectedSeason(data.seasons[0].id.toString());
        }
      } catch (e: any) {
        toast.error("Failed to load selectors: " + e.message);
      }
    }
    loadSelectors();
  }, []);

  // Sync selectors
  const seasons = selectors?.seasons || [];
  const events = selectors?.events || [];
  const filteredEvents = events.filter((e: any) => e.seasonId === Number(selectedSeason));
  const activeEvent = filteredEvents.find((e: any) => e.id === Number(selectedEvent)) || filteredEvents[0];
  const sessions = activeEvent?.sessions || [];
  const divisions = activeEvent?.divisions || [];

  // Set default event when season changes
  useEffect(() => {
    if (filteredEvents.length > 0) {
      setSelectedEvent(filteredEvents[0].id.toString());
    } else {
      setSelectedEvent("");
    }
  }, [selectedSeason, selectors]);

  // Set default session and division when event changes
  useEffect(() => {
    if (activeEvent) {
      if (activeEvent.sessions.length > 0) {
        setSelectedSession(activeEvent.sessions[0].id.toString());
      } else {
        setSelectedSession("");
      }
      setSelectedDivision(""); // All divisions by default
    } else {
      setSelectedSession("");
      setSelectedDivision("");
    }
  }, [selectedEvent]);

  // Load Board Data
  const loadBoard = async () => {
    if (!selectedSession) {
      setBoardData(null);
      setLocalPlacements({});
      setSelectedPlayerIds(new Set());
      return;
    }
    setLoadingBoard(true);
    try {
      const data = await getBoardData(
        Number(selectedSession), 
        selectedDivision ? Number(selectedDivision) : undefined
      );
      setBoardData(data);
      setSelectedPlayerIds(new Set());

      // Check for saved local placements in localStorage
      const localSaved = localStorage.getItem(`player_board_placements_${selectedSession}`);
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          const initialPlacements: Record<number, number | null> = {};
          data.players.forEach((p: any) => {
            if (parsed[p.id] !== undefined) {
              initialPlacements[p.id] = parsed[p.id];
            } else {
              initialPlacements[p.id] = p.fieldId;
            }
          });
          setLocalPlacements(initialPlacements);
        } catch (err) {
          const initialPlacements: Record<number, number | null> = {};
          data.players.forEach((p: any) => {
            initialPlacements[p.id] = p.fieldId;
          });
          setLocalPlacements(initialPlacements);
        }
      } else {
        const initialPlacements: Record<number, number | null> = {};
        data.players.forEach((p: any) => {
          initialPlacements[p.id] = p.fieldId;
        });
        setLocalPlacements(initialPlacements);
      }
    } catch (e: any) {
      toast.error("Failed to load board: " + e.message);
    } finally {
      setLoadingBoard(false);
    }
  };

  useEffect(() => {
    loadBoard();
    setSelectedPlayerId(null);
  }, [selectedSession, selectedDivision]);

  // Warn on leave tab / browser refresh
  const getUnsavedPlacements = () => {
    if (!boardData || !boardData.players) return [];
    const unsaved: { playerId: number; fieldId: number | null }[] = [];
    boardData.players.forEach((p: any) => {
      const current = localPlacements[p.id];
      if (current !== undefined && current !== p.fieldId) {
        unsaved.push({ playerId: p.id, fieldId: current });
      }
    });
    return unsaved;
  };

  const unsavedList = getUnsavedPlacements();
  const hasUnsavedChanges = unsavedList.length > 0;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes on the Player Board. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Warn on custom router link exits (e.g. clicking links in NavBar)
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleAnchorClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }

      if (target && target.tagName === "A") {
        const href = target.getAttribute("href");
        if (href && !href.startsWith("#") && href !== pathname) {
          e.preventDefault();
          setPendingLeaveUrl(href);
        }
      }
    };

    document.addEventListener("click", handleAnchorClick, true);
    return () => document.removeEventListener("click", handleAnchorClick, true);
  }, [hasUnsavedChanges, pathname]);

  const confirmLeave = () => {
    localStorage.removeItem(`player_board_placements_${selectedSession}`);
    if (pendingLeaveUrl) {
      router.push(pendingLeaveUrl);
    }
    setPendingLeaveUrl(null);
  };

  // Local Placements updater
  const updateLocalPlacement = (playerId: number, targetFieldId: number | null) => {
    setLocalPlacements(prev => {
      const next = { ...prev, [playerId]: targetFieldId };
      localStorage.setItem(`player_board_placements_${selectedSession}`, JSON.stringify(next));
      return next;
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, playerId: number) => {
    e.dataTransfer.setData("text/plain", playerId.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetFieldId: number | null) => {
    e.preventDefault();
    const playerIdStr = e.dataTransfer.getData("text/plain");
    if (!playerIdStr) return;
    const playerId = Number(playerIdStr);
    updateLocalPlacement(playerId, targetFieldId);
  };

  // Mobile Tap Fallback Handler
  const handlePlayerTap = (playerId: number) => {
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
    } else {
      setSelectedPlayerId(playerId);
      toast.info("Player selected. Tap a field header or target to place them.");
    }
  };

  const handlePlacePlayer = (targetFieldId: number | null) => {
    if (selectedPlayerId === null) return;
    const playerId = selectedPlayerId;
    setSelectedPlayerId(null);
    updateLocalPlacement(playerId, targetFieldId);
  };

  // Create Field
  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) {
      toast.error("Please enter a field name first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createField(Number(selectedSession), newFieldName.trim());
      if (res.success) {
        toast.success(`Field "${newFieldName}" created`);
        setNewFieldName("");
        await loadBoard();
      } else {
        toast.error("Failed to create field");
      }
    } catch (err: any) {
      toast.error("Error creating field: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Rename Field
  const handleRenameField = async (fieldId: number) => {
    if (!editingFieldName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await renameField(fieldId, editingFieldName.trim());
      if (res.success) {
        toast.success("Field renamed");
        setEditingFieldId(null);
        await loadBoard();
      } else {
        toast.error("Failed to rename field");
      }
    } catch (err: any) {
      toast.error("Error renaming field: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Field (Confirmed via Modal dialog)
  const handleConfirmDeleteField = async () => {
    if (!fieldToDelete) return;
    const fieldId = fieldToDelete.id;

    setIsSubmitting(true);
    setLocalPlacements(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(pid => {
        if (next[Number(pid)] === fieldId) {
          next[Number(pid)] = null;
        }
      });
      localStorage.setItem(`player_board_placements_${selectedSession}`, JSON.stringify(next));
      return next;
    });

    try {
      const res = await deleteField(fieldId);
      if (res.success) {
        toast.success("Field deleted");
        setFieldToDelete(null);
        await loadBoard();
      } else {
        toast.error("Failed to delete field");
      }
    } catch (err: any) {
      toast.error("Error deleting field: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Carry Over previous session
  const handleCarryOver = async () => {
    if (!confirm("Carry over fields and player assignments from the previous session? Current setups will be overwritten/appended.")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await carryOverPreviousSession(Number(selectedSession));
      if (res.success) {
        toast.success("Carried over setups from previous session!");
        localStorage.removeItem(`player_board_placements_${selectedSession}`);
        await loadBoard();
      } else {
        toast.error(res.error || "Failed to carry over previous session");
      }
    } catch (err: any) {
      toast.error("Error carrying over session: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save changes to DB
  const handleSaveChanges = async () => {
    if (unsavedList.length === 0) return;

    setIsSubmitting(true);
    try {
      const res = await savePlacements(Number(selectedSession), unsavedList);
      if (res.success) {
        toast.success(`Successfully saved ${unsavedList.length} placements to database!`);
        localStorage.removeItem(`player_board_placements_${selectedSession}`);
        await loadBoard();
      } else {
        toast.error("Failed to save placements");
      }
    } catch (err: any) {
      toast.error("Error saving changes: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset Changes
  const handleResetChanges = () => {
    if (!confirm("Are you sure you want to discard your unsaved local placements?")) {
      return;
    }
    localStorage.removeItem(`player_board_placements_${selectedSession}`);
    if (boardData && boardData.players) {
      const initialPlacements: Record<number, number | null> = {};
      boardData.players.forEach((p: any) => {
        initialPlacements[p.id] = p.fieldId;
      });
      setLocalPlacements(initialPlacements);
      toast.success("Discarded local placements.");
    }
  };

  // Open note popup
  const handleOpenNotes = async (player: any) => {
    setNotePlayer(player);
    setLoadingNotes(true);
    try {
      const res = await getPlayerSessionHistory(Number(selectedEvent), player.id);
      setNoteHistory(res.history);
      setNotePlayerNotes(res.notes);
    } catch (err) {
      toast.error("Failed to load player session history.");
    } finally {
      setLoadingNotes(false);
    }
  };

  // Sorting handler
  const handleSortChange = (columnId: string, sortKey: string) => {
    setColumnSorts((prev) => {
      const current = prev[columnId];
      const direction = current && current.key === sortKey && current.direction === "asc" ? "desc" : "asc";
      return {
        ...prev,
        [columnId]: { key: sortKey, direction },
      };
    });
  };

  // Apply sorting comparator helper
  const sortPlayers = (playersList: any[], columnId: string) => {
    const config = columnSorts[columnId] || { key: "tryout_number", direction: "asc" };
    
    return [...playersList].sort((a, b) => {
      if (config.key === "name") {
        const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
        const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
        return config.direction === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }

      if (config.key === "position") {
        const posA = parseInt(a.position) || 999;
        const posB = parseInt(b.position) || 999;
        return config.direction === "asc" ? posA - posB : posB - posA;
      }

      if (config.key === "rank") {
        const rankA = a.rank || 999999;
        const rankB = b.rank || 999999;
        return config.direction === "asc" ? rankA - rankB : rankB - rankA;
      }
      
      const valA = a[config.key];
      const valB = b[config.key];
      return smartCompare(valA, valB, config.direction);
    });
  };

  // Bulk Selection Toggles
  const handleToggleSelectPlayer = (playerId: number) => {
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

  const handleSelectAll = (playersList: any[]) => {
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

  const handleBulkMove = (targetFieldId: number | null) => {
    if (selectedPlayerIds.size === 0) return;
    
    setLocalPlacements(prev => {
      const next = { ...prev };
      selectedPlayerIds.forEach(pid => {
        next[pid] = targetFieldId;
      });
      localStorage.setItem(`player_board_placements_${selectedSession}`, JSON.stringify(next));
      return next;
    });

    toast.success(`Moved ${selectedPlayerIds.size} players in bulk.`);
    setSelectedPlayerIds(new Set());
  };

  if (!selectors) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center gap-3 text-text'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading Board Configurations...</span>
      </div>
    );
  }

  // Filters logic helper
  const matchesFilters = (p: any) => {
    if (filterPosition !== "all") {
      const posVal = (p.position || "").trim();
      if (posVal !== filterPosition && !posVal.startsWith(`${filterPosition} `) && !posVal.startsWith(`${filterPosition}-`)) {
        return false;
      }
    }
    if (filterRating !== "all") {
      const ratVal = p.rating || 0;
      if (filterRating === "9") return ratVal >= 9;
      if (filterRating === "8") return ratVal >= 8 && ratVal < 9;
      if (filterRating === "7") return ratVal >= 7 && ratVal < 8;
      if (filterRating === "6") return ratVal >= 6 && ratVal < 7;
      if (filterRating === "under6") return ratVal < 6;
    }
    return true;
  };

  // Segment players based on localPlacements
  const allPlayers = boardData?.players || [];
  const rawUnassigned = allPlayers.filter((p: any) => {
    const currentFieldId = localPlacements[p.id] !== undefined ? localPlacements[p.id] : p.fieldId;
    return currentFieldId === null && p.availability === "available" && p.attendance === "present" && matchesFilters(p);
  });
  const unassignedPlayers = sortPlayers(rawUnassigned, "unassigned");
  const fields = boardData?.fields || [];

  return (
    <div className='w-full flex-1 flex flex-col min-h-0 animate-fadeIn relative space-y-4 pb-2'>
      
      {/* Top Selectors Card */}
      <Card className='p-4 bg-surface/80 border-border backdrop-blur-md flex flex-wrap gap-4 items-end shrink-0'>
        <div className='flex-1 min-w-[150px]'>
          <label className='block text-[0.65rem] font-bold text-text-label uppercase tracking-wider mb-1'>Season</label>
          <select 
            value={selectedSeason} 
            onChange={(e) => setSelectedSeason(e.target.value)}
            className='text-xs font-semibold py-2 px-3 border border-border rounded-lg bg-background w-full cursor-pointer focus:ring-1 focus:ring-primary'
          >
            {seasons.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className='flex-1 min-w-[150px]'>
          <label className='block text-[0.65rem] font-bold text-text-label uppercase tracking-wider mb-1'>Event</label>
          <select 
            value={selectedEvent} 
            onChange={(e) => setSelectedEvent(e.target.value)}
            className='text-xs font-semibold py-2 px-3 border border-border rounded-lg bg-background w-full cursor-pointer focus:ring-1 focus:ring-primary'
          >
            <option value=''>-- Select Event --</option>
            {filteredEvents.map((e: any) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div className='flex-1 min-w-[150px]'>
          <label className='block text-[0.65rem] font-bold text-text-label uppercase tracking-wider mb-1'>Session</label>
          <select 
            value={selectedSession} 
            onChange={(e) => setSelectedSession(e.target.value)}
            className='text-xs font-semibold py-2 px-3 border border-border rounded-lg bg-background w-full cursor-pointer focus:ring-1 focus:ring-primary'
          >
            <option value=''>-- Select Session --</option>
            {sessions.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} ({new Date(s.session_date).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        <div className='flex-1 min-w-[150px]'>
          <label className='block text-[0.65rem] font-bold text-text-label uppercase tracking-wider mb-1'>Division Filter</label>
          <select 
            value={selectedDivision} 
            onChange={(e) => setSelectedDivision(e.target.value)}
            className='text-xs font-semibold py-2 px-3 border border-border rounded-lg bg-background w-full cursor-pointer focus:ring-1 focus:ring-primary'
          >
            <option value=''>-- All Divisions / Age Groups --</option>
            {divisions.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name} ({d.gender})</option>
            ))}
          </select>
        </div>

      </Card>

      {/* Workspace Tabs Sub-Navigation */}
      {selectedSession && (
        <div className='flex items-center gap-2 bg-surface/80 border border-border p-2 rounded-2xl shadow-sm overflow-x-auto shrink-0'>
          <button
            type='button'
            onClick={() => setActiveTab("checkin")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "checkin"
                ? "bg-primary text-white shadow-sm"
                : "bg-background text-muted hover:text-text border border-border"
            }`}
          >
            <CheckSquare size={14} className={activeTab === "checkin" ? "text-white" : "text-emerald-500"} />
            Check-in
          </button>
          <button
            type='button'
            onClick={() => setActiveTab("rating")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "rating"
                ? "bg-primary text-white shadow-sm"
                : "bg-background text-muted hover:text-text border border-border"
            }`}
          >
            <Star size={14} className={activeTab === "rating" ? "text-white" : "text-amber-500"} />
            Rating
          </button>
          <button
            type='button'
            onClick={() => setActiveTab("fields")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "fields"
                ? "bg-primary text-white shadow-sm"
                : "bg-background text-muted hover:text-text border border-border"
            }`}
          >
            <Grid size={14} />
            Field Assignment
          </button>
          <button
            type='button'
            onClick={() => setActiveTab("ranking")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "ranking"
                ? "bg-primary text-white shadow-sm"
                : "bg-background text-muted hover:text-text border border-border"
            }`}
          >
            <Award size={14} className={activeTab === "ranking" ? "text-white" : "text-purple-500"} />
            Ranking
          </button>
          <button
            type='button'
            onClick={() => setActiveTab("placement")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "placement"
                ? "bg-primary text-white shadow-sm"
                : "bg-background text-muted hover:text-text border border-border"
            }`}
          >
            <Users size={14} className={activeTab === "placement" ? "text-white" : "text-blue-500"} />
            Final Placement
          </button>
        </div>
      )}

      {/* Tab 1: Check-in */}
      {activeTab === "checkin" && (
        <div className='flex-1 w-full min-h-[75vh] rounded-2xl overflow-hidden border border-border bg-surface shadow-sm'>
          {selectedSession ? (
            <iframe
              key={`checkin-${selectedSession}`}
              src={`/admin/sessions/${selectedSession}?embedded=true`}
              className='w-full h-full min-h-[75vh] border-none'
              title='Check-in Workspace'
            />
          ) : (
            <div className='min-h-[40vh] flex items-center justify-center font-bold text-muted text-sm'>
              Please select a Session from the top header above.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Rating */}
      {activeTab === "rating" && (
        <div className='flex-1 w-full min-h-[75vh] rounded-2xl overflow-hidden border border-border bg-surface shadow-sm'>
          {selectedSession ? (
            <iframe
              key={`rating-${selectedSession}`}
              src={`/admin/sessions/${selectedSession}/ratings?embedded=true`}
              className='w-full h-full min-h-[75vh] border-none'
              title='Rating Workspace'
            />
          ) : (
            <div className='min-h-[40vh] flex items-center justify-center font-bold text-muted text-sm'>
              Please select a Session from the top header above.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Ranking */}
      {activeTab === "ranking" && (
        <div className='flex-1 w-full min-h-[75vh] rounded-2xl overflow-hidden border border-border bg-surface shadow-sm'>
          {selectedEvent ? (
            <iframe
              key={`ranking-${selectedEvent}`}
              src={`/admin/events/${selectedEvent}/rankings?embedded=true`}
              className='w-full h-full min-h-[75vh] border-none'
              title='Ranking Workspace'
            />
          ) : (
            <div className='min-h-[40vh] flex items-center justify-center font-bold text-muted text-sm'>
              Please select an Event from the top header above.
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Final Placement */}
      {activeTab === "placement" && (
        <div className='flex-1 w-full min-h-[75vh] rounded-2xl overflow-hidden border border-border bg-surface shadow-sm'>
          {selectedEvent ? (
            <iframe
              key={`placement-${selectedEvent}`}
              src={`/admin/teams/placement?embedded=true`}
              className='w-full h-full min-h-[75vh] border-none'
              title='Final Placement Workspace'
            />
          ) : (
            <div className='min-h-[40vh] flex items-center justify-center font-bold text-muted text-sm'>
              Please select an Event from the top header above.
            </div>
          )}
        </div>
      )}


      {/* Tab 3: Field Assignment (Main Drag & Drop Workspace) */}
      {activeTab === "fields" && (
        (loadingBoard && !boardData) ? (
          <div className='min-h-[50vh] flex flex-col items-center justify-center gap-3 text-text'>
            <Loader2 className='animate-spin text-primary' size={44} />
            <span className='font-bold text-muted'>Loading Session Board...</span>
          </div>
        ) : boardData ? (
          <div className='flex-1 min-h-0 h-full flex flex-col gap-6'>
          
          {/* Action Toolbar */}
          <div className='flex flex-wrap items-center justify-between gap-4 shrink-0'>
            {/* Create Field Form & Filters Row */}
            <div className='flex flex-wrap items-center gap-4 flex-1 min-w-0'>
              {/* Board Filters Dropdowns */}
              <div className='flex items-center gap-2'>
                <select
                  value={filterPosition}
                  onChange={(e) => setFilterPosition(e.target.value)}
                  className='text-xs font-semibold py-2 px-3 border border-border rounded-lg bg-background cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none w-36 h-[38px]'
                >
                  <option value='all'>All Positions</option>
                  {STANDARD_POSITIONS.map(p => (
                    <option key={p} value={p}>Pos: {p}</option>
                  ))}
                </select>

                <select
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                  className='text-xs font-semibold py-2 px-3 border border-border rounded-lg bg-background cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none w-36 h-[38px]'
                >
                  <option value='all'>All Ratings</option>
                  <option value='9'>Rating &ge; 9</option>
                  <option value='8'>Rating 8.0 - 8.9</option>
                  <option value='7'>Rating 7.0 - 7.9</option>
                  <option value='6'>Rating 6.0 - 6.9</option>
                  <option value='under6'>Rating &lt; 6.0</option>
                </select>
              </div>

              {/* Separator */}
              <div className='h-6 w-px bg-border hidden sm:block' />

              {/* Create Field Form */}
              <form onSubmit={handleCreateField} className='flex items-center gap-2 max-w-xs w-full'>
                <Input 
                  placeholder='New Field Name (e.g. Field A)...'
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  className='text-xs !mb-0 font-medium py-1.5'
                />
                <Button 
                  type='submit' 
                  variant='primary' 
                  size='sm' 
                  disabled={isSubmitting}
                  className='flex items-center gap-1 shrink-0 h-[38px] font-bold text-xs'
                >
                  <Plus size={14} />
                  <span>Add Field</span>
                </Button>
              </form>

              {(loadingBoard || isSubmitting) && (
                <div className='flex items-center gap-1.5 text-xs text-primary font-extrabold animate-pulse shrink-0 bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10'>
                  <Loader2 className='animate-spin text-primary' size={14} />
                  <span>Saving...</span>
                </div>
              )}
            </div>

            {/* Placements Save controls */}
            <div className='flex items-center gap-3'>
              {hasUnsavedChanges && (
                <div className='flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg text-yellow-600 animate-pulse text-xs font-bold'>
                  <AlertTriangle size={14} />
                  <span>{unsavedList.length} Unsaved Changes</span>
                </div>
              )}

              {hasUnsavedChanges && (
                <>
                  <Button
                    onClick={handleResetChanges}
                    variant='outline'
                    size='sm'
                    disabled={isSubmitting}
                    className='flex items-center gap-1 font-bold text-xs text-muted hover:text-text'
                  >
                    <Undo2 size={14} />
                    <span>Reset</span>
                  </Button>
                  <Button
                    onClick={handleSaveChanges}
                    variant='primary'
                    size='sm'
                    disabled={isSubmitting}
                    className='flex items-center gap-1 font-bold text-xs bg-accent hover:bg-accent-hover text-white'
                  >
                    <Save size={14} />
                    <span>Save Changes</span>
                  </Button>
                </>
              )}

              {selectedSession && (
                <Link href={`/admin/sessions/${selectedSession}/ratings`}>
                  <Button
                    variant='outline'
                    size='sm'
                    className='flex items-center gap-1.5 font-bold text-xs border-primary/35 text-primary hover:bg-primary/5 h-[38px]'
                  >
                    <Award size={14} />
                    <span>Enter Ratings</span>
                  </Button>
                </Link>
              )}

              {fields.length === 0 && (
                <Button
                  onClick={handleCarryOver}
                  variant='outline'
                  size='sm'
                  disabled={isSubmitting}
                  className='flex items-center gap-1.5 font-bold text-xs border-primary/30 text-primary hover:bg-primary/5'
                >
                  <RefreshCw size={14} />
                  <span>Carry Over Previous Setup</span>
                </Button>
              )}
            </div>
          </div>

          {/* Kanban / Drag Columns Container */}
          <div className={`player-board-columns flex-1 min-h-0 h-full transition-all duration-200 ${
            (loadingBoard || isSubmitting) ? "opacity-60 pointer-events-none cursor-not-allowed" : ""
          }`}>
            
            {/* Column 1: Fixed Unassigned Players */}
            <div 
              className='player-board-fixed-col flex flex-col bg-surface/50 border border-border rounded-2xl h-full'
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, null)}
            >
              <div 
                className='p-4 border-b border-border flex items-center justify-between bg-surface/80 cursor-pointer'
                onClick={() => handlePlacePlayer(null)}
              >
                <div className='flex flex-col min-w-0'>
                  <h3 className='font-extrabold text-sm text-text flex items-center gap-1.5'>
                    <Users size={16} className='text-muted' />
                    <span>Unassigned Roster</span>
                    <span className='text-[10px] font-extrabold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full'>
                      {rawUnassigned.length}
                    </span>
                  </h3>
                  <div className='flex items-center gap-1.5 mt-1' onClick={(e) => e.stopPropagation()}>
                    <input
                      type='checkbox'
                      checked={unassignedPlayers.length > 0 && unassignedPlayers.every((p: any) => selectedPlayerIds.has(p.id))}
                      onChange={() => handleSelectAll(unassignedPlayers)}
                      className='rounded text-primary focus:ring-primary bg-background border-border cursor-pointer h-3.5 w-3.5 mr-1'
                      title='Select/Deselect All Filtered'
                    />
                    <span className='text-[10px] font-bold text-muted'>
                      Select All ({unassignedPlayers.length})
                    </span>
                  </div>
                </div>

                {/* Inline Sort Control */}
                <select
                  value={columnSorts["unassigned"]?.key || "tryout_number"}
                  onChange={(e) => handleSortChange("unassigned", e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className='text-[10px] font-bold bg-background hover:bg-surface border border-border rounded-md px-2 py-1 text-muted hover:text-text cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary'
                >
                  <option value='tryout_number'>Sort: Tryout #</option>
                  <option value='name'>Sort: Name</option>
                  <option value='rating'>Sort: Rating</option>
                  <option value='position'>Sort: Position</option>
                </select>
              </div>

              {/* Scrollable Player Cards List */}
              <div className='flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar min-h-0'>
                {unassignedPlayers.length === 0 ? (
                  <div className='text-center py-12 text-xs text-muted/50 font-bold'>
                    No unassigned players present.
                  </div>
                ) : (
                  unassignedPlayers.map((player: any) => (
                    <PlayerCard 
                      key={player.id} 
                      player={player} 
                      isSelected={selectedPlayerId === player.id}
                      isChecked={selectedPlayerIds.has(player.id)}
                      onToggleCheck={() => handleToggleSelectPlayer(player.id)}
                      onDragStart={(e) => handleDragStart(e, player.id)}
                      onTap={() => handlePlayerTap(player.id)}
                      onOpenNotes={() => handleOpenNotes(player)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Columns 2+: Scrollable fields/grids */}
            <div className='player-board-scroll-area flex-1 h-full'>
              <div className='player-board-scroll-columns'>
                
                {fields.map((field: any) => {
                  const rawFieldPlayers = allPlayers.filter((p: any) => {
                    const currentFieldId = localPlacements[p.id] !== undefined ? localPlacements[p.id] : p.fieldId;
                    return currentFieldId === field.id && p.availability === "available" && p.attendance === "present" && matchesFilters(p);
                  });
                  const fieldPlayers = sortPlayers(rawFieldPlayers, field.id.toString());
                  const isEditing = editingFieldId === field.id;

                  return (
                    <div 
                      key={field.id}
                      className='flex flex-col bg-surface/50 border border-border rounded-2xl h-full'
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, field.id)}
                    >
                      {/* Field Column Header */}
                      <div 
                        className='p-4 border-b border-border flex items-center justify-between bg-surface/80 gap-2 cursor-pointer'
                        onClick={() => handlePlacePlayer(field.id)}
                      >
                        {isEditing ? (
                          <input 
                            type='text'
                            value={editingFieldName}
                            onChange={(e) => setEditingFieldName(e.target.value)}
                            onBlur={() => handleRenameField(field.id)}
                            onKeyDown={(e) => e.key === "Enter" && handleRenameField(field.id)}
                            autoFocus
                            className='text-xs font-bold bg-background border border-border rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-primary'
                          />
                        ) : (
                          <div className='flex flex-col min-w-0'>
                            <div className='flex items-center gap-1.5 min-w-0'>
                              <h3 className='font-extrabold text-sm text-text truncate'>{field.name}</h3>
                              <span className='text-[10px] font-extrabold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full shrink-0'>
                                {rawFieldPlayers.length}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingFieldId(field.id);
                                  setEditingFieldName(field.name);
                                }}
                                className='p-1 rounded text-muted hover:text-text hover:bg-background transition-all cursor-pointer'
                                title='Rename Field'
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                            <div className='flex items-center gap-1.5 mt-1' onClick={(e) => e.stopPropagation()}>
                              <input
                                type='checkbox'
                                checked={fieldPlayers.length > 0 && fieldPlayers.every((p: any) => selectedPlayerIds.has(p.id))}
                                onChange={() => handleSelectAll(fieldPlayers)}
                                className='rounded text-primary focus:ring-primary bg-background border-border cursor-pointer h-3.5 w-3.5 mr-1'
                                title='Select/Deselect All Filtered'
                              />
                              <span className='text-[10px] font-bold text-muted'>
                                Select All ({fieldPlayers.length})
                              </span>
                            </div>
                          </div>
                        )}

                        <div className='flex items-center gap-1.5 shrink-0'>
                          {/* Inline Sort Control */}
                          <select
                            value={columnSorts[field.id.toString()]?.key || "tryout_number"}
                            onChange={(e) => handleSortChange(field.id.toString(), e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className='text-[10px] font-bold bg-background hover:bg-surface border border-border rounded-md px-2 py-1 text-muted hover:text-text cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary'
                          >
                            <option value='tryout_number'>Sort: Tryout #</option>
                            <option value='name'>Sort: Name</option>
                            <option value='rating'>Sort: Rating</option>
                            <option value='position'>Sort: Position</option>
                            <option value='rank'>Sort: Rank</option>
                          </select>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFieldToDelete({ id: field.id, name: field.name });
                            }}
                            className='p-1 rounded text-muted hover:text-danger hover:bg-danger/10 transition-all cursor-pointer'
                            title='Delete Field'
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Field Cards Area */}
                      <div className='flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar min-h-0'>
                        {fieldPlayers.length === 0 ? (
                          <div className='h-32 flex items-center justify-center border-2 border-dashed border-border/20 rounded-xl text-xs text-muted/30 font-bold'>
                            Empty Field Target
                          </div>
                        ) : (
                          fieldPlayers.map((player: any) => (
                            <PlayerCard 
                              key={player.id} 
                              player={player} 
                              isSelected={selectedPlayerId === player.id}
                              isChecked={selectedPlayerIds.has(player.id)}
                              onToggleCheck={() => handleToggleSelectPlayer(player.id)}
                              onDragStart={(e) => handleDragStart(e, player.id)}
                              onTap={() => handlePlayerTap(player.id)}
                              onOpenNotes={() => handleOpenNotes(player)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}

                {fields.length === 0 && (
                  <div className='h-full flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl p-8 text-center text-muted'>
                    <MapPin size={38} className='mx-auto mb-2 text-muted/30' />
                    <span className='font-bold text-sm'>No Fields Configured</span>
                    <p className='text-xs text-muted/60 mt-1 max-w-xs'>
                      Add a field above or carry over configuration from previous sessions to begin placement.
                    </p>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className='h-[40vh] flex flex-col items-center justify-center border border-border/60 bg-surface/30 rounded-2xl text-center p-8 text-muted'>
          <Grid size={38} className='mx-auto mb-2 text-muted/30' />
          <span className='font-bold text-sm'>Select a Session above to view the Movement Board</span>
        </div>
      ))}


      {/* Floating Bulk Action Bar */}
      {selectedPlayerIds.size > 0 && (
        <div className='fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface/95 border border-primary/30 p-3 px-6 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-4 z-50 animate-fadeInUp'>
          <span className='text-xs font-bold text-text flex items-center gap-1.5'>
            <ArrowRightLeft className='text-primary' size={16} />
            <span>{selectedPlayerIds.size} Players Selected</span>
          </span>
          
          <div className='h-4 w-px bg-border' />

          <div className='flex items-center gap-2'>
            <span className='text-[10px] font-extrabold uppercase text-muted'>Move to:</span>
            <select
              onChange={(e) => {
                const val = e.target.value;
                handleBulkMove(val === "unassigned" ? null : Number(val));
              }}
              defaultValue=''
              className='text-xs font-bold bg-background border border-border rounded-lg px-2 py-1 cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none'
            >
              <option value='' disabled>-- Choose Location --</option>
              <option value='unassigned'>Unassigned Roster</option>
              {fields.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => setSelectedPlayerIds(new Set())}
            variant='outline'
            size='xs'
            className='font-bold text-muted hover:text-text'
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Modal Dialog for Field Deletion Confirmation */}
      <Modal
        isOpen={!!fieldToDelete}
        onClose={() => setFieldToDelete(null)}
        title='Confirm Delete Field'
        size='sm'
        footer={
          <>
            <Button variant='outline' onClick={() => setFieldToDelete(null)}>
              Cancel
            </Button>
            <Button variant='danger' onClick={handleConfirmDeleteField} disabled={isSubmitting}>
              Delete Field
            </Button>
          </>
        }
      >
        <p className='text-sm text-text font-medium leading-relaxed'>
          Are you sure you want to delete the field <strong className='text-primary'>&quot;{fieldToDelete?.name}&quot;</strong>? 
          All players currently placed in this field will be moved back to the <strong className='text-accent'>Unassigned Roster</strong>.
        </p>
      </Modal>

      {/* Custom Modal Dialog for Unsaved Changes Exit Warning */}
      <Modal
        isOpen={!!pendingLeaveUrl}
        onClose={() => setPendingLeaveUrl(null)}
        title='Discard Unsaved Changes?'
        size='sm'
        footer={
          <>
            <Button variant='outline' onClick={() => setPendingLeaveUrl(null)}>
              Keep Editing
            </Button>
            <Button variant='danger' onClick={confirmLeave}>
              Discard & Leave
            </Button>
          </>
        }
      >
        <p className='text-sm text-text font-medium leading-relaxed flex items-start gap-2.5'>
          <AlertTriangle className='text-warning shrink-0' size={20} />
          <span>
            You have unsaved player placements on the board. Leaving this page now will discard these changes.
          </span>
        </p>
      </Modal>

      {/* Modal Dialog for Session Evaluation/Attendance Notes Popup */}
      <Modal
        isOpen={!!notePlayer}
        onClose={() => setNotePlayer(null)}
        title={notePlayer ? `${notePlayer.first_name} ${notePlayer.last_name} — Evaluation History` : "Player Evaluation History"}
        size='md'
        footer={
          <Button variant='outline' onClick={() => setNotePlayer(null)}>
            Close
          </Button>
        }
      >
        {loadingNotes ? (
          <div className='flex flex-col items-center justify-center p-8 gap-2 text-muted'>
            <Loader2 className='animate-spin text-primary' size={32} />
            <span className='text-xs font-bold'>Loading history records...</span>
          </div>
        ) : noteHistory.length === 0 ? (
          <div className='text-center p-8 text-xs text-muted/60 italic'>
            No evaluation sessions scheduled or recorded for this player in the active event.
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4 text-xs font-bold bg-background p-3 rounded-lg border border-border'>
              <div>
                <span className='text-muted block text-[10px] uppercase'>Position</span>
                <span className='text-text capitalize'>{notePlayer?.position || "Not specified"}</span>
              </div>
              <div>
                <span className='text-muted block text-[10px] uppercase'>Overall Registry Rating</span>
                <span className='text-primary'>{notePlayer?.rating || "0"} / 10</span>
              </div>
            </div>
            
            <div className='border border-border rounded-xl overflow-hidden'>
              <table className='w-full text-left text-xs'>
                <thead className='bg-background font-bold text-text-label border-b border-border'>
                  <tr>
                    <th className='p-3.5'>Session Name</th>
                    <th className='p-3.5'>Date</th>
                    <th className='p-3.5 text-center'>Attendance</th>
                    <th className='p-3.5 text-center'>Session Rating</th>
                    <th className='p-3.5 text-center'>Session Rank</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-border bg-surface'>
                  {noteHistory.map((h) => (
                    <tr key={h.sessionId} className='hover:bg-background/20'>
                      <td className='p-3.5 font-semibold text-text'>{h.sessionName}</td>
                      <td className='p-3.5 text-muted'>{new Date(h.sessionDate).toLocaleDateString()}</td>
                      <td className='p-3.5 text-center'>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          h.attendance === "present"
                            ? "bg-green-500/10 text-green-600 border border-green-500/20"
                            : h.attendance === "absent"
                              ? "bg-danger/10 text-danger border border-danger/20"
                              : "bg-orange-500/10 text-orange-600 border border-orange-500/20"
                        }`}>
                          {h.attendance}
                        </span>
                      </td>
                      <td className='p-3.5 text-center font-extrabold text-accent'>
                        {h.rating ? `${h.rating.toFixed(1)} / 10` : "No Rating"}
                      </td>
                      <td className='p-3.5 text-center font-bold text-primary'>
                        {h.rank ? `#${h.rank}` : "Unranked"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Scoped Evaluator Comments Timeline */}
            <div className='space-y-2.5 mt-4 pt-2 border-t border-border/60'>
              <h4 className='text-xs font-bold text-text-label uppercase tracking-wide'>
                Evaluator Comments & Notes Feed
              </h4>
              {notePlayerNotes.length === 0 ? (
                <div className='text-center py-4 text-xs text-muted/50 italic'>
                  No comments or notes recorded for this player.
                </div>
              ) : (
                <div className='space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar'>
                  {notePlayerNotes.map((n) => (
                    <div key={n.id} className='bg-surface border border-border p-3 rounded-xl space-y-1 shadow-xs'>
                      <div className='flex items-center justify-between text-[10px] font-bold text-muted'>
                        <span>{n.authorName}</span>
                        <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className='text-xs text-text font-semibold leading-relaxed'>{n.noteText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

function PlayerCard({ player, isSelected, isChecked, onToggleCheck, onDragStart, onTap, onOpenNotes }: { 
  player: any; 
  isSelected: boolean;
  isChecked: boolean;
  onToggleCheck: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onTap: () => void;
  onOpenNotes: () => void;
}) {
  const isGK = player.position?.toLowerCase().includes("goalkeeper") || player.position === "1" || player.position?.toLowerCase() === "gk";

  return (
    <div 
      draggable 
      onDragStart={onDragStart}
      onClick={onTap}
      className={`p-2 px-3 rounded-lg border hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing select-none shadow-sm flex flex-col justify-center relative group
        ${isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : ""}
        ${isChecked ? "border-primary bg-primary/10 ring-1 ring-primary/30" : ""}
        ${!isSelected && !isChecked && isGK ? "bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/10" : ""}
        ${!isSelected && !isChecked && !isGK ? "bg-background border-border/80" : ""}
      `}
    >
      <div className='flex items-center justify-between gap-2 pr-6'>
        <div className='flex items-center gap-2 min-w-0'>
          <input
            type='checkbox'
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              onToggleCheck();
            }}
            onClick={(e) => e.stopPropagation()}
            className='rounded text-primary focus:ring-primary bg-background border-border cursor-pointer h-3.5 w-3.5'
          />
          <span className={`font-bold text-xs truncate ${isGK && !isSelected && !isChecked ? "text-emerald-700 dark:text-emerald-300" : "text-text"}`}>
            {player.first_name} {player.last_name}
          </span>
        </div>
        {player.tryout_number && (
          <span className='text-[10px] font-extrabold text-accent shrink-0'>
            #{player.tryout_number}
          </span>
        )}
      </div>

      <div className='flex items-center justify-between text-[10px] font-semibold text-muted mt-0.5 pl-5.5'>
        <span>
          Rating: <strong className='text-primary'>{player.rating}</strong>
          {player.position && (
            <span className='ml-2 inline-block text-[8px] font-extrabold px-1 rounded bg-blue-500/10 text-blue-600 uppercase border border-blue-500/20'>
              Pos: {player.position}
            </span>
          )}
        </span>
        <span className='truncate text-[9px] opacity-70 max-w-[100px] text-right' title={player.assignedTeamName}>
          {player.assignedTeamName}
        </span>
      </div>

      {/* Note / Clipboard Icon for history pop up */}
      <button
        type='button'
        onClick={(e) => {
          e.stopPropagation();
          onOpenNotes();
        }}
        className='absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted/40 hover:text-primary hover:bg-primary/5 rounded opacity-0 group-hover:opacity-100 transition-all cursor-pointer'
        title='View Roster History Details'
      >
        <FileText size={14} />
      </button>
    </div>
  );
}
