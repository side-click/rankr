// Lists SCDL sheet games that have no entry (or incomplete bans) in data/scdl_drafts.json
import fs from "node:fs";

const SHEET_ID = "1tdi8ftaQ50sYS92H39YybU29SIPGVSyRNeT_HdOHP8A";
const GIDS = ["1733612942", "1849724071"];
const drafts = JSON.parse(fs.readFileSync("data/scdl_drafts.json", "utf8"));

function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}

const games = new Map();
for (const gid of GIDS) {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`);
  if (!res.ok) throw new Error(`tab ${gid}: ${res.status}`);
  const lines = (await res.text()).split(/\r?\n/).filter((l) => l.trim());
  const h = parseLine(lines[0]).map((x) => x.trim());
  const ix = (n) => h.indexOf(n);
  for (const l of lines.slice(1)) {
    const c = parseLine(l);
    const id = (c[ix("Game ID")] ?? "").trim();
    if (!id) continue;
    const g = games.get(id) ?? { id, match: (c[ix("Match")] ?? "").trim(), teams: new Set() };
    g.teams.add((c[ix("Team Name")] ?? "").trim());
    games.set(id, g);
  }
}

const missing = [];
const partial = [];
for (const g of games.values()) {
  const d = drafts[g.id];
  const label = `${g.id} | ${g.match} | ${[...g.teams].join(" vs ")}`;
  if (!d) missing.push(label);
  else if ((d.blueBans?.length ?? 0) < 5 || (d.redBans?.length ?? 0) < 5)
    partial.push(`${label} | bans ${d.blueBans?.length}/${d.redBans?.length} | ${d.sourceUrl}`);
}
console.log(`Sheet games: ${games.size}, drafts on file: ${Object.keys(drafts).length}`);
console.log(`\nMISSING (${missing.length}):\n` + missing.join("\n"));
console.log(`\nFEWER THAN 5 BANS (${partial.length}) - may be genuine no-bans:\n` + partial.join("\n"));
