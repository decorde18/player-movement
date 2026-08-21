"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { 
  getRosterInvitations, 
  sendTeamInvitation, 
  updateInvitationStatus, 
  updateUniformNumber,
  bulkSendInvitations 
} from "./actions";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import FilterBar from "@/components/ui/FilterBar";
import SortControl from "@/components/ui/SortControl";
import { 
  Loader2, 
  ArrowLeft, 
  Shirt, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Edit2, 
  Save, 
  CheckSquare, 
  Square, 
  X,
  HelpCircle,
  Send,
  Users,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { STANDARD_POSITIONS } from "@/lib/utils/positionPresets";
import NotesModal from "@/components/ui/NotesModal";
import Checkbox from "@/components/ui/Checkbox";

export default function RosterInvitationsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<number | undefined>(undefined);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");

  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Selection state
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());

  // Notes Modal state
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesTargetPlayer, setNotesTargetPlayer] = useState<any>(null);

  // Inline uniform edit state
  const [editingUniformPlayerId, setEditingUniformPlayerId] = useState<number | null>(null);
  const [uniformInputValue, setUniformInputValue] = useState<string>("");

  // Invitation Notes modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [targetPlayer, setTargetPlayer] = useState<any>(null);
  const [invitationNotes, setInvitationNotes] = useState<string>("");

  const loadData = async (agId?: number) => {
    try {
      setLoading(true);
      const res = await getRosterInvitations(agId);
      setData(res);
      setSelectedAgeGroupId(res.selectedAgeGroupId);
      setSelectedPlayerIds(new Set());
    } catch (e: any) {
      toast.error(e.message || "Failed to load invitations board.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAgeGroupChange = (agId: number) => {
    setSelectedTeamId("all");
    loadData(agId);
  };

  // Uniform number update
  const handleSaveUniform = async (seasonPlayerId: number) => {
    startTransition(async () => {
      const res = await updateUniformNumber(seasonPlayerId, uniformInputValue);
      if (res.success) {
        toast.success("Uniform number updated!");
        setEditingUniformPlayerId(null);
        loadData(selectedAgeGroupId);
      } else {
        toast.error(res.error || "Failed to update uniform number.");
      }
    });
  };

  // Send single invitation modal launch
  const openSendModal = (sp: any) => {
    if (!sp.season_team_id) {
      toast.error("Please place the player on a team before sending an invitation.");
      return;
    }

    const latestInv = sp.team_invitations?.[0];
    if (latestInv?.status === "pending") {
      toast.error("Player already has an active pending invitation.");
      return;
    }

    setTargetPlayer(sp);
    setInvitationNotes("");
    setShowSendModal(true);
  };

  const handleConfirmSendInvitation = async () => {
    if (!targetPlayer || !targetPlayer.season_team_id) return;

    startTransition(async () => {
      const res = await sendTeamInvitation(targetPlayer.id, targetPlayer.season_team_id, invitationNotes);
      if (res.success) {
        toast.success(`Invitation sent to ${targetPlayer.players?.first_name} ${targetPlayer.players?.last_name}!`);
        setShowSendModal(false);
        setTargetPlayer(null);
        loadData(selectedAgeGroupId);
      } else {
        toast.error(res.error || "Failed to send invitation.");
      }
    });
  };

  // Status change handler for existing invitation
  const handleStatusChange = async (invitationId: number, newStatus: string) => {
    startTransition(async () => {
      const res = await updateInvitationStatus(invitationId, newStatus);
      if (res.success) {
        toast.success(`Invitation status updated to ${newStatus.toUpperCase()}`);
        loadData(selectedAgeGroupId);
      } else {
        toast.error(res.error || "Failed to update invitation status.");
      }
    });
  };

  // Status change handler for individual player select dropdown
  const handlePlayerStatusSelectChange = async (sp: any, newStatus: string) => {
    if (newStatus === "none") return;

    const latestInv = sp.team_invitations?.[0];

    if (!sp.season_team_id) {
      toast.error("Assign a team to this player on the Team Board before updating invitation status.");
      return;
    }

    startTransition(async () => {
      if (latestInv) {
        const res = await updateInvitationStatus(latestInv.id, newStatus);
        if (res.success) {
          toast.success(`Invitation status updated to ${newStatus.toUpperCase()}`);
          loadData(selectedAgeGroupId);
        } else {
          toast.error(res.error || "Failed to update status.");
        }
      } else {
        const res = await sendTeamInvitation(sp.id, sp.season_team_id);
        if (res.success) {
          if (newStatus !== "pending" && res.invitation?.id) {
            await updateInvitationStatus(res.invitation.id, newStatus);
          }
          toast.success(`Invitation created with status ${newStatus.toUpperCase()}`);
          loadData(selectedAgeGroupId);
        } else {
          toast.error(res.error || "Failed to send invitation.");
        }
      }
    });
  };

  // Bulk send invitations
  const handleBulkSend = async () => {
    if (selectedPlayerIds.size === 0) return;

    const selectedArray = Array.from(selectedPlayerIds);
    // Find team id if filtered by team or prompt
    const defaultTeamId = selectedTeamId !== "all" ? Number(selectedTeamId) : null;
    if (!defaultTeamId) {
      toast.error("Please select a specific team filter before bulk sending invitations.");
      return;
    }

    startTransition(async () => {
      const res = await bulkSendInvitations(selectedArray, defaultTeamId);
      if (res.success) {
        toast.success(`Sent ${res.sentCount} invitation(s). (${res.skippedCount} skipped due to existing pending status)`);
        setSelectedPlayerIds(new Set());
        loadData(selectedAgeGroupId);
      } else {
        toast.error("Failed to bulk send invitations.");
      }
    });
  };

  if (loading || !data) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center gap-3 text-text'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading Roster & Invitations...</span>
      </div>
    );
  }

  const { seasonAgeGroups, seasonTeams, seasonPlayers, isCoordinator, userAssignedTeamId } = data;
  const currentAgeGroup = seasonAgeGroups.find((sag: any) => sag.id === selectedAgeGroupId);

  // Filter Players
  const filteredPlayers = seasonPlayers.filter((sp: any) => {
    if (selectedTeamId !== "all") {
      const targetTeamId = Number(selectedTeamId);
      if (sp.season_team_id !== targetTeamId) return false;
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const fullName = `${sp.players?.first_name} ${sp.players?.last_name}`.toLowerCase();
      const tryout = (sp.tryout_number || "").toString().toLowerCase();
      const uniform = (sp.uniform_number || "").toString().toLowerCase();
      if (!fullName.includes(q) && !tryout.includes(q) && !uniform.includes(q)) return false;
    }

    if (positionFilter !== "all") {
      const posVal = (sp.position || "").trim();
      if (posVal !== positionFilter && !posVal.startsWith(`${positionFilter} `) && !posVal.startsWith(`${positionFilter}-`)) {
        return false;
      }
    }

    const latestInv = sp.team_invitations?.[0];
    const invStatus = latestInv?.status || "none";

    if (statusFilter !== "all") {
      if (statusFilter === "none" && latestInv) return false;
      if (statusFilter !== "none" && invStatus !== statusFilter) return false;
    }

    return true;
  });

  // Sort Players
  const sortedPlayers = [...filteredPlayers].sort((a: any, b: any) => {
    if (sortKey === "name") {
      const nameA = `${a.players?.last_name} ${a.players?.first_name}`.toLowerCase();
      const nameB = `${b.players?.last_name} ${b.players?.first_name}`.toLowerCase();
      return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    }
    if (sortKey === "team") {
      const teamA = a.season_teams?.teams?.name || "Unassigned";
      const teamB = b.season_teams?.teams?.name || "Unassigned";
      return sortDirection === "asc" ? teamA.localeCompare(teamB) : teamB.localeCompare(teamA);
    }
    if (sortKey === "uniform") {
      const numA = parseInt(a.uniform_number || "999", 10);
      const numB = parseInt(b.uniform_number || "999", 10);
      return sortDirection === "asc" ? numA - numB : numB - numA;
    }
    if (sortKey === "status") {
      const statusA = a.team_invitations?.[0]?.status || "none";
      const statusB = b.team_invitations?.[0]?.status || "none";
      return sortDirection === "asc" ? statusA.localeCompare(statusB) : statusB.localeCompare(statusA);
    }
    return 0;
  });

  // Stats calculation
  const totalRoster = seasonPlayers.length;
  const pendingCount = seasonPlayers.filter((p: any) => p.team_invitations?.[0]?.status === "pending").length;
  const acceptedCount = seasonPlayers.filter((p: any) => p.team_invitations?.[0]?.status === "accepted").length;
  const declinedCount = seasonPlayers.filter((p: any) => p.team_invitations?.[0]?.status === "declined").length;
  const uniformAssignedCount = seasonPlayers.filter((p: any) => Boolean(p.uniform_number)).length;

  const filterGroups = [
    {
      id: "status",
      label: "Invitation Status",
      value: statusFilter,
      options: [
        { value: "all", label: "All Statuses" },
        { value: "pending", label: "Pending Invitations" },
        { value: "accepted", label: "Accepted Roster" },
        { value: "declined", label: "Declined" },
        { value: "expired", label: "Expired" },
        { value: "none", label: "No Invitation Sent" },
      ],
      onChange: setStatusFilter,
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
  ];

  const sortOptions = [
    { value: "name", label: "Name" },
    { value: "team", label: "Team" },
    { value: "uniform", label: "Uniform #" },
    { value: "status", label: "Invitation Status" },
  ];

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPositionFilter("all");
    setSelectedTeamId("all");
    setSelectedPlayerIds(new Set());
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "pending":
        return (
          <span className='inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20'>
            <Clock size={14} /> Pending
          </span>
        );
      case "accepted":
        return (
          <span className='inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20'>
            <CheckCircle2 size={14} /> Accepted
          </span>
        );
      case "declined":
        return (
          <span className='inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20'>
            <XCircle size={14} /> Declined
          </span>
        );
      case "expired":
        return (
          <span className='inline-flex items-center gap-1.5 text-xs font-bold text-muted bg-surface px-2.5 py-1 rounded-full border border-border'>
            <AlertCircle size={14} /> Expired
          </span>
        );
      default:
        return (
          <span className='inline-flex items-center gap-1.5 text-xs font-medium text-muted bg-surface/50 px-2.5 py-1 rounded-full border border-border/50'>
            Not Sent
          </span>
        );
    }
  };

  return (
    <div className='w-full flex-1 flex flex-col min-h-0 animate-fadeIn relative space-y-3 pb-2'>
      
      {/* Compact Header */}
      <div className='shrink-0 space-y-2'>
        {/* Row 1: Title + Age/Team pickers + Board link */}
        <div className='flex flex-wrap items-center gap-2 bg-surface/60 border border-border px-3 py-2 rounded-xl shadow-sm backdrop-blur-md'>
          <Link
            href={`/admin/events`}
            className='p-1.5 rounded-lg border border-border bg-background text-muted hover:text-text transition-all shrink-0'
          >
            <ArrowLeft size={14} />
          </Link>

          <div className='flex items-center gap-1.5 mr-2'>
            <Mail className='text-purple-600' size={15} />
            <h1 className='text-sm font-extrabold text-text'>Team Invitations &amp; Uniforms</h1>
          </div>

          {/* Divider */}
          <div className='hidden sm:block w-px h-5 bg-border mx-1' />

          {/* Age Group Picker */}
          <div className='flex items-center gap-1.5'>
            <span className='text-[10px] font-bold text-muted uppercase tracking-wider hidden sm:block'>Age Group:</span>
            <select
              value={selectedAgeGroupId || ""}
              onChange={(e) => handleAgeGroupChange(Number(e.target.value))}
              className='text-xs font-bold bg-background border border-border rounded-lg px-2 py-1 text-text focus:outline-none cursor-pointer'
            >
              {seasonAgeGroups.map((sag: any) => (
                <option key={sag.id} value={sag.id}>
                  {sag.name} ({sag.gender})
                </option>
              ))}
            </select>
          </div>

          {/* Team Picker */}
          <div className='flex items-center gap-1.5'>
            <span className='text-[10px] font-bold text-muted uppercase tracking-wider hidden sm:block'>Team:</span>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className='text-xs font-bold bg-background border border-border rounded-lg px-2 py-1 text-text focus:outline-none cursor-pointer'
            >
              <option value='all'>All Teams</option>
              {seasonTeams.map((st: any) => (
                <option key={st.id} value={st.id.toString()}>
                  {st.teams?.name}
                </option>
              ))}
            </select>
          </div>

          <Link href='/admin/teams/placement' className='ml-auto'>
            <Button variant='outline' size='sm' className='font-bold text-xs flex items-center gap-1 border-blue-500/30 text-blue-600 hover:bg-blue-500/10 py-1 h-auto'>
              <Shirt size={12} />
              <span>Team Board</span>
            </Button>
          </Link>
        </div>

        {/* Row 2: Stat pills inline */}
        <div className='flex flex-wrap items-center gap-2 px-1'>
          {[
            { label: "Total", value: totalRoster, color: "text-text", bg: "bg-surface" },
            { label: "Pending", value: pendingCount, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Accepted", value: acceptedCount, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Declined", value: declinedCount, color: "text-red-500", bg: "bg-red-500/10" },
            { label: "Uniforms", value: uniformAssignedCount, color: "text-purple-600", bg: "bg-purple-500/10" },
          ].map((stat) => (
            <span key={stat.label} className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2 py-1 rounded-full border border-border ${stat.bg}`}>
              <span className={stat.color}>{stat.value}</span>
              <span className='text-muted'>{stat.label}</span>
            </span>
          ))}
        </div>

        {/* Row 3: FilterBar + Sort */}
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <FilterBar
            filters={filterGroups}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder='Search player, tryout #, or uniform #...'
            onResetFilters={handleResetFilters}
            className='flex-1 min-w-[280px]'
          />

          <SortControl
            options={sortOptions}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={(k, d) => {
              setSortKey(k);
              setSortDirection(d);
            }}
            label='Sort Roster'
            size='sm'
          />
        </div>

        {/* Floating Bulk Action Toolbar */}
        {selectedPlayerIds.size > 0 && (
          <div className='sticky top-0 z-40 bg-surface/95 border-2 border-purple-500/40 shadow-2xl p-3 rounded-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3 animate-slideUp'>
            <div className='flex items-center gap-2 text-xs font-bold text-text'>
              <span className='w-5 h-5 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-black'>
                {selectedPlayerIds.size}
              </span>
              <span>Player{selectedPlayerIds.size > 1 ? "s" : ""} Selected</span>
            </div>

            <div className='flex items-center gap-2 flex-wrap'>
              <Button
                variant='primary'
                size='sm'
                onClick={handleBulkSend}
                disabled={isPending}
                className='flex items-center gap-1 font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white border-none'
              >
                <Send size={12} />
                <span>Bulk Send Invitations</span>
              </Button>

              <button
                onClick={() => setSelectedPlayerIds(new Set())}
                className='text-xs font-bold text-muted hover:text-text flex items-center gap-1 p-1 cursor-pointer'
              >
                <X size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Roster & Invitations Table */}
      <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-surface/60 border border-border rounded-2xl shadow-xs p-3'>
        {sortedPlayers.length === 0 ? (
          <div className='text-center py-16 text-xs font-bold text-muted border border-dashed border-border/40 rounded-xl flex flex-col items-center justify-center gap-2'>
            <Mail size={28} className='text-muted/40' />
            <span>No players found matching your criteria.</span>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-xs border-collapse'>
              <thead>
                <tr className='border-b border-border text-muted font-extrabold uppercase text-[10px] tracking-wider bg-surface/40'>
                  <th className='py-1.5 px-2 w-8 text-center align-middle'>
                    <Checkbox
                      checked={sortedPlayers.length > 0 && sortedPlayers.every((p: any) => selectedPlayerIds.has(p.id))}
                      onChange={() => {
                        const allSel = sortedPlayers.every((p: any) => selectedPlayerIds.has(p.id));
                        setSelectedPlayerIds(prev => {
                          const next = new Set(prev);
                          sortedPlayers.forEach((p: any) => allSel ? next.delete(p.id) : next.add(p.id));
                          return next;
                        });
                      }}
                    />
                  </th>
                  <th className='py-1.5 px-2 align-middle'>Player Name</th>
                  <th className='py-1.5 px-2 align-middle'>Tryout #</th>
                  <th className='py-1.5 px-2 align-middle'>Position</th>
                  <th className='py-1.5 px-2 align-middle'>Assigned Team</th>
                  <th className='py-1.5 px-2 align-middle'>Uniform #</th>
                  <th className='py-1.5 px-2 align-middle'>Invitation Status</th>
                  <th className='py-1.5 px-2 text-right align-middle'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border/30'>
                {sortedPlayers.map((sp: any) => {
                  const isCardSelected = selectedPlayerIds.has(sp.id);
                  const latestInv = sp.team_invitations?.[0];
                  const canEditThisPlayer = isCoordinator || (userAssignedTeamId && userAssignedTeamId === sp.season_team_id);
                  const isEditingUniform = editingUniformPlayerId === sp.id;

                  return (
                    <tr 
                      key={sp.id} 
                      className={`hover:bg-surface-hover/40 transition-colors ${
                        isCardSelected ? "bg-purple-500/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className='py-1 px-2 text-center align-middle'>
                        <div className='flex items-center justify-center h-full'>
                          <Checkbox
                            checked={isCardSelected}
                            onChange={() => {
                              setSelectedPlayerIds(prev => {
                                const next = new Set(prev);
                                next.has(sp.id) ? next.delete(sp.id) : next.add(sp.id);
                                return next;
                              });
                            }}
                          />
                        </div>
                      </td>

                      {/* Player Name */}
                      <td className='py-1 px-2 font-bold text-text truncate max-w-[150px] align-middle text-xs'>
                        <div className='flex items-center h-full'>
                          <span>{sp.players?.last_name}, {sp.players?.first_name}</span>
                        </div>
                      </td>

                      {/* Tryout # */}
                      <td className='py-1 px-2 font-semibold text-muted align-middle text-xs'>
                        <div className='flex items-center h-full'>
                          <span>#{sp.tryout_number || "N/A"}</span>
                        </div>
                      </td>

                      {/* Position */}
                      <td className='py-1 px-2 font-semibold text-text align-middle text-xs'>
                        <div className='flex items-center h-full'>
                          <span>{sp.position || "N/A"}</span>
                        </div>
                      </td>

                      {/* Assigned Team */}
                      <td className='py-1 px-2 align-middle'>
                        <div className='flex items-center h-full'>
                          {sp.season_teams ? (
                            <span className='inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20'>
                              <Shirt size={10} /> {sp.season_teams.teams?.name}
                            </span>
                          ) : (
                            <span className='text-[10px] font-medium text-muted/60 italic'>Unassigned</span>
                          )}
                        </div>
                      </td>

                      {/* Uniform Number (Editable) */}
                      <td className='py-1 px-2 align-middle'>
                        <div className='flex items-center gap-1.5 h-full'>
                          {isEditingUniform ? (
                            <div className='flex items-center gap-1'>
                              <input
                                type='text'
                                value={uniformInputValue}
                                onChange={(e) => setUniformInputValue(e.target.value)}
                                className='w-12 bg-background border border-purple-500 rounded px-1 py-0.5 text-[10px] font-extrabold text-text focus:outline-none'
                                placeholder='#'
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveUniform(sp.id)}
                                className='p-0.5 text-emerald-600 hover:bg-emerald-500/10 rounded cursor-pointer'
                                title='Save Uniform #'
                              >
                                <Save size={12} />
                              </button>
                              <button
                                onClick={() => setEditingUniformPlayerId(null)}
                                className='p-0.5 text-muted hover:text-text rounded cursor-pointer'
                                title='Cancel'
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className='flex items-center gap-1'>
                              <span className='font-black text-purple-600 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 text-[10px]'>
                                {sp.uniform_number ? `#${sp.uniform_number}` : "--"}
                              </span>
                              {canEditThisPlayer && (
                                <button
                                  onClick={() => {
                                    setEditingUniformPlayerId(sp.id);
                                    setUniformInputValue(sp.uniform_number || "");
                                  }}
                                  className='text-muted hover:text-purple-600 transition-colors p-0.5 cursor-pointer'
                                  title='Edit Uniform Number'
                                >
                                  <Edit2 size={11} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Invitation Status (Select Dropdown for Single Player Update) */}
                      <td className='py-1 px-2 align-middle'>
                        <div className='flex items-center h-full'>
                          <select
                            value={latestInv?.status || "none"}
                            onChange={(e) => handlePlayerStatusSelectChange(sp, e.target.value)}
                            disabled={!canEditThisPlayer || isPending}
                            className={`text-[10px] font-bold border rounded-md px-1.5 py-0.5 focus:outline-none cursor-pointer ${
                              latestInv?.status === "pending"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                : latestInv?.status === "accepted"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : latestInv?.status === "declined"
                                ? "bg-red-500/10 text-red-600 border-red-500/30"
                                : latestInv?.status === "expired"
                                ? "bg-surface text-muted border-border"
                                : "bg-surface text-muted/70 border-border border-dashed"
                            }`}
                          >
                            <option value='none'>Not Sent (Select to Send)</option>
                            <option value='pending'>Status: Pending</option>
                            <option value='accepted'>Status: Accepted</option>
                            <option value='declined'>Status: Declined</option>
                            <option value='expired'>Status: Expired</option>
                          </select>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className='py-1 px-2 text-right align-middle'>
                        <div className='flex items-center justify-end gap-1.5 h-full'>
                          {/* Notes Button */}
                          <button
                            onClick={() => {
                              setNotesTargetPlayer(sp);
                              setNotesModalOpen(true);
                            }}
                            className='text-muted hover:text-primary transition-colors p-1 cursor-pointer'
                            title='View/Add Coach Notes'
                          >
                            <MessageSquare size={13} />
                          </button>

                          {/* Quick Send Button */}
                          {sp.season_team_id && !latestInv && canEditThisPlayer && (
                            <Button
                              onClick={() => openSendModal(sp)}
                              variant='outline'
                              size='xs'
                              className='font-bold text-[10px] py-0.5 px-2 border-purple-500/30 text-purple-600 hover:bg-purple-500/10'
                            >
                              <Send size={11} className='mr-1' />
                              <span>Send Inv.</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Sending Single Invitation */}
      <Modal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        title={`Send Team Invitation to ${targetPlayer?.players?.first_name} ${targetPlayer?.players?.last_name}`}
        size='md'
        footer={
          <>
            <Button variant='outline' size='sm' onClick={() => setShowSendModal(false)}>
              Cancel
            </Button>
            <Button
              variant='primary'
              size='sm'
              onClick={handleConfirmSendInvitation}
              disabled={isPending}
              className='bg-purple-600 hover:bg-purple-700 text-white border-none'
            >
              {isPending ? "Sending..." : "Confirm & Send Invitation"}
            </Button>
          </>
        }
      >
        <div className='space-y-4 text-xs font-bold text-text'>
          <div className='p-3 bg-surface border border-border rounded-xl space-y-1.5'>
            <div className='flex justify-between'>
              <span className='text-muted'>Player:</span>
              <span className='font-extrabold'>{targetPlayer?.players?.first_name} {targetPlayer?.players?.last_name}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted'>Destination Team:</span>
              <span className='font-extrabold text-blue-600'>{targetPlayer?.season_teams?.teams?.name}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted'>Position & Tryout:</span>
              <span>Pos: {targetPlayer?.position || "N/A"} • #{targetPlayer?.tryout_number || "N/A"}</span>
            </div>
          </div>

          <div>
            <label className='block text-muted mb-1 uppercase tracking-wider text-[10px]'>Invitation Notes (Optional)</label>
            <textarea
              value={invitationNotes}
              onChange={(e) => setInvitationNotes(e.target.value)}
              placeholder='e.g., Please confirm acceptance by Friday evening...'
              className='w-full bg-background border border-border rounded-xl p-2.5 text-xs font-bold text-text focus:outline-none focus:border-purple-500 h-20 resize-none'
            />
          </div>
        </div>
      </Modal>

      {/* Notes Modal */}
      <NotesModal
        isOpen={notesModalOpen}
        onClose={() => {
          setNotesModalOpen(false);
          setNotesTargetPlayer(null);
        }}
        playerId={notesTargetPlayer?.player_id || notesTargetPlayer?.players?.id || null}
        playerName={notesTargetPlayer ? `${notesTargetPlayer.players?.first_name} ${notesTargetPlayer.players?.last_name}` : "Player"}
        context={{
          invitationId: notesTargetPlayer?.team_invitations?.[0]?.id,
          invitationTeamName: notesTargetPlayer?.season_teams?.teams?.name
        }}
      />

    </div>
  );
}
