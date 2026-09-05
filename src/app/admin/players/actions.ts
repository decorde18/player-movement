"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { getActiveSeasonId } from "@/lib/actions/season-actions";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isFuzzyNameMatch, normalizeName } from "@/lib/utils/fuzzyMatch";

export interface GuardianInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  relationship?: string;
}

export interface PlayerInput {
  id?: number; // Optional ID for updates
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD format
  gender: string;
  club_id: number;
  season_age_group_id?: number;
  tryout_number?: string;
  position?: string;
  rating?: number;
  playing_up?: boolean;
  parent_first_name?: string;
  parent_last_name?: string;
  parent_email?: string;
  parent_phone?: string;
  guardians?: GuardianInput[];
}

/**
 * Helper to save/link guardians for a player
 */
async function savePlayerGuardians(
  tx: any,
  playerId: number,
  input: PlayerInput,
  cache?: { emailMap: Map<string, any>; nameMap: Map<string, any> }
) {
  const guardianList: GuardianInput[] = input.guardians ? [...input.guardians] : [];

  if (
    guardianList.length === 0 &&
    (input.parent_first_name || input.parent_last_name || input.parent_email || input.parent_phone)
  ) {
    guardianList.push({
      first_name: input.parent_first_name || "Parent",
      last_name: input.parent_last_name || "",
      email: input.parent_email || undefined,
      phone: input.parent_phone || undefined,
      relationship: "parent",
    });
  }

  for (const g of guardianList) {
    const fName = (g.first_name || "").trim();
    const lName = (g.last_name || "").trim();
    const emailStr = (g.email || "").trim().toLowerCase();
    const phoneStr = (g.phone || "").trim();

    if (!fName && !lName && !emailStr && !phoneStr) continue;

    let guardian = null;

    if (cache && emailStr && cache.emailMap.has(emailStr)) {
      guardian = cache.emailMap.get(emailStr);
    } else if (cache && fName && lName && cache.nameMap.has(`${fName.toLowerCase()}:${lName.toLowerCase()}`)) {
      guardian = cache.nameMap.get(`${fName.toLowerCase()}:${lName.toLowerCase()}`);
    } else if (emailStr) {
      guardian = await tx.guardians.findFirst({
        where: { email: emailStr },
      });
    } else if (fName && lName) {
      guardian = await tx.guardians.findFirst({
        where: {
          first_name: fName,
          last_name: lName,
        },
      });
    }

    if (guardian) {
      guardian = await tx.guardians.update({
        where: { id: guardian.id },
        data: {
          first_name: fName || guardian.first_name,
          last_name: lName || guardian.last_name,
          ...(emailStr ? { email: emailStr } : {}),
          ...(phoneStr ? { phone: phoneStr } : {}),
        },
      });
    } else {
      guardian = await tx.guardians.create({
        data: {
          first_name: fName || "Parent",
          last_name: lName || "",
          email: emailStr || null,
          phone: phoneStr || null,
        },
      });
    }

    if (cache) {
      if (guardian.email) cache.emailMap.set(guardian.email.trim().toLowerCase(), guardian);
      if (guardian.first_name && guardian.last_name) {
        cache.nameMap.set(`${guardian.first_name.trim().toLowerCase()}:${guardian.last_name.trim().toLowerCase()}`, guardian);
      }
    }

    await tx.player_guardians.upsert({
      where: {
        player_id_guardian_id: {
          player_id: playerId,
          guardian_id: guardian.id,
        },
      },
      update: {
        relationship: g.relationship || "parent",
      },
      create: {
        player_id: playerId,
        guardian_id: guardian.id,
        relationship: g.relationship || "parent",
        is_primary: true,
      },
    });
  }
}

/**
 * Fetch all scope-filtered player registry data, clubs, seasons, and age groups
 */
