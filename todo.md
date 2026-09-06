From <https://claude.ai/chat/8e0f34fd-8543-4b87-b137-421a4c8be5a9>

Coaching App — Implementation Blueprint
Stack: Next.js, React, MySQL/MariaDB (Hostinger DB u676616277_team_creation), Prisma. Work top to bottom — each phase builds on the last and should be usable/demoable on its own before moving on.

Phase 0 — Foundations
• [x] Spin up a local/staging copy of u676616277_team_creation (never develop against production data)
• [x] Set up Next.js project (App Router) with Prisma connected to the MySQL DB
• [x] Run prisma db pull against the existing schema to generate a baseline Prisma schema
• [x] Apply coaching_app_migration.sql to the staging DB
• [x] Re-run prisma db pull (or hand-edit schema.prisma) to bring the new tables into Prisma
• [x] Decide on auth approach (NextAuth vs custom) — reuse existing users table (email/password_hash)
• [x] Set up basic project structure: app/, components/, lib/, hooks/
Phase 1 — Auth & Roles
• [x] Login/session handling against users
• [x] Middleware/helper to resolve a logged-in user's full permission set:
○ [x] Global role from users.role (system_admin / club_admin / coach)
○ [x] Per-age-group roles from user.assigned_age_group_id
○ [x] Per-team coaching assignments from user.assigned_team_id
• [x] Central permission-check utility (e.g. can(user, action, resource)) used by every API route
• [x] Basic admin screen: assign/remove user roles, club, age group, and team scopes (Staff Registry)
Phase 2 — Core Data (Players, Age Groups, Seasons, Teams)
• [x] Season/age-group admin views (create/edit seasons, season_age_groups)
• [x] Player CRUD + roster import (bulk add players to players / season_players)
• [x] Team CRUD (teams, season_teams) — permanent teams tied to a season + age group
• [x] Player detail page: profile, current rating, current permanent team, note history (timeline + note CRUD)
Phase 3 — Events & Sessions
• [x] Event CRUD (events, event_divisions) — coordinator-only creation, scoped to their age group(s)
• [x] Session CRUD under an event (sessions) — multi-day support
• [x] Event roster screen: list all players in the age group, mark event-level availability (event_players)
○ [x] Default view hides "unavailable" players
○ [x] Toggle/filter to reveal them when needed
• [x] Session attendance screen: mark present/absent/excused (session_players.attendance_status)
○ [x] Editable by coach or coordinator
○ [x] Players marked unavailable for the event start hidden here too, same reveal toggle

<!-- Club Seasons are not auto creating when new season is created - FIX THIS - when new season is created, club seasons should be created for all clubs
When a club is created, they should get a club season for the active season -->

• [x] Still need a better indicator if a select field in mapping is blank -pink? with maybe one where it is not obvious and has been guesses as orange?
• [x] Admin creates events. They indicate which age groups are in the event.
• [x] Admin will need a filter for age group
• [x] Lead coach or admin can create session
• [x] On import, we need to be able to import to an event. So it should be register for season or register for event.
• [x] When csv is uploaded, need to compare for already registered for the year.
• [x] If for event, then need to be able to select event and any players on list should be registered for event and any sessions that are part of the event.
• [x] Tryout numbers are varchar in the db and probably need to stay that way. I need a way to sort them numerically, when they are numerical.
• [x] on bulk crud, can we make sure it is done the best way possible, ie not a bunch of requests to the server

Phase 4 — Fields/Groups & Drag-and-Drop Movement
• [x] Session fields/groups CRUD (session_fields) scoped to a session
• [x] "Carry over from previous session" logic — default a new session's groupings to the prior session's
• [x] Drag-and-drop board: players as cards, fields/groups as columns
○ [x] Desktop: native drag-and-drop (e.g. dnd-kit)
○ [x] Mobile: tap-to-select, then tap-target column to assign (fallback path, same underlying action)
• [x] Age group coordinator override: move any player between fields at any time
• [x] Ability to sort unassigned players by tryout number name (first and last) or rating, in the unassigned column. Same ability in the fields but also by rank
• [x] Warning to save when trying to leave player board page
• [x] GKs need a different color

