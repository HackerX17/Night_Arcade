// The city: layout, collision, navigation helpers, and the meshes that draw it.
// A 12 x 12 grid of blocks with four-lane roads between them; a few blocks are open plazas you can drive across.
// Buildings, roads, lamps and neon are drawn with a handful of instanced meshes and two small shaders.
import * as THREE from "../vendor/three.module.min.js";

export const N = 12, P = 120, ROAD = 24, HALF = 12, WALK = 4, SIZE = N * P;
export const LANES = [3, 9];                                    // lane centres, metres to the right of the road centreline
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];         // +x, +z, -x, -z
export const headingOf = (dx, dz) => Math.atan2(dx, dz);        // forward = (sin h, cos h)
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(90210), rr = (a, b) => a + rand() * (b - a);

// ---------- layout ----------
const PLAZA_AT = [[5, 5], [2, 2], [9, 2], [2, 9], [9, 9], [6, 10], [10, 6], [1, 5], [7, 1]];
const HIDE_AT = [[2, 2], [9, 9], [1, 5], [7, 1], [6, 10]];
export const SCULPT_R = 7.5;
export const blocks = [];
for (let i = 0; i < N; i++) {
  blocks.push([]);
  for (let j = 0; j < N; j++) {
    const x0 = i * P + HALF, z0 = j * P + HALF, x1 = (i + 1) * P - HALF, z1 = (j + 1) * P - HALF;
    const plaza = PLAZA_AT.some(([a, b]) => a === i && b === j), hide = HIDE_AT.some(([a, b]) => a === i && b === j);
    blocks[i].push({ i, j, x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, plaza, hide, central: i === 5 && j === 5 });
  }
}
// hide spots: a covered corner of some plazas; parking under one cools a pursuit down three times as fast
export const hideSpots = [];
for (const row of blocks) for (const b of row) if (b.hide) hideSpots.push({ x: b.x0 + 16, z: b.z0 + 13, w: 22, d: 16, b });
// dynamic obstacles (fallen crash-spot towers): { x0, z0, x1, z1, copsOnly }
export const obstacles = [];

