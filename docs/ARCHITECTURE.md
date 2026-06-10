# Cosmoscope — System Architecture

## 1. Overview

Cosmoscope is a web planetarium and space-exploration simulator: Stellarium-class sky
rendering from any world's surface, plus Celestia-class free travel through the Solar
System, in one seamless scene with no loading screens.

```
┌────────────────────────────────────────────────────────────────────┐
│                          Browser (client)                          │
│                                                                    │
│  React UI overlay (Next.js App Router, client components)         │
│  TopBar · SearchBar · TimeBar · Info/Events/Location/Settings     │
│        │ commands                ▲ state subscription              │
│        ▼                         │                                 │
│  AppState store (useSyncExternalStore, framework-agnostic)         │
│        ▲ writes (~5 Hz clock sync, selection, mode)                │
│        │ reads (every frame)                                       │
│  ┌─────┴──────────────────────────────────────────────┐            │
│  │ Engine (three.js, WebGL2 + logarithmic depth)      │            │
│  │  ├─ Ephemeris (astronomy-engine: VSOP87/ELP2000,   │            │
│  │  │             IAU rotation models)                │            │
│  │  ├─ SolarSystem (bodies, rings, clouds, night side,│            │
│  │  │   atmosphere rims, orbit lines, markers, labels)│            │
│  │  ├─ Starfield (9k-star HYG catalog, GPU points)    │            │
│  │  ├─ Constellations (89 IAU figures, great-circle   │            │
│  │  │   segments)                                     │            │
│  │  ├─ SkyDome (surface-mode atmosphere + ground)     │            │
│  │  └─ Camera rigs (surface look-around / orbit-and-  │            │
│  │      fly), floating-origin renderer                │            │
│  └────────────────────────────────────────────────────┘            │
│        ▲ static assets                                              │
└────────┼───────────────────────────────────────────────────────────┘
         │
  CDN / Next.js static serving
  /data/stars.json  /data/constellations.json  /textures/*.jpg|png
         │
  (Phase 2) API backend: accounts, bookmarks, shared sessions
```

The current implementation is fully client-side: all ephemeris computation runs in the
browser (astronomy-engine is ~100 KB and millisecond-fast), and all datasets are static
assets baked at build time by `scripts/build-data.mjs`. A backend (see `API.md`,
`DATABASE.md`) is only needed for accounts, bookmarks, large catalogs and collaboration.

## 2. Core design decisions

### 2.1 Coordinate system & units
- **World frame**: J2000 equatorial (EQJ) — the frame astronomy-engine emits natively
  and the frame star catalogs use (RA/Dec maps directly to world directions).
  +Z = celestial north, +X = vernal equinox.
- **Unit**: 1 world unit = 1 AU. Star sphere at 10⁷ AU; Neptune at 30 AU;
  Earth's radius is 4.3×10⁻⁵ AU.

### 2.2 Floating origin (the key precision trick)
A float32 GPU pipeline cannot express "standing on a planet 30 AU from the origin"
(precision at 30 AU ≈ hundreds of km → catastrophic jitter). Therefore:

- All body positions are kept in **JS doubles** (`THREE.Vector3` on the CPU is f64).
- The camera object stays at scene origin; its true heliocentric position `camPos`
  is double precision, owned by the engine.
- Every frame, each body anchor is placed at `bodyPos − camPos`. Near bodies get small,
  precise coordinates; far bodies get large coordinates where error is sub-pixel.
- A **logarithmic depth buffer** spans the 16 orders of magnitude between a planet's
  surface (10⁻⁹ AU near plane) and the star sphere (10⁷ AU).

This is what makes "zoom from a planetary surface to interstellar distance without a
loading screen" work.

### 2.3 Scientific accuracy chain
| Quantity | Source | Model |
|---|---|---|
| Planet/Pluto positions | astronomy-engine `HelioVector` | VSOP87 + TOP2013-derived |
| Moon position | `GeoMoon` / `GeoMoonState` | ELP2000-derived |
| Galilean moons | `JupiterMoons` | Lieske E5-derived |
| Body orientation/spin | `RotationAxis` | IAU rotation models |
| Star positions/mag/color | HYG 4.1 (Hipparcos+Yale+Gliese) | mag ≤ 6.5 + all named (9,026 stars) |
| Constellation figures | d3-celestial dataset | IAU 88 + Serpens split |
| Eclipses, phases, seasons, oppositions, elongations | astronomy-engine search functions | root-finding on the above ephemerides |

