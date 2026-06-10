import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { AstroTime } from "astronomy-engine";
import { BODIES, BodyDef, KM_PER_AU, radiusAu } from "@/lib/bodies";
import { helioPosition, relativeState, bodyOrientation, toAstroTime } from "./ephemeris";

const MARKER_ANGULAR_LIMIT = 0.004; // rad: below this, show a dot marker instead of pixels
const CLOUD_DRIFT_AXIS = new THREE.Vector3(0, 0, 1);

export interface SolarUpdateOptions {
  showOrbits: boolean;
  showLabels: boolean;
  hideBodyId: string | null;
  skyBrightness: number;
  horizonUp: THREE.Vector3 | null;
  fovDeg: number;
}

const NIGHT_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NIGHT_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uSunDir;
  varying vec3 vNormalW;
  varying vec2 vUv;
  void main() {
    float night = smoothstep(0.08, -0.12, dot(vNormalW, uSunDir));
    vec3 c = texture2D(uMap, vUv).rgb;
    gl_FragColor = vec4(c * night * 1.2, 1.0);
  }
`;

const RIM_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vPosW);
    float rim = pow(1.0 - clamp(dot(vNormalW, viewDir), 0.0, 1.0), 2.6);
    float lit = clamp(dot(vNormalW, uSunDir), 0.0, 1.0) * 0.85 + 0.15;
    gl_FragColor = vec4(uColor, 1.0) * rim * lit * 0.9;
  }
`;

function makeDotTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

interface BodyNode {
  def: BodyDef;
  /** Heliocentric position in AU (double precision). */
  pos: THREE.Vector3;
  anchor: THREE.Group; // positioned camera-relative each frame
  mesh: THREE.Mesh;
  clouds?: THREE.Mesh;
  night?: THREE.Mesh;
  rim?: THREE.Mesh;
  ring?: THREE.Mesh;
  marker: THREE.Sprite;
  glow?: THREE.Sprite;
  label: CSS2DObject;
  orbitLine?: THREE.Line;
  orbitIsHelio: boolean;
}

export class SolarSystem {
  readonly group = new THREE.Group();
  readonly nodes = new Map<string, BodyNode>();
  readonly sunLight = new THREE.PointLight(0xfff5e8, 3.2, 0, 0);
  private readonly texLoader = new THREE.TextureLoader();
  private readonly dotTex: THREE.Texture;
  private readonly nightMaterials: THREE.ShaderMaterial[] = [];
  private readonly rimMaterials: THREE.ShaderMaterial[] = [];
  /** Sphere geometry with pole on +Z, prime meridian on +X (matches ephemeris body frame). */
  private readonly sphereGeo: THREE.SphereGeometry;

  constructor() {
    this.dotTex = makeDotTexture();
    this.sphereGeo = new THREE.SphereGeometry(1, 64, 48);
    this.sphereGeo.rotateX(Math.PI / 2);
    this.group.add(this.sunLight);
    this.group.add(new THREE.AmbientLight(0xffffff, 0.06));
    for (const def of BODIES) this.nodes.set(def.id, this.buildBody(def));
    this.buildPlanetOrbits();
  }

  private loadTex(url: string): THREE.Texture {
    const t = this.texLoader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  private buildBody(def: BodyDef): BodyNode {
    const anchor = new THREE.Group();
    this.group.add(anchor);
    const rAu = radiusAu(def);

    let material: THREE.Material;
    if (def.id === "sun") {
      material = new THREE.MeshBasicMaterial({ map: def.texture ? this.loadTex(def.texture) : null });
    } else {
      material = new THREE.MeshStandardMaterial({
        map: def.texture ? this.loadTex(def.texture) : null,
        color: def.texture ? 0xffffff : def.color,
        roughness: 1,
        metalness: 0,
      });
    }
    const mesh = new THREE.Mesh(this.sphereGeo, material);
    mesh.scale.setScalar(rAu);
    mesh.userData.bodyId = def.id;
    anchor.add(mesh);

    const node: BodyNode = {
      def,
      pos: new THREE.Vector3(),
      anchor,
      mesh,
      marker: this.buildMarker(def, anchor),
      label: this.buildLabel(def, anchor),
      orbitIsHelio: def.parent === "sun",
    };

    if (def.nightTexture) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: NIGHT_VERT,
        fragmentShader: NIGHT_FRAG,
        uniforms: { uMap: { value: this.loadTex(def.nightTexture) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) } },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      this.nightMaterials.push(mat);
      node.night = new THREE.Mesh(this.sphereGeo, mat);
      node.night.scale.setScalar(rAu * 1.001);
      anchor.add(node.night);
    }