• [x] The active division filter should show only the players registered for that division (age group). The event and sessions should be for only those players as well (division-specific sessions and player rosters are fully active and configurable)

Phase 5 — Ratings
• [x] Rating entry UI per coach, per field, per session (session_player_ratings)
○ [x] Only the entering coach's own numbers are visible/editable by them
○ [x] Coordinator can see all coaches' ratings for that session
• [x] Aggregate session-level rating computed from session_player_ratings → stored/displayed on session_players
• [x] Carry-forward logic: after an event closes, update season_players.rating from the event's final ratings
• [x] Rating history view on player detail page (which event, which session, which coach, what score)
• [x] Player cards should have a note icon that brings up a pop up of that player that shows all sessions in the event and the player's rating for that session with attendance.

• [x] when creating event, the default should be all age-groups selected
• [x] same for session if done by admin, but only coaches options if done by lead coach
• [x] player sort needs position
• [x] Player card needs position
• [x] Player registry needs position

• [x] similar to sort, we need filter (position, rating)
• [x] we need the ability to select all that are filtered and move them as bulk
• [x] when assigning ratings, we need the same ability to bulk assigning (ie all players on field 1 get a 1, so on but the coach will determine the numbers)

• [x] The ratings page should filter by age group

• [x] Player card should only have the sessions that player was registered to.
• [x] This card should also have notes from coaches (each coach will see their own, age group will see all)

Phase 6 — Rankings
• [x] Ranking computation: group players by rating tier, auto-rank within tier → event_player_rankings
• [x] Coordinator "finalize" action: locks ranking, sets is_finalized / finalized_by / finalized_at
• [x] Coordinator "unlock" action: unlocks ranking, clears is_finalized / finalized_by / finalized_at
• [x] Coordinator override UI: manually adjust rank within a tier before finalizing (auto-switches sort to rank on drag)
• [x] Event summary view: rating + rank per player, exportable/printable list for placement decisions
• [x] Per-event rating scale direction (1 high vs 10 high) & customizable tier categories
• [x] Custom confirmation Modal popup for finalizing event placement rankings
Phase 7 — Permanent Team Placement
• [x] "Place on team" action from the finalized event ranking screen → assigns season_players.season_team_id
• [x] Enforce one active permanent team per player (replace prior assignment if moved)
• [x] Age group coordinator can move players between permanent teams at any time (outside of an event too)
Phase 8 — Invitations & Uniforms
• [x] "Send invitation" action tied to a team placement (team_invitations, status = pending)
• [x] Enforce one pending invitation per player at a time (app-level check; consider a DB trigger for safety)
• [x] Accept/decline flow — who updates this depends on your player/parent access model (in-app coach entry vs a player-facing link — worth deciding before building)
• [x] Uniform number field, editable by coordinator + assigned team coach only
• [x] Roster/invitation status view: visible to all age-group coaches, edit-locked to coordinator + assigned coach

• [x] The row and header in the invitations page are too tall. They need to be condensed. (Refactored to use standard Checkbox component with py-1 px-2 cell padding)
Phase 9 — Team-Level Ranking Events
• [x] Team coach can create their own ranking events, scoped only to their permanent roster
• [x] Reuses the same event/session/rating machinery from Phases 3–6, just scoped to one team instead of a whole age group
Phase 10 — Notes
• [x] Note entry UI, attachable from: a session, an event, an invitation record, or a ranking screen
• [x] Note feed on player detail page, tagged with context (which event/session/invitation) and author
• [x] Any coach can add a note; all coaches with access to that player can read it
Phase 11 — Polish, Mobile & Deployment
• [x] Responsive pass on every drag-and-drop / roster screen for phone-width layouts
• [x] Loading/empty states for all list and board views
• [x] Basic audit trail: who changed a rating/rank/invitation status and when (most tables already have created_at/updated_at — decide if you also want a dedicated activity log)
• [x] Load-test against expected scale (500-1000 players, ~50 coaches) — should be trivial for MySQL at this volume, but confirm indexes on the new tables are being used
• [x] Deploy pipeline to Hostinger (or wherever this ends up hosting) — confirm Node/Next.js support on the current Hostinger plan
• [x] Point production DB at the migrated schema, run a final backup before cutover

