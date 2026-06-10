import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = path.resolve(process.cwd(), "tmp");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  args: ["--use-angle=metal", "--window-size=1440,900"], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3777/", { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000));
// Day, grass, look slightly downward toward the horizon.
await page.evaluate(() => {
  globalThis.__cosmoEngine.setTimeMs(Date.UTC(2026, 5, 10, 3, 0, 0));
  globalThis.__cosmoEngine.pitch = -0.18; globalThis.__cosmoEngine.yaw = Math.PI / 2;
});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: path.join(outDir, "cosmo-8-grass.png") });
await page.evaluate(() => globalThis.__cosmoStore.setSettings({ landscape: "desert" }));
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: path.join(outDir, "cosmo-9-desert.png") });
// City night: skip to night, look at horizon for the skyline.
await page.evaluate(() => {
  globalThis.__cosmoStore.setSettings({ landscape: "city" });
  globalThis.__cosmoEngine.skipToNight();
  globalThis.__cosmoEngine.pitch = 0.06;
});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: path.join(outDir, "cosmo-10-city-night.png") });
// Grass night sky full of stars.
await page.evaluate(() => {
  globalThis.__cosmoStore.setSettings({ landscape: "grass" });
  globalThis.__cosmoEngine.pitch = 0.5;
});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: path.join(outDir, "cosmo-11-grass-night.png") });
console.log("ERRORS:", errors.length ? errors.join("\n") : "(none)");
await browser.close();
