// Menus, HUD, minimap, map, garage, the Redline Ten, settings.
import { N, P, HALF, SIZE, blocks, crashSpots, hideSpots, clamp } from "./world.js";
import { CARS, carById, tune, UPG, UPG_PRICE } from "./cars.js";
import { TYPES, RIVALS, RIVAL_PRIZE, rivalEvent } from "./events.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.5a3 3 0 1 1-2-2.83V5.5l12-2.5v12.5a3 3 0 1 1-2-2.83V7.1L9 8.8z" fill="currentColor"/></svg>';
const PAINTS = ["#1fd8ff", "#ff2e4d", "#b6ff00", "#c94dff", "#ffd23f", "#00ffd5", "#ff6ad5", "#f4f1ff", "#14141c", "#ff8a3d", "#3b2bff", "#7a1020"];
const GLOWS = ["#00e5ff", "#ff2bd6", "#b6ff00", "#ffd23f", "#ff2e4d", "#c94dff", "#00ffd5", "#ffffff"];
const fmtT = (t) => { if (!isFinite(t)) return "DNF"; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? "0" : ""}${s.toFixed(2)}`; };

export function createUI(G, A) {
  const panel = $("panel"), panelBody = $("panelBody"), sTitle = $("sTitle"), sPause = $("sPause"), hud = $("hud"), touchUI = $("touch");
  let stack = [], toasts = [], bigT = 0, W = 1, H = 1;
  const S = () => G.save, ST = () => G.settings;
  // ---------- screens ----------
  function hideAll() { sTitle.hidden = true; sPause.hidden = true; panel.hidden = true; }
  function open(name, opts = {}) {
    if (name === "title") { stack = []; hideAll(); G.paused = false; A.toTitle(); sTitle.hidden = false; refreshTitle(); syncChrome(); return; }
    if (!opts.replace && current) stack.push(current);
    current = name; hideAll(); panel.hidden = false; panel.dataset.screen = name;
    if (G.mode === "roam" || G.mode === "race") G.paused = true;
    if (window.ArcadeSound && G.mode !== "title") window.ArcadeSound.pause(true);
    render[name](opts); panelBody.scrollTop = 0; syncChrome();
    const f = panelBody.querySelector("[data-focus]") || panelBody.querySelector("button"); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  let current = null;
  function back() {
    const prev = stack.pop(); current = null;
    if (prev === "pause") { showPause(); return; }
    if (prev) { open(prev, { replace: true }); return; }
    panel.hidden = true;
    if (G.mode === "title") { sTitle.hidden = false; refreshTitle(); }
    else resume();
    syncChrome();
  }
  function closeAll() { stack = []; current = null; panel.hidden = true; sPause.hidden = true; syncChrome(); }
  function showPause() { current = "pause"; hideAll(); sPause.hidden = false; G.paused = true; if (window.ArcadeSound) window.ArcadeSound.pause(true); refreshPause(); syncChrome(); }
  function resume() { closeAll(); G.paused = false; if (window.ArcadeSound) window.ArcadeSound.pause(false); syncChrome(); }
  function togglePause() {
    if (G.mode !== "roam" && G.mode !== "race") return;
    if (!panel.hidden || !sPause.hidden) { if (!sPause.hidden) resume(); return; }
    showPause();
  }
  function refreshPause() {
    const inRace = G.mode === "race";
    $("pGarage").hidden = inRace || !!G.pursuit; $("pRivals").hidden = inRace; $("pRestart").hidden = !inRace; $("pQuitRace").hidden = !inRace;
    $("pReset").hidden = inRace;
  }
  function refreshTitle() {
    const s = S(); $("tCareer").textContent = s.stats.races || s.bounty || s.cash !== 2500 ? "Continue career" : "Start career";
    const rv = RIVALS[Math.min(s.rival, 9)];
    $("tSub").textContent = s.done ? "#1 on the Redline Ten" : `Next on the Redline Ten: #${rv.rank} ${rv.name}`;
  }
  function syncChrome() {
    const playing = (G.mode === "roam" || G.mode === "race") && !G.paused && panel.hidden && sPause.hidden;
    hud.hidden = !(G.mode === "roam" || G.mode === "race" || G.mode === "card");
    touchUI.hidden = !(A.TOUCH && playing);
    if (!touchUI.hidden) { const st = ST().steer; $("tLeft").hidden = $("tRight").hidden = st !== "buttons"; $("tGas").hidden = ST().auto; $("wheel").hidden = st !== "drag"; }
    $("hbtns").hidden = !(G.mode === "roam" || G.mode === "race");
    $("rotate").hidden = !(A.TOUCH && H > W && (G.mode === "roam" || G.mode === "race") && !G.rotateDismissed);
  }
  // ---------- toasts / big text / prompts ----------
  function toast(msg, kind = "info") {
    const el = document.createElement("div"); el.className = `toast ${kind}`; el.textContent = msg; $("toasts").appendChild(el);
    toasts.push({ el, t: 0 }); if (toasts.length > 4) { const o = toasts.shift(); o.el.remove(); }
  }
  function big(text, kind) { const el = $("bigText"); el.textContent = text; el.className = kind || ""; el.hidden = false; el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; bigT = kind === "count" ? 0.9 : 1.3; }
  function prompt(ev) {
    const el = $("prompt");
    if (!ev) { el.hidden = true; return; }
    const T = TYPES[ev.type], done = S().won.includes(ev.id);
    el.innerHTML = `<span class="tag" style="--c:${T.color}">${T.label}</span><b>${esc(ev.name)}</b><span class="pz">${A.fmtMoney(ev.prize)}${done ? " · won" : ""}</span><button class="cta small" id="promptGo">${A.TOUCH ? "Race" : "Race · Enter"}</button>`;
    el.hidden = false; $("promptGo").addEventListener("click", () => A.openEvent(ev));
  }
  // ---------- HUD (10 times a second) ----------
  const heatEls = [...$("heat").children];
  function hudUpdate() {
    const s = S(), p = G.pursuit, R = G.race;
    $("cash").textContent = A.fmtMoney(s.cash);
    $("bounty").textContent = `BOUNTY ${Math.round((s.bounty || 0) + (p ? p.bounty : 0)).toLocaleString()}`;
    $("heat").hidden = !p; if (p) heatEls.forEach((e, k) => e.classList.toggle("on", k < p.heat));
    const pe = $("pursuit"); pe.hidden = !p;
    if (p) {
      if (p.phase === "chase") { $("plabel").textContent = `PURSUIT · ${p.copsNow || 0} COP${(p.copsNow || 0) === 1 ? "" : "S"}`; $("pBust").style.width = `${p.bust * 50}%`; $("pEvade").style.width = `${p.evade * 50}%`; $("psub").textContent = p.bust > 0.05 ? "BUSTED!" : p.evade > 0.05 ? "EVADING…" : `BOUNTY ${Math.round(p.bounty).toLocaleString()}`; pe.className = p.bust > 0.05 ? "bust" : ""; }
      else { $("plabel").textContent = "COOLDOWN"; $("pBust").style.width = "0%"; $("pEvade").style.width = `${p.cool * 100}%`; $("psub").textContent = "Stay out of sight · hide spots cool you off faster"; pe.className = "cool"; }
    }
    const ri = $("raceInfo"); ri.hidden = !R || R.t < 0 && R.count > 3;
    if (R) {
      const ev = R.ev, parts = [];
      if (["sprint", "circuit", "rival"].includes(ev.type)) {
        const prog = (idx, lap) => lap * ev.path[ev.path.length - 1].s + ev.path[idx].s, me = R.done ? Infinity : prog(R.idx, R.lap);
        let pos = 1; for (const rc of R.racers) if (rc.done || prog(rc.idx, rc.lap) > me) pos++;
        parts.push(`<b>${R.done ? "" : pos}</b><small>/${R.racers.length + 1}</small>`);
      }
      if (ev.closed && ev.type !== "drift") parts.push(`LAP <b>${Math.min(ev.laps, R.lap + 1)}</b>/${ev.laps}`);
      if (ev.type === "speedtrap") parts.push(`<b>${R.trapTotal}</b> / ${ev.target} km/h`);
      if (ev.type === "drift") parts.push(`<b>${Math.round(R.drift).toLocaleString()}</b> / ${ev.target.toLocaleString()}`);
      if (ev.type === "tollbooth" || ev.type === "drift") parts.push(`<span class="${R.timeLeft < 10 ? "hot" : ""}">${Math.max(0, R.timeLeft).toFixed(1)}s</span>`);
      else parts.push(fmtT(Math.max(0, R.t)));
      ri.innerHTML = parts.map((x) => `<span>${x}</span>`).join("");
      $("wrongWay").hidden = !(R.wrongT > 1.2 && !R.done);
    } else $("wrongWay").hidden = true;
    const D = G.drift, db = $("driftBox");
    db.hidden = !(D.pts > 0 || D.show > 0.2);
    if (!db.hidden) { $("driftPts").textContent = Math.round(D.pts).toLocaleString(); $("driftMul").textContent = `×${Math.max(1, D.chain)} DRIFT`; }
    syncChrome();
  }
  function driftBanked(n) { if (n > 300) toast(`DRIFT +${n.toLocaleString()}`, "drift"); }
  function driftLost() { toast("Drift lost", "info"); }
  // ---------- per frame ----------
  function frame(dt) {
    for (const t of toasts) { t.t += dt; if (t.t > 2.6) t.el.classList.add("out"); }
    toasts = toasts.filter((t) => { if (t.t > 3) { t.el.remove(); return false; } return true; });
    if (bigT > 0) { bigT -= dt; if (bigT <= 0) $("bigText").hidden = true; }
  }
  // speedometer, minimap, speed lines
  const speedo = $("speedo"), sctx = speedo.getContext("2d"), mini = $("mini"), mctx = mini.getContext("2d"), over = $("over"), octx = over.getContext("2d");
  let miniT = 0;
  function draw(me) {
    if (hud.hidden) { octx.clearRect(0, 0, over.width, over.height); return; }
    const dpr = Math.min(devicePixelRatio || 1, 2), spd = A.speed();
    // speedometer
    const sw = 190, sh = 118; if (speedo.width !== sw * dpr) { speedo.width = sw * dpr; speedo.height = sh * dpr; }
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, sw, sh);
    const cx = sw / 2, cy = 82, r = 64, a0 = Math.PI * 0.82, a1 = Math.PI * 2.18, rpm = me.rpm || 0;
    sctx.lineCap = "round"; sctx.lineWidth = 7; sctx.strokeStyle = "rgba(255,255,255,.12)"; sctx.beginPath(); sctx.arc(cx, cy, r, a0, a1); sctx.stroke();
    sctx.strokeStyle = "rgba(255,46,77,.45)"; sctx.beginPath(); sctx.arc(cx, cy, r, a0 + (a1 - a0) * 0.86, a1); sctx.stroke();
    const g = sctx.createLinearGradient(cx - r, 0, cx + r, 0); g.addColorStop(0, "#00e5ff"); g.addColorStop(0.7, "#c94dff"); g.addColorStop(1, "#ff2e4d");
    sctx.strokeStyle = g; sctx.shadowColor = "#00e5ff"; sctx.shadowBlur = 10; sctx.beginPath(); sctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * rpm); sctx.stroke(); sctx.shadowBlur = 0;
    sctx.textAlign = "center"; sctx.fillStyle = "#fff"; sctx.font = "400 40px Audiowide, system-ui"; sctx.fillText(String(Math.round(A.spdUnit(spd))), cx, cy + 8);
    sctx.font = "700 11px Jost, system-ui"; sctx.fillStyle = "rgba(243,240,255,.8)"; sctx.fillText(ST().units === "mph" ? "MPH" : "KM/H", cx, cy + 24);
    sctx.font = "400 18px Audiowide, system-ui"; sctx.fillStyle = me.nitroOn ? "#00e5ff" : "#ff3de0"; sctx.fillText(me.gear < 0 ? "R" : String(me.gear || 1), cx, cy - 30);
    // nitro bar
    const nb = me.nitro || 0, bw = 120, bx = cx - bw / 2, by = sh - 9;
    sctx.fillStyle = "rgba(255,255,255,.12)"; sctx.fillRect(bx, by, bw, 5);
    const ng = sctx.createLinearGradient(bx, 0, bx + bw, 0); ng.addColorStop(0, "#3b2bff"); ng.addColorStop(1, "#00e5ff"); sctx.fillStyle = ng; sctx.fillRect(bx, by, bw * nb, 5);
    sctx.font = "700 9px Jost, system-ui"; sctx.fillStyle = "rgba(191,246,255,.9)"; sctx.fillText("NITRO", cx, by - 3);
    // minimap (30 fps)
    miniT -= 1; if (miniT <= 0) { miniT = 2; drawMini(me, dpr); }
    // speed lines
    const ow = W, oh = H; if (over.width !== Math.round(ow * dpr)) { over.width = Math.round(ow * dpr); over.height = Math.round(oh * dpr); }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, ow, oh);
    const k = clamp((spd - 42) / 30, 0, 1) + (me.nitroOn ? 0.6 : 0);
    if (k > 0.01 && G.mode !== "title") {
      octx.strokeStyle = me.nitroOn ? "rgba(140,230,255,.5)" : "rgba(255,255,255,.35)"; octx.lineWidth = 1.2;
      const n = Math.round(10 + k * 26), mx = ow / 2, my = oh * 0.48;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r0 = Math.max(ow, oh) * (0.32 + Math.random() * 0.25), len = 40 + Math.random() * 120 * k;
        octx.globalAlpha = Math.min(1, k) * (0.4 + Math.random() * 0.6); octx.beginPath(); octx.moveTo(mx + Math.cos(a) * r0, my + Math.sin(a) * r0 * 0.7); octx.lineTo(mx + Math.cos(a) * (r0 + len), my + Math.sin(a) * (r0 + len) * 0.7); octx.stroke();
      }
      octx.globalAlpha = 1;
    }
  }
  function drawMini(me, dpr) {
    const sz = mini.clientWidth || 140; if (mini.width !== Math.round(sz * dpr)) { mini.width = mini.height = Math.round(sz * dpr); }
    const c = mctx, R = sz / 2, sc = R / 230;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, sz, sz);
    c.save(); c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.clip();
    c.fillStyle = "rgba(6,2,24,.78)"; c.fillRect(0, 0, sz, sz);
    c.translate(R, R); c.rotate(Math.PI + me.h); c.scale(sc, sc); c.translate(-me.x, -me.z);
    // flip x so the map matches what you see (world +x is to the left when facing +z)
    c.save();
    // roads
    c.strokeStyle = "rgba(120,110,200,.55)"; c.lineWidth = 24; c.beginPath();
    for (let k = 0; k <= N; k++) { c.moveTo(k * P, -HALF); c.lineTo(k * P, SIZE + HALF); c.moveTo(-HALF, k * P); c.lineTo(SIZE + HALF, k * P); }
    c.stroke();
    c.fillStyle = "rgba(255,61,224,.25)"; for (const row of blocks) for (const b of row) if (b.plaza) c.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    const p = G.pursuit;
    if (p && p.phase === "cooldown") { c.fillStyle = "rgba(0,229,255,.55)"; for (const s of hideSpots) c.fillRect(s.x - s.w / 2, s.z - s.d / 2, s.w, s.d); }
    if (p) for (const cs of crashSpots) if (cs.armed) { c.fillStyle = "#ff8a3d"; c.beginPath(); c.arc(cs.rx, cs.rz, 9, 0, Math.PI * 2); c.fill(); }
    // route
    const path = G.race ? G.race.ev.path : G.gps;
    if (path) { c.strokeStyle = G.race ? "rgba(0,229,255,.9)" : "rgba(182,255,0,.9)"; c.lineWidth = 7; c.beginPath(); const from = G.race ? G.race.idx : G.gpsIdx || 0; for (let k = from; k < path.length; k += 3) { const q = path[k]; if (k === from) c.moveTo(q.x, q.z); else c.lineTo(q.x, q.z); } c.stroke(); }
    // events
    if (G.mode === "roam" && !p) for (const ev of G.events) { c.fillStyle = TYPES[ev.type].color; c.beginPath(); c.arc(ev.bx, ev.bz, 11, 0, Math.PI * 2); c.fill(); }
    if (G.race) { const k = G.race.cps[Math.min(G.race.cp, G.race.cps.length - 1)], q = G.race.ev.path[k]; c.strokeStyle = "#ffd23f"; c.lineWidth = 6; c.beginPath(); c.arc(q.x, q.z, 16, 0, Math.PI * 2); c.stroke(); for (const rc of G.race.racers) { c.fillStyle = "#ffffff"; c.beginPath(); c.arc(rc.b.x, rc.b.z, 8, 0, Math.PI * 2); c.fill(); } }
    for (const cp of A.police.cops) { if (cp.mode === "wreck") continue; c.fillStyle = cp.mode === "patrol" && !p ? "rgba(140,160,255,.9)" : ((G.t * 3 + cp.phase) % 1 < 0.5 ? "#ff2e4d" : "#2b8cff"); c.beginPath(); c.arc(cp.body.x, cp.body.z, 9, 0, Math.PI * 2); c.fill(); }
    const Hs = A.police.heliState; if (Hs.on) { c.strokeStyle = "rgba(220,230,255,.8)"; c.lineWidth = 4; c.beginPath(); c.arc(Hs.sx, Hs.sz, 15, 0, Math.PI * 2); c.stroke(); }
    c.restore(); c.restore();
    // edge arrows for events out of range, and the player arrow
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(R, R - 8); c.lineTo(R + 6, R + 6); c.lineTo(R, R + 3); c.lineTo(R - 6, R + 6); c.closePath(); c.fill();
    c.strokeStyle = "rgba(0,229,255,.6)"; c.lineWidth = 1.5; c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.stroke();
  }
  // ---------- screens ----------
  const render = {};
  function head(title, sub = "") { return `<div class="ph"><button class="iconbtn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" fill="currentColor"/></svg></button><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div></div>`; }
  function bindBack() { for (const b of panelBody.querySelectorAll("[data-back]")) b.addEventListener("click", back); }
  function statBars(t) {
    const rows = [["Top speed", t.top, 60, 100], ["Acceleration", t.accel, 8, 16], ["Handling", t.grip * t.handling, 15, 26], ["Nitro", t.nitroDur, 3, 6]];
    return `<div class="stats">${rows.map(([n, v, lo, hi]) => `<span>${n}</span><i><b style="width:${clamp((v - lo) / (hi - lo), 0.05, 1) * 100}%"></b></i>`).join("")}</div>`;
  }
  render.garage = () => {
    const s = S(), id = s.car, def = carById(id), up = s.up[id] || {}, t = tune(def, up), pc = s.paint[id] || {};
    const list = CARS.map((c) => {
      const own = s.owned.includes(c.id), rv = RIVALS.find((r) => RIVAL_PRIZE[r.rank] === c.id);
      return `<button class="carcard ${c.id === id ? "sel" : ""} ${own ? "" : "locked"}" data-car="${c.id}" ${own ? "" : "disabled"} style="--c:${c.glow}"><b>${c.name}</b><small>${own ? `${Math.round(c.top * 3.6)} km/h` : `Beat #${rv ? rv.rank : "?"} ${rv ? esc(rv.name) : ""}`}</small></button>`;
    }).join("");
    const ups = Object.keys(UPG).map((k) => {
      const lv = up[k] || 0, next = lv < 3 ? UPG_PRICE[lv + 1] : 0;
      return `<div class="upg"><span>${k[0].toUpperCase() + k.slice(1)}</span><span class="pips">${[1, 2, 3].map((n) => `<i class="${n <= lv ? "on" : ""}"></i>`).join("")}</span>${lv < 3 ? `<button class="cta small ${s.cash < next ? "ghost" : ""}" data-up="${k}">${A.fmtMoney(next)}</button>` : `<em>MAX</em>`}</div>`;
    }).join("");
    panelBody.innerHTML = `${head("Garage", `${A.fmtMoney(s.cash)} to spend`)}
      <div class="cars">${list}</div>
      <div class="garage"><div><h3>${def.name}</h3><p class="blurb">${def.blurb}</p>${statBars(t)}</div>
      <div><h3>Upgrades</h3>${ups}<h3>Paint</h3><div class="sw">${PAINTS.map((c) => `<button class="swatch ${(pc.paint || def.paint) === c ? "sel" : ""}" data-paint="${c}" style="background:${c}" aria-label="Paint ${c}"></button>`).join("")}</div>
      <h3>Underglow &amp; rims</h3><div class="sw">${GLOWS.map((c) => `<button class="swatch glow ${(pc.glow || def.glow) === c ? "sel" : ""}" data-glow="${c}" style="--g:${c}" aria-label="Glow ${c}"></button>`).join("")}</div></div></div>`;
    bindBack();
    panelBody.querySelectorAll("[data-car]").forEach((b) => b.addEventListener("click", () => { A.changeCar(b.dataset.car); A.sound.click(); render.garage(); }));
    panelBody.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.up, u = (s.up[id] = s.up[id] || {}), lv = u[k] || 0, price = UPG_PRICE[lv + 1];
      if (s.cash < price) { toast(`You need ${A.fmtMoney(price - s.cash)} more`, "info"); return; }
      s.cash -= price; u[k] = lv + 1; A.saveGame(); A.rebuildPlayer(); A.sound.cash(); render.garage();
    }));
    panelBody.querySelectorAll("[data-paint]").forEach((b) => b.addEventListener("click", () => { (s.paint[id] = s.paint[id] || {}).paint = b.dataset.paint; A.saveGame(); A.repaint(); render.garage(); }));
    panelBody.querySelectorAll("[data-glow]").forEach((b) => b.addEventListener("click", () => { (s.paint[id] = s.paint[id] || {}).glow = b.dataset.glow; A.saveGame(); A.repaint(); render.garage(); }));
  };
  render.rivals = () => {
    const s = S();
    const rows = RIVALS.map((rv, k) => {
      const beaten = s.rival > k, cur = s.rival === k, ready = cur && s.wins >= rv.wins && s.bounty >= rv.bounty, prize = RIVAL_PRIZE[rv.rank];
      return `<div class="rival ${beaten ? "beaten" : cur ? "cur" : "locked"}"><span class="rank">#${rv.rank}</span><div><b>${esc(rv.name)}</b> <em>"${esc(rv.tag)}"</em><small>${carById(rv.car).name}${prize ? " · win it" : ""}</small>
        ${cur && !beaten ? `<small class="req"><span class="${s.wins >= rv.wins ? "ok" : ""}">Wins ${Math.min(s.wins, rv.wins)}/${rv.wins}</span> · <span class="${s.bounty >= rv.bounty ? "ok" : ""}">Bounty ${Math.min(s.bounty, rv.bounty).toLocaleString()}/${rv.bounty.toLocaleString()}</span></small><q>${esc(rv.quote)}</q>` : ""}</div>
        ${beaten ? `<span class="badge">BEATEN</span>` : ready ? `<button class="cta small" data-rival="${k}">Challenge</button>` : cur ? `<span class="badge dim">${G.mode === "title" ? "" : "Win races · run from cops"}</span>` : ""}</div>`;
    }).join("");
    panelBody.innerHTML = `${head("The Redline Ten", s.done ? "You're #1. The city is yours." : "Win events and build bounty in police pursuits to earn a shot at each racer.")}<div class="rivals">${rows}</div>`;
    bindBack();
    panelBody.querySelectorAll("[data-rival]").forEach((b) => b.addEventListener("click", () => {
      const rv = RIVALS[+b.dataset.rival];
      if (G.mode === "title") A.startCareer();
      if (G.pursuit) { toast("Lose the cops first", "cop"); return; }
      closeAll(); G.paused = false; A.setupRace(rivalEvent(rv));
    }));
  };
  render.settings = () => {
    const st = ST(), opt = (k, v, label) => `<button class="seg ${st[k] === v ? "on" : ""}" data-set="${k}" data-v="${v}">${label}</button>`;
    panelBody.innerHTML = `${head("Settings")}
      <div class="set"><span>Steering</span><div class="segs">${A.TOUCH ? opt("steer", "drag", "Drag") + opt("steer", "tilt", "Tilt") + opt("steer", "buttons", "Buttons") : opt("steer", "keys", "Keyboard") + opt("steer", "tilt", "Tilt")}</div></div>
      <div class="set" ${st.steer === "tilt" ? "" : "hidden"}><span>Tilt for full lock</span><div class="segs"><input type="range" min="10" max="40" value="${st.sens}" id="sens" aria-label="Tilt sensitivity"><b id="sensV">${st.sens}°</b><button class="seg" id="calib">Center</button></div></div>
      <div class="set" ${st.steer === "tilt" ? "" : "hidden"}><span>Tilt now</span><div class="tiltbar"><i id="tiltDot"></i></div></div>
      ${A.TOUCH ? `<div class="set"><span>Auto-accelerate</span><div class="segs">${opt("auto", true, "On")}${opt("auto", false, "Off")}</div></div>` : ""}
      <div class="set"><span>Speed in</span><div class="segs">${opt("units", "mph", "MPH")}${opt("units", "kmh", "KM/H")}</div></div>
      <div class="set"><span>Camera</span><div class="segs">${opt("cam", "chase", "Chase")}${opt("cam", "far", "Far")}${opt("cam", "hood", "Hood")}</div></div>
      <div class="set"><span>Graphics</span><div class="segs">${opt("quality", "auto", "Auto")}${opt("quality", "high", "High")}${opt("quality", "medium", "Medium")}${opt("quality", "low", "Low")}</div></div>
      ${A.TOUCH ? `<div class="set"><span>Vibration</span><div class="segs">${opt("vib", true, "On")}${opt("vib", false, "Off")}</div></div>` : ""}
      <div class="set"><span>Career</span><div class="segs"><button class="seg danger" id="resetCareer">Start over</button></div></div>
      <p class="note">Keyboard: arrows or WASD to drive, Space handbrake, Shift nitro, C camera, M map, R back on the road, Esc pause. Gamepads work too.</p>`;
    bindBack();
    panelBody.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", async () => {
      const k = b.dataset.set; let v = b.dataset.v; if (v === "true") v = true; else if (v === "false") v = false;
      if (k === "steer" && v === "tilt") { const ok = await A.enableTilt(); if (!ok) { toast("Tilt isn't available here. Using drag steering.", "info"); v = A.TOUCH ? "drag" : "keys"; } }
      st[k] = v; A.saveSettings(); if (k === "quality") A.applyQuality(); render.settings();
    }));
    const sens = $("sens"); if (sens) sens.addEventListener("input", () => { st.sens = +sens.value; $("sensV").textContent = `${st.sens}°`; A.saveSettings(); });
    const cal = $("calib"); if (cal) cal.addEventListener("click", () => { A.calibrate(); toast("Tilt centred", "info"); });
    $("resetCareer").addEventListener("click", () => { if (!confirm("Start your career over? Your cars, cash and progress will be reset.")) return; Object.assign(G.save, JSON.parse(JSON.stringify({ v: 1, cash: 2500, bounty: 0, wins: 0, won: [], rival: 0, owned: ["kestrel"], car: "kestrel", up: {}, paint: {}, done: false, pos: null, stats: { pursuits: 0, escapes: 0, busts: 0, cops: 0, longest: 0, top: 0, races: 0, bestDrift: 0, roadblocks: 0, spots: 0 } }))); A.saveGame(); A.rebuildPlayer(); toast("Career reset", "info"); render.settings(); });
  };
  render.map = () => {
    panelBody.innerHTML = `${head("City map", "Tap an event to set your GPS")}<canvas id="bigmap"></canvas><div class="legend">${Object.entries(TYPES).filter(([k]) => k !== "rival").map(([k, t]) => `<span><i style="background:${t.color}"></i>${t.label}</span>`).join("")}<span><i style="background:#ff8a3d"></i>Crash spot</span><span><i style="background:#00e5ff;border-radius:2px"></i>Hide spot</span></div>`;
    bindBack();
    const cv = $("bigmap"), dpr = Math.min(devicePixelRatio || 1, 2), box = panelBody.getBoundingClientRect(), side = Math.max(220, Math.min(box.width - 24, (H - 190)));
    cv.style.width = cv.style.height = `${side}px`; cv.width = cv.height = Math.round(side * dpr);
    const c = cv.getContext("2d"), sc = side / (SIZE + 2 * HALF + 40), off = HALF + 20, X = (x) => (x + off) * sc, Z = (z) => (z + off) * sc;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = "#07031a"; c.fillRect(0, 0, side, side);
    c.strokeStyle = "#3a2f7a"; c.lineWidth = Math.max(2, 24 * sc);
    for (let k = 0; k <= N; k++) { c.beginPath(); c.moveTo(X(k * P), Z(-HALF)); c.lineTo(X(k * P), Z(SIZE + HALF)); c.stroke(); c.beginPath(); c.moveTo(X(-HALF), Z(k * P)); c.lineTo(X(SIZE + HALF), Z(k * P)); c.stroke(); }
    for (const row of blocks) for (const b of row) if (b.plaza) { c.fillStyle = "rgba(255,61,224,.3)"; c.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * sc, (b.z1 - b.z0) * sc); }
    for (const s of hideSpots) { c.fillStyle = "#00e5ff"; c.fillRect(X(s.x - s.w / 2), Z(s.z - s.d / 2), s.w * sc, s.d * sc); }
    for (const cs of crashSpots) { c.fillStyle = "#ff8a3d"; c.beginPath(); c.arc(X(cs.rx), Z(cs.rz), 3.5, 0, Math.PI * 2); c.fill(); }
    const s2 = S(), hits = [];
    for (const ev of G.events) { const x = X(ev.bx), z = Z(ev.bz), won = s2.won.includes(ev.id); c.fillStyle = TYPES[ev.type].color; c.beginPath(); c.arc(x, z, 7, 0, Math.PI * 2); c.fill(); if (won) { c.strokeStyle = "#fff"; c.lineWidth = 2; c.stroke(); } hits.push({ x, z, ev }); }
    if (G.gps) { c.strokeStyle = "#b6ff00"; c.lineWidth = 3; c.beginPath(); G.gps.forEach((q, k) => (k ? c.lineTo(X(q.x), Z(q.z)) : c.moveTo(X(q.x), Z(q.z)))); c.stroke(); }
    const me = A.player; if (me && G.mode !== "title") { c.save(); c.translate(X(me.x), Z(me.z)); c.rotate(-me.h); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(0, 9); c.lineTo(6, -6); c.lineTo(0, -3); c.lineTo(-6, -6); c.closePath(); c.fill(); c.restore(); }
    cv.addEventListener("click", (e) => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, z = e.clientY - r.top; let best = null, bd = 400;
      for (const h of hits) { const d = (h.x - x) ** 2 + (h.z - z) ** 2; if (d < bd) { bd = d; best = h; } }
      if (best && G.mode === "roam") { A.setGps({ x: best.ev.bx, z: best.ev.bz, name: best.ev.name }); render.map(); }
      else if (best) toast(`${TYPES[best.ev.type].label}: ${best.ev.name}`, "info");
    });
  };
  render.quick = () => {
    const s = S();
    const byType = Object.keys(TYPES).filter((k) => k !== "rival").map((k) => {
      const evs = G.events.filter((e) => e.type === k);
      return `<h3 style="color:${TYPES[k].color}">${TYPES[k].label}</h3><div class="evlist">${evs.map((e) => `<button class="evbtn" data-ev="${e.id}"><b>${esc(e.name)}</b><small>${(e.length / 1000).toFixed(1)} km${e.closed ? ` · ${e.laps} laps` : ""}</small></button>`).join("")}</div>`;
    }).join("");
    panelBody.innerHTML = `${head("Quick race", "Any event, any time. Prizes only count in your career.")}<div class="set"><span>Car</span><div class="segs">${s.owned.map((id) => `<button class="seg ${s.car === id ? "on" : ""}" data-qcar="${id}">${carById(id).name}</button>`).join("")}</div></div>${byType}`;
    bindBack();
    panelBody.querySelectorAll("[data-qcar]").forEach((b) => b.addEventListener("click", () => { A.changeCar(b.dataset.qcar); render.quick(); }));
    panelBody.querySelectorAll("[data-ev]").forEach((b) => b.addEventListener("click", () => {
      const ev = G.events.find((e) => e.id === b.dataset.ev); G.quickMenu = true; closeAll(); sTitle.hidden = true; G.paused = false;
      A.sound.init(); if (window.ArcadeSound) { window.ArcadeSound.pause(false); window.ArcadeSound.play(); }
      A.setupRace(ev, true);
    }));
  };
  render.how = () => {
    panelBody.innerHTML = `${head("How to play")}<div class="how">
      <p><b>Drive.</b> ${A.TOUCH ? "Drag left or right anywhere on the left of the screen to steer (or switch to Tilt in Settings and lean your phone like a wheel). Gas, brake, nitro and drift are on the right." : "Arrows or WASD to drive, Space for the handbrake, Shift for nitro."} Tap the handbrake going into a corner to throw the car into a slide, then steer through it. Drifting and top speed refill your nitro.</p>
      <p><b>Race.</b> Glowing pillars around the city are events: sprints, circuits, speed traps, drift courses and checkpoint runs. Drive into one to race. Winning pays cash and counts toward the Redline Ten.</p>
      <p><b>Run.</b> Speed past a patrol car, drift in front of one or hit one, and a pursuit starts. The longer it goes, the higher the heat: more cops, roadblocks with spike strips from heat 3, heavy units and a helicopter from heat 4. Ram cops to disable them, drive through orange crash-spot rings to drop a sign tower on the cars behind you.</p>
      <p><b>Escape.</b> Break line of sight until the meter fills, then stay hidden through the cooldown. Hide spots (blue canopies in some plazas) cool you off three times faster. Stop next to a police car and you're busted.</p>
      <p><b>Climb.</b> Each racer on the Redline Ten needs a number of event wins and a pursuit bounty before they'll race you. Beat them to win their cars. Spend cash on upgrades and paint in the Garage.</p></div>`;
    bindBack();
  };
  render.ending = () => {
    const st = S().stats;
    panelBody.innerHTML = `<div class="ending"><h2>#1 on the Redline Ten</h2><p>You beat the whole list and outran the whole city. The Redline Zero is yours.</p>
      <div class="stats2"><span>Pursuits</span><b>${st.pursuits}</b><span>Escapes</span><b>${st.escapes}</b><span>Cops disabled</span><b>${st.cops}</b><span>Top speed</span><b>${st.top} km/h</b><span>Best drift</span><b>${st.bestDrift.toLocaleString()}</b></div>
      <button class="cta" data-focus id="endGo">Keep driving</button></div>`;
    $("endGo").addEventListener("click", () => { closeAll(); G.mode = "roam"; G.paused = false; if (window.ArcadeSound) window.ArcadeSound.pause(false); });
  };
  render.event = ({ ev }) => {
    const T = TYPES[ev.type], won = S().won.includes(ev.id);
    const goal = ev.type === "speedtrap" ? `Hit ${ev.cams.length} speed cameras for a total of ${ev.target} km/h or more.` : ev.type === "drift" ? `Score ${ev.target.toLocaleString()} drift points in ${ev.time} seconds.` : ev.type === "tollbooth" ? `Reach the finish in ${ev.time} seconds.` : ev.type === "rival" ? `Beat ${esc(ev.rival.name)} one on one.` : "Finish first against three rivals.";
    panelBody.innerHTML = `<div class="evcard"><span class="tag" style="--c:${T.color}">${T.label}</span><h2>${esc(ev.name)}</h2><p>${goal}</p>
      <div class="stats2"><span>Length</span><b>${(ev.length / 1000).toFixed(1)} km${ev.closed ? ` · ${ev.laps} laps` : ""}</b><span>Prize</span><b>${A.fmtMoney(ev.prize)}${won ? " (won before)" : ""}</b></div>
      <button class="cta" data-focus id="evGo">Race</button><button class="cta ghost" id="evNo">Not now</button></div>`;
    $("evGo").addEventListener("click", () => { closeAll(); G.paused = false; A.setupRace(ev); });
    $("evNo").addEventListener("click", () => { closeAll(); G.paused = false; A.cancelEvent(); if (window.ArcadeSound) window.ArcadeSound.pause(false); });
  };
  render.results = ({ data }) => {
    const { ev, won, pos, order, why, reward, prize, time } = data, T = TYPES[ev.type];
    const title = won ? (ev.type === "rival" ? `${esc(ev.rival.name)} beaten` : "You win") : ev.type === "speedtrap" || ev.type === "drift" || ev.type === "tollbooth" ? (why === "TIME UP" ? "Time's up" : "Not this time") : `${pos}${["st", "nd", "rd"][pos - 1] || "th"} place`;
    const table = ["sprint", "circuit", "rival"].includes(ev.type) ? `<div class="order">${order.map((o, k) => `<span class="${o.player ? "me" : ""}">${k + 1}. ${esc(o.name)}</span><b>${fmtT(o.t)}</b>`).join("")}</div>` : `<p class="why">${esc(why || fmtT(time))}</p>`;
    panelBody.innerHTML = `<div class="evcard result ${won ? "won" : ""}"><span class="tag" style="--c:${T.color}">${T.label} · ${esc(ev.name)}</span><h2>${title}</h2>${table}
      ${prize ? `<p class="prize">+${A.fmtMoney(prize)}</p>` : ""}${reward ? `<p class="prize">New car: ${carById(reward).name}! Find it in the Garage.</p>` : ""}
      <button class="cta" data-focus id="resGo">Continue</button><button class="cta ghost" id="resAgain">Race again</button></div>`;
    $("resGo").addEventListener("click", () => { closeAll(); G.paused = false; if (window.ArcadeSound) window.ArcadeSound.pause(false); A.leaveRace(false); });
    $("resAgain").addEventListener("click", () => { closeAll(); G.paused = false; if (window.ArcadeSound) window.ArcadeSound.pause(false); const q = G.quick; A.leaveRace(false); A.setupRace(ev, q); });
  };
  render.pursuit = ({ data }) => {
    const p = data.p;
    panelBody.innerHTML = `<div class="evcard result ${data.escaped ? "won" : "lost"}"><span class="tag" style="--c:${data.escaped ? "#00e5ff" : "#ff2e4d"}">Pursuit · heat ${p.heat}</span><h2>${data.escaped ? "Escaped" : "Busted"}</h2>
      <div class="stats2"><span>Time</span><b>${fmtT(p.t)}</b><span>Cops disabled</span><b>${p.cops}</b><span>Roadblocks</span><b>${p.roadblocks}</b><span>Crash spots</span><b>${p.spots}</b>
      ${data.escaped ? `<span>Bounty</span><b>+${data.total.toLocaleString()}</b><span>Cash</span><b>+${A.fmtMoney(data.cash)}</b>` : `<span>Bounty lost</span><b>${Math.round(p.bounty).toLocaleString()}</b><span>Fine</span><b>−${A.fmtMoney(data.fine)}</b>`}</div>
      <button class="cta" data-focus id="pGo">Continue</button></div>`;
    $("pGo").addEventListener("click", () => { closeAll(); G.mode = "roam"; G.paused = false; if (window.ArcadeSound) window.ArcadeSound.pause(false); });
  };
  // ---------- buttons on the static screens ----------
  $("tCareer").addEventListener("click", () => { A.sound.init(); A.startCareer(); sTitle.hidden = true; syncChrome(); if (!S().stats.races && !S().stats.pursuits && !G.seenHow) { G.seenHow = true; toast("Glowing pillars are races · speed past cops for a pursuit", "info"); } });
  $("tQuick").addEventListener("click", () => open("quick"));
  $("tGarage").addEventListener("click", () => open("garage"));
  $("tRivals").addEventListener("click", () => open("rivals"));
  $("tSettings").addEventListener("click", () => open("settings"));
  $("tHow").addEventListener("click", () => open("how"));
  $("pResume").addEventListener("click", resume);
  $("pMap").addEventListener("click", () => open("map"));
  $("pGarage").addEventListener("click", () => open("garage"));
  $("pRivals").addEventListener("click", () => open("rivals"));
  $("pSettings").addEventListener("click", () => open("settings"));
  $("pReset").addEventListener("click", () => { resume(); A.resetToRoad(); });
  $("pRestart").addEventListener("click", () => { const ev = G.race && G.race.ev, q = G.quick; resume(); if (ev) { A.leaveRace(false); A.setupRace(ev, q); } });
  $("pQuitRace").addEventListener("click", () => { resume(); A.leaveRace(false); });
  $("pTitle").addEventListener("click", () => { if (G.pursuit && !confirm("Quit to the title screen? You'll lose this pursuit's bounty.")) return; open("title"); });
  $("pauseBtn").addEventListener("click", togglePause);
  $("mapBtn").addEventListener("click", () => { if (G.mode === "roam" || G.mode === "race") { G.paused = true; open("map"); } });
  $("rotate").addEventListener("click", () => { G.rotateDismissed = true; syncChrome(); });
  addEventListener("arcademusicpanel", (e) => { if (e.detail.open && (G.mode === "roam" || G.mode === "race") && panel.hidden && sPause.hidden) showPause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && (G.mode === "roam" || G.mode === "race") && panel.hidden && sPause.hidden) showPause(); });
  return {
    open: (name) => { if (name === "pause") showPause(); else open(name); }, togglePause, toast, big, prompt, hud: hudUpdate, frame, draw, driftBanked, driftLost,
    resize(w, h) { W = w; H = h; syncChrome(); },
    eventCard(ev) { G.paused = false; open("event", { ev }); G.paused = false; },
    raceStart(R) { closeAll(); syncChrome(); $("prompt").hidden = true; },
    results(data) { G.paused = false; open("results", { data }); },
    pursuitEnd(data) { G.mode = "card"; open("pursuit", { data }); },
    sync: syncChrome
  };
}
