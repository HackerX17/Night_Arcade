// Neon style: the night-city look. A synthwave night sky with a big moon, coloured light pools cast by street lamps,
// signs and fires, neon tube materials, lit windows and sign art. Only used when Settings > Style is Neon;
// the Classic style never calls anything in this file.
import * as THREE from 'three';
import { settings, mulberry32 } from './core.js';

// the arcade's neon palette (shared with the other Night Arcade games)
export const NEON = {
  cyan: 0x00e5ff, blue: 0x2f7bff, pink: 0xff3de0, violet: 0xa64dff, amber: 0xffb03a, lime: 0x5dff4a, red: 0xff2d55, white: 0xdff6ff
};
export const MOON_DIR = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 31), THREE.MathUtils.degToRad(28)).normalize();
export const NIGHT = {
  zenith: 0x05002a, mid: 0x2b0a7a, horizon: 0xff2bd6, ground: 0x0d0519,
  fog: 0x1d0b3a, fogDensity: 0.0085,
  hemiSky: 0x8a93f0, hemiGround: 0x40204c, hemiI: 0.85,
  moon: 0xb8c6ff, moonI: 0.85,
  envGround: 0x1a0c2c
};

// ------------------------------------------------------------------ sky
const SKY_VS = `varying vec3 vDir;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp; gl_Position.z = gl_Position.w; }`;
const SKY_FS = `uniform vec3 uZenith, uMid, uHorizon, uGround, uMoonDir; uniform float uTime; varying vec3 vDir;
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 col = mix(uMid, uZenith, smoothstep(0.02, 0.62, y));
  float glow = exp(-max(y, 0.0) * 7.0);
  col = mix(col, uHorizon, glow * 0.82);
  col += uHorizon * exp(-abs(y) * 42.0) * 0.3;                                   // thin hot band on the horizon
  // stars
  vec3 sp = d * 260.0, cell = floor(sp); float hs = h13(cell);
  if (hs > 0.982) {
    vec3 c = cell + 0.5 + (vec3(h13(cell + 1.7), h13(cell + 3.1), h13(cell + 5.3)) - 0.5) * 0.6;
    float tw = 0.65 + 0.35 * sin(uTime * (1.0 + hs * 3.0) + hs * 80.0);
    col += vec3(0.85, 0.9, 1.0) * smoothstep(0.45, 0.0, length(sp - c)) * tw * smoothstep(0.08, 0.4, y) * (hs - 0.982) * 95.0;
  }
  // slow cloud bands, lit pink from below by the city
  vec2 cp = d.xz / (y + 0.18) * 1.6 + vec2(uTime * 0.004, 0.0);
  float cl = smoothstep(0.5, 0.82, fbm(cp)) * smoothstep(0.03, 0.16, y) * (1.0 - smoothstep(0.45, 0.85, y));
  col = mix(col, mix(uMid * 0.45, uHorizon * 0.5, glow), cl * 0.8);
  // the moon
  float md = dot(d, uMoonDir);
  float disc = smoothstep(0.99970, 0.99977, md);
  vec3 mt = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
  vec2 mp = vec2(dot(d, mt), d.y - uMoonDir.y) * 90.0;
  float maria = 0.84 + 0.16 * vn(mp * 1.7 + 3.0) - 0.14 * smoothstep(0.55, 0.72, vn(mp * 0.9 + 9.0));
  col = mix(col, vec3(1.0, 0.97, 1.06) * 1.3 * maria, disc);
  col += vec3(0.62, 0.7, 1.0) * (pow(max(md, 0.0), 1400.0) * 0.3 + pow(max(md, 0.0), 90.0) * 0.07) * (1.0 - disc);
  col = mix(col, uGround, smoothstep(0.0, -0.1, y));
  gl_FragColor = vec4(col, 1.0);
}`;
export function nightSky() {
  const C = (h) => new THREE.Color(h);
  const m = new THREE.ShaderMaterial({
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
    uniforms: { uZenith: { value: C(NIGHT.zenith) }, uMid: { value: C(NIGHT.mid) }, uHorizon: { value: C(NIGHT.horizon) }, uGround: { value: C(NIGHT.ground) }, uMoonDir: { value: MOON_DIR.clone() }, uTime: { value: 0 } }
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), m); mesh.frustumCulled = false; mesh.renderOrder = -1; mesh.userData.noAO = true;
  return mesh;
}

