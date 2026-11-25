import {
  attachErrorCollectors,
  createAuditReporter,
  discoverRoleTargets,
  discoverSiteEntities,
  ensureAuthStorageState,
  formatCommonHelp,
  hasRole,
  hasSection,
  launchAuditBrowser,
  matchesPageFilter,
  parseAuditArgs,
  setViewAs,
} from "./lib/audit-core.mjs";

const cfg = parseAuditArgs(process.argv.slice(2), {
  outDir: "temp/functional-audit",
});

if (cfg.help) {
  console.log(
    formatCommonHelp("audit:functional", [
      ``,
      `Functional Audit Specifics:`,
      `  Sections (--sections=):    home,browse,consensus,stats,drilldowns,content,`,
      `                             team-hub,redirects,api,multi-role`,
      `  Read-Only Safety:          Never clicks Publish/Save/Delete/Generate Code;`,
      `                             always clears preview cookie via mode="clear".`,
    ])
  );
  process.exit(0);
}

const reporter = createAuditReporter({
  title: "Rankr Deep Functional, Pathway, Cache & Multi-Role RBAC Audit",
  baseUrl: cfg.baseUrl,
  outDir: cfg.outDir,
  meta: {
    roles: [...cfg.roles].join(", "),
    sections: cfg.sections ? [...cfg.sections].join(", ") : "ALL",
    pagesFilter: cfg.pagesFilter ? cfg.pagesFilter.join(", ") : "ALL",
  },
  baselinePath: cfg.baselinePath,
});

