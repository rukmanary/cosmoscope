"use client";

import { useEffect, useState } from "react";
import { store, useAppState, TIME_RATES } from "@/lib/store";
import { formatSimDate } from "@/lib/format";

async function engine() {
  return (await import("@/engine/Engine")).engineRef.current;
}

export function TimeBar() {
  const simTimeMs = useAppState((s) => s.simTimeMs);
  const timeRate = useAppState((s) => s.timeRate);
  const paused = useAppState((s) => s.paused);
  const mode = useAppState((s) => s.mode);
  // The sim clock differs between server render and client; show it client-only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // avoid calling setState synchronously in the effect body to prevent
    // cascading renders; schedule it on the next frame
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const absRate = Math.abs(timeRate);
  const idx = TIME_RATES.findIndex((r) => r.rate === absRate);
  const sign = Math.sign(timeRate) || 1;
  let label: string;
  if (paused) {
    label = "paused";
  } else {
    const baseLabel = TIME_RATES[Math.max(idx, 0)]?.label ?? `${timeRate}×`;
    label = `${sign < 0 ? "−" : ""}${baseLabel}`;
  }

  const step = (dir: 1 | -1) => {
    let i = Math.max(idx, 0);
    let s = sign;
    if (dir === 1) {
      if (s < 0) {
        if (i === 0) s = 1;
        else i -= 1;
      } else if (i < TIME_RATES.length - 1) i += 1;
    } else if (s > 0) {
      if (i === 0) s = -1;
      else i -= 1;
    } else if (i < TIME_RATES.length - 1) i += 1;
    store.set({ timeRate: s * TIME_RATES[i].rate, paused: false });
  };

  return (
    <footer className="time-bar">
      <button className="bar-btn" title="Slower / reverse" onClick={() => step(-1)}>
        ⏪
      </button>
      <button
        className="bar-btn"
        title="Play / pause (Space)"
        onClick={() => store.set({ paused: !paused })}
      >
        {paused ? "▶" : "⏸"}
      </button>
      <button className="bar-btn" title="Faster" onClick={() => step(1)}>
        ⏩
      </button>
      <span className="rate-label">{label}</span>
      <span className="sim-date">{mounted ? formatSimDate(simTimeMs) : "…"}</span>
      <input
        className="date-input"
        type="datetime-local"
        onChange={async (e) => {
          const t = new Date(e.target.value).getTime();
          if (Number.isFinite(t)) (await engine())?.setTimeMs(t);
        }}
      />
      <button
        className="bar-btn"
        title="Return to the present"
        onClick={async () => {
          (await engine())?.setTimeMs(Date.now());
          store.set({ timeRate: 1, paused: false });
        }}
      >
        Now
      </button>
      {mode === "surface" && (
        <button
          className="bar-btn"
          title="Skip to the next nightfall here — when the stars come out"
          onClick={async () => (await engine())?.skipToNight()}
        >
          🌙 Night
        </button>
      )}
    </footer>
  );
}
