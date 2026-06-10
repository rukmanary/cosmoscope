# ✦ Cosmoscope

**A web planetarium you can leave.** Watch tonight's real sky from your backyard,
then lift off, fly to Saturn, land on Europa, and watch Jupiter rise over the ice —
all in one seamless, scientifically accurate simulation. Inspired by Stellarium,
Celestia, SpaceEngine and NASA Eyes.

## What it does today

- **🌍 Real sky simulation** — 9,026 real stars (HYG/Hipparcos, colored by B−V,
  sized by magnitude), 89 IAU constellations with figures and names, the Milky Way,
  and all planets exactly where they really are, computed live from VSOP87/ELP2000-
  based ephemerides (astronomy-engine).
- **🚀 Leave Earth** — one button takes you to space; orbit any body, zoom from its
  surface out to 120 AU, and fly between worlds with no loading screens
  (floating-origin + logarithmic-depth rendering).
- **🧍 Stand anywhere** — observe from Tranquility Base, Jezero Crater, Europa's
  sub-Jupiter point… Local day/night, twilight colors, atmosphere density and the
  constellations are all real for that world, because the same IAU rotation models
  drive both the planet meshes and your horizon.
- **🕒 Time travel** — pause, run time at up to a year per second (forwards or
  backwards), or jump straight to a computed event: solar & lunar eclipses (with a
  one-click jump to the eclipse track!), oppositions, greatest elongations, moon
  phases, equinoxes, meteor showers.
- **🔭 Identify & learn** — click any object for physical data, orbits,
  Earth comparisons, discovery history, missions and "did you know" facts.
  Scroll-zoom down to 0.5° FOV for a telescope-style view.
- **🪐 Visual fidelity** — CC-BY 2k planet textures, Saturn's rings, Earth's
  rotating cloud layer and city lights on the night side, atmosphere limb glow,
  orbit paths, screen-space markers so distant worlds stay findable.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

**Controls** — drag: look / orbit · scroll: zoom (FOV on a surface, distance in
space) · click: identify · Space: pause · search box: go anywhere.

### Rebuilding the data files
`public/data/` is checked in. To regenerate from sources:

```bash
# put the raw inputs into scripts/ first:
#   hyg.csv        https://github.com/astronexus/HYG-Database (hygdata_v41)
#   conlines.json  https://github.com/ofrohn/d3-celestial (constellations.lines.json)
#   connames.json  https://github.com/ofrohn/d3-celestial (constellations.json)
node scripts/build-data.mjs
```

### Verification harness
With Chrome installed and the dev server on :3777:

```bash
npm run dev -- --port 3777 &
npm i --no-save puppeteer-core
node scripts/verify.mjs        # surface day → info → space → Saturn screenshots
node scripts/verify-night.mjs  # Jakarta night sky, Moon & Mars surface views
```
Both scripts fail loudly on any browser console error and write screenshots to /tmp.

## Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | system architecture, rendering engine design, folder structure |
| [docs/DATABASE.md](docs/DATABASE.md) | Phase-2 database schema (users, bookmarks, lessons, sessions, catalogs) |
| [docs/API.md](docs/API.md) | REST + WebSocket API design |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | UI/UX tokens, layout grammar, accessibility |
| [docs/ROADMAP.md](docs/ROADMAP.md) | milestones M0 (shipped) → M5 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | production deployment & CI strategy |

## Data & attribution

- **Star catalog**: [HYG Database](https://github.com/astronexus/HYG-Database) v4.1
  by David Nash — CC BY-SA 4.0.
- **Constellation figures & names**: [d3-celestial](https://github.com/ofrohn/d3-celestial)
  by Olaf Frohn — BSD-3-Clause.
- **Planet & sky textures**: [Solar System Scope](https://www.solarsystemscope.com/textures/)
  — CC BY 4.0.
- **Ephemerides & event search**: [astronomy-engine](https://github.com/cosinekitty/astronomy)
  by Don Cross — MIT.
- Built with [three.js](https://threejs.org) and [Next.js](https://nextjs.org).
