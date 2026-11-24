# Rankr Architecture

Rankr is a Next.js 15 (App Router, React 19, Tailwind CSS v4) community platform for League of Legends draft leagues, built on Supabase (Auth, Postgres, Storage).

## Routes

### Public & Content Routes
- `/` (`app/(home)/page.tsx`): Cached homepage featuring season stats highlight, Top Teams, and recent community content.
- `/browse` (`app/browse/page.tsx`): Paginated explorer (`components/ContentListGrid.tsx`) with edition/league/type filters.
- `/consensus` (`app/consensus/page.tsx`): Aggregated consensus rankings & community tier views (`utils/consensusData.ts`).
- `/rank`, `/create`: Ranking & blog creation workspace (`components/CreateWorkspace.tsx`, lazy-loaded editors).
- `/rankings/[id]`, `/tierlist/[id]`, `/blog/[id]`: Public share pages (`utils/rankingPageLoader.ts`, `components/RankingOverlayControls.tsx`, `hooks/useOverlayEditor.ts`).
- `/ballot/[id]` (`app/ballot/[id]/page.tsx`): Legacy permanent redirect to `/rankings/[id]` or `/tierlist/[id]` — preserve.
- `/blog` (`app/blog/page.tsx`): Redirects to `/browse?type=blog`.
- `/privacy`, `/terms`: Static legal pages.

### Public & Admin Stats Routes
- Public: `/stats`, `/stats/team/[teamId]`, `/stats/player/[playerKey]`, `/stats/champion/[name]`, `/stats/match/[seriesKey]`.
- Admin (full draft/scouting controls): `/admin/stats`, `/admin/stats/team/[teamId]`, `/admin/stats/player/[playerKey]`, `/admin/stats/match/[seriesKey]`.
- Route helpers live in `utils/statsLinks.ts` (`statsHref`, `teamStatsHref`, `playerStatsHref`, `championStatsHref`, `matchStatsHref`) and preserve `?season=...&div=...`.

### Utility & Admin Console Routes
- `/my-history`, `/my-rankings`: Authenticated creator history & draft/published management.
- `/matches` (`app/matches/page.tsx`, `components/matches/TeamMatchHub.tsx`): Match Hub for Site Admins, League Operators, and Team Captains (linked from Admin Console only).
- `/admin`, `/admin/users`, `/admin/publishings`: League/season/division/team/player/schedule/moderation management (`components/AdminDashboard.tsx`).

## RBAC & Server Auth (`utils/supabase/serverAuth.ts`, `utils/allowlist.ts`)
- `getServerAuthContext()` (wrapped in `React.cache()`): resolves `user`, `profile`, `discordId`, `isAdmin`, `isBanned`, `operatorLeagueIds`, `isOperator`, and `hasMatchHubAccess`.
- `getCaptainTeamIds(supabase, discordId)`: opt-in query for `team_captains` used only by `/matches` and `/api/matches/tournament-code`.
- `assertSeasonOperatorAccess(auth, supabase, seasonId)`: verifies Site Admin OR League Operator belonging to the season's league.
- Access hierarchy:
  1. **Site Admin** (`profiles.is_admin`) — global console, user/operator assignment, settings, publishings.
  2. **League Operator** (`league_operators`) — season/schedule/team/player/stats management and league creator allowlists for assigned leagues.
  3. **Approved Creator** (`allowed_discord_users` globally, `league_allowed_users` per league when not open to all) — publish rankings/tier lists/champion pools/blogs.
  4. **Team Captain** (`team_captains`) — `/matches` hub and tournament code generation for scheduled matches.

## Publishing, Moderation & Profiles
- `app/api/publish/route.ts` handles server-authorized create/update/delete for rankings, tier lists, champion pools, and blog posts (`enforce allowlist + edition open/archive lock + ownership/admin checks + content moderation`).
- `utils/contentModerationServer.ts` & `/api/moderation/check`: enforce built-in + custom moderation rules.
- `utils/sanitizeUrl.ts`: validates/normalizes external/media links before persistence or rendering (`BlogMarkdown.tsx`, `StatsDataCredits.tsx`, editors).
- `utils/publishNotifications.ts` & `/api/notify-publish`: Discord webhook alerts on publish.
- `utils/publicProfiles.ts`: resolves public creator attribution (`id, username, avatar_url`) via `public_profiles` view (`supabase/migrations/039_security_hardening.sql`) with safe fallback.

## Stats Data Pipeline & Cache Tags
- Data ingestion & helpers: `utils/leagueStats.ts`, `utils/draftImporter.ts`, `utils/riotStatsAggregation.ts`, `utils/riotStatsServer.ts`, `utils/statsOverview.ts`, `utils/lolalyticsMatchups.ts`.
- Admin & webhook endpoints:
  - `/api/admin/scdl-sheet-stats`, `/api/admin/import-drafts`, `/api/admin/import-matches`, `/api/admin/riot-sync`, `/api/admin/stats-notice`
  - `/api/matches/tournament-code`, `/api/webhooks/riot-tournament`, `/api/recent-content`, `/api/champions`, `/api/champions/matchups`
- `unstable_cache` tags invalidated by `/api/admin/revalidate-stats` and `/api/publish`:
  - `app-settings`, `home-stats`, `browse-content`, `consensus-data`, `public-stats`, `match-drafts`.

## Component Modularization & Shared Utilities
- `components/StatsDashboard.tsx` composes `components/stats/{StatsAdminControls,StatsDivisionTab,StatsPlayersTab,StatsTeamsTab,StatsDataCredits,StatsUnrosteredModal,RoleLeaderboardExportCard,MatchDraftForm}.tsx`.
- `components/AdminDashboard.tsx` composes `components/admin/{AdminSeasonsTab,AdminDivisionsEditionsTab,AdminTeamsTab,AdminPlayersTab,AdminSchedulePlayoffsTab,AdminModerationTab,AdminLeagueAccessPanel,AdminDataImportPanel}.tsx` and `utils/adminRankingActions.ts`.
- Shared primitives: `utils/formatters.ts` (`unwrap`, `getLeaguePrefix`, `deriveLeaguePrefix`, `formatSigned`, `getTierContrastText`), `utils/recentContentQuery.ts`, `utils/exportImage.ts` (lazy `html-to-image` PNG export), `utils/rankingOgImage.tsx`, `components/RetroLoadingWindow.tsx`.
