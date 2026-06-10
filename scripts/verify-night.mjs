/* Night-sky and other-world surface checks. */
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--use-angle=metal", "--window-size=1440,900", "--hide-scrollbars"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
const tmpPath = (name) => path.join(os.tmpdir(), name);

await page.goto("http://localhost:3777/", { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000));

// Jakarta tonight at 21:00 local (UTC+7 → 14:00 UTC).
await page.evaluate(() => {
  const e = globalThis.__cosmoEngine;
  e.setTimeMs(Date.UTC(2026, 5, 10, 14, 0, 0));
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: tmpPath("cosmo-5-night.png") });

// Stand at Tranquility Base on the Moon; Earth should hang in the black sky.
await page.evaluate(() => {
  const e = globalThis.__cosmoEngine;
  e.setObserver("moon", 0.674, 23.473);
  e.focusSelection({ kind: "body", id: "earth" });
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: tmpPath("cosmo-6-moon.png") });

// Mars surface at Jezero, butterscotch daytime sky or night.
await page.evaluate(() => {
  const e = globalThis.__cosmoEngine;
  e.setObserver("mars", 18.44, 77.45);
  e.focusSelection({ kind: "body", id: "sun" });
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: tmpPath("cosmo-7-mars.png") });

console.log("ERRORS:", errors.length ? errors.join("\n") : "(none)");
await browser.close();
