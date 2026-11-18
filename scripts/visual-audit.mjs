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

const widths = (argVal("--widths=") || "1440,1024,768,390")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

const defaultPages = [
  { name: "stats", path: "/stats", statsTabs: true },
  {
    name: "team",
    path: "/stats/team/96599821-62aa-4745-8432-352702d5b8bd",
  },
  { name: "player", path: "/stats/player/vacant%20tech%23na1" },
  { name: "match", path: "/stats/match/Round1_Bandits_Ghoulblins" },
];

const extraPages = [
  { name: "home", path: "/" },
  { name: "browse", path: "/browse" },
  { name: "consensus", path: "/consensus" },
];

const customPages = argVal("--pages=")
  ? argVal("--pages=")
      .split(",")
      .map((p, i) => ({ name: `page-${i + 1}`, path: p.trim() }))
  : args.includes("--all")
  ? [...defaultPages, ...extraPages]
  : defaultPages;

const outDir = path.resolve("temp/audit");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

async function launchBrowser() {
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {}
  }
  return chromium.launch({ headless: true });
}

const browser = await launchBrowser();
const issues = [];

try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    for (const target of customPages) {
      const url = `${baseUrl.replace(/\/$/, "")}${target.path}`;
      const consoleErrors = [];
      const onErr = (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      };
      page.on("console", onErr);

      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(500);

      async function capture(label) {
        const health = await page.evaluate(() => {
          const brokenImgs = [...document.querySelectorAll("img")]
            .filter((img) => img.complete && img.naturalWidth === 0)
            .map((img) => img.getAttribute("src") || img.alt || "(unknown)");
          const overflowPx =
            document.documentElement.scrollWidth - window.innerWidth;
          return { brokenImgs, overflowPx };
        });

        const file = path.join(outDir, `${target.name}-${label}-${width}px.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(
          `[saved] ${path.relative(process.cwd(), file)}` +
            (health.overflowPx > 1 ? ` | OVERFLOW +${health.overflowPx}px` : "") +
            (health.brokenImgs.length > 0
              ? ` | BROKEN_IMGS=${health.brokenImgs.length}`
              : "")
        );
        if (health.overflowPx > 1 || health.brokenImgs.length > 0 || consoleErrors.length > 0) {
          issues.push({
            label: `${target.name}-${label}-${width}px`,
            overflowPx: health.overflowPx,
            brokenImgs: health.brokenImgs,
            consoleErrors: [...consoleErrors],
          });
        }
      }

      if (target.statsTabs) {
        await capture("players");
        for (const tab of ["Teams", "Division"]) {
          const btn = page.locator("button", { hasText: new RegExp(`^${tab}$`, "i") }).first();
          if (await btn.count()) {
            await btn.click();
            await page.waitForTimeout(250);
            await capture(tab.toLowerCase());
          }
        }
      } else {
        await capture("full");
      }

      page.off("console", onErr);
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (issues.length > 0) {
  console.log("\n--- Automated DOM Warnings ---");
  console.log(JSON.stringify(issues, null, 2));
} else {
  console.log("\nAll captured pages passed DOM checks (0 overflow, 0 broken images).");
}
