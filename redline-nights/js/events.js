// Races and the career: the events around the city, the Redline Ten, and the racing lines the AI drivers follow.
import { N, P, HALF, DIRS, nodeXZ, validNode, rng, headingOf } from "./world.js";

export const TYPES = {
  sprint: { label: "Sprint", color: "#00e5ff", about: "Point to point against three rivals. First to the finish wins." },
  circuit: { label: "Circuit", color: "#ff3de0", about: "Laps around a loop against three rivals." },
  speedtrap: { label: "Speed Trap", color: "#ffd23f", about: "Fly through the speed cameras. Beat the target total." },
  drift: { label: "Drift", color: "#b6ff00", about: "Slide through the course. Beat the target score before time runs out." },
  tollbooth: { label: "Checkpoint", color: "#ff8a3d", about: "Beat the clock: every checkpoint adds a few seconds." },
  rival: { label: "Rival", color: "#ff2e4d", about: "One on one against a racer from the Redline Ten." }
};
export const RIVALS = [
  { rank: 10, name: "Dex Moreno", tag: "Static", car: "vandal", paint: "#ff2e4d", glow: "#ff6a3d", wins: 1, bounty: 2000, skill: 0.93, kind: "sprint", seed: 11, quote: "You drive like the cops are already behind you. Good." },
  { rank: 9, name: "Juno Park", tag: "Juno", car: "mirage", paint: "#b6ff00", glow: "#00ffd5", wins: 2, bounty: 6000, skill: 0.95, kind: "circuit", seed: 12, quote: "Corners are where the race is. Try to keep up." },
  { rank: 8, name: "Rook", tag: "Rook", car: "nightjar", paint: "#3b2bff", glow: "#00e5ff", wins: 3, bounty: 12000, skill: 0.97, kind: "sprint", seed: 13, quote: "Quiet car. Loud finish." },
  { rank: 7, name: "Vesper Lane", tag: "Vesper", car: "nightjar", paint: "#ff6ad5", glow: "#c94dff", wins: 4, bounty: 20000, skill: 0.99, kind: "circuit", seed: 14, quote: "Every lap I find another tenth. Every lap." },
  { rank: 6, name: "Kaito Mori", tag: "Glitch", car: "halcyon", paint: "#ffd23f", glow: "#ff8a3d", wins: 5, bounty: 30000, skill: 1.0, kind: "sprint", seed: 15, quote: "Bring something heavier than that." },
  { rank: 5, name: "Sable Okafor", tag: "Sable", car: "zephyr", paint: "#0b0b12", glow: "#00ffd5", wins: 6, bounty: 45000, skill: 1.01, kind: "circuit", seed: 16, quote: "Smooth is fast. You're neither." },
  { rank: 4, name: "Nyx", tag: "Nyx", car: "zephyr", paint: "#c94dff", glow: "#ff3de0", wins: 7, bounty: 65000, skill: 1.02, kind: "sprint", seed: 17, quote: "The city's mine after midnight." },
  { rank: 3, name: "Cass Voltaire", tag: "Volt", car: "phantom", paint: "#00e5ff", glow: "#ffffff", wins: 8, bounty: 90000, skill: 1.03, kind: "circuit", seed: 18, quote: "I don't lose. I just haven't finished yet." },
  { rank: 2, name: "Ivory", tag: "Ivory", car: "phantom", paint: "#f4f1ff", glow: "#ffd23f", wins: 9, bounty: 120000, skill: 1.04, kind: "sprint", seed: 19, quote: "Second place on this list is still first place in the city." },
  { rank: 1, name: "Rhyce Calder", tag: "The Redline", car: "zero", paint: "#f4f1ff", glow: "#ff2e4d", wins: 10, bounty: 160000, skill: 1.06, kind: "circuit", seed: 20, quote: "Everybody wants the top spot. Nobody wants the drive." }
];
// cars you win from a rival (the others pay out cash)
export const RIVAL_PRIZE = { 10: "vandal", 9: "mirage", 8: "nightjar", 6: "halcyon", 5: "zephyr", 3: "phantom", 1: "zero" };