    if (def.cloudTexture) {
      const mat = new THREE.MeshLambertMaterial({
        map: this.loadTex(def.cloudTexture),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      node.clouds = new THREE.Mesh(this.sphereGeo, mat);
      node.clouds.scale.setScalar(rAu * 1.004);
      anchor.add(node.clouds);
    }

    if (def.atmosphere) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: RIM_VERT,
        fragmentShader: RIM_FRAG,
        uniforms: {
          uColor: { value: new THREE.Vector3(...def.atmosphere.rimColor) },
          uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      this.rimMaterials.push(mat);
      node.rim = new THREE.Mesh(this.sphereGeo, mat);
      node.rim.scale.setScalar(rAu * 1.022);
      anchor.add(node.rim);
    }

    if (def.ring) {
      const inner = def.ring.innerKm / KM_PER_AU;
      const outer = def.ring.outerKm / KM_PER_AU;
      const geo = new THREE.RingGeometry(inner, outer, 128, 1);
      // Remap UVs radially so the ring strip texture reads inner→outer.
      const posAttr = geo.attributes.position;
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        const r = Math.hypot(posAttr.getX(i), posAttr.getY(i));
        uv.setXY(i, (r - inner) / (outer - inner), 0.5);
      }
      const mat = new THREE.MeshBasicMaterial({
        map: this.loadTex(def.ring.texture),
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        color: 0xddd8cc,
      });
      node.ring = new THREE.Mesh(geo, mat);
      anchor.add(node.ring);
    }

    if (def.id === "sun") {
      const glowMat = new THREE.SpriteMaterial({
        map: this.dotTex,
        color: 0xffe9c4,
        sizeAttenuation: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });
      node.glow = new THREE.Sprite(glowMat);
      node.glow.scale.set(0.09, 0.09, 1);
      node.glow.renderOrder = -10;
      anchor.add(node.glow);
    }

    return node;
  }

