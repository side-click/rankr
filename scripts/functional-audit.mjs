import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const argVal = (prefix) => {
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
};

const baseUrl = (
  args.includes("--prod")
    ? "https://leaguerankr.com"
    : argVal("--base=") || "http://localhost:3000"
).replace(/\/$/, "");

const loginMode = args.includes("--login");
const authFileArg = argVal("--auth-file=");
const savedAuthPath = path.resolve(authFileArg || "temp/audit-auth.json");
const outDir = path.resolve("temp/functional-audit");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

async function launchBrowser(headless = true) {
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launch({ channel, headless });
    } catch {}
  }
  return chromium.launch({ headless });
}

const results = [];
function record(suite, name, status, details = "") {
  results.push({ suite, name, status, details });
  const tag =
    status === "PASS" ? "[PASS]" : status === "WARN" ? "[WARN]" : "[FAIL]";
  console.log(`${tag} ${suite} > ${name}${details ? ` — ${details}` : ""}`);
}

async function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const server5xx = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  const onPageErr = (err) => pageErrors.push(String(err));
  const onResponse = (res) => {
    if (res.status() >= 500) {
      server5xx.push(`${res.status()} ${res.url()}`);
    }
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageErr);
  page.on("response", onResponse);
  return () => {
    page.off("console", onConsole);
    page.off("pageerror", onPageErr);
    page.off("response", onResponse);
    return { consoleErrors, pageErrors, server5xx };
  };
}

