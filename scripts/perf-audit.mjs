import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const argVal = (prefix) => {
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
};

const baseUrl = args.includes("--prod")
  ? "https://leaguerankr.com"
  : argVal("--base=") || "http://localhost:3000";

const runs = Math.max(1, Number(argVal("--runs=") || 2));
const throttle4g = args.includes("--4g");

const defaultPages = [
  { name: "home", path: "/" },
  { name: "browse", path: "/browse" },
  { name: "consensus", path: "/consensus" },
  { name: "stats", path: "/stats" },
  { name: "rank", path: "/rank" },
];

const pages = argVal("--pages=")
  ? argVal("--pages=")
      .split(",")
      .map((p) => {
        const clean = p.trim();
        return { name: clean === "/" ? "home" : clean.replace(/^\//, "").replace(/\//g, "_"), path: clean };
      })
  : defaultPages;

const outDir = path.resolve(argVal("--out=") || "temp/perf-audit");
fs.mkdirSync(outDir, { recursive: true });

function findBrowser() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("No Edge or Chrome executable found");
}

function round(n) {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function kb(bytes) {
  return Number.isFinite(bytes) ? Math.round((bytes / 1024) * 10) / 10 : 0;
}

async function apply4gThrottle(page) {
  if (!throttle4g) return;
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
            element: last.element ? `${last.element.tagName.toLowerCase()}${last.element.id ? "#" + last.element.id : ""}` : null,
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
      // Older observer APIs fallback gracefully
    }
  });
}

async function auditColdPage(browser, pageDef, runIndex) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await apply4gThrottle(page);
  await injectObservers(page);

  let docHeaders = {};
  const failedRequests = [];

  page.on("response", (res) => {
    const req = res.request();
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
      const h = res.headers();
      docHeaders = {
        status: res.status(),
        xVercelCache: h["x-vercel-cache"] || null,
        xVercelId: h["x-vercel-id"] || null,
        cacheControl: h["cache-control"] || null,
        contentEncoding: h["content-encoding"] || null,
        serverTiming: h["server-timing"] || null,
      };
    }
    if (res.status() >= 400) {
      failedRequests.push({ url: res.url(), status: res.status() });
    }
  });

  const t0 = Date.now();
  await page.goto(`${baseUrl}${pageDef.path}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(500);
  const wallMs = Date.now() - t0;

  const data = await page.evaluate(() => {
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
        responseEnd: r.responseEnd,
        transferSize: r.transferSize || 0,
        decodedBodySize: r.decodedBodySize || 0,
      };
    });

    const byType = {};
    const byHost = {};
    let totalTransfer = 0;
    let totalDecoded = 0;

    for (const r of resources) {
      totalTransfer += r.transferSize;
      totalDecoded += r.decodedBodySize;

      if (!byType[r.initiatorType]) byType[r.initiatorType] = { count: 0, transferBytes: 0 };
      byType[r.initiatorType].count += 1;
      byType[r.initiatorType].transferBytes += r.transferSize;

      if (!byHost[r.host]) byHost[r.host] = { count: 0, transferBytes: 0, maxDuration: 0 };
      byHost[r.host].count += 1;
      byHost[r.host].transferBytes += r.transferSize;
      byHost[r.host].maxDuration = Math.max(byHost[r.host].maxDuration, r.duration);
    }

    const pm = window.__perfMetrics || {};
    const longTasks = pm.longTasks || [];
    const tbtMs = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);

    return {
      nav: nav
        ? {
            dnsMs: nav.domainLookupEnd - nav.domainLookupStart,
            tcpMs: nav.connectEnd - nav.connectStart,
            tlsMs: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
            ttfbMs: nav.responseStart - nav.requestStart,
            htmlDownloadMs: nav.responseEnd - nav.responseStart,
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
        lcpUrl: pm.lcp ? pm.lcp.url : null,
        cls: Number((pm.cls || 0).toFixed(4)),
        longTaskCount: longTasks.length,
        tbtMs,
      },
      resourcesSummary: {
        count: resources.length,
        totalTransferBytes: totalTransfer,
        totalDecodedBytes: totalDecoded,
        byType,
        byHost,
      },
      slowestRequests: [...resources]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 8)
        .map((r) => ({
          url: r.name.slice(0, 140),
          type: r.initiatorType,
          durationMs: Math.round(r.duration),
          startMs: Math.round(r.startTime),
          transferKb: Math.round((r.transferSize / 1024) * 10) / 10,
        })),
      largestRequests: [...resources]
        .sort((a, b) => b.transferSize - a.transferSize)
        .slice(0, 8)
        .map((r) => ({
          url: r.name.slice(0, 140),
          type: r.initiatorType,
          transferKb: Math.round((r.transferSize / 1024) * 10) / 10,
          decodedKb: Math.round((r.decodedBodySize / 1024) * 10) / 10,
          durationMs: Math.round(r.duration),
        })),
    };
  });

  await ctx.close();

  return {
    route: pageDef.path,
    name: pageDef.name,
    run: runIndex,
    wallMs,
    docHeaders,
    failedRequests,
    ...data,
  };
}

async function auditWarmNav(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await apply4gThrottle(page);

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 45000 });
  const warmResults = [];

  for (const target of pages.filter((p) => p.path !== "/")) {
    const rscEvents = [];
    const onResponse = async (res) => {
      const req = res.request();
      if (req.headers()["rsc"] === "1" || req.url().includes("_rsc=")) {
        const h = res.headers();
        let bodyLen = 0;
        try {
          const buf = await res.body();
          bodyLen = buf.length;
        } catch {}
        rscEvents.push({
          url: res.url().slice(0, 140),
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
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    const navMs = Date.now() - t0;
    page.off("response", onResponse);

    warmResults.push({
      to: target.path,
      navMs,
      rscCount: rscEvents.length,
      rscEvents,
    });
  }

  await ctx.close();
  return warmResults;
}

async function main() {
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  const coldRuns = [];

  try {
    console.log(`Running perf audit against ${baseUrl} (runs=${runs}, 4g=${throttle4g})...\n`);
    for (const p of pages) {
      for (let i = 1; i <= runs; i++) {
        const res = await auditColdPage(browser, p, i);
        coldRuns.push(res);
        const nav = res.nav || {};
        const v = res.vitals || {};
        console.log(
          `[COLD #${i}] ${res.route.padEnd(11)} | cache=${String(res.docHeaders.xVercelCache || "-").padEnd(9)} | DNS=${round(nav.dnsMs)}ms TLS=${round(nav.tlsMs)}ms TTFB=${round(nav.ttfbMs)}ms | FCP=${round(v.fcpMs)}ms LCP=${round(v.lcpMs)}ms TBT=${round(v.tbtMs)}ms CLS=${v.cls} | reqs=${res.resourcesSummary.count} xfer=${kb(res.resourcesSummary.totalTransferBytes)}KB | wall=${res.wallMs}ms`
        );
      }
    }

    console.log("\nRunning warm client-side navigation audit from /...");
    const warmNavs = await auditWarmNav(browser);
    for (const w of warmNavs) {
      const rscSummary = w.rscEvents.map((e) => `${e.bodyKb}KB(${e.xVercelCache || "-"})`).join(", ");
      console.log(`[WARM] -> ${w.to.padEnd(11)} | nav=${w.navMs}ms | rsc=[${rscSummary}]`);
    }

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      throttle4g,
      runs,
      coldRuns,
      warmNavs,
    };

    const reportPath = path.join(outDir, "report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nSaved full report to ${reportPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
