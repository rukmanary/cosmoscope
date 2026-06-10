"use client";

import { useState } from "react";
import { store, useAppState } from "@/lib/store";
import { BODIES, bodyById } from "@/lib/bodies";
import { PanelHeader } from "./InfoPanel";

interface Preset {
  name: string;
  lat: number;
  lon: number;
}

const PRESETS: Record<string, Preset[]> = {
  earth: [
    { name: "Jakarta", lat: -6.2, lon: 106.8 },
    { name: "London", lat: 51.5, lon: -0.13 },
    { name: "New York", lat: 40.7, lon: -74 },
    { name: "Tokyo", lat: 35.7, lon: 139.7 },
    { name: "Sydney", lat: -33.9, lon: 151.2 },
    { name: "Reykjavík (aurora zone)", lat: 64.1, lon: -21.9 },
    { name: "Mauna Kea Observatory", lat: 19.8, lon: -155.5 },
  ],
  moon: [
    { name: "Tranquility Base (Apollo 11)", lat: 0.674, lon: 23.473 },
    { name: "Tycho crater", lat: -43.3, lon: -11.4 },
    { name: "Lunar South Pole (Artemis)", lat: -89.5, lon: 0 },
  ],
  mars: [
    { name: "Jezero Crater (Perseverance)", lat: 18.44, lon: 77.45 },
    { name: "Gale Crater (Curiosity)", lat: -5.4, lon: 137.8 },
    { name: "Olympus Mons summit", lat: 18.65, lon: -133.8 },
  ],
  europa: [{ name: "Sub-Jupiter point", lat: 0, lon: 0 }],
  titan: [],
};

export function LocationPanel() {
  const observer = useAppState((s) => s.observer);
  const [bodyId, setBodyId] = useState(observer.bodyId);
  const [lat, setLat] = useState(String(observer.lat));
  const [lon, setLon] = useState(String(observer.lon));

  const landables = BODIES.filter((b) => b.landable);
  const presets = PRESETS[bodyId] ?? [];
  const worldSelectId = "location-panel-world-select";
  const latInputId = "location-panel-lat";
  const lonInputId = "location-panel-lon";

  const apply = async (la: number, lo: number) => {
    const e = (await import("@/engine/Engine")).engineRef.current;
    e?.setObserver(bodyId, la, lo);
    store.set({ panel: null });
  };

  return (
    <aside className="panel location-panel">
      <PanelHeader title="Observe from…" />
      <div className="panel-body">
        <p className="info-small">
          Stand anywhere in the Solar System and watch its sky — local day, night and constellations
          are simulated for that world.
        </p>
        <label className="field-label" htmlFor={worldSelectId}>World</label>
        <select
          id={worldSelectId}
          className="field"
          value={bodyId}
          onChange={(e) => setBodyId(e.target.value)}
        >
          {landables.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.type === "moon" ? `(moon of ${bodyById.get(b.parent!)?.name})` : ""}
            </option>
          ))}
        </select>

        {presets.length > 0 && (
          <>
            <div className="field-label">Famous locations</div>
            <div className="preset-list">
              {presets.map((p) => (
                <button key={p.name} className="event-card" onClick={() => apply(p.lat, p.lon)}>
                  <span className="event-icon">📍</span>
                  <span className="event-text">
                    <strong>{p.name}</strong>
                    <span className="event-date">
                      {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="field-label">Custom coordinates</div>
        <div className="coord-row">
          <label className="sr-only" htmlFor={latInputId}>
            Latitude
          </label>
          <input
            id={latInputId}
            className="field"
            type="number"
            value={lat}
            min={-90}
            max={90}
            step="0.1"
            onChange={(e) => setLat(e.target.value)}
            placeholder="Latitude"
          />
          <label className="sr-only" htmlFor={lonInputId}>
            Longitude
          </label>
          <input
            id={lonInputId}
            className="field"
            type="number"
            value={lon}
            min={-180}
            max={180}
            step="0.1"
            onChange={(e) => setLon(e.target.value)}
            placeholder="Longitude"
          />
        </div>
        <button
          className="bar-btn primary wide"
          onClick={() => apply(Number.parseFloat(lat) || 0, Number.parseFloat(lon) || 0)}
        >
          🧍 Stand here
        </button>
      </div>
    </aside>
  );
}
