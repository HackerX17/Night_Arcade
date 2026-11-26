// Redline Nights: an original neon street racer. Free roam a night city, race, run from the police, climb the Redline Ten.
import * as THREE from "../vendor/three.module.min.js";
import { N, P, HALF, SIZE, DIRS, hideSpots, crashSpots, obstacles, clamp, buildWorld, makeBeacon, lineOfSight, nearestNode, nodeXZ, laneSpot, roadAt, validNode, headingOf, dirOf, solidAt, FOG_COLOR, blocks } from "./world.js";
import { CARS, carById, tune, makeBody, stepCar, collideWalls, collideCars, speedOf, makeCarModel, paintModel, poseModel } from "./cars.js";
import { Traffic, Police, Racer, aimAt } from "./ai.js";
import { Post, Particles, Skids } from "./fx.js";
import { Sound } from "./audio.js";
import { TYPES, RIVALS, RIVAL_PRIZE, makeEvents, rivalEvent, buildPath, startGrid } from "./events.js";
import { createUI } from "./ui.js";

const $ = (id) => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const TOUCH = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const fmtMoney = (n) => "$" + Math.round(n).toLocaleString();

// ---------- save & settings ----------
const DEF_SAVE = () => ({ v: 1, cash: 2500, bounty: 0, wins: 0, won: [], rival: 0, owned: ["kestrel"], car: "kestrel", up: {}, paint: {}, done: false, pos: null,
  stats: { pursuits: 0, escapes: 0, busts: 0, cops: 0, longest: 0, top: 0, races: 0, bestDrift: 0, roadblocks: 0, spots: 0 } });
const DEF_SET = () => ({ steer: TOUCH ? "drag" : "keys", sens: 22, auto: TOUCH, units: "mph", cam: "chase", quality: "auto", vib: true, zero: 0 });
function load(key, def) { try { const v = JSON.parse(store.get(key)); return v ? Object.assign(def(), v) : def(); } catch (e) { return def(); } }
const G = {
  mode: "title", paused: false, t: 0, save: load("redline-save", DEF_SAVE), settings: load("redline-settings", DEF_SET), events: makeEvents(),
  pursuit: null, race: null, gps: null, gpsTarget: null, card: null, heatFloor: 0, patrolPause: 0, drift: { pts: 0, bank: 0, chain: 0, t: 0, show: 0 }, flash: 0, shake: 0
};
G.save.stats = Object.assign(DEF_SAVE().stats, G.save.stats || {});
const saveGame = () => store.set("redline-save", JSON.stringify(G.save));
const saveSettings = () => store.set("redline-settings", JSON.stringify(G.settings));
const toKmh = (v) => v * 3.6, spdUnit = (v) => (G.settings.units === "mph" ? v * 2.23694 : v * 3.6);

// ---------- renderer and scene ----------
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const isGL2 = renderer.capabilities.isWebGL2;
const scene = new THREE.Scene(); scene.background = FOG_COLOR.clone();
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 6000);
scene.add(new THREE.HemisphereLight(0x6a4cff, 0x120820, 1.1));
const moon = new THREE.DirectionalLight(0xb9c8ff, 1.2); moon.position.set(-300, 400, -500); scene.add(moon);
const fill = new THREE.DirectionalLight(0xff4fd8, 0.55); fill.position.set(300, 120, 400); scene.add(fill);
// a neon "room" for car paint reflections
function makeEnv() {
  const pm = new THREE.PMREMGenerator(renderer), s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), new THREE.MeshBasicMaterial({ color: 0x0a0418, side: THREE.BackSide })));
  const strip = (c, x, y, z, w, h, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; s.add(m); };
  strip(new THREE.Color(3, 0.4, 2.4), 0, 20, -40, 60, 3); strip(new THREE.Color(0.3, 2.4, 3), 0, 14, 40, 60, 2); strip(new THREE.Color(2.2, 1.6, 0.8), -40, 18, 0, 50, 2, Math.PI / 2);
  strip(new THREE.Color(1.4, 0.5, 3), 40, 26, 0, 50, 4, Math.PI / 2); strip(new THREE.Color(0.9, 0.9, 1.2), 0, 45, 0, 30, 30); const top = s.children[s.children.length - 1]; top.rotation.x = Math.PI / 2;
  const rt = pm.fromScene(s, 0.02); pm.dispose(); return rt.texture;
}
const env = makeEnv();
const world = buildWorld(scene);
const post = isGL2 ? new Post(renderer) : null;
const parts = new Particles(scene), skids = new Skids(scene);
const traffic = new Traffic(scene, env, 40), police = new Police(scene, env, 14);
const sound = new Sound();

// the player's car
let playerDef = carById(G.save.car), player = null, playerModel = null;
function paintOf(id) { const d = carById(id), p = G.save.paint[id] || {}; return { paint: p.paint || d.paint, glow: p.glow || d.glow }; }
function buildPlayer(x, z, h) {
  playerDef = carById(G.save.car);
  if (playerModel) scene.remove(playerModel);
  const pc = paintOf(playerDef.id);
  playerModel = makeCarModel(playerDef.shape, pc.paint, pc.glow, env); scene.add(playerModel);
  player = makeBody(tune(playerDef, G.save.up[playerDef.id]), x, z, h);
}
// beacons for the events, rival races and crash-spot rings
const beacons = new THREE.Group(); scene.add(beacons);
function placeBeacons() {
  beacons.clear();
  for (const ev of G.events) {
    const g = startGrid(ev), b = makeBeacon(TYPES[ev.type].color); b.position.set((g[0].x + g[1].x) / 2, 0, (g[0].z + g[1].z) / 2); b.userData.ev = ev; beacons.add(b);
    ev.beacon = b; ev.bx = b.position.x; ev.bz = b.position.z;
  }
}
placeBeacons();
// checkpoint gate and the GPS chevrons on the road
const gate = new THREE.Group(); scene.add(gate); gate.visible = false;
{
  const pm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.6, 3.2) });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), pm); p.position.set(s * 12.5, 4.5, 0); gate.add(p); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(25.6, 0.5, 0.5), pm); bar.position.y = 9; gate.add(bar);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(25, 9), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0.6, 0.8), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); sheet.position.y = 4.5; gate.add(sheet);
  gate.userData.mat = pm;
}
const chevGeo = new THREE.BufferGeometry(); chevGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1.6, 0, -0.8, 0, 0, 1.0, 1.6, 0, -0.8, 1.6, 0, -0.8, 0, 0, 1.0, 0, 0, 0.2, -1.6, 0, -0.8, 0, 0, 0.2, 0, 0, 1.0].slice(0, 18)), 3));
chevGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1.6, 0, -0.9, 0, 0, 0.9, 0, 0, 0.1, 1.6, 0, -0.9, 0, 0, 0.1, 0, 0, 0.9]), 3));
const chevrons = new THREE.InstancedMesh(chevGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 2.4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 40);
chevrons.count = 0; chevrons.frustumCulled = false; scene.add(chevrons);
// racers' models
let racerModels = [];

// ---------- input ----------
const keys = new Set(), inp = { steer: 0, throttle: 0, brake: 0, hand: false, nitro: false };
let kSteer = 0;
addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
  keys.add(e.code);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code) && G.mode !== "title") e.preventDefault();
  if (e.code === "Escape" || e.code === "KeyP") { e.preventDefault(); ui.togglePause(); }
  if (e.code === "KeyC" && !e.repeat) { const order = ["chase", "far", "hood"]; G.settings.cam = order[(order.indexOf(G.settings.cam) + 1) % 3]; saveSettings(); ui.toast(`Camera: ${G.settings.cam}`); }
  if (e.code === "KeyM" && !e.repeat && (G.mode === "roam" || G.mode === "race")) ui.open("map");
  if (e.code === "KeyR" && !e.repeat && (G.mode === "roam")) resetToRoad();
  if ((e.code === "Enter" || e.code === "KeyE") && !e.repeat && G.mode === "roam" && G.nearEvent && !G.paused) { e.preventDefault(); openEvent(G.nearEvent); }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => { keys.clear(); for (const k in touch) if (typeof touch[k] === "boolean") touch[k] = false; touch.steerId = null; touch.steer = 0; });
