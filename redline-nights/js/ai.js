// Everyone else on the road: traffic, the police, and the racers.
import * as THREE from "../vendor/three.module.min.js";
import { N, P, HALF, LANES, DIRS, nodeXZ, headingOf, validNode, clamp, lineOfSight, nearestNode, laneSpot, hideSpots, roadAt } from "./world.js";
import { bodyGeometry, lightGeometry, makeBody, stepCar, collideWalls, speedOf } from "./cars.js";

const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), col3 = new THREE.Color();
const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// steer a body toward a point; returns the angle off the nose (radians, + = to the right)
export function aimAt(c, tx, tz) {
  const dx = tx - c.x, dz = tz - c.z, sh = Math.sin(c.h), ch = Math.cos(c.h);
  const fwd = dx * sh + dz * ch, right = -dx * ch + dz * sh;
  return Math.atan2(right, fwd);
}
function nextDir(i, j, d, pick) {
  const opts = [];
  for (const nd of [d, (d + 1) % 4, (d + 3) % 4]) { const [dx, dz] = DIRS[nd]; if (validNode(i + dx, j + dz)) opts.push(nd); }
  if (!opts.length) return (d + 2) % 4;
  return pick ? pick(opts) : (Math.random() < 0.55 && opts.includes(d) ? d : opts[Math.floor(Math.random() * opts.length)]);
}
function bez(p0, p1, p2, t) { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]; }
function bezD(p0, p1, p2, t) { const u = 1 - t; return [2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])]; }
function turnPath(i, j, d, nd, lane) {
  // from the stop line of node (i, j) arriving in direction d, to the far side leaving in direction nd
  const [nx, nz] = nodeXZ(i, j), [dx, dz] = DIRS[d], [ex, ez] = DIRS[nd], off = LANES[lane];
  const p0 = [nx - dx * HALF - dz * off, nz - dz * HALF + dx * off];
  const p2 = [nx + ex * HALF - ez * off, nz + ez * HALF + ex * off];
  let p1;
  if (nd === d) p1 = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
  else p1 = dz === 0 ? [p2[0], p0[1]] : [p0[0], p2[1]];
  const len = (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p2[0] - p0[0], p2[1] - p0[1])) / 2;
  return { p0, p1, p2, len: Math.max(1, len), nd, t: 0 };
}

