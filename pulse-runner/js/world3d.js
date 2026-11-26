// Pulse Runner in real 3D: draws the same run the game simulates (window.PRS) with three.js.
// The hero is "RobotExpressive" by Quaternius (CC0), recoloured neon; trains, gates, barriers, walls and ramps are
// built here from light and metal; a synthwave sun, a moving city and bloom light it all. If WebGL is missing,
// the game keeps its 2D drawing.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const S = window.PRS; if (!S) throw new Error("Pulse Runner state bridge missing");
const LANE = S.LANE, TOP = S.TOP, FOG = new THREE.Color("#2a0a4a");
const X = (gx) => -gx;                     // the game's left lane is on the left of the screen: three.js looks down +z with +x to the left
const MOBILE = matchMedia("(pointer: coarse)").matches;

let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); } catch (e) { renderer = null; }
if (!renderer || !renderer.getContext()) { window.PR3D = { ok: false }; throw new Error("no WebGL"); }
const canvas = renderer.domElement; canvas.id = "gl"; canvas.setAttribute("aria-hidden", "true");
const c2d = document.getElementById("c"); c2d.parentNode.insertBefore(canvas, c2d); c2d.style.display = "none";
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(FOG, 0.0105);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);

// ---------- sky, sun, stars ----------
{
  const c = document.createElement("canvas"); c.width = 4; c.height = 256; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#04001a"); gr.addColorStop(0.45, "#1d0546"); gr.addColorStop(0.72, "#5a0d6e"); gr.addColorStop(0.86, "#c0267f"); gr.addColorStop(1, "#2a0a4a");
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
const sun = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, uniforms: { uT: { value: 0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `varying vec2 vUv; uniform float uT;
    void main(){ vec2 p = vUv - 0.5; float r = length(p); if (r > 0.5) discard;
      vec3 top = vec3(3.2,2.3,0.6), mid = vec3(3.0,0.55,1.3), bot = vec3(1.4,0.2,2.6);
      float y = vUv.y; vec3 col = y > 0.55 ? mix(mid, top, (y - 0.55) / 0.45) : mix(bot, mid, y / 0.55);
      float bands = 0.0; if (y < 0.55) { float s = fract((y + uT * 0.04) * 14.0); bands = step(s, 0.18 + (0.55 - y) * 0.9); }
      float edge = smoothstep(0.5, 0.47, r); gl_FragColor = vec4(col, edge * (1.0 - bands)); }`,
}));
sun.position.set(0, 30, 380); scene.add(sun);
{
  const n = 600, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI, e = 0.12 + Math.random() * 0.9, d = 700;
    pos[i * 3] = Math.cos(a) * d * Math.cos(e); pos[i * 3 + 1] = 40 + Math.sin(e) * d * 0.6; pos[i * 3 + 2] = Math.sin(a) * d * Math.cos(e) + 200; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
}
// ---------- the highway and the neon plain ----------
const roadMat = new THREE.ShaderMaterial({
  uniforms: { uOff: { value: 0 }, uFog: { value: FOG }, uFogD: { value: 0.0105 } },
  vertexShader: "varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }",
  fragmentShader: `varying vec3 vW; varying float vD; uniform float uOff; uniform vec3 uFog; uniform float uFogD;
    float line(float d, float w){ return 1.0 - smoothstep(w, w * 2.2, d); }
    void main(){ float x = vW.x, z = vW.z + uOff, ax = abs(x);
      vec3 col = vec3(0.035, 0.02, 0.08);
      float tile = step(0.5, fract(z * 0.25)) * 0.012; col += vec3(tile * 0.6, 0.0, tile);
      col += vec3(0.0, 0.75, 1.05) * line(abs(ax - 0.75), 0.025) * step(0.45, fract(z / 3.0));                      // lane dashes
      col += mix(vec3(1.5, 0.2, 1.3), vec3(0.0, 1.1, 1.5), step(0.0, x)) * line(abs(ax - 2.3), 0.04);           // glowing edges
      col += vec3(0.25, 0.05, 0.35) * pow(max(0.0, 1.0 - ax / 2.3), 3.0) * 0.6;                                    // a sheen down the middle
      float f = 1.0 - exp(-uFogD * uFogD * vD * vD); gl_FragColor = vec4(mix(col, uFog, f), 1.0); }`,
});
const road = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 700), roadMat); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 330); scene.add(road);
const plainMat = new THREE.ShaderMaterial({
  uniforms: { uOff: { value: 0 }, uFog: { value: FOG }, uFogD: { value: 0.0105 } },
  vertexShader: roadMat.vertexShader,
  fragmentShader: `varying vec3 vW; varying float vD; uniform float uOff; uniform vec3 uFog; uniform float uFogD;
    void main(){ float z = vW.z + uOff; vec2 g = abs(fract(vec2(vW.x * 0.25, z * 0.25)) - 0.5);
      float l = 1.0 - smoothstep(0.0, 0.02 + vD * 0.0004, min(g.x, g.y));
      vec3 col = vec3(0.025, 0.0, 0.06) + vec3(0.9, 0.08, 0.85) * l * 0.45;
      float f = 1.0 - exp(-uFogD * uFogD * vD * vD); gl_FragColor = vec4(mix(col, uFog, f), 1.0); }`,
});
const plain = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), plainMat); plain.rotation.x = -Math.PI / 2; plain.position.set(0, -0.02, 380); scene.add(plain);
// ---------- light pylons at the roadside, and a city that keeps coming ----------
const POLES = 16, poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), capGeo = new THREE.BoxGeometry(0.9, 0.08, 0.16);
const poleMat = new THREE.MeshStandardMaterial({ color: 0x0b0820, metalness: 0.6, roughness: 0.4 });
const capMats = [new THREE.MeshBasicMaterial({ color: new THREE.Color(0.0, 1.6, 2.2) }), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.25, 1.9) })];
const poles = new THREE.InstancedMesh(poleGeo, poleMat, POLES * 2), caps = [new THREE.InstancedMesh(capGeo, capMats[0], POLES), new THREE.InstancedMesh(capGeo, capMats[1], POLES)];
scene.add(poles, caps[0], caps[1]);
const BUILD = 140, bGeo = new THREE.BoxGeometry(1, 1, 1);
function windowTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#07031a"; g.fillRect(0, 0, 64, 128);
  const cols = ["#ffd9a0", "#9fe8ff", "#ff9ee6", "#fff3c4"];
  for (let y = 4; y < 124; y += 8) for (let x = 4; x < 60; x += 8) if (Math.random() < 0.38) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(x, y, 4, 5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); return t;
}
const bMat = new THREE.MeshStandardMaterial({ color: 0x0d0a24, roughness: 0.8, metalness: 0.2, emissive: 0xffffff, emissiveMap: windowTexture(), emissiveIntensity: 1.6 });
const city = new THREE.InstancedMesh(bGeo, bMat, BUILD); scene.add(city);
const B = Array.from({ length: BUILD }, (_, i) => { const side = i % 2 ? 1 : -1; return { x: side * (10 + Math.random() * 60), z: (i / BUILD) * 520, w: 4 + Math.random() * 8, d: 4 + Math.random() * 8, h: 6 + Math.pow(Math.random(), 1.6) * 56 }; });
const roofGeo = new THREE.BoxGeometry(1, 0.12, 1), roofMat = [new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 1.7, 2.4) }), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.3, 2.2) })];
const roofs = [new THREE.InstancedMesh(roofGeo, roofMat[0], BUILD / 2), new THREE.InstancedMesh(roofGeo, roofMat[1], BUILD / 2)]; scene.add(roofs[0], roofs[1]);
// ---------- reflections: the robot and the trains mirror a neon city of light strips ----------
{
  const env = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer);
  env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: scene.background })));
  const strip = (col, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; strip(new THREE.Color(i % 2 ? 4 : 0.2, i % 2 ? 0.6 : 3.2, i % 2 ? 3.6 : 4.2), Math.cos(a) * 30, 4 + (i % 3) * 6, Math.sin(a) * 30, 14, 1.2); }
  strip(new THREE.Color(5, 3, 1.2), 0, 10, 40, 30, 10);   // the sun ahead
  scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();
}
// ---------- light ----------
scene.add(new THREE.HemisphereLight(0x6a4cff, 0x1a0420, 1.1));
const key = new THREE.DirectionalLight(0xffd6f4, 1.6); key.position.set(2, 6, -6); scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xff3de0, 2.2); rim.position.set(-3, 3, 12); scene.add(rim, rim.target);
const glowLight = new THREE.PointLight(0x00e5ff, 6, 6, 2); scene.add(glowLight);

