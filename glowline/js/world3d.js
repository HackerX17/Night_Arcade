// Glowline in real 3D: the same match the game simulates (window.GLS), drawn with three.js as a light-cycle arena.
// Every trail rises as a glowing wall behind its rider, riders are neon bikes, orbs float and pulse, crashes ring out,
// and bloom lights it all. Without WebGL the game keeps its 2D drawing.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const S = window.GLS; if (!S) throw new Error("Glowline state bridge missing");
const A = S.A, U = 0.05, AW = A * U, MOBILE = matchMedia("(pointer: coarse)").matches, WALL_H = 0.95, CAP = 24000;
let renderer; try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); } catch (e) { renderer = null; }
if (!renderer || !renderer.getContext()) { window.GL3D = { ok: false }; throw new Error("no WebGL"); }
const canvas = renderer.domElement; canvas.id = "gl"; canvas.setAttribute("aria-hidden", "true");
const c2d = document.getElementById("c"); c2d.parentNode.insertBefore(canvas, c2d);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(); scene.background = new THREE.Color("#05001e"); const FOGC = new THREE.Color("#0a0330"); scene.fog = new THREE.FogExp2(FOGC, 0.012);
const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 800);
scene.add(new THREE.HemisphereLight(0x7a5cff, 0x10031c, 1.0));
const key = new THREE.DirectionalLight(0xffe6fa, 1.2); key.position.set(-10, 30, 20); scene.add(key);

// ---------- the arena: a dark glass floor with a neon grid, a wider plain around it, glowing walls ----------
const floorMat = new THREE.ShaderMaterial({ uniforms: { uFog: { value: FOGC }, uFogD: { value: 0.012 }, uWrap: { value: 0 }, uT: { value: 0 } },
  vertexShader: "varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }",
  fragmentShader: `varying vec3 vW; varying float vD; uniform vec3 uFog; uniform float uFogD;
    void main(){ vec2 p = vW.xz; bool inside = p.x >= 0.0 && p.y >= 0.0 && p.x <= ${AW.toFixed(2)} && p.y <= ${AW.toFixed(2)};
      vec2 g = abs(fract(p / ${(AW / 12).toFixed(3)}) - 0.5); float l = 1.0 - smoothstep(0.0, 0.025 + vD * 0.0006, min(g.x, g.y));
      vec3 col = inside ? vec3(0.035, 0.018, 0.11) + vec3(0.45, 0.32, 1.25) * l * 0.42 : vec3(0.02, 0.005, 0.06) + vec3(1.1, 0.12, 1.0) * l * 0.25;
      float f = 1.0 - exp(-uFogD * uFogD * vD * vD); gl_FragColor = vec4(mix(col, uFog, f), 1.0); }` });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(AW * 6, AW * 6), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(AW / 2, 0, AW / 2); scene.add(floor);
const borderMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.42, 1.5), transparent: true });
for (const [x, z, w, d] of [[AW / 2, 0, AW + 0.3, 0.12], [AW / 2, AW, AW + 0.3, 0.12], [0, AW / 2, 0.12, AW + 0.3], [AW, AW / 2, 0.12, AW + 0.3]]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, d), borderMat); m.position.set(x, 0.16, z); scene.add(m); }

// ---------- trails: one growing mesh of light walls ----------
const tPos = new Float32Array(CAP * 4 * 3), tCol = new Float32Array(CAP * 4 * 3), tUv = new Float32Array(CAP * 4 * 2), tIdx = new Uint32Array(CAP * 6);
for (let i = 0; i < CAP; i++) { const v = i * 4, k = i * 6; tIdx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], k); tUv.set([0, 0, 0, 1, 1, 0, 1, 1], i * 8); }
const tGeo = new THREE.BufferGeometry(); tGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage)); tGeo.setAttribute("color", new THREE.BufferAttribute(tCol, 3).setUsage(THREE.DynamicDrawUsage)); tGeo.setAttribute("uv", new THREE.BufferAttribute(tUv, 2)); tGeo.setIndex(new THREE.BufferAttribute(tIdx, 1)); tGeo.setDrawRange(0, 0);
const wallMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexColors: true,
  vertexShader: "varying vec3 vC; varying float vH; void main(){ vC = color; vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "varying vec3 vC; varying float vH; void main(){ float top = smoothstep(0.86, 1.0, vH); vec3 c = vC * (0.35 + vH * 0.75) * (1.0 + top * 1.8) + vec3(0.35) * top; gl_FragColor = vec4(c, 1.0); }" });
