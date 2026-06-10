"use client";

import { useEffect, useState } from "react";
import { store, useAppState, Selection } from "@/lib/store";
import { bodyById, BodyDef } from "@/lib/bodies";
import {
  formatDays,
  formatDistanceLy,
  formatHours,
  formatKm,
  formatMass,
  spectralClassFromBV,
} from "@/lib/format";
import type { StarCatalog } from "@/engine/Starfield";

async function engine() {
  return (await import("@/engine/Engine")).engineRef.current;
}

function TelescopeButton({ sel }: Readonly<{ sel: Selection }>) {
  const mode = useAppState((s) => s.mode);
  const telescope = useAppState((s) => s.telescope);
  if (mode !== "surface" || !sel) return null;
  return (
    <button
      className={`bar-btn ${telescope ? "active" : ""}`}
      title={telescope ? "Back to normal view" : "Track this object through a telescope eyepiece"}
      onClick={async () => {
        if (telescope) {
          store.set({ telescope: false, fovDeg: 60 });
        } else {
          const e = await engine();
          e?.trackSelection(sel);
          store.set({ telescope: true, fovDeg: e?.telescopeFovFor(sel) ?? 1.5 });
        }
      }}
    >
      {telescope ? "🔭 Exit telescope" : "🔭 Telescope view"}
    </button>
  );
}

function Row({ k, v }: Readonly<{ k: string; v: string }>) {
  return (
    <div className="info-row">
      <span className="info-key">{k}</span>
      <span className="info-val">{v}</span>
    </div>
  );
}

function BodyInfo({ def }: Readonly<{ def: BodyDef }>) {
  const mode = useAppState((s) => s.mode);
  const earth = bodyById.get("earth")!;
  return (
    <>
      <div className="info-type">{def.type}</div>
      <p className="info-desc">{def.facts.description}</p>
      <div className="info-actions">
        <button
          className="bar-btn primary"
          onClick={async () => (await engine())?.focusSelection({ kind: "body", id: def.id })}
        >
          {mode === "surface" ? "🎯 Find & track" : "🚀 Fly to"}
        </button>
        <TelescopeButton sel={{ kind: "body", id: def.id }} />
        {def.landable && (
          <button
            className="bar-btn"
            onClick={async () => (await engine())?.setObserver(def.id, 0, 0)}
          >
            🧍 Stand on surface
          </button>
        )}
      </div>

      <h3>Physical characteristics</h3>
      <Row k="Mean radius" v={formatKm(def.radiusKm)} />
      <Row k="Mass" v={formatMass(def.massKg)} />
      <Row k="Surface gravity" v={`${def.gravityMs2} m/s² (${(def.gravityMs2 / earth.gravityMs2).toFixed(2)}× Earth)`} />
      <Row k="Day length (sidereal)" v={formatHours(def.dayHours)} />
      <Row k="Axial tilt" v={`${def.axialTiltDeg}°`} />
      <Row k="Temperature" v={def.facts.temperature} />
      <Row k="Moons" v={String(def.moonCount)} />
      <Row k="Composition" v={def.facts.composition} />
      {def.atmosphere && (
        <>
          <Row k="Atmosphere" v={def.atmosphere.composition} />
          <Row k="Surface pressure" v={def.atmosphere.surfacePressure} />
        </>
      )}

      {def.orbitDays > 0 && (
        <>
          <h3>Orbit</h3>
          <Row k="Orbits" v={bodyById.get(def.parent ?? "")?.name ?? "—"} />
          <Row k="Period" v={formatDays(def.orbitDays)} />
          <Row k="Semi-major axis" v={`${def.semiMajorAxisAu} AU`} />
          <Row k="Eccentricity" v={String(def.eccentricity)} />
        </>
      )}

      <h3>Compared with Earth</h3>
      <Row k="Diameter" v={`${(def.radiusKm / earth.radiusKm).toFixed(2)}× Earth`} />
      <Row k="Mass" v={`${(def.massKg / earth.massKg).toPrecision(3)}× Earth`} />

      <h3>Discovery</h3>
      <p className="info-small">{def.facts.discovery}</p>

      <h3>Exploration</h3>
      <div className="chip-row">
        {def.facts.missions.map((m) => (
          <span key={m} className="chip">{m}</span>
        ))}
      </div>

      <h3>Did you know?</h3>
      <ul className="fact-list">
        {def.facts.funFacts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </>
  );
}

function StarInfo({ index }: Readonly<{ index: number }>) {
  const [cat, setCat] = useState<StarCatalog | null>(null);
  useEffect(() => {
    engine().then((e) => setCat(e?.getStarCatalog() ?? null));
  }, []);
  if (!cat) return null;
  const bv = cat.ci[index];
  return (
    <>
      <div className="info-type">star</div>
      <div className="info-actions">
        <button
          className="bar-btn primary"
          onClick={async () => (await engine())?.focusSelection({ kind: "star", index })}
        >
          🎯 Find & track
        </button>
        <TelescopeButton sel={{ kind: "star", index }} />
      </div>
      <h3>Properties</h3>
      <Row k="Designation" v={cat.bayer[index] ?? "—"} />
      <Row k="Apparent magnitude" v={cat.mag[index].toFixed(2)} />
      <Row k="Distance" v={formatDistanceLy(cat.dist[index])} />
      <Row k="Colour index (B−V)" v={bv.toFixed(2)} />
      <Row k="Spectral class (est.)" v={spectralClassFromBV(bv)} />
      <Row k="Right ascension" v={`${(cat.ra[index] / 15).toFixed(2)} h`} />
      <Row k="Declination" v={`${cat.dec[index].toFixed(2)}°`} />
      <p className="info-small">
        Position and brightness from the HYG star database (Hipparcos / Yale / Gliese catalogs).
      </p>
    </>
  );
}

export function InfoPanel() {
  const selection = useAppState((s) => s.selection);
  const [starName, setStarName] = useState<string>("");

  useEffect(() => {
    if (selection?.kind === "star") {
      engine().then((e) => {
        const cat = e?.getStarCatalog();
        if (cat) setStarName(cat.names[selection.index] ?? cat.bayer[selection.index] ?? `Star`);
      });
    }
  }, [selection]);

  if (!selection) {
    return (
      <aside className="panel info-panel">
        <PanelHeader title="Object info" />
        <p className="info-small">Click any planet, moon or star to inspect it.</p>
      </aside>
    );
  }

  const title = selection.kind === "body" ? bodyById.get(selection.id)?.name ?? "?" : starName;

  return (
    <aside className="panel info-panel">
      <PanelHeader title={title} />
      <div className="panel-body">
        {selection.kind === "body" ? (
          <BodyInfo def={bodyById.get(selection.id)!} />
        ) : (
          <StarInfo index={selection.index} />
        )}
      </div>
    </aside>
  );
}

export function PanelHeader({ title }: Readonly<{ title: string }>) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <button className="close-btn" onClick={() => store.set({ panel: null })}>
        ✕
      </button>
    </div>
  );
}
