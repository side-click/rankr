import path from "node:path";
import {
  createAuditReporter,
  discoverSiteEntities,
  ensureAuthStorageState,
  formatCommonHelp,
  hasMetric,
  hasRole,
  hasSection,
  launchAuditBrowser,
  matchesPageFilter,
  parseAuditArgs,
  setViewAs,
} from "./lib/audit-core.mjs";

const cfg = parseAuditArgs(process.argv.slice(2), {
  outDir: "temp/perf-audit",
  runs: 2,
  widths: [1440, 390],
});

if (cfg.help) {
  console.log(
    formatCommonHelp("audit:perf", [
      ``,
      `Perf Audit Specifics:`,
      `  Sections (--sections=):    cold,network,assets,storage,warm,api`,
      `  Metrics (--metrics=):      vitals,ttfb,transfer,storage,cache,images,js,fonts,rsc,hydration`,
      `  Default widths:            1440,390`,
      `  Default runs:              2 (on primary width; 1 mobile sample per route)`,
    ])
  );
  process.exit(0);
}

const isLocal = cfg.baseUrl.includes("localhost") || cfg.baseUrl.includes("127.0.0.1");
const budgetScale = cfg.throttle4g ? 1.5 : 1.0;

function round(n) {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function kb(bytes) {
  return Number.isFinite(bytes) ? Math.round((bytes / 1024) * 10) / 10 : 0;
}

async function apply4gThrottle(page) {
  if (!cfg.throttle4g) return;
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
}

async function injectObservers(page) {
  await page.addInitScript(() => {
    window.__perfMetrics = {
      fcp: null,
      lcp: null,
      cls: 0,
      longTasks: [],
    };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            window.__perfMetrics.fcp = entry.startTime;
          }
        }
      }).observe({ type: "paint", buffered: true });

      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) {
          const last = entries[entries.length - 1];
          window.__perfMetrics.lcp = {
            startTime: last.startTime,
            size: last.size,
            element: last.element
              ? `${last.element.tagName.toLowerCase()}${last.element.id ? "#" + last.element.id : ""}`
              : null,
            url: last.url || null,
          };
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__perfMetrics.cls += entry.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__perfMetrics.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Fallback gracefully when observers aren't supported
    }
  });
}