// ------------------------------------------------------------------ light pools
// cheap coloured lights: every world material adds the light of up to MAXP pools (lamps, signs, fires) in its own shader,
// so there are no extra real lights and no shader recompiles while playing
const MAXP = 32;
export const POOLS = [];
const PU = { uPoolP: { value: Array.from({ length: MAXP }, () => new THREE.Vector4()) }, uPoolC: { value: Array.from({ length: MAXP }, () => new THREE.Vector3()) }, uPoolN: { value: 0 } };
export function addPool(x, y, z, hex, r, power, flicker = 0) {
  if (POOLS.length >= MAXP) return null;
  const c = new THREE.Color(hex), p = { pos: new THREE.Vector3(x, y, z), r, c: new THREE.Vector3(c.r * power, c.g * power, c.b * power), flicker, ph: POOLS.length * 7.31 };
  POOLS.push(p); return p;
}
const POOL_HEAD = `uniform vec4 uPoolP[${MAXP}]; uniform vec3 uPoolC[${MAXP}]; uniform int uPoolN;`;
const POOL_BODY = `{
  vec3 pd = vec3(0.0), ps = vec3(0.0); float pr = material.roughness, sh = exp2(9.0 * (1.0 - pr) + 1.0);
  for (int i = 0; i < ${MAXP}; i++) {
    if (i >= uPoolN) break;
    vec3 L = uPoolP[i].xyz - geometryPosition; float d2 = dot(L, L), r2 = uPoolP[i].w * uPoolP[i].w;
    if (d2 >= r2) continue;
    float a = 1.0 - d2 / r2; a *= a;
    L *= inversesqrt(max(d2, 1e-4));
    float nl = dot(geometryNormal, L);
    pd += uPoolC[i] * a * max((nl + 0.3) / 1.3, 0.0);
    if (pr < 0.8) { vec3 H = normalize(L + geometryViewDir); ps += uPoolC[i] * a * max(nl, 0.0) * pow(max(dot(geometryNormal, H), 0.0), sh) * (1.0 - pr) * (1.0 - pr) * 1.6; }
  }
  reflectedLight.directDiffuse += pd * BRDF_Lambert(material.diffuseColor);
  reflectedLight.directSpecular += ps;
}`;
export function poolPatch(mat) {
  if (!mat || !mat.isMeshStandardMaterial) return mat;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPoolP = PU.uPoolP; sh.uniforms.uPoolC = PU.uPoolC; sh.uniforms.uPoolN = PU.uPoolN;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${POOL_HEAD}`).replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${POOL_BODY}`);
  };
  mat.customProgramCacheKey = () => 'neon-pools';
  mat.needsUpdate = true;
  return mat;
}
// per frame: pool positions go to view space (the shaders light in view space), fires flicker, signs buzz
export const TICKS = [];
const GLOWS = [], NEAR = [];
const _v = new THREE.Vector3();
let T = 0;
export function neonTick(dt, cam) {
  T += dt;
  // only the nearest few pools are lit each frame (6 on Low up to 12 on Ultra); each one fades out as it
  // drops towards the edge of that set, so lights never pop. Pools wholly behind the camera are skipped.
  cam.updateMatrixWorld(); const m = cam.matrixWorldInverse, cp = cam.position, K = Math.min(MAXP, 4 + (settings.lights || 4));
  NEAR.length = 0;
  for (const p of POOLS) {
    _v.copy(p.pos).applyMatrix4(m); if (_v.z > p.r) continue;
    p.d = Math.max(0, p.pos.distanceTo(cp) - p.r * 0.5); p.vx = _v.x; p.vy = _v.y; p.vz = _v.z; NEAR.push(p);
  }
  NEAR.sort((a, b) => a.d - b.d);
  const n = Math.min(K, NEAR.length), edge = NEAR.length > K ? NEAR[K].d : Infinity;
  for (let k = 0; k < n; k++) {
    const p = NEAR[k], w = Math.min(1, (edge - p.d) / 8);
    const f = p.flicker ? 1 - p.flicker * (0.5 + 0.3 * Math.sin(T * 13.1 + p.ph) + 0.2 * Math.sin(T * 29.3 + p.ph * 1.7)) : 1;
    PU.uPoolP.value[k].set(p.vx, p.vy, p.vz, p.r); PU.uPoolC.value[k].copy(p.c).multiplyScalar(f * w);
  }
  PU.uPoolN.value = n;
  // the soft glow halos stand in for bloom; with bloom on they step back so the neon doesn't smear
  const g = settings.bloom ? 0.6 : 1;
  for (const o of GLOWS) o.m.opacity = o.base * g;
  for (const f of TICKS) f(T, dt);
}