// ---------- the hero ----------
const hero = new THREE.Group(); scene.add(hero);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 2.2, 3), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);
const shieldMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 } },
  vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
  fragmentShader: "varying vec3 vN; varying vec3 vV; uniform float uT; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(vec3(0.0, 1.6, 2.4) * (f * (0.8 + 0.2 * sin(uT * 8.0))), f); }" });
const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), shieldMat); shield.scale.set(0.8, 1.05, 0.8); scene.add(shield);
const magnetRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 2.6) })); magnetRing.rotation.x = Math.PI / 2; scene.add(magnetRing);
const flames = new THREE.Group(); for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.8, 0.4), transparent: true, opacity: 0.9 })); f.rotation.x = Math.PI; f.position.set(s * 0.16, -0.25, -0.18); flames.add(f); }
scene.add(flames);
let robot = null, mixer = null, acts = {}, curAct = null, heroH = 1.5;
const fallback = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 12), new THREE.MeshStandardMaterial({ color: 0x2b0f5c, emissive: 0xff2bd6, emissiveIntensity: 0.6 }));
fallback.position.y = 0.65; hero.add(fallback);
new GLTFLoader().load(new URL("../models/runner.json", import.meta.url).href, (gltf) => {
  robot = gltf.scene; robot.traverse((o) => { if (!o.isMesh) return; o.frustumCulled = false;
    const n = o.material && o.material.name; const m = o.material = o.material.clone();
    if (n === "Main") { m.color.set("#5b16d6"); m.metalness = 0.55; m.roughness = 0.28; m.emissive = new THREE.Color("#3a0a8a"); m.emissiveIntensity = 0.55; }
    else if (n === "Grey") { m.color.set("#262a44"); m.metalness = 0.7; m.roughness = 0.35; }
    else if (n === "Black") { m.color.set("#05040c"); m.emissive = new THREE.Color("#00e5ff"); m.emissiveIntensity = 1.4; } });
  // measure the posed robot (its parts carry 100x scales from conversion, so use skinned bounds), then size it to the hero's height
  robot.scale.setScalar(1); robot.updateMatrixWorld(true); let lo = Infinity, hi = -Infinity;
  robot.traverse((m) => { if (!m.isMesh) return; let bb; if (m.isSkinnedMesh) { m.computeBoundingBox(); bb = m.boundingBox.clone(); } else { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); bb = m.geometry.boundingBox.clone(); } bb.applyMatrix4(m.matrixWorld); lo = Math.min(lo, bb.min.y); hi = Math.max(hi, bb.max.y); });
  robot.scale.setScalar(heroH / (hi - lo > 0.01 ? hi - lo : 5.1));
  hero.remove(fallback); hero.add(robot);
  mixer = new THREE.AnimationMixer(robot);
  for (const clip of gltf.animations) acts[clip.name] = mixer.clipAction(clip);
  for (const k of ["Jump", "Death"]) if (acts[k]) { acts[k].setLoop(THREE.LoopOnce, 1); acts[k].clampWhenFinished = true; }
  play("Running", 0);
}, undefined, () => { /* keep the capsule if the model can't load */ });
function play(name, fade = 0.15, from = 0) { const a = acts[name]; if (!a || curAct === a) return; a.reset(); a.time = from; a.enabled = true; a.setEffectiveWeight(1); a.play(); if (curAct) curAct.crossFadeTo(a, fade, false); curAct = a; }

