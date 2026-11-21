import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local if env vars are not already set (for local manual runs)
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Core tables to back up (deliberately excludes riot_player_stats 11MB regenerable cache)
const TABLES = [
  "app_settings",
  "allowed_discord_users",
  "profiles",
  "division_themes",
  "leagues",
  "seasons",
  "divisions",
  "teams",
  "season_players",
  "editions",
  "rankings",
  "ranking_entries",
  "ranking_revisions",
  "champion_pools",
  "match_drafts",
  "league_game_participants",
  "sheet_snapshots",
];

const dump = {
  exportedAt: new Date().toISOString(),
  supabaseUrl,
  tables: {},
};

for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) {
    console.warn(`[skip] ${table}: ${error.message}`);
    dump.tables[table] = { error: error.message, rows: [] };
  } else {
    dump.tables[table] = { count: (data ?? []).length, rows: data ?? [] };
    console.log(`[ok] ${table}: ${(data ?? []).length} rows`);
  }
}

const outDir = path.resolve("temp/backups");
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(outDir, `rankr-db-backup-${stamp}.json`);
const json = JSON.stringify(dump, null, 2);
fs.writeFileSync(outFile, json, "utf8");
console.log(
  `\nSaved backup (${(Buffer.byteLength(json) / 1024).toFixed(
    1
  )} KB) -> ${path.relative(process.cwd(), outFile)}`
);
