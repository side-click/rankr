# Rankr Agent Guide

## Environment & Shell Rules (Windows)
- **Always `Set-Location D:\Rankr` (capital `R`)** before running `npx.cmd tsc --noEmit`, `npm run build`, `npm run dev`, or `npm run start`. Running from lowercase `d:\rankr` causes dual-React Webpack module resolution errors in Next.js 15.
- **PowerShell 5 syntax:** Use `;` instead of `&&` to chain commands. Use `-LiteralPath` when inspecting dynamic Next.js bracket paths (`[id]`, `[name]`, `[teamId]`, `[playerKey]`, `[seriesKey]`).
- **UTF-8 file safety:** Never rewrite `.ts`, `.tsx`, `.js`, `.css`, or `.sql` files with PowerShell 5 `Get-Content` / `Set-Content` (which default to Windows-1252 and corrupt punctuation like `•`, `—`, `←`, `→` into mojibake); always use `edit_file` or Node `fs.readFileSync`/`writeFileSync(..., "utf8")`.

## Verification & Audit Commands
- TypeScript check: `Set-Location D:\Rankr; npx.cmd tsc --noEmit`
- Production build: `Set-Location D:\Rankr; npm run build`
- Visual audit: `Set-Location D:\Rankr; npm run audit:visual` (`scripts/visual-audit.mjs`)
- Performance audit: `Set-Location D:\Rankr; npm run audit:perf` (`scripts/perf-audit.mjs`)

## Architecture & Product Invariants
- Keep `Match Hub (preview)` (`/matches`) inside the Admin Console (`components/AdminDashboard.tsx`). **Never** add `/matches` to the public navigation bar (`components/Navbar.tsx`, `components/HeaderNav.tsx`).
- Preserve `/ballot/[id]` legacy redirects (`app/ballot/[id]/page.tsx`) and existing Supabase table/column/storage bucket names (`rankings`, `ranking_entries`, `public_profiles`, `league_game_participants`, etc.).
- Route all ranking/blog mutations through `/api/publish` (`app/api/publish/route.ts`) rather than direct public client writes.
- Use `utils/publicProfiles.ts` / `public_profiles` for public author display names and avatars instead of selecting raw `profiles` rows in public views.
- Use `utils/statsLinks.ts` with `prefetch={false}` on dense stats cards/tables so active `?season=...&div=...` parameters remain intact without triggering unneeded RSC prefetches.
- When editing Supabase storage assets (logos, avatars, banners, overlays), keep explicit `cacheControl: "31536000"` and sanitize URLs with `utils/sanitizeUrl.ts`.