const trails = new THREE.Mesh(tGeo, wallMat); trails.frustumCulled = false; scene.add(trails);
let segsRef = null, built = 0; const TC = new THREE.Color();
function addSeg(i, s) {
  const [col, x0, y0, x1, y1, w] = s; if (Math.hypot(x1 - x0, y1 - y0) > 20 || i >= CAP) return false;
  const h = WALL_H * Math.max(0.55, Math.min(1.6, w / 4)), v = i * 4 * 3; TC.set(col); const r = TC.r * 1.15, g = TC.g * 1.15, b = TC.b * 1.15;
  tPos.set([x0 * U, 0, y0 * U, x0 * U, h, y0 * U, x1 * U, 0, y1 * U, x1 * U, h, y1 * U], v); tCol.set([r, g, b, r, g, b, r, g, b, r, g, b], v); return true;
}
function syncTrails() {
  const segs = S.segs; if (segs !== segsRef || segs.length < built) { segsRef = segs; built = 0; }
  if (segs.length === built) return; let n = built; for (let i = built; i < segs.length; i++) if (addSeg(n, segs[i])) n++; built = segs.length;
  trails.userData.n = n; tGeo.setDrawRange(0, n * 6); tGeo.attributes.position.needsUpdate = true; tGeo.attributes.color.needsUpdate = true;
}
// a new round rebuilds from scratch: segments are kept in order, so count from what was drawn
function rebuild() { const segs = S.segs; let n = 0; for (const s of segs) if (addSeg(n, s)) n++; segsRef = segs; built = segs.length; trails.userData.n = n; tGeo.setDrawRange(0, n * 6); tGeo.attributes.position.needsUpdate = true; tGeo.attributes.color.needsUpdate = true; }

// ---------- the riders: neon light-cycles ----------
const bikeBody = new RoundedBoxGeometry(0.95, 0.32, 0.34, 3, 0.12), wheel = new THREE.TorusGeometry(0.16, 0.05, 8, 20), canopy = new THREE.SphereGeometry(0.17, 14, 10);
const bikes = [], labels = {};
function label(text, col) { const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d"); g.font = "800 38px Jost, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 8; g.strokeStyle = "rgba(4,0,22,.85)"; g.strokeText(text, 128, 34); g.fillStyle = col; g.fillText(text, 128, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function bike(i, col) {
  if (bikes[i]) return bikes[i]; const g = new THREE.Group(), c = new THREE.Color(col), glow = c.clone().multiplyScalar(2.6);
  const body = new THREE.Mesh(bikeBody, new THREE.MeshStandardMaterial({ color: 0x0c0a22, metalness: 0.8, roughness: 0.25, emissive: c, emissiveIntensity: 0.35 })); body.position.y = 0.3; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.05, 0.36), new THREE.MeshBasicMaterial({ color: glow })); stripe.position.y = 0.33; g.add(stripe);
  for (const x of [-0.34, 0.34]) { const w = new THREE.Mesh(wheel, new THREE.MeshBasicMaterial({ color: glow })); w.position.set(x, 0.17, 0); g.add(w); }
  const cab = new THREE.Mesh(canopy, new THREE.MeshStandardMaterial({ color: 0x05030c, metalness: 0.9, roughness: 0.1, emissive: c, emissiveIntensity: 0.2 })); cab.scale.set(1.3, 0.8, 0.9); cab.position.set(0.05, 0.47, 0); g.add(cab);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) })); head.position.set(0.49, 0.3, 0); g.add(head);
  const name = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })); name.position.y = 0.9; name.scale.set(1.3, 0.33, 1); g.add(name); g.userData.name = name;
  g.scale.setScalar(2.1); scene.add(g); return (bikes[i] = g);
}
// ---------- orbs, crash rings ----------
const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,.4)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const orbViews = [];
function orbView(i, kind) { let v = orbViews[i]; if (!v) { v = orbViews[i] = new THREE.Group(); const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshBasicMaterial({ color: 0xffffff })); v.add(core); const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); halo.scale.set(2.2, 2.2, 1); v.add(halo); const tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })); tag.position.y = 0.95; tag.scale.set(2.2, 0.55, 1); v.add(tag); scene.add(v); }
  if (v.userData.kind !== kind) { v.userData.kind = kind; const [txt, col] = S.ORB_INFO[kind]; const c = new THREE.Color(col); v.children[0].material.color.copy(c).multiplyScalar(2.2); v.children[1].material.color.copy(c).multiplyScalar(1.4); v.children[2].material.map = labels[kind] || (labels[kind] = label(txt, col)); v.children[2].material.needsUpdate = true; } return v; }