export async function getPlayersData() {
  const session = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const activeSeasonId = await getActiveSeasonId();
  const scope = getScopeFilters(session, activeClubId);

  const clubFilter = scope.filters.club();
  const seasonFilter = scope.filters.season();

  const cookieStore = await cookies();
  const activeAgeGroupIdStr = cookieStore.get("activeAgeGroupId")?.value;
  const activeAgeGroupId = activeAgeGroupIdStr ? parseInt(activeAgeGroupIdStr, 10) : null;

  // Filter players by activeAgeGroupId if selected
  const playerFilter = {
    ...scope.filters.player(),
    ...(activeAgeGroupId
      ? {
          season_players: {
            some: {
              season_age_group_id: activeAgeGroupId,
            },
          },
        }
      : {}),
  };

  const [players, clubs, seasons, seasonAgeGroups, events] = await Promise.all([
    db.players.findMany({
      where: playerFilter,
      include: {
        player_guardians: {
          include: {
            guardians: true,
          },
        },
        season_players: {
          include: {
            season_age_groups: {
              include: {
                seasons: true,
                age_groups: true,
              },
            },
            clubs: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    }),
    db.clubs.findMany({
      where: clubFilter,
      orderBy: { name: "asc" },
    }),
    db.seasons.findMany({
      where: seasonFilter,
      include: {
        season_age_groups: {
          include: {
            age_groups: true,
          },
        },
      },
      orderBy: { start_date: "desc" },
    }),
    db.season_age_groups.findMany({
      where: {
        seasons: seasonFilter,
      },
      include: {
        seasons: true,
        age_groups: true,
      },
      orderBy: [
        { seasons: { start_date: "desc" } },
        { age_groups: { name: "asc" } },
      ],
    }),
    db.events.findMany({
      where: {
        seasons: seasonFilter,
      },
      select: {
        id: true,
        name: true,
        season_id: true,
      },
      orderBy: { created_at: "desc" },
    }),
  ]);

  // Map players to retain compatibility with frontend components expecting `club_id` and `clubs` properties directly on the player object.
  const mappedPlayers = players.map((p) => {
    // If the user is a club admin or system admin with a club scope, scope to that club; otherwise, fall back to the first seasonal registration.
    const activeClubId = (scope.isClubAdmin || (scope.isSystemAdmin && scope.clubId))
      ? scope.clubId
      : p.season_players?.[0]?.club_id || null;

    const matchedSeasonPlayer = activeClubId
      ? p.season_players.find((sp) => sp.club_id === activeClubId)
      : p.season_players?.[0];

    const primaryGuardian = p.player_guardians?.[0]?.guardians || null;

    return {
      ...p,
      club_id: activeClubId,
      clubs: matchedSeasonPlayer?.clubs || null,
      primaryGuardian,
      parent_name: primaryGuardian ? `${primaryGuardian.first_name} ${primaryGuardian.last_name}`.trim() : null,
      parent_email: primaryGuardian?.email || null,
      parent_phone: primaryGuardian?.phone || null,
    };
  });

  return {
    players: mappedPlayers,
    clubs,
    seasons,
    seasonAgeGroups,
    events,
    activeSeasonId,
    userScope: {
      role: scope.role,
      clubId: scope.clubId,
      isSystemAdmin: scope.isSystemAdmin,
    },
  };
}

/**
 * Creates or updates a player, handling global identity lookup and seasonal registrations.
 */
export async function createPlayer(input: PlayerInput) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Security Check: Club Admin is restricted to their own club scope
    if (scope.isClubAdmin && input.club_id !== scope.clubId) {
      return { success: false, error: "Access Denied: Cannot manage players outside your club." };
    }

    const birthDate = input.date_of_birth ? new Date(input.date_of_birth) : null;

    const updatedOrNewPlayer = await db.$transaction(async (tx) => {
      let player;

      if (input.id) {
        // 1. Update existing player details globally
        player = await tx.players.update({
          where: { id: input.id },
          data: {
            first_name: input.first_name,
            last_name: input.last_name,
            date_of_birth: birthDate,
            gender: input.gender,
          },
        });

        // 2. Update seasonal registration if specified
        if (input.season_age_group_id) {
          let isPlayingUp = input.playing_up ?? false;
          if (!isPlayingUp && birthDate) {
            const sag = await tx.season_age_groups.findUnique({
              where: { id: input.season_age_group_id },
              include: { age_groups: true },
            });
            if (sag?.age_groups?.dob_start && birthDate > new Date(sag.age_groups.dob_start)) {
              isPlayingUp = true;
            }
          }

          const existingSp = await tx.season_players.findFirst({
            where: {
              player_id: player.id,
              club_id: input.club_id,
            },
          });

          if (existingSp) {
            await tx.season_players.update({
              where: { id: existingSp.id },
              data: {
                season_age_group_id: input.season_age_group_id,
                tryout_number: input.tryout_number !== undefined ? input.tryout_number : existingSp.tryout_number,
                position: input.position !== undefined ? input.position : existingSp.position,
                rating: input.rating !== undefined ? Number(input.rating) : existingSp.rating,
                playing_up: isPlayingUp,
              },
            });
          } else {
            await tx.season_players.create({
              data: {
                player_id: player.id,
                season_age_group_id: input.season_age_group_id,
                club_id: input.club_id,
                tryout_number: input.tryout_number || null,
                position: input.position || null,
                rating: Number(input.rating) || 0,
                player_status: "none",
                playing_up: isPlayingUp,
              },
            });
          }
        }
      } else {
        // 1. Identity Deduplication: Try to find an existing physical player record globally
        const existingPlayer = await tx.players.findFirst({
          where: {
            first_name: input.first_name,
            last_name: input.last_name,
            date_of_birth: birthDate,
            gender: input.gender,
          },
        });

        if (existingPlayer) {
          player = existingPlayer;
        } else {
          // Create a new global physical player registry record
          player = await tx.players.create({
            data: {
              first_name: input.first_name,
              last_name: input.last_name,
              date_of_birth: birthDate,
              gender: input.gender,
            },
          });
        }

        // 2. Map to Season Age Group for this specific club
        if (input.season_age_group_id) {
          let isPlayingUp = input.playing_up ?? false;
          if (!isPlayingUp && birthDate) {
            const sag = await tx.season_age_groups.findUnique({
              where: { id: input.season_age_group_id },
              include: { age_groups: true },
            });
            if (sag?.age_groups?.dob_start && birthDate > new Date(sag.age_groups.dob_start)) {
              isPlayingUp = true;
            }
          }

          const existingSp = await tx.season_players.findFirst({
            where: {
              player_id: player.id,
              season_age_group_id: input.season_age_group_id,
              club_id: input.club_id,
            },
          });

          if (existingSp) {
            await tx.season_players.update({
              where: { id: existingSp.id },
              data: {
                tryout_number: input.tryout_number !== undefined ? input.tryout_number : existingSp.tryout_number,
                position: input.position !== undefined ? input.position : existingSp.position,
                rating: input.rating !== undefined ? Number(input.rating) : existingSp.rating,
                playing_up: isPlayingUp,
              },
            });
          } else {
            await tx.season_players.create({
              data: {
                player_id: player.id,
                season_age_group_id: input.season_age_group_id,
                club_id: input.club_id,
                tryout_number: input.tryout_number || null,
                position: input.position || null,
                rating: Number(input.rating) || 0,
                player_status: "none",
                playing_up: isPlayingUp,
              },
            });
          }
        }
      }

      await savePlayerGuardians(tx, player.id, input);

      return player;
    });

    // Auto-sync event and session rosters for the player's assigned division
    if (input.season_age_group_id) {
      try {
        const sag = await db.season_age_groups.findUnique({
          where: { id: input.season_age_group_id },
          select: { season_id: true },
        });

        if (sag?.season_id) {
          const events = await db.events.findMany({
            where: { season_id: sag.season_id },
            include: {
              event_divisions: true,
              sessions: true,
            },
          });

          for (const event of events) {
            const divSagIds = event.event_divisions.map((ed) => ed.season_age_group_id);
            if (divSagIds.length === 0 || divSagIds.includes(input.season_age_group_id)) {
              await db.event_players.upsert({
                where: {
                  event_id_player_id: {
                    event_id: event.id,
                    player_id: updatedOrNewPlayer.id,
                  },
                },
                update: { availability_status: "available" },
                create: {
                  event_id: event.id,
                  player_id: updatedOrNewPlayer.id,
                  availability_status: "available",
                },
              });

              for (const sess of event.sessions) {
                if (!sess.season_age_group_id || sess.season_age_group_id === input.season_age_group_id) {
                  await db.session_players.upsert({
                    where: {
                      session_id_player_id: {
                        session_id: sess.id,
                        player_id: updatedOrNewPlayer.id,
                      },
                    },
                    update: { attendance_status: "present" },
                    create: {
                      session_id: sess.id,
                      player_id: updatedOrNewPlayer.id,
                      attendance_status: "present",
                    },
                  });
                }
              }
            }
          }
        }
      } catch (syncErr) {
        console.error("Auto roster sync error in createPlayer:", syncErr);
      }
    }

    revalidatePath("/admin/players");
    revalidatePath("/admin/events");
    return { success: true, player: updatedOrNewPlayer };
  } catch (error: any) {
    console.error("createPlayer Error:", error);
    return { success: false, error: error.message || "Failed to save player." };
  }
}

export interface DuplicateCheckResult {
  index: number;
  input: PlayerInput;
  matchType: "exact" | "fuzzy" | "none";
  existingPlayer?: {
    id: number;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    gender: string;
  };
}

/**
 * Checks parsed CSV rows against database to identify exact or fuzzy duplicate player matches.
 */
export async function findPotentialDuplicatePlayers(playersList: PlayerInput[]): Promise<{ success: boolean; results?: DuplicateCheckResult[]; error?: string }> {
  try {
    const session = await getServerAuthSession();
    const activeClubId = await getActiveClubId();
    const scope = getScopeFilters(session, activeClubId);

    const existingPlayers = await db.players.findMany({
      where: scope.filters.player(),
      select: {
        id: true,
        first_name: true,
        last_name: true,
        date_of_birth: true,
        gender: true,
      },
    });

    const results: DuplicateCheckResult[] = [];

    for (let idx = 0; idx < playersList.length; idx++) {
      const p = playersList[idx];
      const pDob = p.date_of_birth ? new Date(p.date_of_birth).toISOString().split("T")[0] : null;
      const pLast = normalizeName(p.last_name);
      const pFirst = normalizeName(p.first_name);

      let matchedPlayer: any = null;
      let matchType: "exact" | "fuzzy" | "none" = "none";

      if (pDob && pLast) {
        for (const ex of existingPlayers) {
          const exDob = ex.date_of_birth ? new Date(ex.date_of_birth).toISOString().split("T")[0] : null;
          const exLast = normalizeName(ex.last_name);
          const exFirst = normalizeName(ex.first_name);

          if (exDob === pDob && exLast === pLast) {
            if (exFirst === pFirst) {
              matchedPlayer = ex;
              matchType = "exact";
              break;
            } else if (isFuzzyNameMatch(p.first_name, ex.first_name)) {
              matchedPlayer = ex;
              matchType = "fuzzy";
              break;
            }
          }
        }
      }

      results.push({
        index: idx,
        input: p,
        matchType,
        existingPlayer: matchedPlayer ? {
          id: matchedPlayer.id,
          first_name: matchedPlayer.first_name,
          last_name: matchedPlayer.last_name,
          date_of_birth: matchedPlayer.date_of_birth ? matchedPlayer.date_of_birth.toISOString().split("T")[0] : null,
          gender: matchedPlayer.gender,
        } : undefined,
      });
    }

    return { success: true, results };
  } catch (error: any) {
    console.error("findPotentialDuplicatePlayers Error:", error);
    return { success: false, error: error.message || "Failed to check duplicates." };
  }
}

export interface DuplicateResolution {
  action: "update" | "create";
  targetPlayerId?: number;
}

/**
 * Bulk import players from parsed CSV data, using global deduplication and field updating.
 */
export async function bulkImportPlayers(
  playersList: PlayerInput[],
  targetSeasonId?: number,
  targetEventId?: number,
  duplicateResolutions?: Record<number, DuplicateResolution>
) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    if (playersList.length === 0) {
      return { success: false, error: "Empty player list." };
    }

    // Security check for Club Admins
    if (scope.isClubAdmin) {
      const invalidClub = playersList.some((p) => p.club_id !== scope.clubId);
      if (invalidClub) {
        return { success: false, error: "Access Denied: One or more players do not match your club scope." };
      }
    }

    const activeDivisions = targetSeasonId
      ? await db.season_age_groups.findMany({
          where: { season_id: targetSeasonId },
          include: { age_groups: true },
        })
      : [];

    // Pre-fetch existing guardians into memory cache for zero-roundtrip lookups during batch import
    const allGuardians = await db.guardians.findMany();
    const guardianCache = {
      emailMap: new Map<string, any>(),
      nameMap: new Map<string, any>(),
    };
    allGuardians.forEach((g) => {
      if (g.email) guardianCache.emailMap.set(g.email.trim().toLowerCase(), g);
      if (g.first_name && g.last_name) {
        guardianCache.nameMap.set(`${g.first_name.trim().toLowerCase()}:${g.last_name.trim().toLowerCase()}`, g);
      }
    });

    // Process players in batches of 15 per transaction to prevent remote database timeouts
    const BATCH_SIZE = 15;
    const results = [];

    for (let i = 0; i < playersList.length; i += BATCH_SIZE) {
      const chunk = playersList.slice(i, i + BATCH_SIZE);
      const chunkResults = await db.$transaction(
        async (tx) => {
          const imported = [];

          for (let cIdx = 0; cIdx < chunk.length; cIdx++) {
            const globalIdx = i + cIdx;
            const p = chunk[cIdx];
            const resolution = duplicateResolutions?.[globalIdx];
            const birthDate = p.date_of_birth ? new Date(p.date_of_birth) : null;

            let player;

            if (resolution?.action === "update" && resolution.targetPlayerId) {
              // Update existing physical player record
              player = await tx.players.update({
                where: { id: resolution.targetPlayerId },
                data: {
                  first_name: p.first_name,
                  last_name: p.last_name,
                  ...(birthDate ? { date_of_birth: birthDate } : {}),
                  gender: p.gender,
                },
              });
            } else {
              // 1. Identity Deduplication: Try to find an existing physical player globally
              player = await tx.players.findFirst({
                where: {
                  first_name: p.first_name,
                  last_name: p.last_name,
                  date_of_birth: birthDate,
                  gender: p.gender,
                },
              });

              if (player) {
                // Update fields on match
                player = await tx.players.update({
                  where: { id: player.id },
                  data: {
                    first_name: p.first_name,
                    last_name: p.last_name,
                    ...(birthDate ? { date_of_birth: birthDate } : {}),
                    gender: p.gender,
                  },
                });
              } else {
                player = await tx.players.create({
                  data: {
                    first_name: p.first_name,
                    last_name: p.last_name,
                    date_of_birth: birthDate,
                    gender: p.gender,
                  },
                });
              }
            }

            // Save / link parent guardian info using memory cache
            await savePlayerGuardians(tx, player.id, p, guardianCache);

            // Determine target division ID
            let matchedDivisionId = p.season_age_group_id;

            if (!matchedDivisionId && birthDate && activeDivisions.length > 0) {
              const matched = activeDivisions.find((div) => {
                const ageGroup = div.age_groups;
                if (!ageGroup) return false;

                const dobStart = new Date(ageGroup.dob_start);
                const dobEnd = new Date(ageGroup.dob_end);
                const inDobRange = birthDate >= dobStart && birthDate <= dobEnd;
                if (!inDobRange) return false;

                const playerGenderLower = (p.gender || "Coed").toLowerCase();
                const divGenderLower = (div.gender || "Coed").toLowerCase();

                if (divGenderLower === "coed") return true;
                if (playerGenderLower === "boy" && divGenderLower === "boys") return true;
                if (playerGenderLower === "girl" && divGenderLower === "girls") return true;
                if (playerGenderLower === divGenderLower) return true;

                return false;
              });

              if (matched) {
                matchedDivisionId = matched.id;
              }
            }

            // 2. Create/update seasonal registration
            if (matchedDivisionId) {
              const existingSp = await tx.season_players.findFirst({
                where: {
                  player_id: player.id,
                  season_age_group_id: matchedDivisionId,
                  club_id: p.club_id,
                },
              });

              if (existingSp) {
                await tx.season_players.update({
                  where: { id: existingSp.id },
                  data: {
                    tryout_number: p.tryout_number !== undefined ? p.tryout_number : existingSp.tryout_number,
                    position: p.position !== undefined ? p.position : existingSp.position,
                    rating: p.rating !== undefined ? Number(p.rating) : existingSp.rating,
                  },
                });
              } else {
                await tx.season_players.create({
                  data: {
                    player_id: player.id,
                    season_age_group_id: matchedDivisionId,
                    club_id: p.club_id,
                    tryout_number: p.tryout_number || null,
                    position: p.position || null,
                    rating: Number(p.rating) || 0,
                    player_status: "none",
                  },
                });
              }
            }

            imported.push(player);
          }

          return imported;
        },
        {
          maxWait: 30000,
          timeout: 180000, // 3 minutes timeout per batch of 15 players
        }
      );

      results.push(...chunkResults);
    }

    // Handle targetEventId specific event registration & availability
    if (targetEventId && results.length > 0) {
      const importedPlayerIds = new Set(results.map((p) => p.id));

      const targetEvt = await db.events.findUnique({
        where: { id: targetEventId },
        include: {
          event_divisions: true,
          sessions: { select: { id: true, season_age_group_id: true } },
        },
      });

      if (targetEvt) {
        const divSagIds = targetEvt.event_divisions.map((ed) => ed.season_age_group_id);

        const allDivSeasonPlayers = await db.season_players.findMany({
          where: {
            season_age_group_id: { in: divSagIds },
            ...(scope.isClubAdmin ? { club_id: scope.clubId } : {}),
          },
          select: { player_id: true, season_age_group_id: true },
        });

        const allDivPlayerIds = [...new Set(allDivSeasonPlayers.map((sp) => sp.player_id))];

        for (const pid of allDivPlayerIds) {
          const isImported = importedPlayerIds.has(pid);
          const status = isImported ? ("available" as const) : ("unavailable" as const);

          await db.event_players.upsert({
            where: {
              event_id_player_id: {
                event_id: targetEventId,
                player_id: pid,
              },
            },
            update: {
              availability_status: status,
            },
            create: {
              event_id: targetEventId,
              player_id: pid,
              availability_status: status,
            },
          });

          if (isImported) {
            const playerSagId = allDivSeasonPlayers.find((sp) => sp.player_id === pid)?.season_age_group_id;
            for (const sess of targetEvt.sessions) {
              if (!sess.season_age_group_id || sess.season_age_group_id === playerSagId) {
                await db.session_players.upsert({
                  where: {
                    session_id_player_id: {
                      session_id: sess.id,
                      player_id: pid,
                    },
                  },
                  update: {
                    attendance_status: "present",
                  },
                  create: {
                    session_id: sess.id,
                    player_id: pid,
                    attendance_status: "present",
                  },
                });
              }
            }
          }
        }
      }
    } else if (targetSeasonId && results.length > 0) {
      // Auto-sync event and session rosters for the season if importing by season
      await syncSeasonRosters(targetSeasonId);
    }

    revalidatePath("/admin/players");
    revalidatePath("/admin/events");
    return { success: true, count: results.length };
  } catch (error: any) {
    console.error("bulkImportPlayers Error:", error);
    return { success: false, error: error.message || "Bulk import failed." };
  }
}