// ---------- things on the highway ----------
const metal = (hex, e = 0) => new THREE.MeshStandardMaterial({ color: hex, metalness: 0.65, roughness: 0.32, emissive: hex, emissiveIntensity: e });
const neon = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const hexNeon = (hex, k = 2.6) => { const c = new THREE.Color(hex); return new THREE.MeshBasicMaterial({ color: new THREE.Color(c.r * k, c.g * k, c.b * k) }); };
function windowStrip() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 32; const g = c.getContext("2d"); g.fillStyle = "#06031a"; g.fillRect(0, 0, 128, 32);
  for (let x = 6; x < 128; x += 32) { const gr = g.createLinearGradient(0, 4, 0, 28); gr.addColorStop(0, "#fff7d6"); gr.addColorStop(1, "#ffb6e8"); g.fillStyle = gr; g.fillRect(x, 6, 22, 20); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
const WIN = windowStrip(), unitBox = new THREE.BoxGeometry(1, 1, 1), cabGeo = new RoundedBoxGeometry(1.34, 1.7, 1.4, 4, 0.22);
const trainBody = metal(0x14112e), trainRoof = metal(0x1d1940), dark = metal(0x0a0818), lamp = neon(3.2, 3.0, 2.4);
function makeTrain() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(unitBox, trainBody); body.name = "body"; g.add(body);
  const roof = new THREE.Mesh(unitBox, trainRoof); roof.name = "roof"; g.add(roof);
  const cab = new THREE.Mesh(cabGeo, trainBody); cab.name = "cab"; g.add(cab);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ map: WIN.clone(), color: new THREE.Color(1.8, 1.6, 1.7) })); w.name = "win" + s; g.add(w);
    const stripe = new THREE.Mesh(unitBox, neon(0, 2, 3)); stripe.name = "stripe" + s; g.add(stripe);
    const edge = new THREE.Mesh(unitBox, neon(0, 2, 3)); edge.name = "edge" + s; g.add(edge);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.05), lamp); head.position.set(s * 0.42, 0.42, -0.72); head.name = "head" + s; g.add(head);
  }
  const skirt = new THREE.Mesh(unitBox, dark); skirt.name = "skirt"; g.add(skirt);
  return g;
}
function fitTrain(g, o) {
  const L = o.len, col = new THREE.Color(o.col || "#00e5ff"), glow = new THREE.Color(col.r * 2.6, col.g * 2.6, col.b * 2.6);
  const by = (n) => g.getObjectByName(n);
  by("body").scale.set(1.3, 1.45, Math.max(0.1, L - 1.2)); by("body").position.set(0, 0.95, L / 2 + 0.6);
  by("roof").scale.set(1.1, 0.2, Math.max(0.1, L - 1.6)); by("roof").position.set(0, 1.78, L / 2 + 0.7);
  by("cab").position.set(0, 0.95, 0.7);
  by("skirt").scale.set(1.18, 0.22, L - 0.4); by("skirt").position.set(0, 0.11, L / 2);
  for (const s of [-1, 1]) {
    const w = by("win" + s); w.scale.set(0.02, 0.42, L - 2.2); w.position.set(s * 0.66, 1.15, L / 2 + 0.9); w.material.map.repeat.set((L - 2.2) / 1.4, 1); w.material.map.needsUpdate = true;
    const st = by("stripe" + s); st.scale.set(0.025, 0.07, L - 1.4); st.position.set(s * 0.665, 0.62, L / 2 + 0.7); st.material.color.copy(glow);
    const e = by("edge" + s); e.scale.set(0.05, 0.05, L - 1.6); e.position.set(s * 0.56, 1.9, L / 2 + 0.8); e.material.color.copy(glow);
  }
}
const barrierPost = new THREE.BoxGeometry(0.1, 0.62, 0.1), barrierBar = new RoundedBoxGeometry(1.3, 0.22, 0.14, 2, 0.05);
const hazard = (() => { const c = document.createElement("canvas"); c.width = 128; c.height = 16; const g = c.getContext("2d"); for (let x = -16; x < 144; x += 16) { g.fillStyle = (x / 16) % 2 ? "#ff8a3d" : "#1a0a04"; g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 8, 0); g.lineTo(x + 16, 0); g.lineTo(x + 8, 16); g.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const hazardMat = new THREE.MeshBasicMaterial({ map: hazard, color: new THREE.Color(2.2, 1.6, 1.2) });
function makeBarrier() { const g = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(barrierPost, dark); p.position.set(s * 0.55, 0.31, 0); g.add(p); } const bar = new THREE.Mesh(barrierBar, hazardMat); bar.position.y = 0.5; g.add(bar); return g; }
const gatePost = new RoundedBoxGeometry(0.16, 2.5, 0.16, 2, 0.05), gateBeam = new THREE.BoxGeometry(1.3, 0.34, 0.08), gateMat = neon(3.0, 0.35, 2.7), gateSoft = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.1, 1.2), transparent: true, opacity: 0.35, depthWrite: false });
function makeGate() { const g = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(gatePost, dark); p.position.set(s * 0.66, 1.25, 0); g.add(p); const t = new THREE.Mesh(unitBox, gateMat); t.scale.set(0.05, 2.5, 0.05); t.position.set(s * 0.58, 1.25, -0.09); g.add(t); }
  const beam = new THREE.Mesh(gateBeam, gateMat); beam.position.y = 1.25; g.add(beam); const haze = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), gateSoft); haze.position.y = 1.25; g.add(haze); return g; }