// ---------- traffic ----------
const T_KINDS = ["sedan", "hatch", "suv", "van"], T_MASS = { sedan: 1500, hatch: 1250, suv: 2100, van: 2400 };
const T_PAINT = ["#d9d9e0", "#2b2f3a", "#7a1020", "#16306b", "#3b3b42", "#c9b38a", "#0f4d3a", "#e8e4dc", "#5a1a6e", "#9aa3b0", "#14141a", "#b8462a"];
const T_STATS = { top: 40, accel: 5, grip: 13, handling: 1, mass: 1500, nitroDur: 1, nitroRegen: 0, brake: 14, armour: 1 };
export class Traffic {
  constructor(scene, env, cap) {
    this.cap = cap; this.cars = []; this.want = cap; this.nextId = 1; this.busy = new Map();
    this.sets = T_KINDS.map((k) => {
      const body = new THREE.InstancedMesh(bodyGeometry(k), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.42, envMap: env, envMapIntensity: 0.9 }), cap);
      const lights = new THREE.InstancedMesh(lightGeometry(k), new THREE.MeshBasicMaterial({ vertexColors: true }), cap);
      body.count = lights.count = 0; body.frustumCulled = lights.frustumCulled = false;
      body.setColorAt(0, col3.set("#ffffff")); scene.add(body, lights);
      return { kind: k, body, lights };
    });
  }
  clear() { this.cars = []; this.busy.clear(); }
  spawnOne(px, pz, camFx, camFz, near = false) {
    for (let tries = 0; tries < 12; tries++) {
      const [ci, cj] = nearestNode(px + (Math.random() - 0.5) * 700, pz + (Math.random() - 0.5) * 700);
      const d = Math.floor(Math.random() * 4), [dx, dz] = DIRS[d];
      if (!validNode(ci + dx, cj + dz)) continue;
      const lane = Math.random() < 0.5 ? 0 : 1, s = HALF + 6 + Math.random() * (P - 2 * HALF - 12), sp = laneSpot(ci, cj, d, lane, s);
      const dist = Math.hypot(sp.x - px, sp.z - pz);
      if (dist < (near ? 40 : 150) || dist > 380) continue;
      if (!near && dist < 220 && ((sp.x - px) * camFx + (sp.z - pz) * camFz) / dist > 0.2) continue;       // not in plain view
      if (this.cars.some((c) => Math.hypot(c.body.x - sp.x, c.body.z - sp.z) < 16)) continue;
      const kind = T_KINDS[Math.random() < 0.45 ? 0 : Math.random() < 0.5 ? 1 : Math.random() < 0.6 ? 2 : 3];
      const body = makeBody({ ...T_STATS, mass: T_MASS[kind] }, sp.x, sp.z, sp.h);
      const speed = 10 + Math.random() * 6;
      this.cars.push({ id: this.nextId++, kind, paint: new THREE.Color(T_PAINT[Math.floor(Math.random() * T_PAINT.length)]), mode: "lane", i: ci, j: cj, d, lane, s, speed, cruise: speed, body, turn: null, wait: 0, dynT: 0 });
      return true;
    }
    return false;
  }
  // who's in the lane just ahead of a traffic car (other traffic, the player, cops, racers)
  blocked(c, others) {
    const b = c.body, sh = Math.sin(b.h), ch = Math.cos(b.h); let gap = 99;
    const test = (x, z) => { const dx = x - b.x, dz = z - b.z, f = dx * sh + dz * ch; if (f <= 0 || f > 22) return; const lat = Math.abs(-dx * ch + dz * sh); if (lat < 2.4) gap = Math.min(gap, f); };
    for (const o of this.cars) if (o !== c) test(o.body.x, o.body.z);
    for (const o of others) test(o.x, o.z);
    return gap;
  }
  update(dt, px, pz, camFx, camFz, others, t) {
    // keep the streets around the player busy, and drop cars that are far away
    this.cars = this.cars.filter((c) => { const far = Math.hypot(c.body.x - px, c.body.z - pz) > (c.mode === "dyn" ? 260 : 430); if (far && c.reserved) this.release(c); return !far; });
    let n = 0; while (this.cars.length < this.want && n++ < 3) this.spawnOne(px, pz, camFx, camFz);
    for (const c of this.cars) {
      const b = c.body;
      if (c.mode === "dyn") {
        stepCar(b, { steer: 0, throttle: 0, brake: 0, hand: false, nitro: false, park: true }, dt); collideWalls(b);
        c.dynT += dt; continue;
      }
      const gap = this.blocked(c, others);
      let target = c.cruise; if (gap < 22) target = Math.min(target, Math.max(0, (gap - 7) * 0.9));
      if (c.mode === "lane") {
        const stop = P - HALF - 1.5;
        if (c.s >= stop - 0.5) {
          // the crossing ahead: one car at a time, but nobody waits for ever
          const key = (c.i + DIRS[c.d][0]) * 100 + (c.j + DIRS[c.d][1]), owner = this.busy.get(key);
          if (owner && owner !== c.id && c.wait < 3) { target = 0; c.wait += dt; }
          else {
            this.busy.set(key, c.id); c.reserved = key; c.wait = 0;
            const ni = c.i + DIRS[c.d][0], nj = c.j + DIRS[c.d][1], nd = nextDir(ni, nj, c.d);
            c.turn = turnPath(ni, nj, c.d, nd, c.lane); c.mode = "turn"; c.ni = ni; c.nj = nj;
          }
        }
        c.speed += clamp(target - c.speed, -9 * dt, 3.5 * dt);
        if (c.mode === "lane") { c.s = Math.min(stop, c.s + c.speed * dt); const sp = laneSpot(c.i, c.j, c.d, c.lane, c.s); b.x = sp.x; b.z = sp.z; b.h = sp.h; }
      }
      if (c.mode === "turn") {
        const tr = c.turn, turning = tr.nd !== c.d;
        c.speed += clamp(Math.min(target, turning ? 7.5 : c.cruise) - c.speed, -9 * dt, 3 * dt);
        tr.t = Math.min(1, tr.t + (c.speed * dt) / tr.len);
        const [x, z] = bez(tr.p0, tr.p1, tr.p2, tr.t), [ddx, ddz] = bezD(tr.p0, tr.p1, tr.p2, tr.t);
        b.x = x; b.z = z; if (ddx * ddx + ddz * ddz > 1e-6) b.h = headingOf(ddx, ddz);
        if (tr.t >= 1) { this.release(c); c.i = c.ni; c.j = c.nj; c.d = tr.nd; c.s = HALF; c.mode = "lane"; c.turn = null; }
      }
      b.vx = Math.sin(b.h) * c.speed; b.vz = Math.cos(b.h) * c.speed; b.w = 0; b.wheelSpin += c.speed * dt / 0.34;
    }
  }
  release(c) { if (c.reserved != null && this.busy.get(c.reserved) === c.id) this.busy.delete(c.reserved); c.reserved = null; }
  // a car that's been hit leaves its lane and slides like any other body
  knock(c) { if (c.mode === "dyn") return; this.release(c); c.mode = "dyn"; c.dynT = 0; }
  draw() {
    const counts = [0, 0, 0, 0];
    for (const c of this.cars) {
      const k = T_KINDS.indexOf(c.kind), set = this.sets[k], idx = counts[k]++, b = c.body;
      m4.compose(v3.set(b.x, 0, b.z), q4.setFromAxisAngle(up, b.h), s3.set(1, 1, 1));
      set.body.setMatrixAt(idx, m4); set.lights.setMatrixAt(idx, m4); set.body.setColorAt(idx, c.paint);
    }
    this.sets.forEach((set, k) => { set.body.count = set.lights.count = counts[k]; set.body.instanceMatrix.needsUpdate = set.lights.instanceMatrix.needsUpdate = true; if (set.body.instanceColor) set.body.instanceColor.needsUpdate = true; });
  }
}

