"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/store";
import { TopBar } from "./TopBar";
import { TimeBar } from "./TimeBar";
import { InfoPanel } from "./InfoPanel";
import { EventsPanel } from "./EventsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { LocationPanel } from "./LocationPanel";
import { HelpPanel } from "./HelpPanel";
import { TelescopeOverlay, TrackingChip } from "./Overlays";

export default function CosmoscopeApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [engineReady, setEngineReady] = useState(false);
  const panel = useAppState((s) => s.panel);

  useEffect(() => {
    let disposed = false;
    let engine: import("@/engine/Engine").Engine | null = null;
    (async () => {
      const { Engine, engineRef } = await import("@/engine/Engine");
      if (disposed || !containerRef.current) return;
      engine = new Engine(containerRef.current);
      engineRef.current = engine;
      await engine.ready;
      if (!disposed) setEngineReady(true);
    })();
    return () => {
      disposed = true;
      engine?.dispose();
    };
  }, []);

  return (
    <div className="app-root">
      <div ref={containerRef} className="viewport" />
      {!engineReady && (
        <div className="loading-overlay">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cosmoscope.png" alt="Cosmoscope" className="loading-logo" />
          <div className="loading-sub">Loading star catalogs & ephemerides…</div>
        </div>
      )}
      <TelescopeOverlay />
      <TrackingChip />
      <TopBar />
      <TimeBar />
      {panel === "info" && <InfoPanel />}
      {panel === "events" && <EventsPanel />}
      {panel === "settings" && <SettingsPanel />}
      {panel === "location" && <LocationPanel />}
      {panel === "help" && <HelpPanel />}
    </div>
  );
}