async function auditColdPage(browser, pageDef, width, runIndex, storageStatePath = null) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  if (storageStatePath) {
    await setViewAs(ctx, cfg.baseUrl, { mode: "clear" }).catch(() => {});
  }
  const page = await ctx.newPage();
  await apply4gThrottle(page);
  await injectObservers(page);

  let docHeaders = {};
  const failedRequests = [];
  const responseHeadersByUrl = new Map();
  const rscInitialRequests = [];
  const storageAssetChecks = [];
  const uncompressedCandidates = [];

  page.on("response", (res) => {
    const req = res.request();
    const h = res.headers();
    const url = res.url();
    const status = res.status();
    const rscHeader = req.headers()["rsc"];

    if (rscHeader === "1" || url.includes("_rsc=")) {
      rscInitialRequests.push(url.slice(0, 120));
    }

    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
      docHeaders = {
        status,
        xVercelCache: h["x-vercel-cache"] || null,
        cacheControl: h["cache-control"] || null,
        contentEncoding: h["content-encoding"] || null,
        serverTiming: h["server-timing"] || null,
      };
    }

    if (status >= 400) {
      failedRequests.push({ url: url.slice(0, 140), status, type: req.resourceType() });
    }

    const contentType = h["content-type"] || "";
    const contentEncoding = h["content-encoding"] || "";
    const cacheControl = h["cache-control"] || "";
    const contentLength = Number(h["content-length"] || 0);

    responseHeadersByUrl.set(url, {
      status,
      contentType,
      contentEncoding,
      cacheControl,
      xVercelCache: h["x-vercel-cache"] || null,
      contentLength,
    });

    if (url.includes(".supabase.co/storage/v1/object/public/")) {
      storageAssetChecks.push({ url: url.slice(0, 140), cacheControl, status });
    }
  });

  const t0 = Date.now();
  await page.goto(`${cfg.baseUrl}${pageDef.path}`, { waitUntil: "load", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  const wallMs = Date.now() - t0;
  await page.waitForTimeout(250);

  const cookies = await ctx.cookies();
  const cookieHeaderBytes = cookies.reduce(
    (sum, c) => sum + c.name.length + (c.value ? c.value.length : 0) + 2,
    0
  );

  const data = await page.evaluate(async () => {
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource").map((r) => {
      let host = "unknown";
      try {
        host = new URL(r.name).hostname;
      } catch {}
      return {
        name: r.name,
        host,
        initiatorType: r.initiatorType,
        duration: r.duration,
        startTime: r.startTime,
        transferSize: r.transferSize || 0,
        decodedBodySize: r.decodedBodySize || 0,
      };
    });

    const urlCounts = {};
    const byType = {};
    const byHost = {};
    let totalTransfer = 0;
    let totalDecoded = 0;

    for (const r of resources) {
      totalTransfer += r.transferSize;
      totalDecoded += r.decodedBodySize;
      urlCounts[r.name] = (urlCounts[r.name] || 0) + 1;

      if (!byType[r.initiatorType]) {
        byType[r.initiatorType] = { count: 0, transferBytes: 0, decodedBytes: 0 };
      }
      byType[r.initiatorType].count += 1;
      byType[r.initiatorType].transferBytes += r.transferSize;
      byType[r.initiatorType].decodedBytes += r.decodedBodySize;

      if (!byHost[r.host]) byHost[r.host] = { count: 0, transferBytes: 0, maxDuration: 0 };
      byHost[r.host].count += 1;
      byHost[r.host].transferBytes += r.transferSize;
      byHost[r.host].maxDuration = Math.max(byHost[r.host].maxDuration, r.duration);
    }

    const duplicateFetches = Object.entries(urlCounts)
      .filter(([, count]) => count > 1)
      .map(([url, count]) => ({ url: url.slice(0, 120), count }));

    // Image optimization inspection
    const vh = window.innerHeight;
    const oversizedImages = [];
    const eagerBelowFoldImages = [];
    const imgElements = [...document.querySelectorAll("img")];
    for (const img of imgElements) {
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (img.naturalWidth > 100 && rect.width >= 24 && img.naturalWidth > rect.width * 2.5) {
        oversizedImages.push({
          src: (img.getAttribute("src") || "").slice(0, 100),
          natural: `${img.naturalWidth}x${img.naturalHeight}`,
          rendered: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          ratio: Number((img.naturalWidth / rect.width).toFixed(1)),
        });
      }
      const loadingAttr = (img.getAttribute("loading") || "").toLowerCase();
      if (rect.top > vh * 1.4 && loadingAttr !== "lazy") {
        eagerBelowFoldImages.push((img.getAttribute("src") || "").slice(0, 90));
      }
    }

    // Client Storage & Hydration telemetry
    let localStorageBytes = 0;
    const localStorageItems = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        const v = localStorage.getItem(k) || "";
        const bytes = (k.length + v.length) * 2;
        localStorageBytes += bytes;
        localStorageItems.push({ key: k, bytes });
      }
    } catch {}
    localStorageItems.sort((a, b) => b.bytes - a.bytes);

    let sessionStorageBytes = 0;
    let sessionStorageKeys = 0;
    try {
      sessionStorageKeys = sessionStorage.length;
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i) || "";
        const v = sessionStorage.getItem(k) || "";
        sessionStorageBytes += (k.length + v.length) * 2;
      }
    } catch {}

    let cacheStorageKeys = [];
    try {
      if ("caches" in window) cacheStorageKeys = await caches.keys();
    } catch {}

    let indexedDbCount = 0;
    try {
      if (indexedDB?.databases) {
        const dbs = await indexedDB.databases();
        indexedDbCount = dbs.length;
      }
    } catch {}

    const hydrationBytes = [...document.querySelectorAll("script")]
      .filter((s) => !s.src && s.textContent?.includes("__next_f"))
      .reduce((sum, s) => sum + (s.textContent?.length || 0), 0);

    const domNodes = document.querySelectorAll("*").length;
    let maxDomDepth = 0;
    try {
      const walk = (el, depth) => {
        if (depth > maxDomDepth) maxDomDepth = depth;
        for (const ch of el.children) walk(ch, depth + 1);
      };
      if (document.body) walk(document.body, 1);
    } catch {}

    const usedHeapBytes = performance.memory?.usedJSHeapSize || 0;

    const pm = window.__perfMetrics || {};
    const longTasks = pm.longTasks || [];
    const tbtMs = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);

    return {
      nav: nav
        ? {
            dnsMs: nav.domainLookupEnd - nav.domainLookupStart,
            tcpMs: nav.connectEnd - nav.connectStart,
            tlsMs:
              nav.secureConnectionStart > 0
                ? nav.connectEnd - nav.secureConnectionStart
                : 0,
            ttfbMs: nav.responseStart - nav.requestStart,
            domInteractiveMs: nav.domInteractive,
            domContentLoadedMs: nav.domContentLoadedEventEnd,
            loadEventMs: nav.loadEventEnd,
            docTransferBytes: nav.transferSize || 0,
            docDecodedBytes: nav.decodedBodySize || 0,
          }
        : null,
      vitals: {
        fcpMs: pm.fcp,
        lcpMs: pm.lcp ? pm.lcp.startTime : null,
        lcpElement: pm.lcp ? pm.lcp.element : null,
        cls: Number((pm.cls || 0).toFixed(4)),
        longTaskCount: longTasks.length,
        tbtMs,
      },
      resources,
      resourcesSummary: {
        count: resources.length,
        totalTransferBytes: totalTransfer,
        totalDecodedBytes: totalDecoded,
        byType,
        byHost,
      },
      duplicateFetches,
      images: {
        count: imgElements.length,
        oversized: oversizedImages.slice(0, 6),
        eagerBelowFoldCount: eagerBelowFoldImages.length,
      },
      storage: {
        localStorageKeys: localStorageItems.length,
        localStorageBytes,
        topLocalKeys: localStorageItems.slice(0, 5),
        sessionStorageKeys,
        sessionStorageBytes,
        cacheStorageKeys,
        indexedDbCount,
      },
      hydration: {
        nextFBytes: hydrationBytes,
        domNodes,
        maxDomDepth,
        usedHeapBytes,
      },
      largestRequests: [...resources]
        .sort((a, b) => b.transferSize - a.transferSize)
        .slice(0, 8)
        .map((r) => ({
          url: r.name.slice(0, 120),
          type: r.initiatorType,
          transferKb: Math.round((r.transferSize / 1024) * 10) / 10,
          decodedKb: Math.round((r.decodedBodySize / 1024) * 10) / 10,
          durationMs: Math.round(r.duration),
        })),
      slowestRequests: [...resources]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 8)
        .map((r) => ({
          url: r.name.slice(0, 120),
          type: r.initiatorType,
          durationMs: Math.round(r.duration),
          transferKb: Math.round((r.transferSize / 1024) * 10) / 10,
        })),
    };
  });

  await ctx.close();

  return {
    route: pageDef.path,
    alias: pageDef.alias,
    auth: Boolean(storageStatePath),
    width,
    run: runIndex,
    wallMs,
    docHeaders,
    failedRequests,
    rscInitialCount: rscInitialRequests.length,
    storageAssetChecks,
    uncompressedCandidates,
    cookies: { count: cookies.length, headerBytes: cookieHeaderBytes },
    ...data,
  };
}