• [x] My dev user switcher is showing up in deployment

• [x] Populate age groups (Boys/Girls, 2007-2018 for Calendar Year 1/1-12/31 and Seasonal Year 8/1-7/31, with default 8/1-7/31 cutoff selection when creating seasons)
need boys and girls for each

---

## Next Steps

### 🔴 High Priority

- [x] **Dashboard** — build a home dashboard view with relevant summary info per role (coach, coordinator, admin)
- [x] **Session roster sidebar button** — add a dedicated sidebar button for session roster so all coaches can quickly access attendance entry
- [x] **Active season/division scoping for logged-in user** — active season should only show seasons the user was active for; active division should only show their assigned age groups/teams/sessions

### 🟡 Medium Priority

- [x] **Staff registry — multiple age groups & teams per coach** — when adding/editing a staff member, allow assigning multiple age groups and multiple teams
- [x] **Filter assigned team by assigned age group** — when viewing or assigning teams, scope the team dropdown/list to the user's assigned age group(s)
- [x] **Team hierarchy for player placement** — teams should have an explicit rank/order (1st team, 2nd team, etc.) rather than alphabetical sort; this order should drive sorting throughout placement and roster views
- [x] **Invitation page — compact layout** — shrink the informational cards at the top of the team invitation page and reduce header height so more players are visible
- [ ] **Parent table & invitation emails** — create a `parents` table linked to players (email, phone); update player import to support parent contact fields; wire up actual invitation sending

### 🟢 Lower Priority / Refactors

- [ ] **Table audit** — verify all list views use the shared table component; ensure the component supports column sorting and enable sorting on all appropriate columns
- [x] **Attendance checkbox UX** — attendance is a checkbox for present/absent with secondary select for excused
- [x] **Session page search, sort & filter** — admin and coordinator session pages now have full search, sort, and filter parity
- [x] **Auto-add players from previous season** — players from previous season qualifying by DOB are automatically added when a season is created/cloned
      From <https://claude.ai/chat/8e0f34fd-8543-4b87-b137-421a4c8be5a9>

Coaching App — Implementation Blueprint
Stack: Next.js, React, MySQL/MariaDB (Hostinger DB u676616277_team_creation), Prisma. Work top to bottom — each phase builds on the last and should be usable/demoable on its own before moving on.

