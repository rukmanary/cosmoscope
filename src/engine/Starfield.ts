import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/** Stars are placed on a sphere of this radius (AU) — effectively at infinity. */
export const STAR_SPHERE_AU = 1e7;

export interface StarCatalog {
  count: number;
  ra: number[]; // degrees
  dec: number[]; // degrees
  mag: number[];
  ci: number[]; // B−V
  dist: number[]; // parsecs
  names: Record<string, string>;
  bayer: Record<string, string>;
}

/** Approximate RGB for a star of a given B−V colour index. */
export function bvToColor(bv: number): THREE.Color {
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)); // Kelvin
  // Compact blackbody → sRGB approximation.
  let r: number, g: number, b: number;
  const tk = THREE.MathUtils.clamp(t, 1000, 40000) / 100;
  if (tk <= 66) {
    r = 1;
    g = THREE.MathUtils.clamp((99.47 * Math.log(tk) - 161.12) / 255, 0, 1);
  } else {
    r = THREE.MathUtils.clamp((329.7 * Math.pow(tk - 60, -0.1332)) / 255, 0, 1);
    g = THREE.MathUtils.clamp((288.12 * Math.pow(tk - 60, -0.0755)) / 255, 0, 1);
  }
  if (tk >= 66) b = 1;
  else if (tk <= 19) b = 0;
  else b = THREE.MathUtils.clamp((138.52 * Math.log(tk - 10) - 305.04) / 255, 0, 1);
  return new THREE.Color(r, g, b);
}

export function raDecToDir(raDeg: number, decDeg: number, out = new THREE.Vector3()): THREE.Vector3 {
  const ra = THREE.MathUtils.degToRad(raDeg);
  const dec = THREE.MathUtils.degToRad(decDeg);
  return out.set(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec));
}

const VERT = /* glsl */ `
  attribute float aMag;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uPixelRatio;
  uniform float uSkyBrightness; // 0 = night sky, 1 = full daylight (stars washed out)
  void main() {
    vColor = aColor;
    // Brightness-to-size: each magnitude step ≈ ×0.72 in apparent size.
    float size = uPixelRatio * 10.5 * pow(10.0, -0.13 * aMag);
    gl_PointSize = clamp(size, 1.3, 20.0 * uPixelRatio);
    // Fainter stars fade first as the sky brightens.
    float visLimit = mix(6.8, -1.0, uSkyBrightness);
    vAlpha = clamp((visLimit - aMag) * 0.95, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    float falloff = smoothstep(1.0, 0.25, r);
    if (falloff < 0.01 || vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, vAlpha * falloff);
  }
`;

export class Starfield {
  readonly group = new THREE.Group();
  catalog: StarCatalog | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private dirs: Float32Array | null = null; // unit vectors, for picking
  private readonly labels: CSS2DObject[] = [];

  async load(): Promise<void> {
    const res = await fetch("/data/stars.json");
    const cat: StarCatalog = await res.json();
    this.catalog = cat;

    const positions = new Float32Array(cat.count * 3);
    const dirs = new Float32Array(cat.count * 3);
    const colors = new Float32Array(cat.count * 3);
    const mags = new Float32Array(cat.count);
    const dir = new THREE.Vector3();
    for (let i = 0; i < cat.count; i++) {
      raDecToDir(cat.ra[i], cat.dec[i], dir);
      dirs[i * 3] = dir.x;
      dirs[i * 3 + 1] = dir.y;
      dirs[i * 3 + 2] = dir.z;
      positions[i * 3] = dir.x * STAR_SPHERE_AU;
      positions[i * 3 + 1] = dir.y * STAR_SPHERE_AU;
      positions[i * 3 + 2] = dir.z * STAR_SPHERE_AU;
      const c = bvToColor(cat.ci[i]);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      mags[i] = cat.mag[i];
    }
    this.dirs = dirs;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aMag", new THREE.BufferAttribute(mags, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uPixelRatio: { value: globalThis.devicePixelRatio ?? 1 },
        uSkyBrightness: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true, // planets (opaque, depth-written) must occlude stars
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, this.material);
    points.frustumCulled = false;
    points.renderOrder = -90;
    this.group.add(points);

    this.buildLabels(cat);
  }

  private buildLabels(cat: StarCatalog) {
    // Label the brightest named stars only.
    const named = Object.entries(cat.names)
      .map(([idx, name]) => ({ i: Number(idx), name }))
      .sort((a, b) => cat.mag[a.i] - cat.mag[b.i])
      .slice(0, 60);
    const dir = new THREE.Vector3();
    for (const { i, name } of named) {
      const el = document.createElement("div");
      el.className = "sky-label star-label";
      el.textContent = name;
      const label = new CSS2DObject(el);
      raDecToDir(cat.ra[i], cat.dec[i], dir);
      label.position.copy(dir).multiplyScalar(STAR_SPHERE_AU);
      this.group.add(label);
      this.labels.push(label);
    }
  }

  setSkyBrightness(v: number) {
    if (this.material) this.material.uniforms.uSkyBrightness.value = v;
  }

  /**
   * CSS2D labels are HTML and ignore WebGL occlusion, so they must be culled
   * manually: hidden in daylight and (surface mode) below the local horizon.
   */
  setLabelsVisible(visible: boolean, skyBrightness: number, horizonUp: THREE.Vector3 | null) {
    const show = visible && skyBrightness < 0.5;
    const tmp = new THREE.Vector3();
    for (const l of this.labels) {
      let v = show;
      if (v && horizonUp) {
        v = tmp.copy(l.position).normalize().dot(horizonUp) > -0.03;
      }
      l.visible = v;
    }
  }

  /**
   * Find the star nearest to a clicked ray (within maxAngleRad).
   * Returns the catalog index or -1.
   */
  pick(rayDir: THREE.Vector3, maxAngleRad = 0.012): number {
    if (!this.dirs || !this.catalog) return -1;
    let best = -1;
    let bestScore = Infinity;
    const cosMax = Math.cos(maxAngleRad);
    for (let i = 0; i < this.catalog.count; i++) {
      const dot =
        rayDir.x * this.dirs[i * 3] + rayDir.y * this.dirs[i * 3 + 1] + rayDir.z * this.dirs[i * 3 + 2];
      if (dot > cosMax) {
        // Prefer brighter stars when several fall inside the cone.
        const ang = Math.acos(Math.min(1, dot));
        const score = ang * (1 + Math.max(0, this.catalog.mag[i]) * 0.35);
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
    }
    return best;
  }
}
