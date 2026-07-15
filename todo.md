From <https://claude.ai/chat/8e0f34fd-8543-4b87-b137-421a4c8be5a9> 


Coaching App — Implementation Blueprint
Stack: Next.js, React, MySQL/MariaDB (Hostinger DB u676616277_team_creation), Prisma. Work top to bottom — each phase builds on the last and should be usable/demoable on its own before moving on.

Phase 0 — Foundations
  • [ ] Spin up a local/staging copy of u676616277_team_creation (never develop against production data)
  • [ ] Set up Next.js project (App Router) with Prisma connected to the MySQL DB
  • [ ] Run prisma db pull against the existing schema to generate a baseline Prisma schema
  • [ ] Apply coaching_app_migration.sql to the staging DB
  • [ ] Re-run prisma db pull (or hand-edit schema.prisma) to bring the new tables into Prisma
  • [ ] Decide on auth approach (NextAuth vs custom) — reuse existing users table (email/password_hash)
  • [ ] Set up basic project structure: app/, components/, lib/, hooks/
Phase 1 — Auth & Roles
  • [ ] Login/session handling against users
  • [ ] Middleware/helper to resolve a logged-in user's full permission set: 
    ○ [ ] Global role from users.role (system_admin / club_admin / coach)
    ○ [ ] Per-age-group roles from age_group_staff
    ○ [ ] Per-team coaching assignments from team_coaches
  • [ ] Central permission-check utility (e.g. can(user, action, resource)) used by every API route
  • [ ] Basic admin screen: assign/remove age_group_staff and team_coaches rows
Phase 2 — Core Data (Players, Age Groups, Seasons, Teams)
  • [ ] Season/age-group admin views (create/edit seasons, season_age_groups)
  • [ ] Player CRUD + roster import (bulk add players to players / season_players)
  • [ ] Team CRUD (teams, season_teams) — permanent teams tied to a season + age group
  • [ ] Player detail page: profile, current rating, current permanent team, note history (read-only for now)
Phase 3 — Events & Sessions
  • [ ] Event CRUD (events, event_divisions) — coordinator-only creation, scoped to their age group(s)
  • [ ] Session CRUD under an event (sessions) — multi-day support
  • [ ] Event roster screen: list all players in the age group, mark event-level availability (event_players) 
    ○ [ ] Default view hides "unavailable" players
    ○ [ ] Toggle/filter to reveal them when needed
  • [ ] Session attendance screen: mark present/absent/excused (session_players.attendance_status) 
    ○ [ ] Editable by coach or coordinator
    ○ [ ] Players marked unavailable for the event start hidden here too, same reveal toggle
Phase 4 — Fields/Groups & Drag-and-Drop Movement
  • [ ] Session fields/groups CRUD (session_fields) scoped to a session
  • [ ] "Carry over from previous session" logic — default a new session's groupings to the prior session's
  • [ ] Drag-and-drop board: players as cards, fields/groups as columns 
    ○ [ ] Desktop: native drag-and-drop (e.g. dnd-kit)
    ○ [ ] Mobile: tap-to-select, then tap-target column to assign (fallback path, same underlying action)
  • [ ] Age group coordinator override: move any player between fields at any time
Phase 5 — Ratings
  • [ ] Rating entry UI per coach, per field, per session (session_player_ratings) 
    ○ [ ] Only the entering coach's own numbers are visible/editable by them
    ○ [ ] Coordinator can see all coaches' ratings for that session
  • [ ] Aggregate session-level rating computed from session_player_ratings → stored/displayed on session_players
  • [ ] Carry-forward logic: after an event closes, update season_players.rating from the event's final ratings
  • [ ] Rating history view on player detail page (which event, which session, which coach, what score)
Phase 6 — Rankings
  • [ ] Ranking computation: group players by rating tier, auto-rank within tier → event_player_rankings
  • [ ] Coordinator "finalize" action: locks ranking, sets is_finalized / finalized_by / finalized_at
  • [ ] Coordinator override UI: manually adjust rank within a tier before finalizing
  • [ ] Event summary view: rating + rank per player, exportable/printable list for placement decisions
Phase 7 — Permanent Team Placement
  • [ ] "Place on team" action from the finalized event ranking screen → assigns season_players.season_team_id
  • [ ] Enforce one active permanent team per player (replace prior assignment if moved)
  • [ ] Age group coordinator can move players between permanent teams at any time (outside of an event too)
Phase 8 — Invitations & Uniforms
  • [ ] "Send invitation" action tied to a team placement (team_invitations, status = pending)
  • [ ] Enforce one pending invitation per player at a time (app-level check; consider a DB trigger for safety)
  • [ ] Accept/decline flow — who updates this depends on your player/parent access model (in-app coach entry vs a player-facing link — worth deciding before building)
  • [ ] Uniform number field, editable by coordinator + assigned team coach only
  • [ ] Roster/invitation status view: visible to all age-group coaches, edit-locked to coordinator + assigned coach
Phase 9 — Team-Level Ranking Events
  • [ ] Team coach can create their own ranking events, scoped only to their permanent roster
  • [ ] Reuses the same event/session/rating machinery from Phases 3–6, just scoped to one team instead of a whole age group
Phase 10 — Notes
  • [ ] Note entry UI, attachable from: a session, an event, an invitation record, or a ranking screen
  • [ ] Note feed on player detail page, tagged with context (which event/session/invitation) and author
  • [ ] Any coach can add a note; all coaches with access to that player can read it
Phase 11 — Polish, Mobile & Deployment
  • [ ] Responsive pass on every drag-and-drop / roster screen for phone-width layouts
  • [ ] Loading/empty states for all list and board views
  • [ ] Basic audit trail: who changed a rating/rank/invitation status and when (most tables already have created_at/updated_at — decide if you also want a dedicated activity log)
  • [ ] Load-test against expected scale (500-1000 players, ~50 coaches) — should be trivial for MySQL at this volume, but confirm indexes on the new tables are being used
  • [ ] Deploy pipeline to Hostinger (or wherever this ends up hosting) — confirm Node/Next.js support on the current Hostinger plan
  • [ ] Point production DB at the migrated schema, run a final backup before cutover

Suggested build order if you want a working demo early: Phases 0-4 give you a usable tryout/practice-day tool (attendance + drag-and-drop grouping) before rating/ranking/invitations even exist — that's a natural milestone to pause and get coach feedback.
