"use client";

import { store, useAppState, Settings, Landscape } from "@/lib/store";
import { PanelHeader } from "./InfoPanel";

const LANDSCAPES: { id: Landscape; label: string }[] = [
  { id: "grass", label: "🌾 Grassland — rolling hills" },
  { id: "desert", label: "🏜 Desert — open dunes" },
  { id: "city", label: "🏙 City — skyline & light pollution" },
];

type BooleanSettingKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const TOGGLES: { key: BooleanSettingKey; label: string }[] = [
  { key: "constellations", label: "Constellation lines" },
  { key: "constellationLabels", label: "Constellation names" },
  { key: "starLabels", label: "Star names" },
  { key: "bodyLabels", label: "Planet & moon labels" },
  { key: "orbits", label: "Orbit paths (space view)" },
  { key: "atmosphere", label: "Atmosphere & daylight" },
  { key: "milkyWay", label: "Milky Way" },
  { key: "ground", label: "Ground & horizon" },
];

export function SettingsPanel() {
  const settings = useAppState((s) => s.settings);
  const fov = useAppState((s) => s.fovDeg);

  let fovDescriptor = "";
  if (fov < 5) {
    fovDescriptor = "(telescope)";
  } else if (fov < 25) {
    fovDescriptor = "(binoculars)";
  }

  return (
    <aside className="panel settings-panel">
      <PanelHeader title="View settings" />
      <div className="panel-body">
        <label className="field-label" htmlFor="landscape-select">Landscape (Earth)</label>
        <select
          className="field"
          id="landscape-select"
          value={settings.landscape}
          onChange={(e) => store.setSettings({ landscape: e.target.value as Landscape })}
        >
          {LANDSCAPES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="info-small">
          Other worlds always show their own rocky terrain. City adds skyline lights and a touch
          of light pollution.
        </p>
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="toggle-row">
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => store.setSettings({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <label className="field-label" htmlFor="fov-range">
          Field of view — {fov.toFixed(1)}° {fovDescriptor}
        </label>
        <input
          type="range"
          min={0.5}
          max={100}
          step={0.5}
          id="fov-range"
          value={fov}
          onChange={(e) => store.set({ fovDeg: Number.parseFloat(e.target.value) })}
        />
        <p className="info-small">
          Tip: scroll to zoom. Below ~5° you are simulating a telescope eyepiece view.
        </p>
      </div>
    </aside>
  );
}