export function inCity(x, z) { return x > -HALF && x < SIZE + HALF && z > -HALF && z < SIZE + HALF; }
export function blockAt(x, z) {
  const i = Math.floor(x / P), j = Math.floor(z / P);
  if (i < 0 || j < 0 || i >= N || j >= N) return null;
  const b = blocks[i][j];
  return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 ? b : null;
}
export function solidAt(x, z) {
  if (!inCity(x, z)) return true;
  const b = blockAt(x, z);
  if (!b) return false;
  return b.plaza ? Math.hypot(x - b.cx, z - b.cz) < SCULPT_R : true;
}
// deepest overlap of a circle with the city: { pen, nx, nz } pointing out of the wall, or null
export function collideCircle(x, z, r, isCop = false) {
  let best = null;
  const consider = (pen, nx, nz) => { if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx, nz }; };
  if (x - r < -HALF) consider(-HALF - (x - r), 1, 0);
  if (x + r > SIZE + HALF) consider(x + r - (SIZE + HALF), -1, 0);
  if (z - r < -HALF) consider(-HALF - (z - r), 0, 1);
  if (z + r > SIZE + HALF) consider(z + r - (SIZE + HALF), 0, -1);
  const rect = (x0, z0, x1, z1) => {
    const px = clamp(x, x0, x1), pz = clamp(z, z0, z1), dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
    if (d2 > r * r) return;
    if (d2 > 1e-9) { const d = Math.sqrt(d2); consider(r - d, dx / d, dz / d); return; }
    const l = x - x0, rt = x1 - x, t = z - z0, bt = z1 - z, m = Math.min(l, rt, t, bt);
    if (m === l) consider(l + r, -1, 0); else if (m === rt) consider(rt + r, 1, 0); else if (m === t) consider(t + r, 0, -1); else consider(bt + r, 0, 1);
  };
  const i0 = Math.max(0, Math.floor((x - r) / P)), i1 = Math.min(N - 1, Math.floor((x + r) / P));
  const j0 = Math.max(0, Math.floor((z - r) / P)), j1 = Math.min(N - 1, Math.floor((z + r) / P));
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const b = blocks[i][j];
    if (b.plaza) { const dx = x - b.cx, dz = z - b.cz, d = Math.hypot(dx, dz); if (d < SCULPT_R + r && d > 1e-6) consider(SCULPT_R + r - d, dx / d, dz / d); }
    else rect(b.x0, b.z0, b.x1, b.z1);
  }
  for (const o of obstacles) if (!o.copsOnly || isCop) rect(o.x0, o.z0, o.x1, o.z1);
  return best;
}
// can someone at (x0, z0) see (x1, z1)? Buildings block the view; plazas don't
export function lineOfSight(x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 3));
  for (let k = 1; k < n; k++) {
    const t = k / n, b = blockAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
    if (b && !b.plaza) return false;
  }
  return true;
}
// ---------- roads and lanes ----------
export const nodeXZ = (i, j) => [i * P, j * P];
export function nearestNode(x, z) { return [clamp(Math.round(x / P), 0, N), clamp(Math.round(z / P), 0, N)]; }
export function validNode(i, j) { return i >= 0 && j >= 0 && i <= N && j <= N; }
// where a point sits on the road grid
export function roadAt(x, z) {
  const kx = Math.round(x / P), kz = Math.round(z / P), fx = x - kx * P, fz = z - kz * P;
  return { kx, kz, fx, fz, onV: Math.abs(fx) <= HALF, onH: Math.abs(fz) <= HALF };
}
// a spot in a lane: on the road leaving node (i, j) in direction d, s metres from the node centre
export function laneSpot(i, j, d, lane, s) {
  const [dx, dz] = DIRS[d], [nx, nz] = nodeXZ(i, j), off = LANES[lane];
  return { x: nx + dx * s - dz * off, z: nz + dz * s + dx * off, h: headingOf(dx, dz) };
}
// the direction index closest to a heading
export function dirOf(h) { const dx = Math.sin(h), dz = Math.cos(h); return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 2) : (dz > 0 ? 1 : 3); }

// ---------- crash spots: neon sign towers that topple onto the road behind you ----------
const CRASH_AT = [[3, 3, 0], [6, 2, 1], [8, 4, 0], [4, 6, 1], [7, 7, 0], [2, 7, 1], [10, 9, 0], [5, 9, 1], [9, 6, 1], [3, 10, 0], [11, 3, 1], [6, 6, 1]];
export const crashSpots = CRASH_AT.map(([i, j, axis], k) => {
  // the tower stands on the corner of block (i, j) next to node (i, j); axis 0 = it falls across the road running along x (toward -z), 1 = across the road along z (toward -x)
  const bx = i * P + HALF + 3, bz = j * P + HALF + 3;
  return axis === 0
    ? { k, x: bx + 6, z: bz, fx: 0, fz: -1, rx: bx + 6, rz: j * P + 6, axis, armed: true, t: -1, rearm: 0 }
    : { k, x: bx, z: bz + 6, fx: -1, fz: 0, rx: i * P + 6, rz: bz + 6, axis, armed: true, t: -1, rearm: 0 };
});

// ---------- meshes ----------
const FOG = new THREE.Color(0.075, 0.026, 0.14);
export const FOG_COLOR = FOG;
// fog by the true distance of each pixel (the ground is one huge quad, so a distance passed from its corners would be wrong)
const fogGLSL = `
  float fogDist = length(vWorld - cameraPosition);
  float fogF = 1.0 - exp(-uFogD * uFogD * fogDist * fogDist);
  col = mix(col, uFog, clamp(fogF, 0.0, 1.0));`;