const ringGeo = new THREE.RingGeometry(0.9, 1.0, 48), rings = [];
function ringView(i) { let r = rings[i]; if (!r) { r = rings[i] = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; scene.add(r); } return r; }
// ---------- post ----------
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), MOBILE ? 0.5 : 0.55, 0.35, 0.82); composer.addPass(bloom); composer.addPass(new OutputPass());
function resize() { const dpr = Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2), w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); canvas.style.width = w + "px"; canvas.style.height = h + "px"; composer.setPixelRatio(dpr); composer.setSize(w, h);
  bloom.resolution.set(w * dpr * 0.5, h * dpr * 0.5); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

let lastT = 0, orbit = 0;
function render(t) {
  const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
  if (S.segs !== segsRef) rebuild(); else syncTrails();
  borderMat.opacity = S.wrapT > 0 ? 0.35 + 0.3 * Math.sin(t * 10) : 1; floorMat.uniforms.uT.value = t;
  const riders = S.riders || [];
  riders.forEach((r, i) => { const b = bike(i, r.col); b.visible = r.alive !== false; if (!b.visible) return; b.position.set(r.x * U, 0, r.y * U); b.rotation.y = -r.a;
    const nm = b.userData.name, txt = r.human && !S.twoP ? "YOU" : r.name; if (nm.userData.t !== txt) { nm.userData.t = txt; nm.material.map = label(txt, r.col); nm.material.needsUpdate = true; } nm.visible = S.countdown > 0 || (r.human && S.state === "play"); });
  for (let i = riders.length; i < bikes.length; i++) bikes[i].visible = false;
  const orbs = S.orbs || []; orbs.forEach((o, i) => { const v = orbView(i, o.kind); v.visible = true; v.position.set(o.x * U, 0.45 + Math.sin(t * 3 + i) * 0.1, o.y * U); v.children[0].rotation.y = t * 2; }); for (let i = orbs.length; i < orbViews.length; i++) orbViews[i].visible = false;
  const fl = S.flashes || []; fl.forEach((f, i) => { const r = ringView(i), u = Math.min(1, f.t / 0.6), s = (f.big ? 300 : 30) * U * (0.2 + u * 1.6); r.visible = true; r.position.set(f.x * U, 0.05, f.y * U); r.scale.setScalar(s); r.material.color.set(f.col).multiplyScalar(2.6 * (1 - u)); }); for (let i = fl.length; i < rings.length; i++) rings[i].visible = false;
  // the camera: the whole arena in view from the south, tilted; a slow drift on the menu
  const aspect = innerWidth / innerHeight, menu = S.state === "menu" || S.state === "demo";
  orbit += dt * (menu ? 0.08 : 0); const pitch = THREE.MathUtils.degToRad(aspect < 1 ? 66 : 58), fovV = THREE.MathUtils.degToRad(camera.fov);
  const need = AW * 1.12 / Math.min(1, aspect), dist = need / (2 * Math.tan(fovV / 2)), cx = AW / 2, cz = AW / 2;
  const yaw = menu ? Math.sin(orbit) * 0.35 : 0; camera.position.set(cx + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, cz + Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(cx, 0, cz + AW * 0.02);
  composer.render(dt);
}
const project = (wx, wy, h = 0.6) => { const v = new THREE.Vector3(wx * U, h, wy * U).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
window.GL3D = { ok: true, render, project, renderer, scene };
