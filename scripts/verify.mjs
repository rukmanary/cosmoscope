/* Drives headless Chrome against the dev server: collects console errors and screenshots. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.URL ?? "http://localhost:3777/";
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cosmo-"));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--use-angle=metal", "--window-size=1440,900", "--hide-scrollbars"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    errors.push(`[${msg.type()}] ${msg.text()}`);
  }
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000)); // let textures/catalogs load & render
await page.screenshot({ path: path.join(tmpDir, "cosmo-1-surface.png") });

// Open info panel for the Moon via search.
await page.click(".search-box input");
await page.type(".search-box input", "moon");
await new Promise((r) => setTimeout(r, 600));
const hasResults = await page.$(".search-result");
if (hasResults) {
  await page.click(".search-result");
  await new Promise((r) => setTimeout(r, 1200));
}
await page.screenshot({ path: path.join(tmpDir, "cosmo-2-info.png") });

// Leave surface → space mode.
const buttons = await page.$$(".bar-btn");
for (const b of buttons) {
  const t = await b.evaluate((el) => el.textContent);
  if (t?.includes("Leave surface")) {
    await b.click();
    break;
  }
}
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: path.join(tmpDir, "cosmo-3-space.png") });

// Fly to Saturn.
await page.click(".search-box input");
await page.type(".search-box input", "saturn");
await new Promise((r) => setTimeout(r, 600));
const res2 = await page.$(".search-result");
if (res2) {
  await res2.click();
  await new Promise((r) => setTimeout(r, 3500));
}
await page.screenshot({ path: path.join(tmpDir, "cosmo-4-saturn.png") });

console.log("ERRORS:");
console.log(errors.length ? errors.join("\n") : "(none)");
console.log(`Screenshots saved to ${tmpDir}`);
await browser.close();
