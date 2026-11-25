import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  ensureAuthStorageState,
  formatCommonHelp,
  parseAuditArgs,
} from "./lib/audit-core.mjs";

const cfg = parseAuditArgs(process.argv.slice(2), {
  outDir: "temp",
});

const rawOnly = cfg.argv.find((a) => a.startsWith("--only="));
const onlySet = rawOnly
  ? new Set(
      rawOnly
        .slice("--only=".length)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  : new Set(["functional", "visual", "perf"]);

if (cfg.help) {
  console.log(
    formatCommonHelp("audit:all", [
      ``,
      `Combined Runner Specifics:`,
      `  --only=<csv>               Subset of suites to run: functional,visual,perf`,
      `                             All flags (--prod, --pages=, --roles=, --widths=,`,
      `                             --4g, --no-auth, --screenshots=) pass through.`,
      `                             If --login is passed, login runs once upfront.`,
    ])
  );
  process.exit(0);
}

const suites = [
  { key: "functional", script: "scripts/functional-audit.mjs", report: "temp/functional-audit/report.json", md: "temp/functional-audit/report.md" },
  { key: "visual", script: "scripts/visual-audit.mjs", report: "temp/visual-audit/report.json", md: "temp/visual-audit/report.md" },
  { key: "perf", script: "scripts/perf-audit.mjs", report: "temp/perf-audit/report.json", md: "temp/perf-audit/report.md" },
].filter((s) => onlySet.has(s.key));

async function main() {
  if (cfg.loginMode && !cfg.noAuth) {
    await ensureAuthStorageState(cfg.baseUrl, cfg.authFile, true);
  }

  // Forward all flags EXCEPT --login (already completed once) and --only= / --out=
  const forwardedArgs = cfg.argv.filter(
    (a) => a !== "--login" && !a.startsWith("--only=") && !a.startsWith("--out=")
  );

  let anyFail = false;
  const rollup = [];

  for (const s of suites) {
    console.log(`\n============================================================`);
    console.log(`Running ${s.key.toUpperCase()} audit (${s.script})`);
    console.log(`============================================================`);
    const t0 = Date.now();
    const proc = spawnSync(process.execPath, [path.resolve(s.script), ...forwardedArgs], {
      stdio: "inherit",
    });
    const elapsedSec = Number(((Date.now() - t0) / 1000).toFixed(1));
    const exitCode = proc.status ?? 1;
    if (exitCode !== 0) anyFail = true;

    let summary = { passCount: 0, warnCount: 0, failCount: 0, total: 0 };
    let recommendations = [];
    if (fs.existsSync(s.report)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(s.report, "utf8"));
        if (parsed.summary) summary = parsed.summary;
        if (Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations;
      } catch {}
    }

    rollup.push({
      suite: s.key,
      exitCode,
      elapsedSec,
      reportMd: s.md,
      ...summary,
      recommendations,
    });
  }

  const totalPass = rollup.reduce((a, r) => a + r.passCount, 0);
  const totalWarn = rollup.reduce((a, r) => a + r.warnCount, 0);
  const totalFail = rollup.reduce((a, r) => a + r.failCount, 0);

  const md = [
    `# Rankr Unified Audit Summary`,
    ``,
    `- **Target:** ${cfg.baseUrl}`,
    `- **Generated:** ${new Date().toISOString()}`,
    `- **Overall Totals:** **${totalPass} PASS** · **${totalWarn} WARN** · **${totalFail} FAIL**`,
    ``,
    `| Suite | PASS | WARN | FAIL | Duration (s) | Report |`,
    `| :--- | :---: | :---: | :---: | ---: | :--- |`,
    ...rollup.map(
      (r) =>
        `| ${r.suite} | ${r.passCount} | ${r.warnCount} | ${r.failCount} | ${r.elapsedSec}s | [${r.reportMd}](${path.resolve(r.reportMd).replace(/\\/g, "/")}) |`
    ),
  ];

  const allRecs = rollup.flatMap((r) => r.recommendations.map((rec) => ({ ...rec, suite: r.suite })));
  if (allRecs.length > 0) {
    md.push(
      ``,
      `## Top Consolidated Recommendations`,
      ``,
      ...allRecs
        .sort((a, b) => a.priority.localeCompare(b.priority))
        .slice(0, 25)
        .map((r) => `- **[${r.priority}] [${r.suite}] (${r.area})** ${r.summary}`)
    );
  }

  fs.mkdirSync(path.resolve("temp"), { recursive: true });
  const summaryMdPath = path.resolve("temp/audit-summary.md");
  const summaryJsonPath = path.resolve("temp/audit-summary.json");
  fs.writeFileSync(summaryMdPath, md.join("\n"), "utf8");
  fs.writeFileSync(
    summaryJsonPath,
    JSON.stringify({ baseUrl: cfg.baseUrl, totalPass, totalWarn, totalFail, rollup }, null, 2),
    "utf8"
  );

  console.log(
    `\nCombined Summary: ${totalPass} PASS, ${totalWarn} WARN, ${totalFail} FAIL -> ${summaryMdPath}`
  );
  if (anyFail || totalFail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