Phase 0 — Foundations
• [x] Spin up a local/staging copy of u676616277_team_creation (never develop against production data)
• [x] Set up Next.js project (App Router) with Prisma connected to the MySQL DB
• [x] Run prisma db pull against the existing schema to generate a baseline Prisma schema
• [x] Apply coaching_app_migration.sql to the staging DB
• [x] Re-run prisma db pull (or hand-edit schema.prisma) to bring the new tables into Prisma
• [x] Decide on auth approach (NextAuth vs custom) — reuse existing users table (email/password_hash)
• [x] Set up basic project structure: app/, components/, lib/, hooks/
Phase 1 — Auth & Roles
• [x] Login/session handling against users
• [x] Middleware/helper to resolve a logged-in user's full permission set:
○ [x] Global role from users.role (system_admin / club_admin / coach)
○ [x] Per-age-group roles from user.assigned_age_group_id
○ [x] Per-team coaching assignments from user.assigned_team_id
• [x] Central permission-check utility (e.g. can(user, action, resource)) used by every API route
• [x] Basic admin screen: assign/remove user roles, club, age group, and team scopes (Staff Registry)
Phase 2 — Core Data (Players, Age Groups, Seasons, Teams)
• [x] Season/age-group admin views (create/edit seasons, season_age_groups)
• [x] Player CRUD + roster import (bulk add players to players / season_players)
• [x] Team CRUD (teams, season_teams) — permanent teams tied to a season + age group
• [x] Player detail page: profile, current rating, current permanent team, note history (timeline + note CRUD)
Phase 3 — Events & Sessions
• [x] Event CRUD (events, event_divisions) — coordinator-only creation, scoped to their age group(s)
• [x] Session CRUD under an event (sessions) — multi-day support
• [x] Event roster screen: list all players in the age group, mark event-level availability (event_players)
○ [x] Default view hides "unavailable" players
○ [x] Toggle/filter to reveal them when needed
• [x] Session attendance screen: mark present/absent/excused (session_players.attendance_status)
○ [x] Editable by coach or coordinator
○ [x] Players marked unavailable for the event start hidden here too, same reveal toggle

<!-- Club Seasons are not auto creating when new season is created - FIX THIS - when new season is created, club seasons should be created for all clubs
When a club is created, they should get a club season for the active season -->

• [x] Still need a better indicator if a select field in mapping is blank -pink? with maybe one where it is not obvious and has been guesses as orange?
• [x] Admin creates events. They indicate which age groups are in the event.
• [x] Admin will need a filter for age group
• [x] Lead coach or admin can create session
• [x] On import, we need to be able to import to an event. So it should be register for season or register for event.
• [x] When csv is uploaded, need to compare for already registered for the year.
• [x] If for event, then need to be able to select event and any players on list should be registered for event and any sessions that are part of the event.
• [x] Tryout numbers are varchar in the db and probably need to stay that way. I need a way to sort them numerically, when they are numerical.
• [x] on bulk crud, can we make sure it is done the best way possible, ie not a bunch of requests to the server

Phase 4 — Fields/Groups & Drag-and-Drop Movement
• [x] Session fields/groups CRUD (session_fields) scoped to a session
• [x] "Carry over from previous session" logic — default a new session's groupings to the prior session's
• [x] Drag-and-drop board: players as cards, fields/groups as columns
○ [x] Desktop: native drag-and-drop (e.g. dnd-kit)
○ [x] Mobile: tap-to-select, then tap-target column to assign (fallback path, same underlying action)
• [x] Age group coordinator override: move any player between fields at any time
• [x] Ability to sort unassigned players by tryout number name (first and last) or rating, in the unassigned column. Same ability in the fields but also by rank
• [x] Warning to save when trying to leave player board page
• [x] GKs need a different color

• [x] The active division filter should show only the players registered for that division (age group). The event and sessions should be for only those players as well (division-specific sessions and player rosters are fully active and configurable)

Phase 5 — Ratings
• [x] Rating entry UI per coach, per field, per session (session_player_ratings)
○ [x] Only the entering coach's own numbers are visible/editable by them
○ [x] Coordinator can see all coaches' ratings for that session
• [x] Aggregate session-level rating computed from session_player_ratings → stored/displayed on session_players
• [x] Carry-forward logic: after an event closes, update season_players.rating from the event's final ratings
• [x] Rating history view on player detail page (which event, which session, which coach, what score)
• [x] Player cards should have a note icon that brings up a pop up of that player that shows all sessions in the event and the player's rating for that session with attendance.

• [x] when creating event, the default should be all age-groups selected
• [x] same for session if done by admin, but only coaches options if done by lead coach
• [x] player sort needs position
• [x] Player card needs position
• [x] Player registry needs position

