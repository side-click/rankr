import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

export const DEFAULT_ROLES = ["signed-out", "admin", "operator", "captain", "public"];

export const PAGE_ALIAS_MAP = {
  home: ["/", "/?season=all"],
  browse: ["/browse"],
  consensus: ["/consensus"],
  stats: ["/stats"],
  "team-hub": ["/team-hub", "/matches"],
  create: ["/create", "/rank"],
  "my-history": ["/my-history", "/my-rankings"],
  admin: ["/admin"],
  "admin-stats": ["/admin/stats"],
  "admin-users": ["/admin/users"],
  "admin-publishings": ["/admin/publishings"],
  "stats-player": ["/stats/player/"],
  "stats-team": ["/stats/team/"],
  "stats-match": ["/stats/match/"],
  "stats-champion": ["/stats/champion/"],
  ranking: ["/rankings/", "/ballot/"],
  tierlist: ["/tierlist/"],
  blog: ["/blog/"],
  legal: ["/terms", "/privacy"],
};

function parseCsvSet(raw) {
  if (!raw || !raw.trim()) return null;
  const items = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (items.length === 0 || items.includes("all") || items.includes("max")) {
    return null;
  }
  return new Set(items);
}

export function parseAuditArgs(argv = process.argv.slice(2), defaults = {}) {
  const argVal = (prefix) => {
    const hit = argv.find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : null;
  };

  const help = argv.includes("--help") || argv.includes("-h");
  const isProd = argv.includes("--prod");
  const baseUrl = (
    isProd ? "https://leaguerankr.com" : argVal("--base=") || defaults.baseUrl || "http://localhost:3000"
  ).replace(/\/$/, "");

  const loginMode = argv.includes("--login");
  const noAuth = argv.includes("--no-auth");
  const authFile = path.resolve(argVal("--auth-file=") || defaults.authFile || "temp/audit-auth.json");
  const hasSavedAuth = !noAuth && (loginMode || fs.existsSync(authFile));

  const rawPages = argVal("--pages=");
  const pagesFilter = rawPages
    ? rawPages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const sections = parseCsvSet(argVal("--sections="));
  const metrics = parseCsvSet(argVal("--metrics="));

  const rawRoles = argVal("--roles=");
  const roles = noAuth
    ? new Set(["signed-out"])
    : rawRoles
    ? parseCsvSet(rawRoles) || new Set(hasSavedAuth ? DEFAULT_ROLES : ["signed-out"])
    : new Set(hasSavedAuth ? DEFAULT_ROLES : ["signed-out"]);

  const rawWidths = argVal("--widths=");
  const widthsExplicit = Boolean(rawWidths);
  const widths = (rawWidths ? rawWidths.split(",") : defaults.widths || [1440, 1280, 768, 390])
    .map((n) => Number(String(n).trim()))
    .filter((n) => Number.isFinite(n) && n >= 240);

  const runs = Math.max(1, Number(argVal("--runs=") || defaults.runs || 2) || 2);
  const throttle4g = argv.includes("--4g");
  const screenshotsRaw = (argVal("--screenshots=") || defaults.screenshots || "all").toLowerCase();
  const screenshots = ["all", "issues", "none"].includes(screenshotsRaw) ? screenshotsRaw : "all";

  const outDir = path.resolve(argVal("--out=") || defaults.outDir || "temp/audit");
  const baselinePathRaw = argVal("--baseline=");
  const baselinePath = baselinePathRaw ? path.resolve(baselinePathRaw) : null;

  return {
    argv,
    help,
    isProd,
    baseUrl,
    loginMode,
    noAuth,
    authFile,
    hasSavedAuth,
    pagesFilter,
    sections,
    metrics,
    roles,
    widths,
    widthsExplicit,
    runs,
    throttle4g,
    screenshots,
    outDir,
    baselinePath,
  };
}

export function hasSection(cfg, name) {
  if (!cfg.sections) return true;
  return cfg.sections.has(String(name).toLowerCase());
}

export function hasMetric(cfg, name) {
  if (!cfg.metrics) return true;
  return cfg.metrics.has(String(name).toLowerCase());
}

export function hasRole(cfg, role) {
  return cfg.roles.has(String(role).toLowerCase());
}

