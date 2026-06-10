import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { AtmosphereDef } from "@/lib/bodies";
import { Landscape } from "@/lib/store";

const DOME_RADIUS = 50; // arbitrary: depth-independent, camera-attached

/** Ground styles; Earth uses the user-selected landscape, other bodies "rock". */
export type GroundStyle = Landscape | "rock";
const STYLE_ID: Record<GroundStyle, number> = { grass: 0, desert: 1, city: 2, rock: 3 };

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uSkyColor;
  uniform vec3 uSunDir;   // world space
  uniform vec3 uUp;       // world space
  uniform float uDay;     // 0 night .. 1 day
  uniform float uDensity;
  uniform float uLightPollution; // 0..~0.2 (city glow at night)
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float alt = dot(dir, uUp);
    float sunAlt = dot(uSunDir, uUp);
    float cosSun = clamp(dot(dir, uSunDir), -1.0, 1.0);

    // Base sky: brighter near horizon, deeper at zenith.
    float horizonness = pow(1.0 - clamp(alt, 0.0, 1.0), 2.2);
    vec3 day = mix(uSkyColor, vec3(0.85, 0.9, 1.0) * (uSkyColor * 0.5 + 0.5), horizonness * 0.7);

    // Twilight: warm band near the sun when it is low.
    float twilight = exp(-abs(sunAlt) * 9.0) * pow(clamp(cosSun * 0.5 + 0.5, 0.0, 1.0), 3.0);
    vec3 twiColor = vec3(1.0, 0.45, 0.2) * twilight * (1.0 - clamp(alt, 0.0, 1.0));

    // Sun halo.
    float halo = pow(clamp(cosSun, 0.0, 1.0), 80.0) * 0.8 + pow(clamp(cosSun, 0.0, 1.0), 8.0) * 0.15;

    // City light pollution: sodium-orange dome hugging the horizon at night.
    float lp = uLightPollution * (1.0 - uDay) * pow(1.0 - clamp(alt, 0.0, 1.0), 5.0);
    vec3 lpColor = vec3(0.95, 0.55, 0.25) * lp;

    vec3 color = day * uDay + twiColor + vec3(1.0, 0.95, 0.85) * halo * max(uDay, twilight) + lpColor;
    float alpha = uDensity * clamp(uDay * (0.75 + 0.25 * horizonness) + twilight * 0.9 + halo + lp * 1.4, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

const GROUND_VERT = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform float uStyle;     // 0 grass, 1 desert, 2 city, 3 rock
  uniform float uDay;       // sun-above-horizon factor (lights the ground)
  uniform float uHazeAmt;   // atmospheric haze factor (0 on airless worlds)
  uniform vec3 uBaseColor;  // rock tint (the body's colour)
  uniform vec3 uHaze;       // daytime horizon haze colour
  varying vec3 vLocal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    vec3 d = normalize(vLocal);
    float az = atan(d.y, d.x);

    // Terrain silhouette: the horizon line undulates per landscape.
    float h = 0.0;
    if (uStyle < 0.5) {        // grass: rolling hills
      h = 0.014 * sin(az * 3.0 + 1.7) + 0.009 * sin(az * 7.0) + 0.004 * sin(az * 13.0 + 2.0);
    } else if (uStyle < 1.5) { // desert: long low dunes
      h = 0.018 * sin(az * 2.0 + 0.6) + 0.005 * sin(az * 5.0 + 1.2);
    } else if (uStyle > 2.5) { // rock: rugged
      h = 0.010 * sin(az * 4.0) + 0.007 * sin(az * 9.0 + 0.8) + 0.004 * sin(az * 17.0);
    }                          // city: flat — the skyline mesh provides the silhouette
    if (d.z > h) discard;

    // Perspective-ish ground coordinates (compress toward the horizon).
    float down = clamp(-d.z + 0.001, 0.001, 1.0);
    vec2 p = d.xy / (down + 0.04);
    float n = noise(p * 6.0) * 0.65 + noise(p * 23.0) * 0.35;
    // Fade detail near the horizon to avoid shimmer.
    float detailFade = smoothstep(0.0, 0.25, down);
    n = mix(0.5, n, detailFade);

    vec3 base;
    if (uStyle < 0.5) {
      base = mix(vec3(0.07, 0.13, 0.035), vec3(0.16, 0.25, 0.08), n);          // grass
    } else if (uStyle < 1.5) {
      base = mix(vec3(0.38, 0.29, 0.17), vec3(0.56, 0.45, 0.27), n);           // sand
    } else if (uStyle < 2.5) {
      base = mix(vec3(0.075, 0.08, 0.095), vec3(0.13, 0.135, 0.15), n);        // asphalt
    } else {
      base = mix(uBaseColor * 0.55, uBaseColor * 1.15, n);                     // rock
    }

    // Lighting: full colour by day, faint blue-grey wash at night.
    float light = 0.05 + 1.05 * uDay;
    vec3 c = base * light;
    c = mix(c, vec3(0.04, 0.045, 0.06), (1.0 - uDay) * 0.55);
    // City streets keep a sodium glow at night.
    if (uStyle > 1.5 && uStyle < 2.5) {
      c += vec3(0.10, 0.055, 0.02) * (1.0 - uDay) * (0.4 + 0.6 * n);
    }
    // Daytime atmospheric haze toward the horizon (none on airless worlds).
    c = mix(c, uHaze, pow(1.0 - down, 6.0) * uHazeAmt * 0.65);
    // Darken toward the nadir.
    c *= mix(1.0, 0.45, pow(down, 0.6));
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** Procedural city skyline: returns silhouette + lit-windows textures (same layout). */
function makeSkylineTextures(): { silhouette: THREE.Texture; windows: THREE.Texture } {
  const W = 2048;
  const H = 128;
  const sil = document.createElement("canvas");
  sil.width = W;
  sil.height = H;
  const win = document.createElement("canvas");
  win.width = W;
  win.height = H;
  const sctx = sil.getContext("2d")!;
  const wctx = win.getContext("2d")!;

  let x = 0;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  while (x < W) {
    const bw = 18 + Math.floor(rnd() * 46); // building width
    const bh = 14 + Math.floor(rnd() * (rnd() < 0.18 ? 95 : 52)); // few towers
    const y0 = H - bh;
    sctx.fillStyle = `rgb(${10 + rnd() * 8}, ${12 + rnd() * 8}, ${16 + rnd() * 9})`;
    sctx.fillRect(x, y0, bw, bh);
    // Windows: sparse lit grid.
    wctx.fillStyle = "rgba(255, 196, 110, 0.9)";
    for (let wy = y0 + 4; wy < H - 4; wy += 7) {
      for (let wx = x + 3; wx < x + bw - 3; wx += 6) {
        if (rnd() < 0.3) wctx.fillRect(wx, wy, 2, 3);
      }
    }
    x += bw + Math.floor(rnd() * 7);
  }

  const silhouette = new THREE.CanvasTexture(sil);
  const windows = new THREE.CanvasTexture(win);
  silhouette.wrapS = windows.wrapS = THREE.RepeatWrapping;
  return { silhouette, windows };
}

/**
 * Camera-attached sky hemisphere + procedural ground for surface mode.
 * Local frame: +Z zenith, +Y north, +X east. The whole group is oriented
 * each frame to the observer's geodetic frame (in world/EQJ coordinates).
 */
export class SkyDome {
  readonly group = new THREE.Group();
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly groundMat: THREE.ShaderMaterial;
  private readonly sky: THREE.Mesh;
  private readonly ground: THREE.Mesh;
  private readonly skyline: THREE.Mesh;
  private readonly skylineWindows: THREE.Mesh;
  private readonly skylineWinMat: THREE.MeshBasicMaterial;
  private readonly cardinals: CSS2DObject[] = [];
  private readonly frameQ = new THREE.Quaternion();
  private readonly m = new THREE.Matrix4();

  constructor() {
    const skyGeo = new THREE.SphereGeometry(DOME_RADIUS, 48, 32);
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uSkyColor: { value: new THREE.Vector3(0.3, 0.55, 1) },
        uSunDir: { value: new THREE.Vector3(0, 0, 1) },
        uUp: { value: new THREE.Vector3(0, 0, 1) },
        uDay: { value: 0 },
        uDensity: { value: 1 },
        uLightPollution: { value: 0 },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.sky.renderOrder = -85; // after stars: daylight washes them out
    this.sky.frustumCulled = false;

    const groundGeo = new THREE.SphereGeometry(DOME_RADIUS * 0.9, 64, 32);
    this.groundMat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: {
        uStyle: { value: 0 },
        uDay: { value: 0 },
        uHazeAmt: { value: 0 },
        uBaseColor: { value: new THREE.Color(0x808080) },
        uHaze: { value: new THREE.Color(0xb8cce8) },
      },
      side: THREE.BackSide,
      // transparent so it joins the sorted transparent pass, where renderOrder
      // 100 puts it after the sky dome — it must overdraw everything below horizon
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.ground = new THREE.Mesh(groundGeo, this.groundMat);
    this.ground.renderOrder = 100; // occludes everything below the horizon
    this.ground.frustumCulled = false;

    // City skyline band just above the horizon (visible for landscape "city").
    const { silhouette, windows } = makeSkylineTextures();
    const R = DOME_RADIUS * 0.82;
    const skyGeoCyl = new THREE.CylinderGeometry(R, R, DOME_RADIUS * 0.045, 96, 1, true);
    skyGeoCyl.rotateX(Math.PI / 2); // axis → local +Z (zenith)
    skyGeoCyl.translate(0, 0, DOME_RADIUS * 0.0225 - 0.02); // base sits at the horizon
    this.skyline = new THREE.Mesh(
      skyGeoCyl,
      new THREE.MeshBasicMaterial({
        map: silhouette,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      })
    );
    this.skyline.renderOrder = 101;
    this.skyline.frustumCulled = false;
    this.skylineWinMat = new THREE.MeshBasicMaterial({
      map: windows,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.skylineWindows = new THREE.Mesh(skyGeoCyl, this.skylineWinMat);
    this.skylineWindows.renderOrder = 102;
    this.skylineWindows.frustumCulled = false;

    this.group.add(this.sky, this.ground, this.skyline, this.skylineWindows);

    const dirs: [string, number][] = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];
    for (const [name, azDeg] of dirs) {
      const el = document.createElement("div");
      el.className = "sky-label cardinal-label";
      el.textContent = name;
      const obj = new CSS2DObject(el);
      const az = THREE.MathUtils.degToRad(azDeg);
      // Local frame: x=east, y=north — azimuth measured from north toward east.
      obj.position.set(Math.sin(az), Math.cos(az), 0.03).multiplyScalar(DOME_RADIUS * 0.85);
      this.group.add(obj);
      this.cardinals.push(obj);
    }
  }

  /** Orient the dome to the observer's local frame (world-space unit vectors). */
  setFrame(east: THREE.Vector3, north: THREE.Vector3, up: THREE.Vector3) {
    this.m.makeBasis(east, north, up);
    this.frameQ.setFromRotationMatrix(this.m);
    this.group.quaternion.copy(this.frameQ);
  }

  update(
    sunDirWorld: THREE.Vector3,
    upWorld: THREE.Vector3,
    atmosphere: AtmosphereDef | undefined,
    style: GroundStyle,
    bodyColor: number,
    visible: { atmosphere: boolean; ground: boolean }
  ): { skyBrightness: number; lightPollution: number } {
    const sunAlt = sunDirWorld.dot(upWorld);
    // Atmosphere toggled off = airless-world view: sunlit ground, black sky,
    // stars and planets visible even at local noon.
    const density = visible.atmosphere ? atmosphere?.density ?? 0 : 0;
    const dayRaw = THREE.MathUtils.smoothstep(sunAlt, -0.09, 0.12);
    const day = dayRaw * density;
    const lightPollution = style === "city" && visible.atmosphere ? 0.16 : 0;

    this.sky.visible = visible.atmosphere && (density > 0 || lightPollution > 0);
    this.ground.visible = visible.ground;
    const cityVisible = visible.ground && style === "city";
    this.skyline.visible = cityVisible;
    this.skylineWindows.visible = cityVisible;
    this.skylineWinMat.opacity = 1 - dayRaw; // windows glow only after dark
    for (const c of this.cardinals) c.visible = visible.ground;

    if (this.sky.visible) {
      const u = this.skyMat.uniforms;
      if (atmosphere) u.uSkyColor.value.set(...atmosphere.skyColor);
      u.uSunDir.value.copy(sunDirWorld);
      u.uUp.value.copy(upWorld);
      u.uDay.value = dayRaw;
      u.uDensity.value = Math.max(density, lightPollution > 0 ? 0.6 : 0);
      u.uLightPollution.value = lightPollution;
    }

    const g = this.groundMat.uniforms;
    g.uStyle.value = STYLE_ID[style];
    g.uDay.value = dayRaw; // direct sunlight lights the ground even without air
    g.uHazeAmt.value = day;
    (g.uBaseColor.value as THREE.Color).set(bodyColor);
    if (atmosphere) {
      (g.uHaze.value as THREE.Color).setRGB(
        atmosphere.skyColor[0] * 0.85 + 0.15,
        atmosphere.skyColor[1] * 0.85 + 0.15,
        atmosphere.skyColor[2] * 0.85 + 0.15
      );
    }

    return { skyBrightness: day, lightPollution };
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }
}