// touch: drag anywhere on the left half to steer; pedals and buttons on the right
const touch = { steerId: null, x0: 0, steer: 0, gas: false, brake: false, hand: false, nitro: false, left: false, right: false };
function bindHold(id, key) {
  const el = $(id); if (!el) return;
  const on = (e) => { e.preventDefault(); touch[key] = true; el.classList.add("on"); sound.init(); if (G.settings.vib && navigator.vibrate) try { navigator.vibrate(8); } catch (err) {} };
  const off = () => { touch[key] = false; el.classList.remove("on"); };
  el.addEventListener("pointerdown", on); el.addEventListener("pointerup", off); el.addEventListener("pointercancel", off); el.addEventListener("pointerleave", off);
}
["tGas:gas", "tBrake:brake", "tDrift:hand", "tNitro:nitro", "tLeft:left", "tRight:right"].forEach((s) => { const [id, k] = s.split(":"); bindHold(id, k); });
const steerZone = $("steerZone");
steerZone.addEventListener("pointerdown", (e) => { if (G.settings.steer !== "drag") return; touch.steerId = e.pointerId; touch.x0 = e.clientX; touch.steer = 0; try { steerZone.setPointerCapture(e.pointerId); } catch (err) {} sound.init(); });
steerZone.addEventListener("pointermove", (e) => { if (e.pointerId !== touch.steerId) return; touch.steer = clamp((e.clientX - touch.x0) / 62, -1, 1); });
const steerEnd = (e) => { if (e.pointerId === touch.steerId) { touch.steerId = null; touch.steer = 0; } };
steerZone.addEventListener("pointerup", steerEnd); steerZone.addEventListener("pointercancel", steerEnd);
// tilt: lean the phone like a steering wheel
const tilt = { on: false, raw: 0, last: 0 };
function tiltValue(e) {
  if (e.beta == null) return null;
  const ang = (screen.orientation && typeof screen.orientation.angle === "number") ? screen.orientation.angle : (window.orientation || 0);
  const b = (e.beta * Math.PI) / 180, g = ((e.gamma || 0) * Math.PI) / 180;
  if (ang === 90) return Math.sin(b);
  if (ang === 270 || ang === -90) return -Math.sin(b);
  return Math.sin(g) * Math.cos(b);
}
addEventListener("deviceorientation", (e) => { const v = tiltValue(e); if (v != null) { tilt.raw = v; tilt.last = performance.now(); } });
async function enableTilt() {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const r = await DeviceOrientationEvent.requestPermission(); if (r !== "granted") return false;
    }
    return true;
  } catch (e) { return false; }
}
function readInput(dt) {
  const k = (c) => keys.has(c);
  const kl = k("ArrowLeft") || k("KeyA"), kr = k("ArrowRight") || k("KeyD");
  const kT = (kr ? 1 : 0) - (kl ? 1 : 0);
  kSteer += clamp(kT - kSteer, -dt * (kT === 0 ? 7 : 4.5), dt * (kT === 0 ? 7 : 4.5));
  let steer = kSteer, th = k("ArrowUp") || k("KeyW") ? 1 : 0, br = k("ArrowDown") || k("KeyS") ? 1 : 0;
  let hand = k("Space"), nitro = k("ShiftLeft") || k("ShiftRight") || k("KeyN");
  const S = G.settings;
  if (S.steer === "drag" && touch.steerId != null) steer = touch.steer;
  if (S.steer === "buttons" && (touch.left || touch.right)) steer = (touch.right ? 1 : 0) - (touch.left ? 1 : 0);
  if (S.steer === "tilt" && performance.now() - tilt.last < 1000) { let v = (tilt.raw - S.zero) / Math.sin((S.sens * Math.PI) / 180); if (Math.abs(v) < 0.05) v = 0; steer = clamp(v, -1, 1); }
  if (touch.gas) th = 1; if (touch.brake) br = 1; if (touch.hand) hand = true; if (touch.nitro) nitro = true;
  if (S.auto && TOUCH && !br && G.mode !== "title") th = Math.max(th, 1);
  // gamepad
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0; if (Math.abs(ax) > 0.12) steer = clamp(ax, -1, 1);
    const rt = p.buttons[7] ? p.buttons[7].value : 0, lt = p.buttons[6] ? p.buttons[6].value : 0;
    th = Math.max(th, rt, p.buttons[0] && p.buttons[0].pressed ? 0 : 0); br = Math.max(br, lt);
    if (p.buttons[0] && p.buttons[0].pressed) hand = true; if (p.buttons[1] && p.buttons[1].pressed) nitro = true;
    if (p.buttons[2] && p.buttons[2].pressed) hand = true;
    if (p.buttons[9] && p.buttons[9].pressed && !G.padStart) { G.padStart = true; ui.togglePause(); } else if (!(p.buttons[9] && p.buttons[9].pressed)) G.padStart = false;
  }
  inp.steer = steer; inp.throttle = th; inp.brake = br; inp.hand = hand; inp.nitro = nitro; inp.park = false;
  if (G.bot) Object.assign(inp, G.bot);                        // tests drive the car directly
}

// ---------- spots, roads, resets ----------
function startSpot() { const s = laneSpot(4, 5, 0, 0, 40); return s; }
function resetToRoad() {
  // back onto the nearest lane, facing along it
  const r = roadAt(player.x, player.z); let x, z, h;
  if (r.onV && (!r.onH || Math.abs(r.fx) < Math.abs(r.fz))) { const d = Math.cos(player.h) >= 0 ? 1 : 3; x = r.kx * P + (d === 1 ? -3 : 3); z = clamp(player.z, 0, SIZE); h = headingOf(0, d === 1 ? 1 : -1); }
  else { const d = Math.sin(player.h) >= 0 ? 0 : 2; z = r.kz * P + (d === 0 ? 3 : -3); x = clamp(player.x, 0, SIZE); h = headingOf(d === 0 ? 1 : -1, 0); }
  if (solidAt(x, z)) { const s = startSpot(); x = s.x; z = s.z; h = s.h; }
  Object.assign(player, { x, z, h, vx: 0, vz: 0, w: 0, drifting: false });
  G.flash = 0.4;
}

