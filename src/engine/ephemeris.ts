/**
 * Ephemeris layer: wraps astronomy-engine (VSOP87 / ELP2000-based models)
 * to provide heliocentric positions (AU, J2000 equatorial frame "EQJ")
 * and rotational orientations for all simulated bodies.
 *
 * All positions are double precision; the renderer subtracts the camera
 * position before anything touches a float32 GPU buffer (floating origin).
 */
import {
  AstroTime,
  Body,
  GeoMoon,
  GeoMoonState,
  HelioVector,
  JupiterMoons,
  MakeTime,
  RotationAxis,
  StateVector,
} from "astronomy-engine";
import * as THREE from "three";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const PLANET_BODY: Record<string, Body> = {
  sun: Body.Sun,
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  moon: Body.Moon,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

const JUPITER_MOON_IDS = ["io", "europa", "ganymede", "callisto"] as const;

export function toAstroTime(msSinceEpoch: number): AstroTime {
  return MakeTime(new Date(msSinceEpoch));
}

// JupiterMoons is comparatively expensive; cache per timestamp.
let jmCacheUt = Number.NaN;
let jmCache: { io: StateVector; europa: StateVector; ganymede: StateVector; callisto: StateVector } | null = null;

function jupiterMoonsAt(time: AstroTime) {
  if (time.ut !== jmCacheUt || !jmCache) {
    jmCache = JupiterMoons(time);
    jmCacheUt = time.ut;
  }
  return jmCache;
}

/** Heliocentric position of any simulated body, in AU, EQJ frame. */
export function helioPosition(id: string, time: AstroTime): Vec3 {
  if (id === "sun") return { x: 0, y: 0, z: 0 };
  if (id === "moon") {
    const e = HelioVector(Body.Earth, time);
    const m = GeoMoon(time);
    return { x: e.x + m.x, y: e.y + m.y, z: e.z + m.z };
  }
  if ((JUPITER_MOON_IDS as readonly string[]).includes(id)) {
    const j = HelioVector(Body.Jupiter, time);
    const sv = jupiterMoonsAt(time)[id as (typeof JUPITER_MOON_IDS)[number]];
    return { x: j.x + sv.x, y: j.y + sv.y, z: j.z + sv.z };
  }
  const body = PLANET_BODY[id];
  if (body === undefined) throw new Error(`Unknown body: ${id}`);
  const v = HelioVector(body, time);
  return { x: v.x, y: v.y, z: v.z };
}

/** Position + velocity relative to the parent body (for instantaneous orbit rings). */
export function relativeState(id: string, time: AstroTime): { pos: Vec3; vel: Vec3 } | null {
  if (id === "moon") {
    const sv = GeoMoonState(time);
    return { pos: { x: sv.x, y: sv.y, z: sv.z }, vel: { x: sv.vx, y: sv.vy, z: sv.vz } };
  }
  if ((JUPITER_MOON_IDS as readonly string[]).includes(id)) {
    const sv = jupiterMoonsAt(time)[id as (typeof JUPITER_MOON_IDS)[number]];
    return { pos: { x: sv.x, y: sv.y, z: sv.z }, vel: { x: sv.vx, y: sv.vy, z: sv.vz } };
  }
  return null;
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/**
 * Orientation quaternion mapping body-fixed frame -> EQJ world frame.
 * Body frame: +Z = north pole, +X = prime meridian, east longitudes CCW.
 * Uses IAU rotation models via astronomy-engine where available; the
 * Galilean moons fall back to a tidally-locked approximation.
 */
export function bodyOrientation(id: string, time: AstroTime): THREE.Quaternion {
  if ((JUPITER_MOON_IDS as readonly string[]).includes(id)) {
    return tidallyLockedOrientation(id, time);
  }
  const body = PLANET_BODY[id];
  const axis = RotationAxis(body, time);
  const north = new THREE.Vector3(axis.north.x, axis.north.y, axis.north.z).normalize();
  return orientationFromPoleAndSpin(north, axis.spin);
}

function orientationFromPoleAndSpin(north: THREE.Vector3, spinDeg: number): THREE.Quaternion {
  // Ascending node of the body's equator on the ICRF equator.
  const node = new THREE.Vector3().crossVectors(Z_AXIS, north);
  if (node.lengthSq() < 1e-12) node.set(1, 0, 0);
  node.normalize();
  // Prime meridian direction: node rotated about the pole by the spin angle.
  const spin = THREE.MathUtils.degToRad(spinDeg);
  const xAxis = node.clone().applyAxisAngle(north, spin);
  const yAxis = new THREE.Vector3().crossVectors(north, xAxis);
  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, north);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function tidallyLockedOrientation(id: string, time: AstroTime): THREE.Quaternion {
  const jup = RotationAxis(Body.Jupiter, time);
  const north = new THREE.Vector3(jup.north.x, jup.north.y, jup.north.z).normalize();
  const st = relativeState(id, time)!;
  // Prime meridian faces the parent planet (sub-Jupiter point at lon 0).
  const toPlanet = new THREE.Vector3(-st.pos.x, -st.pos.y, -st.pos.z);
  toPlanet.addScaledVector(north, -toPlanet.dot(north)).normalize();
  const yAxis = new THREE.Vector3().crossVectors(north, toPlanet);
  const m = new THREE.Matrix4().makeBasis(toPlanet, yAxis, north);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/**
 * Local geodetic frame for an observer at lat/lon on a body's surface.
 * Returns unit vectors (EQJ frame) and the surface position offset from
 * the body centre, in AU.
 */
export function surfaceFrame(
  id: string,
  latDeg: number,
  lonDeg: number,
  radiusAu: number,
  time: AstroTime
): { offset: THREE.Vector3; up: THREE.Vector3; north: THREE.Vector3; east: THREE.Vector3 } {
  const q = bodyOrientation(id, time);
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const cl = Math.cos(lat);
  const up = new THREE.Vector3(cl * Math.cos(lon), cl * Math.sin(lon), Math.sin(lat)).applyQuaternion(q);
  const north = new THREE.Vector3(
    -Math.sin(lat) * Math.cos(lon),
    -Math.sin(lat) * Math.sin(lon),
    Math.cos(lat)
  ).applyQuaternion(q);
  const east = new THREE.Vector3(-Math.sin(lon), Math.cos(lon), 0).applyQuaternion(q);
  return { offset: up.clone().multiplyScalar(radiusAu), up, north, east };
}
