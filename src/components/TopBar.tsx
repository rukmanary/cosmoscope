"use client";

import { store, useAppState, PanelId } from "@/lib/store";
import { bodyById } from "@/lib/bodies";
import { SearchBar } from "./SearchBar";

function PanelButton({ id, label, icon }: Readonly<{ id: PanelId; label: string; icon: string }>) {
  const active = useAppState((s) => s.panel) === id;
  return (
    <button
      className={`bar-btn ${active ? "active" : ""}`}
      title={label}
      onClick={() => store.set({ panel: active ? null : id })}
    >
      <span className="btn-icon">{icon}</span>
      <span className="btn-label">{label}</span>
    </button>
  );
}

export function TopBar() {
  const mode = useAppState((s) => s.mode);
  const observer = useAppState((s) => s.observer);
  const followId = useAppState((s) => s.followBodyId);

  const place =
    mode === "surface"
      ? `${bodyById.get(observer.bodyId)?.name ?? "?"} · ${observer.lat.toFixed(1)}°, ${observer.lon.toFixed(1)}°`
      : `Orbiting ${bodyById.get(followId)?.name ?? "?"}`;

  return (
    <header className="top-bar">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cosmoscope-mark.png" alt="Cosmoscope" className="brand-logo" />{" "}
        COSMOSCOPE
      </div>
      <SearchBar />
      <div className="mode-chip" title="Current viewpoint">
        {mode === "surface" ? "🌍" : "🚀"} {place}
      </div>
      {mode === "surface" ? (
        <button
          className="bar-btn primary"
          onClick={async () => (await import("@/engine/Engine")).engineRef.current?.leaveSurface()}
        >
          🚀 Leave surface
        </button>
      ) : (
        <button className="bar-btn primary" onClick={() => store.set({ panel: "location" })}>
          🌍 Land…
        </button>
      )}
      <nav className="top-actions">
        <PanelButton id="location" label="Observe from" icon="📍" />
        <PanelButton id="events" label="Events" icon="🗓" />
        <PanelButton id="settings" label="View" icon="⚙" />
        <PanelButton id="help" label="Help" icon="?" />
      </nav>
    </header>
  );
}