// ---------- the police: patrols, pursuits, heat, bounty ----------
const HEAT_AT = [0, 40, 100, 180, 280], COPS_FOR = [0, 3, 4, 6, 8, 10];
function startPursuit(reason, heat = 1) {
  if (G.pursuit || G.mode !== "roam") return;
  heat = Math.max(heat, G.heatFloor);
  G.pursuit = { heat, infamy: HEAT_AT[heat - 1] || 0, t: 0, bounty: 0, bust: 0, evade: 0, cool: 0, phase: "chase", cops: 0, roadblocks: 0, spots: 0, spawnT: 0.4, rbT: 22, lastX: player.x, lastZ: player.z, blocks: [], reason };
  for (const c of police.cops) if (c.mode === "patrol") c.mode = "chase";
  G.save.stats.pursuits++;
  ui.toast(`PURSUIT · ${reason}`, "cop"); sound.heat();
  if (window.ArcadeSound) window.ArcadeSound.style("battle");
}
function addBounty(n, msg) { if (!G.pursuit) return; G.pursuit.bounty += n; if (msg) ui.toast(`${msg} +${n.toLocaleString()}`, "bounty"); }
function addInfamy(n) {
  const p = G.pursuit; if (!p) return; p.infamy += n;
  let h = 1; for (let k = 1; k < HEAT_AT.length; k++) if (p.infamy >= HEAT_AT[k]) h = k + 1;
  if (h > p.heat) { p.heat = Math.min(5, h); ui.toast(`HEAT LEVEL ${p.heat}`, "heat"); sound.heat(); for (const c of police.cops) Object.assign(c.body.stats, copStats(p.heat, c.heavy)); }
}
function copStats(heat, heavy) { return { top: (heavy ? 50 : 52) + heat * 4.2, accel: (heavy ? 8 : 9.2) + heat * 0.5, grip: 17.5 + heat * 0.4 }; }
function endPursuit(escaped) {
  const p = G.pursuit; if (!p) return;
  const S = G.save, st = S.stats;
  st.longest = Math.max(st.longest, Math.round(p.t)); st.cops += p.cops; st.roadblocks += p.roadblocks; st.spots += p.spots;
  let summary;
  if (escaped) {
    const bonus = 1000 * p.heat, total = p.bounty + bonus, cash = Math.round(total * 0.2);
    S.bounty += total; S.cash += cash; st.escapes++;
    summary = { escaped: true, total, bonus, cash, p };
    sound.escaped(); G.heatFloor = 0;
  } else {
    const fine = Math.min(S.cash, 500 * p.heat); S.cash -= fine; st.busts++;
    summary = { escaped: false, fine, p }; sound.busted(); G.heatFloor = 0;
  }
  G.pursuit = null; obstacles.length = 0;
  for (const c of police.cops) if (c.mode !== "wreck") c.mode = "patrol", c.nav = null;
  police.spikes = []; police.updateHeli(false);
  G.patrolPause = 30; police.cops = police.cops.filter((c) => Math.hypot(c.body.x - player.x, c.body.z - player.z) < 250 && c.mode !== "wreck");
  for (const c of police.cops) c.mode = "leaving";
  saveGame();
  if (window.ArcadeSound) window.ArcadeSound.style("outrun");
  ui.pursuitEnd(summary);
  if (G.finalRun && escaped) { G.finalRun = false; S.done = true; saveGame(); setTimeout(() => ui.open("ending"), 50); }
  else if (G.finalRun) { G.finalRun = false; ui.toast("Try the final run again from the Redline Ten", "info"); }
}
let sightT = 0;
function updatePolice(dt) {
  const px = player.x, pz = player.z, pvx = player.vx, pvz = player.vz, spd = speedOf(player), p = G.pursuit;
  G.patrolPause = Math.max(0, G.patrolPause - dt);
  const heat = p ? p.heat : 1;
  const ctx = { px, pz, pvx, pvz, heat, lx: p ? p.lastX : px, lz: p ? p.lastZ : pz };
  // who can see the player (a few times a second)
  sightT -= dt;
  const hidden = hideSpots.some((s) => Math.abs(px - s.x) < s.w / 2 && Math.abs(pz - s.z) < s.d / 2);
  if (sightT <= 0) {
    sightT = 0.15;
    const range = p ? (p.phase === "cooldown" ? 70 + heat * 8 : 95 + heat * 12) : 85;
    for (const c of police.cops) {
      if (c.mode === "wreck" || c.mode === "leaving") { c.sees = false; continue; }
      const d = Math.hypot(c.body.x - px, c.body.z - pz);
      c.sees = d < (hidden ? 20 : range) && lineOfSight(c.body.x, c.body.z, px, pz);
    }
  }
  // patrols on the streets when there's no pursuit
  if (!p) {
    const patrols = police.cops.filter((c) => c.mode === "patrol").length;
    if (G.mode === "roam" && G.patrolPause <= 0 && patrols < 3 && Math.random() < dt * 0.5) police.spawnPatrol(px, pz, 1);
    // infractions in front of a patrol car start a pursuit
    for (const c of police.cops) {
      if (c.mode !== "patrol" || !c.sees) continue;
      const d = Math.hypot(c.body.x - px, c.body.z - pz);
      if (spd > 34 && d < 80) { startPursuit("SPEEDING"); break; }
      if (player.drifting && spd > 15 && d < 45) { startPursuit("RECKLESS DRIVING"); break; }
    }
  }
  // drive everyone
  for (const c of police.cops) {
    if (c.mode === "leaving") { c.mode = "patrol"; c.leaving = true; }
    police.drive(c, ctx, dt);
  }
  police.cops = police.cops.filter((c) => {
    const d = Math.hypot(c.body.x - px, c.body.z - pz);
    if (c.mode === "wreck") { c.wreckT += dt; if (c.wreckT > 14 || d > 300) return false; c.smokeT -= dt; if (c.smokeT <= 0) { c.smokeT = 0.12; parts.emit(c.body.x, 1.2, c.body.z, (Math.random() - 0.5) * 1.5, 2.5, (Math.random() - 0.5) * 1.5, 0.25, 0.22, 0.28, 0.5, 2.2, 2.2, { smoke: true, grow: 2, drag: 0.6 }); } return true; }
    if (!p && d > 620) return false;
    if (p && d > 480 && !c.sees) return false;
    if (c.leaving && d > 260) return false;
    return true;
  });
  if (!p) { police.updateHeli(false); return; }
  // ---- pursuit ----
  p.t += dt; addInfamy(dt);
  const live = police.cops.filter((c) => c.mode === "chase" || c.mode === "block");
  p.copsNow = live.length;
  const sees = live.some((c) => c.sees) || police.heliSees(px, pz);
  if (sees) { p.lastX = px; p.lastZ = pz; }
  if (p.phase === "chase") {
    p.bounty += dt * 15 * p.heat;
    // spawn more units up to the heat level's number
    p.spawnT -= dt;
    if (p.spawnT <= 0 && live.length < COPS_FOR[p.heat]) {
      p.spawnT = 2.6 - p.heat * 0.25;
      // most new units come from the roads ahead of you, the rest from anywhere around
      const ahead = spd > 15 && Math.random() < 0.6 ? Math.atan2(pvz, pvx) : null;
      const c = police.spawnPatrol(px, pz, p.heat, live.length ? 150 : 110, live.length ? 260 : 190, true, ahead);
      if (c) { c.mode = "chase"; if (p.heat >= 3 && Math.random() < 0.3) { c.heavy = true; c.hp = c.maxHp = 220; c.body.mass = 2700; c.body.inertia = 2700 * 2.02; } Object.assign(c.body.stats, copStats(p.heat, c.heavy)); }
    }
    // busted: slow, with a police car right on you
    const close = live.filter((c) => c.mode === "chase" && Math.hypot(c.body.x - px, c.body.z - pz) < 10).length;
    if (spd < 4 && close > 0) p.bust = Math.min(1, p.bust + (dt / 3.2) * (1 + 0.35 * (close - 1)));
    else p.bust = Math.max(0, p.bust - dt * 0.7);
    if (p.bust >= 1) { busted(); return; }
    // out of sight, with some distance on every unit: the evade meter fills, then the cooldown starts
    let nearest = 1e9; for (const c of live) if (c.mode === "chase") nearest = Math.min(nearest, Math.hypot(c.body.x - px, c.body.z - pz));
    const clear = !sees && nearest > 80 + p.heat * 10 && p.t > 4;
    if (clear) { p.evade = Math.min(1, p.evade + dt / (4 + p.heat * 0.9)); if (p.evade >= 1) { p.phase = "cooldown"; p.cool = 0; ui.toast("COOLDOWN · stay out of sight", "cool"); for (const c of live) if (c.mode === "chase") { c.mode = "search"; c.sx = p.lastX; c.sz = p.lastZ; c.nav = null; } } }
    else p.evade = Math.max(0, p.evade - dt * (sees ? 0.6 : 0.25));
    // roadblocks ahead from heat 2
    p.rbT -= dt;
    if (p.heat >= 2 && p.rbT <= 0 && spd > 20) { if (placeRoadblock(p)) p.rbT = 32 - p.heat * 3; else p.rbT = 4; }
  } else {
    // cooldown: units search the streets around where they last saw you, and more join the search
    const searchers = police.cops.filter((c) => c.mode === "search").length;
    p.spawnT -= dt;
    if (p.spawnT <= 0 && searchers < Math.min(4, COPS_FOR[p.heat])) { p.spawnT = 4; const c = police.spawnPatrol(p.lastX, p.lastZ, p.heat, 120, 240, true); if (c) { c.mode = "search"; c.sx = p.lastX; c.sz = p.lastZ; c.nav = null; } }
    const spotted = police.cops.some((c) => c.sees && (c.mode === "search" || c.mode === "patrol" || c.mode === "chase")) || police.heliSees(px, pz);
    if (spotted) { p.phase = "chase"; p.evade = 0.35; ui.toast("SPOTTED!", "cop"); sound.heat(); for (const c of police.cops) if (c.mode === "search" || c.mode === "patrol") { c.mode = "chase"; c.nav = null; } }
    else {
      p.cool = Math.min(1, p.cool + (dt / (20 + p.heat * 6)) * (hidden && spd < 3 ? 3 : 1));
      if (p.cool >= 1) { endPursuit(true); return; }
    }
  }
  // roadblocks: evaded once you're past
  for (const rb of p.blocks) {
    if (rb.done) continue;
    const ahead = (px - rb.x) * rb.fx + (pz - rb.z) * rb.fz;
    if (ahead > 25) { rb.done = true; p.roadblocks++; addBounty(600 * p.heat, "ROADBLOCK EVADED"); addInfamy(6); for (const c of police.cops) if (c.rb === rb && c.mode === "block") c.mode = "chase"; }
    else if (Math.hypot(px - rb.x, pz - rb.z) > 420) { rb.done = true; for (const c of police.cops) if (c.rb === rb) c.mode = "chase"; }
  }
  // spikes
  for (const s of police.spikes) {
    if (s.hit) continue;
    const dx = px - s.x, dz = pz - s.z, along = dx * Math.sin(s.h) + dz * Math.cos(s.h), lat = -dx * Math.cos(s.h) + dz * Math.sin(s.h);
    if (Math.abs(along) < 1.2 && Math.abs(lat) < s.len / 2) { s.hit = true; G.blown = 14; player.topMul = 0.62; player.gripMul = 0.75; ui.toast("TYRES BLOWN!", "cop"); sound.spikes(); G.shake = 0.6; }
  }
  // from heat 4 the helicopter joins: it follows you in a chase, and sweeps around your last sighting in a cooldown
  police.updateHeli(p.heat >= 4, px, pz, dt, G.t, p.phase === "cooldown" ? { x: p.lastX, z: p.lastZ } : null);
  // crash spots: drive through the ring at speed and the tower comes down behind you
  for (const c of crashSpots) {
    if (!c.armed || G.mode !== "roam") continue;
    if (Math.hypot(px - c.rx, pz - c.rz) < 5 && spd > 18) triggerCrashSpot(c);
  }
}
function busted() {
  const p = G.pursuit; G.mode = "card"; player.vx = player.vz = 0;
  ui.big("BUSTED", "bust"); setTimeout(() => endPursuit(false), 1400);
}
function placeRoadblock(p) {
  // put a line of police cars across the road ahead of the player, with one gap (spiked from heat 3)
  const sp = speedOf(player); if (sp < 1) return false;
  const vx = player.vx / sp, vz = player.vz / sp;
  if (Math.abs(vx) < 0.9 && Math.abs(vz) < 0.9) return false;
  const d = Math.abs(vx) > Math.abs(vz) ? (vx > 0 ? 0 : 2) : (vz > 0 ? 1 : 3), [dx, dz] = DIRS[d];
  const r = roadAt(player.x, player.z);
  let i, j;
  if (d === 0 || d === 2) { if (!r.onH) return false; j = r.kz; i = d === 0 ? Math.floor(player.x / P) + 2 : Math.ceil(player.x / P) - 2; }
  else { if (!r.onV) return false; i = r.kx; j = d === 1 ? Math.floor(player.z / P) + 2 : Math.ceil(player.z / P) - 2; }
  if (!validNode(i, j) || !validNode(i + dx, j + dz)) return false;
  const [nx, nz] = nodeXZ(i, j), cx = nx + (dx * P) / 2, cz = nz + (dz * P) / 2;
  if (Math.hypot(cx - player.x, cz - player.z) < 130) return false;
  const rb = { x: cx, z: cz, fx: dx, fz: dz, done: false };
  const gap = Math.floor(Math.random() * 4), lanes = [-9, -3, 3, 9], rx = -dz, rz = dx;
  lanes.forEach((off, k) => {
    if (k === gap) return;
    const c = police.add(cx + rx * off, cz + rz * off, headingOf(dx, dz) + Math.PI / 2 + (Math.random() - 0.5) * 0.4, "block", p.heat, p.heat >= 4 && k === (gap + 2) % 4);
    if (c) { c.rb = rb; c.body.mass = 3200; c.body.inertia = 3200 * 2.02; }
  });
  if (p.heat >= 3) police.spikes.push({ x: cx + rx * lanes[gap], z: cz + rz * lanes[gap], h: headingOf(dx, dz), len: 6.2, hit: false });
  p.blocks.push(rb); ui.toast("ROADBLOCK AHEAD", "cop");
  return true;
}
function triggerCrashSpot(c) {
  c.armed = false; c.t = 0; c.ring.visible = false;
  G.shake = 0.5; sound.boom();
}
function updateCrashSpots(dt) {
  for (const c of crashSpots) {
    if (c.t < 0) { if (!c.armed) { c.rearm -= dt; if (c.rearm <= 0) { c.armed = true; c.ring.visible = true; c.group.visible = true; c.pivot.rotation.set(0, 0, 0); } } continue; }
    c.t += dt;
    const fall = clamp(c.t / 0.75, 0, 1), ang = (Math.PI / 2) * fall * fall;
    // tip over toward the road
    if (c.axis === 0) c.pivot.rotation.x = -ang; else c.pivot.rotation.z = ang;
    if (c.t >= 0.72 && !c.landed) {
      c.landed = true; G.shake = Math.max(G.shake, 0.8); sound.boom();
      const x0 = Math.min(c.x, c.x + c.fx * 36), x1 = Math.max(c.x, c.x + c.fx * 36), z0 = Math.min(c.z, c.z + c.fz * 36), z1 = Math.max(c.z, c.z + c.fz * 36);
      const ob = { x0: x0 - (c.axis === 0 ? 8 : 0.8), x1: x1 + (c.axis === 0 ? 8 : 0.8), z0: z0 - (c.axis === 1 ? 8 : 0.8), z1: z1 + (c.axis === 1 ? 8 : 0.8), copsOnly: true };
      obstacles.push(ob); c.ob = ob;
      // everything under it, and the units right behind you on that road, is wrecked
      let n = 0;
      const ax = c.axis === 0 ? 1 : 0, az = c.axis === 0 ? 0 : 1;          // the road runs along x (axis 0) or z (axis 1)
      for (const cop of police.cops) {
        if (cop.mode === "wreck") continue;
        const b = cop.body, under = b.x > ob.x0 - 4 && b.x < ob.x1 + 4 && b.z > ob.z0 - 4 && b.z < ob.z1 + 4;
        const along = (b.x - c.rx) * ax + (b.z - c.rz) * az, side = Math.abs((b.x - c.rx) * az + (b.z - c.rz) * ax);
        const toward = (b.vx * ax + b.vz * az) * Math.sign(-along || 1) > 4;
        if (under || (side < 14 && Math.abs(along) < 45 && toward)) { wreckCop(cop, false); n++; }
      }
      c.n = n;
      for (let k = 0; k < 40; k++) parts.emit(c.x + c.fx * 18 + (Math.random() - 0.5) * 20, 1, c.z + c.fz * 18 + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 8, 4 + Math.random() * 5, (Math.random() - 0.5) * 8, 2.2, 1.2, 0.4, 1, 0.9, 1.2);
      if (G.pursuit) { G.pursuit.spots++; addBounty(1500 + 600 * n, n ? `CRASH SPOT · ${n} COP${n > 1 ? "S" : ""} DOWN` : "CRASH SPOT"); addInfamy(10); }
    }
    // cops that drive into the debris later wreck on it too
    if (c.landed && c.t < 26) for (const cop of police.cops) { if (cop.mode === "wreck") continue; const b = cop.body; if (b.x > c.ob.x0 - 2.5 && b.x < c.ob.x1 + 2.5 && b.z > c.ob.z0 - 2.5 && b.z < c.ob.z1 + 2.5 && speedOf(b) > 6) { wreckCop(cop, false); if (G.pursuit) addBounty(400 * G.pursuit.heat, "COP CRASHED INTO THE DEBRIS"); } }
    if (c.t > 26) { c.t = -1; c.landed = false; c.group.visible = false; c.rearm = 150; const k = obstacles.indexOf(c.ob); if (k >= 0) obstacles.splice(k, 1); }
  }
}
function wreckCop(c, byPlayer = true) {
  if (c.mode === "wreck") return;
  c.mode = "wreck"; c.hp = 0; c.wreckT = 0;
  for (let k = 0; k < 18; k++) parts.emit(c.body.x, 1, c.body.z, (Math.random() - 0.5) * 10, 3 + Math.random() * 4, (Math.random() - 0.5) * 10, 2.4, 1.3, 0.4, 1, 0.5, 0.8);
  if (G.pursuit) { G.pursuit.cops++; if (byPlayer) { addBounty(400 * G.pursuit.heat, "COP DISABLED"); addInfamy(8); } }
}

