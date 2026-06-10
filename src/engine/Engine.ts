import * as THREE from "three";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { AstroTime } from "astronomy-engine";
import { store } from "@/lib/store";
import type { AppState, Selection, ViewMode } from "@/lib/store";
import { bodyById, radiusAu } from "@/lib/bodies";
import { Starfield, raDecToDir } from "./Starfield";
import { Constellations } from "./Constellations";
import { SolarSystem } from "./SolarSystem";
import { SkyDome } from "./SkyDome";
import { helioPosition, surfaceFrame, toAstroTime } from "./ephemeris";

declare global {
  // Debug / E2E handles, set while an Engine instance is alive.
  // `var` is required for ambient globalThis augmentation.
  var __cosmoEngine: Engine | undefined;
  var __cosmoStore: typeof store | undefined;
}

// Galactic → J2000 equatorial orientation (for the Milky Way backdrop).
const GALACTIC_CENTER = raDecToDir(266.405, -28.936);
const GALACTIC_NORTH = raDecToDir(192.8595, 27.1283);

const SURFACE: ViewMode = "surface";
const SPACE: ViewMode = "space";

/** Per-second rate at which the rendered FOV eases toward the requested FOV. */
const FOV_EASE = 9;

interface Flight {
  startMs: number;
  durationMs: number;
  fromPos: THREE.Vector3;
  toBodyId: string;
  endDistance: number;
}

/** Per-frame lighting/visibility context derived from the active camera mode. */
interface FrameContext {
  skyBrightness: number;
  hideBodyId: string | null;
  horizonUp: THREE.Vector3 | null;
}

type ObserverFrame = ReturnType<typeof surfaceFrame>;

