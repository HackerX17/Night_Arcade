// Night Reef in 3D: the same reef in real 3D. Every creature is modelled (lofted bodies, fanned fins that ripple, tails that
// beat, a jelly's pulsing bell, a puffer's spines, the lurejaw's dropping jaw and lure) and lit like paint under a black light:
// dark bodies with glowing rims and markings, translucent glowing fins. The reef is built from the Original's own layout
// (branching coral, sea fans, sponges, brain coral, glowing mushrooms, rocks, sea grass, anemones, kelp, urchins) and goes on
// behind it into a seabed that rolls away into the dark; moonlight shafts and the rippling underside of the surface overhead;
// plankton that lights up where you swim; bloom and a film grade. Loaded only when the graphics switch is on 3D; the page keeps
// drawing the score pop-ups, warnings and joystick on top.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

const U = 1 / 40;   // world units to 3D units
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lin = (c, k = 1, o = new THREE.Color()) => o.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace).multiplyScalar(k);
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
const mulc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// ---------- geometry: lofted bodies and fanned fins, all carrying the attributes the swim shader animates ----------
const ATTRS = ["position", "normal", "uv", "aU", "aPart", "aEdge", "aRay"], SIZES = { position: 3, normal: 3, uv: 2 };
function mk(pos, uv, au, part, edge, ray, idx, mat) {
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(pos.length).fill(0), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("aU", new THREE.Float32BufferAttribute(au, 1)); g.setAttribute("aPart", new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1)); g.setAttribute("aRay", new THREE.Float32BufferAttribute(ray, 1)); g.setIndex(idx); g.userData.mat = mat; g.computeVertexNormals(); return g;
}
// a body lofted along a path: prof(t) gives the centre x, y, the half-height and half-width at t (0 = nose, 1 = tail joint)
function loft(prof, { NX = 18, NR = 14, part = 0, mat = 0, uOf = (t) => t, tan = null } = {}) {
  const pos = [], uv = [], au = [], pt = [], ed = [], ry = [], idx = [];
  for (let i = 0; i <= NX; i++) { const t = i / NX, [x, y, h, w] = prof(t); let nx = 0, ny = 1; if (tan) { const [tx, ty] = tan(t), l = Math.hypot(tx, ty) || 1; nx = -ty / l; ny = tx / l; }
    for (let j = 0; j <= NR; j++) { const a = (j / NR) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pos.push(x + nx * c * h, y + ny * c * h, s * w); uv.push(t, j / NR); au.push(uOf(t)); pt.push(part); ed.push(0); ry.push(j / NR); } }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NR; j++) { const a = i * (NR + 1) + j, b = a + NR + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return mk(pos, uv, au, pt, ed, ry, idx, mat);
}
// a fin: a fan of triangles from its root to its outline; aEdge runs 0 at the root to 1 at the edge, aRay along the outline
function fin(root, outline, { part = 1, mat = 1, uOf = (x) => clamp((0.5 - x) / 0.82, 0, 1.6), m = null } = {}) {
  const P = [root, ...outline].map(([x, y, z = 0]) => { const v = new THREE.Vector3(x, y, z); if (m) v.applyMatrix4(m); return v; });
  const pos = [], uv = [], au = [], pt = [], ed = [], ry = [], idx = [], n = outline.length;
  P.forEach((v, i) => { pos.push(v.x, v.y, v.z); uv.push(i ? (i - 1) / (n - 1) : 0.5, i ? 1 : 0); au.push(uOf(v.x)); pt.push(part); ed.push(i ? 1 : 0); ry.push(i ? (i - 1) / (n - 1) : 0.5); });
  for (let i = 1; i < n; i++) idx.push(0, i, i + 1);
  return mk(pos, uv, au, pt, ed, ry, idx, mat);
}
// three.js shapes given the same attributes
function std(g, { part = 0, mat = 0, uOf = () => 0, edge = () => 0, m = null } = {}) {
  if (m) g.applyMatrix4(m); const p = g.attributes.position, n = p.count, au = new Float32Array(n), pt = new Float32Array(n).fill(part), ed = new Float32Array(n), ry = new Float32Array(n);
  for (let i = 0; i < n; i++) { au[i] = uOf(p.getX(i), p.getY(i), p.getZ(i)); ed[i] = edge(p.getX(i), p.getY(i), p.getZ(i)); ry[i] = (i % 7) / 7; }
  g.setAttribute("aU", new THREE.BufferAttribute(au, 1)); g.setAttribute("aPart", new THREE.BufferAttribute(pt, 1)); g.setAttribute("aEdge", new THREE.BufferAttribute(ed, 1)); g.setAttribute("aRay", new THREE.BufferAttribute(ry, 1));
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2)); if (!g.index) g.setIndex([...Array(n).keys()]); g.userData.mat = mat; return g;
}
function merge(list) {
  list.sort((a, b) => a.userData.mat - b.userData.mat);
  const arr = {}; for (const n of ATTRS) arr[n] = []; const idx = [], groups = []; let off = 0;
  for (const g of list) { for (const n of ATTRS) { const a = g.attributes[n].array; for (let i = 0; i < a.length; i++) arr[n].push(a[i]); }
    const ix = g.index.array, s = idx.length; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off); const m = g.userData.mat, last = groups[groups.length - 1];
    if (last && last[2] === m) last[1] += ix.length; else groups.push([s, ix.length, m]); off += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); for (const n of ATTRS) out.setAttribute(n, new THREE.Float32BufferAttribute(arr[n], SIZES[n] || 1));
  out.setIndex(idx); for (const [s, c, m] of groups) out.addGroup(s, c, m); out.computeBoundingSphere(); out.boundingSphere.radius = 3; return out;
}
const qb = (p0, p1, p2, n) => { const o = []; for (let i = 1; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; o.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], 0]); } return o; };
function envAt(E, t) { for (let i = 1; i < E.length; i++) if (t <= E[i][0]) { const [t0, v0] = E[i - 1], [t1, v1] = E[i], u = (t - t0) / (t1 - t0), s = u * u * (3 - 2 * u); return v0 + (v1 - v0) * s; } return E[E.length - 1][1]; }
const ENV = [[0, 0.04], [0.05, 0.42], [0.18, 0.84], [0.36, 1], [0.58, 0.88], [0.8, 0.55], [1, 0.2]];
// a fish: lofted body, forked tail, dorsal and anal fins, two pectoral fins (units: length 1, nose at +x)
function fishGeo(o) {
  const tx = o.tx ?? -0.32, E = o.env || ENV, hb = o.hb, wb = o.wb, L = o.tail, sp = hb * (o.spread || 1.05);
  const parts = [loft((t) => { const e = envAt(E, t); return [lerp(0.5, tx, t), (o.dy || 0) * e, hb * e, wb * e]; }, { NX: o.nx || 18, NR: o.nr || 14 })];
  const top = [tx + 0.03, hb * 0.18], bot = [tx + 0.03, -hb * 0.18], up = [tx - L, sp * (o.upper || 1)], dn = [tx - L, -sp], notch = [tx - L * (o.fork ?? 0.55), 0];
  parts.push(fin([tx + 0.02, 0], [top, ...qb(top, [tx - L * 0.45, sp * 0.5], up, 6), ...qb(up, [tx - L * 0.8, sp * 0.3], notch, 4), ...qb(notch, [tx - L * 0.8, -sp * 0.3], dn, 4), ...qb(dn, [tx - L * 0.45, -sp * 0.5], bot, 6)]));
  const d0 = [0.05, hb * 0.93], d1 = [-0.06 + (o.dorsalX || 0), hb * (1 + (o.dorsal ?? 0.5))], d2 = [-0.24, hb * 0.5];
  parts.push(fin([-0.1, hb * 0.8], [d0, ...qb(d0, [0.02, hb * (1 + (o.dorsal ?? 0.5) * 0.8)], d1, 5), ...qb(d1, [-0.16, hb * (0.9 + (o.dorsal ?? 0.5) * 0.4)], d2, 5)]));
  const a0 = [-0.04, -hb * 0.88], a1 = [-0.14, -hb * (1 + (o.anal ?? 0.35))], a2 = [-0.24, -hb * 0.5];
  parts.push(fin([-0.13, -hb * 0.75], [a0, ...qb(a0, [-0.08, -hb * (1 + (o.anal ?? 0.35) * 0.8)], a1, 4), ...qb(a1, [-0.2, -hb * 0.9], a2, 4)]));
  for (const s of [-1, 1]) { const m = new THREE.Matrix4().makeRotationX(s * 0.5).premultiply(new THREE.Matrix4().makeTranslation(0, 0, s * wb * 0.85));
    parts.push(fin([0.16, -hb * 0.12], [[0.18, -hb * 0.05], ...qb([0.18, -hb * 0.05], [0.12, -hb * 0.4], [0.02, -hb * (0.42 + (o.pect || 0.15))], 4), ...qb([0.02, -hb * (0.42 + (o.pect || 0.15))], [0.08, -hb * 0.2], [0.13, -hb * 0.15], 3)], { m })); }
  return parts;
}