// ---------- races ----------
const RACER_NAMES = ["Mika 'Fuse' Tan", "Ozzy Reyes", "Lune", "Bram Kovac", "Tessa Quill", "Kofi Mensah", "Ash Ramirez", "Yuki Sato", "Dante Cruz", "Pixel", "Mara Volkov", "Jett Nakamura"];
function openEvent(ev) {
  if (G.pursuit) { ui.toast("Lose the cops first", "cop"); return; }
  G.card = ev; G.mode = "card"; ui.eventCard(ev);
}
function cancelEvent() { G.card = null; G.mode = "roam"; }
function setupRace(ev, quick = false) {
  G.card = null; G.quick = quick;
  police.clear(); G.pursuit = null; obstacles.length = 0;
  traffic.clear(); traffic.want = ev.type === "rival" ? 14 : 18;
  for (const m of racerModels) scene.remove(m); racerModels = [];
  const grid = startGrid(ev), isRival = ev.type === "rival", solo = ["speedtrap", "drift", "tollbooth"].includes(ev.type);
  const slot = isRival ? 1 : solo ? 0 : 3;
  buildPlayer(grid[slot].x, grid[slot].z, grid[slot].h);
  const racers = [];
  if (!solo) {
    const opp = isRival ? [{ def: carById(ev.rival.car), name: ev.rival.name, paint: ev.rival.paint, glow: ev.rival.glow, skill: ev.rival.skill, slot: 0 }] :
      (() => { const names = RACER_NAMES.slice().sort(() => Math.random() - 0.5); return [0, 1, 2].map((k) => {
        const pool = CARS.filter((c, i) => i <= Math.min(CARS.length - 1, 1 + ev.tier * 1.3)); const def = pool[Math.floor(Math.random() * pool.length)];
        return { def, name: names[k], paint: def.paint, glow: def.glow, skill: 0.88 + ev.tier * 0.025 + Math.random() * 0.03, slot: [0, 1, 2][k] };
      }); })();
    for (const o of opp) {
      const s = grid[o.slot], body = makeBody(tune(o.def, { engine: Math.min(3, ev.tier - 1), tires: Math.min(3, ev.tier - 1) }), s.x, s.z, s.h);
      const model = makeCarModel(o.def.shape, o.paint, o.glow, env); scene.add(model); racerModels.push(model);
      const rc = new Racer(body, ev.path, o.skill); rc.name = o.name; rc.model = model; rc.def = o.def; racers.push(rc);
    }
  }
  const cps = ev.nodes.map(([i, j]) => { const [x, z] = nodeXZ(i, j); let best = 0, bd = 1e18; ev.path.forEach((p, k) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = k; } }); return best; });
  if (!ev.closed) cps.push(ev.path.length - 1);
  G.race = { ev, racers, t: -3.5, count: 4, idx: 0, lap: 0, cps, cp: ev.closed ? 1 : 0, done: false, finish: [], trap: [], trapTotal: 0, drift: 0, timeLeft: ev.time || 0, wrongT: 0 };
  G.drift = { pts: 0, bank: 0, chain: 0, t: 0, show: 0 };
  skids.clear(); parts.clear();
  G.mode = "race"; ui.raceStart(G.race);
  if (window.ArcadeSound) window.ArcadeSound.style("outrun");
}
function raceProgress(idx, lap, ev) { return lap * ev.path[ev.path.length - 1].s + ev.path[idx].s; }
function locateOnPath(path, from, x, z, win = 40) {
  let best = from, bd = 1e18;
  for (let k = Math.max(0, from - 4); k < Math.min(path.length, from + win); k++) { const d = (path[k].x - x) ** 2 + (path[k].z - z) ** 2; if (d < bd) { bd = d; best = k; } }
  return { idx: best, d: Math.sqrt(bd) };
}
function updateRace(dt) {
  const R = G.race, ev = R.ev, path = ev.path, L = path[path.length - 1].s;
  R.t += dt;
  if (R.t < 0) {
    const n = Math.ceil(-R.t); if (n < R.count) { R.count = n; if (n <= 3) { ui.big(String(n), "count"); sound.beep(false); } }
    return;
  }
  if (R.count > 0) { R.count = 0; ui.big("GO!", "go"); sound.beep(true); }
  // racers
  for (const rc of R.racers) {
    if (!rc.done) {
      const my = raceProgress(rc.idx, rc.lap, ev), pl = raceProgress(R.idx, R.lap, ev), gap = pl - my;
      rc.band = clamp(1 + gap / 700, ev.type === "rival" ? 0.95 : 0.9, ev.type === "rival" ? 1.13 : 1.09);
    }
  }
  // the player along the route
  const loc = locateOnPath(path, R.idx, player.x, player.z);
  if (loc.d < 30) R.idx = loc.idx;
  if (ev.closed && R.idx > path.length - 6 && R.cp >= R.cps.length) { R.idx = 0; R.lap++; R.cp = 1; if (R.lap < ev.laps) { ui.toast(R.lap === ev.laps - 1 ? "FINAL LAP" : `LAP ${R.lap + 1}`, "info"); sound.checkpoint(); } }
  // checkpoints in order
  const nextCp = R.cps[R.cp];
  if (nextCp != null && R.idx >= nextCp - 1 && R.idx <= nextCp + 30) { R.cp++; sound.checkpoint(); if (ev.type === "tollbooth") { R.timeLeft += 0; } }
  for (const rc of R.racers) {
    if (rc.done) continue;
    // a racer wedged somewhere out of your sight for a while is put back on its line
    const pr = rc.lap * 1e5 + rc.idx; if (pr > (rc.bestPr || -1)) { rc.bestPr = pr; rc.stallT = 0; } else rc.stallT = (rc.stallT || 0) + dt;
    if (rc.stallT > 5 && Math.hypot(rc.b.x - player.x, rc.b.z - player.z) > 60) {
      const k = Math.min(path.length - 2, rc.idx + 3), a = path[k], b2 = path[k + 1], h = Math.atan2(b2.x - a.x, b2.z - a.z);
      Object.assign(rc.b, { x: a.x, z: a.z, h, vx: Math.sin(h) * 12, vz: Math.cos(h) * 12, w: 0, drifting: false }); rc.idx = k; rc.stallT = 0; rc.revT = 0;
    }
    if (ev.closed && rc.idx >= path.length - 3) { rc.idx = 0; rc.lap++; }
    const fin = ev.closed ? rc.lap >= ev.laps : rc.idx >= path.length - 3;
    if (fin) { rc.done = true; R.finish.push({ name: rc.name, t: R.t, player: false }); }
  }
  // speed cameras
  if (ev.type === "speedtrap") for (const k of ev.cams) if (!R.trap.includes(k) && R.idx >= k) { R.trap.push(k); const v = Math.round(spdUnit(speedOf(player))); R.trapTotal += Math.round(toKmh(speedOf(player))); ui.toast(`📸 ${v} ${G.settings.units === "mph" ? "MPH" : "KM/H"}`, "info"); sound.cash(); }
  if (ev.type === "drift") R.drift = G.drift.bank + G.drift.pts;
  if (ev.type === "tollbooth" || ev.type === "drift") { R.timeLeft -= dt; if (R.timeLeft <= 0 && !R.done) { finishRace(false, "TIME UP"); return; } }
  // wrong way
  const a = path[Math.min(path.length - 1, R.idx + 3)], b = path[R.idx], tx = a.x - b.x, tz = a.z - b.z, tl = Math.hypot(tx, tz) || 1;
  if ((player.vx * tx + player.vz * tz) / tl < -6) R.wrongT += dt; else R.wrongT = 0;
  // the finish
  const pdone = ev.closed ? R.lap >= ev.laps : R.cp >= R.cps.length;
  if (pdone && !R.done) {
    R.finish.push({ name: "You", t: R.t, player: true });
    let won = true, why = "";
    if (ev.type === "speedtrap") { won = R.trapTotal >= ev.target; why = `${R.trapTotal} / ${ev.target} km/h`; }
    else if (ev.type === "drift") { won = R.drift >= ev.target; why = `${Math.round(R.drift).toLocaleString()} / ${ev.target.toLocaleString()} pts`; }
    else if (ev.type !== "tollbooth") won = R.finish[0].player;
    finishRace(won, why);
  }
}
function finishRace(won, why) {
  const R = G.race; if (R.done) return; R.done = true;
  const ev = R.ev, S = G.save;
  // everyone else's finishing time: done ones as recorded, the rest estimated from how far they had to go
  const L = ev.path[ev.path.length - 1].s * ev.laps;
  const order = R.finish.slice();
  for (const rc of R.racers) if (!rc.done) { const left = L - raceProgress(rc.idx, rc.lap, ev); order.push({ name: rc.name, t: R.t + left / Math.max(15, speedOf(rc.b) * 0.8 + 10), player: false }); }
  if (!R.finish.some((f) => f.player)) order.push({ name: "You", t: Infinity, player: true });
  order.sort((a, b) => a.t - b.t);
  const pos = order.findIndex((f) => f.player) + 1;
  if (["sprint", "circuit", "rival"].includes(ev.type)) won = pos === 1;
  let reward = null;
  S.stats.races++;
  if (won && !G.quick) {
    S.cash += ev.prize;
    if (ev.type === "rival") {
      const rv = ev.rival; S.rival = Math.max(S.rival, RIVALS.indexOf(rv) + 1);
      const car = RIVAL_PRIZE[rv.rank]; if (car && !S.owned.includes(car)) { S.owned.push(car); reward = car; }
    } else if (!S.won.includes(ev.id)) { S.won.push(ev.id); S.wins = S.won.length; }
  }
  saveGame();
  (won ? sound.win : sound.lose).call(sound);
  setTimeout(() => {
    ui.results({ ev, won, pos, order, why, reward, prize: won && !G.quick ? ev.prize : 0, time: R.t });
    if (won && ev.type === "rival" && ev.rival.rank === 1 && !G.quick) G.pendingFinal = true;
  }, 1600);
}
function leaveRace(toTitle) {
  for (const m of racerModels) scene.remove(m); racerModels = [];
  const R = G.race; G.race = null; gate.visible = false; chevrons.count = 0;
  if (toTitle || G.quick) { G.quick = false; ui.open(G.quickMenu ? "quick" : "title"); return; }
  G.mode = "roam"; traffic.want = trafficWant();
  if (G.pendingFinal) { G.pendingFinal = false; G.finalRun = true; G.heatFloor = 5; ui.toast("FINAL RUN · escape the whole city", "cop"); setTimeout(() => startPursuit("THE FINAL RUN", 5), 1500); }
}