async function auditWarmAndInteractive(browser, targets, storageStatePath = null) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  if (storageStatePath) {
    await setViewAs(ctx, cfg.baseUrl, { mode: "clear" }).catch(() => {});
  }
  const page = await ctx.newPage();
  await apply4gThrottle(page);
  await page.goto(`${cfg.baseUrl}/`, { waitUntil: "networkidle", timeout: 45000 });

  const warmResults = [];
  for (const target of targets) {
    const rscEvents = [];
    const onResponse = async (res) => {
      const req = res.request();
      if (req.headers()["rsc"] === "1" || req.url().includes("_rsc=")) {
        const h = res.headers();
        let bodyLen = 0;
        try {
          bodyLen = (await res.body()).length;
        } catch {}
        rscEvents.push({
          url: res.url().slice(0, 120),
          status: res.status(),
          xVercelCache: h["x-vercel-cache"] || null,
          bodyKb: kb(bodyLen),
        });
      }
    };
    page.on("response", onResponse);

    const link = page.locator(`header a[href="${target.path}"]`).first();
    const visible = await link.isVisible().catch(() => false);
    if (!visible) {
      page.off("response", onResponse);
      continue;
    }

    const t0 = Date.now();
    await Promise.all([
      page.waitForURL((u) => u.pathname === target.path, { timeout: 15000 }).catch(() => {}),
      link.click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const navMs = Date.now() - t0;
    page.off("response", onResponse);

    const cacheStats = await page
      .evaluate(() => {
        const entries = performance.getEntriesByType("resource");
        const staticEntries = entries.filter(
          (e) => e.initiatorType === "script" || e.initiatorType === "img" || e.initiatorType === "link"
        );
        const cached = staticEntries.filter((e) => e.transferSize === 0).length;
        return { totalStatic: staticEntries.length, cachedStatic: cached };
      })
      .catch(() => ({ totalStatic: 0, cachedStatic: 0 }));

    warmResults.push({
      to: target.path,
      auth: Boolean(storageStatePath),
      navMs,
      rscCount: rscEvents.length,
      rscKb: Number(rscEvents.reduce((s, e) => s + e.bodyKb, 0).toFixed(1)),
      cacheHitPct: cacheStats.totalStatic
        ? Math.round((cacheStats.cachedStatic / cacheStats.totalStatic) * 100)
        : 0,
    });
  }

  // Interactive tab switch latency on /stats
  const interactiveTimings = [];
  if (matchesPageFilter(cfg, "stats", "/stats")) {
    await page.goto(`${cfg.baseUrl}/stats`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    for (const tabLabel of ["Teams", "General", "Players"]) {
      const btn = page.locator("button", { hasText: new RegExp(`^\\s*${tabLabel}\\s*$`, "i") }).first();
      if ((await btn.count().catch(() => 0)) > 0) {
        const t0 = Date.now();
        await btn.click();
        await page.waitForTimeout(30);
        const ms = Date.now() - t0;
        interactiveTimings.push({ label: `/stats -> ${tabLabel} tab`, ms });
      }
    }
  }

  await ctx.close();
  return { warmResults, interactiveTimings };
}

async function auditPublicApis(browser) {
  const ctx = await browser.newContext();
  const endpoints = [
    { name: "Recent Content API", path: "/api/recent-content", expectType: "json" },
    { name: "Champions API", path: "/api/champions", expectType: "json" },
    { name: "Consensus OG Image", path: "/api/og/consensus", expectType: "image" },
    { name: "Robots.txt", path: "/robots.txt", expectType: "text" },
    { name: "Sitemap.xml", path: "/sitemap.xml", expectType: "xml" },
  ];

  const rows = [];
  for (const ep of endpoints) {
    const t0 = Date.now();
    try {
      const res = await ctx.request.get(`${cfg.baseUrl}${ep.path}`, { timeout: 25000 });
      const ms = Date.now() - t0;
      const buf = await res.body();
      const headers = res.headers();
      rows.push({
        ...ep,
        status: res.status(),
        ms,
        kb: kb(buf.length),
        cacheControl: headers["cache-control"] || null,
        xVercelCache: headers["x-vercel-cache"] || null,
      });
    } catch (err) {
      rows.push({
        ...ep,
        status: 0,
        ms: Date.now() - t0,
        kb: 0,
        error: String(err),
      });
    }
  }
  await ctx.close();
  return rows;
}

async function main() {
  const savedAuth = cfg.noAuth
    ? null
    : await ensureAuthStorageState(cfg.baseUrl, cfg.authFile, cfg.loginMode);
  const canAuth = Boolean(savedAuth && hasRole(cfg, "admin"));

  const reporter = createAuditReporter({
    title: "Rankr Deep Performance, Storage & Caching Audit",
    baseUrl: cfg.baseUrl,
    outDir: cfg.outDir,
    meta: {
      runs: cfg.runs,
      throttle4g: cfg.throttle4g,
      widths: cfg.widths.join(", "),
      authEnabled: canAuth,
      sections: cfg.sections ? [...cfg.sections].join(", ") : "ALL",
      metrics: cfg.metrics ? [...cfg.metrics].join(", ") : "ALL",
    },
    baselinePath: cfg.baselinePath,
  });

  const browser = await launchAuditBrowser(true);
  const coldRuns = [];
  const allWarm = [];
  const allInteractive = [];
  let apiRows = [];

  try {
    const entities = await discoverSiteEntities(browser, cfg.baseUrl);
    const routePool = [
      { alias: "home", path: "/", auth: false },
      { alias: "browse", path: "/browse", auth: false },
      { alias: "consensus", path: "/consensus", auth: false },
      { alias: "stats", path: "/stats", auth: false },
      { alias: "team-hub", path: "/team-hub", auth: false },
      { alias: "legal", path: "/terms", auth: false },
      ...(entities.playerHref ? [{ alias: "stats-player", path: entities.playerHref, auth: false }] : []),
      ...(entities.teamHref ? [{ alias: "stats-team", path: entities.teamHref, auth: false }] : []),
      ...(entities.matchHref ? [{ alias: "stats-match", path: entities.matchHref, auth: false }] : []),
      ...(entities.championHref ? [{ alias: "stats-champion", path: entities.championHref, auth: false }] : []),
      ...(entities.rankingHref ? [{ alias: "ranking", path: entities.rankingHref, auth: false }] : []),
      ...(entities.tierlistHref ? [{ alias: "tierlist", path: entities.tierlistHref, auth: false }] : []),
      ...(entities.blogHref ? [{ alias: "blog", path: entities.blogHref, auth: false }] : []),
      ...(canAuth
        ? [
            { alias: "create", path: "/create", auth: true },
            { alias: "my-history", path: "/my-history", auth: true },
            { alias: "admin", path: "/admin", auth: true },
            { alias: "admin-stats", path: "/admin/stats", auth: true },
            { alias: "admin-users", path: "/admin/users", auth: true },
            { alias: "admin-publishings", path: "/admin/publishings", auth: true },
          ]
        : []),
    ].filter((r) => matchesPageFilter(cfg, r.alias, r.path));

    if (hasSection(cfg, "cold") || hasSection(cfg, "network") || hasSection(cfg, "assets") || hasSection(cfg, "storage")) {
      const storageAuditChecked = new Set();

      for (const route of routePool) {
        const widthList = cfg.widthsExplicit ? cfg.widths : [cfg.widths[0], ...(cfg.widths.includes(390) ? [390] : [])];
        for (const w of widthList) {
          const rCount = w === widthList[0] ? cfg.runs : 1;
          for (let i = 1; i <= rCount; i++) {
            const res = await auditColdPage(
              browser,
              route,
              w,
              i,
              route.auth ? savedAuth : null
            );
            coldRuns.push(res);

            const suite = `${route.alias}@${w}px`;
            const nav = res.nav || {};
            const v = res.vitals || {};

            if (hasSection(cfg, "cold")) {
              if (hasMetric(cfg, "ttfb")) {
                const ttfb = round(nav.ttfbMs);
                reporter.record({
                  suite,
                  category: "ttfb",
                  name: `TTFB run #${i}`,
                  metric: ttfb,
                  status: ttfb <= 800 * budgetScale ? "PASS" : ttfb <= 1800 * budgetScale ? "WARN" : "FAIL",
                  details: `${ttfb}ms (cache=${res.docHeaders.xVercelCache || "-"})`,
                  recommendation:
                    ttfb > 1800 * budgetScale
                      ? `Investigate SSR database fan-out or missing unstable_cache on ${route.path}`
                      : null,
                });
              }

              if (hasMetric(cfg, "vitals")) {
                const lcp = round(v.lcpMs);
                if (lcp > 0) {
                  reporter.record({
                    suite,
                    category: "vitals",
                    name: `LCP run #${i}`,
                    metric: lcp,
                    status: lcp <= 2500 * budgetScale ? "PASS" : lcp <= 4000 * budgetScale ? "WARN" : "FAIL",
                    details: `${lcp}ms (el=${v.lcpElement || "-"})`,
                    recommendation:
                      lcp > 2500 * budgetScale
                        ? `Optimize LCP element (${v.lcpElement || "unknown"}) on ${route.path}`
                        : null,
                  });
                }
                reporter.record({
                  suite,
                  category: "vitals",
                  name: `CLS run #${i}`,
                  metric: v.cls,
                  status: v.cls <= 0.1 ? "PASS" : v.cls <= 0.25 ? "WARN" : "FAIL",
                  details: `${v.cls}`,
                  recommendation:
                    v.cls > 0.1
                      ? `Reserve explicit width/height/min-height to prevent layout shifts on ${route.path}`
                      : null,
                });
                const tbt = round(v.tbtMs);
                reporter.record({
                  suite,
                  category: "vitals",
                  name: `TBT run #${i}`,
                  metric: tbt,
                  status: tbt <= 200 * budgetScale ? "PASS" : tbt <= 600 * budgetScale ? "WARN" : "FAIL",
                  details: `${tbt}ms (${v.longTaskCount} long tasks)`,
                  recommendation:
                    tbt > 200 * budgetScale
                      ? `Split heavy client hydration/compute on ${route.path}`
                      : null,
                });
              }
            }

            // Network, Asset, Storage checks evaluate on Run #1 of primary width (avoids duplicate noise)
            if (i === 1 && w === widthList[0]) {
              if (hasSection(cfg, "network")) {
                if (hasMetric(cfg, "transfer")) {
                  const xferKb = kb(res.resourcesSummary.totalTransferBytes);
                  reporter.record({
                    suite: route.alias,
                    category: "network",
                    name: `Failed sub-requests`,
                    metric: res.failedRequests.length,
                    status: res.failedRequests.length === 0 ? "PASS" : "FAIL",
                    details:
                      res.failedRequests.length === 0
                        ? `0 failed (${res.resourcesSummary.count} reqs, ${xferKb}KB)`
                        : res.failedRequests.map((f) => `${f.status}:${f.url}`).slice(0, 3).join("; "),
                    recommendation:
                      res.failedRequests.length > 0
                        ? `Fix 4xx/5xx asset requests on ${route.path}`
                        : null,
                  });

                  const jsKb = kb(res.resourcesSummary.byType.script?.transferBytes || 0);
                  reporter.record({
                    suite: route.alias,
                    category: "transfer",
                    name: `Total transfer & JS payload`,
                    metric: xferKb,
                    status: xferKb <= 1500 && jsKb <= 650 ? "PASS" : xferKb <= 3000 ? "WARN" : "FAIL",
                    details: `total=${xferKb}KB, js=${jsKb}KB, reqs=${res.resourcesSummary.count}`,
                  });
                }

                if (hasMetric(cfg, "rsc")) {
                  reporter.record({
                    suite: route.alias,
                    category: "rsc",
                    name: `Initial load RSC prefetch burst`,
                    metric: res.rscInitialCount,
                    status: res.rscInitialCount <= 10 ? "PASS" : "WARN",
                    details: `${res.rscInitialCount} _rsc requests on idle load`,
                    recommendation:
                      res.rscInitialCount > 10
                        ? `Add prefetch={false} on dense Link cards/tables in ${route.path} (per AGENTS.md)`
                        : null,
                  });
                }

                if (hasMetric(cfg, "cache")) {
                  const shortCacheAssets = res.storageAssetChecks.filter(
                    (a) => !a.cacheControl.includes("max-age=31536000") && !a.cacheControl.includes("86400")
                  );
                  if (res.storageAssetChecks.length > 0) {
                    reporter.record({
                      suite: route.alias,
                      category: "cache",
                      name: `Supabase Storage Cache-Control headers`,
                      metric: shortCacheAssets.length,
                      status: shortCacheAssets.length === 0 ? "PASS" : "WARN",
                      details:
                        shortCacheAssets.length === 0
                          ? `${res.storageAssetChecks.length} storage assets cleanly cached`
                          : `${shortCacheAssets.length}/${res.storageAssetChecks.length} missing 1y max-age (${shortCacheAssets[0]?.cacheControl || "none"})`,
                      recommendation:
                        shortCacheAssets.length > 0
                          ? `Ensure uploaded storage assets specify cacheControl: "31536000"`
                          : null,
                    });
                  }

                  const wireUncompressed = !isLocal
                    ? (res.resources || []).filter((r) => {
                        if (!r.name.startsWith("http")) return false;
                        if (r.initiatorType === "img" || r.initiatorType === "media" || r.initiatorType === "font") {
                          return false;
                        }
                        if (/\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|mp4|webm)(\?|$)/i.test(r.name)) {
                          return false;
                        }
                        return (
                          r.decodedBodySize > 30 * 1024 &&
                          r.transferSize > 0 &&
                          r.transferSize >= r.decodedBodySize * 0.92
                        );
                      })
                    : [];
                  if (wireUncompressed.length > 0) {
                    reporter.record({
                      suite: route.alias,
                      category: "compression",
                      name: `Large text assets compression`,
                      metric: wireUncompressed.length,
                      status: "WARN",
                      details: wireUncompressed
                        .slice(0, 3)
                        .map((u) => `${kb(u.transferSize)}KB/${kb(u.decodedBodySize)}KB (${u.initiatorType})`)
                        .join("; "),
                    });
                  }
                }
              }

              if (hasSection(cfg, "assets") && hasMetric(cfg, "images")) {
                reporter.record({
                  suite: route.alias,
                  category: "images",
                  name: `Image sizing & lazy-loading`,
                  metric: res.images.oversized.length + res.images.eagerBelowFoldCount,
                  status:
                    res.images.oversized.length === 0 && res.images.eagerBelowFoldCount <= 3
                      ? "PASS"
                      : "WARN",
                  details: `${res.images.count} imgs, oversized=${res.images.oversized.length}, belowFoldEager=${res.images.eagerBelowFoldCount}`,
                  recommendation:
                    res.images.oversized.length > 0
                      ? `Resize or optimize oversized images (${res.images.oversized[0]?.src} natural ${res.images.oversized[0]?.natural} rendered at ${res.images.oversized[0]?.rendered})`
                      : null,
                });
              }

              if (hasSection(cfg, "storage") && hasMetric(cfg, "storage") && !storageAuditChecked.has(route.auth)) {
                storageAuditChecked.add(route.auth);
                const lsKb = kb(res.storage.localStorageBytes);
                reporter.record({
                  suite: route.auth ? "AuthContext" : "GuestContext",
                  category: "storage",
                  name: `Browser client storage & cookies`,
                  metric: lsKb + kb(res.cookies.headerBytes),
                  status:
                    res.cookies.headerBytes <= 4096 && res.storage.localStorageBytes <= 100 * 1024
                      ? "PASS"
                      : res.cookies.headerBytes > 8192
                      ? "FAIL"
                      : "WARN",
                  details: `localStorage=${lsKb}KB (${res.storage.localStorageKeys} keys), sessionStorage=${kb(
                    res.storage.sessionStorageBytes
                  )}KB, cookies=${res.cookies.count} (${res.cookies.headerBytes}B), CacheAPI=${res.storage.cacheStorageKeys.length}, IDB=${res.storage.indexedDbCount}`,
                  recommendation:
                    res.cookies.headerBytes > 4096
                      ? `Trim total Cookie header size (${res.cookies.headerBytes}B) to keep HTTP requests compact`
                      : null,
                });
              }

              if (hasSection(cfg, "storage") && hasMetric(cfg, "hydration")) {
                const nextFKb = kb(res.hydration.nextFBytes);
                reporter.record({
                  suite: route.alias,
                  category: "hydration",
                  name: `RSC hydration payload & DOM complexity`,
                  metric: res.hydration.domNodes,
                  status:
                    nextFKb <= 350 && res.hydration.domNodes <= 2800
                      ? "PASS"
                      : nextFKb > 700 || res.hydration.domNodes > 5000
                      ? "FAIL"
                      : "WARN",
                  details: `RSC payload=${nextFKb}KB, DOM nodes=${res.hydration.domNodes}, maxDepth=${res.hydration.maxDomDepth}, heap=${kb(
                    res.hydration.usedHeapBytes
                  )}KB`,
                  recommendation:
                    nextFKb > 350
                      ? `Slim serialized Server Component props passed to Client Components on ${route.path} (currently ${nextFKb}KB)`
                      : null,
                });
              }
            }
          }
        }
      }
    }

    if (hasSection(cfg, "warm")) {
      const publicWarmTargets = [
        { path: "/browse" },
        { path: "/consensus" },
        { path: "/stats" },
        { path: "/" },
      ].filter((t) => matchesPageFilter(cfg, t.path === "/" ? "home" : t.path.slice(1), t.path));

      const pubWarm = await auditWarmAndInteractive(browser, publicWarmTargets, null);
      allWarm.push(...pubWarm.warmResults);
      allInteractive.push(...pubWarm.interactiveTimings);

      if (canAuth) {
        const authWarm = await auditWarmAndInteractive(
          browser,
          [
            { path: "/create" },
            { path: "/my-history" },
            { path: "/admin" },
          ].filter((t) => matchesPageFilter(cfg, t.path.slice(1), t.path)),
          savedAuth
        );
        allWarm.push(...authWarm.warmResults);
      }

      for (const w of allWarm) {
        reporter.record({
          suite: w.auth ? "WarmAuth" : "WarmGuest",
          category: "warm-nav",
          name: `Client nav -> ${w.to}`,
          metric: w.navMs,
          status: w.navMs <= 1500 * budgetScale ? "PASS" : w.navMs <= 3000 * budgetScale ? "WARN" : "FAIL",
          details: `${w.navMs}ms, rsc=${w.rscCount} (${w.rscKb}KB), staticCacheHit=${w.cacheHitPct}%`,
        });
      }
      for (const it of allInteractive) {
        reporter.record({
          suite: "Interactive",
          category: "latency",
          name: it.label,
          metric: it.ms,
          status: it.ms <= 400 ? "PASS" : it.ms <= 1000 ? "WARN" : "FAIL",
          details: `${it.ms}ms`,
        });
      }
    }

    if (hasSection(cfg, "api")) {
      apiRows = await auditPublicApis(browser);
      for (const row of apiRows) {
        reporter.record({
          suite: "PublicAPI",
          category: "api",
          name: `${row.name} (${row.path})`,
          metric: row.ms,
          status:
            row.status === 200 && row.ms <= 1500 * budgetScale
              ? "PASS"
              : row.status === 200
              ? "WARN"
              : "FAIL",
          details: `status=${row.status}, ${row.ms}ms, ${row.kb}KB, cache=${row.xVercelCache || row.cacheControl || "-"}`,
        });
      }
    }

    // Extra summary tables for Markdown report
    const slowestRoutes = [...coldRuns]
      .sort((a, b) => (b.nav?.ttfbMs || 0) - (a.nav?.ttfbMs || 0))
      .slice(0, 8);
    const slowestMd = slowestRoutes.length
      ? [
          `## Top Cold TTFB & LCP Observations`,
          ``,
          `| Route | Width | TTFB (ms) | FCP (ms) | LCP (ms) | TBT (ms) | Transfer (KB) | RSC Payload (KB) | Cache |`,
          `| :--- | :---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |`,
          ...slowestRoutes.map(
            (r) =>
              `| ${r.route} | ${r.width}px | ${round(r.nav?.ttfbMs)} | ${round(
                r.vitals?.fcpMs
              )} | ${round(r.vitals?.lcpMs)} | ${round(r.vitals?.tbtMs)} | ${kb(
                r.resourcesSummary?.totalTransferBytes
              )} | ${kb(r.hydration?.nextFBytes)} | ${r.docHeaders?.xVercelCache || "-"} |`
          ),
        ].join("\n")
      : "";

    const out = reporter.finalize({ entities, coldRuns, warmNavs: allWarm, apiRows }, [slowestMd]);
    if (out.failCount > 0) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
