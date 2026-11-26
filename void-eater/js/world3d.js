// Void Eater in real 3D: the same city the game simulates (window.VES), drawn with three.js. Buildings with lit windows,
// traffic, people, trees, lamps and the spire stand on neon streets; each void is an actual hole cut in the ground, and
// what it swallows tumbles down into the pit. If WebGL is missing, the game keeps its 2D drawing.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const S = window.VES; if (!S) throw new Error("Void Eater state bridge missing");
const U = 0.05, SIZE = S.SIZE, BLK = S.BLK, ST = S.ST, MOBILE = matchMedia("(pointer: coarse)").matches, MAXV = 4;
let renderer; try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); } catch (e) { renderer = null; }
if (!renderer || !renderer.getContext()) { window.VE3D = { ok: false }; throw new Error("no WebGL"); }
const canvas = renderer.domElement; canvas.id = "gl"; canvas.setAttribute("aria-hidden", "true");
const c2d = document.getElementById("c"); c2d.parentNode.insertBefore(canvas, c2d);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene(); scene.background = new THREE.Color("#07031a"); const FOGC = new THREE.Color("#0d0626"); scene.fog = new THREE.FogExp2(FOGC, 0.01);
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);
scene.add(new THREE.HemisphereLight(0x8c6cff, 0x140422, 1.25));
const sun = new THREE.DirectionalLight(0xffe2f6, 1.5); sun.position.set(-40, 90, 60); scene.add(sun, sun.target);

// ---------- the ground: streets, sidewalks and lots, with the voids cut out ----------
const holes = Array.from({ length: MAXV }, () => new THREE.Vector4(0, 0, 0, 0));
const groundMat = new THREE.ShaderMaterial({
  uniforms: { uHoles: { value: holes }, uFog: { value: FOGC }, uFogD: { value: 0.01 }, uT: { value: 0 } },
  vertexShader: "varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }",
  fragmentShader: `varying vec3 vW; varying float vD; uniform vec4 uHoles[${MAXV}]; uniform vec3 uFog; uniform float uFogD;
    float band(float d, float w){ return 1.0 - smoothstep(w, w * 1.8, d); }
    void main(){
      for (int i = 0; i < ${MAXV}; i++) { vec4 h = uHoles[i]; if (h.w > 0.5 && distance(vW.xz, h.xy) < h.z) discard; }
      vec2 g = vW.xz / ${U.toFixed(3)}; vec3 col = vec3(0.03, 0.015, 0.075);
      if (g.x < 0.0 || g.y < 0.0 || g.x > ${SIZE.toFixed(1)} || g.y > ${SIZE.toFixed(1)}) { col = vec3(0.015, 0.005, 0.04); }
      else {
        vec2 l = mod(g, ${BLK.toFixed(1)}); vec2 cellId = floor(g / ${BLK.toFixed(1)});
        float hw = ${(ST / 2).toFixed(1)}, inBlk = step(hw, l.x) * step(l.x, ${(BLK - ST / 2).toFixed(1)}) * step(hw, l.y) * step(l.y, ${(BLK - ST / 2).toFixed(1)});
        if (inBlk > 0.5) {
          vec2 e = min(l - hw, ${(BLK - ST / 2).toFixed(1)} - l); float edge = min(e.x, e.y);
          col = edge < 12.0 ? vec3(0.10, 0.065, 0.24) : vec3(0.06, 0.035, 0.16);
          vec3 neon = mod(cellId.x + cellId.y, 2.0) > 0.5 ? vec3(0.0, 1.5, 2.0) : vec3(2.0, 0.25, 1.7);
          col += neon * band(edge, 0.7) * 0.9;
        } else {
          vec2 c = min(l, ${BLK.toFixed(1)} - l); float centre = min(c.x, c.y);
          float along = c.x < c.y ? g.y : g.x; float dash = step(0.5, fract(along / 20.0));
          col += vec3(1.6, 1.15, 0.2) * band(centre, 0.6) * dash * 0.8;
          col += vec3(0.015, 0.01, 0.03) * step(0.5, fract((g.x + g.y) * 0.05));
        }
      }
      float f = 1.0 - exp(-uFogD * uFogD * vD * vD); gl_FragColor = vec4(mix(col, uFog, f), 1.0); }`,
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * U * 3, SIZE * U * 3), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(SIZE * U / 2, 0, SIZE * U / 2); scene.add(ground);

// ---------- the voids: a pit under every hole, a glowing rim, a slow swirl ----------
const pitGeo = new THREE.CylinderGeometry(1, 0.55, 1, 48, 1, true); pitGeo.translate(0, -0.5, 0);
const pitMat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uCol: { value: new THREE.Color() } },
  vertexShader: "varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "varying float vY; uniform vec3 uCol; void main(){ float k = clamp(1.0 + vY, 0.0, 1.0); gl_FragColor = vec4(mix(vec3(0.0), uCol * 0.55, pow(k, 6.0)), 1.0); }" });
const swirlMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color() } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "varying vec2 vUv; uniform float uT; uniform vec3 uCol; void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard; float a = atan(p.y, p.x); float s = sin(a * 3.0 + r * 9.0 - uT * 2.6) * 0.5 + 0.5; float m = smoothstep(1.0, 0.35, r) * smoothstep(0.05, 0.4, r); gl_FragColor = vec4(uCol * s * m * 0.9, 1.0); }" });
const label = (text, col) => { const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d"); g.font = "800 40px Jost, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 8; g.strokeStyle = "rgba(4,0,22,.85)"; g.strokeText(text, 128, 34); g.fillStyle = col; g.fillText(text, 128, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const voidViews = [];
function voidView(i) {
  if (voidViews[i]) return voidViews[i];
  const g = new THREE.Group(); const pit = new THREE.Mesh(pitGeo, pitMat.clone()); g.add(pit);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.56, 40), new THREE.MeshBasicMaterial({ color: 0x000000 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.999; g.add(floor);
  const swirl = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), swirlMat()); swirl.rotation.x = -Math.PI / 2; swirl.position.y = -0.02; g.add(swirl);
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.08, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(), side: THREE.DoubleSide, transparent: true, depthWrite: false })); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.02; g.add(rim);
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(), transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03; g.add(halo);
  const name = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })); name.scale.set(4, 1, 1); g.add(name);
  scene.add(g); return (voidViews[i] = { g, pit, swirl, rim, halo, name, text: "" });
}

