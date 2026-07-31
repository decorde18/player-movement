"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  getEventRankings, 
  updateRankings, 
  finalizeRankings 
} from "./actions";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { 
  Loader2, 
  ArrowLeft, 
  Award, 
  ShieldCheck, 
  Lock, 
  LockOpen, 
  Users, 
  Save, 
  Printer, 
  HelpCircle, 
  ArrowUpDown, 
  AlertTriangle 
} from "lucide-react";
import { toast } from "sonner";

export default function EventRankingsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = Number(params.id);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  // Active coach rankings being viewed/edited
  const [selectedCoach, setSelectedCoach] = useState<string>("");
  const [rankingsList, setRankingsList] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<Record<string, "rank" | "name" | "rating">>({
    Gold: "rank",
    Competitive: "rank",
    Development: "rank"
  });

  // Drag states
  const [draggedPlayerId, setDraggedPlayerId] = useState<number | null>(null);

  const loadData = async (coachEmail?: string) => {
    try {
      setLoading(true);
      const res = await getEventRankings(eventId, coachEmail);
      setData(res);
      setSelectedCoach(res.activeCoach);
      setRankingsList(res.rankings);
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

  // Reordering drag & drop logic
  const handleDragStart = (e: React.DragEvent, playerId: number) => {
    setDraggedPlayerId(playerId);
    e.dataTransfer.setData("text/plain", playerId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCardDrop = async (e: React.DragEvent, targetPlayerId: number, targetTier: string) => {
    e.preventDefault();
    const sourceId = Number(e.dataTransfer.getData("text/plain") || draggedPlayerId);
    if (!sourceId || sourceId === targetPlayerId) return;

    // Check if list sort is Rank
    if (sortBy[targetTier] !== "rank") {
      setSortBy(prev => ({ ...prev, [targetTier]: "rank" }));
      toast.info(`Switched ${targetTier} sorting to Rank to enable manual reordering.`);
    }

    const sourcePlayer = rankingsList.find(p => p.playerId === sourceId);
    if (!sourcePlayer) return;

    // Remove source player from list temporarily
    let updatedList = rankingsList.filter(p => p.playerId !== sourceId);

    // If tier has changed, update tier
    sourcePlayer.tier = targetTier;

    // Find position of target player
    const targetIdx = updatedList.findIndex(p => p.playerId === targetPlayerId);
    if (targetIdx !== -1) {
      // Insert source player at target position
      updatedList.splice(targetIdx, 0, sourcePlayer);
    } else {
      updatedList.push(sourcePlayer);
    }

    // Re-index ranks for the target tier
    const tierPlayers = updatedList.filter(p => p.tier === targetTier);
    tierPlayers.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    setRankingsList([...updatedList]);
    setDraggedPlayerId(null);
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

  const handleFinalize = () => {
    if (!confirm("Are you sure you want to finalize event placement rankings? This will lock all rankings and allow placing players onto teams.")) {
      return;
    }
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

  const { event, otherCoaches, isCoordinator, isFinalized, finalizedBy, finalizedAt } = data;

  const getSortedPlayers = (tier: string) => {
    const list = rankingsList.filter(p => p.tier === tier);
    const mode = sortBy[tier] || "rank";

    if (mode === "name") {
      return [...list].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
    }
    if (mode === "rating") {
      return [...list].sort((a, b) => b.rating - a.rating);
    }
    return [...list].sort((a, b) => a.rank - b.rank);
  };

  const tiers = ["Gold", "Competitive", "Development"];

  return (
    <div className='space-y-6 w-full flex flex-col animate-fadeIn print:bg-white print:text-black'>
      
      {/* Top Navigation Bar */}
      <div className='flex items-center justify-between bg-surface/60 border border-border p-4 rounded-2xl shadow-sm backdrop-blur-md print:hidden'>
        <div className='flex items-center gap-3'>
          <Link
            href={`/admin/events`}
            className='p-2 rounded-lg border border-border bg-background text-muted hover:text-text transition-all cursor-pointer'
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <span className='text-[10px] font-extrabold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20'>
              Event Rankings Dashboard
            </span>
            <h1 className='text-xl font-extrabold text-text mt-0.5'>
              {event.name}
            </h1>
          </div>
        </div>

        <div className='flex items-center gap-2.5'>
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
              onClick={handleFinalize}
              variant='primary'
              size='sm'
              disabled={isPending}
              className='flex items-center gap-1.5 font-bold text-xs bg-accent hover:bg-accent-hover text-white border-none'
            >
              <Lock size={14} />
              <span>Finalize Placement Ranks</span>
            </Button>
          )}
        </div>
      </div>

      {/* Finalization status alert */}
      {isFinalized && (
        <div className='bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-600 animate-pulse text-xs font-bold print:border-red-600'>
          <Lock size={18} />
          <div>
            <span className='block text-sm font-extrabold'>Rankings Finalized & Locked</span>
            <span className='block text-[10px] font-bold text-muted mt-0.5'>
              Finalized by {finalizedBy} on {new Date(finalizedAt).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Roster Controls Ribbon */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden'>
        <Card className='p-4 flex items-center gap-3 bg-surface/50 border-border'>
          <div className='w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0'>
            <Users size={20} />
          </div>
          <div>
            <span className='text-[10px] font-extrabold text-muted uppercase tracking-wider block'>Active Rankings Owner</span>
            <span className='text-sm font-bold text-text truncate max-w-[200px] block'>{selectedCoach}</span>
          </div>
        </Card>

        {isCoordinator && (
          <Card className='p-4 flex items-center gap-3 bg-surface/50 border-border'>
            <div className='w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0'>
              <ShieldCheck size={20} />
            </div>
            <div className='flex-1 min-w-0'>
              <span className='text-[10px] font-extrabold text-muted uppercase tracking-wider block'>Coordinator: View Coach Ranks</span>
              <select
                value={selectedCoach}
                onChange={(e) => handleCoachChange(e.target.value)}
                className='text-xs font-bold bg-background border border-border rounded-lg px-2 py-1.5 mt-1 text-text focus:outline-none cursor-pointer w-full'
              >
                <option value={data.activeCoach}>My Rankings (Coordinator)</option>
                {otherCoaches
                  .filter((email: string) => email !== data.activeCoach)
                  .map((email: string) => (
                    <option key={email} value={email}>
                      Coach: {email}
                    </option>
                  ))}
              </select>
            </div>
          </Card>
        )}

        <Card className='p-4 flex items-center gap-3 bg-surface/50 border-border'>
          <div className='w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0'>
            <HelpCircle size={20} />
          </div>
          <div>
            <span className='text-[10px] font-extrabold text-muted uppercase tracking-wider block'>Rankings Instructions</span>
            <span className='text-xs text-muted block mt-0.5 leading-relaxed'>
              Drag & drop cards on top of each other within columns to swap placement ranks. Saving updates is coach-specific.
            </span>
          </div>
        </Card>
      </div>

      {/* Print-only Header */}
      <div className='hidden print:block mb-6 border-b pb-4'>
        <h1 className='text-2xl font-bold'>{event.name} — Placement Rankings List</h1>
        <p className='text-sm text-gray-600 mt-1'>
          Finalized Status: {isFinalized ? `Finalized by ${finalizedBy} on ${new Date(finalizedAt).toLocaleDateString()}` : "Draft rankings"}
        </p>
      </div>

      {/* Main rankings columns grid */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[50vh]'>
        {tiers.map((tierName) => {
          const sortedList = getSortedPlayers(tierName);
          
          return (
            <div 
              key={tierName}
              className='flex flex-col bg-surface/40 border border-border rounded-2xl p-4 space-y-4 print:border-gray-300 print:bg-white'
            >
              {/* Header */}
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <div>
                  <h3 className='font-extrabold text-sm text-text flex items-center gap-2'>
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      tierName === "Gold" ? "bg-amber-400" : tierName === "Competitive" ? "bg-blue-400" : "bg-zinc-400"
                    }`} />
                    {tierName} Tier
                  </h3>
                  <span className='text-[10px] font-bold text-muted'>
                    {sortedList.length} {sortedList.length === 1 ? "Player" : "Players"} Listed
                  </span>
                </div>

                <div className='flex items-center gap-2 print:hidden'>
                  <ArrowUpDown size={12} className='text-muted' />
                  <select
                    value={sortBy[tierName] || "rank"}
                    onChange={(e) => setSortBy(prev => ({ ...prev, [tierName]: e.target.value as any }))}
                    className='text-[10px] font-extrabold bg-background hover:bg-surface border border-border rounded-md px-2 py-1 text-muted hover:text-text cursor-pointer focus:outline-none'
                  >
                    <option value='rank'>Sort: Rank</option>
                    <option value='rating'>Sort: Rating</option>
                    <option value='name'>Sort: Name</option>
                  </select>
                </div>
              </div>

              {/* Scrollable list */}
              <div className='flex-1 space-y-2.5 min-h-[40vh] overflow-y-auto max-h-[60vh] custom-scrollbar'>
                {sortedList.length === 0 ? (
                  <div className='text-center py-12 text-xs text-muted/40 font-bold border border-dashed border-border/20 rounded-xl'>
                    No players in this tier.
                  </div>
                ) : (
                  sortedList.map((p, idx) => (
                    <div
                      key={p.playerId}
                      draggable={!isFinalized}
                      onDragStart={(e) => handleDragStart(e, p.playerId)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleCardDrop(e, p.playerId, tierName)}
                      className={`p-3.5 bg-surface border border-border rounded-xl flex items-center justify-between gap-3 shadow-xs select-none transition-all ${
                        !isFinalized ? "hover:border-primary/40 cursor-grab active:cursor-grabbing" : ""
                      } print:border-gray-300 print:shadow-none`}
                    >
                      <div className='flex items-center gap-3 min-w-0'>
                        {/* Rank Badge */}
                        <span className='w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0 border border-primary/20'>
                          #{p.rank}
                        </span>

                        <div className='min-w-0'>
                          <span className='block text-xs font-bold text-text truncate'>
                            {p.lastName}, {p.firstName}
                          </span>
                          <span className='block text-[10px] font-bold text-muted mt-0.5'>
                            Tryout #{p.tryoutNumber || "N/A"} • Pos: {p.position || "N/A"}
                          </span>
                        </div>
                      </div>

                      <div className='flex items-center gap-1.5 shrink-0'>
                        <span className='text-[10px] font-extrabold bg-accent/10 text-accent px-1.5 py-0.5 rounded border border-accent/20'>
                          {p.rating ? p.rating.toFixed(1) : "0.0"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
