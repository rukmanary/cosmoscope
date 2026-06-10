export type BodyType = "star" | "planet" | "dwarf planet" | "moon";

export interface RingDef {
  texture: string;
  innerKm: number;
  outerKm: number;
}

export interface AtmosphereDef {
  /** Sky tint at the surface (day), linear RGB 0..1. */
  skyColor: [number, number, number];
  /** Rim glow color seen from space. */
  rimColor: [number, number, number];
  /** 0..1: how bright the daytime sky gets (Earth=1, Mars≈0.25, Moon=0). */
  density: number;
  composition: string;
  surfacePressure: string;
}

export interface BodyFacts {
  description: string;
  discovery: string;
  composition: string;
  temperature: string;
  missions: string[];
  funFacts: string[];
}

export interface BodyDef {
  id: string;
  name: string;
  type: BodyType;
  /** Body this one orbits ("sun" for planets, planet id for moons). */
  parent: string | null;
  radiusKm: number;
  massKg: number;
  gravityMs2: number;
  /** Sidereal rotation period in hours (negative = retrograde). */
  dayHours: number;
  orbitDays: number;
  semiMajorAxisAu: number;
  eccentricity: number;
  axialTiltDeg: number;
  moonCount: number;
  /** Fallback color & marker/label tint (hex). */
  color: number;
  texture?: string;
  nightTexture?: string;
  cloudTexture?: string;
  ring?: RingDef;
  atmosphere?: AtmosphereDef;
  /** Can the observer stand on it? (gas giants: no) */
  landable: boolean;
  facts: BodyFacts;
}

export const KM_PER_AU = 149_597_870.7;

const T = (f: string) => `/textures/${f}`;