// ---------- the city: one instanced mesh per kind of thing ----------
const winMat = new THREE.ShaderMaterial({
  uniforms: { uFog: { value: FOGC }, uFogD: { value: 0.01 }, uSun: { value: new THREE.Vector3(-0.4, 0.8, 0.45).normalize() } },
  vertexShader: `varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vD; varying vec3 vO;
    void main(){ vO = position; mat4 m = modelMatrix * instanceMatrix; vec4 w = m * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(m) * normal);
      #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
      #else
        vC = vec3(1.0);
      #endif
      vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vD; varying vec3 vO; uniform vec3 uFog; uniform float uFogD; uniform vec3 uSun;
    float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
    void main(){
      vec3 base = vec3(0.07, 0.05, 0.16); float lit = 0.45 + 0.55 * max(0.0, dot(normalize(vN), uSun));
      vec3 col = base * lit;
      if (abs(vN.y) < 0.5) {
        float u = abs(vN.x) > 0.5 ? vW.z : vW.x; vec2 cell = floor(vec2(u / 0.42, vW.y / 0.55)); vec2 f = fract(vec2(u / 0.42, vW.y / 0.55));
        float win = step(0.18, f.x) * step(f.x, 0.78) * step(0.22, f.y) * step(f.y, 0.78) * step(0.42, h(cell + floor(vW.xz * 0.3)));
        vec3 wc = mix(vec3(1.0, 0.85, 0.6), vC, 0.45) * (0.55 + h(cell * 1.7) * 0.75);
        col += wc * win * step(0.4, vW.y);
      } else { float e = max(abs(vO.x), abs(vO.z)); col = vec3(0.05, 0.035, 0.11) + vec3(0.03, 0.02, 0.05) * step(0.5, fract(vW.x * 1.5)) * step(0.5, fract(vW.z * 1.5)); col += vC * 1.7 * smoothstep(0.43, 0.47, e); col += vC * 0.35 * smoothstep(0.30, 0.43, e) * (1.0 - smoothstep(0.43, 0.47, e)); }
      float f = 1.0 - exp(-uFogD * uFogD * vD * vD); gl_FragColor = vec4(mix(col, uFog, f), 1.0); }`,
});
const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25, ...o });
const SHAPES = {
  building: { geo: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat: winMat },
  car: { geo: new RoundedBoxGeometry(1, 1, 1, 2, 0.18).translate(0, 0.5, 0), mat: std({ emissive: 0xffffff, emissiveIntensity: 0.22, metalness: 0.6, roughness: 0.25 }) },
  box: { geo: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat: std({ emissive: 0xffffff, emissiveIntensity: 0.3 }) },
  person: { geo: new THREE.CapsuleGeometry(0.3, 0.45, 3, 8).translate(0, 0.5, 0), mat: std({ emissive: 0xffffff, emissiveIntensity: 0.55 }) },
  cone: { geo: new THREE.ConeGeometry(0.5, 1, 10).translate(0, 0.5, 0), mat: std({ emissive: 0xffffff, emissiveIntensity: 0.6 }) },
  round: { geo: new THREE.CylinderGeometry(0.45, 0.5, 1, 10).translate(0, 0.5, 0), mat: std({ emissive: 0xffffff, emissiveIntensity: 0.5 }) },
  lamp: { geo: new THREE.CylinderGeometry(0.12, 0.16, 1, 6).translate(0, 0.5, 0), mat: std({ color: 0x1a1430, emissive: 0x000000, metalness: 0.7 }) },
  tree: { geo: new THREE.ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0), mat: std({ emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.8 }) },
  spire: { geo: new THREE.CylinderGeometry(0.12, 0.5, 1, 4).translate(0, 0.5, 0), mat: std({ emissive: 0xffffff, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.2 }) },
};
const SHAPE_OF = (o) => (o.shape === "building" ? "building" : SHAPES[o.shape] ? o.shape : "box");
const lampHeadGeo = new THREE.SphereGeometry(0.5, 10, 8), lampHeadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.1, 0.7) });
let built = null, inst = {}, lampHeads = null;
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SC = new THREE.Vector3(), C = new THREE.Color();
function placeObj(o, m, extra) {   // where a thing stands (or is, while it falls)
  let x = o.x, y = o.y, sink = 0, spin = 0, k = 1, rot = o.rot || 0;
  if (o.fall) { const f = o.fall, p = Math.min(1, f.t), v = f.v; x = v.x + f.x0 * (1 - p); y = v.y + f.y0 * (1 - p); sink = p * Math.max(2, (o.h || 10) * 0.7 + v.r * 1.6); spin = f.spin * p; k = 1 - p * 0.7; }
  if (o.vx || o.vy) rot = Math.atan2(o.vy, o.vx); const lean = o.wob > 0 ? Math.sin(performance.now() / 55 + o.x) * 0.06 * o.wob : 0;
  const w = (o.w || 5) * U * k, d = (o.d || 5) * U * k, h = (o.h || 8) * U * k;
  E.set(lean + spin * 0.5, -rot, spin * 0.35); Q.setFromEuler(E); V.set(x * U, -sink * U, y * U); SC.set(o.shape === "car" || o.shape === "box" ? w : o.shape === "building" ? w : w, h, o.shape === "building" ? d : d);
  M4.compose(V, Q, SC); return M4;
}
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
function build(objs) {
  for (const k in inst) { scene.remove(inst[k]); inst[k].dispose(); } inst = {}; if (lampHeads) { scene.remove(lampHeads); lampHeads.dispose(); }
  const counts = {}; for (const o of objs) { const s = SHAPE_OF(o); counts[s] = (counts[s] || 0) + 1; }
  for (const s in counts) { const m = new THREE.InstancedMesh(SHAPES[s].geo, SHAPES[s].mat, counts[s]); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inst[s] = m; m.userData.n = 0; scene.add(m); }
  const lamps = objs.filter((o) => o.shape === "lamp"); lampHeads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, Math.max(1, lamps.length)); lampHeads.frustumCulled = false; scene.add(lampHeads);
  let li = 0;
  for (const o of objs) { const s = SHAPE_OF(o), m = inst[s], i = m.userData.n++; o._3 = { s, i, li: o.shape === "lamp" ? li++ : -1, gone: false };
    C.set(o.col || "#8a7cff"); if (s === "car" || s === "box" || s === "person" || s === "tree" || s === "cone" || s === "round" || s === "spire") m.setColorAt(i, C); else if (s === "building") m.setColorAt(i, C);
    m.setMatrixAt(i, placeObj(o)); if (o._3.li >= 0) { M4.compose(V.set(o.x * U, (o.h || 34) * U, o.y * U), Q.identity(), SC.set(0.32, 0.32, 0.32)); lampHeads.setMatrixAt(o._3.li, M4); } }
  for (const s in inst) { inst[s].instanceMatrix.needsUpdate = true; if (inst[s].instanceColor) inst[s].instanceColor.needsUpdate = true; }
  lampHeads.instanceMatrix.needsUpdate = true; built = objs;
}
// ---------- pickups and sparks ----------
const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const pickViews = [], pickTex = {};
function pickView(i, k) { let v = pickViews[i]; if (!v) { v = pickViews[i] = new THREE.Group(); const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); halo.scale.set(3, 3, 1); v.add(halo); const ic = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); ic.scale.set(1.3, 1.3, 1); v.add(ic); scene.add(v); }
  if (v.userData.k !== k) { v.userData.k = k; const col = S.PCOL[k]; v.children[0].material.color.set(col).multiplyScalar(1.6); v.children[1].material.map = pickTex[k] || (pickTex[k] = label(["M", "B", "+"][k], col)); v.children[1].material.needsUpdate = true; v.children[1].scale.set(2.6, 0.65, 1); } return v; }