// ---------- shaders ----------
const SWIM = `attribute float aU; attribute float aPart; attribute float aEdge; attribute float aRay; attribute float aPhase; attribute float aAux;
  uniform float uAmp, uWave, uKind, uT;
  vec3 swim(vec3 p) {
    if (uKind == 1.0) p.y += sin(aPhase - aU * 6.5) * 0.05 * (0.25 + aU);
    else if (uKind == 2.0) { float pl = max(0.0, sin(aAux));
      if (aPart < 0.5) { p.xz *= 1.0 - pl * 0.14; p.y *= 1.0 + pl * 0.16; }
      else { float k = max(0.0, -p.y); p.x += sin(uT * 2.2 + k * 5.0 + aRay * 7.0) * 0.05 * k; p.z += cos(uT * 1.7 + k * 4.0 + aRay * 5.0) * 0.04 * k; p.y *= 1.0 - pl * 0.12; } }
    else if (uKind == 5.0) p.y += sin(aPhase) * 0.13 * pow(min(1.0, abs(p.z) / 0.5), 1.6);
    else p.z += sin(aPhase - aU * uWave) * uAmp * aU * aU;
    if (uKind == 3.0 && aPart > 1.5 && aPart < 2.5) p += normalize(p + vec3(0.0001)) * aAux * 0.12 * aEdge;
    if (uKind == 4.0 && aPart > 2.5 && aPart < 3.5) { float a = aAux * 0.6; vec2 c = vec2(0.02, -0.05), d = p.xy - c; p.xy = c + vec2(d.x * cos(a) + d.y * sin(a), -d.x * sin(a) + d.y * cos(a)); }
    if (aPart > 0.5 && aPart < 1.5 && uKind != 2.0) p.z += sin(aPhase * 1.6 + aRay * 3.0) * 0.02 * aEdge;
    return p; }`;
function bodyMat(rim, kind, o = {}) {   // a dark body lit at the rim like black-light paint, with glowing markings
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: o.map || null, emissiveMap: o.emi || null, emissive: o.emi ? 0xffffff : 0x000000, roughness: 0.32, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const u = { uAmp: { value: o.amp ?? 0.05 }, uWave: { value: o.wave ?? 3.2 }, uKind: { value: kind }, uT: { value: 0 }, uRim: { value: lin(rim, o.rimK ?? 3.2) }, uRimK: { value: 1 }, uEmK: { value: o.emK ?? 2.4 } };
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u);
    sh.vertexShader = SWIM + "\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n transformed = swim(transformed);");
    sh.fragmentShader = "uniform vec3 uRim; uniform float uRimK, uEmK;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance *= uEmK; { float fr = 1.0 - abs(dot(normal, normalize(vViewPosition))); totalEmissiveRadiance += uRim * uRimK * pow(fr, 2.1); }"); };
  m.customProgramCacheKey = () => "nr-body"; m.userData.u = u; return m;
}
function glowMat(col, kind, o = {}) {   // translucent glowing fins, spines, tentacles: bright edges, faint membrane, fin rays
  const u = { uAmp: { value: o.amp ?? 0.05 }, uWave: { value: o.wave ?? 3.2 }, uKind: { value: kind }, uT: { value: 0 }, uC: { value: lin(col, 1) }, uK: { value: o.k ?? 1.4 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: SWIM + `varying float vE; varying float vR; void main(){ vE = aEdge; vR = aRay; vec3 p = swim(position); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uC; uniform float uK; varying float vE; varying float vR; void main(){ float rays = 0.5 + 0.5 * sin(vR * 70.0); float b = 0.14 + 0.4 * rays * vE + 1.7 * pow(vE, 5.0); gl_FragColor = vec4(uC * b * uK, 1.0); }` });
  m.userData.u = u; return m;
}
function bellMat(col) {   // a jelly's bell: clear in the middle, glowing at the rim
  const u = { uAmp: { value: 0 }, uWave: { value: 0 }, uKind: { value: 2 }, uT: { value: 0 }, uC: { value: lin(col, 1) } };
  const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: SWIM + `varying vec3 vN, vV; void main(){ vec3 p = swim(position); vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; varying vec3 vN, vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), vV)); gl_FragColor = vec4(uC * (0.1 + 1.6 * f * f), 1.0); }` });
  m.userData.u = u; return m;
}
// painted markings: u runs along the body, v around it (0 top, 0.25 the side facing you, 0.5 belly, 0.75 the far side)
function paint(c1, c2, o = {}) {
  const w = 512, h = 128, A = document.createElement("canvas"), B = document.createElement("canvas"); A.width = B.width = w; A.height = B.height = h;
  const a = A.getContext("2d"), b = B.getContext("2d");
  const bodyc = mixc(mulc(c1, 0.22), [6, 3, 26], 0.45); a.fillStyle = css(bodyc); a.fillRect(0, 0, w, h);
  const gr = a.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,.35)"); gr.addColorStop(0.5, css(mulc(c1, 0.35), 0.5)); gr.addColorStop(1, "rgba(0,0,0,.35)"); a.fillStyle = gr; a.fillRect(0, 0, w, h);
  b.fillStyle = "#000"; b.fillRect(0, 0, w, h); b.fillStyle = css(mulc(c1, 0.12)); b.fillRect(0, 0, w, h);
  const glow = (fn, c, blur = 6) => { b.save(); b.shadowColor = css(c); b.shadowBlur = blur; b.fillStyle = css(c); b.strokeStyle = css(c); fn(b); b.restore(); };
  const both = (v, fn) => { fn(v * h); fn((1 - v) * h); };   // the same marking on both sides (round the body of a lofted fish)
  if (o.stripe) glow((g) => { both(0.2, (y) => { g.fillRect(20, y - 3, w * 0.9, 6); }); }, o.stripe, 8);
  if (o.dots) glow((g) => { for (let i = 0; i < 8; i++) both(0.36, (y) => { g.beginPath(); g.ellipse(80 + i * 46, y, 9, 4, 0, 0, Math.PI * 2); g.fill(); }); }, o.dots, 10);
  if (o.spot) glow((g) => both(0.24, (y) => { g.beginPath(); g.ellipse(w * 0.42, y, 30, 10, 0, 0, Math.PI * 2); g.fill(); }), o.spot, 14);
  if (o.spots) glow((g) => { for (let i = 0; i < 26; i++) { const x = 30 + ((i * 97) % (w - 60)), y = 10 + ((i * 53) % (h - 20)); g.beginPath(); g.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2); g.fill(); } }, o.spots, 8);
  if (o.bands) glow((g) => { for (let i = 0; i < 12; i++) g.fillRect(20 + i * 40, 0, 5, h); }, o.bands, 6);
  if (o.gills) glow((g) => both(0.25, (y) => { for (let i = 0; i < 4; i++) g.fillRect(w * 0.2 + i * 14, y - 12, 4, 24); }), o.gills, 8);
  if (o.chev) glow((g) => both(0.25, (y) => { g.lineWidth = 4; for (let i = 0; i < 3; i++) { const x = w * 0.42 + i * 34; g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 14, y); g.lineTo(x, y + 14); g.stroke(); } }), o.chev, 8);
  if (o.lateral) glow((g) => both(0.13, (y) => { g.fillRect(30, y - 2, w * 0.85, 4); }), o.lateral, 8);
  if (o.teeth) both(0.36, (y) => { b.fillStyle = "#fff"; a.fillStyle = "#e8f4ff"; for (let i = 0; i < 9; i++) { const x = 8 + i * 13; for (const g of [a, b]) { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y + 7); g.lineTo(x + 12, y - 6); g.fill(); } } });
  if (o.eye !== false) { const eu0 = (o.eyeU ?? 0.13) * w, ev = o.eyeV ?? 0.17, rx = o.eyeRX ?? 26, ry = o.eyeRY ?? 9, iris = o.iris || c2;
    const at = o.sphere ? (fn) => { fn(eu0, ev * h); fn(w - eu0, ev * h); } : (fn) => { fn(eu0, ev * h); fn(eu0, (1 - ev) * h); };   // a sphere's eyes sit left and right of its front
    at((eu, y) => { a.fillStyle = "#f4fbff"; a.beginPath(); a.ellipse(eu, y, rx, ry, 0, 0, Math.PI * 2); a.fill(); a.fillStyle = "#04021a"; a.beginPath(); a.ellipse(eu - rx * 0.1, y, rx * 0.5, ry * 0.55, 0, 0, Math.PI * 2); a.fill();
      b.save(); b.shadowColor = css(iris); b.shadowBlur = 10; b.fillStyle = css(mixc(iris, [255, 255, 255], 0.3)); b.beginPath(); b.ellipse(eu, y, rx, ry, 0, 0, Math.PI * 2); b.fill(); b.restore();
      b.fillStyle = "#000"; b.beginPath(); b.ellipse(eu - rx * 0.1, y, rx * 0.5, ry * 0.55, 0, 0, Math.PI * 2); b.fill(); b.fillStyle = "#fff"; b.beginPath(); b.ellipse(eu - rx * 0.3, y - ry * 0.3, rx * 0.16, ry * 0.2, 0, 0, Math.PI * 2); b.fill(); }); }
  const t = (c) => { const x = new THREE.CanvasTexture(c); x.colorSpace = THREE.SRGBColorSpace; x.flipY = false; x.anisotropy = 4; return x; };
  return { map: t(A), emi: t(B) };
}

