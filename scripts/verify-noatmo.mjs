import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cosmo-"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  args: ["--use-angle=metal", "--window-size=1440,900"], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3777/", { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000));
// Noon in Jakarta, atmosphere OFF → stars + planets over sunlit ground.
await page.evaluate(() => {
  globalThis.__cosmoEngine.setTimeMs(Date.UTC(2026, 5, 10, 5, 0, 0)); // 12:00 WIB
  globalThis.__cosmoStore.setSettings({ atmosphere: false });
  globalThis.__cosmoEngine.pitch = 0.35;
});
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: path.join(tmpDir, "cosmo-12-noatmo-day.png") });
// Toggle back on → blue daylight returns.
await page.evaluate(() => globalThis.__cosmoStore.setSettings({ atmosphere: true }));
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: path.join(tmpDir, "cosmo-13-atmo-day.png") });
// Lunar daytime: ground must now be sunlit while the sky stays black.
await page.evaluate(() => {
  globalThis.__cosmoEngine.setObserver("moon", 0.674, 23.473);
  globalThis.__cosmoEngine.pitch = -0.25;
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: path.join(tmpDir, "cosmo-14-moon-ground.png") });
console.log("ERRORS:", errors.length ? errors.join("\n") : "(none)");
await browser.close();
