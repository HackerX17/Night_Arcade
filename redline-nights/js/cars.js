// Cars: the line-up, the arcade driving model (grip, slides and drifts, nitro), collisions, and the 3D models.
import * as THREE from "../vendor/three.module.min.js";
import { collideCircle, clamp } from "./world.js";

// ---------- the line-up (all original designs) ----------
export const CARS = [
  { id: "kestrel",  name: "Kestrel GT",   shape: "coupe",  top: 64, accel: 8.8,  grip: 17.0, handling: 1.0,  mass: 1350, paint: "#1fd8ff", glow: "#00e5ff", blurb: "A light, honest coupe. Easy to drive, easy to drift." },
  { id: "vandal",   name: "Vandal RS",    shape: "muscle", top: 67, accel: 9.8,  grip: 15.6, handling: 0.94, mass: 1560, paint: "#ff2e4d", glow: "#ff2e4d", blurb: "Big engine, loose rear end. Loves a long straight." },
  { id: "mirage",   name: "Mirage S",     shape: "tuner",  top: 67, accel: 9.4,  grip: 18.6, handling: 1.08, mass: 1240, paint: "#b6ff00", glow: "#b6ff00", blurb: "A tuner hatch that turns on a coin." },
  { id: "nightjar", name: "Nightjar",     shape: "coupe",  top: 71, accel: 10.4, grip: 18.2, handling: 1.03, mass: 1400, paint: "#c94dff", glow: "#c94dff", blurb: "Quick and calm at speed. A pursuit favourite." },
  { id: "halcyon",  name: "Halcyon V8",   shape: "muscle", top: 75, accel: 11.0, grip: 17.3, handling: 0.97, mass: 1620, paint: "#ffd23f", glow: "#ffb800", blurb: "Heavy and brutal. Cop cars bounce off it." },
  { id: "zephyr",   name: "Zephyr R",     shape: "tuner",  top: 77, accel: 11.6, grip: 19.6, handling: 1.1,  mass: 1300, paint: "#00ffd5", glow: "#00ffd5", blurb: "Sharp, light, and very fast through the corners." },
  { id: "phantom",  name: "Phantom X",    shape: "super",  top: 81, accel: 12.4, grip: 20.6, handling: 1.1,  mass: 1380, paint: "#ff6ad5", glow: "#ff3de0", blurb: "Mid-engined and twitchy. Nothing else stays close." },
  { id: "zero",     name: "Redline Zero", shape: "super",  top: 87, accel: 13.4, grip: 21.6, handling: 1.14, mass: 1320, paint: "#f4f1ff", glow: "#ff2e4d", blurb: "The car at the top of the Redline Ten." }
];
export const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];
export const UPG = { engine: ["Stock", "Street", "Pro", "Redline"], nitro: ["Stock", "Street", "Pro", "Redline"], tires: ["Stock", "Street", "Pro", "Redline"], body: ["Stock", "Street", "Pro", "Redline"] };
export const UPG_PRICE = [0, 1500, 4000, 9000];
// the numbers a car drives with, after upgrades
export function tune(def, up = {}) {
  const e = up.engine || 0, n = up.nitro || 0, t = up.tires || 0, b = up.body || 0;
  return {
    top: def.top * (1 + 0.045 * e), accel: def.accel * (1 + 0.07 * e), grip: def.grip * (1 + 0.06 * t), handling: def.handling * (1 + 0.03 * t),
    mass: def.mass * (1 + 0.06 * b), armour: 1 + 0.3 * b, nitroDur: 3.2 * (1 + 0.22 * n), nitroRegen: 0.045 * (1 + 0.25 * n), brake: 17 + 1.2 * t
  };
}