const wallGeo = new RoundedBoxGeometry(1.36, 3, 0.6, 3, 0.08), wallMat = metal(0x2a0612, 0.25), wallLine = neon(3.2, 0.25, 0.5);
function makeWall() { const g = new THREE.Group(); const w = new THREE.Mesh(wallGeo, wallMat); w.position.set(0, 1.5, 0.3); g.add(w);
  for (const y of [0.6, 1.5, 2.4]) { const l = new THREE.Mesh(unitBox, wallLine); l.scale.set(1.2, 0.07, 0.02); l.position.set(0, y, -0.01); g.add(l); } return g; }
const rampGeo = (() => { const w = 0.65, g = new THREE.BufferGeometry(), v = new Float32Array([-w, 0, 0, w, 0, 0, w, TOP, 1, -w, TOP, 1, -w, 0, 1, w, 0, 1]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3)); g.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 1, 2, 5, 4, 5, 2, 4, 2, 3]); g.computeVertexNormals(); return g; })();
const rampMat = metal(0x0c2433, 0.15), chevMat = neon(0.0, 2.4, 3.0);
function makeRamp() { const g = new THREE.Group(); const r = new THREE.Mesh(rampGeo, rampMat); g.add(r); g.userData.ramp = r;
  for (let k = 1; k < 5; k++) { const c = new THREE.Mesh(unitBox, chevMat); c.scale.set(1.1, 0.03, 0.08); c.name = "chev" + k; g.add(c); } return g; }
