# Cosmoscope — UI/UX Design System

## 1. Design principles
1. **The sky is the interface.** Chrome never competes with the scene: panels are
   translucent, blurred, and dismissible; the full viewport is always the simulation.
2. **Two verbs everywhere: *look* and *go*.** Every object offers "Find in sky"
   (surface) or "Fly to" (space). Mode determines the verb; the UI labels it.
3. **Progressive depth.** First glance: name + one-line wonder. One click: physical
   data. Curious: discovery history, missions, fun facts. (Maps to
   beginner/intermediate/advanced content levels.)
4. **Real time is sacred.** The clock readout is always visible; any time travel is
   one click from "Now".

## 2. Design tokens (implemented in `globals.css`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#05070f` | page/space background |
| `--panel` | `rgba(10,16,30,.88)` + blur 10px | all surfaces |
| `--panel-border` | `rgba(110,150,220,.18)` | hairlines |
| `--text` | `#d6e2f5` | primary text |
| `--text-dim` | `#8a9bb8` | secondary text |
| `--accent` | `#5b9dff` | actions, active states, section headers |
| `--accent-soft` | `rgba(91,157,255,.16)` | hover/active fills |
| radius | 8px (controls), 14px (panels), 999px (chips/search) | |
| type scale | 11/12/13/14/17/28 px; Inter/system | data uses tabular numerals |

Sky-label palette (CSS2D): stars `#b9c8e6` 10px · constellations `#46638f`
letter-spaced caps · bodies: each body's signature color · cardinals `#c98a4b` bold.

## 3. Layout grammar

```
┌──────────────────────────────────────────────────────────────┐
│ TopBar: brand · search · viewpoint chip · mode action · nav  │  ← gradient scrim
│                                                              │
│                      (the universe)                          │
│                                          ┌─────────────────┐ │
│                                          │ Context panel   │ │  ← one at a time:
│                                          │ (info/events/   │ │     info, events,
│                                          │  location/view/ │ │     location,
│                                          │  help)          │ │     settings, help
│                                          └─────────────────┘ │
│        TimeBar: ⏪ ⏸ ⏩ · rate · clock · date picker · Now     │  ← bottom center
└──────────────────────────────────────────────────────────────┘
```

- **One panel at a time** (`AppState.panel`) keeps the sky ≥60% visible at all sizes.
- Mobile (<700px): viewpoint chip collapses, panels go near-full-width, buttons keep
  44px touch targets, labels hide behind icons (<900px).

## 4. Key flows
- **Identify**: click object → info panel slides in → headline fact → stats →
  "Compared with Earth" → missions → "Did you know".
- **Travel**: search "Europa" → Enter → (space) swooping 2.6 s eased flight arriving
  over the day side / (surface) view rotates to it → "Stand on surface" → location
  presets (Tranquility Base, Jezero…) → surface mode with local sky.
- **Time travel**: Events panel lists computed eclipses/oppositions/showers →
  click → clock jumps, simulation pauses at the moment, observer optionally
  relocated to the eclipse track, view aimed at the Sun.
- **Telescope**: scroll on the sky narrows FOV continuously 100°→0.5° with the
  current FOV labeled (binoculars/telescope thresholds called out in settings).

## 5. Iconography & affordances
Emoji-glyph icons (🌍 🚀 📍 🗓 ⚙ ?) — zero icon-font weight, universally legible,
consistent with the "field guide" tone. Interactive sky elements get hover cursor
and 4px-slop click targets; drags >4px never trigger selection (implemented in the
engine's pointer handling).

## 6. Accessibility
- All controls are native `<button>/<input>/<select>` — keyboard and screen-reader
  reachable; panels are `<aside>` landmarks; labels use real text, not canvas.
- Color is never the only signal (labels accompany color-coded orbits).
- Contrast: text on panel ≥ 7:1; dim text ≥ 4.5:1.
- Motion: flights are short and eased; a "reduce motion" setting (roadmap) snaps
  instead of flying.
- i18n-ready: all UI strings centralizable; constellation dataset already carries
  10+ language name fields; `Intl` used for all date formatting.

## 7. Voice & content style
Wonder first, numbers second, jargon explained inline ("its day (243 Earth days) is
longer than its year"). Every body gets one "evil twin / fossil record / lava-lamp
glacier"-style hook sentence — that's the line users remember.
