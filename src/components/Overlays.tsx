"use client";

import { store, useAppState } from "@/lib/store";

/** Small floating chip shown while the camera is locked onto an object. */
export function TrackingChip() {
  const tracking = useAppState((s) => s.tracking);
  const label = useAppState((s) => s.trackingLabel);
  const telescope = useAppState((s) => s.telescope);
  const mode = useAppState((s) => s.mode);
  if (!tracking || telescope || mode !== "surface") return null;
  return (
    <div className="tracking-chip">
      <span>🎯 Tracking {label}</span>
      <BelowHorizonHint />
      <button
        title="Stop tracking"
        onClick={() => store.set({ tracking: null, trackingLabel: "" })}
      >
        ✕
      </button>
    </div>
  );
}

/** Warns when the followed object is currently under the local horizon. */
function BelowHorizonHint() {
  const below = useAppState((s) => s.trackedBelowHorizon);
  if (!below) return null;
  return <span className="below-horizon">⛰ below horizon — try 🌙 Night or ⏩</span>;
}

/** Circular eyepiece mask + crosshair + magnification HUD. */
export function TelescopeOverlay() {
  const telescope = useAppState((s) => s.telescope);
  const fov = useAppState((s) => s.fovDeg);
  const label = useAppState((s) => s.trackingLabel);
  const mode = useAppState((s) => s.mode);
  if (!telescope || mode !== "surface") return null;

  const magnification = Math.round(60 / fov); // vs. ~60° naked-eye field

  return (
    <div className="telescope-overlay">
      <div className="telescope-mask" />
      <div className="telescope-reticle" />
      <div className="telescope-hud">
        <span className="telescope-target">🔭 {label || "Telescope"}</span>
        <span className="telescope-stats">
          FOV {fov < 1 ? fov.toFixed(2) : fov.toFixed(1)}° · {magnification}× · scroll to zoom
        </span>
        <BelowHorizonHint />
        <button
          className="bar-btn"
          onClick={() => store.set({ telescope: false, fovDeg: 60 })}
        >
          ✕ Exit eyepiece
        </button>
      </div>
    </div>
  );
}