function fitRamp(g, o) { g.userData.ramp.scale.set(1, 1, o.len); const ang = Math.atan2(TOP, o.len); for (let k = 1; k < 5; k++) { const c = g.getObjectByName("chev" + k), u = k / 5; c.position.set(0, TOP * u + 0.03, o.len * u); c.rotation.x = -ang; } }
const orbGeo = new THREE.OctahedronGeometry(0.17, 0), orbMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: new THREE.Color("#ffb020"), emissiveIntensity: 2.2, metalness: 0.3, roughness: 0.2 });
const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function makeOrb() { const g = new THREE.Group(); g.add(new THREE.Mesh(orbGeo, orbMat)); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.6, 1.1, 0.25), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(0.9, 0.9, 1); g.add(s); return g; }
const powIcon = {}; function labelTex(txt, col) { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.fillStyle = col; g.font = "800 64px Jost, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = col; g.shadowBlur = 18; g.fillText(txt, 64, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function makePower(o) { const g = new THREE.Group(), col = new THREE.Color(S.PW[o.kind].col); const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 10, 40), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.6) })); g.add(ringM);
  const label = { magnet: "M", shield: "S", x2: "×2", jet: "J" }[o.kind], sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: powIcon[o.kind] || (powIcon[o.kind] = labelTex(label, S.PW[o.kind].col)), transparent: true, depthWrite: false })); sp.scale.set(0.5, 0.5, 1); g.add(sp);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col.clone().multiplyScalar(1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); halo.scale.set(1.5, 1.5, 1); g.add(halo); g.userData.kind = o.kind; return g; }