const MAXP = 600, pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.7, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.frustumCulled = false; scene.add(sparks);
// ---------- post ----------
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), MOBILE ? 0.55 : 0.65, 0.45, 0.8); composer.addPass(bloom); composer.addPass(new OutputPass());
function resize() { const dpr = Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2), w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); canvas.style.width = w + "px"; canvas.style.height = h + "px"; composer.setPixelRatio(dpr); composer.setSize(w, h);
  bloom.resolution.set(w * dpr * 0.5, h * dpr * 0.5); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

let camX = SIZE / 2, camY = SIZE / 2, camD = 120, lastT = 0;
function render(t) {
  const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
  const objs = S.objs; if (!objs || !objs.length) { renderer.render(scene, camera); return; }
  if (built !== objs) build(objs);
  // things that move, fall or have gone
  const dirty = new Set();
  for (const o of objs) { const r = o._3; if (!r || r.gone) continue;
    if (o.gone) { inst[r.s].setMatrixAt(r.i, HIDE); r.gone = true; dirty.add(r.s); if (r.li >= 0) { lampHeads.setMatrixAt(r.li, HIDE); lampHeads.instanceMatrix.needsUpdate = true; } continue; }
    if (o.fall || o.vx || o.vy || o.wob > 0) { inst[r.s].setMatrixAt(r.i, placeObj(o)); dirty.add(r.s); if (r.li >= 0 && o.fall) { lampHeads.setMatrixAt(r.li, HIDE); lampHeads.instanceMatrix.needsUpdate = true; } } }
  for (const s of dirty) inst[s].instanceMatrix.needsUpdate = true;
  // voids
  const voids = S.voids || []; let vi = 0;
  for (let i = 0; i < MAXV; i++) holes[i].w = 0;
  voids.forEach((v, i) => { if (i >= MAXV) return; const view = voidView(i), on = !(v.out > 0); view.g.visible = on; if (!on) return;
    const r = (v.rShow || v.r) * U; holes[i].set(v.x * U, v.y * U, r * 0.995, 1);
    view.g.position.set(v.x * U, 0, v.y * U); view.pit.scale.set(r, Math.max(1.2, r * 2.2), r); view.pit.material.uniforms.uCol.value.set(v.col);
    view.swirl.scale.setScalar(r); view.swirl.position.y = -Math.max(1.2, r * 2.2) * 0.35; view.swirl.material.uniforms.uT.value = t; view.swirl.material.uniforms.uCol.value.set(v.col);
    view.rim.scale.setScalar(r); view.rim.material.color.set(v.col).multiplyScalar(2.4); view.halo.scale.setScalar(r); view.halo.material.color.set(v.col).multiplyScalar(1.6); view.halo.material.opacity = v.mega > 0 ? 0.55 : 0.25;
    const txt = v.name + (v === S.me ? "" : ""); if (view.text !== txt) { view.text = txt; view.name.material.map = label(v === S.me ? "YOU" : v.name, v === S.me ? "#ffffff" : v.col); view.name.material.needsUpdate = true; }
    view.name.position.set(0, Math.max(2.2, r * 0.6) + 1.2, -r - 0.6); view.name.scale.set(Math.max(4, r * 1.2), Math.max(1, r * 0.3), 1); });
  for (let i = voids.length; i < voidViews.length; i++) if (voidViews[i]) voidViews[i].g.visible = false;
  // pickups
  const pk = S.pickups || []; pk.forEach((p, i) => { const v = pickView(i, p.k); v.visible = true; v.position.set(p.x * U, 1.2 + Math.sin((p.t || 0) * 5) * 0.25, p.y * U); }); for (let i = pk.length; i < pickViews.length; i++) pickViews[i].visible = false;
  // sparks
  const parts = S.parts || []; let n = 0; for (const p of parts) { if (n >= MAXP) break; pPos[n * 3] = p.x * U; pPos[n * 3 + 1] = 0.6 + (1 - Math.max(0, Math.min(1, p.life))) * 1.5; pPos[n * 3 + 2] = p.y * U; C.set(p.col || "#ffffff").multiplyScalar(Math.max(0, Math.min(1, p.life)) * 2); pCol[n * 3] = C.r; pCol[n * 3 + 1] = C.g; pCol[n * 3 + 2] = C.b; n++; }
  pGeo.setDrawRange(0, n); pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  // camera: above and behind, closing in on your void, pulling back as it grows
  const me = S.me, st = S.state;
  const tx = me && st !== "menu" ? me.x : S.camX, ty = me && st !== "menu" ? me.y : S.camY; camX += (tx - camX) * Math.min(1, dt * 6); camY += (ty - camY) * Math.min(1, dt * 6);
  const span = me && st !== "menu" ? Math.max(330, 150 + S.effR(me) * 7) : 900, aspect = innerWidth / innerHeight, fit = span * U / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.min(1, aspect) * 1.05;
  camD += (fit - camD) * Math.min(1, dt * 3);
  const pitch = THREE.MathUtils.degToRad(st === "menu" ? 40 : 66), cx = camX * U, cz = camY * U;
  camera.position.set(cx, Math.sin(pitch) * camD, cz + Math.cos(pitch) * camD); camera.lookAt(cx, 0, cz - camD * 0.04);
  const fd = 0.55 / Math.max(20, camD); scene.fog.density = fd; groundMat.uniforms.uFogD.value = fd; winMat.uniforms.uFogD.value = fd;
  sun.target.position.set(cx, 0, cz); sun.position.set(cx - 40, 90, cz + 60);
  composer.render(dt);
}
const project = (wx, wy) => { V.set(wx * U, 1, wy * U).project(camera); return [(V.x + 1) / 2 * innerWidth, (1 - V.y) / 2 * innerHeight]; };
window.VE3D = { ok: true, render, project, renderer, scene };