export function matchesPageFilter(cfg, alias, pathname = "") {
  if (!cfg.pagesFilter || cfg.pagesFilter.length === 0) return true;
  const cleanAlias = String(alias || "").toLowerCase();
  const cleanPath = String(pathname || "").toLowerCase().split("?")[0];

  for (const tokenRaw of cfg.pagesFilter) {
    const token = tokenRaw.toLowerCase();
    if (token === cleanAlias) return true;
    if (token.startsWith("/")) {
      if (token === "/" && cleanPath === "/") return true;
      if (token !== "/" && (cleanPath === token || cleanPath.startsWith(token))) return true;
    }
    const mappedPrefixes = PAGE_ALIAS_MAP[token];
    if (mappedPrefixes) {
      for (const prefix of mappedPrefixes) {
        if (prefix === "/" && cleanPath === "/") return true;
        if (prefix !== "/" && cleanPath.startsWith(prefix)) return true;
      }
    }
  }
  return false;
}

export function formatCommonHelp(scriptName, extraLines = []) {
  return [
    `Usage: npm run ${scriptName} -- [options]`,
    ``,
    `Target & Auth:`,
    `  --prod                     Run against https://leaguerankr.com (default: http://localhost:3000)`,
    `  --base=<url>               Custom target URL`,
    `  --login                    Open interactive Edge/Chrome window once for Discord Sign-In`,
    `  --no-auth                  Force signed-out checks only even if saved auth exists`,
    `  --auth-file=<path>         Storage state file (default: temp/audit-auth.json)`,
    `  --roles=<csv>              signed-out,admin,operator,captain,public`,
    ``,
    `Scope & Filters (maxed by default when omitted):`,
    `  --pages=<csv>              Filter by route path or alias (home,browse,consensus,stats,`,
    `                             team-hub,create,my-history,admin,admin-stats,admin-users,`,
    `                             admin-publishings,stats-player,stats-team,stats-match,`,
    `                             stats-champion,ranking,tierlist,blog,legal)`,
    `  --sections=<csv>           Run only named check sections (or "all")`,
    `  --metrics=<csv>            Collect/enforce only named metrics/KPIs (or "all")`,
    `  --widths=<csv>             Comma-separated viewport widths in px`,
    `  --runs=<n>                 Number of repeated samples where applicable`,
    `  --4g                       Simulate slow 4G network throttling (perf audit)`,
    `  --screenshots=all|issues|none`,
    `  --out=<dir>                Custom output directory`,
    `  --baseline=<report.json>   Compare results & numeric metrics against a baseline report`,
    `  --help                     Show this help message`,
    ...extraLines,
  ].join("\n");
}

export async function launchAuditBrowser(headless = true) {
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launch({ channel, headless });
    } catch {}
  }
  const winPaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const executablePath of winPaths) {
    if (fs.existsSync(executablePath)) {
      try {
        return await chromium.launch({ executablePath, headless });
      } catch {}
    }
  }
  return chromium.launch({ headless });
}

export async function ensureAuthStorageState(baseUrl, savedAuthPath, loginMode = false) {
  if (loginMode) {
    fs.mkdirSync(path.dirname(savedAuthPath), { recursive: true });
    console.log(
      `\n[INFO] Launching interactive browser for Discord Sign-In on ${baseUrl}. Sign in, then wait or close window...`
    );
    const loginBrowser = await launchAuditBrowser(false);
    try {
      const loginCtx = await loginBrowser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      const loginPage = await loginCtx.newPage();
      await loginPage.goto(baseUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      await loginPage
        .waitForSelector('a[href="/admin"], button:has-text("Sign Out")', {
          timeout: 120000,
        })
        .catch(() => {});
      await loginCtx.storageState({ path: savedAuthPath });
      console.log(`[INFO] Saved authenticated session -> ${savedAuthPath}`);
    } finally {
      await loginBrowser.close().catch(() => {});
    }
  }
  return fs.existsSync(savedAuthPath) ? savedAuthPath : null;
}

export async function setViewAs(context, baseUrl, payload) {
  const res = await context.request.post(`${baseUrl}/api/admin/view-as`, {
    data: payload,
  });
  return { ok: res.ok(), status: res.status() };
}

export async function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const server5xx = [];
  const failedAssets = [];

  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  const onPageErr = (err) => pageErrors.push(String(err));
  const onResponse = (res) => {
    const status = res.status();
    if (status >= 500) {
      server5xx.push(`${status} ${res.url()}`);
    } else if (status >= 400 && status !== 401 && status !== 403) {
      const reqType = res.request().resourceType();
      if (reqType !== "fetch" && reqType !== "xhr") {
        failedAssets.push(`${status} [${reqType}] ${res.url()}`);
      }
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageErr);
  page.on("response", onResponse);

  return () => {
    page.off("console", onConsole);
    page.off("pageerror", onPageErr);
    page.off("response", onResponse);
    return { consoleErrors, pageErrors, server5xx, failedAssets };
  };
}

export async function waitForImagesSettled(page, timeoutMs = 4000) {
  await page
    .evaluate(async (maxWait) => {
      await Promise.all(
        [...document.querySelectorAll("img")].map((img) =>
          img.complete
            ? null
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
                setTimeout(resolve, maxWait);
              })
        )
      );
    }, timeoutMs)
    .catch(() => {});
}