export class Engine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly container: HTMLElement;

  private readonly starfield = new Starfield();
  private readonly constellations = new Constellations();
  private readonly solar = new SolarSystem();
  private readonly skyDome = new SkyDome();
  private readonly milkyWay: THREE.Mesh;

  /** Simulation clock, ms since Unix epoch (double precision). */
  private simMs = Date.now();
  private lastFrameMs = performance.now();
  private lastStoreSync = 0;

  /** Camera heliocentric position in AU — doubles, never written to GPU directly. */
  private readonly camPos = new THREE.Vector3();

  // Surface-mode look direction.
  private yaw = Math.PI; // azimuth from north, eastward (start looking south)
  private pitch = 0.3;
  /** Rendered FOV, eased toward the store's fovDeg for smooth zooming. */
  private smoothFov = 60;

  // Space-mode orbit rig.
  private orbitAz = 0.5;
  private orbitEl = 0.35;
  private orbitDist = 0.001; // AU
  private flight: Flight | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private pointerDown: { x: number; y: number; button: number } | null = null;
  private dragging = false;
  private disposed = false;
  private pendingFocus: Selection = null;
  private readonly resizeObs: ResizeObserver;
  /** Single switch that detaches every DOM listener this engine installed. */
  private readonly inputAbort = new AbortController();

  readonly ready: Promise<void>;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    this.labelRenderer.domElement.className = "label-layer";
    container.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      1e-9,
      4e7
    );
    this.camera.position.set(0, 0, 0);

    this.milkyWay = Engine.buildMilkyWay();
    this.scene.add(
      this.starfield.group,
      this.constellations.group,
      this.solar.group,
      this.skyDome.group,
      this.milkyWay
    );

    const s = store.get();
    this.orbitDist = radiusAu(bodyById.get(s.followBodyId)!) * 6;

    // Defer the catalog fetches so no async work starts inside the constructor,
    // while `ready` still settles only once loading actually finishes.
    this.ready = new Promise((resolve, reject) => {
      queueMicrotask(() => {
        this.loadCatalogs().then(resolve, reject);
      });
    });

    this.bindInput();
    this.resizeObs = new ResizeObserver(() => this.onResize());
    this.resizeObs.observe(container);

    // Debug / E2E handles.
    globalThis.__cosmoEngine = this;
    globalThis.__cosmoStore = store;

    this.renderer.setAnimationLoop(() => this.frame());
  }

  private async loadCatalogs(): Promise<void> {
    await Promise.all([this.starfield.load(), this.constellations.load()]);
  }

  // ----- public API (called from React UI) -----

  getTimeMs() {
    return this.simMs;
  }

  setTimeMs(ms: number) {
    this.simMs = ms;
    store.set({ simTimeMs: ms });
  }

  /** Switch to surface mode standing on a body at lat/lon. */
  setObserver(bodyId: string, lat: number, lon: number) {
    const def = bodyById.get(bodyId);
    if (!def?.landable) return;
    store.set({ mode: SURFACE, observer: { bodyId, lat, lon }, followBodyId: bodyId });
    this.flight = null;
    this.pitch = 0.3;
  }

  /** Lift off: switch to space mode orbiting the current body. */
  leaveSurface() {
    const s = store.get();
    const bodyId = s.mode === SURFACE ? s.observer.bodyId : s.followBodyId;
    const r = radiusAu(bodyById.get(bodyId)!);
    this.orbitDist = r * 5;
    store.set({ mode: SPACE, followBodyId: bodyId, telescope: false, tracking: null, fovDeg: 60 });
  }

  /** Fly the camera to another body (space mode). */
  goToBody(bodyId: string) {
    const def = bodyById.get(bodyId);
    if (!def) return;
    if (store.get().mode === SURFACE) {
      this.leaveSurface();
    }
    // Arrive over the day side: approach from the sunward direction.
    if (bodyId !== "sun") {
      const sunward = this.bodyPos(bodyId).clone().negate().normalize();
      this.orbitAz = Math.atan2(sunward.y, sunward.x);
      this.orbitEl = THREE.MathUtils.clamp(Math.asin(sunward.z), -1.2, 1.2);
    }
    this.flight = {
      startMs: performance.now(),
      durationMs: 2600,
      fromPos: this.camPos.clone(),
      toBodyId: bodyId,
      endDistance: radiusAu(def) * 5.5,
    };
    store.set({ mode: SPACE, followBodyId: bodyId, selection: { kind: "body", id: bodyId } });
  }

  /** Point the surface-mode view at a sky direction (RA/Dec in degrees). */
  pointAt(raDeg: number, decDeg: number) {
    this.pointAtDir(raDecToDir(raDeg, decDeg));
  }

  /** Point the surface-mode view along a world-space direction. */
  pointAtDir(dir: THREE.Vector3) {
    const s = store.get();
    if (s.mode !== SURFACE) return;
    const time = toAstroTime(this.simMs);
    const obs = s.observer;
    const def = bodyById.get(obs.bodyId)!;
    const frame = surfaceFrame(obs.bodyId, obs.lat, obs.lon, radiusAu(def), time);
    this.pitch = Math.asin(THREE.MathUtils.clamp(dir.dot(frame.up), -1, 1));
    this.yaw = Math.atan2(dir.dot(frame.east), dir.dot(frame.north));
  }

  private labelFor(sel: Selection): string {
    if (!sel) return "";
    if (sel.kind === "body") return bodyById.get(sel.id)?.name ?? sel.id;
    const cat = this.starfield.catalog;
    return cat?.names[sel.index] ?? cat?.bayer[sel.index] ?? "Star";
  }

  /** Lock the surface-mode camera onto an object: it stays centred as time runs. */
  trackSelection(sel: Selection) {
    if (!sel) return;
    const s = store.get();
    // Can't aim at the world you are standing on — its direction is straight
    // down (nadir), which has no defined azimuth and would spin the camera.
    if (s.mode === SURFACE && sel.kind === "body" && sel.id === s.observer.bodyId) return;
    store.set({ tracking: sel, trackingLabel: this.labelFor(sel) });
    this.pendingFocus = sel;
  }

  /** Bring the selected object into view: aim at it (surface) or fly to it (space). */
  focusSelection(sel: Selection) {
    if (!sel) return;
    if (store.get().mode === SURFACE) {
      // Aiming implies tracking; a manual drag releases the lock again.
      this.trackSelection(sel);
    } else if (sel.kind === "body") {
      this.goToBody(sel.id);
    }
  }

  /**
   * Eyepiece FOV that frames the target nicely: ~7× its angular diameter
   * (rings included), clamped to practical magnifications. Stars are point
   * sources at any magnification, so they get a wide-field default.
   */
  telescopeFovFor(sel: Selection): number {
    if (sel?.kind === "body") {
      const def = bodyById.get(sel.id);
      const node = this.solar.nodes.get(sel.id);
      if (def && node) {
        let apparentRadiusAu = radiusAu(def);
        if (def.ring) apparentRadiusAu *= def.ring.outerKm / def.radiusKm;
        const dist = node.pos.distanceTo(this.camPos);
        const angDeg = THREE.MathUtils.radToDeg(2 * Math.atan2(apparentRadiusAu, dist));
        return THREE.MathUtils.clamp(angDeg * 7, 0.03, 1.5);
      }
    }
    return 1.5;
  }

  /** World-space direction toward a selection, or null if unresolvable. */
  private directionTo(sel: Selection): THREE.Vector3 | null {
    if (!sel) return null;
    if (sel.kind === "body") {
      const node = this.solar.nodes.get(sel.id);
      if (!node) return null;
      return node.pos.clone().sub(this.camPos).normalize();
    }
    const cat = this.starfield.catalog;
    if (!cat) return null;
    return raDecToDir(cat.ra[sel.index], cat.dec[sel.index]);
  }

  private resolvePendingFocus() {
    const sel = this.pendingFocus;
    this.pendingFocus = null;
    if (!sel || store.get().mode !== SURFACE) return;
    const dir = this.directionTo(sel);
    if (dir) this.pointAtDir(dir);
  }

  getStarCatalog() {
    return this.starfield.catalog;
  }

  /**
   * Advance the simulation clock to the next local nightfall (Sun ≳12° below
   * the horizon) at the current surface location.
   */
  skipToNight() {
    const s = store.get();
    if (s.mode !== SURFACE) return;
    const obs = s.observer;
    const def = bodyById.get(obs.bodyId)!;
    const rAu = radiusAu(def);
    const dayMs = Math.abs(def.dayHours) * 3600e3;
    // Resolve the search step to the body's own day length (Venus days ≫ Earth days).
    const stepMs = Math.max(10 * 60e3, dayMs / 240);
    let t = this.simMs;
    for (let i = 0; i < 600; i++) {
      t += stepMs;
      const at = toAstroTime(t);
      const frame = surfaceFrame(obs.bodyId, obs.lat, obs.lon, rAu, at);
      const p = helioPosition(obs.bodyId, at);
      const r = Math.hypot(p.x, p.y, p.z);
      const sunAlt = -(p.x * frame.up.x + p.y * frame.up.y + p.z * frame.up.z) / r;
      if (sunAlt < -0.21) {
        this.setTimeMs(t);
        return;
      }
    }
    // Polar day etc.: no nightfall found within ~2.5 local days — leave time unchanged.
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObs.disconnect();
    this.inputAbort.abort();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
    globalThis.__cosmoEngine = undefined;
  }

  // ----- internals -----

  private static buildMilkyWay(): THREE.Mesh {
    const tex = new THREE.TextureLoader().load("/textures/2k_stars_milky_way.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.SphereGeometry(1.5e7, 48, 32);
    geo.rotateX(Math.PI / 2);
    geo.scale(-1, 1, 1); // view from inside without mirroring
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      depthTest: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -110;
    mesh.frustumCulled = false;
    const x = GALACTIC_CENTER.clone();
    const z = GALACTIC_NORTH.clone();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return mesh;
  }

  private bodyPos(id: string): THREE.Vector3 {
    return this.solar.nodes.get(id)!.pos;
  }

  /** Camera direction of the space-mode orbit rig. */
  private orbitDirection(): THREE.Vector3 {
    return new THREE.Vector3(
      Math.cos(this.orbitEl) * Math.cos(this.orbitAz),
      Math.cos(this.orbitEl) * Math.sin(this.orbitAz),
      Math.sin(this.orbitEl)
    );
  }

  private easeFov(targetFov: number, dt: number) {
    this.smoothFov += (targetFov - this.smoothFov) * Math.min(1, dt * FOV_EASE);
    this.camera.fov = this.smoothFov;
  }

  /** Keep the tracked object centred as time advances (surface mode). */
  private applyTrackingLock(s: AppState, frame: ObserverFrame) {
    if (!s.tracking) {
      if (s.trackedBelowHorizon) store.set({ trackedBelowHorizon: false });
      return;
    }
    const dir = this.directionTo(s.tracking);
    if (!dir) return;
    const maxPitch = Math.PI / 2 - 0.01; // avoid the lookAt singularity at zenith/nadir
    this.pitch = THREE.MathUtils.clamp(
      Math.asin(THREE.MathUtils.clamp(dir.dot(frame.up), -1, 1)),
      -maxPitch,
      maxPitch
    );
    const east = dir.dot(frame.east);
    const north = dir.dot(frame.north);
    // Near the nadir/zenith the azimuth is ill-defined and jitters wildly —
    // hold the previous heading instead of spinning.
    if (Math.hypot(east, north) > 1e-5) this.yaw = Math.atan2(east, north);
    const below = this.pitch < -0.015;
    if (below !== s.trackedBelowHorizon) store.set({ trackedBelowHorizon: below });
  }

  private updateSurfaceCamera(s: AppState, time: AstroTime, dt: number): FrameContext {
    const obs = s.observer;
    const def = bodyById.get(obs.bodyId)!;
    const frame = surfaceFrame(obs.bodyId, obs.lat, obs.lon, radiusAu(def) * 1.0000005, time);
    this.camPos.copy(this.bodyPos(obs.bodyId)).add(frame.offset);

    this.applyTrackingLock(s, frame);

    const look = new THREE.Vector3()
      .addScaledVector(frame.north, Math.cos(this.pitch) * Math.cos(this.yaw))
      .addScaledVector(frame.east, Math.cos(this.pitch) * Math.sin(this.yaw))
      .addScaledVector(frame.up, Math.sin(this.pitch));
    // Matrix4.lookAt builds +Z from target→eye; the camera faces −Z, so
    // passing the look direction as "target" makes the camera face along it.
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), look, frame.up);
    this.camera.quaternion.setFromRotationMatrix(m);

    const sunDir = this.bodyPos("sun").clone().sub(this.camPos).normalize();
    this.skyDome.setFrame(frame.east, frame.north, frame.up);
    this.skyDome.setVisible(true);
    const style = obs.bodyId === "earth" ? s.settings.landscape : "rock";
    const dome = this.skyDome.update(sunDir, frame.up, def.atmosphere, style, def.color, {
      atmosphere: s.settings.atmosphere,
      ground: s.settings.ground,
    });
    this.easeFov(s.fovDeg, dt);

    return {
      // City glow washes out the faintest stars even at night.
      skyBrightness: Math.max(dome.skyBrightness, dome.lightPollution * 0.45),
      hideBodyId: obs.bodyId,
      horizonUp: s.settings.ground ? frame.up : null,
    };
  }

  private updateSpaceCamera(s: AppState, nowMs: number, dt: number): FrameContext {
    this.skyDome.setVisible(false);

    if (this.flight) {
      const f = this.flight;
      const u = Math.min((nowMs - f.startMs) / f.durationMs, 1);
      const ease = u * u * (3 - 2 * u);
      const toPos = this.bodyPos(f.toBodyId);
      const endPos = toPos.clone().addScaledVector(this.orbitDirection(), f.endDistance);
      this.camPos.lerpVectors(f.fromPos, endPos, ease);
      this.camera.up.set(0, 0, 1);
      this.camera.lookAt(toPos.clone().sub(this.camPos));
      if (u >= 1) {
        this.flight = null;
        this.orbitDist = f.endDistance;
      }
    } else {
      const targetPos = this.bodyPos(s.followBodyId);
      this.camPos.copy(targetPos).addScaledVector(this.orbitDirection(), this.orbitDist);
      this.camera.up.set(0, 0, 1);
      this.camera.lookAt(targetPos.clone().sub(this.camPos));
    }
    this.easeFov(THREE.MathUtils.clamp(s.fovDeg, 30, 75), dt);

    return { skyBrightness: 0, hideBodyId: null, horizonUp: null };
  }

  private frame() {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameMs) / 1000, 0.25);
    this.lastFrameMs = now;

    const s = store.get();
    if (!s.paused) this.simMs += dt * 1000 * s.timeRate;
    if (now - this.lastStoreSync > 200) {
      store.set({ simTimeMs: this.simMs });
      this.lastStoreSync = now;
    }

    const time = toAstroTime(this.simMs);

    const ctx =
      s.mode === SURFACE
        ? this.updateSurfaceCamera(s, time, dt)
        : this.updateSpaceCamera(s, now, dt);
    this.camera.updateProjectionMatrix();

    // --- world updates (floating origin: everything camera-relative) ---
    this.solar.update(time, this.camPos, {
      showOrbits: s.settings.orbits && s.mode === SPACE,
      showLabels: s.settings.bodyLabels,
      hideBodyId: ctx.hideBodyId,
      skyBrightness: ctx.skyBrightness,
      horizonUp: ctx.horizonUp,
      fovDeg: this.smoothFov,
    });

    this.starfield.setSkyBrightness(ctx.skyBrightness);
    this.starfield.setLabelsVisible(s.settings.starLabels, ctx.skyBrightness, ctx.horizonUp);
    this.constellations.setVisible(
      s.settings.constellations,
      s.settings.constellationLabels,
      ctx.skyBrightness,
      ctx.horizonUp
    );
    this.milkyWay.visible = s.settings.milkyWay;
    (this.milkyWay.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - ctx.skyBrightness);

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    this.resolvePendingFocus();
  }

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.pointerDown) return;
    if (Math.abs(e.clientX - this.pointerDown.x) + Math.abs(e.clientY - this.pointerDown.y) > 4) {
      this.dragging = true;
    }
    if (!this.dragging) return;
    const s = store.get();
    if (s.mode === SURFACE) {
      if (s.tracking) store.set({ tracking: null, trackingLabel: "" }); // manual look releases the lock
      const scale = (s.fovDeg / 60) * 0.0028;
      // Drag left → view pans right ("grab the sky" feel); vertical unchanged.
      this.yaw -= e.movementX * scale;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + e.movementY * scale,
        -Math.PI / 2 + 0.01,
        Math.PI / 2 - 0.01
      );
    } else {
      this.orbitAz -= e.movementX * 0.005;
      this.orbitEl = THREE.MathUtils.clamp(this.orbitEl + e.movementY * 0.005, -1.45, 1.45);
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const s = store.get();
    if (s.mode === SURFACE) {
      // Telescope-style FOV zoom (0.03° ≈ 2000× magnification).
      const fov = THREE.MathUtils.clamp(s.fovDeg * Math.exp(e.deltaY * 0.0012), 0.03, 100);
      store.set({ fovDeg: fov });
    } else {
      const minDist = radiusAu(bodyById.get(s.followBodyId)!) * 1.6;
      this.orbitDist = THREE.MathUtils.clamp(this.orbitDist * Math.exp(e.deltaY * 0.0014), minDist, 120);
    }
  }

  private bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    const signal = this.inputAbort.signal;

    el.addEventListener(
      "pointerdown",
      (e) => {
        this.pointerDown = { x: e.clientX, y: e.clientY, button: e.button };
        this.dragging = false;
        el.setPointerCapture(e.pointerId);
      },
      { signal }
    );

    el.addEventListener("pointermove", (e) => this.onPointerMove(e), { signal });

    el.addEventListener(
      "pointerup",
      (e) => {
        const wasDrag = this.dragging;
        this.pointerDown = null;
        this.dragging = false;
        if (!wasDrag && e.button === 0) this.pick(e.clientX, e.clientY);
      },
      { signal }
    );

    el.addEventListener("wheel", (e) => this.onWheel(e), { passive: false, signal });

    globalThis.addEventListener(
      "keydown",
      (e) => {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (e.code === "Space") {
          e.preventDefault();
          store.set({ paused: !store.get().paused });
        }
      },
      { signal }
    );
  }

  private pick(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    const s = store.get();
    const select = (sel: Selection) => {
      store.set({ selection: sel, panel: "info" });
      // Clicking a sky object in surface mode locks the camera onto it.
      if (s.mode === SURFACE && sel) {
        store.set({ tracking: sel, trackingLabel: this.labelFor(sel) });
      }
    };

    const hits = this.raycaster.intersectObjects(this.solar.pickables, false);
    for (const hit of hits) {
      if (!hit.object.visible) continue; // e.g. the hidden mesh of the world we stand on
      const id = hit.object.userData.bodyId as string | undefined;
      if (id && !(s.mode === SURFACE && id === s.observer.bodyId)) {
        select({ kind: "body", id });
        return;
      }
    }

    // Narrower FOV (telescope zoom) demands proportionally finer star picking.
    const pickAngle = Math.max(0.0015, 0.012 * (s.fovDeg / 60));
    const starIdx = this.starfield.pick(this.raycaster.ray.direction, pickAngle);
    if (starIdx >= 0) {
      select({ kind: "star", index: starIdx });
      return;
    }
    store.set({ selection: null });
  }
}

/** Singleton handle so React components can issue engine commands. */
export const engineRef: { current: Engine | null } = { current: null };