async function gotoClean(page, pathname, suite, category, label) {
  const stop = await attachErrorCollectors(page);
  const url = pathname.startsWith("http") ? pathname : `${cfg.baseUrl}${pathname}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(300);
  const errs = stop();

  if (errs.server5xx.length > 0 || errs.pageErrors.length > 0) {
    reporter.record({
      suite,
      category,
      name: `${label} (${pathname})`,
      status: "FAIL",
      details: `5xx=${errs.server5xx.join("; ")} pageErr=${errs.pageErrors.join("; ")}`,
      recommendation: `Fix runtime/server errors on ${pathname}`,
    });
  } else if (errs.consoleErrors.length > 0) {
    reporter.record({
      suite,
      category,
      name: `${label} (${pathname})`,
      status: "WARN",
      details: `consoleErrors=${errs.consoleErrors.slice(0, 2).join(" | ")}`,
    });
  } else {
    reporter.record({
      suite,
      category,
      name: `${label} (${pathname})`,
      status: "PASS",
    });
  }
  return errs;
}

async function assertNavbarInvariant(page, suite, contextLabel) {
  const navHrefs = await page
    .locator("header a[href], nav a[href]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("href") || ""))
    .catch(() => []);
  const leaks = navHrefs.filter(
    (h) => h === "/matches" || h.startsWith("/matches?") || h === "/team-hub" || h.startsWith("/team-hub?")
  );
  reporter.record({
    suite,
    category: "invariant",
    name: `Navbar excludes /matches & /team-hub (${contextLabel})`,
    status: leaks.length === 0 ? "PASS" : "FAIL",
    details: leaks.length ? `leaked=[${leaks.join(", ")}]` : "clean",
    recommendation: leaks.length
      ? "Keep /matches and /team-hub out of public header navbars (AGENTS.md invariant)"
      : null,
  });
}

async function runSignedOutSuite(browser, entities) {
  const suite = "SignedOut";
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. HOME: Focus, unfocus, scope parity, nested empty-state integrity & pathway links
    if (hasSection(cfg, "home") && matchesPageFilter(cfg, "home", "/")) {
      await gotoClean(page, "/", suite, "home", "Home initial load");
      await assertNavbarInvariant(page, suite, "home");

      const focusedBtn = page.locator("button", { hasText: /^Focused ✓$/ });
      const focusedCount = await focusedBtn.count();
      reporter.record({
        suite,
        category: "home",
        name: "Home auto-focuses primary active season",
        status: focusedCount === 1 ? "PASS" : "WARN",
        details: `Focused ✓ count=${focusedCount}`,
      });

      // Verify focused season division names match Consensus & Stats division badges (no cross-season leak!)
      if (focusedCount === 1) {
        const scopeCheck = await page.evaluate(() => {
          const btns = [...document.querySelectorAll("button")];
          const fBtn = btns.find((b) => b.textContent?.trim() === "Focused ✓");
          const card = fBtn?.closest("div.xp-inset, div.border");
          const cardDivs = card
            ? [...card.querySelectorAll("a, span")]
                .map((el) => el.textContent?.trim() || "")
                .filter((t) => /division/i.test(t) && t.length < 40)
            : [];
          const statsSection = [...document.querySelectorAll("section, div.xp-window")].find((el) =>
            el.textContent?.includes("Season Stats")
          );
          const consensusSection = [...document.querySelectorAll("section, div.xp-window")].find((el) =>
            el.textContent?.includes("Consensus Power Rankings")
          );
          return {
            cardText: (card?.textContent || "").slice(0, 120),
            cardDivs,
            statsText: (statsSection?.textContent || "").slice(0, 400),
            consensusText: (consensusSection?.textContent || "").slice(0, 400),
          };
        });
        const firstDiv = scopeCheck.cardDivs[0];
        if (firstDiv) {
          const statsMatches = !scopeCheck.statsText || scopeCheck.statsText.includes(firstDiv);
          const consMatches = !scopeCheck.consensusText || scopeCheck.consensusText.includes(firstDiv);
          reporter.record({
            suite,
            category: "home",
            name: "Home Consensus & Stats align with focused season divisions",
            status: statsMatches && consMatches ? "PASS" : "FAIL",
            details: `focusedDiv=${firstDiv}, statsMatches=${statsMatches}, consensusMatches=${consMatches}`,
            recommendation:
              !(statsMatches && consMatches)
                ? "Fix Home SSR scoping so Consensus & Stats always render the currently focused season's divisions"
                : null,
          });
        }

        // Unfocus toggle -> ?season=all (wait explicitly for URL transition)
        await Promise.all([
          page.waitForURL((u) => u.search.includes("season=all"), { timeout: 15000 }).catch(() => {}),
          focusedBtn.first().click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(250);
        const afterUnfocus = await page.locator("button", { hasText: /^Focused ✓$/ }).count();
        reporter.record({
          suite,
          category: "home",
          name: "Home clicking Focused ✓ unfocuses cleanly",
          status: afterUnfocus === 0 && page.url().includes("season=all") ? "PASS" : "FAIL",
          details: `url=${page.url()}`,
        });

        // Cycle Focus across live seasons
        const focusTotal = await page.locator("button", { hasText: /^Focus$/ }).count();
        for (let i = 0; i < Math.min(focusTotal, 3); i++) {
          await page.goto(`${cfg.baseUrl}/?season=all`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
          const targetFocusBtn = page.locator("button", { hasText: /^Focus$/ }).nth(i);
          if ((await targetFocusBtn.count()) === 0) break;
          await Promise.all([
            page
              .waitForURL((u) => u.search.includes("season=") && !u.search.includes("season=all"), {
                timeout: 15000,
              })
              .catch(() => {}),
            targetFocusBtn.click(),
          ]);
          await page.waitForLoadState("networkidle").catch(() => {});
          await page.waitForTimeout(250);
          const bodyTxt = await page.locator("body").innerText();
          const focusedNow = await page.locator("button", { hasText: /^Focused ✓$/ }).count();
          const hasEmptyZeroStandings =
            bodyTxt.includes("No match history recorded") && bodyTxt.includes("0-0");
          reporter.record({
            suite,
            category: "home",
            name: `Home season Focus switch #${i + 1} updates scope cleanly`,
            status: focusedNow === 1 && !hasEmptyZeroStandings ? "PASS" : "FAIL",
            details: `url=${page.url()}, zeroStandingsLeak=${hasEmptyZeroStandings}`,
          });
        }
      }

      // Pathway checks from focused primary season on /
      await gotoClean(page, "/", suite, "home", "Home reload for pathway parity");
      const showMoreBtn = page.locator("button", { hasText: /Show More/i }).first();
      if ((await showMoreBtn.count()) > 0 && (await showMoreBtn.isVisible().catch(() => false))) {
        await showMoreBtn.click();
        await page.waitForTimeout(200);
        reporter.record({
          suite,
          category: "home",
          name: "Home Show More expands recently published list",
          status: "PASS",
        });
      }

      const fullStatsLink = page.locator('a:has-text("Full Stats Dashboard")').first();
      if ((await fullStatsLink.count()) > 0) {
        const href = await fullStatsLink.getAttribute("href");
        await Promise.all([
          page.waitForURL((u) => u.pathname.startsWith("/stats"), { timeout: 15000 }).catch(() => {}),
          fullStatsLink.click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => {});
        reporter.record({
          suite,
          category: "pathway",
          name: "Home -> Full Stats Dashboard navigates cleanly",
          status: page.url().includes("/stats") ? "PASS" : "FAIL",
          details: `href=${href} -> ${page.url()}`,
        });
      }

      await page.goto(`${cfg.baseUrl}/`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      const viewAllCons = page.locator('a[href*="/consensus"]:has-text("View All")').first();
      if ((await viewAllCons.count()) > 0) {
        const consHref = await viewAllCons.getAttribute("href");
        await Promise.all([
          page.waitForURL((u) => u.pathname.startsWith("/consensus"), { timeout: 15000 }).catch(() => {}),
          viewAllCons.click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => {});
        reporter.record({
          suite,
          category: "pathway",
          name: "Home Consensus View All preserves division/edition scope",
          status: page.url().includes("/consensus") ? "PASS" : "FAIL",
          details: `href=${consHref} -> ${page.url()}`,
        });
      }

      // Cross-Page SPA Focus Persistence Round-Trip (catches stale Client Router Cache desync!)
      await page.goto(`${cfg.baseUrl}/`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      const altFocusBtn = page.locator("button", { hasText: /^Focus$/ }).first();
      if ((await altFocusBtn.count()) > 0) {
        const altSeasonCardText = await altFocusBtn
          .locator("xpath=ancestor::div[contains(@class,'xp-panel')][1]")
          .innerText()
          .catch(() => "");
        await Promise.all([
          page.waitForURL((u) => u.search.includes("season="), { timeout: 15000 }).catch(() => {}),
          altFocusBtn.click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(200);
        const focusedSlugParam = new URL(page.url()).searchParams.get("season") || "";
        const expectedTitleLine =
          altSeasonCardText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)[1] || focusedSlugParam;

        // 1. Click header Stats -> check focused season applied
        await Promise.all([
          page.waitForURL((u) => u.pathname === "/stats", { timeout: 15000 }).catch(() => {}),
          page.locator('header a[href="/stats"]').first().click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => {});
        const statsTriggerTxt = await page
          .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
          .first()
          .locator("button")
          .first()
          .innerText()
          .catch(() => "");
        const statsMatches = statsTriggerTxt
          .toLowerCase()
          .includes(expectedTitleLine.split("(")[0].trim().toLowerCase());

        // 2. Click header Consensus -> check focused season applied
        await Promise.all([
          page.waitForURL((u) => u.pathname === "/consensus", { timeout: 15000 }).catch(() => {}),
          page.locator('header a[href="/consensus"]').first().click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => {});
        const consTriggerTxt = await page
          .locator("div.grid.grid-cols-1.md\\:grid-cols-3 > div")
          .first()
          .locator("button")
          .first()
          .innerText()
          .catch(() => "");
        const consMatches = consTriggerTxt
          .toLowerCase()
          .includes(expectedTitleLine.split("(")[0].trim().toLowerCase());

        // 3. Click header Browse Content -> check focused season applied
        await Promise.all([
          page.waitForURL((u) => u.pathname === "/browse", { timeout: 15000 }).catch(() => {}),
          page.locator('header a[href="/browse"]').first().click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => {});
        const browseSeasonVal = await page
          .locator('select[name="season"]')
          .inputValue()
          .catch(() => "");
        const browseMatches = !focusedSlugParam || browseSeasonVal === focusedSlugParam;

        // 4. Click Rankr logo (<Link href="/">) -> verify Home STILL shows focused season!
        await Promise.all([
          page.waitForURL((u) => u.pathname === "/", { timeout: 15000 }).catch(() => {}),
          page.locator('header a[href="/"]').first().click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(200);
        const homeFocusedAfterNav = await page
          .locator("button", { hasText: /^Focused ✓$/ })
          .first()
          .locator("xpath=ancestor::div[contains(@class,'xp-panel')][1]")
          .innerText()
          .catch(() => "");
        const homePersists = homeFocusedAfterNav
          .toLowerCase()
          .includes(expectedTitleLine.split("(")[0].trim().toLowerCase());

        reporter.record({
          suite,
          category: "cache",
          name: `SPA Focus persists across Stats -> Consensus -> Browse -> Home (${focusedSlugParam})`,
          status: statsMatches && consMatches && browseMatches && homePersists ? "PASS" : "FAIL",
          details: `stats=${statsMatches}, consensus=${consMatches}, browse=${browseMatches}, homePersists=${homePersists}`,
          recommendation: !(statsMatches && consMatches && browseMatches && homePersists)
            ? "Set experimental.staleTimes.dynamic = 0 in next.config.ts so cookie-scoped pages don't serve stale Router Cache"
            : null,
        });

        // Cleanly unfocus back to auto-primary state
        await page.locator("button", { hasText: /^Focused ✓$/ }).first().click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    // 2. BROWSE: Dependent dropdowns, edition swap, submit + reload persistence
    if (hasSection(cfg, "browse") && matchesPageFilter(cfg, "browse", "/browse")) {
      await gotoClean(page, "/browse?season=", suite, "browse", "Browse All Seasons");
      const divDisabled = await page.locator('select[name="division"]').isDisabled();
      const edDisabled = await page.locator('select[name="edition"]').isDisabled();
      reporter.record({
        suite,
        category: "browse",
        name: "Browse disables Division & Edition when All Seasons active",
        status: divDisabled && edDisabled ? "PASS" : "FAIL",
        details: `divDisabled=${divDisabled}, edDisabled=${edDisabled}`,
      });

      const seasonOpts = await page
        .locator('select[name="season"] option')
        .evaluateAll((opts) =>
          opts.map((o) => ({ value: o.value, text: o.textContent?.trim() || "" })).filter((o) => o.value)
        );
      for (const opt of seasonOpts) {
        await page.selectOption('select[name="season"]', opt.value);
        await page.waitForTimeout(150);
        const divDis = await page.locator('select[name="division"]').isDisabled();
        const edDis = await page.locator('select[name="edition"]').isDisabled();
        const divTexts = await page
          .locator('select[name="division"] option')
          .evaluateAll((o) => o.map((x) => x.textContent?.trim()));
        const singleDivHasAll = divTexts.length === 2 && divTexts.includes("All Divisions");
        reporter.record({
          suite,
          category: "browse",
          name: `Browse season "${opt.text}" unlocks & scopes divisions`,
          status: !divDis && !edDis && !singleDivHasAll ? "PASS" : "FAIL",
          details: `divs=[${divTexts.join(", ")}]`,
        });
      }

      if (seasonOpts[0]) {
        await page.selectOption('select[name="season"]', seasonOpts[0].value);
        await page.selectOption('select[name="type"]', "team");
        await page.click('button[type="submit"]:has-text("Filter")');
        await page.waitForLoadState("networkidle").catch(() => {});
        const filteredUrl = page.url();
        await page.reload({ waitUntil: "networkidle" });
        const selectedTypeAfterReload = await page.locator('select[name="type"]').inputValue();
        const selectedSeasonAfterReload = await page.locator('select[name="season"]').inputValue();
        reporter.record({
          suite,
          category: "cache",
          name: "Browse Filter submission persists cleanly across hard reload",
          status:
            filteredUrl.includes("type=team") &&
            selectedTypeAfterReload === "team" &&
            selectedSeasonAfterReload === seasonOpts[0].value
              ? "PASS"
              : "FAIL",
          details: `url=${page.url()}, type=${selectedTypeAfterReload}`,
        });
      }
    }

    // 3. CONTENT DETAIL PAGES (ranking, tierlist, blog)
    if (hasSection(cfg, "content")) {
      for (const item of [
        { alias: "ranking", href: entities.rankingHref, label: "Published Ranking detail" },
        { alias: "tierlist", href: entities.tierlistHref, label: "Published Tier List detail" },
        { alias: "blog", href: entities.blogHref, label: "Published Blog detail" },
      ]) {
        if (!item.href || !matchesPageFilter(cfg, item.alias, item.href)) continue;
        await gotoClean(page, item.href, suite, "content", item.label);
        const bodyTxt = await page.locator("body").innerText();
        const badTokens =
          bodyTxt.includes("[object Object]") ||
          bodyTxt.includes("Invalid Date") ||
          bodyTxt.length < 60;
        reporter.record({
          suite,
          category: "content",
          name: `${item.label} renders clean content`,
          status: !badTokens ? "PASS" : "FAIL",
          details: `len=${bodyTxt.length}`,
        });
      }
    }

    // 4. CONSENSUS: Season/Division/Edition switches, toggle, copy, contributor link
    if (hasSection(cfg, "consensus") && matchesPageFilter(cfg, "consensus", "/consensus")) {
      await gotoClean(page, "/consensus", suite, "consensus", "Consensus initial load");
      const selTriggers = page.locator("div.grid.grid-cols-1.md\\:grid-cols-3 button");
      const trigCount = await selTriggers.count();
      reporter.record({
        suite,
        category: "consensus",
        name: "Consensus renders Season/Division/Edition controls",
        status: trigCount >= 3 ? "PASS" : "WARN",
        details: `controls=${trigCount}`,
      });

      const toggleChangeBtn = page.locator("button", { hasText: /Show Change|Hide Change/i }).first();
      if ((await toggleChangeBtn.count()) > 0) {
        const before = await toggleChangeBtn.innerText();
        await toggleChangeBtn.click();
        await page.waitForTimeout(150);
        const after = await toggleChangeBtn.innerText();
        reporter.record({
          suite,
          category: "consensus",
          name: "Consensus toggles Show/Hide Change",
          status: before !== after ? "PASS" : "FAIL",
          details: `${before} -> ${after}`,
        });
      }

      const copyBtn = page.locator('button:has-text("Copy Link")').first();
      if ((await copyBtn.count()) > 0) {
        await copyBtn.click();
        await page.waitForTimeout(150);
        const copied = (await page.locator('button:has-text("Copied!")').count()) > 0;
        reporter.record({
          suite,
          category: "consensus",
          name: "Consensus Copy Link feedback",
          status: copied ? "PASS" : "WARN",
        });
      }

      // Cycle Consensus Season dropdowns & verify content/URL reacts cleanly
      if (trigCount >= 2) {
        const seasonBtn = page.locator("div.grid.grid-cols-1.md\\:grid-cols-3 > div").first().locator("button").first();
        await seasonBtn.click().catch(() => {});
        await page.waitForTimeout(150);
        const cSeasons = page.locator("div.grid.grid-cols-1.md\\:grid-cols-3 > div").first().locator("div.absolute button");
        const cCount = await cSeasons.count();
        await seasonBtn.click().catch(() => {});
        for (let i = 0; i < Math.min(cCount, 3); i++) {
          await seasonBtn.click();
          await page.waitForTimeout(120);
          const opt = page.locator("div.grid.grid-cols-1.md\\:grid-cols-3 > div").first().locator("div.absolute button").nth(i);
          const optLabel = (await opt.innerText()).replace(/\s+/g, " ").trim();
          const alreadySelected = await opt.evaluate((el) => el.className.includes("f0c020"));
          const prevUrl = page.url();
          await opt.click();
          if (!alreadySelected) {
            await page.waitForURL((u) => u.toString() !== prevUrl, { timeout: 15000 }).catch(() => {});
          }
          await page.waitForLoadState("networkidle").catch(() => {});
          await page.waitForTimeout(300);

          const divWrap = page.locator("div.grid.grid-cols-1.md\\:grid-cols-3 > div").nth(1);
          const divTrig = divWrap.locator("button").first();
          await divTrig.click();
          await page.waitForTimeout(120);
          const divMenu = await divWrap
            .locator("div.absolute button")
            .evaluateAll((bs) => bs.map((b) => b.textContent?.replace(/\s+/g, " ").trim() || ""));
          await divTrig.click().catch(() => {});
          const badSingleAll = divMenu.length === 1 && divMenu[0].startsWith("All Divisions");
          reporter.record({
            suite,
            category: "consensus",
            name: `Consensus season "${optLabel}" Division scope consistency`,
            status: !badSingleAll ? "PASS" : "FAIL",
            details: `divs=[${divMenu.join(" | ")}], url=${page.url()}`,
          });
        }
      }

      // Click first contributor link in voting panel if present
      const firstContrib = page.locator('a[href^="/rankings/"]').first();
      if ((await firstContrib.count()) > 0) {
        const href = await firstContrib.getAttribute("href");
        await Promise.all([
          page.waitForURL((u) => u.pathname.startsWith("/rankings/"), { timeout: 15000 }).catch(() => {}),
          firstContrib.click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => {});
        reporter.record({
          suite,
          category: "pathway",
          name: "Consensus contributor panel links to full ballot",
          status: page.url().includes("/rankings/") ? "PASS" : "FAIL",
          details: `href=${href} -> ${page.url()}`,
        });
      }
    }

    // 5. STATS DASHBOARD: All seasons x all divisions x all tabs x filters/sorts/stages x reload
    if (hasSection(cfg, "stats") && matchesPageFilter(cfg, "stats", "/stats")) {
      await gotoClean(page, "/stats", suite, "stats", "Stats initial load");
      const seasonTrigger = page
        .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
        .first()
        .locator("button")
        .first();

      let seasonCount = 0;
      if ((await seasonTrigger.count()) > 0) {
        await seasonTrigger.click();
        await page.waitForTimeout(150);
        seasonCount = await page
          .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
          .first()
          .locator("div.absolute button")
          .count();
        await seasonTrigger.click();
      }
      reporter.record({
        suite,
        category: "stats",
        name: "Stats Season dropdown enumerates seasons",
        status: seasonCount >= 1 ? "PASS" : "FAIL",
        details: `seasons=${seasonCount}`,
      });

      for (let sIdx = 0; sIdx < seasonCount; sIdx++) {
        await seasonTrigger.click();
        await page.waitForTimeout(120);
        const sBtn = page
          .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
          .first()
          .locator("div.absolute button")
          .nth(sIdx);
        const sLabel = (await sBtn.innerText()).replace(/\s+/g, " ").trim();
        const alreadySelected = await sBtn.evaluate((el) => el.className.includes("f0c020"));
        const prevUrl = page.url();
        await sBtn.click();
        if (!alreadySelected) {
          await page.waitForURL((u) => u.toString() !== prevUrl, { timeout: 15000 }).catch(() => {});
        }
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(350);

        const divTrigger = page
          .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
          .nth(1)
          .locator("button")
          .first();
        await divTrigger.click();
        await page.waitForTimeout(120);
        const divTexts = await page
          .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
          .nth(1)
          .locator("div.absolute button")
          .evaluateAll((bs) => bs.map((b) => b.textContent?.replace(/\s+/g, " ").trim() || ""));
        await divTrigger.click();

        const hasAllDiv = divTexts.some((t) => /^All Divisions/i.test(t));
        const divClean = divTexts.length > 1 || (divTexts.length === 1 && !hasAllDiv);
        reporter.record({
          suite,
          category: "stats",
          name: `Stats "${sLabel}" Division menu hides All Divisions when single-division`,
          status: divClean ? "PASS" : "FAIL",
          details: `options=[${divTexts.join(" | ")}]`,
        });

        // Exercise each division option
        for (let dIdx = 0; dIdx < Math.min(divTexts.length, 4); dIdx++) {
          await divTrigger.click();
          await page.waitForTimeout(120);
          const dBtn = page
            .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
            .nth(1)
            .locator("div.absolute button")
            .nth(dIdx);
          const dLabel = (await dBtn.innerText()).replace(/\s+/g, " ").trim();
          const isAllDiv = /^All Divisions/i.test(dLabel);
          await dBtn.click();
          await page.waitForLoadState("networkidle").catch(() => {});
          await page.waitForTimeout(350);

          // PLAYERS TAB
          const playersTabBtn = page.locator("button", { hasText: /^\s*PLAYERS\s*$/i }).first();
          if ((await playersTabBtn.count()) > 0) {
            await playersTabBtn.click();
            await page.waitForTimeout(200);
            const pText = await page.locator("body").innerText();
            if (isAllDiv) {
              reporter.record({
                suite,
                category: "stats",
                name: `Stats "${sLabel}" / All Divisions Players prompt`,
                status: pText.includes("to view player stat leaderboards and tables.") ? "PASS" : "FAIL",
              });
            } else {
              const tableRows = await page.locator("table tbody tr").count();
              if (tableRows > 0) {
                // Verify no 0-game placeholder table when 0 matches exist
                const firstGamesCell = await page
                  .locator("table tbody tr")
                  .first()
                  .locator("td")
                  .nth(2)
                  .innerText()
                  .catch(() => "");
                reporter.record({
                  suite,
                  category: "stats",
                  name: `Stats "${sLabel}" / "${dLabel}" Players table populated`,
                  status: firstGamesCell !== "0" ? "PASS" : "FAIL",
                  details: `rows=${tableRows}, firstRowGames=${firstGamesCell}`,
                });

                // Role filter test
                const topRoleBtn = page.locator("button", { hasText: /^\s*Top\s*$/ }).first();
                const allRoleBtn = page.locator("button", { hasText: /^\s*All Roles\s*$/ }).first();
                if ((await topRoleBtn.count()) > 0 && (await allRoleBtn.count()) > 0) {
                  await topRoleBtn.click();
                  await page.waitForTimeout(120);
                  const topRows = await page.locator("table tbody tr").count();
                  await allRoleBtn.click();
                  await page.waitForTimeout(120);
                  const restoredRows = await page.locator("table tbody tr").count();
                  reporter.record({
                    suite,
                    category: "stats",
                    name: `Stats "${dLabel}" Role filter Top -> All Roles restores`,
                    status: topRows <= tableRows && restoredRows === tableRows ? "PASS" : "FAIL",
                    details: `all=${tableRows}, top=${topRows}, restored=${restoredRows}`,
                  });
                }
              } else {
                const emptyMsgOk = /No player/i.test(pText);
                reporter.record({
                  suite,
                  category: "stats",
                  name: `Stats "${sLabel}" / "${dLabel}" zero-stat Players empty state`,
                  status: emptyMsgOk ? "PASS" : "WARN",
                });
              }
            }
          }

          // TEAMS TAB
          const teamsTabBtn = page.locator("button", { hasText: /^\s*TEAMS\s*$/i }).first();
          if ((await teamsTabBtn.count()) > 0) {
            await teamsTabBtn.click();
            await page.waitForTimeout(200);
            const tText = await page.locator("body").innerText();
            if (isAllDiv) {
              reporter.record({
                suite,
                category: "stats",
                name: `Stats "${sLabel}" / All Divisions Teams prompt`,
                status: tText.includes("to view team standings and playoff brackets.") ? "PASS" : "FAIL",
              });
            } else {
              const hasStandingHeading = tText.includes("TEAM STANDINGS");
              const hasEmptyMsg = tText.includes("No match history recorded");
              reporter.record({
                suite,
                category: "stats",
                name: `Stats "${sLabel}" / "${dLabel}" Teams standings or empty state`,
                status: hasStandingHeading || hasEmptyMsg ? "PASS" : "WARN",
                details: hasStandingHeading ? "standings rendered" : "empty-state message rendered",
              });
            }
          }

          // GENERAL TAB
          const generalTabBtn = page.locator("button", { hasText: /^\s*GENERAL\s*$/i }).first();
          if ((await generalTabBtn.count()) > 0) {
            await generalTabBtn.click();
            await page.waitForTimeout(200);
            const gText = await page.locator("body").innerText();
            reporter.record({
              suite,
              category: "stats",
              name: `Stats "${sLabel}" / "${dLabel}" General tab clean copy`,
              status: !gText.includes("Sheet mode only") ? "PASS" : "FAIL",
            });
          }
        }
      }

      // Reload persistence check on non-default tab
      await page.goto(`${cfg.baseUrl}/stats?tab=teams`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      await page.reload({ waitUntil: "networkidle" });
      const stillOnTeams = page.url().includes("tab=teams");
      reporter.record({
        suite,
        category: "cache",
        name: "Stats preserves ?tab=teams across hard reload",
        status: stillOnTeams ? "PASS" : "FAIL",
        details: `url=${page.url()}`,
      });
    }

    // 6. DRILLDOWNS: Player -> Team -> Champion -> Match (+ Game 1/2/3 tabs & back link)
    if (hasSection(cfg, "drilldowns")) {
      if (entities.playerHref && matchesPageFilter(cfg, "stats-player", entities.playerHref)) {
        await gotoClean(page, entities.playerHref, suite, "drilldown", "Player scouting detail");
      }
      if (entities.teamHref && matchesPageFilter(cfg, "stats-team", entities.teamHref)) {
        await gotoClean(page, entities.teamHref, suite, "drilldown", "Team scouting detail");
      }
      if (entities.championHref && matchesPageFilter(cfg, "stats-champion", entities.championHref)) {
        await gotoClean(page, entities.championHref, suite, "drilldown", "Champion detail");
      }
      if (entities.matchHref && matchesPageFilter(cfg, "stats-match", entities.matchHref)) {
        await gotoClean(page, entities.matchHref, suite, "drilldown", "Match box score detail");
        const g2Btn = page.locator("button", { hasText: /Game 2/i }).first();
        if ((await g2Btn.count()) > 0) {
          const beforeGameTxt = await page.locator("body").innerText();
          await g2Btn.click();
          await page.waitForTimeout(200);
          const afterGameTxt = await page.locator("body").innerText();
          reporter.record({
            suite,
            category: "drilldown",
            name: "Match detail Game 2 tab updates box score",
            status: beforeGameTxt !== afterGameTxt ? "PASS" : "WARN",
          });
        }
      }
    }

    // 7. TEAM HUB: Season & Viewing Team switches, code hiding when signed out
    if (hasSection(cfg, "team-hub") && matchesPageFilter(cfg, "team-hub", "/team-hub")) {
      await gotoClean(page, "/team-hub", suite, "team-hub", "Team Hub load");
      const hubBody = await page.locator("body").innerText();
      const leaksCodes =
        hubBody.includes("Tournament Lobby Codes") || hubBody.includes("Gen G1 Code");
      reporter.record({
        suite,
        category: "rbac",
        name: "Signed-out Team Hub hides Tournament Lobby Codes",
        status: !leaksCodes ? "PASS" : "FAIL",
        recommendation: leaksCodes ? "Hide Tournament Lobby Codes for non-captain/guest viewers" : null,
      });

      const selects = page.locator("select");
      if ((await selects.count()) > 0) {
        const teamSel = selects.last();
        const opts = await teamSel.locator("option").evaluateAll((os) => os.map((o) => o.value));
        if (opts.length > 1) {
          await teamSel.selectOption(opts[1]);
          await page.waitForTimeout(200);
          reporter.record({
            suite,
            category: "team-hub",
            name: "Team Hub switches Viewing Team cleanly",
            status: "PASS",
          });
        }
      }
    }

    // 8. REDIRECTS, LEGAL & SIGNED-OUT GATES
    if (hasSection(cfg, "redirects")) {
      const redirectTests = [
        { from: "/matches", expectUrlPart: "/team-hub", label: "Legacy /matches -> /team-hub" },
        { from: "/rank?type=blog", expectUrlPart: "/create", label: "Legacy /rank -> /create" },
        { from: "/blog", expectUrlPart: "/browse", label: "Legacy /blog -> /browse" },
        { from: "/my-rankings", expectUrlPart: "/my-history", label: "Legacy /my-rankings -> /my-history" },
        ...(entities.ballotId
          ? [
              {
                from: `/ballot/${entities.ballotId}`,
                expectRegex: /\/(?:rankings|tierlist)\//,
                label: "Legacy /ballot/[id] redirect",
              },
            ]
          : []),
      ];

      for (const rt of redirectTests) {
        await gotoClean(page, rt.from, suite, "redirect", rt.label);
        const cur = page.url();
        const ok = rt.expectRegex ? rt.expectRegex.test(cur) : cur.includes(rt.expectUrlPart);
        reporter.record({
          suite,
          category: "redirect",
          name: rt.label,
          status: ok ? "PASS" : "FAIL",
          details: `url=${cur}`,
        });
      }

      for (const staticPath of ["/terms", "/privacy"]) {
        await gotoClean(page, staticPath, suite, "legal", `Legal page ${staticPath}`);
      }

      for (const adminPath of ["/admin", "/admin/stats", "/admin/users", "/admin/publishings"]) {
        await gotoClean(page, adminPath, suite, "rbac", `Signed-out gate ${adminPath}`);
        const txt = await page.locator("body").innerText();
        const blocked = txt.includes("Access Denied") || txt.includes("do not have permission");
        const leaks = txt.includes("Operator or Admin") || txt.includes("Admin Console →");
        reporter.record({
          suite,
          category: "rbac",
          name: `Signed-out gate ${adminPath} denies without internal leaks`,
          status: blocked && !leaks ? "PASS" : "FAIL",
          details: `blocked=${blocked}, leaks=${leaks}`,
        });
      }

      for (const authPath of ["/create", "/my-history"]) {
        await gotoClean(page, authPath, suite, "rbac", `Signed-out gate ${authPath}`);
        const txt = await page.locator("body").innerText();
        reporter.record({
          suite,
          category: "rbac",
          name: `${authPath} prompts guest to Sign In`,
          status: /sign in/i.test(txt) ? "PASS" : "FAIL",
        });
      }
    }

    // 9. SIGNED-OUT API BOUNDARY CHECKS
    if (hasSection(cfg, "api")) {
      for (const getEp of ["/api/recent-content", "/api/champions", "/api/og/consensus"]) {
        const res = await context.request.get(`${cfg.baseUrl}${getEp}`, { timeout: 20000 });
        reporter.record({
          suite,
          category: "api",
          name: `Public GET ${getEp}`,
          status: res.status() === 200 ? "PASS" : "FAIL",
          details: `status=${res.status()}`,
        });
      }

      const nilUuid = "00000000-0000-0000-0000-000000000000";
      const protectedPostEndpoints = [
        { path: "/api/admin/view-as", body: { mode: "public" } },
        { path: "/api/admin/moderation/action", body: { eventId: nilUuid, action: "unpublish" } },
        { path: "/api/admin/import-drafts", body: {} },
        { path: "/api/admin/import-matches", body: {} },
        { path: "/api/admin/revalidate-stats", body: {} },
        { path: "/api/admin/riot-sync", body: {} },
        { path: "/api/admin/scdl-sheet-stats", body: {} },
        { path: "/api/admin/stats-notice", body: { notice: "probe" } },
        { path: "/api/matches/tournament-code", body: { matchId: nilUuid, gameNumber: 1 } },
        { path: "/api/publish", body: {} },
        { path: "/api/notify-publish", body: {} },
      ];

      for (const ep of protectedPostEndpoints) {
        const res = await context.request.post(`${cfg.baseUrl}${ep.path}`, { data: ep.body });
        const status = res.status();
        reporter.record({
          suite,
          category: "api-rbac",
          name: `Signed-out POST ${ep.path} rejected`,
          status: status === 401 || status === 403 ? "PASS" : "FAIL",
          details: `status=${status}`,
          recommendation:
            status !== 401 && status !== 403
              ? `Enforce auth check (401/403) on ${ep.path} (returned ${status})`
              : null,
        });
      }
    }
  } finally {
    await context.close();
  }
}

async function runAuthenticatedSuite(browser, storageStatePath) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    storageState: storageStatePath,
  });
  const page = await context.newPage();

  try {
    await setViewAs(context, cfg.baseUrl, { mode: "clear" });
    await gotoClean(page, "/admin", "Admin", "admin", "Site Admin Console load");
    const adminBody = await page.locator("body").innerText();
    if (!adminBody.includes("Seasons") || adminBody.includes("Access Denied")) {
      reporter.record({
        suite: "MultiRoleAuth",
        category: "auth",
        name: "Verify saved session is Site Admin",
        status: "FAIL",
        details: "Saved session expired or lacks Site Admin role — re-run with --login",
      });
      return;
    }
    reporter.record({
      suite: "MultiRoleAuth",
      category: "auth",
      name: "Verify saved session is Site Admin",
      status: "PASS",
    });

    const { leagueTarget, teamTarget } = await discoverRoleTargets(page);

    // SITE ADMIN ROLE
    if (hasRole(cfg, "admin")) {
      const suite = "Role:Admin";
      await assertNavbarInvariant(page, suite, "admin");

      const hasPreviewBar = adminBody.includes("Preview As Role");
      const hasMatchHubInsideAdmin = (await page.locator('a[href="/matches"], a[href="/team-hub"]').count()) > 0;
      reporter.record({
        suite,
        category: "invariant",
        name: "Site Admin Console includes Preview As Role & Match Hub link",
        status: hasPreviewBar && hasMatchHubInsideAdmin ? "PASS" : "WARN",
        details: `previewBar=${hasPreviewBar}, matchHubLink=${hasMatchHubInsideAdmin}`,
      });

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
        if ((await btn.count()) > 0) {
          await btn.click();
          await page.waitForTimeout(200);
          reporter.record({
            suite,
            category: "admin",
            name: `Admin tab "${tabLabel}" switches cleanly`,
            status: "PASS",
          });
        } else {
          reporter.record({
            suite,
            category: "admin",
            name: `Admin tab "${tabLabel}" present`,
            status: "FAIL",
          });
        }
      }

      // Nested season switcher test on Teams tab (target xp-panel Season select, not Preview As Role)
      await page.locator("button", { hasText: /^Teams$/ }).first().click().catch(() => {});
      await page.waitForTimeout(200);
      const seasonSel = page.locator("div.xp-panel").filter({ hasText: "Season" }).locator("select").first();
      const sOpts = await seasonSel.locator("option").evaluateAll((os) => os.map((o) => o.value)).catch(() => []);
      if (sOpts.length > 1) {
        const beforeTxt = await page.locator("main").innerText();
        await seasonSel.selectOption(sOpts[1]);
        await page.waitForTimeout(250);
        const afterTxt = await page.locator("main").innerText();
        reporter.record({
          suite,
          category: "admin",
          name: "Admin Teams Season switcher refreshes nested divisions",
          status: beforeTxt !== afterTxt ? "PASS" : "FAIL",
        });
      }

      await gotoClean(page, "/admin/stats", suite, "admin", "Admin Stats Controls");
      await gotoClean(page, "/admin/users", suite, "admin", "Admin Discord Users Log");
      await gotoClean(page, "/admin/publishings", suite, "admin", "Admin Publishings Log");

      // Create workspace read-only interactive sweep
      await gotoClean(page, "/create", suite, "create", "Create Workspace load");
      for (const m of [
        { key: "team", re: /Team Power Rankings/i },
        { key: "player", re: /Player Tier List/i },
        { key: "blog", re: /Blog Post/i },
        { key: "champion_pool", re: /Champion Pool/i },
      ]) {
        const btn = page.locator("button", { hasText: m.re }).first();
        if ((await btn.count()) > 0) {
          await btn.click();
          await page.waitForTimeout(250);
          const urlOk =
            m.key === "team" ? !page.url().includes("type=blog") : page.url().includes(`type=${m.key}`);
          reporter.record({
            suite,
            category: "create",
            name: `Create mode "${m.key}" switches & syncs URL cleanly`,
            status: urlOk ? "PASS" : "WARN",
            details: `url=${page.url()}`,
          });
        }
      }

      await gotoClean(page, "/my-history", suite, "history", "Admin My History");
      await gotoClean(page, "/team-hub", suite, "team-hub", "Admin Team Hub");
    }

    // LEAGUE OPERATOR ROLE
    if (hasRole(cfg, "operator")) {
      const suite = "Role:Operator";
      if (!leagueTarget) {
        reporter.record({
          suite,
          category: "rbac",
          name: "Operator preview target discovered",
          status: "WARN",
          details: "No league found in Preview As Role bar",
        });
      } else {
        const res = await setViewAs(context, cfg.baseUrl, {
          mode: "operator",
          leagueId: leagueTarget.id,
          label: leagueTarget.label,
        });
        reporter.record({
          suite,
          category: "rbac",
          name: `View-As Operator (${leagueTarget.label})`,
          status: res.ok ? "PASS" : "FAIL",
          details: `status=${res.status}`,
        });

        await gotoClean(page, "/admin", suite, "admin", "Operator /admin load");
        await assertNavbarInvariant(page, suite, "operator");
        const opTxt = await page.locator("body").innerText();
        reporter.record({
          suite,
          category: "rbac",
          name: "Operator sees Preview Mode banner & hides Preview As Role",
          status:
            opTxt.toLowerCase().includes("preview mode") &&
            !opTxt.includes("Preview As Role") &&
            !opTxt.includes("Access Denied")
              ? "PASS"
              : "FAIL",
        });

        const safetyBtn = page.locator("button", { hasText: /^League Access & Safety$/ }).first();
        if ((await safetyBtn.count()) > 0) {
          await safetyBtn.click();
          await page.waitForTimeout(250);
          const modLower = (await page.locator("body").innerText()).toLowerCase();
          reporter.record({
            suite,
            category: "rbac",
            name: "Operator sees Moderation Alerts Log without Global Kill Switch",
            status:
              modLower.includes("moderation alerts log") && !modLower.includes("global kill switch")
                ? "PASS"
                : "FAIL",
          });
        } else {
          reporter.record({
            suite,
            category: "rbac",
            name: "Operator League Access & Safety tab present",
            status: "FAIL",
          });
        }

        for (const siteAdminOnly of ["/admin/users", "/admin/publishings"]) {
          await gotoClean(page, siteAdminOnly, suite, "rbac", `Operator blocked from ${siteAdminOnly}`);
          const txt = await page.locator("body").innerText();
          reporter.record({
            suite,
            category: "rbac",
            name: `Operator sees Access Denied on ${siteAdminOnly}`,
            status: txt.includes("Access Denied") ? "PASS" : "FAIL",
          });
        }

        await gotoClean(page, "/admin/stats", suite, "admin", "Operator /admin/stats");
        await gotoClean(page, "/team-hub", suite, "team-hub", "Operator /team-hub");
      }
    }

    // TEAM CAPTAIN ROLE
    if (hasRole(cfg, "captain")) {
      const suite = "Role:Captain";
      if (!teamTarget) {
        reporter.record({
          suite,
          category: "rbac",
          name: "Captain preview target discovered",
          status: "WARN",
          details: "No team found in Preview As Role bar",
        });
      } else {
        const res = await setViewAs(context, cfg.baseUrl, {
          mode: "captain",
          teamId: teamTarget.id,
          label: teamTarget.label,
        });
        reporter.record({
          suite,
          category: "rbac",
          name: `View-As Captain (${teamTarget.label})`,
          status: res.ok ? "PASS" : "FAIL",
          details: `status=${res.status}`,
        });

        for (const restricted of ["/admin", "/admin/stats", "/admin/users", "/admin/publishings"]) {
          await gotoClean(page, restricted, suite, "rbac", `Captain blocked from ${restricted}`);
          const txt = await page.locator("body").innerText();
          reporter.record({
            suite,
            category: "rbac",
            name: `Captain sees Access Denied on ${restricted}`,
            status: txt.includes("Access Denied") ? "PASS" : "FAIL",
          });
        }

        await gotoClean(page, "/team-hub", suite, "team-hub", "Captain /team-hub");
        await assertNavbarInvariant(page, suite, "captain");
        const capHubTxt = await page.locator("body").innerText();
        reporter.record({
          suite,
          category: "rbac",
          name: "Captain sees Preview Mode banner on /team-hub",
          status: capHubTxt.toLowerCase().includes("preview mode") ? "PASS" : "FAIL",
        });

        // Switch Viewing Team to a different team and verify captain doesn't see code generator for unrelated team
        const teamSel = page.locator("select").last();
        const opts = await teamSel.locator("option").evaluateAll((os) => os.map((o) => o.value)).catch(() => []);
        const otherTeam = opts.find((v) => v && v !== teamTarget.id);
        if (otherTeam) {
          await teamSel.selectOption(otherTeam);
          await page.waitForTimeout(200);
          const otherTxt = await page.locator("body").innerText();
          reporter.record({
            suite,
            category: "rbac",
            name: "Captain hides Tournament Lobby Codes on non-owned team",
            status: !otherTxt.includes("Tournament Lobby Codes") ? "PASS" : "FAIL",
          });
        }

        // Safe non-mutating nil-UUID API checks as Captain
        const nilUuid = "00000000-0000-0000-0000-000000000000";
        const modRes = await context.request.post(`${cfg.baseUrl}/api/admin/moderation/action`, {
          data: { eventId: nilUuid, action: "unpublish" },
        });
        reporter.record({
          suite,
          category: "api-rbac",
          name: "Captain POST /api/admin/moderation/action rejected (403)",
          status: modRes.status() === 403 ? "PASS" : "FAIL",
          details: `status=${modRes.status()}`,
        });

        const codeRes = await context.request.post(`${cfg.baseUrl}/api/matches/tournament-code`, {
          data: { matchId: nilUuid, gameNumber: 1 },
        });
        reporter.record({
          suite,
          category: "api-rbac",
          name: "Captain POST /api/matches/tournament-code nil-UUID rejected (403/404)",
          status: codeRes.status() === 403 || codeRes.status() === 404 ? "PASS" : "FAIL",
          details: `status=${codeRes.status()}`,
        });

        await gotoClean(page, "/create", suite, "create", "Captain /create");
        await gotoClean(page, "/my-history", suite, "history", "Captain /my-history");
      }
    }

    // REGULAR USER ROLE
    if (hasRole(cfg, "public")) {
      const suite = "Role:RegularUser";
      const pubRes = await setViewAs(context, cfg.baseUrl, { mode: "public", label: "Regular User" });
      reporter.record({
        suite,
        category: "rbac",
        name: "View-As Regular User switches cleanly",
        status: pubRes.ok ? "PASS" : "FAIL",
        details: `status=${pubRes.status}`,
      });

      for (const restricted of ["/admin", "/admin/stats", "/admin/users", "/admin/publishings"]) {
        await gotoClean(page, restricted, suite, "rbac", `Regular User blocked from ${restricted}`);
        const txt = await page.locator("body").innerText();
        reporter.record({
          suite,
          category: "rbac",
          name: `Regular User sees Access Denied on ${restricted}`,
          status: txt.includes("Access Denied") ? "PASS" : "FAIL",
        });
      }

      await gotoClean(page, "/team-hub", suite, "team-hub", "Regular User /team-hub");
      await assertNavbarInvariant(page, suite, "public");
      const pubHubTxt = await page.locator("body").innerText();
      reporter.record({
        suite,
        category: "rbac",
        name: "Regular User cannot see Tournament Lobby Codes on Team Hub",
        status: !pubHubTxt.includes("Tournament Lobby Codes") ? "PASS" : "FAIL",
      });

      await gotoClean(page, "/create", suite, "create", "Regular User /create");
      await gotoClean(page, "/my-history", suite, "history", "Regular User /my-history");

      const nilUuid = "00000000-0000-0000-0000-000000000000";
      const modRes = await context.request.post(`${cfg.baseUrl}/api/admin/moderation/action`, {
        data: { eventId: nilUuid, action: "unpublish" },
      });
      reporter.record({
        suite,
        category: "api-rbac",
        name: "Regular User POST /api/admin/moderation/action rejected (403)",
        status: modRes.status() === 403 ? "PASS" : "FAIL",
        details: `status=${modRes.status()}`,
      });
      const tcRes = await context.request.post(`${cfg.baseUrl}/api/matches/tournament-code`, {
        data: { matchId: nilUuid, gameNumber: 1 },
      });
      reporter.record({
        suite,
        category: "api-rbac",
        name: "Regular User POST /api/matches/tournament-code rejected (403/404)",
        status:
          tcRes.status() === 403
            ? "PASS"
            : tcRes.status() === 404
            ? "WARN"
            : "FAIL",
        details: `status=${tcRes.status()}`,
        recommendation:
          tcRes.status() === 404
            ? "Check captain/admin authorization before match lookup in /api/matches/tournament-code (currently returns 404 before 403 on nonexistent matchId)"
            : null,
      });
    }
  } finally {
    await setViewAs(context, cfg.baseUrl, { mode: "clear" }).catch(() => {});
    await context.close();
  }
}

async function main() {
  const savedAuth = cfg.noAuth
    ? null
    : await ensureAuthStorageState(cfg.baseUrl, cfg.authFile, cfg.loginMode);

  const browser = await launchAuditBrowser(true);
  try {
    const entities = await discoverSiteEntities(browser, cfg.baseUrl);
    if (hasRole(cfg, "signed-out")) {
      await runSignedOutSuite(browser, entities);
    }
    if (
      savedAuth &&
      hasSection(cfg, "multi-role") &&
      ["admin", "operator", "captain", "public"].some((r) => hasRole(cfg, r))
    ) {
      await runAuthenticatedSuite(browser, savedAuth);
    } else if (!savedAuth && !cfg.noAuth) {
      console.log(
        `\n[INFO] Skipped multi-role auth suite (no ${cfg.authFile}). Pass --login once to record an admin session.`
      );
    }
    const out = reporter.finalize({ entities });
    if (out.failCount > 0) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