const BUILDERS = { train: makeTrain, barrier: makeBarrier, gate: makeGate, wall: makeWall, ramp: makeRamp, orb: makeOrb, power: makePower };
const pools = {}, live = new Map();
function take(o) { const key = o.t === "power" ? "power:" + o.kind : o.t, p = pools[key] || (pools[key] = []); let m = p.pop(); if (!m) { m = BUILDERS[o.t](o); scene.add(m); } m.visible = true; m.userData.key = key;
  if (o.t === "train") fitTrain(m, o); else if (o.t === "ramp") fitRamp(m, o); return m; }
// ---------- particles ----------
const MAXP = 700, pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.16, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.frustumCulled = false; scene.add(sparks);
const tmpC = new THREE.Color();
// ---------- post: bloom ----------
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), MOBILE ? 0.6 : 0.7, 0.5, 0.82); composer.addPass(bloom); composer.addPass(new OutputPass());
const flashEl = document.createElement("div"); flashEl.style.cssText = "position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:1"; canvas.after(flashEl);
function resize() { const dpr = Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2), w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); canvas.style.width = w + "px"; canvas.style.height = h + "px"; composer.setPixelRatio(dpr); composer.setSize(w, h);
  bloom.resolution.set(w * dpr * 0.5, h * dpr * 0.5); camera.aspect = w / h; camera.fov = w < h ? 72 : 60; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3();