export function attach(S) {
  const q = K.tier(), CALM = () => !!window.ARCADE_CALM, NEON = S.NEON;
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04021a); scene.fog = new THREE.FogExp2(0x04021a, 0.02);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 300);
  const hemi = new THREE.HemisphereLight(0x9a80ff, 0x120a28, 0.75); scene.add(hemi);
  const moonL = new THREE.DirectionalLight(0xc8dcff, 0.9); moonL.position.set(-4, 12, 7); scene.add(moonL);
  const X = (x) => x * U, Y = (y) => -y * U, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), QR = new THREE.Quaternion(), V = new THREE.Vector3(), V2 = new THREE.Vector3(), SC = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color(), UPV = new THREE.Vector3(0, 1, 0);
  const soft = K.softTexture();
  const time = () => S.time;

  // ---------- the water behind everything, the sky above it, the surface overhead ----------
  const WATER_GLSL = `uniform vec3 uS0, uS1, uS2, uC1; uniform float uWH;
    vec3 water(float y) { float u = clamp(y / uWH, 0.0, 1.0); vec3 top = mix(uS1 * 0.85, uS2, 0.1), mid = uS1 * 0.5, deep = mix(uS0 * 0.7, vec3(0.0, 0.0, 0.02), 0.3);
      return u < 0.42 ? mix(top, mid, u / 0.42) : mix(mid, deep, (u - 0.42) / 0.58); }`;
  const pal = { uS0: { value: new THREE.Color() }, uS1: { value: new THREE.Color() }, uS2: { value: new THREE.Color() }, uC1: { value: new THREE.Color() }, uWH: { value: S.WH }, uT: { value: 0 } };
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: pal, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: WATER_GLSL + `uniform float uT; varying vec3 vW; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){ float y = -vW.y * 40.0; vec3 c;
        if (y >= 0.0) c = water(y);
        else { c = mix(mix(uC1, uS2, 0.12), uS0 * 0.6, clamp(-y / 900.0, 0.0, 1.0)); vec2 g = floor(vW.xy * 3.0); float s = h(g); if (s > 0.985) c += vec3(0.8) * (0.4 + 0.6 * abs(sin(uT * 0.8 + s * 50.0))) * (1.0 - smoothstep(0.08, 0.25, length(fract(vW.xy * 3.0) - 0.5))); }
        gl_FragColor = vec4(c, 1.0); }` }));
  back.renderOrder = -2; scene.add(back);
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 70, 1, 1), new THREE.ShaderMaterial({ uniforms: pal, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: WATER_GLSL + `uniform float uT; varying vec3 vW;
      void main(){ vec2 p = vW.xz * vec2(0.9, 1.6); float r = 0.0; for (int i = 0; i < 3; i++) { p += vec2(sin(p.y * 1.3 + uT * 0.8), cos(p.x * 1.1 - uT * 0.7)) * 0.45; r += 0.5 / (0.12 + abs(sin(p.x + p.y)) * 5.0); }
        float fade = exp(vW.z * 0.06); vec3 c = water(0.0) * 0.7 + mix(uS2, vec3(1.0), 0.5) * r * 0.05 * fade; gl_FragColor = vec4(mix(water(0.0), c, fade), 1.0); }` }));
  surface.rotation.x = Math.PI / 2; surface.position.set(0, 0, -35); surface.renderOrder = -1; scene.add(surface);
  const waterline = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 2.1, 2.3), fog: false })); waterline.rotation.z = Math.PI / 2; scene.add(waterline);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(0.9, 0.95, 1.1), depthWrite: false, fog: false, transparent: true })); moon.scale.setScalar(9); scene.add(moon);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.55, 1.7), fog: false })); scene.add(moonDisc);
  // moonlight shafts from the surface
  const shaftTex = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = "destination-in"; const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, "rgba(0,0,0,0)"); gx.addColorStop(0.5, "rgba(0,0,0,1)"); gx.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gx; g.fillRect(0, 0, 64, 256); return new THREE.CanvasTexture(c); })();
  const shafts = Array.from({ length: 7 }, (_, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffffff }));
    m.userData = { off: (i - 3) * 9 + (i % 2) * 3, z: -2 - (i % 4) * 3.5, w: 1.4 + (i % 3) * 1.1, len: 22 + (i % 3) * 8, ph: i * 1.7 }; scene.add(m); return m; });

  // ---------- the seabed: the game's floor at the front, rolling hills behind ----------
  const FZ = [3, 1.2, 0, -1, -2.5, -4.5, -7, -10.5, -15, -20, -26, -33, -42];
  const terr = (x, z) => { const base = S.floorY(clamp(x, 0, S.WW)); if (z >= 0) return base + z * 34;
    const b = -z, k = 1 - Math.exp(-b * 0.09), hills = (Math.sin(x * 0.0021 + b * 0.13) * 0.5 + 0.5) * 300 + (Math.sin(x * 0.0057 - b * 0.31) * 0.5 + 0.5) * 150 + Math.sin(x * 0.019 + b) * 14;
    return base - k * hills - b * 2.2; };
  const floorU = { uCaus: { value: new THREE.Color() }, uT: { value: 0 } };
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x302848, roughness: 0.95, metalness: 0 });
  floorMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, floorU);
    sh.vertexShader = "varying vec3 vWp;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = "varying vec3 vWp; uniform vec3 uCaus; uniform float uT;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      { vec2 p = vWp.xz * 0.55; float c = 0.0; for (int i = 0; i < 3; i++) { p += vec2(sin(p.y * 1.4 + uT * 0.5), cos(p.x * 1.2 - uT * 0.45)) * 0.5; c += 0.35 / (0.1 + abs(sin(p.x + p.y)) * 6.0); }
        float sp = step(0.985, fract(sin(dot(floor(vWp.xz * 9.0), vec2(12.9898, 78.233))) * 43758.5453)) * (0.5 + 0.5 * sin(uT * 3.0 + vWp.x * 7.0));
        totalEmissiveRadiance += uCaus * (c * 0.1 + sp * 1.2) * exp(min(vWp.z, 0.0) * 0.08); }`); };
  let floorMesh = null, rimMesh = null;
  function buildFloor() {
    if (floorMesh) { scene.remove(floorMesh); floorMesh.geometry.dispose(); } if (rimMesh) { scene.remove(rimMesh); rimMesh.geometry.dispose(); }
    const xs = []; for (let x = -1000; x <= S.WW + 1000; x += 40) xs.push(x);
    const pos = [], idx = [], nz = FZ.length;
    for (const x of xs) for (const z of FZ) pos.push(X(x), Y(terr(x, z)), z);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < nz - 1; j++) { const a = i * nz + j, b = a + nz; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    floorMesh = new THREE.Mesh(g, floorMat); floorMesh.frustumCulled = false; scene.add(floorMesh);
    const pts = []; for (let x = 0; x <= S.WW; x += 30) pts.push(new THREE.Vector3(X(x), Y(S.floorY(x)) + 0.02, 0.05));
    rimMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.035, 5, false), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); rimMesh.frustumCulled = false; scene.add(rimMesh);
  }

  // ---------- the reef: instanced coral, fans, sponges, brain coral, mushrooms, rocks, grass and anemone arms, urchins, kelp ----------
  const glowInst = (mat, k) => { mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      #if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )
      totalEmissiveRadiance = vColor * ${k.toFixed(2)};
      #endif`); }; mat.customProgramCacheKey = () => "nr-glow" + k; return mat; };
  const inst = (g, mat, n) => { const m = new THREE.InstancedMesh(g, mat, n); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, C.set(0)); scene.add(m); return m; };
  const segG = new THREE.CylinderGeometry(0.72, 1, 1, 6, 1, true); segG.translate(0, 0.5, 0);
  const seg = inst(segG, glowInst(new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.5 }), 0.55), 4200);
  const tip = inst(new THREE.IcosahedronGeometry(1, 0), glowInst(new THREE.MeshStandardMaterial({ color: 0x222222 }), 1.5), 3200);
  const fanTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.strokeStyle = "#fff"; g.lineCap = "round"; g.shadowColor = "#fff"; g.shadowBlur = 4;
    for (let i = 0; i <= 12; i++) { const a = Math.PI + 0.25 + (i / 12) * (Math.PI - 0.5); g.lineWidth = 3; g.beginPath(); g.moveTo(128, 250); g.lineTo(128 + Math.cos(a) * 240, 250 + Math.sin(a) * 240); g.stroke(); }
    for (let j = 1; j <= 5; j++) { g.lineWidth = 2; g.beginPath(); g.arc(128, 250, (240 * j) / 5.4, Math.PI + 0.25, Math.PI * 2 - 0.25); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const fanG = new THREE.PlaneGeometry(2, 1); fanG.translate(0, 0.5, 0);
  const fan = inst(fanG, new THREE.MeshBasicMaterial({ map: fanTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 320);
  const tubeG = new THREE.CylinderGeometry(1, 1.15, 1, 12, 1, true); tubeG.translate(0, 0.5, 0);
  const tube = inst(tubeG, new THREE.MeshStandardMaterial({ color: 0x1c1236, roughness: 0.6, side: THREE.DoubleSide }), 600);
  const rimG = new THREE.TorusGeometry(1, 0.1, 4, 12); rimG.rotateX(Math.PI / 2);
  const rim = inst(rimG, glowInst(new THREE.MeshStandardMaterial({ color: 0x222222 }), 2.2), 600);
  const discG = new THREE.CircleGeometry(0.95, 16); discG.rotateX(-Math.PI / 2);
  const disc = inst(discG, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 600);
  const mazeTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "#fff"; g.lineWidth = 3; g.shadowColor = "#fff"; g.shadowBlur = 5;
    for (let i = 0; i < 18; i++) { g.beginPath(); for (let x = 0; x <= 256; x += 4) { const y = i * 14 + Math.sin(x * 0.07 + i * 1.7) * 5; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const brainMat = new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.55, emissiveMap: mazeTex, emissive: 0xffffff });
  brainMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n #if defined( USE_COLOR )\n totalEmissiveRadiance *= vColor * 1.6;\n #endif"); }; brainMat.customProgramCacheKey = () => "nr-brain";
  const brain = inst(new THREE.SphereGeometry(1, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2), brainMat, 220);
  const capG = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); capG.scale(1, 0.45, 1);
  const cap = inst(capG, glowInst(new THREE.MeshStandardMaterial({ color: 0x222222 }), 1.25), 300);
  const rockG = new THREE.DodecahedronGeometry(1, 0); rockG.translate(0, 0.25, 0);
  const rock = inst(rockG, new THREE.MeshStandardMaterial({ color: 0x241a3a, roughness: 0.9, flatShading: true }), 260);
  const bladeG = new THREE.ConeGeometry(1, 1, 3, 3, true); bladeG.translate(0, 0.5, 0);
  const bladeU = { uT: { value: 0 } }, bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide });
  bladeMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, bladeU);
    sh.vertexShader = "uniform float uT; varying float vH;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vH = position.y; float ph = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 2.3; transformed.x += sin(uT * 1.5 + ph) * 0.45 * position.y * position.y; transformed.z += cos(uT * 1.2 + ph) * 0.2 * position.y * position.y;`);
    sh.fragmentShader = "varying float vH;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n #if defined( USE_COLOR )\n totalEmissiveRadiance = vColor * (0.35 + 2.2 * pow(vH, 4.0));\n #endif"); };
  bladeMat.customProgramCacheKey = () => "nr-blade";
  const blade = inst(bladeG, bladeMat, 3600);
  const urchinG = (() => { const parts = [std(new THREE.SphereGeometry(0.5, 12, 8), { edge: () => 0 })];
    for (let i = 0; i < 46; i++) { const a = Math.acos(1 - 2 * ((i + 0.5) / 46)), b = i * 2.39996, d = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)), g = new THREE.ConeGeometry(0.05, 0.9, 4); g.translate(0, 0.45 + 0.4, 0);
      parts.push(std(g, { m: new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, d)), edge: (x, y, z) => clamp((Math.hypot(x, y, z) - 0.45) / 0.9, 0, 1) })); }
    return merge(parts); })();
  const urchinMat = new THREE.MeshStandardMaterial({ color: 0x140820, roughness: 0.5 });
  urchinMat.onBeforeCompile = (sh) => { sh.vertexShader = "attribute float aEdge; varying float vE;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vE = aEdge;");
    sh.fragmentShader = "varying float vE;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.17, 0.84) * (0.15 + 2.4 * vE);"); }; urchinMat.customProgramCacheKey = () => "nr-urchin";
  const urchin = inst(urchinG, urchinMat, 24);
  const kseg = inst(segG, glowInst(new THREE.MeshStandardMaterial({ color: 0x0c1a1c, roughness: 0.6 }), 0.28), 900);
  const leafTex = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d"); g.fillStyle = "rgba(255,255,255,.18)"; g.strokeStyle = "#fff"; g.lineWidth = 4; g.shadowColor = "#fff"; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(32, 252); g.quadraticCurveTo(2, 120, 32, 4); g.quadraticCurveTo(62, 120, 32, 252); g.fill(); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(32, 250); g.lineTo(32, 10); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const leafG = new THREE.PlaneGeometry(0.34, 1); leafG.translate(0, 0.5, 0);
  const leaf = inst(leafG, new THREE.MeshBasicMaterial({ map: leafTex, color: 0x777777, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 900);
  const statics = [seg, tip, fan, tube, rim, disc, brain, cap, rock, blade, urchin];
  let kelp3 = [];
  // one reef, front and back: the Original's layout along the game's floor, and a bigger reef behind it fading into the dark
  function buildReef() {
    for (const m of statics) m.count = 0;
    let rs = 99 + S.dive * 31; const R = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
    const put = (m, p, q, s, col) => { if (m.count >= m.instanceMatrix.count) return; M.compose(V.set(...p), q || Q.identity(), SC.set(...s)); m.setMatrixAt(m.count, M); m.setColorAt(m.count, col); m.count++; };
    const segTo = (a, b, r, col) => { const d = V.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length(); Q.setFromUnitVectors(UPV, d.normalize()); put(seg, a, Q, [r, len, r], col); };
    const colOf = (c, k = 1) => lin(c, k, new THREE.Color());
    const item = (d, x, z, s, r, rich) => {
      const y = Y(terr(x, z)), x3 = X(x), sz = s * U, c1 = colOf(d.c), c2 = colOf(d.c2);
      if (d.type === "branch") {
        const rec = (p, dir, len, rad, depth) => { const e = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len]; segTo(p, e, rad, c1);
          if (depth > 0) { const n = 2 + (r() < 0.35 ? 1 : 0); for (let i = 0; i < n; i++) { const nd = [dir[0] + (r() - 0.5) * 1.1, dir[1] + 0.35, dir[2] + (r() - 0.5) * 1.1], l = Math.hypot(...nd); rec(e, nd.map((v) => v / l), len * (0.62 + r() * 0.16), rad * 0.7, depth - 1); } }
          else put(tip, e, null, [rad * 2.4, rad * 2.4, rad * 2.4], c2); };
        for (let i = 0; i < 3; i++) { const dir = [(r() - 0.5) * 0.7, 1, (r() - 0.5) * 0.7], l = Math.hypot(...dir); rec([x3 + (i - 1) * sz * 0.12, y, z + (r() - 0.5) * sz * 0.2], dir.map((v) => v / l), sz * 0.34, sz * 0.04, rich ? 3 : 2); }
      } else if (d.type === "fan") { Q.setFromEuler(E.set(0, (r() - 0.5) * 1.0, 0)); put(fan, [x3, y - 0.05, z], Q.clone(), [sz * 0.6, sz * 0.62, 1], c1);
      } else if (d.type === "tube") { const n = 3 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) { const tw = (5 + r() * 5) * U * 0.55, th = sz * (0.45 + r() * 0.75), px = x3 + (i - (n - 1) / 2) * tw * 2.6, pz = z + (r() - 0.5) * tw * 3;
          put(tube, [px, y - 0.05, pz], null, [tw, th, tw], c1); put(rim, [px, y + th - 0.03, pz], null, [tw * 1.02, tw * 1.02, tw * 1.02], c2); put(disc, [px, y + th - 0.04, pz], null, [tw, 1, tw], colOf(d.c2, 0.6)); }
      } else if (d.type === "brain") { put(brain, [x3, y - 0.05, z], null, [sz * 0.6, sz * 0.42, sz * 0.5], c1);
      } else if (d.type === "shroom") { const n = 2 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) { const cw = (7 + r() * 9) * U, st = sz * (0.2 + r() * 0.5), px = x3 + (r() - 0.5) * sz * 0.7, pz = z + (r() - 0.5) * sz * 0.4;
          segTo([px, y - 0.05, pz], [px, y + st, pz], cw * 0.18, c1); put(cap, [px, y + st, pz], null, [cw, cw, cw], c2); }
      } else if (d.type === "rock") { Q.setFromEuler(E.set(r(), r() * 3, r())); put(rock, [x3, y - 0.1, z], Q.clone(), [sz * 0.55, sz * 0.38, sz * 0.45], C.set(0.7, 0.62, 0.85));
        for (let i = 0; i < 9; i++) { const a = r() * Math.PI, rr = r() * 0.85; put(tip, [x3 + Math.cos(a) * sz * 0.5 * rr, y + Math.sin(a) * sz * 0.36 * rr, z + sz * 0.3 * (r() - 0.2)], null, [0.04, 0.04, 0.04], c2); }
      } else if (d.type === "grass") { for (let i = 0; i < 9; i++) { Q.setFromEuler(E.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.6)); put(blade, [x3 + (r() - 0.5) * sz * 0.6, y - 0.05, z + (r() - 0.5) * sz * 0.4], Q.clone(), [0.025, sz * (0.35 + r() * 0.6), 0.012], i % 2 ? c1 : c2); }
      } else {   // anemone: a ring of glowing arms
        put(cap, [x3, y - 0.05, z], null, [sz * 0.22, sz * 0.25, sz * 0.18], colOf(d.c, 0.4));
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; Q.setFromEuler(E.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55)); put(blade, [x3 + Math.cos(a) * sz * 0.1, y + sz * 0.04, z + Math.sin(a) * sz * 0.08], Q.clone(), [0.03, sz * 0.5, 0.03], i % 2 ? c1 : c2); }
      }
    };
    for (const d of S.decor) { let s = d.seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; item(d, d.x, -0.35 - r() * 1.4, d.s, r, true); }
    for (const m of statics) m.userData.front = m.count;
    const types = ["branch", "fan", "tube", "brain", "anemone", "shroom", "rock", "grass", "branch", "fan"], P = S.pal, cols = [P.a, P.b, P.s2, NEON.pink, NEON.lime, NEON.cyan, NEON.orange, NEON.violet, NEON.aqua, NEON.yellow];
    for (let i = 0; i < (q === "high" ? 150 : 90); i++) { const x = -600 + R() * (S.WW + 1200), z = -3 - R() * 22, d = { type: types[Math.floor(R() * types.length)], c: cols[Math.floor(R() * cols.length)], c2: cols[Math.floor(R() * cols.length)] }; item(d, x, z, (40 + R() * 70) * (1 + (-z) * 0.04), R, false); }
    for (const u of S.urchins) put(urchin, [X(u.x), Y(S.floorY(u.x) - u.s * 0.45), -0.1], null, [u.s * 0.42 * U, u.s * 0.42 * U, u.s * 0.42 * U], C.set(1, 1, 1));
    for (const m of statics) { m.userData.all = m.count; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    kelp3 = S.kelp.map((k) => ({ ...k, z: -0.4 - R() * 1.6 }));
    const kc = [P.a, P.b, NEON.lime, NEON.aqua]; for (let i = 0; i < 26; i++) kelp3.push({ x: -400 + R() * (S.WW + 800), h: 200 + R() * 420, ph: R() * 6.3, w: 6 + R() * 5, c: kc[Math.floor(R() * 4)], z: -5 - R() * 16 });
  }

  // ---------- the creatures ----------
  const SPEC = {
    fry: { k: 0, max: 80, amp: 0.07, wave: 3, g: () => fishGeo({ hb: 0.17, wb: 0.08, tail: 0.18, dorsal: 0.45 }), pat: { spot: 1, eyeU: 0.12, eyeRX: 34, eyeRY: 13 } },
    dart: { k: 0, max: 50, amp: 0.06, wave: 3.2, g: () => fishGeo({ hb: 0.12, wb: 0.06, tail: 0.22, fork: 0.7, dorsal: 0.4 }), pat: { stripe: 1, eyeU: 0.11, eyeRX: 26, eyeRY: 13 } },
    lantern: { k: 0, max: 30, amp: 0.05, wave: 3, g: () => fishGeo({ hb: 0.24, wb: 0.12, tail: 0.2, dorsal: 0.7 }), pat: { dots: 1, eyeU: 0.13, eyeRX: 30, eyeRY: 10 } },
    horse: { k: 6, max: 12, amp: 0, g: horseGeo, pat: { bands: 1, eye: false } },
    shrimp: { k: 6, max: 30, amp: 0, g: shrimpGeo, pat: { bands: 1, eye: false } },
    puff: { k: 3, max: 14, amp: 0, g: puffGeo, pat: { spots: 1, sphere: true, eyeU: 0.37, eyeV: 0.6, eyeRX: 22, eyeRY: 12 } },
    jelly: { k: 2, max: 18, g: jellyGeo, jelly: true },
    eel: { k: 1, max: 12, g: eelGeo, pat: { stripe: 1, eyeU: 0.05, eyeV: 0.2, eyeRX: 14, eyeRY: 14 } },
    gulper: { k: 4, max: 10, amp: 0.035, wave: 2.6, rimK: 2.2, emK: 1.4, g: gulperGeo, pat: { dots: 1, eyeU: 0.2, eyeV: 0.12, eyeRX: 18, eyeRY: 10, iris: 1 }, lure: true },
    ray: { k: 5, max: 10, g: rayGeo, pat: { spots: 2, eye: false } },
    gloom: { k: 0, max: 5, amp: 0.035, wave: 2.4, rimK: 2.6, g: () => fishGeo({ hb: 0.135, wb: 0.1, tail: 0.3, fork: 0.42, upper: 1.7, spread: 1.5, dorsal: 1.05, dorsalX: 0.04, anal: 0.15, pect: 0.7, env: [[0, 0.03], [0.1, 0.42], [0.28, 0.86], [0.44, 1], [0.64, 0.8], [0.84, 0.4], [1, 0.15]] }), pat: { gills: 1, teeth: 1, eyeU: 0.1, eyeV: 0.2, eyeRX: 15, eyeRY: 8, iris: 1 } },
  };
  function horseGeo() {   // a seahorse: a curled tube, a head, a snout, a fluttering back fin
    const pts = [[0.06, 0.3], [-0.1, 0.2], [-0.13, 0.02], [-0.02, -0.12], [0.05, -0.27], [-0.03, -0.37], [-0.12, -0.33], [-0.09, -0.26]], curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    const rad = [0.07, 0.085, 0.09, 0.07, 0.05, 0.035, 0.022, 0.012];
    const body = loft((t) => { const p = curve.getPoint(t), i = Math.min(6, Math.floor(t * 7)), r = lerp(rad[i], rad[i + 1], t * 7 - i); return [p.x, p.y, r, r * 0.85]; }, { NX: 28, NR: 10, tan: (t) => { const v = curve.getTangent(t); return [v.x, v.y]; } });
    const head = std(new THREE.SphereGeometry(0.085, 14, 10), { m: new THREE.Matrix4().makeTranslation(0.08, 0.36, 0) }), snout = std(new THREE.CylinderGeometry(0.025, 0.032, 0.2, 8), { m: new THREE.Matrix4().makeRotationZ(-1.45).setPosition(0.22, 0.35, 0) });
    const back = fin([-0.11, 0.06], [[-0.12, 0.16], ...qb([-0.12, 0.16], [-0.3, 0.08], [-0.13, -0.04], 6)], { uOf: () => 0.5 });
    return [body, head, snout, back];
  }
  function shrimpGeo() {
    const curve = new THREE.CatmullRomCurve3([[0.42, 0.0], [0.15, 0.12], [-0.15, 0.1], [-0.33, -0.05]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
    const body = loft((t) => { const p = curve.getPoint(t), r = lerp(0.1, 0.03, t); return [p.x, p.y, r, r * 0.8]; }, { NX: 18, NR: 10, tan: (t) => { const v = curve.getTangent(t); return [v.x, v.y]; } });
    const tail = fin([-0.33, -0.05], [[-0.3, -0.02], [-0.5, 0.06], [-0.52, -0.08], [-0.48, -0.2], [-0.32, -0.1]], { uOf: () => 1 });
    const parts = [body, tail];
    for (const s of [-1, 1]) { const ant = new THREE.CatmullRomCurve3([new THREE.Vector3(0.4, 0.02, s * 0.03), new THREE.Vector3(0.7, 0.22, s * 0.08), new THREE.Vector3(1.0, 0.1, s * 0.12)]); parts.push(std(new THREE.TubeGeometry(ant, 10, 0.008, 3), { part: 1, mat: 1, edge: () => 1 })); }
    for (let i = 0; i < 5; i++) { const g = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 3); parts.push(std(g, { part: 1, mat: 1, edge: () => 0.6, m: new THREE.Matrix4().makeRotationZ(0.3).setPosition(0.22 - i * 0.09, -0.02, 0.04) })); }
    return parts;
  }
  function puffGeo() {
    const body = std(new THREE.SphereGeometry(0.27, 24, 16), { uOf: () => 0 }), parts = [body];
    for (let i = 0; i < 40; i++) { const a = Math.acos(1 - 2 * ((i + 0.5) / 40)), b = i * 2.39996, d = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)), g = new THREE.ConeGeometry(0.018, 0.1, 4); g.translate(0, 0.3, 0);
      parts.push(std(g, { part: 2, mat: 1, m: new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, d)), edge: (x, y, z) => clamp((Math.hypot(x, y, z) - 0.26) / 0.12, 0, 1) })); }
    parts.push(fin([-0.24, 0], [[-0.26, 0.06], [-0.44, 0.16], [-0.4, 0], [-0.44, -0.14], [-0.26, -0.06]], { uOf: () => 1.2 }));
    for (const s of [-1, 1]) parts.push(fin([0.05, -0.05], [[0.06, -0.02], [-0.06, -0.16], [-0.02, -0.04]], { m: new THREE.Matrix4().makeTranslation(0, 0, s * 0.27), uOf: () => 0.5 }));
    return parts;
  }
  function jellyGeo() {
    const bell = std(new THREE.SphereGeometry(0.5, 26, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), { m: new THREE.Matrix4().makeScale(1, 0.7, 1) }), parts = [bell];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, g = new THREE.PlaneGeometry(0.025, 1.15, 1, 10); g.translate(0, -0.575, 0); parts.push(std(g, { part: 1, mat: 1, m: new THREE.Matrix4().makeRotationY(-a).setPosition(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4), edge: (x, y) => clamp(-y / 1.15, 0, 1) })); }
    for (let i = 0; i < 2; i++) { const g = new THREE.PlaneGeometry(0.09, 0.8, 1, 8); g.translate(0, -0.4, 0); parts.push(std(g, { part: 1, mat: 1, m: new THREE.Matrix4().makeRotationY(i * 1.6).setPosition((i - 0.5) * 0.1, 0, 0), edge: () => 0.6 })); }
    for (let i = 0; i < 4; i++) parts.push(std(new THREE.TorusGeometry(0.07, 0.012, 5, 16), { part: 3, mat: 1, m: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(Math.cos(i * 1.57) * 0.13, 0.12, Math.sin(i * 1.57) * 0.13), edge: () => 1 }));
    return parts;
  }
  function eelGeo() {
    const body = loft((t) => { const e = envAt([[0, 0.4], [0.06, 0.9], [0.14, 1], [0.7, 0.75], [1, 0.12]], t); return [lerp(0.5, -0.5, t), 0, 0.075 * e, 0.06 * e]; }, { NX: 30, NR: 10, uOf: (t) => t });
    const top = []; for (let i = 0; i <= 20; i++) { const t = 0.12 + (i / 20) * 0.86, x = lerp(0.5, -0.5, t), h = 0.075 * envAt([[0, 0.4], [0.06, 0.9], [0.14, 1], [0.7, 0.75], [1, 0.12]], t); top.push([x, h + 0.035 * (1 - t * 0.6), 0]); }
    const dorsal = fin([-0.05, 0.03], top, { uOf: (x) => clamp(0.5 - x, 0, 1) });
    return [body, dorsal];
  }
  function gulperGeo() {
    const E = [[0, 0.5], [0.1, 0.95], [0.3, 1], [0.55, 0.62], [0.8, 0.32], [1, 0.14]], parts = [];
    parts.push(loft((t) => { const e = envAt(E, t); return [lerp(0.48, -0.42, t), 0.03 * e, 0.34 * e, 0.26 * e]; }, { NX: 18, NR: 14 }));
    parts.push(loft((t) => [lerp(0.46, 0.02, t), -0.1 - Math.sin(t * Math.PI) * 0.02, 0.07 * (0.4 + Math.sin(t * Math.PI) * 0.6), 0.2 * (0.5 + t * 0.5)], { NX: 10, NR: 10, part: 3 }));
    for (let i = 0; i < 7; i++) { const g = new THREE.ConeGeometry(0.014, 0.07, 4); parts.push(std(g, { part: 0, mat: 1, edge: () => 1, m: new THREE.Matrix4().makeRotationZ(Math.PI).setPosition(0.44 - i * 0.055, -0.05, 0.12 - Math.abs(i - 3) * 0.02) })); parts.push(std(new THREE.ConeGeometry(0.012, 0.06, 4), { part: 3, mat: 1, edge: () => 1, m: new THREE.Matrix4().setPosition(0.44 - i * 0.055, -0.08, 0.12 - Math.abs(i - 3) * 0.02) })); }
    const tx = -0.42; parts.push(fin([tx + 0.02, 0], [[tx + 0.03, 0.05], ...qb([tx + 0.03, 0.05], [tx - 0.08, 0.12], [tx - 0.18, 0.2], 4), [tx - 0.12, 0], ...qb([tx - 0.12, 0], [tx - 0.16, -0.12], [tx - 0.18, -0.2], 4), [tx + 0.03, -0.05]]));
    const lure = new THREE.CatmullRomCurve3([new THREE.Vector3(0.16, 0.33, 0), new THREE.Vector3(0.36, 0.56, 0), new THREE.Vector3(0.6, 0.5, 0)]);
    parts.push(std(new THREE.TubeGeometry(lure, 12, 0.012, 4), { part: 4, mat: 1, edge: () => 0.7 }));
    parts.push(std(new THREE.SphereGeometry(0.05, 12, 8), { part: 4, mat: 2, m: new THREE.Matrix4().makeTranslation(0.6, 0.5, 0) }));
    return parts;
  }
  function rayGeo() {   // a manta: wide flat wings that flap, a whip tail
    const body = loft((t) => { const e = envAt([[0, 0.25], [0.15, 0.75], [0.4, 1], [0.7, 0.55], [1, 0.08]], t); return [lerp(0.46, -0.34, t), 0, 0.05 * (0.5 + e * 0.5), 0.5 * e]; }, { NX: 18, NR: 16 });
    const tail = std(new THREE.CylinderGeometry(0.006, 0.014, 0.62, 4), { part: 1, mat: 1, edge: () => 0.8, m: new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(-0.64, 0, 0) });
    const horns = [-1, 1].map((s) => std(new THREE.ConeGeometry(0.03, 0.14, 5), { part: 1, mat: 1, edge: () => 1, m: new THREE.Matrix4().makeRotationZ(-Math.PI / 2).setPosition(0.5, 0.01, s * 0.12) }));
    return [body, tail, ...horns];
  }
  // build each species: an instanced mesh with a body material and a glow material (and the lurejaw's lure)
  const fishM = {};
  for (const id of S.ORDER) {
    const sp = S.SP[id], o = SPEC[id], g = merge(o.g()), n = o.max;
    const ph = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage), aux = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aPhase", ph); g.setAttribute("aAux", aux);
    let mats;
    if (o.jelly) mats = [bellMat(sp.c1), glowMat(sp.c2, 2, { k: 1.3 })];
    else { const p = o.pat || {}, tex = paint(sp.c1, sp.c2, { stripe: p.stripe && sp.c2, dots: p.dots && sp.c2, spot: p.spot && sp.c2, spots: p.spots && (p.spots === 2 ? NEON.pink : sp.c2), bands: p.bands && sp.c2, gills: p.gills && sp.c2, lateral: p.lateral && sp.c2,
        teeth: p.teeth, eye: p.eye, sphere: p.sphere, eyeU: p.eyeU, eyeV: p.eyeV, eyeRX: p.eyeRX, eyeRY: p.eyeRY, iris: p.iris ? sp.c2 : null });
      mats = [bodyMat(sp.c1, o.k, { map: tex.map, emi: tex.emi, amp: o.amp, wave: o.wave, rimK: o.rimK, emK: o.emK }), glowMat(sp.c2, o.k, { amp: o.amp, wave: o.wave })];
      if (o.lure) mats.push(new THREE.MeshBasicMaterial({ color: lin(sp.c2, 3) })); }
    const m = new THREE.InstancedMesh(g, mats, n); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m);
    fishM[id] = { m, ph, aux, mats, o, list: [], glow: lin(sp.c1) };
  }
  // you: the same kind of fish with a veil tail and long fins, in your skin's colours
  const meG = merge(fishGeo({ hb: 0.22, wb: 0.11, tail: 0.38, fork: 0.85, spread: 1.4, dorsal: 0.9, anal: 0.6, pect: 0.25 }));
  const mePh = new THREE.InstancedBufferAttribute(new Float32Array(1), 1), meAux = new THREE.InstancedBufferAttribute(new Float32Array(1), 1); meG.setAttribute("aPhase", mePh); meG.setAttribute("aAux", meAux);
  let meSkin = null, meMats = null; const meMesh = new THREE.InstancedMesh(meG, [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()], 1); meMesh.frustumCulled = false; scene.add(meMesh);
  const setSkin = (sk) => { if (meSkin === sk.id) return; meSkin = sk.id; if (meMats) for (const mm of meMats) { mm.dispose(); }
    const tex = paint(sk.c1, sk.c2, { lateral: sk.c3, dots: sk.c2, chev: sk.c1, eyeU: 0.12, eyeV: 0.17, eyeRX: 30, eyeRY: 12, iris: sk.c3 });
    meMats = [bodyMat(sk.c1, 0, { map: tex.map, emi: tex.emi, amp: 0.06, wave: 3, rimK: 3.8, emK: 3.2 }), glowMat(sk.c2, 0, { amp: 0.06, wave: 3, k: 1.6 })]; meMesh.material = meMats; };
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 1 } },
    vertexShader: "varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform float uA; varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(vec3(0.0, 0.85, 1.0) * (0.06 + f * 1.3) * uA, 1.0); }" }));
  scene.add(shield);
  const swirlTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.strokeStyle = "#fff"; g.lineWidth = 3; g.shadowColor = "#fff"; g.shadowBlur = 6;
    for (let k = 0; k < 3; k++) { g.beginPath(); for (let j = 0; j <= 40; j++) { const a = j * 0.3 + k * 2.1, r = 4 + j * 1.45; j ? g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r) : g.moveTo(64, 64); } g.stroke(); } return new THREE.CanvasTexture(c); })();
  const swirl = new THREE.Sprite(new THREE.SpriteMaterial({ map: swirlTex, color: lin(NEON.violet, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(swirl);
  // pearls
  const pearlMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.1, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0.35 }), 4); pearlMesh.count = 0; pearlMesh.frustumCulled = false; scene.add(pearlMesh);
  const iconTex = {}; const icon = (type) => iconTex[type] || (iconTex[type] = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), x = 32, y = 32, r = 15; g.strokeStyle = g.fillStyle = "rgba(10,4,40,.9)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath();
    if (type === "shield") g.arc(x, y, r * 0.85, 0, Math.PI * 2); else if (type === "vortex") { for (let i = 0; i <= 20; i++) { const a = i * 0.55, rr = r * 0.12 + i * r * 0.045; i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x, y); } }
    else if (type === "ink") { g.arc(x - r * 0.35, y + r * 0.1, r * 0.4, 0, Math.PI * 2); g.moveTo(x + r * 0.75, y); g.arc(x + r * 0.35, y - r * 0.1, r * 0.4, 0, Math.PI * 2); }
    else if (type === "surge") { g.moveTo(x + r * 0.2, y - r * 0.9); g.lineTo(x - r * 0.4, y + r * 0.1); g.lineTo(x + r * 0.3, y + r * 0.1); g.lineTo(x - r * 0.2, y + r * 0.9); }
    else { g.moveTo(x, y + r * 0.8); g.bezierCurveTo(x - r * 1.3, y - r * 0.2, x - r * 0.5, y - r * 1.1, x, y - r * 0.35); g.bezierCurveTo(x + r * 0.5, y - r * 1.1, x + r * 1.3, y - r * 0.2, x, y + r * 0.8); g.fill(); }
    g.stroke(); return new THREE.CanvasTexture(c); })());
  const pearlIcons = [0, 1, 2, 3].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })); s.renderOrder = 5; scene.add(s); return s; });
  // glowing points: particles, plankton, kelp bulbs, far lights; bubbles; rings
  const pts = (max, tex) => { const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTex: { value: tex }, uScale: { value: 400 } },
      vertexShader: "attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform sampler2D uTex; varying vec3 vC; void main(){ gl_FragColor = vec4(vC * texture2D(uTex, gl_PointCoord).a, 1.0); }" });
    const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); let n = 0;
    return { m, reset() { n = 0; }, add(x, y, z, c, s, k = 1) { if (n >= max) return; pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; col[n * 3] = c.r * k; col[n * 3 + 1] = c.g * k; col[n * 3 + 2] = c.b * k; size[n] = s; n++; },
      done() { g.setDrawRange(0, n); g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.size.needsUpdate = true; } };
  };
  const ringTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke(); g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(20, 18, 6, 6); return new THREE.CanvasTexture(c); })();
  const glows = pts(2400, soft), bubs = pts(400, ringTex);
  const rings = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.visible = false; scene.add(m); return m; });
  const PLK = Array.from({ length: q === "low" ? 160 : 320 }, () => ({ x: Math.random(), y: Math.random(), z: -7 + Math.random() * 9.5, c: Math.floor(Math.random() * 4), tw: Math.random() * 6.28, l: 0 }));

  const post = K.post(renderer, scene, camera, { bloom: [q === "high" ? 0.9 : 0.75, 0.55, 0.7], vignette: 0.85, grain: 0.018 });
  let W = 0, H = 0, dprCap = q === "high" ? 1.75 : 1.5;
  const resize = (w, h, force) => { if (w === W && h === H && !force) return; W = w; H = h; const dpr = Math.min(devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); post.composer.setPixelRatio(dpr); post.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
  // frame guard: if frames keep running long, give up the costliest things one at a time (resolution, then the back reef, then bloom)
  let lastNow = 0, warm = 0, slowT = 0, level = q === "low" ? 2 : 0;
  const guard = () => { const now = performance.now(), fdt = lastNow ? (now - lastNow) / 1000 : 0; lastNow = now; if (warm < 90) { warm++; return; }
    if (fdt <= 0 || fdt > 0.25) return; slowT = fdt > 0.022 ? slowT + fdt : Math.max(0, slowT - fdt * 0.5); if (slowT < 1.5 || level >= 3) return; slowT = 0; level++;
    if (level === 1) { if (Math.min(devicePixelRatio || 1, dprCap) > 1) { dprCap = 1; resize(W, H, true); } else level++; }
    if (level === 3) post.bloom.enabled = false; };

  let builtFor = null, camD = 20, lastT = 0;
  const lc = (c, k, o) => lin(c, k, o || new THREE.Color());
  const cA = new THREE.Color(), cS2 = new THREE.Color(), cB = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1), plkCols = [new THREE.Color(), new THREE.Color(), lin(NEON.cyan), new THREE.Color(0.9, 0.95, 1)];
  return {
    ok: true,
    render(v) {
      guard(); resize(v.W, v.H); const t = S.time, dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      if (builtFor !== S.decor) { builtFor = S.decor; buildFloor(); buildReef(); }
      for (const m of statics) if (m !== urchin) m.count = level >= 2 ? m.userData.front : m.userData.all;   // slow devices keep only the reef along the game's floor
      // the camera: the game's floor plane (z = 0) lands exactly where the Original draws it
      const th = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), vh = (H / v.zoom) * U; camD = vh / (2 * th);
      camera.near = Math.max(0.3, camD * 0.05); camera.far = camD + 140; camera.position.set(X(v.camX), Y(v.camY), camD); camera.quaternion.identity();
      if (v.shX || v.shY) camera.setViewOffset(W, H, -v.shX, -v.shY, W, H); else { camera.clearViewOffset(); camera.updateProjectionMatrix(); } camera.updateMatrixWorld();
      scene.fog.density = 0.3 / camD; glows.m.uniforms.uScale.value = bubs.m.uniforms.uScale.value = H * 0.5 / th;
      // colours of this dive
      const P = S.pal; lc(P.a, 1, cA); lc(P.s2, 1, cS2); lc(P.b, 1, cB); lin(P.s0, 1, pal.uS0.value); lin(P.s1, 1, pal.uS1.value); lin(P.s2, 1, pal.uS2.value); lin(P.c1, 1, pal.uC1.value); pal.uT.value = t;
      const wy = clamp(v.camY / S.WH, 0, 1), wc = wy < 0.42 ? [mixc(mixc(mulc(P.s1, 0.85), P.s2, 0.1), mulc(P.s1, 0.5), wy / 0.42)] : [mixc(mulc(P.s1, 0.5), mixc(mulc(P.s0, 0.7), [0, 0, 5], 0.3), (wy - 0.42) / 0.58)];
      lin(wc[0], 1, scene.fog.color); scene.background.copy(scene.fog.color);
      hemi.color.copy(cS2).lerp(WHITE, 0.4).multiplyScalar(0.8); lin(P.c0, 1.6, hemi.groundColor);
      floorMat.color.setRGB(0.2, 0.17, 0.3).lerp(lin(P.c1, 1.4, C), 0.5); floorU.uCaus.value.copy(cA).lerp(cS2, 0.4); floorU.uT.value = t; rimMesh.material.color.copy(cA).multiplyScalar(2.2); bladeU.uT.value = t;
      // the water behind, the surface, the moon, the light shafts
      const bz = -70, bd = camD - bz, bh = 2 * bd * th * 1.15; back.position.set(X(v.camX), Y(v.camY), bz); back.scale.set(bh * camera.aspect, bh, 1);
      surface.scale.x = X(S.WW) + 120; surface.position.x = X(v.camX);
      const near = clamp(1 - (v.camY - v.H / 2 / v.zoom) / 900, 0, 1);
      // the moon hangs in the sky above the waterline, wherever that is on screen
      const syF = H / 2 + (0 - v.camY) * v.zoom; moon.visible = moonDisc.visible = waterline.visible = syF > 30;
      if (moon.visible) { V.set((0.72 - 0.5) * 2 - (v.camX / S.WW - 0.5) * 0.1, 1 - (Math.max(22, syF * 0.42) / H) * 2, 0.5).unproject(camera).sub(camera.position).normalize(); const d = (camD + 45) / Math.max(0.2, -V.z);
        moon.position.copy(camera.position).addScaledVector(V, d); moonDisc.position.copy(moon.position); moonDisc.position.z += 0.2; const ms = d * (Math.min(W, H) * 0.035 / H) * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2); moon.scale.setScalar(ms * 7); moonDisc.scale.setScalar(ms);   // the same size on screen as the Original's moon
        waterline.position.set(X(v.camX), 0, 0.02); waterline.scale.set(1, (W / v.zoom) * U * 1.6, 1); }
      for (const s of shafts) { const u = s.userData; s.position.set(X(v.camX) * (1 + u.z * 0.004) + u.off + Math.sin(t * 0.3 + u.ph) * 0.8, -u.len / 2, u.z); s.scale.set(u.w, u.len, 1); s.rotation.z = 0.22 + Math.sin(t * 0.2 + u.ph) * 0.05;
        s.material.color.copy(cS2).lerp(WHITE, 0.5).multiplyScalar(0.09 * near); s.visible = near > 0.02; }
      // the creatures
      const vw2 = (W / v.zoom) / 2 + 200, vh2 = (H / v.zoom) / 2 + 200;
      for (const id in fishM) fishM[id].list.length = 0;
      for (const f of S.fish) if (!f.gone && Math.abs(f.x - v.camX) < vw2 + f.s && Math.abs(f.y - v.camY) < vh2 + f.s) fishM[f.sp].list.push(f);
      for (const p of S.parts) if (p.k === "swal" && S.me) { const u = 1 - p.life / p.max, [mx, my] = S.mouthPos(), f = p.f; f.x = lerp(p.x0, mx, u * u); f.y = lerp(p.y0, my, u * u); f.s = p.s0 * (1 - u * 0.85); fishM[f.sp].list.push(f); }
      const threatC = lin(NEON.red, 2.4);
      for (const id in fishM) {
        const F = fishM[id], m = F.m, o = F.o, n = Math.min(F.list.length, F.ph.count);
        for (const mm of F.mats) if (mm.userData.u) mm.userData.u.uT.value = t;
        for (let i = 0; i < n; i++) {
          const f = F.list[i], s = f.s * U * (id === "puff" ? 1 + f.inf * 0.75 : 1), yaw = id === "jelly" ? 0 : -Math.acos(clamp(f.flip, -1, 1)), pitch = id === "jelly" || id === "horse" ? 0 : -clamp(Math.atan2(f.vy, Math.abs(f.vx) + 25), -0.5, 0.5) * 0.7;
          if (id === "ray") { Q.setFromEuler(E.set(0, yaw, 0)); QR.setFromEuler(E.set((Math.sign(f.flip) || 1) * 1.0, 0, pitch)); Q.multiply(QR); }   // rays bank so you see their wings
          else Q.setFromEuler(E.set(0, yaw, pitch, "YXZ"));
          M.compose(V.set(X(f.x), Y(f.y) + (id === "jelly" ? s * 0.25 : 0), 0), Q, SC.set(s, s, s)); m.setMatrixAt(i, M);
          F.ph.array[i] = f.ph; F.aux.array[i] = id === "jelly" ? f.pulse : id === "puff" ? f.inf : id === "gulper" ? (f.lunge > 0 ? 1 : 0.15 + 0.1 * Math.sin(f.ph * 0.6)) : 0;
          if (id === "gulper") { V.set(0.6, 0.5, 0).applyMatrix4(M); glows.add(V.x, V.y, V.z, lc(S.SP.gulper.c2, 1, C), s * 0.45, 1.3 + 0.3 * Math.sin(t * 5 + f.id)); }
          const chase = S.state === "play" && S.isThreat(f) && f.mode === "chase"; const hk = clamp(1 - f.s / 260, 0.35, 1); glows.add(X(f.x), Y(f.y), -0.3, chase ? threatC : F.glow, s * (id === "eel" ? 1.6 : 2.0) * hk, (chase ? 0.4 : 0.26) * hk);
        }
        m.count = n; m.instanceMatrix.needsUpdate = true; F.ph.needsUpdate = F.aux.needsUpdate = true;
      }
      // you
      const me = S.me, sk = S.skin; setSkin(sk);
      const blink = me && me.inv > 0 && S.state === "play" && Math.sin(t * 26) < -0.3;
      meMesh.visible = !!me && !me.dead && !blink; shield.visible = false; swirl.visible = false;
      if (meMesh.visible) { const s = me.s * U, yaw = -Math.acos(clamp(me.flip, -1, 1)), pitch = -me.tilt;
        Q.setFromEuler(E.set(0, yaw, pitch, "YXZ")); M.compose(V.set(X(me.x), Y(me.y), 0.02), Q, SC.set(s, s, s)); meMesh.setMatrixAt(0, M); meMesh.instanceMatrix.needsUpdate = true; mePh.array[0] = me.ph; mePh.needsUpdate = true;
        const rb = sk.rainbow || me.frenzyT > 0, u0 = meMats[0].userData.u, u1 = meMats[1].userData.u; u0.uT.value = u1.uT.value = t;
        if (rb) { const h = (t * 0.35) % 1; u0.uRim.value.setHSL(h, 1, 0.55).multiplyScalar(3.8); u1.uC.value.setHSL((h + 0.33) % 1, 1, 0.55); } else { lin(sk.c1, 3.8, u0.uRim.value); lin(sk.c2, 1, u1.uC.value); }
        u0.uRimK.value = me.inkT > 0 ? 0.4 : 1 + (me.frenzyT > 0 ? 0.4 : 0); u1.uK.value = (me.inkT > 0 ? 0.5 : 1.6) + (me.dashT > 0 ? 0.8 : 0);
        glows.add(X(me.x), Y(me.y), -0.2, rb ? C.copy(u0.uRim.value).multiplyScalar(0.4) : lc(sk.c1, 1, C), s * 2.4, me.inkT > 0 ? 0.12 : 0.34);
        if (me.shield) { shield.visible = true; shield.position.set(X(me.x), Y(me.y), 0); shield.scale.set(s * 0.68, s * 0.5, s * 0.5); shield.material.uniforms.uA.value = 0.75 + 0.2 * Math.sin(t * 5); }
        if (me.vortexT > 0) { const [mx, my] = S.mouthPos(); swirl.visible = true; swirl.position.set(X(mx), Y(my), 0.3); swirl.scale.setScalar(s * 1.8); swirl.material.rotation = -t * 9; swirl.material.opacity = Math.min(1, me.vortexT); }
        if (me.stun > 0) for (let i = 0; i < 3; i++) { const a = t * 7 + i * 2.1; glows.add(X(me.x) + Math.cos(a) * s * 0.45, Y(me.y) + s * 0.5 + Math.sin(a) * s * 0.12, 0.3, lc(NEON.yellow, 1, C), 0.25, 1.2); } }
      // pearls
      pearlMesh.count = 0; let pi = 0;
      for (const p of S.pearls) { if (pi >= 4) break; if (p.life < 3 && Math.sin(p.ph * 16) < 0) continue; const r = Math.max(9 / v.zoom, 14) * U * (1 + 0.08 * Math.sin(p.ph * 4)), c = S.PEARL[p.type].c;
        M.compose(V.set(X(p.x), Y(p.y), 0.1), Q.identity(), SC.set(r * 0.8, r * 0.8, r * 0.8)); pearlMesh.setMatrixAt(pi, M); pearlMesh.setColorAt(pi, lc(c, 1, C)); glows.add(X(p.x), Y(p.y), 0, lc(c, 1, C), r * 5, 0.8);
        const ic = pearlIcons[pi]; ic.visible = true; ic.material.map = icon(p.type); ic.position.set(X(p.x), Y(p.y), 0.6); ic.scale.setScalar(r * 1.1); pi++; }
      pearlMesh.count = pi; pearlMesh.instanceMatrix.needsUpdate = true; if (pearlMesh.instanceColor) pearlMesh.instanceColor.needsUpdate = true; for (let i = pi; i < 4; i++) pearlIcons[i].visible = false;
      // kelp: leafy stalks swaying, light pulsing up them
      kseg.count = 0; leaf.count = 0; const kx0 = v.camX - vw2 - 600, kx1 = v.camX + vw2 + 600;
      for (const k of kelp3) { if (k.x < kx0 * (1 - k.z * 0.01) - 200 || k.x > kx1 + 200 || (level >= 2 && k.z < -3)) continue;
        const base = terr(k.x, k.z), n = 10, kc = lc(k.c, 1, C); let px = X(k.x), py = Y(base);
        for (let i = 1; i <= n; i++) { const u = i / n, x = X(k.x + Math.sin(t * 0.7 + k.ph + u * 2.4) * (6 + u * 30)), y = Y(base - k.h * u), d = V.set(x - px, y - py, 0), len = d.length();
          if (kseg.count < kseg.instanceMatrix.count) { Q.setFromUnitVectors(UPV, d.normalize()); M.compose(SC.set(px, py, k.z), Q, V2.set(k.w * U * 0.38, len, k.w * U * 0.38)); kseg.setMatrixAt(kseg.count, M); kseg.setColorAt(kseg.count, kc); kseg.count++; }
          if (i < n && leaf.count < leaf.instanceMatrix.count) { const side = i % 2 ? 1 : -1, a = side * (0.9 + Math.sin(t * 1.3 + k.ph + i) * 0.25); Q.setFromEuler(E.set(Math.sin(t + i) * 0.4, side * 0.6, -a, "XYZ")); M.compose(SC.set(x, y, k.z), Q, V2.set(1, (26 + (i % 3) * 7) * U * (1 - u * 0.35), 1)); leaf.setMatrixAt(leaf.count, M); leaf.setColorAt(leaf.count, kc); leaf.count++; }
          const pul = 0.5 + 0.5 * Math.sin(t * 2.2 - i * 0.7 + k.ph); glows.add(x, y, k.z + 0.05, kc, (2 + pul * 2) * U * 2.2, 0.35 + 0.5 * pul); px = x; py = y; } }
      kseg.instanceMatrix.needsUpdate = leaf.instanceMatrix.needsUpdate = true; if (kseg.instanceColor) kseg.instanceColor.needsUpdate = true; if (leaf.instanceColor) leaf.instanceColor.needsUpdate = true;
      // urchins pulse
      for (let i = 0; i < urchin.count; i++) { const u = S.urchins[i]; if (!u) break; const s = u.s * 0.42 * U * (1 + 0.08 * Math.sin(t * 3 + u.ph)); M.compose(V.set(X(u.x), Y(S.floorY(u.x) - u.s * 0.45), -0.1), Q.setFromEuler(E.set(0, t * 0.2 + u.ph, 0)), SC.set(s, s, s)); urchin.setMatrixAt(i, M); }
      urchin.instanceMatrix.needsUpdate = true;
      // far lights on the hills, far jellies, distant schools
      for (const L of S.farLights) { const x = L.x, z = -30; if (Math.abs(x - v.camX) > vw2 * 3 + 800) continue; glows.add(X(x), Y(terr(x, z) - 30), z, lc(L.c, 1, C), L.r * U * 5, 0.5 + 0.3 * Math.sin(t * 1.3 + L.ph)); }
      for (const j of S.farJellies) { const z = -16, y = j.y + Math.sin(t * 0.4 + j.ph) * 40; if (Math.abs(j.x - v.camX) > vw2 * 2.5 + 600) continue; const p = Math.max(0, Math.sin(t * 1.4 + j.ph)), c = lc(j.c, 1, C);
        glows.add(X(j.x), Y(y), z, c, j.s * U * (2.6 - p * 0.3), 0.55); for (let i = 0; i < 4; i++) glows.add(X(j.x) + (i - 1.5) * j.s * U * 0.25, Y(y + j.s * (0.6 + i * 0.12)), z, c, j.s * U * 0.5, 0.35); }
      for (const sc of S.bgSchools) { const z = -12; if (Math.abs(sc.x - v.camX) > vw2 * 2.2 + 600) continue; const c = lc(sc.c, 1, C);
        for (const [ox, oy, ph] of sc.fish) glows.add(X(sc.x + ox * 1.8 + Math.sin(t * 0.9 + ph) * 6), Y(sc.y + Math.sin(t * 0.3 + sc.ph) * 30 + oy * 1.8), z, c, 0.22, 0.6); }
      // particles: sparks and bits, bubbles, rings
      let ri = 0;
      for (const p of S.parts) {
        const a = Math.min(1, (p.life / p.max) * 1.6);
        if (p.k === "dot") glows.add(X(p.x), Y(p.y), 0.15, lc(p.c, 1, C), p.r * U * 4, a);
        else if (p.k === "bub") bubs.add(X(p.x), Y(p.y), 0.2, WHITE, p.r * U * 3, a * 0.6);
        else if (p.k === "ring" && ri < rings.length) { const u = 1 - p.life / p.max, r = lerp(p.r0, p.r1, 1 - Math.pow(1 - u, 2)) * U, m = rings[ri++]; m.visible = true; m.position.set(X(p.x), Y(p.y), 0.2); m.scale.setScalar(r); m.material.color.copy(lc(p.c, 2, C)).multiplyScalar(1 - u); }
      }
      for (; ri < rings.length; ri++) rings[ri].visible = false;
      // plankton: it lights up where you swim through it
      plkCols[0].copy(cA); plkCols[1].copy(cS2);
      const bw = (W / v.zoom) * 1.3, bhh = (H / v.zoom) * 1.3, mv = me ? Math.hypot(me.vx, me.vy) : 0;
      for (let i = 0; i < PLK.length; i++) { if (level >= 2 && i % 2) continue; const p = PLK[i], par = 1 + p.z * 0.06;
        const ox = v.camX - bw / 2, oy = v.camY - bhh / 2, wx = ox + ((((p.x * bw * par - ox) % bw) + bw) % bw), wy = oy + ((((p.y * bhh - oy) % bhh) + bhh) % bhh);   // fixed in the water, wrapping round the view
        if (wy < 0) continue; if (me && S.state !== "menu" && mv > 30) { const d = Math.hypot(wx - me.x, wy - me.y); if (d < me.s * 1.5 + 60 && Math.abs(p.z) < 2.5) p.l = Math.max(p.l, 1 - d / (me.s * 1.5 + 60)); }
        p.l = Math.max(0, p.l - dt * 0.7); const k = (0.18 + 0.25 * Math.abs(Math.sin(t * 0.9 + p.tw))) + p.l * 1.4; glows.add(X(wx), Y(wy), p.z, plkCols[p.c], (2.2 + p.l * 5) * U * (camD / 14), k); }
      glows.done(); bubs.done(); glows.reset(); bubs.reset();
      post.grade.uniforms.flash.value = Math.min(0.3, S.flash * (CALM() ? 0.08 : 0.3));
      post.render(dt || 1 / 60);
    },
  };
}
