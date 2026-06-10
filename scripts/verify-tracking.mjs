/* Tracking + telescope view verification. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, "..", "tmp");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.URL ?? "http://localhost:3777/";

await fs.promises.mkdir(SCREENSHOT_DIR, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  args: ["--use-angle=metal", "--window-size=1440,900"], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000));

// Night in Jakarta; track Saturn via the engine API (same path as clicking).
await page.evaluate(() => {
  globalThis.__cosmoEngine.setTimeMs(Date.UTC(2026, 5, 20, 21, 0, 0)); // 04:00 WIB — Saturn up in the east
  globalThis.__cosmoEngine.trackSelection({ kind: "body", id: "saturn" });
});
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "cosmo-16-track-start.png") });

// Run time fast: 1 hr/s for ~3.5 s ≈ 3.5 sky-hours. Saturn must stay centred.
await page.evaluate(() => globalThis.__cosmoStore.set({ timeRate: 3600, paused: false }));
await new Promise((r) => setTimeout(r, 3500));
await page.evaluate(() => globalThis.__cosmoStore.set({ timeRate: 1 }));
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "cosmo-17-track-3h-later.png") });
const centered = await page.evaluate(() => {
  // Saturn's screen position: project via the engine camera? Approximate with label position.
  const labels = [...document.querySelectorAll(".body-label")];
  const el = labels.find((l) => l.textContent === "Saturn");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
console.log("Saturn label position after 3.5 sky-hours:", JSON.stringify(centered));

// Telescope view on Saturn.
await page.evaluate(() => globalThis.__cosmoStore.set({ telescope: true, fovDeg: 1.5 }));
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "cosmo-18-telescope.png") });

// Zoom deeper in the eyepiece.
await page.evaluate(() => globalThis.__cosmoStore.set({ fovDeg: 0.5 }));
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "cosmo-19-telescope-zoom.png") });

console.log("ERRORS:", errors.length ? errors.join("\n") : "(none)");
await browser.close();
