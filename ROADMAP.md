# Rankr Future Optimization Roadmap ("Getting to 10/10")

Reference companion to [ARCHITECTURE.md](file:///D:/Rankr/ARCHITECTURE.md) and [AGENTS.md](file:///D:/Rankr/AGENTS.md).

Following the Nov 24 security, performance, UX, and modularization audit (`2a6185f`) plus the follow-up ESLint 9, CLS, and `/stats` payload compaction pass, Rankr captures the high-ROI wins for its current community scale. The items below represent the **remaining** work to reach strict 10/10 in every audit index, intentionally deferred until traffic, season size, or multi-league complexity justifies them.

---

## Tier 1 — Before High Traffic or Much Larger Seasons

- **Decouple Root Layout Auth & Focus Cookies from Public CDN Caching:**
  - *Why deferred:* Dynamic routes currently return `x-vercel-cache: MISS` because `app/layout.tsx` calls `getServerAuthContext()` and public pages read session/focus cookies globally.
  - *Upgrade path:* Push session-aware navbar UI into a lightweight client shell or edge-cookie split so anonymous requests to `/`, `/browse`, `/consensus`, and `/stats` can serve full Vercel CDN `HIT`s (`ISR` or Next.js Partial Prerendering).
- **Server-Render Public Blog Markdown (`app/blog/[id]/page.tsx`):**
  - *Why deferred:* `BlogMarkdown.tsx` ships `react-markdown` + `remark-gfm` (`~53.8 kB` route chunk / `228 kB` first load JS) on `/blog/[id]`.
  - *Upgrade path:* Render sanitized HTML/React on the server in `app/blog/[id]/page.tsx` while keeping `BlogMarkdown` client-side only for the editor preview in `BlogEditor.tsx`.
- **Replace Remaining `select("*")` Queries with Narrow Column Projections:**
  - *Where:* `utils/rankingPageLoader.ts` (`RANKING_SELECT` / `ranking_entries (*)` / `division_themes`) and older admin/stats loaders.
- **Lazy-Load Heavy Admin & Stats Sub-Tabs:**
  - *Upgrade path:* Dynamically import secondary tabs inside `components/AdminDashboard.tsx` (`210 kB` first load) and admin controls in `StatsDashboard.tsx` (`StatsAdminControls`) so read-only viewers never download editor/upload bundles.

---

## Tier 2 — When League #2 / League #3 Actively Onboards

- **Multi-Season Pagination on `/stats` & `/browse`:**
  - Currently `/browse` caps at `120` cards and `/stats` pre-aggregates per season. Add cursor/page filtering once leagues accumulate multiple seasons and larger archives.
- **Self-Serve League Onboarding & Automated Ingestion:**
  - League onboarding wizard for Operators (season structure preset + division themes + sheet/native source setup).
  - Scheduled cron / automated Riot Tournament webhook processing once Riot production API key approval is active (`app/api/webhooks/riot-tournament/route.ts`).
- **Pre-Aggregated Postgres Views / Tables (`league_season_aggregates`):**
  - Replace on-demand sheet CSV parsing + in-memory `aggregatePlayerStats()` (`unstable_cache` 1-hour TTL) with materialized/incremental DB aggregates when concurrent leagues exceed serverless compute comfort.
- **Generated Database Types (`supabase gen types typescript`):**
  - Replace hand-maintained `types/database.ts` with generated Supabase types as migration velocity increases.

---

## Tier 3 — Enterprise / Heavy-Scale Hardening (Overkill Right Now)

- **Nonce-Based Strict CSP (`next.config.ts`):** Remove `'unsafe-inline'` via per-request middleware nonces.
- **Distributed Rate Limiting:** Add Redis/Upstash rate limiting on `/api/publish`, `/api/moderation/check`, and `/api/champions/matchups` if untrusted public signup bursts or abuse appear.
- **Automated `pgTAP` RLS Test Suite + CI Playwright E2E + Pre-Commit Hooks:** GitHub Actions gating every PR with `tsc --noEmit`, `npm run lint`, `npm run build`, UTF-8 mojibake checks, RLS policy assertions, and authenticated Playwright flows.
- **Code Polish (`Architecture 8.2 → 10.0`):**
  - Enable `noUncheckedIndexedAccess` in `tsconfig.json`.
  - Migrate remaining `window.confirm` prompts in `AdminDashboard` / `CreateWorkspace` / `BlogView` to `RetroConfirmModal` (`AdminPublishingsLog.tsx` still uses a custom delete confirmation block) and extract remaining Admin CRUD handlers into typed Server Actions or domain hooks.
  - Rename internal TypeScript identifiers/variables that still say `ballot` to `ranking` (keeping `/ballot/[id]` URL redirect and DB/storage names untouched per `AGENTS.md`).
  - Dedicated image optimization CDN if avatar/logo volumes outgrow direct unoptimized `<img>` serving (note: avoid Vercel Image Optimization quotas on hobby tiers).