export async function discoverSiteEntities(browser, baseUrl) {
  const entities = {
    playerHref: null,
    teamHref: null,
    matchHref: null,
    championHref: null,
    rankingHref: null,
    tierlistHref: null,
    blogHref: null,
    ballotId: null,
  };

  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  async function harvestLinks() {
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("href") || "").filter(Boolean)
      )
      .catch(() => []);
    for (const h of hrefs) {
      if (!entities.playerHref && h.startsWith("/stats/player/")) entities.playerHref = h;
      if (!entities.teamHref && h.startsWith("/stats/team/")) entities.teamHref = h;
      if (!entities.matchHref && h.startsWith("/stats/match/")) entities.matchHref = h;
      if (!entities.championHref && h.startsWith("/stats/champion/")) entities.championHref = h;
      if (!entities.rankingHref && /^\/rankings\/[a-z0-9-]+/i.test(h)) entities.rankingHref = h;
      if (!entities.tierlistHref && /^\/tierlist\/[a-z0-9-]+/i.test(h)) entities.tierlistHref = h;
      if (!entities.blogHref && /^\/blog\/[a-z0-9-]+/i.test(h)) entities.blogHref = h;
    }
  }

  try {
    // 1. Home page
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await harvestLinks();

    // 2. Stats Players tab
    if (!entities.playerHref || !entities.championHref) {
      await page
        .goto(`${baseUrl}/stats?tab=players`, { waitUntil: "networkidle", timeout: 45000 })
        .catch(() => {});
      await harvestLinks();
    }

    // 3. Stats Teams tab (switch out of All Divisions if needed)
    if (!entities.teamHref || !entities.matchHref) {
      await page
        .goto(`${baseUrl}/stats?tab=teams`, { waitUntil: "networkidle", timeout: 45000 })
        .catch(() => {});
      await harvestLinks();
      if (!entities.teamHref) {
        const divTrigger = page
          .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
          .nth(1)
          .locator("button")
          .first();
        if ((await divTrigger.count().catch(() => 0)) > 0) {
          await divTrigger.click().catch(() => {});
          await page.waitForTimeout(150);
          const firstConcreteDiv = page
            .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
            .nth(1)
            .locator("div.absolute button")
            .filter({ hasNotText: /^All Divisions/i })
            .first();
          if ((await firstConcreteDiv.count().catch(() => 0)) > 0) {
            await firstConcreteDiv.click().catch(() => {});
            await page.waitForTimeout(450);
            await harvestLinks();
          }
        }
      }
    }

    // 4. Drill into player/team pages to discover match & champion hrefs if still missing
    if (entities.playerHref && (!entities.championHref || !entities.matchHref || !entities.teamHref)) {
      await page
        .goto(`${baseUrl}${entities.playerHref}`, { waitUntil: "networkidle", timeout: 45000 })
        .catch(() => {});
      await harvestLinks();
    }
    if (entities.teamHref && (!entities.matchHref || !entities.championHref)) {
      await page
        .goto(`${baseUrl}${entities.teamHref}`, { waitUntil: "networkidle", timeout: 45000 })
        .catch(() => {});
      await harvestLinks();
    }

    // 5. Browse for ranking / tierlist / blog links
    if (!entities.rankingHref || !entities.tierlistHref || !entities.blogHref) {
      await page
        .goto(`${baseUrl}/browse?season=`, { waitUntil: "networkidle", timeout: 45000 })
        .catch(() => {});
      await harvestLinks();
    }
    if (!entities.blogHref) {
      await page
        .goto(`${baseUrl}/browse?type=blog&season=`, { waitUntil: "networkidle", timeout: 45000 })
        .catch(() => {});
      await harvestLinks();
    }
    if (!entities.tierlistHref) {
      await page
        .goto(`${baseUrl}/browse?type=player&season=`, { waitUntil: "networkidle", timeout: 45000 })
        .catch(() => {});
      await harvestLinks();
    }

    const ballotSource = entities.rankingHref || entities.tierlistHref;
    if (ballotSource) {
      const m = ballotSource.match(/^\/(?:rankings|tierlist)\/([^/?#]+)/i);
      if (m) entities.ballotId = m[1];
    }
  } finally {
    await context.close().catch(() => {});
  }

  return entities;
}

export async function discoverRoleTargets(page) {
  const previewBar = page
    .locator("div", { hasText: "Preview As Role" })
    .filter({ has: page.locator("select") })
    .first();

  if ((await previewBar.count().catch(() => 0)) === 0) {
    return { leagueTarget: null, teamTarget: null };
  }

  const roleSelect = previewBar.locator("select").first();
  await roleSelect.selectOption("operator").catch(() => {});
  await page.waitForTimeout(150);
  const leagueTarget = await previewBar
    .locator("select")
    .nth(1)
    .evaluate((el) => {
      const opt = el?.options?.[el.selectedIndex];
      return el?.value ? { id: el.value, label: opt?.text || el.value } : null;
    })
    .catch(() => null);

  await roleSelect.selectOption("captain").catch(() => {});
  await page.waitForTimeout(150);
  const teamTarget = await previewBar
    .locator("select")
    .nth(1)
    .evaluate((el) => {
      const opt = el?.options?.[el.selectedIndex];
      return el?.value ? { id: el.value, label: opt?.text || el.value } : null;
    })
    .catch(() => null);

  return { leagueTarget, teamTarget };
}

export function createAuditReporter({
  title,
  baseUrl,
  outDir,
  meta = {},
  baselinePath = null,
  stdout = true,
}) {
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  const recommendations = [];
  const recKeys = new Set();

  function addRecommendation(priority, area, summary, evidence = "") {
    const key = `${priority}|${area}|${summary}`;
    if (recKeys.has(key)) return;
    recKeys.add(key);
    recommendations.push({ priority, area, summary, evidence });
  }

  function record({
    suite = "General",
    category = "check",
    name,
    status,
    metric = undefined,
    details = "",
    recommendation = null,
  }) {
    const entry = {
      suite,
      category,
      name,
      status,
      ...(metric !== undefined ? { metric } : {}),
      details,
    };
    results.push(entry);

    if (recommendation && (status === "FAIL" || status === "WARN")) {
      addRecommendation(
        status === "FAIL" ? "P1" : "P2",
        `${suite}/${category}`,
        recommendation,
        `${name}${details ? ` (${details})` : ""}`
      );
    }

    if (stdout) {
      const tag =
        status === "PASS"
          ? "[PASS]"
          : status === "WARN"
          ? "[WARN]"
          : status === "INFO"
          ? "[INFO]"
          : "[FAIL]";
      console.log(`${tag} ${suite} > ${name}${details ? ` — ${details}` : ""}`);
    }
    return entry;
  }

  function compareBaseline() {
    if (!baselinePath || !fs.existsSync(baselinePath)) return null;
    try {
      const prev = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
      const prevResults = Array.isArray(prev.results) ? prev.results : [];
      const prevMap = new Map(prevResults.map((r) => [`${r.suite}|${r.name}`, r]));

      const newFailures = [];
      const resolvedFailures = [];
      const metricDeltas = [];

      for (const cur of results) {
        const key = `${cur.suite}|${cur.name}`;
        const old = prevMap.get(key);
        if (cur.status === "FAIL" && (!old || old.status !== "FAIL")) {
          newFailures.push(`${cur.suite} > ${cur.name}`);
        }
        if (old?.status === "FAIL" && cur.status === "PASS") {
          resolvedFailures.push(`${cur.suite} > ${cur.name}`);
        }
        if (typeof cur.metric === "number" && typeof old?.metric === "number") {
          const delta = Number((cur.metric - old.metric).toFixed(2));
          if (Math.abs(delta) > 0) {
            metricDeltas.push({
              name: `${cur.suite} > ${cur.name}`,
              prev: old.metric,
              curr: cur.metric,
              delta,
            });
          }
        }
      }
      return {
        baselineGeneratedAt: prev.generatedAt || null,
        newFailures,
        resolvedFailures,
        metricDeltas: metricDeltas.slice(0, 25),
      };
    } catch {
      return null;
    }
  }

  function finalize(extraJson = {}, extraMdSections = []) {
    const passCount = results.filter((r) => r.status === "PASS").length;
    const warnCount = results.filter((r) => r.status === "WARN").length;
    const failCount = results.filter((r) => r.status === "FAIL").length;
    const infoCount = results.filter((r) => r.status === "INFO").length;
    const baselineDelta = compareBaseline();

    const bySuite = new Map();
    const byCategory = new Map();
    for (const r of results) {
      for (const [map, key] of [
        [bySuite, r.suite],
        [byCategory, r.category || "check"],
      ]) {
        if (!map.has(key)) map.set(key, { PASS: 0, WARN: 0, FAIL: 0, INFO: 0 });
        map.get(key)[r.status] = (map.get(key)[r.status] || 0) + 1;
      }
    }

    const reportJson = {
      generatedAt: new Date().toISOString(),
      title,
      baseUrl,
      meta,
      summary: { passCount, warnCount, failCount, infoCount, total: results.length },
      recommendations,
      baselineDelta,
      ...extraJson,
      results,
    };

    const reportJsonPath = path.join(outDir, "report.json");
    const reportMdPath = path.join(outDir, "report.md");
    fs.writeFileSync(reportJsonPath, JSON.stringify(reportJson, null, 2), "utf8");

    const esc = (s) => String(s || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
    const md = [
      `# ${title}`,
      ``,
      `- **Target:** ${baseUrl}`,
      `- **Generated:** ${reportJson.generatedAt}`,
      `- **Summary:** **${passCount} PASS** · **${warnCount} WARN** · **${failCount} FAIL**${infoCount ? ` · ${infoCount} INFO` : ""}`,
      ...Object.entries(meta).map(([k, v]) => `- **${k}:** ${typeof v === "object" ? JSON.stringify(v) : v}`),
      ``,
      `## Breakdown by Suite / Role`,
      ``,
      `| Suite / Role | PASS | WARN | FAIL |`,
      `| :--- | :---: | :---: | :---: |`,
      ...[...bySuite.entries()].map(
        ([k, c]) => `| ${esc(k)} | ${c.PASS} | ${c.WARN} | ${c.FAIL} |`
      ),
      ``,
      `## Breakdown by Category`,
      ``,
      `| Category | PASS | WARN | FAIL |`,
      `| :--- | :---: | :---: | :---: |`,
      ...[...byCategory.entries()].map(
        ([k, c]) => `| ${esc(k)} | ${c.PASS} | ${c.WARN} | ${c.FAIL} |`
      ),
    ];

    const issuesOnly = results.filter((r) => r.status === "FAIL" || r.status === "WARN");
    if (issuesOnly.length > 0) {
      md.push(
        ``,
        `## Failures & Warnings (${issuesOnly.length})`,
        ``,
        `| Status | Suite | Category | Check | Details |`,
        `| :---: | :--- | :--- | :--- | :--- |`,
        ...issuesOnly.map(
          (r) =>
            `| ${r.status} | ${esc(r.suite)} | ${esc(r.category)} | ${esc(r.name)} | ${esc(r.details)} |`
        )
      );
    }

    if (recommendations.length > 0) {
      const sortedRecs = [...recommendations].sort((a, b) => a.priority.localeCompare(b.priority));
      md.push(
        ``,
        `## Prioritized Recommendations`,
        ``,
        ...sortedRecs.map(
          (r) => `- **[${r.priority}] (${r.area})** ${r.summary}${r.evidence ? ` — _${esc(r.evidence)}_` : ""}`
        )
      );
    }

    if (baselineDelta) {
      md.push(
        ``,
        `## Baseline Comparison`,
        ``,
        `- **New Failures:** ${baselineDelta.newFailures.length ? baselineDelta.newFailures.join("; ") : "None"}`,
        `- **Resolved Failures:** ${baselineDelta.resolvedFailures.length ? baselineDelta.resolvedFailures.join("; ") : "None"}`
      );
      if (baselineDelta.metricDeltas.length > 0) {
        md.push(
          ``,
          `| Check | Previous | Current | Delta |`,
          `| :--- | ---: | ---: | ---: |`,
          ...baselineDelta.metricDeltas.map(
            (d) => `| ${esc(d.name)} | ${d.prev} | ${d.curr} | ${d.delta > 0 ? `+${d.delta}` : d.delta} |`
          )
        );
      }
    }

    for (const sec of extraMdSections) {
      if (sec) md.push(``, sec);
    }

    md.push(
      ``,
      `## Full Check Ledger (${results.length} checks)`,
      ``,
      `| Suite | Category | Check | Status | Details |`,
      `| :--- | :--- | :--- | :---: | :--- |`,
      ...results.map(
        (r) =>
          `| ${esc(r.suite)} | ${esc(r.category)} | ${esc(r.name)} | ${r.status} | ${esc(r.details)} |`
      )
    );

    fs.writeFileSync(reportMdPath, md.join("\n"), "utf8");

    if (stdout) {
      console.log(
        `\nSummary: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL -> ${reportMdPath}`
      );
    }

    return {
      passCount,
      warnCount,
      failCount,
      infoCount,
      reportMdPath,
      reportJsonPath,
      reportJson,
    };
  }

  return { record, addRecommendation, finalize, results };
}
