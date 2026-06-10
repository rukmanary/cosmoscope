/* Renders the app (Saturn space view) at 1200×630 with a brand overlay,
   and saves it as the Next.js opengraph-image / twitter-image. */
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.URL ?? "http://localhost:3000/";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--use-angle=metal", "--window-size=1200,630", "--hide-scrollbars"],
  defaultViewport: { width: 1200, height: 630 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000));

// Saturn beauty shot: space mode, day side, no UI.
await page.evaluate(() => {
  const e = globalThis.__cosmoEngine;
  e.setTimeMs(Date.UTC(2026, 5, 20, 21, 0, 0));
  e.goToBody("saturn");
  globalThis.__cosmoStore.set({ panel: null, paused: true });
});
await new Promise((r) => setTimeout(r, 4000));

// Hide the UI chrome, keep only the 3D canvas, then add the brand overlay.
await page.evaluate(() => {
  for (const sel of [".top-bar", ".time-bar", ".panel", ".tracking-chip", ".label-layer"]) {
    document.querySelectorAll(sel).forEach((el) => (el.style.display = "none"));
  }
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;display:flex;flex-direction:column;justify-content:flex-end;" +
    "padding:48px 56px;z-index:999;pointer-events:none;" +
    "background:linear-gradient(to top, rgba(2,4,10,.85) 0%, rgba(2,4,10,0) 45%);";
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:20px;">
      <img src="/cosmoscope-mark.png" style="width:84px;height:84px;border-radius:50%;
        box-shadow:0 0 28px rgba(91,157,255,.5);" />
      <div>
        <div style="font:700 44px/1.1 Inter,system-ui,sans-serif;color:#eaf1ff;
          letter-spacing:.18em;">COSMOSCOPE</div>
        <div style="font:400 22px/1.4 Inter,system-ui,sans-serif;color:#9fb4d8;margin-top:8px;">
          Watch the real sky from any world &nbsp;·&nbsp; fly the Solar System &nbsp;·&nbsp; time-travel to eclipses</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
});
await new Promise((r) => setTimeout(r, 800));

await page.screenshot({ path: "src/app/opengraph-image.png" });
console.log("saved src/app/opengraph-image.png (1200×630)");
await browser.close();