// ---------- a driving body ----------
export function makeBody(stats, x = 0, z = 0, h = 0) {
  return { stats, x, z, h, vx: 0, vz: 0, w: 0, steer: 0, nitro: 1, nitroOn: false, drifting: false, slip: 0, vl: 0, vt: 0, topMul: 1, gripMul: 1,
    mass: stats.mass, inertia: stats.mass * 2.02, rpm: 0, gear: 1, wheelSpin: 0, roll: 0, pitch: 0, lastHit: 0, hitT: 0 };
}
export const speedOf = (c) => Math.hypot(c.vx, c.vz);
// one step of the driving model. inp = { steer -1..1 (right +), throttle 0..1, brake 0..1, hand, nitro }
export function stepCar(c, inp, dt) {
  const s = c.stats;
  const sh0 = Math.sin(c.h), ch0 = Math.cos(c.h);
  const vl0 = c.vx * sh0 + c.vz * ch0, fwd = Math.abs(vl0);
  // steering eases in, and back to centre faster
  const tgt = clamp(inp.steer || 0, -1, 1);
  c.steer += (tgt - c.steer) * Math.min(1, dt * (Math.abs(tgt) < Math.abs(c.steer) ? 11 : 6.5));
  // the yaw rate the tyres can hold at this speed; slides and the handbrake let the nose swing further
  const low = clamp(fwd / 4.5, 0, 1);
  const hold = Math.min(1.85, (s.grip * c.gripMul * 1.2) / Math.max(fwd, 8.5));      // a little more than the tyres can hold: hard turns at speed start to slide
  let wT = -c.steer * hold * low * s.handling * (vl0 < -0.5 ? -1 : 1);
  if (c.drifting) wT *= 1.5;
  if (inp.hand) wT *= 1.75;
  c.w += (wT - c.w) * Math.min(1, dt * (c.drifting ? 5.5 : 8.5));
  c.h += c.w * dt;
  // velocity in the car's frame after the turn
  const sh = Math.sin(c.h), ch = Math.cos(c.h);
  let vl = c.vx * sh + c.vz * ch, vt = -c.vx * ch + c.vz * sh;
  const spd = Math.hypot(vl, vt);
  c.slip = Math.atan2(Math.abs(vt), Math.abs(vl) + 0.01);
  if (!c.drifting && spd > 11 && (c.slip > 0.24 || (inp.hand && Math.abs(c.steer) > 0.25 && spd > 13))) c.drifting = true;
  else if (c.drifting && (c.slip < 0.1 || spd < 6.5)) c.drifting = false;
  // nitro
  const nitroOn = !!inp.nitro && c.nitro > 0.005 && (inp.throttle || 0) > 0.1 && vl > 4;
  if (nitroOn) c.nitro = Math.max(0, c.nitro - dt / s.nitroDur);
  else c.nitro = Math.min(1, c.nitro + dt * s.nitroRegen * (c.drifting ? 2.2 : spd > 40 ? 1.3 : 1));   // drifting and speed refill it faster
  c.nitroOn = nitroOn;
  const top = s.top * c.topMul * (nitroOn ? 1.15 : 1);
  // engine, brakes, coasting
  const th = inp.throttle || 0, br = inp.brake || 0;
  let a = 0;
  if (th > 0) {
    if (vl < -0.5) a += s.brake * th;
    else { const r = clamp(vl / top, 0, 1.2); a += s.accel * (1 - Math.pow(r, 2.2)) * th * (vl < 10 ? 1.15 : 1); if (nitroOn) a += s.accel * 0.8; }
  }
  if (inp.park) a = 0;                                                         // parked: hold still, never reverse
  else if (br > 0) { if (vl > 0.5) a -= s.brake * br; else if (vl > -13) a -= 7 * br; }
  vl += a * dt;
  if (inp.park) vl -= Math.sign(vl) * Math.min(Math.abs(vl), s.brake * dt);
  if (vl > top * 1.02 && !nitroOn) vl -= (vl - top) * Math.min(1, dt * 1.5);     // over the top speed (nitro ran out): settle back
  const coast = (th < 0.05 ? 1.5 : 0) + 0.28 + 0.00022 * vl * vl;
  vl -= Math.sign(vl) * Math.min(Math.abs(vl), coast * dt);
  if (inp.hand) vl -= Math.sign(vl) * Math.min(Math.abs(vl), 3.2 * dt);
  // grip pulls the slide back in line with the nose; while drifting some of it carries you forward
  const g = s.grip * c.gripMul * (inp.hand ? 0.22 : c.drifting ? 0.46 : 1);
  const dvt = Math.min(Math.abs(vt), g * dt);
  vt -= Math.sign(vt) * dvt;
  if (c.drifting && vl > 0) vl += dvt * 0.32;
  c.vl = vl; c.vt = vt;
  c.vx = vl * sh - vt * ch; c.vz = vl * ch + vt * sh;
  c.x += c.vx * dt; c.z += c.vz * dt;
  // looks: body roll and pitch, wheel spin, engine rpm and gear
  c.roll += (clamp(-vt * 0.02 - c.w * vl * 0.004, -0.09, 0.09) - c.roll) * Math.min(1, dt * 6);
  c.pitch += (clamp(-a * 0.004, -0.05, 0.05) - c.pitch) * Math.min(1, dt * 5);
  c.wheelSpin += vl * dt / 0.34;
  const ratio = clamp(vl / (s.top * 1.02), 0, 1), gears = 6, gpos = ratio * gears;
  c.gear = vl < -0.5 ? -1 : Math.min(gears, Math.floor(gpos) + 1);
  c.rpm = vl < -0.5 ? 0.4 : clamp(0.22 + (gpos - Math.floor(Math.min(gpos, gears - 0.001))) * 0.78, 0.22, 1);
  c.hitT = Math.max(0, c.hitT - dt);
}