// ---------- the police ----------
const COP_STATS = (heat, heavy) => ({ top: (heavy ? 50 : 52) + heat * 4.2, accel: (heavy ? 8 : 9.2) + heat * 0.5, grip: 17.5 + heat * 0.4, handling: 1.05, mass: heavy ? 2700 : 1650, nitroDur: 2, nitroRegen: 0.04, brake: 18, armour: 1 });
export class Police {
  constructor(scene, env, cap = 14) {
    this.cap = cap; this.cops = []; this.nextId = 1; this.spikes = [];
    const mk = (kind) => {
      const body = new THREE.InstancedMesh(bodyGeometry(kind, { copLivery: true }), new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x0c1020, metalness: 0.5, roughness: 0.35, envMap: env }), cap);
      const lights = new THREE.InstancedMesh(lightGeometry(kind), new THREE.MeshBasicMaterial({ vertexColors: true }), cap);
      body.count = lights.count = 0; body.frustumCulled = lights.frustumCulled = false; scene.add(body, lights); return { kind, body, lights };
    };
    this.sets = [mk("sedan"), mk("suv")];
    const barGeo = new THREE.BoxGeometry(0.62, 0.16, 0.34);
    this.bars = [-1, 1].map((side) => { const g = barGeo.clone(); g.translate(side * 0.34, 0, 0); const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff }), cap * 2); m.count = 0; m.frustumCulled = false; m.setColorAt(0, col3.set(0)); scene.add(m); return m; });
    // spike strips
    this.spikeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.3, 0.4) }), 8); this.spikeMesh.count = 0; this.spikeMesh.frustumCulled = false; scene.add(this.spikeMesh);
    // the helicopter
    const heli = new THREE.Group();
    const hb = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshStandardMaterial({ color: 0x101425, metalness: 0.5, roughness: 0.4, envMap: env })); hb.scale.set(1, 0.8, 1.7); heli.add(hb);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 4.5), hb.material); tail.position.z = -3.6; heli.add(tail);
    this.rotor = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.05, 24), new THREE.MeshBasicMaterial({ color: 0x8890b0, transparent: true, opacity: 0.18, depthWrite: false })); this.rotor.position.y = 1.4; heli.add(this.rotor);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2) })); blink.position.set(0, -0.9, 1.5); heli.add(blink); this.blink = blink;
    const coneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.55, 0.7), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(14, 1, 24, 1, true), coneMat); scene.add(this.cone);
    heli.visible = false; this.cone.visible = false; scene.add(heli); this.heli = heli;
    this.heliState = { on: false, x: 0, z: 0, sx: 0, sz: 0, y: 60 };
  }
  clear() { this.cops = []; this.spikes = []; this.heliState.on = false; this.heli.visible = this.cone.visible = false; }
  add(x, z, h, mode, heat, heavy = false) {
    if (this.cops.length >= this.cap) return null;
    const body = makeBody(COP_STATS(heat, heavy), x, z, h);
    const c = { id: this.nextId++, heavy, body, mode, hp: heavy ? 220 : 100, maxHp: heavy ? 220 : 100, sees: false, seenT: 0, stuckT: 0, revT: 0, flank: (Math.random() - 0.5) * 2, nav: null, phase: Math.random(), wreckT: 0, lastSteer: 0, smokeT: 0 };
    this.cops.push(c); return c;
  }
  // a patrol car somewhere on the roads near (px, pz), out of sight if possible
  spawnPatrol(px, pz, heat, minD = 180, maxD = 380, toward = false, bias = null) {
    for (let k = 0; k < 16; k++) {
      const a = bias != null && k < 10 ? bias + (Math.random() - 0.5) * 1.3 : Math.random() * Math.PI * 2, r = minD + Math.random() * (maxD - minD), [i, j] = nearestNode(px + Math.cos(a) * r, pz + Math.sin(a) * r);
      let d = Math.floor(Math.random() * 4);
      if (toward) { const [nx, nz] = nodeXZ(i, j); let best = -1e9; for (let dd = 0; dd < 4; dd++) { const [ex, ez] = DIRS[dd]; if (!validNode(i + ex, j + ez)) continue; const sc = ex * (px - nx) + ez * (pz - nz); if (sc > best) { best = sc; d = dd; } } }
      const [dx, dz] = DIRS[d]; if (!validNode(i + dx, j + dz)) continue;
      const sp = laneSpot(i, j, d, toward ? 0 : Math.random() < 0.5 ? 0 : 1, HALF + 10 + Math.random() * 60);
      if (k < 12 && lineOfSight(px, pz, sp.x, sp.z) && Math.hypot(sp.x - px, sp.z - pz) < 200) continue;
      const c = this.add(sp.x, sp.z, sp.h, toward ? "chase" : "patrol", heat);
      if (c) { c.nav = { i, j, d, lane: 0, nd: toward ? chooseToward(i + dx, j + dz, d, px, pz) : nextDir(i + dx, j + dz, d) }; const v0 = toward ? 22 : 12; c.body.vx = Math.sin(sp.h) * v0; c.body.vz = Math.cos(sp.h) * v0; }
      return c;
    }
    return null;
  }
  // drive one cop. ctx: { px, pz, pvx, pvz, heat, chase }
  drive(c, ctx, dt) {
    const b = c.body, spd = speedOf(b);
    if (c.mode === "wreck" || c.mode === "block") { stepCar(b, { steer: 0, throttle: 0, brake: 0, hand: false, nitro: false, park: true }, dt); return; }
    let tx, tz, vT, hand = false;
    const dpx = ctx.px - b.x, dpz = ctx.pz - b.z, dist = Math.hypot(dpx, dpz);
    const direct = c.mode === "chase" && dist < 110 && c.sees;
    if (c.wasDirect && !direct) c.nav = null;                     // lost sight: work out the roads again from here
    c.wasDirect = direct;
    // where this car is heading when it follows the roads
    const goX = c.mode === "search" ? c.sx : ctx.px, goZ = c.mode === "search" ? c.sz : ctx.pz;
    if (c.mode === "search" && Math.hypot(c.sx - b.x, c.sz - b.z) < 35) { const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 110; c.sx = clamp(ctx.lx + Math.cos(a) * r, 0, N * P); c.sz = clamp(ctx.lz + Math.sin(a) * r, 0, N * P); }
    if (direct) {
      // close in on where the player will be, some cops aim a little to one side to box them in
      const lead = clamp(dist / 55, 0, 1.1);
      tx = ctx.px + ctx.pvx * lead; tz = ctx.pz + ctx.pvz * lead;
      if (dist < 40) { const ps = Math.hypot(ctx.pvx, ctx.pvz) || 1; tx += (-ctx.pvz / ps) * c.flank * 3.2; tz += (ctx.pvx / ps) * c.flank * 3.2; }
      vT = b.stats.top;
      if (dist < 18 && Math.hypot(ctx.pvx, ctx.pvz) < 6) vT = 6;                 // they've got you boxed: ease up and sit on you
    } else {
      // follow the roads: at each crossing take the turn that heads toward the player (patrols wander)
      if (!c.nav) c.nav = initNav(b, c.mode === "chase" || c.mode === "search" ? [goX, goZ] : null);
      const nv = c.nav, [ax, az] = nodeXZ(nv.i, nv.j), [dx, dz] = DIRS[nv.d], s = (b.x - ax) * dx + (b.z - az) * dz;
      const bi = nv.i + dx, bj = nv.j + dz;
      if (s > P - HALF - 2) {
        // through the crossing toward the next road
        const sp = laneSpot(bi, bj, nv.nd, nv.lane, HALF + 10); tx = sp.x; tz = sp.z;
        const [ex, ez] = DIRS[nv.nd], [bx, bz] = nodeXZ(bi, bj), past = (b.x - bx) * ex + (b.z - bz) * ez;
        if (past > (nv.nd === nv.d ? HALF : 2)) {
          nv.i = bi; nv.j = bj; nv.d = nv.nd;
          const ni = bi + DIRS[nv.d][0], nj = bj + DIRS[nv.d][1];
          nv.nd = c.mode === "chase" || c.mode === "search" ? chooseToward(ni, nj, nv.d, goX, goZ) : nextDir(ni, nj, nv.d);
        }
      } else {
        const look = Math.min(P - HALF, s + 12 + spd * 0.35), sp = laneSpot(nv.i, nv.j, nv.d, c.mode === "chase" ? 0 : nv.lane, look); tx = sp.x; tz = sp.z;
      }
      vT = c.mode === "chase" ? b.stats.top : c.mode === "search" ? 24 : 13;
      if (nv.nd !== nv.d && s > P - HALF - 50) vT = Math.min(vT, c.mode === "chase" ? 19 : c.mode === "search" ? 14 : 7);
    }
    b.topMul = c.mode === "chase" && dist > 120 ? 1.12 : 1;              // units far behind push harder to catch up
    let ang = aimAt(b, tx, tz);
    // stuck against something: back out
    if (c.revT > 0) { c.revT -= dt; stepCar(b, { steer: -c.lastSteer, throttle: 0, brake: 1, hand: false }, dt); return; }
    const wantGo = !(direct && dist < 18);
    if (spd < 3 && wantGo && (c.mode === "chase" || c.mode === "patrol" || c.mode === "search")) { c.stuckT += dt; if (c.stuckT > 1.6) { c.stuckT = 0; c.revT = 1.1; c.lastSteer = Math.sign(ang) || 1; } } else c.stuckT = 0;
    const steer = clamp(ang * 2.4, -1, 1); c.lastSteer = steer;
    if (Math.abs(ang) > 1.0 && spd > 16) hand = true;
    const over = spd - vT;
    stepCar(b, { steer, throttle: over < 0 ? 1 : 0, brake: over > 3 ? clamp(over / 10, 0.2, 1) : 0, hand, nitro: false }, dt);
  }
  updateHeli(on, px, pz, dt, t) {
    const H = this.heliState;
    if (on && !H.on) { H.on = true; H.x = px + 140; H.z = pz + 140; H.sx = px; H.sz = pz; }
    if (!on) { H.on = false; this.heli.visible = this.cone.visible = false; return; }
    // it chases at a fixed top speed; its spotlight lags behind the car
    const dx = px - H.x, dz = pz - H.z, d = Math.hypot(dx, dz), sp = Math.min(d * 1.4, 54);
    if (d > 0.01) { H.x += (dx / d) * sp * dt; H.z += (dz / d) * sp * dt; }
    const sdx = px - H.sx, sdz = pz - H.sz, sd = Math.hypot(sdx, sdz), ss = Math.min(sd * 2.2, 50);
    if (sd > 0.01) { H.sx += (sdx / sd) * ss * dt; H.sz += (sdz / sd) * ss * dt; }
    this.heli.visible = this.cone.visible = true;
    this.heli.position.set(H.x, H.y, H.z); this.heli.rotation.y = Math.atan2(dx, dz); this.heli.rotation.x = clamp(sp / 200, 0, 0.25);
    this.rotor.rotation.y += dt * 40; this.blink.visible = Math.sin(t * 9) > 0.4;
    // cone from the heli down to the spot
    const cx = H.sx, cz = H.sz, hx = H.x, hz = H.z, len = Math.hypot(cx - hx, H.y, cz - hz);
    this.cone.position.set((cx + hx) / 2, H.y / 2, (cz + hz) / 2); this.cone.scale.set(1, len, 1);
    this.cone.lookAt(hx, H.y, hz); this.cone.rotateX(Math.PI / 2);
  }
  heliSees(px, pz) { const H = this.heliState; if (!H.on) return false; if (hideSpots.some((s) => Math.abs(px - s.x) < s.w / 2 && Math.abs(pz - s.z) < s.d / 2)) return false; return Math.hypot(px - H.sx, pz - H.sz) < 15; }
  draw(t) {
    const counts = [0, 0]; let nb = 0;
    for (const c of this.cops) {
      const k = c.heavy ? 1 : 0, set = this.sets[k], idx = counts[k]++, b = c.body;
      q4.setFromAxisAngle(up, b.h);
      m4.compose(v3.set(b.x, 0, b.z), q4, s3.set(1, 1, 1)); set.body.setMatrixAt(idx, m4); set.lights.setMatrixAt(idx, m4);
      // the light bar flashes red / blue while chasing; wrecks go dark
      const on = c.mode === "chase" || c.mode === "block", ph = (t * 3.2 + c.phase) % 1, y = c.heavy ? 1.92 : 1.56;
      for (let side = 0; side < 2; side++) {
        const bar = this.bars[side]; m4.compose(v3.set(b.x, y, b.z), q4, s3.set(1, 1, 1)); bar.setMatrixAt(nb, m4);
        const lit = on && ((side === 0) === (ph < 0.5));
        bar.setColorAt(nb, lit ? (side === 0 ? col3.setRGB(4, 0.15, 0.25) : col3.setRGB(0.2, 0.45, 4.2)) : col3.setRGB(0.08, 0.02, 0.03 + side * 0.06));
      }
      nb++;
    }
    this.sets.forEach((set, k) => { set.body.count = set.lights.count = counts[k]; set.body.instanceMatrix.needsUpdate = set.lights.instanceMatrix.needsUpdate = true; });
    for (const bar of this.bars) { bar.count = nb; bar.instanceMatrix.needsUpdate = true; if (bar.instanceColor) bar.instanceColor.needsUpdate = true; }
    this.spikeMesh.count = this.spikes.length;
    this.spikes.forEach((s, k) => { m4.compose(v3.set(s.x, 0.06, s.z), q4.setFromAxisAngle(up, s.h + Math.PI / 2), s3.set(s.len, 1, 1)); this.spikeMesh.setMatrixAt(k, m4); });
    this.spikeMesh.instanceMatrix.needsUpdate = true;
  }
}
// a nav record for a car wherever it is: which road it's on and the way it's facing along it; with a goal, the next turn heads there
function initNav(b, goal) {
  const r = roadAt(b.x, b.z); let d = dirTo(b.h);
  if (r.onV && !r.onH) d = Math.cos(b.h) >= 0 ? 1 : 3;
  else if (r.onH && !r.onV) d = Math.sin(b.h) >= 0 ? 0 : 2;
  const nv = { d, lane: 0 }; fixNav(nv, b);
  if (goal) nv.nd = chooseToward(nv.i + DIRS[nv.d][0], nv.j + DIRS[nv.d][1], nv.d, goal[0], goal[1]);
  return nv;
}
function dirTo(h) { const dx = Math.sin(h), dz = Math.cos(h); return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 2) : (dz > 0 ? 1 : 3); }
// make a nav record match where the car actually is: the node behind it on the road it's driving along
function fixNav(nv, b) {
  const [dx, dz] = DIRS[nv.d];
  const along = dx !== 0 ? b.x : b.z, k = Math.floor(along / P);
  if (dx !== 0) { nv.i = clamp(dx > 0 ? k : k + 1, 0, N); nv.j = clamp(Math.round(b.z / P), 0, N); }
  else { nv.j = clamp(dz > 0 ? k : k + 1, 0, N); nv.i = clamp(Math.round(b.x / P), 0, N); }
  if (!validNode(nv.i + dx, nv.j + dz)) { nv.d = (nv.d + 2) % 4; }
  nv.nd = nextDir(nv.i + DIRS[nv.d][0], nv.j + DIRS[nv.d][1], nv.d);
}
// at node (i, j) heading d: the way that gets closest to the target (straight wins ties)
function chooseToward(i, j, d, tx, tz) {
  const [ti, tj] = nearestNode(tx, tz);
  return nextDir(i, j, d, (opts) => {
    let best = opts[0], bd = 1e9;
    for (const nd of opts) { const [dx, dz] = DIRS[nd], dd = Math.abs(i + dx - ti) + Math.abs(j + dz - tj) + (nd === d ? -0.3 : 0); if (dd < bd) { bd = dd; best = nd; } }
    if (i === ti && j === tj) return opts.includes(d) ? d : best;
    return best;
  });
}

