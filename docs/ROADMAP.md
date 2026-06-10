# Cosmoscope — Development Roadmap

## M0 — Foundation ✅ (shipped in this repo)
- Next.js 16 + TypeScript + three.js engine with floating-origin, log-depth rendering
- Real ephemerides (astronomy-engine): Sun, 8 planets, Pluto, Moon, Galilean moons,
  IAU rotation models
- HYG star catalog (9,026 stars to mag 6.5), B−V coloring, magnitude sizing
- 89 IAU constellation figures + labels; Milky Way backdrop (galactic-aligned)
- Surface mode on any landable world: atmosphere/twilight shader, ground, cardinals,
  real local day/night
- Space mode: orbit camera, scale-aware zoom (surface → 120 AU), eased fly-to
  arriving over the day side
- Textured bodies (CC-BY 2k), Saturn rings, Earth clouds + night lights, atmosphere
  rims; orbit lines (sampled ellipses + instantaneous moon orbits)
- Object info system with fact database, Earth comparison, missions, fun facts
- Universal search (bodies + named/Bayer stars); click-to-identify picking
- Time engine: pause, ±1 s/s … ±1 yr/s, date jump, "Now"
- Event finder: solar/lunar eclipses (with jump-to-track), moon phases, seasons,
  oppositions, max elongations, meteor showers
- Settings, location presets (Tranquility Base, Jezero, …), help, loading state
- Headless-browser verification harness (screenshots + console-error gate)

## M1 — Sky-watcher completeness (4–6 wks)
- Alt-az & equatorial grids, ecliptic/meridian lines; atmospheric refraction near horizon
- Light-pollution (Bortle) slider; landscape silhouettes; geolocation API "use my sky"
- Twinkle, star halos for mag <1; proper motion (HYG carries pm) for date scrubbing
- Deep-sky: Messier + bright NGC as billboards with real images, magnitudes, info
- URL deep links for every view state; screenshot capture button
- i18n scaffold (en/id first — constellation data already localized)

## M2 — Solar System depth (6–8 wks)
- Remaining major moons (Titan, Triton, Phobos/Deimos, …) via Keplerian elements
- Minor bodies: MPC orbital elements → Kepler propagator (Ceres, Vesta, comets incl.
  1P/Halley); asteroid-belt & Kuiper point clouds
- Eclipse shadows (Moon's umbra on Earth, eclipsed-Moon darkening), planet shadows
  on rings, ring shadows on Saturn
- Spacecraft trajectories (Voyager 1/2, New Horizons, Parker) from SPICE-derived
  samples; ISS & bright satellites from TLE (sgp4 in a worker)
- Surface terrain v1: DEM-displaced spheres for Moon/Mars at close range

## M3 — Beyond the Solar System (8 wks)
- Progressive star streaming (HEALPix tiles to mag 12+, Gaia-derived)
- 3D star positions (HYG distances already shipped): leave the Sun, see
  constellations distort — interstellar travel mode
- Exoplanet systems (NASA Exoplanet Archive): fly to TRAPPIST-1, view its sky
- Galaxy model: Milky Way 3D particle/volume model, Local Group, zoom-out ladder

## M4 — Platform & community (parallel track)
- Backend per `API.md`/`DATABASE.md`: accounts, settings sync, bookmarks
- Guided tours & lessons engine (snapshot-driven), quizzes, progress
- Collaborative sessions (WebSocket shared time/camera + pointer)
- Observation planner (visibility windows, equipment FOV overlays)
- PWA offline mode; WebXR (VR sky + AR "hold phone to sky" via device orientation)

## M5 — Performance & fidelity (ongoing)
- WebGPU renderer behind a flag; HDR + bloom pipeline; volumetric atmospheres
  (precomputed scattering), aurora shader driven by Kp index
- 1k/4k texture LODs, basis/ktx2 compression; worker-thread ephemeris
- Mobile profiling budget: 60 fps mid-range, <3 s TTI, <5 MB critical path

**Sequencing rationale:** M1 maximizes daily-use value for sky-watchers cheaply; M2
deepens the unique "stand anywhere" feature; M3 is the SpaceEngine-class
differentiator and depends on the streaming infra; M4 needs real users first; M5
amortizes across all of it.