Because the same `bodyOrientation` quaternion drives both the planet mesh and the
observer's surface frame, the day/night cycle, sun altitude, and constellation
positions seen from any surface point are mutually consistent and astronomically real.

### 2.4 Render order & passes
Opaque pass writes depth (planet spheres). The transparent queue is then ordered:

```
-110 Milky Way backdrop  →  -95 constellation lines  →  -90 stars (additive points)
 →  -85 atmosphere sky dome (alpha; washes stars out in daylight)
 →   0  clouds / night lights / rims (per-body)  →  100 ground hemisphere (surface mode)
```

Stars use `depthTest: true` so opaque planets occlude them; the surface-mode ground
uses `depthTest: false` + last render order so it occludes everything below the
local horizon without needing planet-scale geometry near the camera.

### 2.5 Visibility at all scales
A planet at 30 AU is far smaller than a pixel. Each body therefore carries a
screen-space sprite marker + CSS2D label that fades in when angular radius
< 0.004 rad, so the Solar System stays navigable from any distance — the same
approach NASA Eyes uses.

### 2.6 State management
A dependency-free external store (`src/lib/store.ts`) bridges two worlds:
- React reads via `useSyncExternalStore` selectors (re-render on change).
- The engine reads `store.get()` once per frame (no React in the hot path) and
  writes back at ≤5 Hz (sim clock) or on events (selection, mode).
Commands that need engine internals (fly-to, set-observer, set-time) go through the
`engineRef` singleton.

## 3. Module map (current folder structure)

```
cosmoscope/
├── docs/                     ← architecture, DB, API, design, roadmap, deployment
├── scripts/
│   ├── build-data.mjs        ← HYG CSV + d3-celestial → compact runtime JSON
│   ├── verify.mjs            ← headless-Chrome smoke test (screenshots + console)
│   └── verify-night.mjs      ← night-sky / Moon / Mars surface checks
├── public/
│   ├── data/                 ← stars.json (9,026 stars), constellations.json (89)
│   └── textures/             ← CC-BY Solar System Scope 2k maps + ring/cloud/night
└── src/
    ├── app/                  ← Next.js shell (layout, page, global styles)
    ├── components/           ← React overlay: TopBar, SearchBar, TimeBar,
    │                            InfoPanel, EventsPanel, LocationPanel,
    │                            SettingsPanel, HelpPanel, CosmoscopeApp
    ├── engine/
    │   ├── Engine.ts         ← render loop, camera rigs, input, picking, flights
    │   ├── ephemeris.ts      ← astronomy-engine wrapper (positions, orientations,
    │   │                        surface frames)
    │   ├── SolarSystem.ts    ← body meshes, rings, clouds, rims, orbits, markers
    │   ├── Starfield.ts      ← GPU point stars, B−V→RGB, picking, labels
    │   ├── Constellations.ts ← line sets + labels
    │   └── SkyDome.ts        ← surface atmosphere shader, ground, cardinals
    └── lib/
        ├── bodies.ts         ← body catalog + fact database (the "encyclopedia")
        ├── events.ts         ← eclipse/phase/season/opposition/shower finder
        ├── store.ts          ← app state
        └── format.ts         ← display formatting helpers
```

## 4. Performance budget
- Star rendering: one draw call (9k GPU points, shader-sized by magnitude).
- Constellations: one draw call (LineSegments).
- Bodies: ~15 spheres + transparent shells; ephemeris cost ≈ 30 µs/frame.
- Event search runs only when the Events panel opens (tens of ms, off the render path).
- Texture budget ≈ 13 MB (2k maps); swap to 1k variants for low-end mobile (roadmap).

## 5. Extension points (designed-in seams)
- **More bodies**: add a `BodyDef` to `lib/bodies.ts`; positions resolve through
  `ephemeris.ts` (add a Keplerian propagator for small bodies — roadmap M3).
- **Deep-sky objects**: a `DeepSky` scene module mirroring `Starfield` (Messier/NGC
  catalog JSON via the same build pipeline).
- **Surface terrain**: replace the stylized ground hemisphere with quadtree-tiled
  DEM terrain (CTOD) per body — the SkyDome interface already isolates this.
- **WebGPU**: three.js `WebGPURenderer` is a drop-in once stable; shaders here are
  small and portable (TSL rewrite is contained to 4 materials).
- **Backend**: see `API.md` — the client is already structured around a static
  "content API" (JSON assets) that can move server-side without engine changes.