let lastT = 0, slideK = 0, lean = 0, wasAir = false;
function render(t) {
  const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
  const st = S.state, R = S.R, objs = S.objs, dist = S.dist || 0, spd = S.speed || 14, pw = S.pw || {};
  roadMat.uniforms.uOff.value = dist; plainMat.uniforms.uOff.value = dist; sun.material.uniforms.uT.value = t; shieldMat.uniforms.uT.value = t;
  // pylons and city slide past, wrapping round
  for (let k = 0; k < POLES; k++) { const z = k * 12 - (dist % 12) - 4; for (const s of [0, 1]) { M4.compose(V.set(s ? 3.6 : -3.6, 2.1, z), Q.identity(), SC.set(1, 1, 1)); poles.setMatrixAt(k * 2 + s, M4); M4.compose(V.set(s ? 3.25 : -3.25, 4.2, z), Q.identity(), SC.set(1, 1, 1)); caps[s].setMatrixAt(k, M4); } }
  poles.instanceMatrix.needsUpdate = true; caps[0].instanceMatrix.needsUpdate = true; caps[1].instanceMatrix.needsUpdate = true;
  B.forEach((b, i) => { const z = ((b.z - dist * 0.6) % 520 + 520) % 520 + 30, x = b.x + Math.sign(b.x) * z * 0.12; M4.compose(V.set(x, b.h / 2, z), Q.identity(), SC.set(b.w, b.h, b.d)); city.setMatrixAt(i, M4); M4.compose(V.set(x, b.h + 0.06, z), Q.identity(), SC.set(b.w * 1.02, 1, b.d * 1.02)); roofs[i % 2].setMatrixAt(i >> 1, M4); });
  city.instanceMatrix.needsUpdate = true; roofs[0].instanceMatrix.needsUpdate = true; roofs[1].instanceMatrix.needsUpdate = true;
  // things on the highway: reuse a mesh per thing while it is on screen
  const seen = new Set();
  if (objs) for (const o of objs) {
    if (o.got || o.z > 170 || o.z + (o.len || 1) < -6) continue; if ((o.t === "orb" || o.t === "power") && o.z < -0.6) continue;
    let m = live.get(o); if (!m) { m = take(o); live.set(o, m); } seen.add(o);
    const x = X(o.lane * LANE);
    if (o.t === "orb") { m.position.set(x, o.y, o.z); m.children[0].rotation.y = t * 3 + o.z; }
    else if (o.t === "power") { m.position.set(x, o.y + 0.25 + Math.sin(t * 4) * 0.12, o.z); m.children[0].rotation.y = t * 2; }
    else m.position.set(x, 0, o.z);
  }
  for (const [o, m] of live) if (!seen.has(o)) { m.visible = false; (pools[m.userData.key] || (pools[m.userData.key] = [])).push(m); live.delete(o); }
  // the hero
  const playing = st === "play" || st === "dead" || st === "over";
  const rx = R && st !== "menu" ? X(R.x) : 0, ry = R && st !== "menu" ? R.y : 0;
  const sliding = R && st === "play" && R.slide > 0 && R.y < 0.4, air = R && st === "play" && !R.dead && R.y > 0.12 && !sliding && !(pw.jet > 0);
  slideK += ((sliding ? 1 : 0) - slideK) * Math.min(1, dt * 14);
  if (R) lean += (((R.lane * LANE - R.x) * -0.35) - lean) * Math.min(1, dt * 10);
  hero.position.set(rx, ry + (pw.jet > 0 ? 0.0 : 0) - slideK * 0.18, 0); hero.rotation.set(-slideK * 0.95, 0, R ? lean : 0);
  hero.visible = !(R && R.stumble > 0 && Math.sin(t * 40) > 0) && !(st === "over");
  if (mixer) {
    if (R && R.dead) play("Death", 0.1); else if (air && !wasAir) play("Jump", 0.08, 0.35); else if (!air && (curAct === acts.Jump && !sliding)) play("Running", 0.18); else if (!air && !curAct) play("Running", 0);
    if (curAct === acts.Running) curAct.timeScale = st === "menu" ? 1.0 : Math.min(2.1, 0.7 + spd / 22); else if (curAct === acts.Jump) curAct.timeScale = 1.25;
    wasAir = air; mixer.update(dt);
  }
  ring.position.set(rx, Math.max(0.02, ry + 0.02), 0); ring.material.opacity = st === "over" ? 0 : 0.85; ring.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
  shadow.position.set(rx, 0.012, 0); shadow.scale.setScalar(Math.max(0.3, 1 - ry * 0.25));
  shield.visible = !!(R && R.shield && !R.dead); shield.position.set(rx, ry + 0.68, 0);
  magnetRing.visible = !!(pw.magnet > 0 && R && !R.dead); magnetRing.position.set(rx, ry + 0.7, 0); magnetRing.rotation.z = t * 4;
  flames.visible = !!(pw.jet > 0 && R && !R.dead); flames.position.set(rx, ry + 0.4, 0); flames.children.forEach((f, i) => { f.scale.y = 0.7 + Math.random() * 0.6; });
  glowLight.position.set(rx, ry + 0.9, 0.6); glowLight.color.set(pw.jet > 0 ? 0xffb030 : R && R.shield ? 0x00e5ff : 0xff3de0);
  // particles from the game (crash bursts, pickups)
  const parts = S.parts || []; let n = 0;
  for (const p of parts) { if (n >= MAXP) break; pPos[n * 3] = X(p.x); pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z; tmpC.set(p.col || "#ffffff").multiplyScalar(Math.max(0, Math.min(1, p.life)) * 2.2); pCol[n * 3] = tmpC.r; pCol[n * 3 + 1] = tmpC.g; pCol[n * 3 + 2] = tmpC.b; n++; }
  pGeo.setDrawRange(0, n); pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  // the camera follows from behind, eases into lane changes and widens with speed
  const camX = st === "menu" ? Math.sin(t * 0.3) * 0.6 : X(S.camX || 0), camY = (S.camY || 2.4);
  const fovBase = innerWidth < innerHeight ? 70 : 56, fov = fovBase + (st === "play" ? Math.max(0, spd - 14) * 0.35 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  const sh = (S.shake || 0) * 0.12 * (window.ARCADE_CALM ? 0.15 : 1);
  camera.position.set(camX + (Math.random() - 0.5) * sh, camY + 0.75 + (Math.random() - 0.5) * sh, -5.0);
  camera.lookAt(camX * 0.8, 1.15 + ry * 0.45, 9);
  key.target.position.set(rx, 0.6, 0); rim.target.position.set(rx, 0.8, 0);
  flashEl.style.opacity = String(Math.max(0, (S.flash || 0) * 0.5 * (window.ARCADE_CALM ? 0.15 : 1)));
  composer.render(dt);
}
window.PR3D = { ok: true, render, resize, renderer, scene, get hasModel() { return !!robot; } };
