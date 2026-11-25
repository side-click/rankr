import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  attachErrorCollectors,
  createAuditReporter,
  discoverRoleTargets,
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
  waitForImagesSettled,
} from "./lib/audit-core.mjs";

const cfg = parseAuditArgs(process.argv.slice(2), {
  outDir: "temp/visual-audit",
  widths: [1920, 1440, 1280, 1024, 980, 768, 430, 390, 360],
  screenshots: "all",
});

if (cfg.help) {
  console.log(
    formatCommonHelp("audit:visual", [
      ``,
      `Visual Audit Specifics:`,
      `  Sections (--sections=):    layout,readability,aesthetics,assets,interactive,auth`,
      `  Metrics (--metrics=):      overflow,broken-images,overlap,clipping,contrast,`,
      `                             typography,cohesion,asset-reuse,tap-targets,alignment,breakpoints`,
      `  Default widths:            1920,1440,1280,1024,980,768,430,390,360`,
    ])
  );
  process.exit(0);
}

const screenshotDir = path.join(cfg.outDir, "screenshots");
fs.rmSync(screenshotDir, { recursive: true, force: true });
if (cfg.screenshots !== "none") {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function inspectViewDOM(page, viewportWidth) {
  return page.evaluate((vw) => {
    const parseColor = (str) => {
      if (!str || str === "transparent") return [0, 0, 0, 0];
      const m = str.match(/rgba?\(([^)]+)\)/i);
      if (!m) return null;
      const parts = m[1].split(",").map((p) => Number(p.trim()));
      return [
        parts[0] ?? 0,
        parts[1] ?? 0,
        parts[2] ?? 0,
        parts[3] === undefined || Number.isNaN(parts[3]) ? 1 : parts[3],
      ];
    };

    const parseGradientColor = (bgImage) => {
      if (!bgImage || bgImage === "none") return null;
      const matches = [...bgImage.matchAll(/rgba?\(([^)]+)\)/gi)];
      if (matches.length === 0) return null;
      const parsed = matches
        .map((m) => parseColor(m[0]))
        .filter((c) => c && c[3] > 0.2);
      if (parsed.length === 0) return null;
      const sum = parsed.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]);
      return [sum[0] / parsed.length, sum[1] / parsed.length, sum[2] / parsed.length, 1];
    };

    const blendOver = (fg, bg) => {
      const a = fg[3];
      return [
        fg[0] * a + bg[0] * (1 - a),
        fg[1] * a + bg[1] * (1 - a),
        fg[2] * a + bg[2] * (1 - a),
      ];
    };

    const luminance = ([r, g, b]) => {
      const toLin = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    };

    const contrastRatio = (c1, c2) => {
      const l1 = luminance(c1);
      const l2 = luminance(c2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    const isVisible = (el) => {
      const detailsParent = el.closest("details");
      if (detailsParent && !detailsParent.open && !el.closest("summary")) {
        return false;
      }
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) {
        return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    };

    const describeEl = (el) => {
      const tag = el.tagName.toLowerCase();
      const cls =
        typeof el.className === "string" && el.className.trim()
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30);
      return `${tag}${cls}${txt ? `("${txt}")` : ""}`;
    };

    // 1. Horizontal overflow + culprits
    const overflowPx = Math.round(document.documentElement.scrollWidth - vw);
    const overflowCulprits = [];
    if (overflowPx > 1) {
      for (const el of document.querySelectorAll("body *")) {
        if (!isVisible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 2) {
          overflowCulprits.push({ el: describeEl(el), rightPx: Math.round(r.right) });
          if (overflowCulprits.length >= 5) break;
        }
      }
    }

    // 2. Navbar height + invariant check
    const navHrefs = [...document.querySelectorAll("header a[href], nav a[href]")].map(
      (a) => a.getAttribute("href") || ""
    );
    const leaksMatchHubInNav = navHrefs.some(
      (h) => h === "/matches" || h.startsWith("/matches?") || h === "/team-hub" || h.startsWith("/team-hub?")
    );
    const headerEl = document.querySelector("header");
    const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 0;

    // 3. Overlap detector (skip dropdowns/popovers)
    const overlapPairs = [];
    const checkEls = [...document.querySelectorAll("header button, header a, main button, main a, main select, main input")]
      .filter((el) => {
        if (!isVisible(el)) return false;
        if (el.closest(".absolute, .fixed, [role='menu'], [role='dialog']")) return false;
        const r = el.getBoundingClientRect();
        return r.width >= 12 && r.height >= 12;
      })
      .slice(0, 140);

    const rects = checkEls.map((el) => ({ el, r: el.getBoundingClientRect() }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const A = rects[i];
        const B = rects[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        const ix = Math.max(0, Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left));
        const iy = Math.max(0, Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top));
        if (ix > 2 && iy > 2) {
          const area = ix * iy;
          const minArea = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
          if (minArea > 0 && area / minArea > 0.25) {
            overlapPairs.push(`${describeEl(A.el)} <-> ${describeEl(B.el)}`);
            if (overlapPairs.length >= 5) break;
          }
        }
      }
      if (overlapPairs.length >= 5) break;
    }

    // 4. Text clipping & tiny font & WCAG contrast & white light-mode leaks
    const clippedTexts = [];
    const tinyFonts = [];
    const lowContrast = [];
    const lightThemeLeaks = [];
    const serifLeaks = [];

    const textCandidates = [...document.querySelectorAll("h1, h2, h3, h4, button, a, label, th, td, p, span")]
      .filter((el) => {
        if (!isVisible(el)) return false;
        const s = getComputedStyle(el);
        if (parseFloat(s.opacity) < 0.75) return false;
        if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
        const hasDirectText = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim().length > 0
        );
        return hasDirectText;
      })
      .slice(0, 140);

    for (const el of textCandidates) {
      const s = getComputedStyle(el);
      const fontSize = parseFloat(s.fontSize) || 14;
      const weight = parseInt(s.fontWeight, 10) || 400;

      if (
        (el.tagName === "BUTTON" || el.tagName === "A" || /^H[1-4]$/.test(el.tagName) || el.tagName === "TH") &&
        s.overflowX === "hidden" &&
        s.textOverflow !== "ellipsis" &&
        el.scrollWidth > el.clientWidth + 5
      ) {
        clippedTexts.push(describeEl(el));
      }

      if (fontSize < 9.5 && !el.closest(".xp-titlebar-btn")) {
        tinyFonts.push(`${describeEl(el)} (${fontSize.toFixed(1)}px)`);
      }

      if (/times new roman/i.test(s.fontFamily) && !el.closest(".wow-heading") && !s.fontFamily.toLowerCase().includes("georgia")) {
        serifLeaks.push(describeEl(el));
      }

      // Compute effective background by walking ancestors
      let effBg = [14, 19, 23]; // #0e1311
      const chain = [];
      let cur = el;
      while (cur && cur.nodeType === Node.ELEMENT_NODE) {
        chain.unshift(cur);
        cur = cur.parentElement;
      }
      for (const node of chain) {
        const ns = getComputedStyle(node);
        const bgc = parseColor(ns.backgroundColor);
        if (bgc && bgc[3] > 0.02) {
          effBg = blendOver(bgc, effBg);
        } else if (ns.backgroundImage && ns.backgroundImage !== "none") {
          const grad = parseGradientColor(ns.backgroundImage);
          if (grad) effBg = blendOver(grad, effBg);
        }
      }

      const fg = parseColor(s.color);
      if (fg && fg[3] > 0.4) {
        const effFg = blendOver(fg, effBg);
        const ratio = contrastRatio(effFg, effBg);
        const isLarge = fontSize >= 18 || (fontSize >= 14 && weight >= 700);
        const minReq = isLarge ? 3.0 : 4.5;
        if (ratio < minReq) {
          lowContrast.push({
            el: describeEl(el),
            ratio: Number(ratio.toFixed(2)),
            minReq,
            fontSize: Math.round(fontSize),
          });
        }
      }
    }

    // Light-mode container leaks (bright white backgrounds excluding tiny badges/svg)
    for (const el of document.querySelectorAll("main div, main input, main select, main textarea, main table")) {
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 28 || r.height < 24) continue;
      const bg = parseColor(getComputedStyle(el).backgroundColor);
      if (bg && bg[0] > 238 && bg[1] > 238 && bg[2] > 238 && bg[3] > 0.85) {
        lightThemeLeaks.push(describeEl(el));
        if (lightThemeLeaks.length >= 5) break;
      }
    }

    // 5. Mobile tap targets + table scroll wrapper check
    const smallTapTargets = [];
    const unwrappedWideTables = [];
    if (vw <= 768) {
      for (const el of document.querySelectorAll("header button, header a, main button, main a")) {
        if (!isVisible(el)) continue;
        if (el.closest("p") || el.classList.contains("xp-titlebar-btn")) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 26 && r.height < 26) {
          smallTapTargets.push(`${describeEl(el)} (${Math.round(r.width)}x${Math.round(r.height)})`);
          if (smallTapTargets.length >= 6) break;
        }
      }
      for (const tbl of document.querySelectorAll("table")) {
        if (!isVisible(tbl)) continue;
        const tr = tbl.getBoundingClientRect();
        if (tr.width > vw) {
          let wrapped = false;
          let p = tbl.parentElement;
          while (p) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === "auto" || ox === "scroll") {
              wrapped = true;
              break;
            }
            p = p.parentElement;
          }
          if (!wrapped) unwrappedWideTables.push(describeEl(tbl));
        }
      }
    }

    // 6. Card / Dashed-divider row alignment check
    const brokenDividers = [];
    for (const hr of document.querySelectorAll("hr, [class*='border-dashed']")) {
      if (!isVisible(hr)) continue;
      const r = hr.getBoundingClientRect();
      if (r.width < 12 && r.height < 4) brokenDividers.push(describeEl(hr));
    }

    // 7. Placeholder/copy leaks
    const bodyText = document.body?.innerText || "";
    const copyLeaks = [];
    if (bodyText.includes("Sheet mode only")) copyLeaks.push("Sheet mode only");
    if (bodyText.includes("[object Object]")) copyLeaks.push("[object Object]");
    if (bodyText.includes("Invalid Date")) copyLeaks.push("Invalid Date");
    if (/\bNaN\b/.test(bodyText)) copyLeaks.push("NaN");
    if (/\bundefined\b/.test(bodyText)) copyLeaks.push("undefined");

    // 8. Images & SVGs asset health + distortion + reuse inventory
    const brokenImgs = [];
    const distortedImgs = [];
    const missingAltImgs = [];
    const imageUrls = [];

    for (const img of document.querySelectorAll("img")) {
      const src = img.getAttribute("src") || "";
      if (src) imageUrls.push(src);
      if (img.complete && img.naturalWidth === 0) {
        brokenImgs.push(src || img.alt || "(unknown)");
        continue;
      }
      if (!isVisible(img)) continue;
      const r = img.getBoundingClientRect();
      if (
        img.naturalWidth >= 20 &&
        img.naturalHeight >= 20 &&
        r.width >= 20 &&
        r.height >= 20 &&
        getComputedStyle(img).objectFit === "fill"
      ) {
        const natRatio = img.naturalWidth / img.naturalHeight;
        const renRatio = r.width / r.height;
        const diff = Math.abs(natRatio - renRatio) / natRatio;
        if (diff > 0.35) {
          distortedImgs.push(`${src.slice(0, 60)} (${img.naturalWidth}x${img.naturalHeight} in ${Math.round(r.width)}x${Math.round(r.height)})`);
        }
      }
      if (
        r.width >= 24 &&
        r.height >= 24 &&
        img.getAttribute("aria-hidden") !== "true" &&
        !img.hasAttribute("alt")
      ) {
        missingAltImgs.push(src.slice(0, 60));
      }
    }

    const largeInlineSvgs = [];
    for (const svg of document.querySelectorAll("svg")) {
      if (!isVisible(svg)) continue;
      const html = svg.outerHTML || "";
      if (html.length > 600) largeInlineSvgs.push(html);
    }

    return {
      overflowPx,
      overflowCulprits,
      headerHeight,
      leaksMatchHubInNav,
      overlapPairs,
      clippedTexts: clippedTexts.slice(0, 6),
      tinyFonts: tinyFonts.slice(0, 6),
      lowContrast: lowContrast.slice(0, 6),
      lightThemeLeaks,
      serifLeaks: serifLeaks.slice(0, 4),
      smallTapTargets,
      unwrappedWideTables,
      brokenDividers: brokenDividers.slice(0, 4),
      copyLeaks,
      brokenImgs,
      distortedImgs: distortedImgs.slice(0, 5),
      missingAltImgs: missingAltImgs.slice(0, 5),
      imageUrls,
      largeInlineSvgs,
    };
  }, viewportWidth);
}

