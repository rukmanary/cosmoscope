"use client";

import { PanelHeader } from "./InfoPanel";

export function HelpPanel() {
  return (
    <aside className="panel help-panel">
      <PanelHeader title="How to explore" />
      <div className="panel-body">
        <h3>🌍 Surface mode</h3>
        <ul className="fact-list">
          <li><strong>Drag</strong> to look around the sky.</li>
          <li><strong>Scroll</strong> to zoom — go below 5° FOV for a telescope view.</li>
          <li><strong>Click</strong> any star or planet for details — the camera locks on and
            follows it as time runs; drag to release.</li>
          <li><strong>🔭 Telescope view</strong> (in the info panel) opens a tracked eyepiece —
            scroll to change magnification.</li>
          <li>Use <strong>Observe from…</strong> to stand on the Moon, Mars, Europa and more.</li>
          <li>Press <strong>🚀 Leave surface</strong> to fly into space.</li>
        </ul>
        <h3>🚀 Space mode</h3>
        <ul className="fact-list">
          <li><strong>Drag</strong> to orbit the current body.</li>
          <li><strong>Scroll</strong> to zoom from the surface out to 120 AU.</li>
          <li>Search or click a body, then <strong>Fly to</strong> it.</li>
          <li><strong>Land…</strong> puts you back on a surface.</li>
        </ul>
        <h3>🕒 Time</h3>
        <ul className="fact-list">
          <li><strong>Space bar</strong> pauses the simulation.</li>
          <li>⏪ / ⏩ change speed up to a year per second — watch orbits dance.</li>
          <li><strong>Events</strong> lists eclipses, oppositions and showers; click one to time-travel.</li>
        </ul>
        <h3>🔬 Accuracy</h3>
        <p className="info-small">
          Positions come from the VSOP87/ELP2000-based models in astronomy-engine; stars from the
          HYG database (Hipparcos). Constellation figures follow the IAU set. Planet rotation uses
          IAU rotation models, so the day/night cycle you see from any surface is real.
        </p>
      </div>
    </aside>
  );
}
