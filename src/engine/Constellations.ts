import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { raDecToDir, STAR_SPHERE_AU } from "./Starfield";

interface ConstellationData {
  id: string;
  name: string;
  gen: string;
  label: [number, number] | null;
  lines: [number, number][][];
}

/** Slightly inside the star sphere so lines never occlude stars. */
const LINE_RADIUS = STAR_SPHERE_AU * 0.98;

export class Constellations {
  readonly group = new THREE.Group();
  private lines: THREE.LineSegments | null = null;
  private readonly labels: CSS2DObject[] = [];
  private readonly material = new THREE.LineBasicMaterial({
    color: 0x3a5a8c,
    transparent: true,
    opacity: 0.55,
    depthTest: true,
    depthWrite: false,
  });
  data: ConstellationData[] = [];

  async load(): Promise<void> {
    const res = await fetch("/data/constellations.json");
    this.data = (await res.json()) as ConstellationData[];

    const verts: number[] = [];
    const dir = new THREE.Vector3();
    for (const con of this.data) {
      for (const poly of con.lines) {
        for (let i = 0; i < poly.length - 1; i++) {
          // Subdivide each segment so lines follow great circles.
          const a = raDecToDir(poly[i][0], poly[i][1], new THREE.Vector3());
          const b = raDecToDir(poly[i + 1][0], poly[i + 1][1], new THREE.Vector3());
          const STEPS = 6;
          let prev = a;
          for (let s = 1; s <= STEPS; s++) {
            const cur = prev.clone().lerp(b, s / (STEPS - s + 1)).normalize();
            verts.push(
              prev.x * LINE_RADIUS, prev.y * LINE_RADIUS, prev.z * LINE_RADIUS,
              cur.x * LINE_RADIUS, cur.y * LINE_RADIUS, cur.z * LINE_RADIUS
            );
            prev = cur;
          }
        }
      }
      if (con.label) {
        const el = document.createElement("div");
        el.className = "sky-label constellation-label";
        el.textContent = con.name;
        const label = new CSS2DObject(el);
        raDecToDir(con.label[0], con.label[1], dir);
        label.position.copy(dir).multiplyScalar(LINE_RADIUS);
        this.group.add(label);
        this.labels.push(label);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = -95;
    this.group.add(this.lines);
  }

  setVisible(lines: boolean, labels: boolean, skyBrightness: number, horizonUp: THREE.Vector3 | null) {
    const dim = 1 - skyBrightness;
    this.material.opacity = 0.55 * dim;
    if (this.lines) this.lines.visible = lines && dim > 0.1;
    const show = labels && lines && dim > 0.1;
    const tmp = new THREE.Vector3();
    for (const l of this.labels) {
      let v = show;
      if (v && horizonUp) {
        // HTML labels ignore WebGL occlusion — cull below the local horizon.
        v = tmp.copy(l.position).normalize().dot(horizonUp) > -0.03;
      }
      l.visible = v;
    }
  }
}