async function main() {
  const savedAuth = cfg.noAuth
    ? null
    : await ensureAuthStorageState(cfg.baseUrl, cfg.authFile, cfg.loginMode);

  const reporter = createAuditReporter({
    title: "Rankr Deep Visual, Layout, Cohesion & Accessibility Audit",
    baseUrl: cfg.baseUrl,
    outDir: cfg.outDir,
    meta: {
      widths: cfg.widths.join(", "),
      screenshots: cfg.screenshots,
      authEnabled: Boolean(savedAuth),
      sections: cfg.sections ? [...cfg.sections].join(", ") : "ALL",
      metrics: cfg.metrics ? [...cfg.metrics].join(", ") : "ALL",
    },
    baselinePath: cfg.baselinePath,
  });

  const browser = await launchAuditBrowser(true);
  const globalImageUsage = new Map();
  const globalSvgUsage = new Map();
  const capturedViews = [];

  async function runCaptureAndInspect(page, { suite, alias, label, width, role }) {
    await waitForImagesSettled(page, 4000);
    await page.waitForTimeout(200);
    const dom = await inspectViewDOM(page, width);

    for (const src of dom.imageUrls) {
      if (!globalImageUsage.has(src)) globalImageUsage.set(src, new Set());
      globalImageUsage.get(src).add(`${alias}`);
    }
    for (const svgHtml of dom.largeInlineSvgs) {
      const hash = crypto.createHash("sha1").update(svgHtml).digest("hex").slice(0, 10);
      const entry = globalSvgUsage.get(hash) || { count: 0, bytes: svgHtml.length, sample: svgHtml.slice(0, 80) };
      entry.count += 1;
      globalSvgUsage.set(hash, entry);
    }

    let hasIssue = false;

    if (hasSection(cfg, "layout")) {
      if (hasMetric(cfg, "overflow")) {
        const failOverflow = dom.overflowPx > 2;
        if (failOverflow) hasIssue = true;
        reporter.record({
          suite,
          category: "overflow",
          name: `${alias}:${label} @${width}px horizontal overflow`,
          metric: dom.overflowPx,
          status: failOverflow ? "FAIL" : "PASS",
          details: failOverflow
            ? `+${dom.overflowPx}px (${dom.overflowCulprits.map((c) => `${c.el}@${c.rightPx}px`).join(", ")})`
            : "0px overflow",
          recommendation: failOverflow
            ? `Fix horizontal overflow (+${dom.overflowPx}px) on ${alias} at ${width}px`
            : null,
        });
      }

      if (hasMetric(cfg, "overlap") && dom.overlapPairs.length > 0) {
        hasIssue = true;
        reporter.record({
          suite,
          category: "overlap",
          name: `${alias}:${label} @${width}px element overlap`,
          metric: dom.overlapPairs.length,
          status: "FAIL",
          details: dom.overlapPairs.join("; "),
          recommendation: `Resolve overlapping UI elements on ${alias} at ${width}px (${dom.overlapPairs[0]})`,
        });
      }

      if (hasMetric(cfg, "clipping") && dom.clippedTexts.length > 0) {
        hasIssue = true;
        reporter.record({
          suite,
          category: "clipping",
          name: `${alias}:${label} @${width}px clipped labels`,
          metric: dom.clippedTexts.length,
          status: "WARN",
          details: dom.clippedTexts.join(", "),
        });
      }

      if (hasMetric(cfg, "alignment")) {
        if (dom.leaksMatchHubInNav) {
          hasIssue = true;
          reporter.record({
            suite,
            category: "invariant",
            name: `${alias}:${label} @${width}px navbar excludes /matches & /team-hub`,
            status: "FAIL",
            details: "Found /matches or /team-hub link inside public nav bar",
            recommendation: "Remove /matches or /team-hub from Navbar.tsx / HeaderNav.tsx (AGENTS.md invariant)",
          });
        }
        if (width >= 1024 && dom.headerHeight > 110) {
          reporter.record({
            suite,
            category: "layout",
            name: `${alias}:${label} @${width}px desktop navbar height`,
            metric: dom.headerHeight,
            status: "WARN",
            details: `header height=${dom.headerHeight}px (>110px indicates wrapping)`,
          });
        }
      }
    }

    if (hasSection(cfg, "readability")) {
      if (hasMetric(cfg, "contrast") && dom.lowContrast.length > 0) {
        const severe = dom.lowContrast.filter((c) => c.ratio < 2.6);
        if (severe.length > 0) hasIssue = true;
        reporter.record({
          suite,
          category: "contrast",
          name: `${alias}:${label} @${width}px WCAG contrast`,
          metric: dom.lowContrast.length,
          status: severe.length > 0 ? "FAIL" : "WARN",
          details: dom.lowContrast
            .slice(0, 3)
            .map((c) => `${c.el} ${c.ratio}:1 (<${c.minReq}:1)`)
            .join("; "),
          recommendation:
            severe.length > 0
              ? `Improve foreground/background contrast on ${alias} (${severe[0].el} at ${severe[0].ratio}:1)`
              : null,
        });
      }

      if (hasMetric(cfg, "typography") && dom.tinyFonts.length > 0) {
        reporter.record({
          suite,
          category: "typography",
          name: `${alias}:${label} @${width}px sub-9.5px text`,
          metric: dom.tinyFonts.length,
          status: "WARN",
          details: dom.tinyFonts.join(", "),
        });
      }

      if (hasMetric(cfg, "tap-targets") && width <= 768) {
        if (dom.smallTapTargets.length > 0) {
          reporter.record({
            suite,
            category: "tap-targets",
            name: `${alias}:${label} @${width}px mobile tap targets`,
            metric: dom.smallTapTargets.length,
            status: "WARN",
            details: dom.smallTapTargets.join(", "),
          });
        }
        if (dom.unwrappedWideTables.length > 0) {
          hasIssue = true;
          reporter.record({
            suite,
            category: "breakpoints",
            name: `${alias}:${label} @${width}px unwrapped wide table`,
            metric: dom.unwrappedWideTables.length,
            status: "WARN",
            details: dom.unwrappedWideTables.join(", "),
          });
        }
      }
    }

    if (hasSection(cfg, "aesthetics") && hasMetric(cfg, "cohesion")) {
      if (dom.lightThemeLeaks.length > 0 || dom.serifLeaks.length > 0) {
        hasIssue = true;
        reporter.record({
          suite,
          category: "cohesion",
          name: `${alias}:${label} @${width}px retro dark-mode cohesion`,
          status: "WARN",
          details: [
            dom.lightThemeLeaks.length ? `white-bg=[${dom.lightThemeLeaks.join(",")}]` : "",
            dom.serifLeaks.length ? `default-serif=[${dom.serifLeaks.join(",")}]` : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
      }
      if (dom.copyLeaks.length > 0) {
        hasIssue = true;
        reporter.record({
          suite,
          category: "copy-polish",
          name: `${alias}:${label} @${width}px UI copy artifacts`,
          status: "FAIL",
          details: `Found: ${dom.copyLeaks.join(", ")}`,
          recommendation: `Eliminate leaked debug/placeholder strings (${dom.copyLeaks.join(", ")}) on ${alias}`,
        });
      }
    }

    if (hasSection(cfg, "assets")) {
      if (hasMetric(cfg, "broken-images")) {
        const broken = dom.brokenImgs.length;
        if (broken > 0) hasIssue = true;
        reporter.record({
          suite,
          category: "assets",
          name: `${alias}:${label} @${width}px broken images`,
          metric: broken,
          status: broken > 0 ? "FAIL" : "PASS",
          details: broken > 0 ? dom.brokenImgs.slice(0, 4).join(", ") : "0 broken images",
          recommendation: broken > 0 ? `Fix broken image URLs on ${alias}: ${dom.brokenImgs[0]}` : null,
        });
      }
      if (dom.distortedImgs.length > 0) {
        reporter.record({
          suite,
          category: "assets",
          name: `${alias}:${label} @${width}px aspect-ratio distortion`,
          metric: dom.distortedImgs.length,
          status: "WARN",
          details: dom.distortedImgs.join("; "),
        });
      }
      if (dom.missingAltImgs.length > 0 && width === cfg.widths[0]) {
        reporter.record({
          suite,
          category: "accessibility",
          name: `${alias}:${label} @${width}px images missing alt`,
          metric: dom.missingAltImgs.length,
          status: "WARN",
          details: dom.missingAltImgs.join(", "),
        });
      }
    }

    if (cfg.screenshots === "all" || (cfg.screenshots === "issues" && hasIssue)) {
      const safeName = `${role}-${alias}-${label}-${width}px.png`.replace(/[^a-z0-9._-]/gi, "_");
      const filePath = path.join(screenshotDir, safeName);
      await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
      capturedViews.push({
        role,
        alias,
        label,
        width,
        hasIssue,
        file: path.relative(cfg.outDir, filePath).replace(/\\/g, "/"),
      });
    }
  }

  try {
    const entities = await discoverSiteEntities(browser, cfg.baseUrl);
    const publicPages = [
      { alias: "home", path: "/" },
      { alias: "browse", path: "/browse" },
      { alias: "consensus", path: "/consensus" },
      { alias: "stats", path: "/stats", statsTabs: true },
      ...(entities.teamHref ? [{ alias: "stats-team", path: entities.teamHref }] : []),
      ...(entities.playerHref ? [{ alias: "stats-player", path: entities.playerHref }] : []),
      ...(entities.matchHref ? [{ alias: "stats-match", path: entities.matchHref }] : []),
      ...(entities.championHref ? [{ alias: "stats-champion", path: entities.championHref }] : []),
      ...(entities.rankingHref ? [{ alias: "ranking", path: entities.rankingHref }] : []),
      ...(entities.tierlistHref ? [{ alias: "tierlist", path: entities.tierlistHref }] : []),
      ...(entities.blogHref ? [{ alias: "blog", path: entities.blogHref }] : []),
      { alias: "team-hub", path: "/team-hub" },
      { alias: "legal", path: "/terms" },
    ].filter((p) => matchesPageFilter(cfg, p.alias, p.path));

    // Public widths sweep (3 parallel width workers for fast maxed coverage)
    const widthConcurrency = Math.min(3, cfg.widths.length || 1);
    const widthQueue = [...cfg.widths];

    async function runWidthWorker() {
      while (widthQueue.length > 0) {
        const width = widthQueue.shift();
        if (!width) break;
        const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
        const page = await context.newPage();

        for (const target of publicPages) {
          const stopErr = await attachErrorCollectors(page);
          await page.goto(`${cfg.baseUrl}${target.path}`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
          await page.waitForTimeout(200);

          if (target.statsTabs) {
            await runCaptureAndInspect(page, {
              suite: "SignedOut",
              alias: target.alias,
              label: "players",
              width,
              role: "signed-out",
            });
            for (const tab of ["Teams", "General"]) {
              const btn = page.locator("button", { hasText: new RegExp(`^\\s*${tab}\\s*$`, "i") }).first();
              if ((await btn.count().catch(() => 0)) > 0) {
                await btn.click();
                await page.waitForTimeout(180);
                await runCaptureAndInspect(page, {
                  suite: "SignedOut",
                  alias: target.alias,
                  label: tab.toLowerCase(),
                  width,
                  role: "signed-out",
                });
              }
            }
            if (hasSection(cfg, "interactive") && (cfg.widthsExplicit || [1440, 768, 390].includes(width))) {
              const seasonTrig = page
                .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
                .first()
                .locator("button")
                .first();
              if ((await seasonTrig.count().catch(() => 0)) > 0) {
                await seasonTrig.click();
                await page.waitForTimeout(150);
                await runCaptureAndInspect(page, {
                  suite: "SignedOut",
                  alias: target.alias,
                  label: "dropdown-open",
                  width,
                  role: "signed-out",
                });
                await seasonTrig.click().catch(() => {});
              }
            }
          } else {
            await runCaptureAndInspect(page, {
              suite: "SignedOut",
              alias: target.alias,
              label: "full",
              width,
              role: "signed-out",
            });
          }

          const errs = stopErr();
          if (errs.server5xx.length > 0 || errs.pageErrors.length > 0) {
            reporter.record({
              suite: "SignedOut",
              category: "runtime",
              name: `${target.alias} @${width}px runtime errors`,
              status: "FAIL",
              details: `${errs.server5xx.join("; ")} ${errs.pageErrors.join("; ")}`.trim(),
            });
          }
        }
        await context.close();
      }
    }

    await Promise.all(Array.from({ length: widthConcurrency }, () => runWidthWorker()));

    // Authenticated multi-role visual checks
    const authWidths = cfg.widthsExplicit
      ? cfg.widths
      : cfg.widths.filter((w) => [1440, 768, 390].includes(w));
    const effectiveAuthWidths = authWidths.length > 0 ? authWidths : [cfg.widths[0]];

    if (savedAuth && hasSection(cfg, "auth")) {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        storageState: savedAuth,
      });
      const page = await ctx.newPage();

      try {
        await setViewAs(ctx, cfg.baseUrl, { mode: "clear" });
        await page.goto(`${cfg.baseUrl}/admin`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
        const { leagueTarget, teamTarget } = await discoverRoleTargets(page);

        if (hasRole(cfg, "admin")) {
          for (const w of effectiveAuthWidths) {
            await page.setViewportSize({ width: w, height: 900 });

            if (matchesPageFilter(cfg, "create", "/create")) {
              await page.goto(`${cfg.baseUrl}/create`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
              for (const modeLabel of [
                { key: "team", re: /Team Power Rankings/i },
                { key: "player", re: /Player Tier List/i },
                { key: "blog", re: /Blog Post/i },
                { key: "champion-pool", re: /Champion Pool/i },
              ]) {
                const btn = page.locator("button", { hasText: modeLabel.re }).first();
                if ((await btn.count().catch(() => 0)) > 0) {
                  await btn.click();
                  await page.waitForTimeout(250);
                  await runCaptureAndInspect(page, {
                    suite: "AdminVisual",
                    alias: "create",
                    label: modeLabel.key,
                    width: w,
                    role: "admin",
                  });
                }
              }
            }

            if (matchesPageFilter(cfg, "my-history", "/my-history")) {
              await page.goto(`${cfg.baseUrl}/my-history`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
              await runCaptureAndInspect(page, {
                suite: "AdminVisual",
                alias: "my-history",
                label: "full",
                width: w,
                role: "admin",
              });
            }

            if (matchesPageFilter(cfg, "admin", "/admin")) {
              await page.goto(`${cfg.baseUrl}/admin`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
              for (const tabLabel of [
                "Seasons",
                "Divisions",
                "Content Editions",
                "Draft Player Pool",
                "Teams",
                "Schedule & Playoffs",
                "Moderation & Safety",
              ]) {
                const btn = page.locator("button", { hasText: new RegExp(`^${tabLabel}$`) }).first();
                if ((await btn.count().catch(() => 0)) > 0) {
                  await btn.click();
                  await page.waitForTimeout(220);
                  await runCaptureAndInspect(page, {
                    suite: "AdminVisual",
                    alias: "admin",
                    label: tabLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                    width: w,
                    role: "admin",
                  });
                }
              }
            }

            for (const subAdmin of [
              { alias: "admin-stats", path: "/admin/stats" },
              { alias: "admin-users", path: "/admin/users" },
              { alias: "admin-publishings", path: "/admin/publishings" },
            ]) {
              if (!matchesPageFilter(cfg, subAdmin.alias, subAdmin.path)) continue;
              await page.goto(`${cfg.baseUrl}${subAdmin.path}`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
              await runCaptureAndInspect(page, {
                suite: "AdminVisual",
                alias: subAdmin.alias,
                label: "full",
                width: w,
                role: "admin",
              });
            }
          }
        }

        if (hasRole(cfg, "operator") && leagueTarget) {
          await setViewAs(ctx, cfg.baseUrl, {
            mode: "operator",
            leagueId: leagueTarget.id,
            label: leagueTarget.label,
          });
          for (const w of effectiveAuthWidths) {
            await page.setViewportSize({ width: w, height: 900 });
            for (const p of [
              { alias: "admin", path: "/admin" },
              { alias: "team-hub", path: "/team-hub" },
            ]) {
              if (!matchesPageFilter(cfg, p.alias, p.path)) continue;
              await page.goto(`${cfg.baseUrl}${p.path}`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
              await runCaptureAndInspect(page, {
                suite: "OperatorVisual",
                alias: p.alias,
                label: "full",
                width: w,
                role: "operator",
              });
            }
          }
        }

        if (hasRole(cfg, "captain") && teamTarget) {
          await setViewAs(ctx, cfg.baseUrl, {
            mode: "captain",
            teamId: teamTarget.id,
            label: teamTarget.label,
          });
          for (const w of effectiveAuthWidths) {
            await page.setViewportSize({ width: w, height: 900 });
            if (matchesPageFilter(cfg, "team-hub", "/team-hub")) {
              await page.goto(`${cfg.baseUrl}/team-hub`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
              await runCaptureAndInspect(page, {
                suite: "CaptainVisual",
                alias: "team-hub",
                label: "full",
                width: w,
                role: "captain",
              });
            }
          }
        }

        if (hasRole(cfg, "public")) {
          await setViewAs(ctx, cfg.baseUrl, { mode: "public", label: "Regular User" });
          for (const w of effectiveAuthWidths) {
            await page.setViewportSize({ width: w, height: 900 });
            for (const p of [
              { alias: "create", path: "/create" },
              { alias: "team-hub", path: "/team-hub" },
              { alias: "admin", path: "/admin" },
            ]) {
              if (!matchesPageFilter(cfg, p.alias, p.path)) continue;
              await page.goto(`${cfg.baseUrl}${p.path}`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
              await runCaptureAndInspect(page, {
                suite: "RegularVisual",
                alias: p.alias,
                label: "full",
                width: w,
                role: "public",
              });
            }
          }
        }
      } finally {
        await setViewAs(ctx, cfg.baseUrl, { mode: "clear" }).catch(() => {});
        await ctx.close();
      }
    }

    // Asset reuse summary check
    if (hasSection(cfg, "assets") && hasMetric(cfg, "asset-reuse")) {
      const heavyRepeatedSvgs = [...globalSvgUsage.values()].filter((v) => v.count > 12);
      reporter.record({
        suite: "GlobalAssets",
        category: "asset-reuse",
        name: "Cross-page asset reuse & large inline SVG repetition",
        metric: heavyRepeatedSvgs.length,
        status: heavyRepeatedSvgs.length === 0 ? "PASS" : "WARN",
        details: `${globalImageUsage.size} unique images tracked, ${heavyRepeatedSvgs.length} repeated large inline SVGs (>12 instances)`,
        recommendation:
          heavyRepeatedSvgs.length > 0
            ? `Extract repeated large inline SVGs into a shared component/symbol sprite to cut DOM/hydration size`
            : null,
      });
    }

    const screenSection = capturedViews.length
      ? [
          `## Captured Screenshots (${capturedViews.length})`,
          ``,
          `| Role | Page | View | Width | Flagged | File |`,
          `| :--- | :--- | :--- | :---: | :---: | :--- |`,
          ...capturedViews.slice(0, 60).map(
            (v) =>
              `| ${v.role} | ${v.alias} | ${v.label} | ${v.width}px | ${v.hasIssue ? "YES" : "No"} | [${v.file}](${v.file}) |`
          ),
        ].join("\n")
      : "";

    const out = reporter.finalize({ entities, capturedViews }, [screenSection]);
    if (out.failCount > 0) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