/**
 * Auto syncs all players in a season to active events and sessions
 */
export async function syncSeasonRosters(seasonId?: number) {
  try {
    const session = await getServerAuthSession();
    const activeClubId = await getActiveClubId();
    const scope = getScopeFilters(session, activeClubId);

    const seasonWhere = seasonId ? { id: seasonId } : scope.filters.season();

    const seasons = await db.seasons.findMany({
      where: seasonWhere,
      include: {
        events: {
          include: {
            event_divisions: true,
            sessions: true,
          },
        },
        season_age_groups: {
          include: {
            age_groups: true,
          },
        },
      },
    });

    let totalEventPlayersAdded = 0;
    let totalSessionPlayersAdded = 0;

    for (const s of seasons) {
      const sagIds = s.season_age_groups.map((sag) => sag.id);
      const seasonPlayers = await db.season_players.findMany({
        where: {
          season_age_group_id: { in: sagIds },
        },
      });

      for (const event of s.events) {
        const divSagIds = event.event_divisions.map((ed) => ed.season_age_group_id);
        const eligible = seasonPlayers.filter((sp) =>
          divSagIds.length === 0 || divSagIds.includes(sp.season_age_group_id)
        );

        const playerIds = [...new Set(eligible.map((sp) => sp.player_id))];

        if (playerIds.length > 0) {
          const epRes = await db.event_players.createMany({
            data: playerIds.map((pid) => ({
              event_id: event.id,
              player_id: pid,
              availability_status: "available" as const,
            })),
            skipDuplicates: true,
          });
          totalEventPlayersAdded += epRes.count;
        }

        for (const sessionItem of event.sessions) {
          let sessPlayerIds = playerIds;
          if (sessionItem.season_age_group_id) {
            const targetSag = s.season_age_groups.find((sag) => sag.id === sessionItem.season_age_group_id);
            const targetDobStart = targetSag?.age_groups?.dob_start ? new Date(targetSag.age_groups.dob_start).getTime() : null;

            sessPlayerIds = eligible
              .filter((sp) => {
                if (sp.season_age_group_id === sessionItem.season_age_group_id) return true;
                if (sp.playing_up && targetDobStart) {
                  const spSag = s.season_age_groups.find((sag) => sag.id === sp.season_age_group_id);
                  if (
                    spSag &&
                    spSag.gender === targetSag?.gender &&
                    spSag.age_groups?.dob_start &&
                    new Date(spSag.age_groups.dob_start).getTime() > targetDobStart
                  ) {
                    return true;
                  }
                }
                return false;
              })
              .map((sp) => sp.player_id);
            sessPlayerIds = [...new Set(sessPlayerIds)];
          }

          if (sessPlayerIds.length > 0) {
            const spRes = await db.session_players.createMany({
              data: sessPlayerIds.map((pid) => ({
                session_id: sessionItem.id,
                player_id: pid,
                attendance_status: "present" as const,
              })),
              skipDuplicates: true,
            });
            totalSessionPlayersAdded += spRes.count;
          }
        }
      }
    }

    revalidatePath("/admin/events");
    revalidatePath("/admin/players");
    return {
      success: true,
      eventPlayersAdded: totalEventPlayersAdded,
      sessionPlayersAdded: totalSessionPlayersAdded,
    };
  } catch (error: any) {
    console.error("syncSeasonRosters Error:", error);
    return { success: false, error: error.message || "Failed to sync rosters." };
  }
}

/**
 * Deletes a player registration. If they are in multiple clubs, deletes only the active club association.
 */
export async function deletePlayer(playerId: number) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Verify player existence
    const player = await db.players.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return { success: false, error: "Player not found." };
    }

    if (scope.isClubAdmin) {
      // Find this club's seasonal registration
      const assoc = await db.season_players.findFirst({
        where: {
          player_id: playerId,
          club_id: scope.clubId,
        },
      });

      if (!assoc) {
        return { success: false, error: "Access Denied: Player not registered in your club." };
      }

      // Delete the seasonal registration
      await db.season_players.delete({
        where: { id: assoc.id },
      });

      // If the player has no other club associations left, clean up the global player profile
      const remainingAssocs = await db.season_players.findFirst({
        where: { player_id: playerId },
      });

      if (!remainingAssocs) {
        await db.players.delete({
          where: { id: playerId },
        });
      }
    } else {
      // System admins can delete the player globally, cascading deletions to all associations
      await db.players.delete({
        where: { id: playerId },
      });
    }

    revalidatePath("/admin/players");
    return { success: true };
  } catch (error: any) {
    console.error("deletePlayer Error:", error);
    return { success: false, error: error.message || "Failed to delete player." };
  }
}