// ---------- collisions ----------
const OFFS = [1.45, 0, -1.45], CR = 1.05;
// against the city; returns the hardest hit speed (m/s into the wall)
export function collideWalls(c, isCop = false) {
  let worst = 0;
  for (let pass = 0; pass < 2; pass++) {
    const sh = Math.sin(c.h), ch = Math.cos(c.h);
    for (const off of OFFS) {
      const px = c.x + sh * off, pz = c.z + ch * off, col = collideCircle(px, pz, CR, isCop);
      if (!col) continue;
      const nx = col.nx, nz = col.nz;
      c.x += nx * col.pen; c.z += nz * col.pen;
      const rx = sh * off - nx * CR, rz = ch * off - nz * CR, I = 2.02;
      const vpx = c.vx + c.w * rz, vpz = c.vz - c.w * rx, vn = vpx * nx + vpz * nz;
      if (vn >= 0) continue;
      const rn = rz * nx - rx * nz, kN = 1 + (rn * rn) / I, J = (-(1 + 0.12) * vn) / kN;
      c.vx += J * nx; c.vz += J * nz; c.w += (J * rn) / I * 0.6;
      const tx = -nz, tz = nx, vt = (c.vx + c.w * rz) * tx + (c.vz - c.w * rx) * tz, rt = rz * tx - rx * tz, kT = 1 + (rt * rt) / I;
      const Jt = clamp(-vt / kT, -0.3 * J, 0.3 * J);
      c.vx += Jt * tx; c.vz += Jt * tz;
      worst = Math.max(worst, -vn);
    }
  }
  if (worst > 2) { c.lastHit = worst; c.hitT = 0.3; c.drifting = false; }
  return worst;
}
// two cars; returns the closing speed of the hit (0 if they don't touch)
export function collideCars(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  if (dx * dx + dz * dz > 36) return 0;
  const sa = Math.sin(a.h), ca = Math.cos(a.h), sb = Math.sin(b.h), cb = Math.cos(b.h);
  let best = null;
  for (const oa of OFFS) for (const ob of OFFS) {
    const ax = a.x + sa * oa, az = a.z + ca * oa, bx = b.x + sb * ob, bz = b.z + cb * ob, ex = ax - bx, ez = az - bz, d2 = ex * ex + ez * ez;
    if (d2 < (2 * CR) * (2 * CR) && (!best || d2 < best.d2)) best = { d2, ax, az, bx, bz };
  }
  if (!best) return 0;
  const d = Math.sqrt(best.d2) || 1e-4, nx = (best.ax - best.bx) / d, nz = (best.az - best.bz) / d, pen = 2 * CR - d;
  const ma = a.mass, mb = b.mass, tot = ma + mb;
  a.x += nx * pen * (mb / tot); a.z += nz * pen * (mb / tot); b.x -= nx * pen * (ma / tot); b.z -= nz * pen * (ma / tot);
  const cx = (best.ax + best.bx) / 2, cz = (best.az + best.bz) / 2;
  const rax = cx - a.x, raz = cz - a.z, rbx = cx - b.x, rbz = cz - b.z;
  const vax = a.vx + a.w * raz, vaz = a.vz - a.w * rax, vbx = b.vx + b.w * rbz, vbz = b.vz - b.w * rbx;
  const vn = (vax - vbx) * nx + (vaz - vbz) * nz;
  if (vn >= 0) return 0;
  const rna = raz * nx - rax * nz, rnb = rbz * nx - rbx * nz;
  const k = 1 / ma + 1 / mb + (rna * rna) / a.inertia + (rnb * rnb) / b.inertia, J = (-(1 + 0.25) * vn) / k;
  a.vx += (J * nx) / ma; a.vz += (J * nz) / ma; b.vx -= (J * nx) / mb; b.vz -= (J * nz) / mb;
  a.w += ((J * rna) / a.inertia) * 0.5; b.w -= ((J * rnb) / b.inertia) * 0.5;
  // a little sideways scrub so cars don't stick together
  const tx = -nz, tz = nx, vt = (vax - vbx) * tx + (vaz - vbz) * tz, jt = clamp(-vt / (1 / ma + 1 / mb), -0.3 * J, 0.3 * J);
  a.vx += (jt * tx) / ma; a.vz += (jt * tz) / ma; b.vx -= (jt * tx) / mb; b.vz -= (jt * tz) / mb;
  const hit = -vn;
  if (hit > 2) { a.lastHit = Math.max(a.lastHit, hit); b.lastHit = Math.max(b.lastHit, hit); a.hitT = b.hitT = 0.3; a.drifting = b.drifting = false; }
  return hit;
}