// ---------- GPS ----------
function routeTo(tx, tz) {
  const [ti, tj] = nearestNode(tx, tz), d = dirOf(player.h), [ai, aj] = nearestNode(player.x + Math.sin(player.h) * 60, player.z + Math.cos(player.h) * 60);
  const prev = new Map(), q = [[ai, aj]], key = (i, j) => i * 100 + j; prev.set(key(ai, aj), null);
  while (q.length) { const [i, j] = q.shift(); if (i === ti && j === tj) break; for (const [dx, dz] of DIRS) { const ni = i + dx, nj = j + dz; if (!validNode(ni, nj) || prev.has(key(ni, nj))) continue; prev.set(key(ni, nj), [i, j]); q.push([ni, nj]); } }
  const nodes = []; let cur = [ti, tj]; while (cur) { nodes.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
  if (nodes.length < 2) return null;
  const path = buildPath(nodes, false); path.push({ x: tx, z: tz, v: 99, s: path[path.length - 1].s + Math.hypot(tx - path[path.length - 1].x, tz - path[path.length - 1].z) });
  return path;
}
function setGps(target) { G.gpsTarget = target; G.gps = target ? routeTo(target.x, target.z) : null; G.gpsIdx = 0; G.gpsT = 0; if (target) ui.toast(`GPS set: ${target.name}`, "info"); }
function drawChevrons(path, from) {
  let n = 0; if (!path) { chevrons.count = 0; return; }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  for (let k = from + 6; k < path.length - 1 && n < 40; k += 6) {
    const a = path[k], b = path[Math.min(path.length - 1, k + 1)], h = Math.atan2(b.x - a.x, b.z - a.z);
    m4.compose(v.set(a.x, 0.08, a.z), q.setFromAxisAngle(up, h), s); chevrons.setMatrixAt(n++, m4);
  }
  chevrons.count = n; chevrons.instanceMatrix.needsUpdate = true;
}

// ---------- the player each step: physics, hits, drift score ----------
function hitFeedback(k) { G.shake = Math.max(G.shake, Math.min(0.9, k / 25)); sound.hit(Math.min(1, k / 30)); if (G.settings.vib && TOUCH && navigator.vibrate && k > 6) try { navigator.vibrate(Math.min(60, k * 2)); } catch (e) {} }
function physicsStep(h) {
  const driving = G.mode === "roam" || (G.mode === "race" && G.race && G.race.t >= 0 && !G.race.done);
  const frozen = G.mode === "race" && G.race && G.race.t < 0;
  if (G.mode === "title") { attract.drive(h); collideWalls(attract.b); }
  else if (frozen) { stepCar(player, { steer: 0, throttle: 0, brake: 0, hand: false, nitro: false, park: true }, h); }
  else stepCar(player, driving ? inp : { steer: 0, throttle: 0, brake: 0, hand: false, nitro: false, park: true }, h);
  const me = G.mode === "title" ? attract.b : player;
  const wall = G.noWalls ? 0 : collideWalls(me);
  if (wall > 4 && G.mode !== "title") { hitFeedback(wall); if (wall > 8) for (let k = 0; k < 8; k++) parts.emit(me.x + Math.sin(me.h) * 2, 0.6, me.z + Math.cos(me.h) * 2, (Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8, 3, 1.6, 0.5, 1, 0.25, 0.4); if (G.drift.pts > 0 && wall > 6) { G.drift.pts = 0; G.drift.chain = 0; ui.driftLost(); } }
  if (G.race) for (const rc of G.race.racers) { if (!frozen) rc.drive(h); else stepCar(rc.b, { steer: 0, throttle: 0, brake: 0, hand: false, nitro: false, park: true }, h); collideWalls(rc.b); }
  // collisions between cars
  if (G.mode !== "title") {
    for (const c of police.cops) {
      const k = collideCars(me, c.body);
      if (k > 1.5) {
        hitFeedback(k);
        if (c.mode !== "wreck") {
          const dmg = k * 4.2 * (me.mass / 1400) * (me.stats.armour || 1);
          c.hp -= dmg; if (c.hp <= 0) wreckCop(c);
          if (!G.pursuit && G.mode === "roam") startPursuit("HITTING A POLICE CAR"); else if (G.pursuit && k > 6) addInfamy(4);
        }
      }
    }
    for (let a = 0; a < police.cops.length; a++) for (let b = a + 1; b < police.cops.length; b++) collideCars(police.cops[a].body, police.cops[b].body);
    if (G.race) for (const rc of G.race.racers) { const k = collideCars(me, rc.b); if (k > 2) hitFeedback(k); for (const r2 of G.race.racers) if (r2 !== rc) collideCars(rc.b, r2.b); }
    for (const t of traffic.cars) {
      const tb = t.body, dx = tb.x - me.x, dz = tb.z - me.z;
      if (dx * dx + dz * dz < 40) {
        if (t.mode !== "dyn") { const pre = { ...tb }; const k = collideCars(Object.assign({}, me), Object.assign({}, tb)); if (k > 0) traffic.knock(t); else continue; Object.assign(tb, { x: pre.x, z: pre.z }); }
        const k = collideCars(me, tb);
        if (k > 1.5) { hitFeedback(k); if (G.pursuit) addInfamy(1); else if (k > 6 && G.mode === "roam" && police.cops.some((c) => c.sees && c.mode === "patrol")) startPursuit("HIT AND RUN"); }
      }
      for (const c of police.cops) { const cx = tb.x - c.body.x, cz = tb.z - c.body.z; if (cx * cx + cz * cz < 40) { if (t.mode !== "dyn") traffic.knock(t); const k = collideCars(c.body, tb); if (k > 12 && c.mode !== "wreck") { c.hp -= (k - 8) * 3; if (c.hp <= 0) wreckCop(c, false); } } }
      if (G.race) for (const rc of G.race.racers) { const rx = tb.x - rc.b.x, rz = tb.z - rc.b.z; if (rx * rx + rz * rz < 40) { if (t.mode !== "dyn") traffic.knock(t); collideCars(rc.b, tb); } }
    }
    // cops slamming into walls hurt themselves
    for (const c of police.cops) { if (c.mode === "wreck") continue; const k = collideWalls(c.body, true); if (k > 14) { c.hp -= (k - 10) * 3.2; if (c.hp <= 0) wreckCop(c, false); } }
  }
}
function updateDrift(dt) {
  const D = G.drift, spd = speedOf(player);
  // points for a real slide (the angle past ~7°, times speed); drifts strung together within 2.5 s build a multiplier up to ×4
  const angle = clamp((player.slip - 0.12) / 0.5, 0, 1.2);
  if (player.drifting && spd > 12 && angle > 0 && G.mode !== "title") {
    if (D.pts === 0) D.chain = Math.min(4, D.chain + 1);
    D.pts += spd * angle * dt * 24 * Math.max(1, D.chain);
    D.t = 0; D.show = 2;
  } else if (D.pts > 0) {
    D.t += dt;
    if (D.t > 0.9) { D.bank += D.pts; G.save.stats.bestDrift = Math.max(G.save.stats.bestDrift, Math.round(D.pts)); ui.driftBanked(Math.round(D.pts)); D.pts = 0; }
  } else { D.t += dt; if (D.t > 2.5) D.chain = 0; }
  D.show = Math.max(0, D.show - dt);
}

// ---------- camera ----------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(); let camInit = false, camFov = 62;
function updateCamera(dt, me) {
  const spd = speedOf(me), mode = G.settings.cam;
  const vh = spd > 4 ? Math.atan2(me.vx, me.vz) : me.h, lookH = me.h + clamp(wrap(vh - me.h), -0.6, 0.6) * 0.55;
  const back = mode === "far" ? 10.5 : mode === "hood" ? -0.6 : 7.2, height = mode === "far" ? 3.8 : mode === "hood" ? 1.25 : 2.55;
  const tx = me.x - Math.sin(lookH) * back, tz = me.z - Math.cos(lookH) * back, ty = height + spd * 0.012;
  if (!camInit) { camPos.set(tx, ty, tz); camInit = true; }
  const k = mode === "hood" ? 1 : 1 - Math.exp(-dt * 7.5);
  camPos.x += (tx - camPos.x) * k; camPos.z += (tz - camPos.z) * k; camPos.y += (ty - camPos.y) * k;
  // keep the camera out of buildings
  if (mode !== "hood") for (let s = 1; s <= 6; s++) { const f = s / 6, x = me.x + (camPos.x - me.x) * f, z = me.z + (camPos.z - me.z) * f; if (solidAt(x, z)) { const f2 = (s - 1) / 6; camPos.x = me.x + (camPos.x - me.x) * f2; camPos.z = me.z + (camPos.z - me.z) * f2; break; } }
  const ahead = mode === "hood" ? 30 : 6;
  camLook.set(me.x + Math.sin(lookH) * ahead, mode === "hood" ? 1.1 : 1.15, me.z + Math.cos(lookH) * ahead);
  camera.position.copy(camPos);
  if (G.shake > 0) { const k = G.shake * (window.ARCADE_CALM ? 0.15 : 1); camera.position.x += (Math.random() - 0.5) * k * 0.6; camera.position.y += (Math.random() - 0.5) * k * 0.5; }
  if (me.nitroOn) { camera.position.x += (Math.random() - 0.5) * 0.05; camera.position.y += (Math.random() - 0.5) * 0.05; }
  camera.lookAt(camLook);
  const fovT = 60 + Math.min(20, spd * 0.24) + (me.nitroOn ? 8 : 0);
  camFov += (fovT - camFov) * (1 - Math.exp(-dt * 3)); camera.fov = camFov * (W < H ? 1.2 : 1); camera.updateProjectionMatrix();
}

// ---------- the title screen: a car laps the city on its own ----------
const attract = new Racer(makeBody(tune(carById("phantom")), 0, 0, 0), null, 1);
let attractModel = null;
function startAttract() {
  const ev = G.events.find((e) => e.closed) || G.events[0];
  attract.path = ev.path; attract.idx = 0; const g = startGrid(ev);
  Object.assign(attract.b, { x: g[0].x, z: g[0].z, h: g[0].h, vx: 0, vz: 0, w: 0 });
  if (!attractModel) { attractModel = makeCarModel("super", "#ff3de0", "#00e5ff", env); scene.add(attractModel); }
  attractModel.visible = true; camInit = false;
  traffic.clear(); traffic.want = 22; police.clear();
}

// ---------- layout, quality ----------
let W = 1, H = 1, dprCap = 2;
function applyQuality() {
  const q = G.settings.quality === "auto" ? (G.autoQ || (TOUCH ? "medium" : "high")) : G.settings.quality;
  G.q = q; dprCap = q === "high" ? (TOUCH ? 1.6 : 2) : q === "medium" ? 1.25 : 1;
  G.bloom = !!post && q !== "low";
  traffic.want = trafficWant();
  resize();
}
function trafficWant() { const q = G.q || "high"; return q === "low" ? 18 : q === "medium" ? 26 : 34; }
function resize() {
  W = innerWidth; H = innerHeight; const dpr = Math.min(devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
  if (post) post.setSize(Math.round(W * dpr), Math.round(H * dpr));
  camera.aspect = W / H; camera.updateProjectionMatrix();
  ui && ui.resize(W, H);
}
addEventListener("resize", resize);

// ---------- frame ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0, hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (window.__hold) { last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { step(dt); draw(); } catch (e) { if (!frame.warned) { frame.warned = true; console.error(e); } }
  // auto quality: if it's slow for a few seconds, step down
  if (G.settings.quality === "auto" && G.mode !== "title") {
    fpsAcc += dt; fpsN++; fpsT += dt;
    if (fpsT > 4) { const avg = fpsAcc / fpsN; fpsAcc = fpsN = fpsT = 0; if (avg > 0.026 && G.q !== "low") { G.autoQ = G.q === "high" ? "medium" : "low"; applyQuality(); ui.toast(`Graphics: ${G.autoQ} for smoother play`, "info"); } }
  }
}
function step(dt) {
  G.t += dt;
  if (G.paused) return;
  const playing = G.mode === "roam" || G.mode === "race" || G.mode === "title" || G.mode === "card";
  if (!playing) return;
  readInput(dt);
  const sub = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / sub;
  if (G.mode !== "card") for (let s = 0; s < sub; s++) physicsStep(h);
  const me = G.mode === "title" ? attract.b : player;
  if (G.mode === "title" && attract.path && attract.idx > attract.path.length - 4) attract.idx = 0;
  // the world around
  const camF = [Math.sin(me.h), Math.cos(me.h)];
  if (G.mode !== "card") traffic.update(dt, me.x, me.z, camF[0], camF[1], [me, ...police.cops.map((c) => c.body), ...(G.race ? G.race.racers.map((r) => r.b) : [])], G.t);
  if (G.mode === "roam") { updatePolice(dt); updateCrashSpots(dt); }
  else if (G.mode === "race") { updateRace(dt); updateCrashSpots(dt); }
  else if (G.mode === "card") updateCrashSpots(dt);
  if (G.mode !== "title" && G.mode !== "card") updateDrift(dt);
  // blown tyres heal; nitro and drift effects
  if (G.blown > 0) { G.blown -= dt; if (G.blown <= 0) { player.topMul = 1; player.gripMul = 1; ui.toast("Tyres reinflated", "info"); } else if (Math.random() < dt * 30) parts.emit(player.x, 0.4, player.z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 3, 1.8, 0.6, 1, 0.2, 0.3); }
  effects(me, dt);
  if (G.mode === "roam") {
    // near an event start: show it
    let near = null; if (!G.pursuit && speedOf(player) < 26) for (const ev of G.events) if (Math.hypot(player.x - ev.bx, player.z - ev.bz) < 11) { near = ev; break; }
    if (near !== G.nearEvent) { G.nearEvent = near; ui.prompt(near); }
    if (G.gps) { const loc = locateOnPath(G.gps, G.gpsIdx, player.x, player.z, 60); if (loc.d < 40) G.gpsIdx = loc.idx; G.gpsT += dt; if (loc.d > 60 && G.gpsT > 2) { G.gpsT = 0; G.gps = routeTo(G.gpsTarget.x, G.gpsTarget.z); G.gpsIdx = 0; } if (Math.hypot(player.x - G.gpsTarget.x, player.z - G.gpsTarget.z) < 18) { G.gps = null; G.gpsTarget = null; ui.toast("You've arrived", "info"); } }
    G.saveT = (G.saveT || 0) + dt; if (G.saveT > 8 && !G.pursuit) { G.saveT = 0; G.save.pos = { x: player.x, z: player.z, h: player.h }; G.save.stats.top = Math.max(G.save.stats.top, Math.round(toKmh(speedOf(player)))); saveGame(); }
  }
  G.save.stats.top = Math.max(G.save.stats.top, Math.round(toKmh(speedOf(me))));
  G.shake = Math.max(0, G.shake - dt * 1.8); G.flash = Math.max(0, G.flash - dt * 2.5);
  updateCamera(dt, me);
  // sound
  const cops = police.cops.filter((c) => c.mode === "chase" || c.mode === "block"); let nearest = 1e9; for (const c of cops) nearest = Math.min(nearest, Math.hypot(c.body.x - me.x, c.body.z - me.z));
  sound.update({ on: G.mode !== "title" && G.mode !== "card", rpm: me.rpm, throttle: G.mode === "title" ? 0.6 : inp.throttle, speed: speedOf(me), slip: me.drifting ? Math.min(1, me.slip * 2) : inp.brake && speedOf(me) > 15 ? 0.4 : 0, nitro: me.nitroOn, siren: cops.length ? clamp(1 - nearest / 260, 0.15, 1) : 0, close: nearest < 40 ? 1 : 0 }, dt);
  hudT -= dt; if (hudT <= 0) { hudT = 0.1; ui.hud(); }
  ui.frame(dt);
}
function effects(me, dt) {
  // tyre smoke, skid marks, nitro flames
  const sh = Math.sin(me.h), ch = Math.cos(me.h), S = shapeRear(me);
  const sliding = me.drifting || (inp.brake && speedOf(me) > 18 && G.mode !== "title") || (inp.hand && speedOf(me) > 8);
  for (const side of [-1, 1]) {
    const wx = me.x - sh * S + (-ch) * side * 0.85, wz = me.z - ch * S + sh * side * 0.85;
    skids.mark(side < 0 ? 0 : 1, wx, wz, sliding && G.mode !== "title", me.drifting ? 1 : 0.6);
    if (sliding && Math.random() < dt * 40) parts.emit(wx, 0.4, wz, (Math.random() - 0.5) * 2 - me.vx * 0.05, 0.6 + Math.random(), (Math.random() - 0.5) * 2 - me.vz * 0.05, 0.75, 0.72, 0.85, 0.32, 1.4, 1.6, { smoke: true, grow: 3.2, drag: 1.2 });
  }
  if (me.nitroOn) for (const side of [-1, 1]) { const ex = me.x - sh * (S + 0.6) + -ch * side * 0.4, ez = me.z - ch * (S + 0.6) + sh * side * 0.4; parts.emit(ex, 0.45, ez, -sh * 8 + me.vx * 0.6, 0.2, -ch * 8 + me.vz * 0.6, 0.6, 0.7, 3.2, 1, 0.5, 0.12); parts.emit(ex, 0.45, ez, -sh * 5 + me.vx * 0.6, 0.2, -ch * 5 + me.vz * 0.6, 2.4, 0.6, 2.8, 0.8, 0.35, 0.08); }
  if (me.nitroOn && !G.nitroWas) sound.nitroStart(); G.nitroWas = me.nitroOn;
  parts.update(dt);
}
const shapeRear = (me) => (me === player && playerModel ? playerModel.userData.shape.wb : 1.4);
function draw() {
  const me = G.mode === "title" ? attract.b : player;
  if (G.mode === "title" && attractModel) poseModel(attractModel, attract.b, attract.b.steer);
  if (playerModel) { playerModel.visible = G.mode !== "title"; if (player) poseModel(playerModel, player, player.steer); }
  if (G.race) for (const rc of G.race.racers) poseModel(rc.model, rc.b, rc.b.steer);
  traffic.draw(); police.draw(G.t);
  world.update(G.t, 1 / 60);
  for (const b of beacons.children) { b.visible = G.mode === "roam" && !G.pursuit; if (b.userData.mat) b.userData.mat.uniforms.uTime.value = G.t; }
  // road lighting: headlights, police lights, the helicopter's spotlight
  const R = world.road.uniforms; R.uHead.value.set(me.x + Math.sin(me.h) * 2, me.z + Math.cos(me.h) * 2, Math.sin(me.h), Math.cos(me.h));
  const cl = police.cops.filter((c) => c.mode === "chase" || c.mode === "block").sort((a, b) => Math.hypot(a.body.x - me.x, a.body.z - me.z) - Math.hypot(b.body.x - me.x, b.body.z - me.z));
  for (let k = 0; k < 4; k++) { const c = cl[k]; if (c) R.uCop.value[k].set(c.body.x, c.body.z, 1, ((G.t * 3.2 + c.phase) % 1) < 0.5 ? 0 : 1); else R.uCop.value[k].set(0, 0, 0, 0); }
  const H2 = police.heliState; R.uHeli.value.set(H2.sx, H2.sz, H2.on ? 1 : 0, 15);
  // race gate and GPS chevrons
  if (G.race && !G.race.done) {
    const R2 = G.race, k = R2.cps[Math.min(R2.cp, R2.cps.length - 1)], p = R2.ev.path[k], q = R2.ev.path[Math.min(R2.ev.path.length - 1, k + 2)] || p;
    gate.visible = true; gate.position.set(p.x, 0, p.z); gate.rotation.y = Math.atan2(q.x - p.x, q.z - p.z) + Math.PI / 2;
    gate.userData.mat.color.setRGB(...(R2.cp >= R2.cps.length - 1 && !R2.ev.closed ? [3, 2.6, 0.6] : [0.3, 2.6, 3.2]));
    drawChevrons(R2.ev.path, R2.idx);
  } else { gate.visible = false; drawChevrons(G.mode === "roam" ? G.gps : null, G.gpsIdx || 0); }
  if (G.bloom) { post.comp.uniforms.flash.value = G.flash * 0.5; post.render(scene, camera); }
  else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
  ui.draw(me);
}

// ---------- modes ----------
function startCareer() {
  G.quick = false; G.quickMenu = false; G.race = null; G.pursuit = null; obstacles.length = 0;
  const sp = G.save.pos && !solidAt(G.save.pos.x, G.save.pos.z) ? G.save.pos : startSpot();
  buildPlayer(sp.x, sp.z, sp.h); if (attractModel) attractModel.visible = false;
  traffic.clear(); police.clear(); traffic.want = trafficWant(); skids.clear(); parts.clear();
  G.mode = "roam"; camInit = false; G.patrolPause = 12;
  sound.init();
  if (window.ArcadeSound) { window.ArcadeSound.style("outrun"); window.ArcadeSound.pause(false); window.ArcadeSound.play(); }
}
function toTitle() {
  if (G.pursuit) { G.pursuit = null; police.updateHeli(false); }
  for (const m of racerModels) scene.remove(m); racerModels = []; G.race = null; gate.visible = false; chevrons.count = 0;
  G.mode = "title"; startAttract();
  if (window.ArcadeSound) window.ArcadeSound.style("outrun");
}
function changeCar(id) {
  if (!G.save.owned.includes(id)) return;
  G.save.car = id; saveGame();
  if (player) { const { x, z, h } = player; buildPlayer(x, z, h); }
}

// ---------- UI and start ----------
const ui = createUI(G, {
  startCareer, toTitle, setupRace, cancelEvent, leaveRace, setGps, changeCar, saveGame, saveSettings, applyQuality, enableTilt, resetToRoad,
  repaint: () => { if (playerModel) { const pc = paintOf(playerDef.id); paintModel(playerModel, pc.paint, pc.glow); } },
  rebuildPlayer: () => { if (player) { const { x, z, h, vx, vz } = player; buildPlayer(x, z, h); player.vx = vx; player.vz = vz; } },
  calibrate: () => { G.settings.zero = tilt.raw; saveSettings(); },
  tiltLive: () => performance.now() - tilt.last < 1000,
  get player() { return player; }, get tiltRaw() { return tilt.raw; },
  sound, speed: () => speedOf(G.mode === "title" ? attract.b : player), spdUnit, fmtMoney, TOUCH, police, traffic, openEvent, endPursuit
});
applyQuality();
buildPlayer(startSpot().x, startSpot().z, startSpot().h);
startAttract();
requestAnimationFrame(frame);
$("loading") && ($("loading").hidden = true);

// test hook (add #debug to the address)
// a driver for tests: follows a path like the AI racers do, by setting the player's inputs
function botDrive(path, st) {
  const b = player, spd = speedOf(b);
  if (st.closed && (st.idx || 0) > path.length - 6) st.idx = 0;
  const loc = locateOnPath(path, st.idx || 0, b.x, b.z, 40); st.idx = loc.idx;
  let k = st.idx, acc = 0; const look = 7 + spd * 0.42;
  while (k < path.length - 1 && acc < look) { acc += Math.hypot(path[k + 1].x - path[k].x, path[k + 1].z - path[k].z); k++; }
  const ang = aimAt(b, path[k].x, path[k].z); let vT = 999; acc = 0;
  const reach = Math.min(260, 20 + Math.ceil((spd * spd) / 30 / 2));
  for (let j = st.idx; j < Math.min(path.length, st.idx + reach); j++) { if (j > st.idx) acc += 2; vT = Math.min(vT, Math.sqrt(path[j].v * path[j].v * (st.skill || 1) + 2 * 15 * acc)); }
  if (st.revT > 0) { st.revT -= 1 / 60; G.bot = { steer: -st.last, throttle: 0, brake: 1, hand: false, nitro: false }; return; }
  const racing = !(G.race && G.race.t < 0);
  if (spd < 2 && racing) { st.stuck = (st.stuck || 0) + 1 / 60; if (st.stuck > 1.4) { st.stuck = 0; st.revT = 1; st.backs = (st.backs || 0) + 1; } } else st.stuck = 0;
  const over = spd - vT; st.last = clamp(ang * 2.6, -1, 1);
  G.bot = { steer: st.last, throttle: over < -0.5 ? 1 : 0.2, brake: over > 1.5 ? clamp(over / 8, 0.2, 1) : 0, hand: Math.abs(ang) > 0.9 && spd > 18, nitro: !!st.nitro && Math.abs(ang) < 0.05 };
  if (st.drift) {
    // a stab of handbrake as each corner opens, then a steady throttle through the slide
    let cornerAt = -1; for (let j = st.idx; j < Math.min(path.length - 1, st.idx + 10); j++) if (path[j].v < 50) { cornerAt = j; break; }
    const inArc = path[st.idx].v < 50;
    if (cornerAt >= 0 && !inArc && st.armed !== cornerAt && spd > 15) { st.hbT = 0.22; st.armed = cornerAt + 40; }
    if (st.hbT > 0) { st.hbT -= 1 / 60; G.bot.hand = true; G.bot.brake = 0; G.bot.throttle = 0.5; }
    else if (b.drifting) { G.bot.throttle = 0.75; G.bot.brake = 0; }
  }
}
if (/debug/.test(location.hash)) window.__RN = {
  botDrive, locateOnPath, addInfamy, wreckCop, updateRace, rivalEvent,
  G, get player() { return player; }, police, traffic, crashSpots, obstacles, inp, keys, touch, tilt, camera, renderer, scene,
  startCareer, toTitle, setupRace, openEvent, leaveRace, startPursuit, endPursuit, placeRoadblock, triggerCrashSpot, setGps, routeTo, changeCar, resetToRoad,
  step(dt) { step(dt); }, draw() { draw(); }, sim(sec, dt = 1 / 60, ctl) { for (let i = 0; i < sec / dt; i++) { if (ctl) ctl(); step(dt); } }, speedOf, aimAt, events: G.events, RIVALS, CARS, ui,
  setInput(o) { G.bot = Object.assign(G.bot || {}, o); }, clearInput() { G.bot = null; }, readInput
};