  private buildMarker(def: BodyDef, anchor: THREE.Group): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      map: this.dotTex,
      color: def.color,
      sizeAttenuation: false,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    let s = 0.013;
    if (def.type === "star") {
      s = 0.03;
    } else if (def.type === "moon") {
      s = 0.008;
    }
    sprite.scale.set(s, s, 1);
    sprite.renderOrder = -5;
    sprite.userData.bodyId = def.id;
    sprite.userData.baseScale = s; // rescaled per-frame against the camera FOV
    anchor.add(sprite);
    return sprite;
  }

  private buildLabel(def: BodyDef, anchor: THREE.Group): CSS2DObject {
    const el = document.createElement("div");
    el.className = `sky-label body-label body-${def.type.replace(" ", "-")}`;
    el.textContent = def.name;
    el.style.color = `#${new THREE.Color(def.color).getHexString()}`;
    const label = new CSS2DObject(el);
    label.center.set(0.5, 1.6);
    anchor.add(label);
    return label;
  }

  private buildPlanetOrbits() {
    const time = toAstroTime(Date.now());
    for (const node of this.nodes.values()) {
      const { def } = node;
      if (def.parent !== "sun" || def.orbitDays <= 0) continue;
      const N = 256;
      const verts = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const t = time.AddDays((i / N) * def.orbitDays);
        const p = helioPosition(def.id, t);
        verts[i * 3] = p.x;
        verts[i * 3 + 1] = p.y;
        verts[i * 3 + 2] = p.z;
      }
      node.orbitLine = this.makeOrbitLine(verts, def.color);
    }
    // Moons get instantaneous orbit rings, rebuilt continuously in update().
    for (const node of this.nodes.values()) {
      if (node.def.parent && node.def.parent !== "sun") {
        node.orbitLine = this.makeOrbitLine(new Float32Array(128 * 3), node.def.color);
        node.orbitIsHelio = false;
      }
    }
  }

  private makeOrbitLine(verts: Float32Array, color: number): THREE.Line {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.32 });
    const line = new THREE.LineLoop(geo, mat);
    line.frustumCulled = false;
    this.group.add(line);
    return line;
  }

  private updateMoonOrbit(node: BodyNode, time: AstroTime, parentPos: THREE.Vector3, camPos: THREE.Vector3) {
    const st = relativeState(node.def.id, time);
    const line = node.orbitLine;
    if (!st || !line) return;
    const r = new THREE.Vector3(st.pos.x, st.pos.y, st.pos.z);
    const v = new THREE.Vector3(st.vel.x, st.vel.y, st.vel.z);
    const h = new THREE.Vector3().crossVectors(r, v);
    const e1 = r.clone().normalize();
    const e2 = new THREE.Vector3().crossVectors(h, r).normalize();
    const radius = r.length();
    const attr = line.geometry.attributes.position as THREE.BufferAttribute;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = radius * (e1.x * Math.cos(a) + e2.x * Math.sin(a));
      const y = radius * (e1.y * Math.cos(a) + e2.y * Math.sin(a));
      const z = radius * (e1.z * Math.cos(a) + e2.z * Math.sin(a));
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
    line.position.copy(parentPos).sub(camPos);
  }

  /** Set visibility on every provided object, skipping absent optional parts. */
  private static show(visible: boolean, ...objects: (THREE.Object3D | undefined)[]) {
    for (const o of objects) {
      if (o) o.visible = visible;
    }
  }

  /** Position (camera-relative) and orientation of one body for this frame. */
  private updateNodePose(node: BodyNode, time: AstroTime, camPos: THREE.Vector3) {
    const p = helioPosition(node.def.id, time);
    node.pos.set(p.x, p.y, p.z);
    node.anchor.position.set(p.x - camPos.x, p.y - camPos.y, p.z - camPos.z);
    const q = bodyOrientation(node.def.id, time);
    node.mesh.quaternion.copy(q);
    node.night?.quaternion.copy(q);
    node.rim?.quaternion.copy(q);
    node.ring?.quaternion.copy(q);
    if (node.clouds) {
      node.clouds.quaternion.copy(q);
      // Slow eastward cloud drift relative to the ground.
      node.clouds.rotateOnAxis(CLOUD_DRIFT_AXIS, (time.ut % 5) * 0.25);
    }
  }

  /** HTML labels ignore WebGL occlusion — cull washed-out and below-horizon ones. */
  private static labelVisible(
    node: BodyNode,
    opts: SolarUpdateOptions,
    hidden: boolean,
    angular: number,
    washout: number,
    dist: number
  ): boolean {
    if (!opts.showLabels || hidden || angular >= 0.3 || washout >= 0.55) return false;
    if (opts.horizonUp && dist > 1e-9) {
      return node.anchor.position.dot(opts.horizonUp) / dist > -0.03;
    }
    return true;
  }

  /** Mesh/marker/glow/label visibility, marker scale and daylight washout. */
  private updateNodeVisibility(node: BodyNode, opts: SolarUpdateOptions, fovK: number) {
    const dist = node.anchor.position.length();
    const angular = radiusAu(node.def) / Math.max(dist, 1e-12);
    const hidden = node.def.id === opts.hideBodyId;
    SolarSystem.show(!hidden, node.mesh, node.clouds, node.night, node.rim, node.glow);

    // Daylight washes out planet dots and labels (Sun and Moon stay visible).
    const daylightProof = node.def.id === "sun" || node.def.id === "moon";
    const washout = daylightProof ? 0 : opts.skyBrightness;
    node.marker.material.opacity = 1 - washout;
    const markerScale = (node.marker.userData.baseScale as number) * fovK;
    node.marker.scale.set(markerScale, markerScale, 1);
    node.marker.visible = !hidden && angular < MARKER_ANGULAR_LIMIT * fovK && washout < 0.55;
    node.glow?.scale.set(0.09 * fovK, 0.09 * fovK, 1);

    node.label.visible = SolarSystem.labelVisible(node, opts, hidden, angular, washout, dist);
  }

  private updateOrbitLine(node: BodyNode, time: AstroTime, camPos: THREE.Vector3, showOrbits: boolean) {
    const line = node.orbitLine;
    if (!line) return;
    line.visible = showOrbits;
    if (!showOrbits) return;
    if (node.orbitIsHelio) {
      line.position.set(-camPos.x, -camPos.y, -camPos.z);
    } else {
      const pp = helioPosition(node.def.parent!, time);
      this.updateMoonOrbit(node, time, new THREE.Vector3(pp.x, pp.y, pp.z), camPos);
    }
  }

  /** Sun-relative lighting & shader uniforms (night side, atmosphere rims). */
  private updateSunUniforms() {
    const sunNode = this.nodes.get("sun")!;
    this.sunLight.position.copy(sunNode.anchor.position);
    const earth = this.nodes.get("earth")!;
    const sunDirFromEarth = sunNode.pos.clone().sub(earth.pos).normalize();
    for (const m of this.nightMaterials) m.uniforms.uSunDir.value.copy(sunDirFromEarth);
    for (const node of this.nodes.values()) {
      if (!node.rim) continue;
      const mat = node.rim.material as THREE.ShaderMaterial;
      mat.uniforms.uSunDir.value.copy(sunNode.pos).sub(node.pos).normalize();
    }
  }

  /**
   * Per-frame update. camPos is the camera's heliocentric position (AU, doubles).
   * All scene-graph positions are set camera-relative (floating origin).
   */
  update(time: AstroTime, camPos: THREE.Vector3, opts: SolarUpdateOptions) {
    // Sprites with sizeAttenuation:false live in clip space, so a narrow
    // (telescope) FOV magnifies them like everything else. Rescale them and
    // tighten the dot-vs-disk threshold so zooming reveals the real planet.
    const fovK = THREE.MathUtils.clamp(opts.fovDeg / 60, 0.002, 1);
    for (const node of this.nodes.values()) {
      this.updateNodePose(node, time, camPos);
      this.updateNodeVisibility(node, opts, fovK);
      this.updateOrbitLine(node, time, camPos, opts.showOrbits);
    }
    this.updateSunUniforms();
  }

  /** Objects for click-picking (meshes + markers). */
  get pickables(): THREE.Object3D[] {
    const list: THREE.Object3D[] = [];
    for (const n of this.nodes.values()) {
      list.push(n.mesh);
      if (n.marker.visible) list.push(n.marker);
    }
    return list;
  }
}