async function gotoClean(page, pathname, suite, label) {
  const collect = await attachErrorCollectors(page);
  const url = `${baseUrl}${pathname}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(350);
  const errs = collect();
  if (errs.server5xx.length > 0 || errs.pageErrors.length > 0) {
    record(
      suite,
      `${label} (${pathname})`,
      "FAIL",
      `5xx=${errs.server5xx.join("; ")} pageErr=${errs.pageErrors.join("; ")}`
    );
  } else if (errs.consoleErrors.length > 0) {
    record(
      suite,
      `${label} (${pathname})`,
      "WARN",
      `consoleErrors=${errs.consoleErrors.slice(0, 2).join(" | ")}`
    );
  } else {
    record(suite, `${label} (${pathname})`, "PASS");
  }
  return errs;
}

async function runSignedOutSuite(browser) {
  const suite = "SignedOut";
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

  try {
    // 1. Home page auto-focus + focus toggle + unfocus toggle
    await gotoClean(page, "/", suite, "Home initial load");
    const focusedBtn = page.locator("button", { hasText: /^Focused ✓$/ });
    const focusedCount = await focusedBtn.count();
    if (focusedCount === 1) {
      record(suite, "Home auto-focuses primary active season", "PASS");
      await focusedBtn.first().click();
      await page.waitForTimeout(700);
      await page.waitForLoadState("networkidle").catch(() => {});
      const afterUnfocusFocused = await page
        .locator("button", { hasText: /^Focused ✓$/ })
        .count();
      if (afterUnfocusFocused === 0) {
        record(
          suite,
          "Home clicking Focused ✓ unfocuses cleanly",
          "PASS",
          `url=${page.url()}`
        );
      } else {
        record(
          suite,
          "Home clicking Focused ✓ unfocuses cleanly",
          "FAIL",
          `Still focused; url=${page.url()}`
        );
      }

      // Click Focus on first live season button
      const focusButtons = page.locator("button", { hasText: /^Focus$/ });
      const totalFocus = await focusButtons.count();
      if (totalFocus > 0) {
        await focusButtons.first().click();
        await page.waitForTimeout(700);
        await page.waitForLoadState("networkidle").catch(() => {});
        const nowFocused = await page
          .locator("button", { hasText: /^Focused ✓$/ })
          .count();
        record(
          suite,
          "Home clicking Focus activates season focus",
          nowFocused === 1 ? "PASS" : "FAIL",
          `url=${page.url()}`
        );
        // Unfocus again so state stays clean
        if (nowFocused === 1) {
          await page.locator("button", { hasText: /^Focused ✓$/ }).first().click();
          await page.waitForTimeout(500);
        }
      }
    } else {
      record(
        suite,
        "Home auto-focuses primary active season",
        "WARN",
        `Focused ✓ count=${focusedCount}`
      );
    }

    // 2. Browse Content dependent dropdowns
    await gotoClean(page, "/browse?season=", suite, "Browse All Seasons");
    const browseDivDisabled = await page
      .locator('select[name="division"]')
      .isDisabled();
    const browseEdDisabled = await page
      .locator('select[name="edition"]')
      .isDisabled();
    record(
      suite,
      "Browse disables Division & Edition when All Seasons selected",
      browseDivDisabled && browseEdDisabled ? "PASS" : "FAIL",
      `divDisabled=${browseDivDisabled}, edDisabled=${browseEdDisabled}`
    );

    const browseSeasonOpts = await page
      .locator('select[name="season"] option')
      .evaluateAll((opts) =>
        opts
          .map((o) => ({ value: o.value, text: o.textContent?.trim() || "" }))
          .filter((o) => o.value)
      );
    for (const opt of browseSeasonOpts.slice(0, 3)) {
      await page.selectOption('select[name="season"]', opt.value);
      await page.waitForTimeout(150);
      const divDisabledAfter = await page
        .locator('select[name="division"]')
        .isDisabled();
      const edDisabledAfter = await page
        .locator('select[name="edition"]')
        .isDisabled();
      const divTexts = await page
        .locator('select[name="division"] option')
        .evaluateAll((o) => o.map((x) => x.textContent?.trim()));
      const singleDivHasAll =
        divTexts.length === 2 && divTexts.includes("All Divisions");
      record(
        suite,
        `Browse season "${opt.text}" unlocks & scopes dropdowns`,
        !divDisabledAfter && !edDisabledAfter && !singleDivHasAll
          ? "PASS"
          : "FAIL",
        `divs=[${divTexts.join(", ")}]`
      );
    }
    if (browseSeasonOpts[0]) {
      await page.selectOption('select[name="season"]', browseSeasonOpts[0].value);
      await page.selectOption('select[name="type"]', "team");
      await page.click('button[type="submit"]:has-text("Filter")');
      await page.waitForLoadState("networkidle").catch(() => {});
      record(
        suite,
        "Browse filter submission updates URL & renders grid",
        page.url().includes("type=team") ? "PASS" : "FAIL",
        `url=${page.url()}`
      );
    }

    // 3. Consensus dropdown combinations & toggles
    await gotoClean(page, "/consensus", suite, "Consensus initial load");
    const consensusDropdownBtns = page.locator(
      "div.grid.grid-cols-1.md\\:grid-cols-3 button"
    );
    const csCount = await consensusDropdownBtns.count();
    record(
      suite,
      "Consensus renders Season/Division/Edition selector controls",
      csCount >= 3 ? "PASS" : "WARN",
      `controls=${csCount}`
    );
    const toggleChangeBtn = page.locator("button", {
      hasText: /Show Change|Hide Change/,
    });
    if ((await toggleChangeBtn.count()) > 0) {
      const beforeText = await toggleChangeBtn.first().innerText();
      await toggleChangeBtn.first().click();
      await page.waitForTimeout(150);
      const afterText = await toggleChangeBtn.first().innerText();
      record(
        suite,
        "Consensus toggles Show/Hide Change",
        beforeText !== afterText ? "PASS" : "FAIL",
        `${beforeText} -> ${afterText}`
      );
    }
    const copyLinkBtn = page.locator('button:has-text("Copy Link")');
    if ((await copyLinkBtn.count()) > 0) {
      await copyLinkBtn.first().click();
      await page.waitForTimeout(150);
      const copiedShown = await page.locator('button:has-text("Copied!")').count();
      record(
        suite,
        "Consensus Copy Link shows Copied feedback",
        copiedShown > 0 ? "PASS" : "WARN"
      );
    }

    // 4. Stats Dashboard across seasons, divisions, tabs & stages
    await gotoClean(page, "/stats", suite, "Stats initial load");
    // Open season dropdown button (first relative wrapper button inside selector grid)
    const seasonTrigger = page
      .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
      .first()
      .locator("button")
      .first();
    let statsSeasons = [];
    if ((await seasonTrigger.count()) > 0) {
      await seasonTrigger.click();
      await page.waitForTimeout(200);
      statsSeasons = await page
        .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
        .first()
        .locator("div.absolute button")
        .evaluateAll((btns) =>
          btns.map((b) => b.textContent?.replace(/\s+/g, " ").trim() || "")
        );
      await seasonTrigger.click();
      record(
        suite,
        "Stats Season switcher enumerates seasons",
        statsSeasons.length >= 1 ? "PASS" : "FAIL",
        `seasons=${statsSeasons.length}`
      );
    }

    // Test switching between all listed seasons in the UI dropdown
    for (let i = 0; i < Math.min(statsSeasons.length, 3); i++) {
      await seasonTrigger.click();
      await page.waitForTimeout(150);
      const optionBtn = page
        .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
        .first()
        .locator("div.absolute button")
        .nth(i);
      const label = (await optionBtn.innerText()).replace(/\s+/g, " ").trim();
      await optionBtn.click();
      await page.waitForTimeout(900);
      await page.waitForLoadState("networkidle").catch(() => {});

      const divTrigger = page
        .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
        .nth(1)
        .locator("button")
        .first();
      await divTrigger.click();
      await page.waitForTimeout(150);
      const divOpts = await page
        .locator("div.grid.grid-cols-1.md\\:grid-cols-2 > div")
        .nth(1)
        .locator("div.absolute button")
        .evaluateAll((btns) =>
          btns.map((b) => b.textContent?.replace(/\s+/g, " ").trim() || "")
        );
      await divTrigger.click();

      const hasAllDivOpt = divOpts.some((t) => t.startsWith("All Divisions"));
      const singleDivClean =
        divOpts.length > 1 || (divOpts.length === 1 && !hasAllDivOpt);
      record(
        suite,
        `Stats season "${label}" Division menu consistency`,
        singleDivClean ? "PASS" : "FAIL",
        `options=[${divOpts.join(" | ")}]`
      );

      // Exercise Players -> Teams -> General tabs + Regular / Playoffs toggles
      for (const tabLabel of ["PLAYERS", "TEAMS", "GENERAL"]) {
        const tabBtn = page.locator("button", {
          hasText: new RegExp(`^\\s*${tabLabel}\\s*$`, "i"),
        });
        if ((await tabBtn.count()) > 0) {
          await tabBtn.first().click();
          await page.waitForTimeout(250);
          const bodyText = await page.locator("body").innerText();
          if (tabLabel === "GENERAL") {
            const hasSheetModeOnly = bodyText.includes("Sheet mode only");
            record(
              suite,
              `Stats "${label}" General tab has no "Sheet mode only" text`,
              !hasSheetModeOnly ? "PASS" : "FAIL"
            );
          }
          if (tabLabel === "PLAYERS" || tabLabel === "TEAMS") {
            const playoffBtn = page.locator("button", { hasText: /Playoffs/ });
            const regBtn = page.locator("button", { hasText: /Regular Season/ });
            if ((await playoffBtn.count()) > 0 && (await regBtn.count()) > 0) {
              await playoffBtn.first().click();
              await page.waitForTimeout(200);
              await regBtn.first().click();
              await page.waitForTimeout(200);
            }
          }
        }
      }
    }

    // Drill down to a player/team/match/champion page from /stats
    await gotoClean(page, "/stats?tab=players", suite, "Stats Players deep links");
    const firstPlayerLink = page.locator('a[href*="/stats/player/"]').first();
    if ((await firstPlayerLink.count()) > 0) {
      const href = await firstPlayerLink.getAttribute("href");
      if (href) await gotoClean(page, href, suite, "Drilldown Player Stats");
    }
    await gotoClean(page, "/stats?tab=teams", suite, "Stats Teams deep links");
    const firstTeamLink = page.locator('a[href*="/stats/team/"], button').filter({
      hasText: /.*/,
    });
    void firstTeamLink;

    // 5. Team Hub & legacy /matches redirect
    await gotoClean(page, "/matches", suite, "Legacy /matches redirects to /team-hub");
    const landedOnHub = page.url().includes("/team-hub");
    const bodyHub = await page.locator("body").innerText();
    const leaksTourneyCodes =
      bodyHub.includes("Tournament Lobby Codes") ||
      bodyHub.includes("Gen G1 Code");
    record(
      suite,
      "Legacy /matches -> /team-hub & hides tournament codes",
      landedOnHub && !leaksTourneyCodes ? "PASS" : "FAIL",
      `url=${page.url()}, leaksCodes=${leaksTourneyCodes}`
    );

    // Toggle Viewing Team in Team Hub if multiple teams exist
    const teamHubSelects = page.locator("select");
    const thCount = await teamHubSelects.count();
    if (thCount > 0) {
      const lastSel = teamHubSelects.last();
      const opts = await lastSel
        .locator("option")
        .evaluateAll((o) => o.map((x) => x.value));
      if (opts.length > 1) {
        await lastSel.selectOption(opts[1]);
        await page.waitForTimeout(200);
        record(suite, "Team Hub switches Viewing Team cleanly", "PASS");
      }
    }

    // 6. Access-Control Gates (Signed-Out)
    for (const restrictedPath of [
      "/admin",
      "/admin/stats",
      "/admin/users",
      "/admin/publishings",
    ]) {
      await gotoClean(
        page,
        restrictedPath,
        suite,
        `Gate ${restrictedPath} signed-out`
      );
      const txt = await page.locator("body").innerText();
      const blocked =
        txt.includes("Access Denied") || txt.includes("do not have permission");
      const leaksInternals =
        txt.includes("Operator or Admin") || txt.includes("Admin Console →");
      record(
        suite,
        `Gate ${restrictedPath} denies access without internal leaks`,
        blocked && !leaksInternals ? "PASS" : "FAIL",
        `blocked=${blocked}, leaksInternals=${leaksInternals}`
      );
    }

    for (const authPath of ["/create", "/my-history"]) {
      await gotoClean(page, authPath, suite, `Gate ${authPath} requires sign-in`);
      const txt = await page.locator("body").innerText();
      record(
        suite,
        `${authPath} shows Sign in prompt`,
        /sign in/i.test(txt) ? "PASS" : "FAIL"
      );
    }

    // API Auth Checks
    for (const endpoint of [
      { path: "/api/admin/view-as", body: { mode: "public" } },
      {
        path: "/api/admin/moderation/action",
        body: { eventId: "00000000-0000-0000-0000-000000000000", action: "unpublish" },
      },
      {
        path: "/api/matches/tournament-code",
        body: { matchId: "00000000-0000-0000-0000-000000000000", gameNumber: 1 },
      },
    ]) {
      const status = await page.evaluate(
        async ({ u, p }) => {
          const r = await fetch(u, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          });
          return r.status;
        },
        { u: `${baseUrl}${endpoint.path}`, p: endpoint.body }
      );
      record(
        suite,
        `API ${endpoint.path} rejects signed-out POST`,
        status === 401 || status === 403 ? "PASS" : "FAIL",
        `status=${status}`
      );
    }
  } finally {
    await context.close();
  }
}

async function runAuthenticatedSuite(browser, storageStatePath) {
  const suite = "MultiRoleAuth";
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    storageState: storageStatePath,
  });
  const page = await context.newPage();

  async function setViewAs(payload) {
    const res = await context.request.post(`${baseUrl}/api/admin/view-as`, {
      data: payload,
    });
    return { ok: res.ok(), status: res.status() };
  }

  try {
    await setViewAs({ mode: "clear" });
    await gotoClean(page, "/admin", suite, "Site Admin Console load");
    const adminBody = await page.locator("body").innerText();
    if (!adminBody.includes("Seasons") || adminBody.includes("Access Denied")) {
      record(
        suite,
        "Verify saved session is Site Admin",
        "FAIL",
        "Saved session does not have Site Admin access."
      );
      return;
    }
    record(suite, "Verify saved session is Site Admin", "PASS");

    // Extract first League & first Team from the Preview As Role bar before switching tabs
    const previewBar = page.locator("div", { hasText: "Preview As Role" }).filter({
      has: page.locator("select"),
    }).first();
    const roleSelect = previewBar.locator("select").first();
    await roleSelect.selectOption("operator");
    await page.waitForTimeout(150);
    const leagueTarget = await previewBar
      .locator("select")
      .nth(1)
      .evaluate((el) => {
        const opt = el?.options?.[el.selectedIndex];
        return el?.value ? { id: el.value, label: opt?.text || el.value } : null;
      })
      .catch(() => null);

    await roleSelect.selectOption("captain");
    await page.waitForTimeout(150);
    const teamTarget = await previewBar
      .locator("select")
      .nth(1)
      .evaluate((el) => {
        const opt = el?.options?.[el.selectedIndex];
        return el?.value ? { id: el.value, label: opt?.text || el.value } : null;
      })
      .catch(() => null);

    // Walk all 7 Admin Console tabs as Site Admin
    for (const tabLabel of [
      "Seasons",
      "Divisions",
      "Content Editions",
      "Draft Player Pool",
      "Teams",
      "Schedule & Playoffs",
      "Moderation & Safety",
    ]) {
      const btn = page.locator("button", { hasText: new RegExp(`^${tabLabel}$`) });
      if ((await btn.count()) > 0) {
        await btn.first().click();
        await page.waitForTimeout(250);
        record(suite, `Site Admin tab "${tabLabel}" switches cleanly`, "PASS");
      } else {
        record(suite, `Site Admin tab "${tabLabel}" present`, "FAIL");
      }
    }

    await gotoClean(page, "/admin/stats", suite, "Site Admin Stats Controls");
    await gotoClean(page, "/team-hub", suite, "Site Admin Team Hub");
    await gotoClean(page, "/create", suite, "Site Admin Create Workspace");

    // League Operator View-As checks
    if (leagueTarget) {
      const opRes = await setViewAs({
        mode: "operator",
        leagueId: leagueTarget.id,
        label: leagueTarget.label,
      });
      record(
        suite,
        `View-As League Operator (${leagueTarget.label})`,
        opRes.ok ? "PASS" : "FAIL",
        `status=${opRes.status}`
      );
      await gotoClean(page, "/admin", suite, "League Operator /admin load");
      const opAdminTxt = await page.locator("body").innerText();
      record(
        suite,
        "League Operator sees Preview Mode banner & scoped access",
        opAdminTxt.toLowerCase().includes("preview mode") &&
          !opAdminTxt.includes("Preview As Role") &&
          !opAdminTxt.includes("Access Denied")
          ? "PASS"
          : "FAIL"
      );
      const modBtn = page.locator("button", { hasText: /^League Access & Safety$/ });
      if ((await modBtn.count()) > 0) {
        await modBtn.first().click();
        await page.waitForTimeout(300);
        const modTxt = await page.locator("body").innerText();
        const modLower = modTxt.toLowerCase();
        record(
          suite,
          "League Operator sees League Access & Safety + Moderation Alerts Log without Global Kill Switch",
          modLower.includes("moderation alerts log") &&
            !modLower.includes("global kill switch")
            ? "PASS"
            : "FAIL"
        );
      } else {
        record(suite, "League Operator League Access & Safety tab present", "FAIL");
      }
      await gotoClean(page, "/admin/stats", suite, "League Operator /admin/stats");
      await gotoClean(page, "/team-hub", suite, "League Operator /team-hub");
    } else {
      record(suite, "League Operator View-As checks", "WARN", "No league options found in Preview bar");
    }

    // Team Captain View-As checks
    if (teamTarget) {
      const capRes = await setViewAs({
        mode: "captain",
        teamId: teamTarget.id,
        label: teamTarget.label,
      });
      record(
        suite,
        `View-As Team Captain (${teamTarget.label})`,
        capRes.ok ? "PASS" : "FAIL",
        `status=${capRes.status}`
      );
      await gotoClean(page, "/admin", suite, "Team Captain blocked from /admin");
      const capAdminTxt = await page.locator("body").innerText();
      record(
        suite,
        "Team Captain sees Access Denied on /admin",
        capAdminTxt.includes("Access Denied") ? "PASS" : "FAIL"
      );
      await gotoClean(page, "/admin/stats", suite, "Team Captain blocked from /admin/stats");
      const capStatsTxt = await page.locator("body").innerText();
      record(
        suite,
        "Team Captain sees Access Denied on /admin/stats",
        capStatsTxt.includes("Access Denied") ? "PASS" : "FAIL"
      );
      await gotoClean(page, "/team-hub", suite, "Team Captain /team-hub load");
      const capHubTxt = await page.locator("body").innerText();
      record(
        suite,
        "Team Captain sees Preview Mode banner on /team-hub",
        capHubTxt.toLowerCase().includes("preview mode") ? "PASS" : "FAIL"
      );
    } else {
      record(suite, "Team Captain View-As checks", "WARN", "No team options found in Preview bar");
    }

    // Regular User View-As checks
    const pubRes = await setViewAs({ mode: "public", label: "Regular User" });
    record(
      suite,
      "View-As Regular User switches cleanly",
      pubRes.ok ? "PASS" : "FAIL",
      `status=${pubRes.status}`
    );
    await gotoClean(page, "/admin", suite, "Regular User blocked from /admin");
    const pubAdminTxt = await page.locator("body").innerText();
    record(
      suite,
      "Regular User sees Access Denied on /admin",
      pubAdminTxt.includes("Access Denied") ? "PASS" : "FAIL"
    );
    await gotoClean(page, "/admin/stats", suite, "Regular User blocked from /admin/stats");
    const pubStatsTxt = await page.locator("body").innerText();
    record(
      suite,
      "Regular User sees Access Denied on /admin/stats",
      pubStatsTxt.includes("Access Denied") ? "PASS" : "FAIL"
    );
    await gotoClean(page, "/team-hub", suite, "Regular User /team-hub");
    const pubHubTxt = await page.locator("body").innerText();
    record(
      suite,
      "Regular User cannot see Tournament Lobby Codes on Team Hub",
      !pubHubTxt.includes("Tournament Lobby Codes") ? "PASS" : "FAIL"
    );
    await gotoClean(page, "/create", suite, "Regular User /create workspace");
    await gotoClean(page, "/my-history", suite, "Regular User /my-history");
  } finally {
    await setViewAs({ mode: "clear" }).catch(() => {});
    await context.close();
  }
}

const browser = await launchBrowser(true);
try {
  await runSignedOutSuite(browser);

  if (loginMode) {
    await browser.close();
    console.log(
      "\n[INFO] Launching interactive browser for Discord Sign-In. Log in on /, then close the window or wait 45s..."
    );
    const loginBrowser = await launchBrowser(false);
    const loginCtx = await loginBrowser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const loginPage = await loginCtx.newPage();
    await loginPage.goto(baseUrl, { waitUntil: "networkidle" });
    await loginPage
      .waitForSelector('a[href="/admin"], button:has-text("Sign Out")', {
        timeout: 120000,
      })
      .catch(() => {});
    await loginCtx.storageState({ path: savedAuthPath });
    await loginBrowser.close();

    const headlessBrowser = await launchBrowser(true);
    try {
      await runAuthenticatedSuite(headlessBrowser, savedAuthPath);
    } finally {
      await headlessBrowser.close();
    }
  } else if (fs.existsSync(savedAuthPath)) {
    await runAuthenticatedSuite(browser, savedAuthPath);
  } else {
    console.log(
      `\n[INFO] Skipped MultiRoleAuth suite (no ${savedAuthPath}). Pass --login once to record an admin session.`
    );
  }
} finally {
  await browser.close().catch(() => {});
}

const passCount = results.filter((r) => r.status === "PASS").length;
const warnCount = results.filter((r) => r.status === "WARN").length;
const failCount = results.filter((r) => r.status === "FAIL").length;

fs.writeFileSync(
  path.join(outDir, "report.json"),
  JSON.stringify({ baseUrl, passCount, warnCount, failCount, results }, null, 2),
  "utf8"
);

const mdLines = [
  `# Functional & RBAC Audit Report`,
  ``,
  `- **Target:** ${baseUrl}`,
  `- **Summary:** ${passCount} PASS · ${warnCount} WARN · ${failCount} FAIL`,
  ``,
  `| Suite | Check | Status | Details |`,
  `| :--- | :--- | :---: | :--- |`,
  ...results.map(
    (r) =>
      `| ${r.suite} | ${r.name.replace(/\|/g, "\\|")} | ${r.status} | ${(r.details || "").replace(/\|/g, "\\|")} |`
  ),
];
fs.writeFileSync(path.join(outDir, "report.md"), mdLines.join("\n"), "utf8");

console.log(
  `\nSummary: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL -> ${path.join(
    outDir,
    "report.md"
  )}`
);

if (failCount > 0) {
  process.exitCode = 1;
}