// ---------- models ----------
// side profiles (x along the car, + is the front; y up): the lower body, and the cabin on top
const SHAPES = {
  coupe:  { L: 4.5, W: 1.95, wb: 1.38, wr: 0.34, lightY: 0.6, tailY: 0.8, low: [[-2.25, 0.3], [-2.28, 0.62], [-2.2, 0.86], [-1.5, 0.92], [1.2, 0.9], [2.05, 0.76], [2.28, 0.56], [2.24, 0.3]], cab: [[-1.45, 0.9], [-0.95, 1.22], [0.25, 1.27], [0.98, 0.9]], spoiler: true },
  muscle: { L: 4.75, W: 2.0, wb: 1.5, wr: 0.36, lightY: 0.72, tailY: 0.88, low: [[-2.36, 0.32], [-2.38, 0.72], [-2.3, 0.96], [-1.6, 1.0], [1.4, 0.98], [2.25, 0.9], [2.38, 0.62], [2.34, 0.32]], cab: [[-1.5, 0.98], [-0.95, 1.3], [0.3, 1.33], [0.9, 0.98]], scoop: true },
  tuner:  { L: 4.25, W: 1.86, wb: 1.3, wr: 0.33, lightY: 0.62, tailY: 0.82, low: [[-2.1, 0.3], [-2.15, 0.7], [-2.02, 0.9], [1.1, 0.88], [1.95, 0.75], [2.15, 0.52], [2.1, 0.3]], cab: [[-1.95, 0.88], [-1.62, 1.3], [0.2, 1.33], [0.96, 0.88]], spoiler: true, wing: true },
  super:  { L: 4.6, W: 2.02, wb: 1.42, wr: 0.35, lightY: 0.5, tailY: 0.68, low: [[-2.28, 0.28], [-2.32, 0.62], [-2.12, 0.82], [-0.9, 0.86], [1.4, 0.72], [2.2, 0.54], [2.33, 0.4], [2.29, 0.28]], cab: [[-1.25, 0.84], [-0.6, 1.12], [0.4, 1.14], [1.3, 0.74]], wing: true },
  sedan:  { L: 4.7, W: 1.92, wb: 1.42, wr: 0.34, lightY: 0.7, tailY: 0.82, low: [[-2.32, 0.34], [-2.34, 0.76], [-2.22, 0.96], [-1.5, 0.98], [1.25, 0.95], [2.15, 0.86], [2.34, 0.62], [2.3, 0.34]], cab: [[-1.55, 0.97], [-1.05, 1.42], [0.55, 1.44], [1.15, 0.95]] },
  hatch:  { L: 4.0, W: 1.8, wb: 1.25, wr: 0.32, lightY: 0.72, tailY: 0.9, low: [[-1.96, 0.34], [-2.0, 0.8], [-1.95, 1.0], [1.0, 0.97], [1.8, 0.86], [1.98, 0.6], [1.95, 0.34]], cab: [[-1.95, 0.99], [-1.7, 1.5], [0.35, 1.52], [1.0, 0.97]] },
  suv:    { L: 4.85, W: 2.06, wb: 1.5, wr: 0.4, lightY: 0.95, tailY: 1.05, low: [[-2.4, 0.45], [-2.42, 1.0], [-2.35, 1.18], [1.5, 1.15], [2.3, 1.05], [2.42, 0.8], [2.38, 0.45]], cab: [[-2.3, 1.16], [-2.12, 1.8], [0.7, 1.82], [1.4, 1.16]] },
  van:    { L: 5.1, W: 2.06, wb: 1.65, wr: 0.38, lightY: 0.9, tailY: 1.2, low: [[-2.52, 0.4], [-2.54, 1.2], [2.25, 1.15], [2.52, 0.9], [2.48, 0.4]], cab: [[-2.5, 1.18], [-2.48, 2.15], [1.25, 2.15], [2.05, 1.2]] }
};
export const shapeOf = (k) => SHAPES[k];
function extrude(points, width, bevel) {
  const sh = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1, steps: 1 });
  g.rotateY(-Math.PI / 2); g.translate(width / 2, 0, 0);
  return g.index ? g.toNonIndexed() : g;
}
function paintGeo(g, col) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(col, i * 3); g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; }
function merge(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3);
    o += g.attributes.position.count;
  }
  const m = new THREE.BufferGeometry(); m.setAttribute("position", new THREE.BufferAttribute(pos, 3)); m.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); m.setAttribute("color", new THREE.BufferAttribute(col, 3));
  m.computeBoundingSphere(); return m;
}
const GLASS = [0.035, 0.04, 0.07], RUBBER = [0.03, 0.03, 0.04], TRIM = [0.06, 0.06, 0.08];
// the body (paint is white, so a per-car or per-instance colour tints it), with wheels baked in when `wheels` is true
export function bodyGeometry(kind, { wheels = true, copLivery = false } = {}) {
  const S = SHAPES[kind], parts = [];
  parts.push(paintGeo(extrude(S.low, S.W - 0.1, 0.05), [1, 1, 1]));
  parts.push(paintGeo(extrude(S.cab, S.W - 0.42, 0.06), GLASS));
  // roof panel in body colour
  const roofPts = S.cab.slice(1, 3); const rl = Math.abs(roofPts[1][0] - roofPts[0][0]) * 0.86;
  const roof = new THREE.BoxGeometry(S.W - 0.6, 0.05, rl); roof.translate(0, Math.max(roofPts[0][1], roofPts[1][1]) + 0.04, (roofPts[0][0] + roofPts[1][0]) / 2);
  parts.push(paintGeo(roof.toNonIndexed(), copLivery ? [0.92, 0.92, 0.95] : [1, 1, 1]));
  const skirt = new THREE.BoxGeometry(S.W - 0.05, 0.16, S.L - 0.5); skirt.translate(0, 0.3, 0); parts.push(paintGeo(skirt.toNonIndexed(), TRIM));
  if (S.spoiler || S.wing) {
    const w = new THREE.BoxGeometry(S.W - 0.25, 0.05, 0.36); w.translate(0, S.wing ? S.low[2][1] + 0.3 : S.low[2][1] + 0.08, -S.L / 2 + 0.3); parts.push(paintGeo(w.toNonIndexed(), S.wing ? TRIM : [1, 1, 1]));
    if (S.wing) for (const sx of [-0.55, 0.55]) { const p = new THREE.BoxGeometry(0.06, 0.28, 0.12); p.translate(sx, S.low[2][1] + 0.16, -S.L / 2 + 0.3); parts.push(paintGeo(p.toNonIndexed(), TRIM)); }
  }
  if (S.scoop) { const sc = new THREE.BoxGeometry(0.6, 0.12, 0.9); sc.translate(0, S.low[4][1] + 0.05, 1.3); parts.push(paintGeo(sc.toNonIndexed(), TRIM)); }
  if (copLivery) { const door = new THREE.BoxGeometry(S.W - 0.06, 0.34, 1.9); door.translate(0, 0.66, -0.1); parts.push(paintGeo(door.toNonIndexed(), [0.93, 0.93, 0.96])); }
  if (wheels) for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.CylinderGeometry(S.wr, S.wr, 0.26, 14); w.rotateZ(Math.PI / 2); w.translate(sx * (S.W / 2 - 0.1), S.wr, sz * S.wb); parts.push(paintGeo(w.toNonIndexed(), RUBBER));
  }
  return merge(parts);
}
// headlights (white) and tail lights (red), bright enough to bloom
export function lightGeometry(kind) {
  const S = SHAPES[kind], parts = [];
  for (const sx of [-1, 1]) { const h = new THREE.BoxGeometry(0.46, 0.1, 0.06); h.translate(sx * (S.W / 2 - 0.42), S.lightY, S.L / 2 - 0.02); parts.push(paintGeo(h.toNonIndexed(), [3.2, 3.1, 2.8])); }
  const t = new THREE.BoxGeometry(S.W - 0.36, 0.08, 0.06); t.translate(0, S.tailY, -S.L / 2 + 0.01); parts.push(paintGeo(t.toNonIndexed(), [3.4, 0.12, 0.18]));
  return merge(parts);
}
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}
// a full model for the player and the racers: painted body, spinning wheels with neon rims, lights, underglow
export function makeCarModel(kind, paint, glow, env) {
  const S = SHAPES[kind], root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(paint), metalness: 0.55, roughness: 0.3, envMap: env || null, envMapIntensity: 1.25 });
  const bm = new THREE.Mesh(bodyGeometry(kind, { wheels: false }), paintMat); body.add(bm);
  const lights = new THREE.Mesh(lightGeometry(kind), new THREE.MeshBasicMaterial({ vertexColors: true })); body.add(lights);
  const wheelGeo = new THREE.CylinderGeometry(S.wr, S.wr, 0.26, 16); wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.8, metalness: 0.2 });
  const rimGeo = new THREE.TorusGeometry(S.wr * 0.62, 0.035, 6, 20); rimGeo.rotateY(Math.PI / 2);
  const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(glow).multiplyScalar(2.2) });
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * (S.W / 2 - 0.1), S.wr, sz * S.wb); root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(new THREE.Mesh(wheelGeo, wheelMat)); const rim = new THREE.Mesh(rimGeo, rimMat); rim.position.x = sx * 0.135; spin.add(rim);
    wheels.push({ pivot, spin, front: sz > 0 });
  }
  const under = new THREE.Mesh(new THREE.PlaneGeometry(S.W + 1.4, S.L + 1.6), new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(glow).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  under.rotation.x = -Math.PI / 2; under.position.y = 0.05; root.add(under);
  root.userData = { body, wheels, paintMat, rimMat, under, shape: S, kind };
  return root;
}
export function paintModel(model, paint, glow) {
  model.userData.paintMat.color.set(paint);
  model.userData.rimMat.color.set(glow).multiplyScalar(2.2);
  model.userData.under.material.color.set(glow).multiplyScalar(1.6);
}
// put a body's pose on its model
export function poseModel(model, c, steerVis = 0) {
  model.position.set(c.x, 0, c.z); model.rotation.y = c.h;
  const u = model.userData; u.body.rotation.z = c.roll; u.body.rotation.x = c.pitch;
  for (const w of u.wheels) { w.spin.rotation.x = c.wheelSpin; if (w.front) w.pivot.rotation.y = -steerVis * 0.45; }
}