// ---------- racers ----------
// path: [{x, z, v}] points every ~2 m with the top safe speed at each; the driver follows it with a lookahead
export class Racer {
  constructor(body, path, skill = 1) { this.b = body; this.path = path; this.idx = 0; this.skill = skill; this.band = 1; this.revT = 0; this.stuckT = 0; this.lastSteer = 0; this.prog = 0; this.lap = 0; this.done = false; }
  locate() {
    const p = this.path, b = this.b; let best = this.idx, bd = 1e18;
    for (let k = this.idx; k < Math.min(p.length, this.idx + 40); k++) { const dx = p[k].x - b.x, dz = p[k].z - b.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = k; } }
    this.idx = best; return best;
  }
  drive(dt) {
    const b = this.b, p = this.path, spd = speedOf(b);
    if (this.done) { stepCar(b, { steer: 0, throttle: 0, brake: 0, hand: false, nitro: false, park: true }, dt); return; }
    const i = this.locate();
    let k = i, acc = 0; const look = 7 + spd * 0.42;
    while (k < p.length - 1 && acc < look) { acc += Math.hypot(p[k + 1].x - p[k].x, p[k + 1].z - p[k].z); k++; }
    const ang = aimAt(b, p[k].x, p[k].z);
    // the slowest point coming up within braking distance
    let vT = 999; const brakeA = 15 * this.skill;
    acc = 0; for (let j = i; j < Math.min(p.length, i + 90); j++) { if (j > i) acc += 2; const v = Math.sqrt(p[j].v * p[j].v * this.skill * this.band + 2 * brakeA * acc); if (v < vT) vT = v; }
    vT = Math.min(vT, b.stats.top * this.band);
    if (this.revT > 0) { this.revT -= dt; stepCar(b, { steer: -this.lastSteer, throttle: 0, brake: 1, hand: false }, dt); return; }
    if (spd < 2) { this.stuckT += dt; if (this.stuckT > 1.4) { this.stuckT = 0; this.revT = 1; } } else this.stuckT = 0;
    const steer = clamp(ang * 2.6, -1, 1); this.lastSteer = steer;
    const over = spd - vT, straight = Math.abs(ang) < 0.05 && vT > b.stats.top * 0.9;
    stepCar(b, { steer, throttle: over < -0.5 ? 1 : 0.2, brake: over > 1.5 ? clamp(over / 8, 0.2, 1) : 0, hand: Math.abs(ang) > 0.9 && spd > 18, nitro: straight && b.nitro > 0.3 }, dt);
  }
}