• [x] similar to sort, we need filter (position, rating)
• [x] we need the ability to select all that are filtered and move them as bulk
• [x] when assigning ratings, we need the same ability to bulk assigning (ie all players on field 1 get a 1, so on but the coach will determine the numbers)

• [x] The ratings page should filter by age group

• [x] Player card should only have the sessions that player was registered to.
• [x] This card should also have notes from coaches (each coach will see their own, age group will see all)

Phase 6 — Rankings
• [x] Ranking computation: group players by rating tier, auto-rank within tier → event_player_rankings
• [x] Coordinator "finalize" action: locks ranking, sets is_finalized / finalized_by / finalized_at
• [x] Coordinator "unlock" action: unlocks ranking, clears is_finalized / finalized_by / finalized_at
• [x] Coordinator override UI: manually adjust rank within a tier before finalizing (auto-switches sort to rank on drag)
• [x] Event summary view: rating + rank per player, exportable/printable list for placement decisions
• [x] Per-event rating scale direction (1 high vs 10 high) & customizable tier categories
• [x] Custom confirmation Modal popup for finalizing event placement rankings
Phase 7 — Permanent Team Placement
• [x] "Place on team" action from the finalized event ranking screen → assigns season_players.season_team_id
• [x] Enforce one active permanent team per player (replace prior assignment if moved)
• [x] Age group coordinator can move players between permanent teams at any time (outside of an event too)
Phase 8 — Invitations & Uniforms
• [x] "Send invitation" action tied to a team placement (team_invitations, status = pending)
• [x] Enforce one pending invitation per player at a time (app-level check; consider a DB trigger for safety)
• [x] Accept/decline flow — who updates this depends on your player/parent access model (in-app coach entry vs a player-facing link — worth deciding before building)
• [x] Uniform number field, editable by coordinator + assigned team coach only
• [x] Roster/invitation status view: visible to all age-group coaches, edit-locked to coordinator + assigned coach

• [x] The row and header in the invitations page are too tall. They need to be condensed. (Refactored to use standard Checkbox component with py-1 px-2 cell padding)
Phase 9 — Team-Level Ranking Events
• [x] Team coach can create their own ranking events, scoped only to their permanent roster
• [x] Reuses the same event/session/rating machinery from Phases 3–6, just scoped to one team instead of a whole age group
Phase 10 — Notes
• [x] Note entry UI, attachable from: a session, an event, an invitation record, or a ranking screen
• [x] Note feed on player detail page, tagged with context (which event/session/invitation) and author
• [x] Any coach can add a note; all coaches with access to that player can read it
Phase 11 — Polish, Mobile & Deployment
• [x] Responsive pass on every drag-and-drop / roster screen for phone-width layouts
• [x] Loading/empty states for all list and board views
• [x] Basic audit trail: who changed a rating/rank/invitation status and when (most tables already have created_at/updated_at — decide if you also want a dedicated activity log)
• [x] Load-test against expected scale (500-1000 players, ~50 coaches) — should be trivial for MySQL at this volume, but confirm indexes on the new tables are being used
• [x] Deploy pipeline to Hostinger (or wherever this ends up hosting) — confirm Node/Next.js support on the current Hostinger plan
• [x] Point production DB at the migrated schema, run a final backup before cutover

• [x] My dev user switcher is showing up in deployment

• [x] Populate age groups (Boys/Girls, 2007-2018 for Calendar Year 1/1-12/31 and Seasonal Year 8/1-7/31, with default 8/1-7/31 cutoff selection when creating seasons)
need boys and girls for each

---

## Next Steps

### 🔴 High Priority

- [x] **Dashboard** — build a home dashboard view with relevant summary info per role (coach, coordinator, admin)
- [x] **Session roster sidebar button** — add a dedicated sidebar button for session roster so all coaches can quickly access attendance entry
- [x] **Active season/division scoping for logged-in user** — active season should only show seasons the user was active for; active division should only show their assigned age groups/teams/sessions

### 🟡 Medium Priority