// ---------- routes ----------
function walk(r, len, start) {
  // a random drive along the grid: mostly straight, never back over itself
  for (let tries = 0; tries < 200; tries++) {
    let [i, j] = start || [1 + Math.floor(r() * (N - 1)), 1 + Math.floor(r() * (N - 1))];
    let d = Math.floor(r() * 4); const nodes = [[i, j]], seen = new Set([i * 100 + j]);
    let ok = true;
    while (nodes.length < len) {
      const opts = [d, (d + 1) % 4, (d + 3) % 4].filter((nd) => validNode(i + DIRS[nd][0], j + DIRS[nd][1]) && !seen.has((i + DIRS[nd][0]) * 100 + j + DIRS[nd][1]));
      if (!opts.length) { ok = false; break; }
      const nd = opts.includes(d) && r() < 0.6 ? d : opts[Math.floor(r() * opts.length)];
      d = nd; i += DIRS[d][0]; j += DIRS[d][1]; nodes.push([i, j]); seen.add(i * 100 + j);
    }
    if (ok) return nodes;
  }
  return null;
}
function loop(r) {
  const a = 2 + Math.floor(r() * 4), b = 2 + Math.floor(r() * 4), i0 = Math.floor(r() * (N - a)), j0 = Math.floor(r() * (N - b));
  const pts = [[i0, j0], [i0 + a, j0], [i0 + a, j0 + b], [i0, j0 + b]], nodes = [];
  for (let k = 0; k < 4; k++) {
    const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % 4], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s < n; s++) nodes.push([x0 + Math.sign(x1 - x0) * s, y0 + Math.sign(y1 - y0) * s]);
  }
  if (r() < 0.5) nodes.reverse();
  // start the lap on a straight (the node after a corner), so the start line isn't in a corner
  const k0 = nodes.findIndex((n, k) => { const a = nodes[(k + nodes.length - 1) % nodes.length], b = nodes[(k + 1) % nodes.length]; return (a[0] === n[0] && b[0] === n[0]) || (a[1] === n[1] && b[1] === n[1]); });
  return nodes.slice(k0).concat(nodes.slice(0, k0));
}
// a racing line through the nodes: straight down the middle of each road, a wide arc through each corner; points every 2 m with a safe speed
export function buildPath(nodes, closed, aLat = 15.5) {
  const pts = nodes.map(([i, j]) => nodeXZ(i, j));
  let poly = [];
  if (closed) poly = pts.concat([pts[0]]);
  else {
    // start 70 m before the first node, finish 60 m past the last
    const [x0, z0] = pts[0], [x1, z1] = pts[1], dx = Math.sign(x1 - x0), dz = Math.sign(z1 - z0);
    const [xa, za] = pts[pts.length - 2], [xb, zb] = pts[pts.length - 1], ex = Math.sign(xb - xa), ez = Math.sign(zb - za);
    const [li, lj] = nodes[nodes.length - 1], out2 = validNode(li + ex, lj + ez) ? 60 : 0;          // finish past the last crossing unless that's the city edge
    poly = [[x0 - dx * 70, z0 - dz * 70], ...pts]; if (out2) poly.push([xb + ex * out2, zb + ez * out2]);
  }
  const R = 30, out = [];
  const pushLine = (ax, az, bx, bz, v) => {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(d / 2));
    for (let s = out.length ? 1 : 0; s <= n; s++) out.push({ x: ax + ((bx - ax) * s) / n, z: az + ((bz - az) * s) / n, v });
  };
  const corner = (k) => {
    const [px, pz] = poly[k - 1], [cx, cz] = poly[k], [nx, nz] = poly[k + 1];
    const ax = Math.sign(cx - px), az = Math.sign(cz - pz), bx = Math.sign(nx - cx), bz = Math.sign(nz - cz);
    return { straight: ax === bx && az === bz, ax, az, bx, bz, cx, cz };
  };
  let [sx, sz] = poly[0];
  const last = closed ? poly.length - 1 : poly.length - 1;
  for (let k = 1; k < last; k++) {
    const c = corner(k);
    if (c.straight) continue;
    const t1x = c.cx - c.ax * R, t1z = c.cz - c.az * R, t2x = c.cx + c.bx * R, t2z = c.cz + c.bz * R;
    pushLine(sx, sz, t1x, t1z, 99);
    const ox = c.cx - c.ax * R + c.bx * R, oz = c.cz - c.az * R + c.bz * R;     // arc centre
    const a0 = Math.atan2(t1z - oz, t1x - ox), a1 = Math.atan2(t2z - oz, t2x - ox);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const n = Math.max(4, Math.round((Math.abs(da) * R) / 2)), v = Math.sqrt(aLat * R);
    for (let s = 1; s <= n; s++) { const a = a0 + (da * s) / n; out.push({ x: ox + Math.cos(a) * R, z: oz + Math.sin(a) * R, v }); }
    sx = t2x; sz = t2z;
  }
  if (closed) {
    // the start/finish line sits on the first node; close the loop through its corner as well
    const c = { cx: poly[0][0], cz: poly[0][1] };
    const [px, pz] = poly[poly.length - 2], [nx, nz] = poly[1];
    const ax = Math.sign(c.cx - px), az = Math.sign(c.cz - pz), bx = Math.sign(nx - c.cx), bz = Math.sign(nz - c.cz);
    if (ax === bx && az === bz) pushLine(sx, sz, c.cx, c.cz, 99);
    else pushLine(sx, sz, c.cx - ax * R, c.cz - az * R, 99);
  } else pushLine(sx, sz, poly[poly.length - 1][0], poly[poly.length - 1][1], 99);
  // length along the path
  let L = 0; out[0].s = 0;
  for (let k = 1; k < out.length; k++) { L += Math.hypot(out[k].x - out[k - 1].x, out[k].z - out[k - 1].z); out[k].s = L; }
  return out;
}
// where the line of cars starts: a little before the first node, facing along the route
export function startGrid(ev) {
  const [i0, j0] = ev.nodes[0], [i1, j1] = ev.nodes[1], dx = Math.sign(i1 - i0), dz = Math.sign(j1 - j0), [x0, z0] = nodeXZ(i0, j0);
  const h = headingOf(dx, dz), rx = -dz, rz = dx;
  const back = ev.closed ? 28 : 60;
  const spots = [[-3.5, 0], [3.5, 0], [-3.5, -9], [3.5, -9]].map(([lat, lon]) => ({ x: x0 - dx * (back - lon) + rx * lat, z: z0 - dz * (back - lon) + rz * lat, h }));
  return spots;
}