const COMMON_PARS = `
  uniform vec3 uFog; uniform float uFogD; uniform float uTime;
  varying vec3 vWorld; varying float vDist;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;

function roadMaterial(blockTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFog: { value: FOG }, uFogD: { value: 0.0016 }, uTime: { value: 0 }, uBlocks: { value: blockTex },
      uHead: { value: new THREE.Vector4(0, 0, 0, 1) }, uCop: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
      uHeli: { value: new THREE.Vector4(0, 0, 0, 0) }
    },
    vertexShader: `
      varying vec3 vWorld; varying float vDist;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vec4 mv = viewMatrix * wp; vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      ${COMMON_PARS}
      uniform sampler2D uBlocks; uniform vec4 uHead; uniform vec4 uCop[4]; uniform vec4 uHeli;
      const float P = ${P.toFixed(1)}, HALF = ${HALF.toFixed(1)}, WALK = ${WALK.toFixed(1)}, NB = ${N.toFixed(1)}, SIZE = ${SIZE.toFixed(1)};
      float band(float d, float w) { float f = fwidth(d) + 1e-4; return 1.0 - smoothstep(w - f, w + f, d); }
      float pools(float s, float d) {      // street-lamp light on the road near the curb: lamps every 48 m, 24 m in from each corner
        float a = mod(s - HALF, P);
        float ds = min(abs(a - 24.0), abs(a - 72.0));
        float dd = d - (HALF - 3.0);
        return exp(-(ds * ds + dd * dd) / 40.0);
      }
      void main() {
        vec2 p = vWorld.xz;
        vec3 col = vec3(0.02, 0.014, 0.035);
        float glow = 0.0;
        bool city = p.x > -HALF && p.x < SIZE + HALF && p.y > -HALF && p.y < SIZE + HALF;
        float fx = p.x - P * floor(p.x / P + 0.5), fz = p.y - P * floor(p.y / P + 0.5);
        float ax = abs(fx), az = abs(fz);
        bool onV = ax < HALF, onH = az < HALF;
        float g = hash(floor(p * 5.0)) * 0.012 + hash(floor(p * 0.7)) * 0.01;
        vec3 asphalt = vec3(0.03, 0.031, 0.046) + g;
        if (!city) {
          float gl = band(abs(fract(p.x / 40.0) - 0.5) * 40.0, 0.08) + band(abs(fract(p.y / 40.0) - 0.5) * 40.0, 0.08);
          col = vec3(0.025, 0.012, 0.045) + vec3(0.25, 0.05, 0.4) * gl * 0.25;
        } else if (onV || onH) {
          col = asphalt;
          if (onV && onH) {
            col += vec3(0.004, 0.004, 0.008);
          } else {
            float d = onV ? ax : az, s = onV ? p.y : p.x;
            col = mix(col, vec3(0.95, 0.72, 0.18), band(abs(d - 0.32), 0.11) * 0.85);                 // double yellow
            float dash = step(0.45, fract(s / 9.0));
            col = mix(col, vec3(0.82), band(abs(d - 6.0), 0.1) * dash * 0.75);                         // lane line
            col = mix(col, vec3(0.75), band(abs(d - (HALF - 0.7)), 0.09) * 0.6);                       // edge line
            float near = onV ? az : ax;                                                              // crosswalks just before each crossing
            if (near < HALF + 4.6 && near > HALF + 0.9) col = mix(col, vec3(0.7), step(0.5, fract((d + 0.4) / 1.7)) * step(d, HALF - 1.2) * 0.55);
            glow += pools(s, d);
          }
        } else {
          // inside a block: sidewalk, the glowing curb, and plazas
          float bi = floor(p.x / P), bj = floor(p.y / P);
          float kind = texture2D(uBlocks, (vec2(bi, bj) + 0.5) / NB).r;
          float edge = min(ax - HALF, az - HALF);
          if (kind > 0.5) {
            vec2 q = p - vec2(bi + 0.5, bj + 0.5) * P;
            float tile = band(abs(fract(q.x / 6.0) - 0.5) * 6.0, 0.05) + band(abs(fract(q.y / 6.0) - 0.5) * 6.0, 0.05);
            col = vec3(0.05, 0.035, 0.08) + vec3(0.9, 0.1, 0.8) * tile * 0.06;
            float r = length(q);
            col += vec3(1.0, 0.25, 0.9) * band(abs(r - 16.0), 0.25) * 1.4 + vec3(0.1, 0.85, 1.0) * band(abs(r - 24.0), 0.18) * 1.0;
            col += vec3(0.6, 0.2, 0.9) * exp(-r * r / 300.0) * 0.25;
          } else if (edge < WALK) {
            col = vec3(0.07, 0.068, 0.09) + g;
            col *= 0.85 + 0.15 * band(abs(fract(edge / 2.0) - 0.5) * 2.0, 0.04);
          } else col = vec3(0.025, 0.02, 0.04);
          float curb = band(edge, 0.22);
          vec3 neon = mod(bi + bj, 2.0) < 1.0 ? vec3(0.0, 0.9, 1.0) : vec3(1.0, 0.15, 0.85);
          col += neon * curb * (kind > 0.5 ? 0.6 : 2.2);
          glow += pools(onV ? p.y : p.x, ax < az ? ax : az) * 0.4;
        }
        // street lamps, a wet sheen, the player's headlights, police lights
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float graze = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 3.0);
        col += vec3(1.0, 0.68, 0.38) * glow * (0.22 + 0.5 * graze);
        col += vec3(0.25, 0.08, 0.45) * graze * 0.05;
        vec2 lp = p - uHead.xy; float along = dot(lp, uHead.zw), lat = abs(dot(lp, vec2(-uHead.w, uHead.z)));
        if (along > 0.0) col += vec3(0.7, 0.8, 1.0) * exp(-along / 38.0) * (1.0 - smoothstep(0.0, 2.0 + along * 0.33, lat)) * smoothstep(0.5, 5.0, along) * 0.26;
        for (int k = 0; k < 4; k++) {
          vec4 c = uCop[k]; if (c.z <= 0.0) continue;
          vec2 dv = p - c.xy; float dd = dot(dv, dv);
          col += mix(vec3(1.0, 0.08, 0.12), vec3(0.12, 0.3, 1.0), c.w) * c.z * exp(-dd / 70.0) * 0.55;
        }
        if (uHeli.z > 0.0) { vec2 dv = p - uHeli.xy; col += vec3(0.85, 0.92, 1.0) * uHeli.z * (1.0 - smoothstep(uHeli.w * 0.7, uHeli.w, length(dv))) * 0.35; }
        ${fogGLSL}
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

function buildingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uFog: { value: FOG }, uFogD: { value: 0.0016 }, uTime: { value: 0 } },
    vertexShader: `
      attribute vec3 aTint; attribute float aSeed;
      varying vec3 vWorld; varying float vDist; varying vec3 vN; varying vec3 vTint; varying float vSeed; varying float vTop; varying float vBase;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(position, 1.0); vWorld = wp.xyz;
        vN = normalize(mat3(m) * normal); vTint = aTint; vSeed = aSeed;
        vTop = (m * vec4(0.0, 0.5, 0.0, 1.0)).y; vBase = (m * vec4(0.0, -0.5, 0.0, 1.0)).y;
        vec4 mv = viewMatrix * wp; vDist = length(mv.xyz); gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      ${COMMON_PARS}
      varying vec3 vN; varying vec3 vTint; varying float vSeed; varying float vTop; varying float vBase;
      float band2(float u, float pw, float fw) { float f = abs(fract(u / (pw * 6.0)) - 0.5); return (1.0 - smoothstep(0.015, 0.03 + fw * 0.05, f)) * 1.2; }
      void main() {
        vec3 n = normalize(vN), col;
        if (n.y > 0.5) {
          col = vec3(0.022, 0.02, 0.036);
          col += vTint * 0.05;
        } else if (n.y < -0.5) { col = vec3(0.0); }
        else {
          float u = abs(n.x) > 0.5 ? vWorld.z : vWorld.x, v = vWorld.y;
          float style = fract(vSeed * 3.7);
          float pw = style < 0.33 ? 3.0 : style < 0.66 ? 2.2 : 4.2, ph = style < 0.5 ? 3.6 : 3.2;
          vec2 cell = vec2(floor(u / pw), floor(v / ph)), f = vec2(fract(u / pw), fract(v / ph));
          float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.8);
          float h = hash(cell + vec2(vSeed * 61.0, vSeed * 17.0));
          float on = step(0.52 + 0.25 * fract(vSeed * 9.1), h);
          vec3 warm = vec3(1.0, 0.7, 0.4), cool = vec3(0.55, 0.82, 1.0);
          vec3 wc = mix(warm, cool, step(0.55, fract(h * 7.31))) * (0.55 + 0.9 * fract(h * 13.7));
          vec3 wall = vec3(0.018, 0.02, 0.038) + vTint * 0.012;
          vec3 glass = vec3(0.028, 0.035, 0.07);
          col = mix(wall, on > 0.5 ? wc * 1.35 : glass, win);
          float fw = max(fwidth(u) / pw, fwidth(v) / ph);
          float litFrac = 1.0 - (0.52 + 0.25 * fract(vSeed * 9.1));                                    // far away the windows blur into their average
          col = mix(col, mix(wall, vec3(0.95, 0.78, 0.62) * 1.2, litFrac * 0.38), smoothstep(0.35, 0.9, fw));
          float top = vTop - v;
          col += vTint * (1.0 - smoothstep(0.0, 0.7, top)) * 2.6;                                      // neon crown along the roofline
          col += vTint * step(0.8, fract(vSeed * 5.3)) * band2(u, pw, fw);
          float street = v - vBase;
          col += vTint * 0.35 * (1.0 - smoothstep(0.5, 5.0, street)) * step(vBase, 1.0);              // shop fronts glow at street level
        }
        ${fogGLSL}
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      varying vec3 vDir; uniform float uTime;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir); float y = d.y;
        vec3 col = mix(vec3(0.075, 0.026, 0.14), vec3(0.03, 0.008, 0.07), smoothstep(0.0, 0.35, y));
        col = mix(col, vec3(0.012, 0.004, 0.035), smoothstep(0.3, 0.9, y));
        col += vec3(0.5, 0.06, 0.38) * exp(-abs(y) * 14.0) * 0.32;                                    // haze over the skyline
        vec2 g = vec2(atan(d.z, d.x) * 120.0, y * 160.0); vec2 c = floor(g);
        float s = hash(c); if (s > 0.985 && y > 0.08) { vec2 f = fract(g) - 0.5; col += vec3(0.8, 0.85, 1.0) * (1.0 - smoothstep(0.0, 0.18, length(f))) * (0.4 + 0.6 * sin(uTime * 2.0 + s * 60.0) * 0.5 + 0.3); }
        vec3 md = normalize(vec3(-0.45, 0.32, -0.83)); float m = dot(d, md);
        col += vec3(1.0, 0.8, 0.95) * smoothstep(0.9994, 0.9997, m) * 1.6 + vec3(0.7, 0.3, 0.8) * pow(max(m, 0.0), 300.0) * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

// the distant skyline on a ring around the city
function skylineTexture() {
  const c = document.createElement("canvas"); c.width = 2048; c.height = 256; const g = c.getContext("2d"), r2 = rng(77);
  g.clearRect(0, 0, 2048, 256);
  for (let layer = 0; layer < 2; layer++) {
    let x = 0;
    while (x < 2048) {
      const w = 18 + r2() * 60, h = (layer ? 40 : 70) + r2() * (layer ? 110 : 160);
      g.fillStyle = layer ? "#12062a" : "#0b0420"; g.fillRect(x, 256 - h, w, h);
      for (let wy = 256 - h + 6; wy < 252; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (r2() < 0.18) { g.fillStyle = r2() < 0.5 ? "rgba(255,190,120,.75)" : "rgba(140,210,255,.7)"; g.fillRect(wx, wy, 2, 2); }
      if (r2() < 0.25) { g.fillStyle = ["#ff2bd6", "#00e5ff", "#b6ff00", "#ffd23f"][Math.floor(r2() * 4)]; g.fillRect(x, 256 - h, w, 2); }
      x += w + (layer ? 4 : 1) + r2() * 10;
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// rooftop billboards (made-up brands)
const BRANDS = [["VOLTA", "#00e5ff", "energy drink"], ["KAIJU RAMEN", "#ff3de0", "open all night"], ["NOVA FIZZ", "#b6ff00", "taste the static"],
  ["ZENTRA", "#ffd23f", "motors"], ["MIDNIGHT FM", "#ff8a3d", "99.7"], ["HYPERION", "#c94dff", "towers"]];
function brandTexture([name, col, sub]) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 192; const g = c.getContext("2d");
  g.fillStyle = "#07031a"; g.fillRect(0, 0, 512, 192);
  g.strokeStyle = col; g.lineWidth = 6; g.shadowColor = col; g.shadowBlur = 18; g.strokeRect(10, 10, 492, 172);
  g.font = "900 64px Arial Black, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#ffffff"; g.shadowBlur = 24;
  g.fillText(name, 256, 84, 470); g.font = "700 26px system-ui, sans-serif"; g.fillStyle = col; g.shadowBlur = 10; g.fillText(sub.toUpperCase(), 256, 148);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildWorld(scene) {
  const out = { mats: [], update: null };
  // block kinds for the road shader
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) data[(j * N + i) * 4] = blocks[i][j].plaza ? 255 : 0;
  const blockTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); blockTex.magFilter = blockTex.minFilter = THREE.NearestFilter; blockTex.needsUpdate = true;
  // ground + roads
  const roadMat = roadMaterial(blockTex); out.road = roadMat;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE + 2400, SIZE + 2400, 1, 1), roadMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(SIZE / 2, 0, SIZE / 2); scene.add(ground);
  // sky and the far skyline
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 32, 16), skyMaterial()); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky); out.sky = sky;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2600, 2600, 460, 64, 1, true), new THREE.MeshBasicMaterial({ map: skylineTexture(), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, color: new THREE.Color(1.2, 1.2, 1.3) }));
  ring.position.set(SIZE / 2, 210, SIZE / 2); scene.add(ring);
  // buildings: every block split into lots, taller toward downtown; the outer ring of blocks frames the city
  const parts = [];
  const NEON = [[0, 0.9, 1], [1, 0.17, 0.84], [0.71, 1, 0], [1, 0.82, 0.25], [0.79, 0.3, 1], [1, 0.42, 0.24], [0.24, 1, 0.69]];
  const addBuilding = (x0, z0, x1, z1, h, base = 0) => {
    const tint = NEON[Math.floor(rand() * NEON.length)], seed = rand();
    parts.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h, y: base, tint, seed });
    if (h > 70 && rand() < 0.45) {                                // a setback tower on top
      const k = rr(0.5, 0.75), w = (x1 - x0) * k, d = (z1 - z0) * k, cx = (x0 + x1) / 2 + rr(-1, 1) * (x1 - x0 - w) / 2, cz = (z0 + z1) / 2 + rr(-1, 1) * (z1 - z0 - d) / 2;
      parts.push({ x: cx, z: cz, w, d, h: h * rr(0.25, 0.55), y: base + h, tint: NEON[Math.floor(rand() * NEON.length)], seed: rand() });
    }
  };
  const heightAt = (x, z) => { const d = Math.hypot(x - SIZE / 2, z - SIZE / 2); return 14 + 120 * Math.exp(-((d / 430) ** 2)); };
  const lots = (x0, z0, x1, z1, outer) => {
    const split = rand(), H = heightAt((x0 + x1) / 2, (z0 + z1) / 2) * (outer ? 1.25 : 1);
    const rects = [];
    if (split < 0.18) rects.push([x0, z0, x1, z1]);
    else if (split < 0.5) { const m = x0 + (x1 - x0) * rr(0.4, 0.6); if (rand() < 0.5) rects.push([x0, z0, m, z1], [m, z0, x1, z1]); else { const mz = z0 + (z1 - z0) * rr(0.4, 0.6); rects.push([x0, z0, x1, mz], [x0, mz, x1, z1]); } }
    else { const mx = x0 + (x1 - x0) * rr(0.4, 0.6), mz = z0 + (z1 - z0) * rr(0.4, 0.6); rects.push([x0, z0, mx, mz], [mx, z0, x1, mz], [x0, mz, mx, z1], [mx, mz, x1, z1]); }
    for (const [a, b, c, d] of rects) {
      const ins = rr(1.5, 4);
      const h = Math.max(10, H * rr(0.45, 1.35) * (rand() < 0.06 ? 1.8 : 1));
      addBuilding(a + ins, b + ins, c - ins, d - ins, h);
    }
  };
  for (const row of blocks) for (const b of row) if (!b.plaza) lots(b.x0 + WALK, b.z0 + WALK, b.x1 - WALK, b.z1 - WALK, false);
  for (let i = -2; i <= N + 1; i++) for (let j = -2; j <= N + 1; j++) {
    if (i >= 0 && j >= 0 && i < N && j < N) continue;
    const x0 = i * P + HALF + 2, z0 = j * P + HALF + 2;
    lots(x0, z0, x0 + P - ROAD - 4, z0 + P - ROAD - 4, true);
  }
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  const tint = new Float32Array(parts.length * 3), seed = new Float32Array(parts.length);
  const bMat = buildingMaterial(); out.mats.push(bMat);
  const bMesh = new THREE.InstancedMesh(bGeo, bMat, parts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  parts.forEach((b, k) => {
    m4.compose(v3.set(b.x, b.y + b.h / 2, b.z), q.identity(), s3.set(b.w, b.h, b.d)); bMesh.setMatrixAt(k, m4);
    tint.set(b.tint, k * 3); seed[k] = b.seed;
  });
  bGeo.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 3)); bGeo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
  bMesh.frustumCulled = false; scene.add(bMesh); out.buildings = bMesh; out.ground = ground; out.ring = ring;
  // billboards on some rooftops near the roads
  const bbGroups = BRANDS.map((br) => ({ tex: brandTexture(br), list: [] }));
  parts.forEach((b, k) => {
    if (b.y > 0 || b.h < 26 || b.h > 110 || rand() > 0.16) return;
    const g = bbGroups[k % bbGroups.length], face = Math.floor(rand() * 4), w = Math.min(22, Math.max(b.w, b.d) * 0.8);
    g.list.push({ x: b.x, z: b.z, y: b.h + w * 0.2 + 1.5, rot: face * Math.PI / 2, w, off: (face % 2 ? b.w : b.d) / 2 - 2 });
  });
  for (const g of bbGroups) {
    if (!g.list.length) continue;
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.375), new THREE.MeshBasicMaterial({ map: g.tex, side: THREE.DoubleSide, color: new THREE.Color(1.6, 1.6, 1.6) }), g.list.length);
    g.list.forEach((o, k) => {
      const fx = Math.sin(o.rot), fz = Math.cos(o.rot);
      m4.compose(v3.set(o.x + fx * o.off, o.y, o.z + fz * o.off), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rot), s3.set(o.w, o.w, 1)); mesh.setMatrixAt(k, m4);
    });
    scene.add(mesh);
  }
  // street lamps: two per side on every stretch of road
  const lampSpots = [];
  for (let k = 0; k <= N; k++) for (let s = 0; s < N; s++) for (const a of [24, 72]) for (const side of [-1, 1]) {
    lampSpots.push({ x: k * P + side * (HALF + 1.2), z: s * P + HALF + a, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2 });   // roads along z
    lampSpots.push({ x: s * P + HALF + a, z: k * P + side * (HALF + 1.2), rot: side > 0 ? Math.PI : 0 });                  // roads along x
  }
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 7.2, 6); poleGeo.translate(0, 3.6, 0);
  const headGeo = new THREE.BoxGeometry(0.5, 0.2, 1.9); headGeo.translate(0, 7.15, 0.8);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshBasicMaterial({ color: 0x0b0a16 }), lampSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 1.05) }), lampSpots.length);
  lampSpots.forEach((l, k) => { m4.compose(v3.set(l.x, 0, l.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.rot), s3.set(1, 1, 1)); poles.setMatrixAt(k, m4); heads.setMatrixAt(k, m4); });
  scene.add(poles, heads); out.lamps = lampSpots; out.lampHeads = heads;
  // plaza sculptures: slowly turning neon rings; the central plaza gets a tall obelisk
  out.rings = [];
  for (const row of blocks) for (const b of row) {
    if (!b.plaza) continue;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(SCULPT_R - 1, SCULPT_R, 1.4, 24), new THREE.MeshBasicMaterial({ color: 0x0d0820 }));
    base.position.set(b.cx, 0.7, b.cz); scene.add(base);
    const cols = b.central ? [[2.6, 0.3, 2.2], [0.2, 1.8, 2.6], [1.8, 2.6, 0.3]] : [[2.4, 0.35, 2.0], [0.2, 1.9, 2.6]];
    cols.forEach((c, k) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(b.central ? 9 - k * 2 : 5.6 - k * 1.6, 0.32, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c) }));
      ring.position.set(b.cx, b.central ? 13 + k * 0.5 : 7.5, b.cz); ring.userData.spin = (k % 2 ? -1 : 1) * (0.3 + k * 0.15); scene.add(ring); out.rings.push(ring);
    });
    if (b.central) { const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.6, 34, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 2.4) })); ob.position.set(b.cx, 17, b.cz); scene.add(ob); }
    if (b.hide) {
      const h = hideSpots.find((s) => s.b === b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(h.w, 0.7, h.d), new THREE.MeshBasicMaterial({ color: 0x0a0718 })); roof.position.set(h.x, 5.6, h.z); scene.add(roof);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(h.w + 0.3, 0.18, h.d + 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.2, 2.8) })); edge.position.set(h.x, 5.2, h.z); scene.add(edge);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.4, 0.5), new THREE.MeshBasicMaterial({ color: 0x120c26 })); p.position.set(h.x + sx * (h.w / 2 - 0.6), 2.7, h.z + sz * (h.d / 2 - 0.6)); scene.add(p); }
    }
  }
  // crash-spot towers
  const towerCols = [[2.8, 0.4, 2.2], [0.3, 2.2, 2.8], [2.8, 1.9, 0.3], [1.9, 0.5, 2.8]];
  for (const c of crashSpots) {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z);
    const pivot = new THREE.Group(); g.add(pivot);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.4, 32, 1.4), new THREE.MeshBasicMaterial({ color: 0x15102a })); mast.position.y = 16; pivot.add(mast);
    const col = new THREE.Color(...towerCols[c.k % towerCols.length]);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(c.axis === 0 ? 1 : 15, 7, c.axis === 0 ? 15 : 1), new THREE.MeshBasicMaterial({ color: 0x0c0820 })); panel.position.y = 28; pivot.add(panel);
    const face = new THREE.Mesh(new THREE.BoxGeometry(c.axis === 0 ? 1.15 : 14, 6, c.axis === 0 ? 14 : 1.15), new THREE.MeshBasicMaterial({ color: col, wireframe: true })); face.position.y = 28; pivot.add(face);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, depthWrite: false })); stripe.position.y = 13; pivot.add(stripe);
    scene.add(g);
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.2, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.5, 0.6), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    ringMesh.rotation.x = -Math.PI / 2; ringMesh.position.set(c.rx, 0.06, c.rz); scene.add(ringMesh);
    c.group = g; c.pivot = pivot; c.ring = ringMesh;
  }
  out.update = (t, dt) => {
    roadMat.uniforms.uTime.value = t; bMat.uniforms.uTime.value = t; sky.material.uniforms.uTime.value = t;
    for (const r of out.rings) r.rotation.y += r.userData.spin * dt;
    for (const c of crashSpots) { if (c.ring.visible) { const s = 1 + 0.08 * Math.sin(t * 6 + c.k); c.ring.scale.set(s, s, s); } }
  };
  out.setFogDensity = (d) => { roadMat.uniforms.uFogD.value = d; bMat.uniforms.uFogD.value = d; };
  return out;
}

// a tall pillar of light marking an event start, and a ring on the road
export function makeBeacon(color) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color) }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uCol; uniform float uTime; void main() { float a = (1.0 - vUv.y) * (0.35 + 0.15 * sin(uTime * 3.0 + vUv.y * 20.0)); gl_FragColor = vec4(uCol * a * 1.6, a); }`
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 240, 20, 1, true), mat); pillar.position.y = 120; g.add(pillar);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.4, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; g.add(ring);
  g.userData.mat = mat;
  return g;
}