- [x] **Staff registry — multiple age groups & teams per coach** — when adding/editing a staff member, allow assigning multiple age groups and multiple teams
- [x] **Filter assigned team by assigned age group** — when viewing or assigning teams, scope the team dropdown/list to the user's assigned age group(s)
- [x] **Team hierarchy for player placement** — teams should have an explicit rank/order (1st team, 2nd team, etc.) rather than alphabetical sort; this order should drive sorting throughout placement and roster views
- [x] **Invitation page — compact layout** — shrink the informational cards at the top of the team invitation page and reduce header height so more players are visible
- [ ] **Parent table & invitation emails** — create a `parents` table linked to players (email, phone); update player import to support parent contact fields; wire up actual invitation sending

### 🟢 Lower Priority / Refactors

- [ ] **Table audit** — verify all list views use the shared table component; ensure the component supports column sorting and enable sorting on all appropriate columns
- [x] **Attendance checkbox UX** — attendance is a checkbox for present/absent with secondary select for excused
- [x] **Session page search, sort & filter** — admin and coordinator session pages now have full search, sort, and filter parity
- [x] **Auto-add players from previous season** — players from previous season qualifying by DOB are automatically added when a season is created/cloned

---

## 🚀 Session Hub & Tabbed Workspace Overhaul

Focus navigation on the main Session page, using the Player Board header at the top with master filters, and 5 dedicated workspace tabs directly below. Remove superfluous/extra links.

### 📍 Core Layout & Navigation
- [x] **Player Board Header Integration**: Use the Player Board header (with active division/season/session filters) as the top of the main Session page.
- [x] **Tab Bar Below Filters**: Add 5 tabs directly below the top filter controls:
  1. `Check-in`
  2. `Rating`
  3. `Field Assignment`
  4. `Ranking`
  5. `Final Placement`
- [x] **Superfluous Links Cleanup**: Remove extra redundant links across navigation to keep focus centered on the tabbed Session workspace.

---

### 🗳️ 1. Check-in Tab (Session Roster)
- [x] **Refactored Roster Display**:
  - [x] Remove Club column
  - [x] Remove Division column
  - [x] Remove player ID from name display
  - [x] Remove circle with initials (avatar)
  - [x] Remove birth year / year suffix from roster/tryout number (display clean tryout number only)
- [x] **Attendance Controls**: Preserve present/absent checkbox UX with secondary status selection (excused, etc.).

---

### ⭐️ 2. Rating Tab
- [x] **Unassigned Rating Pool**: Display an "Unassigned Rating" area/section at the start for players without a rating.
- [x] **Rating Assignment & Section Movement**: Assigning a rating to a player moves them into that rating's section.
- [x] **Previous Session Carryover**: All players start with their rating from the previous session as their initial rating for the current session.
- [x] **Optimistic UI Updates**: Instantly move player card/row to their new rating section upon rating change without UI lag or flash.

---

### 🏟️ 3. Field Assignment Tab (Optional)
- [x] **Optional Tab Enablement**: Allow splitting large player groups across fields (`session_fields`).
- [x] **Cross-Field Drag-and-Drop**: Drag players between fields (Field 1, Field 2, etc.).
- [x] **Intra-Field Drag-and-Drop Ranking**: Drag players up and down within a field column to re-order/rank them on that field.
- [x] **Field Shift Default Position**: When a player is moved to a new field, automatically place them at the very bottom of the new field's ranking list.

---

### 🏆 4. Ranking Tab
- [x] **Tier/Rating Group Manual Ranking**: Group players by their rating group and rank manually within each rating group.
- [x] **Up/Down Reordering**: Move players up or down within their rating group.
- [x] **Automatic Saving**: Instantly and automatically persist ranking order changes to database upon reordering.

---

### 🎯 5. Final Placement Tab
- [x] **Team Placement Workspace**: Assign finalized/ranked players to permanent teams (`season_teams`).