const NAMES = {
  sprint: ["Harbor Run", "Neon Mile", "Midnight Express", "Downtown Dash", "Ultraviolet Run", "Last Train"],
  circuit: ["Central Loop", "Chrome Ring", "Afterhours Circuit", "Glass Tower Loop", "Static Ring"],
  speedtrap: ["Flash Point", "Camera Shy", "Shutter Speed"],
  drift: ["Sideways Square", "Smoke Show"],
  tollbooth: ["Clockwork", "Ten To Midnight"]
};
// all the events, the same every time (seeded)
export function makeEvents() {
  const r = rng(424242), evs = [];
  const add = (type, k, tier) => {
    const closed = type === "circuit" || type === "drift";
    const nodes = closed ? loop(r) : walk(r, type === "speedtrap" ? 9 : 7 + Math.floor(r() * 5));
    if (!nodes) return;
    const ev = { id: `${type}-${k}`, type, name: NAMES[type][k], nodes, closed, laps: type === "circuit" ? 2 + (tier > 2 ? 1 : 0) : type === "drift" ? 2 : 1, tier };
    ev.path = buildPath(nodes, closed);
    ev.length = ev.path[ev.path.length - 1].s * ev.laps;
    ev.prize = Math.round((1200 + tier * 900 + ev.length * 0.35) / 100) * 100;
    if (type === "speedtrap") {
      // cameras halfway along the longest straights
      const cams = []; for (let k2 = 30; k2 < ev.path.length - 30; k2 += 4) { const a = ev.path[k2 - 20], b = ev.path[k2 + 20]; if (Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - 80) < 1 && (!cams.length || k2 - cams[cams.length - 1] > 70)) cams.push(k2); }
      ev.cams = cams.slice(0, 5); ev.target = Math.round(ev.cams.length * (158 + tier * 14) / 5) * 5;       // km/h total
    }
    if (type === "drift") {
      let corners = 0; for (let k = 1; k < ev.path.length; k++) if (ev.path[k].v < 50 && ev.path[k - 1].v >= 50) corners++;
      ev.corners = corners * ev.laps; ev.target = Math.round((ev.corners * (650 + tier * 130)) / 100) * 100; ev.time = Math.round(ev.length / 12);
    }
    if (type === "tollbooth") { ev.time = Math.round(ev.length / 36 + 3); }
    evs.push(ev);
  };
  NAMES.sprint.forEach((_, k) => add("sprint", k, 1 + Math.floor(k / 2)));
  NAMES.circuit.forEach((_, k) => add("circuit", k, 1 + Math.floor(k / 2)));
  NAMES.speedtrap.forEach((_, k) => add("speedtrap", k, 1 + k));
  NAMES.drift.forEach((_, k) => add("drift", k, 1 + k * 2));
  NAMES.tollbooth.forEach((_, k) => add("tollbooth", k, 2 + k * 2));
  return evs;
}
export function rivalEvent(rv) {
  const r = rng(rv.seed * 7919), closed = rv.kind === "circuit";
  const nodes = closed ? loop(r) : walk(r, 10 + Math.floor(rv.rank < 5 ? 3 : 0));
  const ev = { id: `rival-${rv.rank}`, type: "rival", race: rv.kind, name: `#${rv.rank} ${rv.name}`, nodes, closed, laps: closed ? 2 : 1, tier: 6 - Math.ceil(rv.rank / 2), rival: rv };
  ev.path = buildPath(nodes, closed); ev.length = ev.path[ev.path.length - 1].s * ev.laps; ev.prize = 4000 + (11 - rv.rank) * 1500;
  return ev;
}