// ------------------------------------------------------------------ textures
let GT = null, BT = null, RT = null, WT = null;
function glowTex() { // soft band: gaussian across, gentle fade at both ends
  if (GT) return GT;
  const W = 64, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), e = Math.exp(-5.5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = (y + 0.5) / (H / 2) - 1, u = (x + 0.5) / W, a = Math.max(0, (Math.exp(-v * v * 5.5) - e) / (1 - e)) * Math.min(1, u / 0.06, (1 - u) / 0.06);
    const o = (y * W + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = a * 255;
  }
  g.putImageData(im, 0, 0); GT = new THREE.CanvasTexture(c); GT.colorSpace = THREE.NoColorSpace; return GT;
}
function beamTex() { // fake light cone: bright under the lamp head, gone at the ground
  if (BT) return BT;
  const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'), im = g.createImageData(4, 64);
  for (let y = 0; y < 64; y++) { const a = Math.pow(1 - y / 63, 2.4); for (let x = 0; x < 4; x++) { const o = (y * 4 + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = a * 255; } }
  g.putImageData(im, 0, 0); BT = new THREE.CanvasTexture(c); BT.colorSpace = THREE.NoColorSpace; return BT;
}
function radialTex() {
  if (RT) return RT;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); RT = new THREE.CanvasTexture(c); RT.colorSpace = THREE.SRGBColorSpace; return RT;
}
function skylineTex() { // 16 x 16 floors of windows (one tile = 51.2 m), about a third of them lit
  if (WT) return WT;
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), rng = mulberry32(31337);
  g.fillStyle = '#040309'; g.fillRect(0, 0, N, N);
  const cols = ['#ffd9a0', '#ffc46b', '#ffe8c4', '#a8ecff', '#ff8ad8', '#e8f0ff'];
  for (let fy = 0; fy < 16; fy++) {
    const busy = rng() < 0.18; // now and then a whole office floor is lit
    for (let fx = 0; fx < 16; fx++) {
      const lit = busy ? rng() < 0.85 : rng() < 0.3, x = fx * 32, y = fy * 32;
      g.globalAlpha = lit ? 0.45 + rng() * 0.55 : 1; g.fillStyle = lit ? cols[Math.floor(rng() * cols.length)] : '#0f0c18';
      g.fillRect(x + 7, y + 9, 18, 15);
    }
  }
  g.globalAlpha = 1;
  WT = new THREE.CanvasTexture(c); WT.colorSpace = THREE.SRGBColorSpace; WT.wrapS = WT.wrapT = THREE.RepeatWrapping; WT.anisotropy = 4; return WT;
}

