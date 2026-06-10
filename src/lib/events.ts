import {
  AstroTime,
  Body,
  MakeTime,
  NextGlobalSolarEclipse,
  NextLunarEclipse,
  NextMoonQuarter,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
  SearchMaxElongation,
  SearchMoonQuarter,
  SearchRelativeLongitude,
  Seasons,
} from "astronomy-engine";

export interface AstroEvent {
  timeMs: number;
  title: string;
  description: string;
  icon: string;
  /** For solar eclipses: where to stand to see the peak. */
  observer?: { lat: number; lon: number };
}

const QUARTER_NAMES = ["New Moon", "First Quarter", "Full Moon", "Last Quarter"];
const QUARTER_ICONS = ["🌑", "🌓", "🌕", "🌗"];

/** Annual meteor showers (approximate peak dates). */
const METEOR_SHOWERS: { month: number; day: number; name: string; radiant: string; zhr: number }[] = [
  { month: 0, day: 3, name: "Quadrantids", radiant: "Boötes", zhr: 110 },
  { month: 3, day: 22, name: "Lyrids", radiant: "Lyra", zhr: 18 },
  { month: 4, day: 6, name: "Eta Aquariids", radiant: "Aquarius", zhr: 50 },
  { month: 7, day: 12, name: "Perseids", radiant: "Perseus", zhr: 100 },
  { month: 9, day: 21, name: "Orionids", radiant: "Orion", zhr: 20 },
  { month: 10, day: 17, name: "Leonids", radiant: "Leo", zhr: 15 },
  { month: 11, day: 14, name: "Geminids", radiant: "Gemini", zhr: 150 },
];

const OPPOSITION_PLANETS = [
  [Body.Mars, "Mars"],
  [Body.Jupiter, "Jupiter"],
  [Body.Saturn, "Saturn"],
] as const;

const INNER_PLANETS = [
  [Body.Mercury, "Mercury"],
  [Body.Venus, "Venus"],
] as const;

/**
 * astronomy-engine's root-finding searches can throw when no event exists in
 * their valid range (e.g. extreme simulation dates) — treat that as "no events".
 */
function safely(collect: () => AstroEvent[]): AstroEvent[] {
  try {
    return collect();
  } catch {
    return [];
  }
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function solarEclipseEvents(start: AstroTime, count: number): AstroEvent[] {
  const events: AstroEvent[] = [];
  let se = SearchGlobalSolarEclipse(start);
  for (let i = 0; i < count; i++) {
    const lat = se.latitude;
    const lon = se.longitude;
    const hasPeak =
      typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon);
    events.push({
      timeMs: se.peak.date.getTime(),
      title: `${capitalize(se.kind)} Solar Eclipse`,
      description: hasPeak
        ? `Peak visible near ${lat.toFixed(1)}°, ${lon.toFixed(1)}°. Click to jump there at totality.`
        : "Partial eclipse — the Moon's shadow grazes the Earth.",
      icon: "🌒",
      observer: hasPeak ? { lat, lon } : undefined,
    });
    se = NextGlobalSolarEclipse(se.peak);
  }
  return events;
}

function lunarEclipseEvents(start: AstroTime, count: number): AstroEvent[] {
  const events: AstroEvent[] = [];
  let le = SearchLunarEclipse(start);
  for (let i = 0; i < count; i++) {
    events.push({
      timeMs: le.peak.date.getTime(),
      title: `${capitalize(le.kind)} Lunar Eclipse`,
      description: "The Moon passes through Earth's shadow — visible from the entire night side of Earth.",
      icon: "🌘",
    });
    le = NextLunarEclipse(le.peak);
  }
  return events;
}

function moonQuarterEvents(start: AstroTime, count: number): AstroEvent[] {
  const events: AstroEvent[] = [];
  let mq = SearchMoonQuarter(start);
  for (let i = 0; i < count; i++) {
    events.push({
      timeMs: mq.time.date.getTime(),
      title: QUARTER_NAMES[mq.quarter],
      description: "Lunar phase",
      icon: QUARTER_ICONS[mq.quarter],
    });
    mq = NextMoonQuarter(mq);
  }
  return events;
}

function seasonEvents(fromMs: number, year: number): AstroEvent[] {
  const events: AstroEvent[] = [];
  for (const y of [year, year + 1]) {
    const ss = Seasons(y);
    const entries: [string, Date, string][] = [
      ["March Equinox", ss.mar_equinox.date, "🌱"],
      ["June Solstice", ss.jun_solstice.date, "☀️"],
      ["September Equinox", ss.sep_equinox.date, "🍂"],
      ["December Solstice", ss.dec_solstice.date, "❄️"],
    ];
    for (const [title, date, icon] of entries) {
      if (date.getTime() > fromMs) {
        events.push({ timeMs: date.getTime(), title, description: "Season marker (Earth)", icon });
      }
    }
  }
  return events;
}

/** Oppositions of the bright superior planets (best viewing). */
function oppositionEvents(start: AstroTime): AstroEvent[] {
  return OPPOSITION_PLANETS.flatMap(([body, name]) =>
    safely(() => {
      const t = SearchRelativeLongitude(body, 0, start);
      return [
        {
          timeMs: t.date.getTime(),
          title: `${name} at Opposition`,
          description: `${name} is opposite the Sun — closest, brightest, and visible all night.`,
          icon: "🪐",
        },
      ];
    })
  );
}

/** Greatest elongations of Mercury and Venus. */
function elongationEvents(start: AstroTime): AstroEvent[] {
  return INNER_PLANETS.flatMap(([body, name]) =>
    safely(() => {
      const el = SearchMaxElongation(body, start);
      const window = el.visibility === "morning" ? "before sunrise" : "after sunset";
      return [
        {
          timeMs: el.time.date.getTime(),
          title: `${name} Greatest Elongation`,
          description: `${name} reaches ${el.elongation.toFixed(1)}° from the Sun — best ${window}.`,
          icon: "✨",
        },
      ];
    })
  );
}

/** Annual meteor showers: the next occurrence of each within the coming year. */
function meteorShowerEvents(fromMs: number, year: number): AstroEvent[] {
  const events: AstroEvent[] = [];
  for (const ms of METEOR_SHOWERS) {
    const next = [year, year + 1]
      .map((y) => Date.UTC(y, ms.month, ms.day, 3, 0, 0))
      .find((t) => t > fromMs && t < fromMs + 370 * 86400e3);
    if (next !== undefined) {
      events.push({
        timeMs: next,
        title: `${ms.name} Meteor Shower`,
        description: `Radiant in ${ms.radiant}, up to ~${ms.zhr} meteors/hour under dark skies.`,
        icon: "☄️",
      });
    }
  }
  return events;
}

/**
 * Compute upcoming astronomical events after `fromMs`.
 * All searches use astronomy-engine's root-finding on real ephemerides.
 */
export function findUpcomingEvents(fromMs: number, limit = 18): AstroEvent[] {
  const start = MakeTime(new Date(fromMs));
  const year = new Date(fromMs).getUTCFullYear();

  const events = [
    ...safely(() => solarEclipseEvents(start, 2)),
    ...safely(() => lunarEclipseEvents(start, 2)),
    ...safely(() => moonQuarterEvents(start, 5)),
    ...seasonEvents(fromMs, year),
    ...oppositionEvents(start),
    ...elongationEvents(start),
    ...meteorShowerEvents(fromMs, year),
  ];

  return events
    .filter((e) => e.timeMs > fromMs)
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, limit);
}