export const BODIES: BodyDef[] = [
  {
    id: "sun",
    name: "Sun",
    type: "star",
    parent: null,
    radiusKm: 695_700,
    massKg: 1.989e30,
    gravityMs2: 274,
    dayHours: 609.12,
    orbitDays: 0,
    semiMajorAxisAu: 0,
    eccentricity: 0,
    axialTiltDeg: 7.25,
    moonCount: 0,
    color: 0xffd27f,
    texture: T("2k_sun.jpg"),
    landable: false,
    facts: {
      description:
        "The Sun is a G2V main-sequence star containing 99.86% of the Solar System's mass. Nuclear fusion in its core converts about 600 million tonnes of hydrogen into helium every second, releasing the energy that powers life on Earth.",
      discovery: "Known since prehistory; first telescopic sunspot observations by Galileo and contemporaries in 1610.",
      composition: "≈73% hydrogen, 25% helium, 2% heavier elements (plasma)",
      temperature: "5,505 °C surface (photosphere); ~15,000,000 °C core",
      missions: ["Parker Solar Probe", "Solar Orbiter", "SOHO", "SDO", "Ulysses"],
      funFacts: [
        "Light from the Sun takes about 8 minutes 20 seconds to reach Earth.",
        "The Sun loses ~4.3 million tonnes of mass per second as radiated energy.",
        "Its corona is hundreds of times hotter than its surface — still an open research problem.",
      ],
    },
  },
  {
    id: "mercury",
    name: "Mercury",
    type: "planet",
    parent: "sun",
    radiusKm: 2_439.7,
    massKg: 3.301e23,
    gravityMs2: 3.7,
    dayHours: 1407.6,
    orbitDays: 87.97,
    semiMajorAxisAu: 0.387,
    eccentricity: 0.2056,
    axialTiltDeg: 0.03,
    moonCount: 0,
    color: 0x9c8e84,
    texture: T("2k_mercury.jpg"),
    landable: true,
    facts: {
      description:
        "Mercury is the smallest planet and the closest to the Sun. With almost no atmosphere, its surface swings through the most extreme temperature range of any planet, and it is saturated with impact craters much like the Moon.",
      discovery: "Known to ancient civilisations; earliest recorded observations from Assyrian astronomers ~14th century BCE.",
      composition: "Large iron core (~85% of radius), thin silicate mantle and crust",
      temperature: "−173 °C (night) to +427 °C (day)",
      missions: ["Mariner 10", "MESSENGER", "BepiColombo (en route)"],
      funFacts: [
        "A single Mercury day (sunrise to sunrise) lasts 176 Earth days — two Mercury years.",
        "Despite being closest to the Sun, Venus is hotter than Mercury.",
        "Water ice survives in permanently shadowed polar craters.",
      ],
    },
  },
  {
    id: "venus",
    name: "Venus",
    type: "planet",
    parent: "sun",
    radiusKm: 6_051.8,
    massKg: 4.867e24,
    gravityMs2: 8.87,
    dayHours: -5832.5,
    orbitDays: 224.7,
    semiMajorAxisAu: 0.723,
    eccentricity: 0.0068,
    axialTiltDeg: 177.4,
    moonCount: 0,
    color: 0xe8cda2,
    texture: T("2k_venus_atmosphere.jpg"),
    atmosphere: {
      skyColor: [0.9, 0.75, 0.45],
      rimColor: [0.95, 0.85, 0.6],
      density: 1,
      composition: "96.5% CO₂, 3.5% N₂, sulfuric acid clouds",
      surfacePressure: "9.2 MPa (92× Earth)",
    },
    landable: true,
    facts: {
      description:
        "Venus is Earth's 'evil twin': nearly the same size and mass, but wrapped in a crushing CO₂ atmosphere with a runaway greenhouse effect that makes it the hottest planet in the Solar System.",
      discovery: "Known to ancient civilisations as both the morning and evening star.",
      composition: "Rocky planet; iron core, silicate mantle, basaltic surface",
      temperature: "≈464 °C surface — hot enough to melt lead",
      missions: ["Venera program", "Magellan", "Venus Express", "Akatsuki", "DAVINCI / VERITAS (planned)"],
      funFacts: [
        "Venus rotates backwards: the Sun rises in the west and sets in the east.",
        "Its day (243 Earth days) is longer than its year (225 Earth days).",
        "Atmospheric pressure at the surface equals being ~900 m underwater on Earth.",
      ],
    },
  },
  {
    id: "earth",
    name: "Earth",
    type: "planet",
    parent: "sun",
    radiusKm: 6_371,
    massKg: 5.972e24,
    gravityMs2: 9.81,
    dayHours: 23.934,
    orbitDays: 365.25,
    semiMajorAxisAu: 1,
    eccentricity: 0.0167,
    axialTiltDeg: 23.44,
    moonCount: 1,
    color: 0x6b93d6,
    texture: T("2k_earth_daymap.jpg"),
    nightTexture: T("2k_earth_nightmap.jpg"),
    cloudTexture: T("2k_earth_clouds.jpg"),
    atmosphere: {
      skyColor: [0.3, 0.55, 1],
      rimColor: [0.35, 0.6, 1],
      density: 1,
      composition: "78% N₂, 21% O₂, 1% Ar, trace CO₂ & H₂O",
      surfacePressure: "101.3 kPa",
    },
    landable: true,
    facts: {
      description:
        "Earth is the only world known to harbour life. Liquid water covers 71% of its surface, plate tectonics recycle its crust, and a strong magnetic field shields its atmosphere from the solar wind.",
      discovery: "Recognised as a planet orbiting the Sun after the Copernican revolution (16th century).",
      composition: "Iron-nickel core, silicate mantle, thin crust; 71% surface water",
      temperature: "−89 °C to +57 °C (average ≈ 15 °C)",
      missions: ["Thousands of satellites; continuously observed from orbit since 1957"],
      funFacts: [
        "Earth is the densest planet in the Solar System.",
        "Days are lengthening ~1.8 ms per century as the Moon drains rotational energy.",
        "From the Moon, Earth shows phases just like the Moon does from Earth.",
      ],
    },
  },
  {
    id: "moon",
    name: "Moon",
    type: "moon",
    parent: "earth",
    radiusKm: 1_737.4,
    massKg: 7.342e22,
    gravityMs2: 1.62,
    dayHours: 655.7,
    orbitDays: 27.32,
    semiMajorAxisAu: 0.00257,
    eccentricity: 0.0549,
    axialTiltDeg: 6.68,
    moonCount: 0,
    color: 0xbdbdb4,
    texture: T("2k_moon.jpg"),
    landable: true,
    facts: {
      description:
        "The Moon is Earth's only natural satellite, likely born from debris of a Mars-sized impactor striking the young Earth. It is tidally locked, always showing the same face to Earth, and is the only other world humans have walked on.",
      discovery: "Known since prehistory; first telescopic maps by Galileo (1609) and Thomas Harriot.",
      composition: "Small iron core, silicate mantle, anorthosite highlands and basalt maria",
      temperature: "−173 °C (night) to +127 °C (day)",
      missions: ["Apollo 11–17", "Luna program", "Chang'e 1–6", "Chandrayaan", "Artemis (ongoing)"],
      funFacts: [
        "The Moon drifts ~3.8 cm farther from Earth every year.",
        "Twelve people have walked on its surface (1969–1972).",
        "Lunar 'seas' (maria) are ancient basalt lava plains, not water.",
      ],
    },
  },
  {
    id: "mars",
    name: "Mars",
    type: "planet",
    parent: "sun",
    radiusKm: 3_389.5,
    massKg: 6.417e23,
    gravityMs2: 3.71,
    dayHours: 24.62,
    orbitDays: 686.98,
    semiMajorAxisAu: 1.524,
    eccentricity: 0.0934,
    axialTiltDeg: 25.19,
    moonCount: 2,
    color: 0xc1623c,
    texture: T("2k_mars.jpg"),
    atmosphere: {
      skyColor: [0.85, 0.6, 0.4],
      rimColor: [0.8, 0.5, 0.4],
      density: 0.25,
      composition: "95% CO₂, 2.8% N₂, 2% Ar",
      surfacePressure: "0.6 kPa (0.6% of Earth)",
    },
    landable: true,
    facts: {
      description:
        "Mars, the Red Planet, hosts the largest volcano (Olympus Mons, 21 km high) and the deepest canyon system (Valles Marineris, 4,000 km long) in the Solar System. Ancient river valleys and lake beds show liquid water once flowed there.",
      discovery: "Known to ancient civilisations; first telescopic surface maps by Huygens (1659).",
      composition: "Iron core, basaltic mantle, iron-oxide dust giving the red colour",
      temperature: "−110 °C to +35 °C (average ≈ −60 °C)",
      missions: ["Viking 1 & 2", "Pathfinder", "Spirit & Opportunity", "Curiosity", "Perseverance & Ingenuity", "InSight", "Hope", "Tianwen-1"],
      funFacts: [
        "Sunsets on Mars are blue — fine dust scatters red light, leaving blue near the Sun.",
        "A Mars day ('sol') is 24h 37m, eerily close to Earth's.",
        "Its two tiny moons, Phobos and Deimos, may be captured asteroids.",
      ],
    },
  },
  {
    id: "jupiter",
    name: "Jupiter",
    type: "planet",
    parent: "sun",
    radiusKm: 69_911,
    massKg: 1.898e27,
    gravityMs2: 24.79,
    dayHours: 9.93,
    orbitDays: 4332.6,
    semiMajorAxisAu: 5.204,
    eccentricity: 0.0489,
    axialTiltDeg: 3.13,
    moonCount: 95,
    color: 0xd8b790,
    texture: T("2k_jupiter.jpg"),
    landable: false,
    facts: {
      description:
        "Jupiter is the largest planet — more than twice the mass of all other planets combined. Its Great Red Spot is a storm wider than Earth that has raged for at least 350 years, and its magnetosphere is the largest structure in the Solar System.",
      discovery: "Known to ancient civilisations; Galileo discovered its four large moons in 1610, the first objects seen orbiting another world.",
      composition: "≈90% hydrogen, 10% helium; likely a diffuse heavy-element core",
      temperature: "−108 °C at cloud tops",
      missions: ["Pioneer 10/11", "Voyager 1/2", "Galileo", "Juno", "Europa Clipper (en route)", "JUICE (en route)"],
      funFacts: [
        "Jupiter spins fastest of all planets: a day lasts under 10 hours.",
        "It acts as the Solar System's vacuum cleaner, deflecting comets and asteroids.",
        "If ~80× more massive, it would have ignited as a star.",
      ],
    },
  },
  {
    id: "io",
    name: "Io",
    type: "moon",
    parent: "jupiter",
    radiusKm: 1_821.6,
    massKg: 8.93e22,
    gravityMs2: 1.8,
    dayHours: 42.46,
    orbitDays: 1.77,
    semiMajorAxisAu: 0.00282,
    eccentricity: 0.0041,
    axialTiltDeg: 0,
    moonCount: 0,
    color: 0xd9c75a,
    landable: true,
    facts: {
      description:
        "Io is the most volcanically active world in the Solar System. Tidal flexing by Jupiter melts its interior, powering hundreds of volcanoes — some with plumes rising 500 km into space.",
      discovery: "Discovered by Galileo Galilei on 8 January 1610.",
      composition: "Silicate rock with iron core; sulfur-coated surface",
      temperature: "≈ −143 °C average; lava lakes exceed +1,300 °C",
      missions: ["Voyager 1/2", "Galileo", "Juno flybys"],
      funFacts: [
        "Io's surface is constantly repaved — it has essentially no impact craters.",
        "Its volcanic plumes paint the surface yellow, orange and red with sulfur.",
      ],
    },
  },
  {
    id: "europa",
    name: "Europa",
    type: "moon",
    parent: "jupiter",
    radiusKm: 1_560.8,
    massKg: 4.8e22,
    gravityMs2: 1.31,
    dayHours: 85.23,
    orbitDays: 3.55,
    semiMajorAxisAu: 0.00449,
    eccentricity: 0.009,
    axialTiltDeg: 0.1,
    moonCount: 0,
    color: 0xcdc4b2,
    landable: true,
    facts: {
      description:
        "Europa hides a global saltwater ocean beneath its cracked ice shell — likely containing twice the water of all Earth's oceans. It is one of the most promising places to search for life beyond Earth.",
      discovery: "Discovered by Galileo Galilei on 8 January 1610.",
      composition: "Ice shell (~15–25 km) over a ~60–150 km deep liquid ocean and rocky interior",
      temperature: "≈ −160 °C at the equator",
      missions: ["Voyager", "Galileo", "Europa Clipper (arriving 2030)", "JUICE"],
      funFacts: [
        "Its surface is among the smoothest in the Solar System — very few craters.",
        "Reddish-brown cracks may carry ocean salts to the surface.",
      ],
    },
  },
  {
    id: "ganymede",
    name: "Ganymede",
    type: "moon",
    parent: "jupiter",
    radiusKm: 2_634.1,
    massKg: 1.48e23,
    gravityMs2: 1.43,
    dayHours: 171.7,
    orbitDays: 7.15,
    semiMajorAxisAu: 0.00716,
    eccentricity: 0.0013,
    axialTiltDeg: 0.2,
    moonCount: 0,
    color: 0xa49a8c,
    landable: true,
    facts: {
      description:
        "Ganymede is the largest moon in the Solar System — bigger than the planet Mercury — and the only moon with its own magnetic field. It too likely hides a subsurface ocean.",
      discovery: "Discovered by Galileo Galilei on 7 January 1610.",
      composition: "Roughly equal parts silicate rock and water ice; iron core",
      temperature: "≈ −163 °C average",
      missions: ["Voyager", "Galileo", "JUICE (orbiting from 2034)"],
      funFacts: [
        "If it orbited the Sun instead of Jupiter, Ganymede would be classed as a planet.",
        "Aurorae in its thin oxygen atmosphere revealed its hidden ocean.",
      ],
    },
  },
  {
    id: "callisto",
    name: "Callisto",
    type: "moon",
    parent: "jupiter",
    radiusKm: 2_410.3,
    massKg: 1.08e23,
    gravityMs2: 1.24,
    dayHours: 400.5,
    orbitDays: 16.69,
    semiMajorAxisAu: 0.01258,
    eccentricity: 0.0074,
    axialTiltDeg: 0,
    moonCount: 0,
    color: 0x8a7f72,
    landable: true,
    facts: {
      description:
        "Callisto is the most heavily cratered object in the Solar System — its 4-billion-year-old surface is a fossil record of the early Solar System. It orbits outside Jupiter's worst radiation, making it a candidate site for future crewed bases.",
      discovery: "Discovered by Galileo Galilei on 7 January 1610.",
      composition: "Undifferentiated mix of rock and ice",
      temperature: "≈ −139 °C average",
      missions: ["Voyager", "Galileo", "JUICE flybys"],
      funFacts: [
        "Valhalla, its largest crater system, spans about 3,800 km.",
        "It is the third-largest moon in the Solar System.",
      ],
    },
  },
  {
    id: "saturn",
    name: "Saturn",
    type: "planet",
    parent: "sun",
    radiusKm: 58_232,
    massKg: 5.683e26,
    gravityMs2: 10.44,
    dayHours: 10.7,
    orbitDays: 10_759,
    semiMajorAxisAu: 9.583,
    eccentricity: 0.0565,
    axialTiltDeg: 26.73,
    moonCount: 274,
    color: 0xe3d2a8,
    texture: T("2k_saturn.jpg"),
    ring: { texture: T("2k_saturn_ring_alpha.png"), innerKm: 74_500, outerKm: 140_220 },
    landable: false,
    facts: {
      description:
        "Saturn is famous for the most spectacular ring system in the Solar System — billions of ice particles ranging from dust grains to house-sized boulders, yet on average only ~10 metres thick.",
      discovery: "Known to ancient civilisations; Galileo saw the rings (unresolved) in 1610, Huygens identified them as a ring in 1655.",
      composition: "≈96% hydrogen, 3% helium; less dense than water",
      temperature: "−139 °C at cloud tops",
      missions: ["Pioneer 11", "Voyager 1/2", "Cassini–Huygens (2004–2017)", "Dragonfly (to Titan, planned)"],
      funFacts: [
        "Saturn would float in a (very large) bathtub — its density is 0.69 g/cm³.",
        "A hexagonal jet stream circles its north pole.",
        "Its rings may largely disappear within ~100–300 million years.",
      ],
    },
  },
  {
    id: "uranus",
    name: "Uranus",
    type: "planet",
    parent: "sun",
    radiusKm: 25_362,
    massKg: 8.681e25,
    gravityMs2: 8.87,
    dayHours: -17.24,
    orbitDays: 30_687,
    semiMajorAxisAu: 19.19,
    eccentricity: 0.0463,
    axialTiltDeg: 97.77,
    moonCount: 28,
    color: 0x9fd6d2,
    texture: T("2k_uranus.jpg"),
    landable: false,
    facts: {
      description:
        "Uranus rolls around the Sun on its side — its axis is tilted 98°, probably from a giant ancient collision. Each pole gets 42 years of continuous sunlight followed by 42 years of darkness.",
      discovery: "Discovered by William Herschel on 13 March 1781 — the first planet found with a telescope.",
      composition: "Ices of water, methane and ammonia over a rocky core; H₂/He atmosphere with methane haze",
      temperature: "−197 °C at cloud tops — the coldest planetary atmosphere",
      missions: ["Voyager 2 (1986, only visit)", "Uranus Orbiter & Probe (recommended flagship)"],
      funFacts: [
        "Methane absorbs red light, giving Uranus its pale cyan colour.",
        "It radiates almost no internal heat, unlike the other giants.",
      ],
    },
  },
  {
    id: "neptune",
    name: "Neptune",
    type: "planet",
    parent: "sun",
    radiusKm: 24_622,
    massKg: 1.024e26,
    gravityMs2: 11.15,
    dayHours: 16.11,
    orbitDays: 60_190,
    semiMajorAxisAu: 30.07,
    eccentricity: 0.0086,
    axialTiltDeg: 28.32,
    moonCount: 16,
    color: 0x4f7df0,
    texture: T("2k_neptune.jpg"),
    landable: false,
    facts: {
      description:
        "Neptune, the outermost planet, was discovered by mathematics before observation — predicted from irregularities in Uranus's orbit. It hosts the fastest winds in the Solar System, over 2,000 km/h.",
      discovery: "Predicted by Urbain Le Verrier; observed by Johann Galle on 23 September 1846.",
      composition: "Water/ammonia/methane ices over rocky core; H₂/He/CH₄ atmosphere",
      temperature: "−201 °C at cloud tops",
      missions: ["Voyager 2 (1989, only visit)"],
      funFacts: [
        "One Neptune year is 165 Earth years — it has completed just one orbit since discovery.",
        "Its moon Triton orbits backwards and is likely a captured Kuiper Belt object.",
      ],
    },
  },
  {
    id: "pluto",
    name: "Pluto",
    type: "dwarf planet",
    parent: "sun",
    radiusKm: 1_188.3,
    massKg: 1.303e22,
    gravityMs2: 0.62,
    dayHours: -153.3,
    orbitDays: 90_560,
    semiMajorAxisAu: 39.48,
    eccentricity: 0.2488,
    axialTiltDeg: 122.5,
    moonCount: 5,
    color: 0xc9ad94,
    landable: true,
    facts: {
      description:
        "Pluto is the best-known dwarf planet, a complex world of nitrogen-ice glaciers, water-ice mountains and a thin hazy atmosphere. Its heart-shaped glacier, Sputnik Planitia, slowly churns like a lava lamp.",
      discovery: "Discovered by Clyde Tombaugh on 18 February 1930; reclassified as a dwarf planet in 2006.",
      composition: "Rocky core, water-ice mantle, surface of N₂, CH₄ and CO ices",
      temperature: "≈ −229 °C",
      missions: ["New Horizons (flyby, 14 July 2015)"],
      funFacts: [
        "Pluto and its moon Charon orbit a point outside Pluto — a true binary system.",
        "Its orbit is so eccentric it was closer to the Sun than Neptune from 1979–1999.",
        "Sunlight at Pluto is ~1,000× dimmer than on Earth, but still 250× brighter than full moonlight.",
      ],
    },
  },
];

export const bodyById = new Map(BODIES.map((b) => [b.id, b]));

export function radiusAu(b: BodyDef): number {
  return b.radiusKm / KM_PER_AU;
}