// ------------------------------------------------------------------ materials
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const cap = (k) => k[0].toUpperCase() + k.slice(1);
// green and white look far brighter than violet or red at the same strength; even the colours out so every tube blooms alike
const eye = (hex) => { const c = new THREE.Color(hex), l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; return Math.min(1.4, Math.max(0.5, Math.pow(0.35 / Math.max(l, 0.01), 0.6))); };
// adds the neon material keys (neonCyan, glowCyan, winWarm, skyWin, beam...) and re-tunes a few classic ones for the night
export function neonMaterials(MAT, UVS, SURF) {
  const add = (key, mat, uv = 1, surf = 'metal') => { MAT[key] = mat; UVS[key] = uv; SURF[key] = surf; };
  for (const [k, hex] of Object.entries(NEON)) {
    const E = eye(hex);
    add('neon' + cap(k), new THREE.MeshBasicMaterial({ color: hdr(hex, 3.2 * E) }));
    const gm = new THREE.MeshBasicMaterial({ color: hdr(hex, E), map: glowTex(), transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    add('glow' + cap(k), gm); GLOWS.push({ m: gm, base: gm.opacity });
    add('lane' + cap(k), new THREE.MeshBasicMaterial({ color: hdr(hex, 1.6 * E) }));
    const hz = new THREE.MeshBasicMaterial({ color: hdr(hex, E), map: glowTex(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    add('haze' + cap(k), hz); GLOWS.push({ m: hz, base: hz.opacity });
  }
  for (const [k, hex, s] of [['warm', 0xffc98a, 1.25], ['amber', 0xffa94a, 1.15], ['cool', 0x9fe6ff, 1.2], ['pink', 0xff86d6, 1.2], ['white', 0xe2ebff, 1.15]]) add('win' + cap(k), new THREE.MeshBasicMaterial({ color: hdr(hex, s) }));
  add('skyWin', new THREE.MeshStandardMaterial({ color: 0x0b0a14, roughness: 0.85, metalness: 0.1, emissive: 0xffffff, emissiveMap: skylineTex(), emissiveIntensity: 1.5 }), 51.2, 'concrete');
  add('neonBlink', new THREE.MeshBasicMaterial({ color: hdr(NEON.red, 3) }));
  const beam = new THREE.MeshBasicMaterial({ color: hdr(0xbff1ff, 1), map: beamTex(), transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  add('beam', beam); GLOWS.push({ m: beam, base: beam.opacity });
  // street lamp heads burn bright; the armory terminals glow cyan; the streets get a wet sheen
  MAT.lamp.color.set(0xffffff); MAT.lamp.emissive.set(0xc8f4ff); MAT.lamp.emissiveIntensity = 3.4;
  MAT.screen.color.set(0x02141a); MAT.screen.emissive.set(NEON.cyan); MAT.screen.emissiveIntensity = 1.8;
  MAT.asphalt.roughness = 0.62; MAT.asphalt.envMapIntensity = 1.1;
  MAT.paving.roughness = 0.85;
  for (const m of Object.values(MAT)) if (m.isMeshStandardMaterial && m !== MAT.skyWin) { poolPatch(m); if (m.metalness < 0.5) m.envMapIntensity *= 0.6; }
  // the blinking aircraft-warning lights on the tallest towers
  const blink = hdr(NEON.red, 3); TICKS.push((t) => { MAT.neonBlink.color.copy(blink).multiplyScalar((t % 1.6) < 0.55 ? 1 : 0.06); });
}
export function glowSprite(hex, size, opacity = 0.9) {
  const m = new THREE.SpriteMaterial({ map: radialTex(), color: hdr(hex, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity });
  GLOWS.push({ m, base: opacity });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); s.userData.noAO = true; return s;
}

// ------------------------------------------------------------------ sign art
const css = (hex) => '#' + new THREE.Color(hex).getHexString();
function whiter(hex, k) { const c = new THREE.Color(hex); c.lerp(new THREE.Color(1, 1, 1), k); return '#' + c.getHexString(); }
function glowText(g, text, x, y, hex, size) {
  const col = css(hex); g.save(); g.fillStyle = col; g.shadowColor = col;
  g.shadowBlur = size * 0.4; g.fillText(text, x, y); g.shadowBlur = size * 0.12; g.fillText(text, x, y);
  g.lineWidth = size * 0.045; g.lineJoin = 'round'; g.strokeStyle = col; g.shadowBlur = size * 0.1; g.strokeText(text, x, y);
  g.shadowBlur = 0; g.fillStyle = whiter(hex, 0.35); g.fillText(text, x, y); g.restore();
}
function glowPath(g, hex, w, draw) {
  const col = css(hex); g.save(); g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = col; g.shadowColor = col;
  g.shadowBlur = w * 5; draw(); g.stroke(); g.shadowBlur = w * 2; g.stroke();
  g.shadowBlur = 0; g.lineWidth = w * 0.45; g.strokeStyle = whiter(hex, 0.6); g.stroke(); g.restore();
}
function icon(g, kind, cx, cy, s, hex) {
  if (kind === 'cross') glowPath(g, hex, s * 0.13, () => { g.beginPath(); const a = s * 0.16, b = s * 0.48; g.moveTo(cx - a, cy - b); g.lineTo(cx + a, cy - b); g.lineTo(cx + a, cy - a); g.lineTo(cx + b, cy - a); g.lineTo(cx + b, cy + a); g.lineTo(cx + a, cy + a); g.lineTo(cx + a, cy + b); g.lineTo(cx - a, cy + b); g.lineTo(cx - a, cy + a); g.lineTo(cx - b, cy + a); g.lineTo(cx - b, cy - a); g.lineTo(cx - a, cy - a); g.closePath(); });
  if (kind === 'star') glowPath(g, hex, s * 0.08, () => { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.22 : s * 0.5, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); });
  if (kind === 'glass') glowPath(g, hex, s * 0.08, () => { g.beginPath(); g.moveTo(cx - s * 0.42, cy - s * 0.42); g.lineTo(cx + s * 0.42, cy - s * 0.42); g.lineTo(cx, cy + s * 0.05); g.closePath(); g.moveTo(cx, cy + s * 0.05); g.lineTo(cx, cy + s * 0.42); g.moveTo(cx - s * 0.24, cy + s * 0.45); g.lineTo(cx + s * 0.24, cy + s * 0.45); });
  if (kind === 'reel') glowPath(g, hex, s * 0.08, () => { g.beginPath(); g.arc(cx, cy, s * 0.42, 0, Math.PI * 2); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; g.moveTo(cx + Math.cos(a) * s * 0.2 + s * 0.09, cy + Math.sin(a) * s * 0.2); g.arc(cx + Math.cos(a) * s * 0.2, cy + Math.sin(a) * s * 0.2, s * 0.09, 0, Math.PI * 2); } });
  if (kind === 'wrench') glowPath(g, hex, s * 0.1, () => { g.beginPath(); g.moveTo(cx - s * 0.36, cy + s * 0.36); g.lineTo(cx + s * 0.14, cy - s * 0.14); g.moveTo(cx + s * 0.42, cy - s * 0.1); g.arc(cx + s * 0.22, cy - s * 0.22, s * 0.22, 0.2, Math.PI * 1.35); });
}
// a shop sign as a neon tube sign: dark board, glowing frame and letters
export function neonSign(text, hex, o = {}) {
  const w = 1024, h = 192, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.fillStyle = '#07040f'; g.fillRect(0, 0, w, h);
  glowPath(g, o.frame || hex, 6, () => { g.beginPath(); g.rect(20, 20, w - 40, h - 40); });
  g.font = '600 118px Teko, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tx = o.icon ? w / 2 + 64 : w / 2;
  glowText(g, text, tx, h / 2 + 8, hex, 118);
  if (o.icon) { const tw = Math.min(g.measureText(text).width, w - 300); icon(g, o.icon, tx - tw / 2 - 80, h / 2, 104, o.iconColor || hex); }
  return cv;
}
// a big wall billboard: headline, a smaller line and an icon
export function billboardArt(b) {
  const w = 512, h = 256, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0d0620'); bg.addColorStop(1, '#05030c'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  glowPath(g, b.color, 4, () => { g.beginPath(); g.rect(12, 12, w - 24, h - 24); });
  glowPath(g, b.color2, 2, () => { g.beginPath(); g.rect(26, 26, w - 52, h - 52); });
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const left = b.icon ? 150 : 0;
  if (b.icon) icon(g, b.icon, 110, h / 2, 120, b.color2);
  g.font = '600 132px Teko, "Arial Narrow", sans-serif'; glowText(g, b.text, (w + left) / 2, h / 2 - 8, b.color, 132);
  g.font = '700 26px Rajdhani, "Segoe UI", sans-serif'; glowText(g, b.sub, (w + left) / 2, h - 58, b.color2, 26);
  return cv;
}
export function artMaterial(cv, k = 2.2) {
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(k) });
}
