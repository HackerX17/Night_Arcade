// Skyline Leap in 3D: the same climb between two real towers. Brick and concrete facades (Poly Haven, CC0) with lit
// windows in each district's colours, neon trim and ledges, the CC0 robot running up the walls and leaping across,
// 3D coins, power-ups, hazards, drones and debris, the district's sky and a far skyline, bloom and a film grade.
// The camera is fitted so the play plane lines up exactly with the 2D layer (sparks, pop-ups and the best line).
// Loaded only when the graphics switch is on 3D.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

const U = 1 / 40;
export async function attach(S) {
  const LW = S.LW, WL = S.WL, WR = S.WR, q = K.tier();
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x05002a, 0.012);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 600);
  const env = K.cityEnv(renderer, { sky: [0.02, 0.01, 0.07], horizon: [0.4, 0.1, 0.5] }); scene.environment = env;
  const hemi = new THREE.HemisphereLight(0x8a7aff, 0x140a28, 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe6f4, 0.9); key.position.set(-6, 10, 12); scene.add(key, key.target);
  const X = (x) => (x - LW / 2) * U, Y = (y) => y * U;

  // the district's sky
  const skyU = { a: { value: new THREE.Color() }, b: { value: new THREE.Color() }, c: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 a, b, c; varying vec3 vP; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){ float y = vP.y; vec3 col = mix(c, b, smoothstep(-0.25, 0.15, y)); col = mix(col, a, smoothstep(0.1, 0.65, y));
        col += vec3(step(0.9975, h(floor(vP * 380.0)))) * smoothstep(0.05, 0.5, y) * 0.9; gl_FragColor = vec4(col, 1.0); }` }));
  scene.add(sky);
  // a far skyline behind the gap
  const far = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x0b0820, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.35, emissiveMap: (() => {
    const c = document.createElement("canvas"); c.width = 32; c.height = 64; const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 32, 64);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) if (Math.random() < 0.3) { g.fillStyle = ["#ffd9a0", "#bfe6ff", "#ffb4e8"][Math.floor(Math.random() * 3)]; g.fillRect(x * 4 + 1, y * 4 + 1, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t; })() }), 70);
  const farB = Array.from({ length: 70 }, (_, i) => ({ x: (i - 35) * 2.6 + (Math.random() - 0.5) * 1.5, z: -30 - Math.random() * 50, w: 4 + Math.random() * 5, h: 30 + Math.random() * 90 }));
  far.frustumCulled = false; scene.add(far);

  // the two towers: brick on the left, concrete on the right, windows and colours by district (world-anchored, so they scroll for free)
  const towerU = { uWall: { value: new THREE.Color() }, uWin0: { value: new THREE.Color() }, uWin1: { value: new THREE.Color() }, uWin2: { value: new THREE.Color() }, uXmas: { value: 0 } };
  const towerMat = (tex) => { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 0.5 });
    m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, towerU, { tA: { value: K.tex(tex, "diff") }, tN: { value: K.tex(tex, "nor") } });
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWS, vNS;").replace("#include <project_vertex>", "#include <project_vertex>\n vWS = (modelMatrix * vec4(transformed, 1.0)).xyz; vNS = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
          varying vec3 vWS, vNS; uniform vec3 uWall, uWin0, uWin1, uWin2; uniform float uXmas; uniform sampler2D tA, tN;
          float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
          vec3 nS = normalize(vNS); float u = abs(nS.x) > 0.5 ? vWS.z : vWS.x, v = vWS.y; vec2 tuv = vec2(u, v) / 2.6;
          vec3 alb = texture2D(tA, tuv).rgb; float cw = 0.95, ch = 0.95; vec2 cell = floor(vec2(u, v) / vec2(cw, ch)), f = fract(vec2(u, v) / vec2(cw, ch));
          float win = step(0.2, f.x) * step(f.x, 0.78) * step(0.2, f.y) * step(f.y, 0.86) * step(0.5, abs(nS.y) < 0.5 ? 1.0 : 0.0);
          float hh = th(cell), lit = step(0.4, hh), pick = fract(hh * 13.7);
          vec3 wc = pick > 0.75 ? (pick > 0.92 ? uWin2 : pick > 0.84 ? uWin1 : uWin0) : (uXmas > 0.5 ? vec3(1.0, 0.84, 0.55) : vec3(1.0, 0.94, 0.78));
          vec3 albF = mix(alb * (uWall * 2.2 + 0.08), vec3(0.015, 0.02, 0.035), win);
          vec3 emF = wc * win * lit * 0.95 + uWall * 0.06;`)
        .replace("#include <map_fragment>", "diffuseColor.rgb = albF;")
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix(0.92, 0.08, win);")
        .replace("#include <metalnessmap_fragment>", "float metalnessFactor = win * (1.0 - lit) * 0.6;")
        .replace("#include <emissivemap_fragment>", "totalEmissiveRadiance = emF;"); };
    return m; };
  const HT = 70, DEPTH = 8;
  const left = new THREE.Mesh(new THREE.BoxGeometry(30, HT, DEPTH), towerMat("brick_4")), right = new THREE.Mesh(new THREE.BoxGeometry(30, HT, DEPTH), towerMat("concrete_panels"));
  left.position.x = X(WL) - 15; right.position.x = X(WR) + 15; left.position.z = right.position.z = 1.2 - DEPTH / 2; scene.add(left, right);
  // neon trim down the inner edges, ledges every 60 units
  const trimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const trims = [X(WL), X(WR)].map((x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, HT, 0.08), trimMat); m.position.set(x, 0, 1.24); scene.add(m); return m; });
  const LEDGES = 40, ledges = new THREE.InstancedMesh(new THREE.BoxGeometry(14 * U, 3 * U, 2.2), new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.5, metalness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.12 }), LEDGES * 2);
  ledges.frustumCulled = false; scene.add(ledges);
  // the robot (CC0 RobotExpressive), running up the walls and leaping across
  const gl = await K.model("robot.gltf"); const bot = gl; let mixer = null; const acts = {};
  { bot.updateMatrixWorld(true); let lo = Infinity, hi = -Infinity; bot.traverse((m) => { if (!m.isMesh) return; m.frustumCulled = false; if (m.isSkinnedMesh) { m.computeBoundingBox(); lo = Math.min(lo, m.boundingBox.min.y); hi = Math.max(hi, m.boundingBox.max.y); } });
    const bb = new THREE.Box3().setFromObject(bot); if (!isFinite(lo)) { lo = bb.min.y; hi = bb.max.y; } bot.scale.setScalar((58 * U) / Math.max(0.01, (bb.max.y - bb.min.y))); }
  bot.traverse((m) => { if (!m.isMesh) return; m.material = m.material.clone(); const n = m.material.name;
    if (n === "Main") { m.material.color.set("#6a3dff"); m.material.metalness = 0.55; m.material.roughness = 0.3; m.material.emissive = new THREE.Color("#2a0a7a"); m.material.emissiveIntensity = 0.5; }
    else if (n === "Grey") { m.material.color.set("#262a44"); m.material.metalness = 0.7; m.material.roughness = 0.35; }
    else if (n === "Black") { m.material.color.set("#05040c"); m.material.emissive = new THREE.Color("#00e5ff"); m.material.emissiveIntensity = 1.4; } });
  const rig = new THREE.Group(), pose = new THREE.Group(); rig.add(pose); pose.add(bot); scene.add(rig);
  mixer = new THREE.AnimationMixer(bot); for (const clip of gl.userData.animations || []) acts[clip.name] = mixer.clipAction(clip);
  for (const k of ["Jump", "Death"]) if (acts[k]) { acts[k].setLoop(THREE.LoopOnce, 1); acts[k].clampWhenFinished = true; }
  let cur = null; const play = (n, fade = 0.15) => { const a = acts[n]; if (!a || cur === a) return; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play(); if (cur) cur.crossFadeTo(a, fade, false); cur = a; };
  play("Running", 0);
  const botLight = new THREE.PointLight(0xff2bd6, 3, 3, 2); scene.add(botLight);
  const rocketFlame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.6, 0.2).multiplyScalar(2.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(rocketFlame);
  const shieldMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: new THREE.Color(0.62, 0.94, 0.65) } },
    vertexShader: "varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 uC; varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uC * (0.06 + f * 1.4), 1.0); }" });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(40 * U, 28, 18), shieldMat); scene.add(shield);
  // coins (gold discs, or baubles at Christmas), power-ups, hazards, drones, debris
  const MAXC = 120, coinMat = new THREE.MeshPhysicalMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.2, emissive: 0xffa000, emissiveIntensity: 0.55, clearcoat: 1 });
  const coinsM = new THREE.InstancedMesh(new THREE.CylinderGeometry(9 * U, 9 * U, 2.4 * U, 24), coinMat, MAXC); coinsM.frustumCulled = false; scene.add(coinsM);
  const bauM = new THREE.InstancedMesh(new THREE.SphereGeometry(9 * U, 20, 14), new THREE.MeshPhysicalMaterial({ roughness: 0.15, metalness: 0.6, clearcoat: 1 }), MAXC); bauM.frustumCulled = false; scene.add(bauM);
  const pickPool = [], glyphTex = {}, glyph = (k, col) => glyphTex[k] || (glyphTex[k] = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.font = "700 40px Jost, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#2a1a0c"; g.fillText(S.PGLYPH[k] || "?", 32, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })());
  const hazPool = { planter: [], ac: [], sign: [] }, hazUsed = {};
  const mkHaz = (kind) => { const d = S.HAZ[kind], g = new THREE.Group(), w = d.w * U, h = d.h * U;
    if (kind === "planter") { const box = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.45, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.8 })); box.position.y = -h * 0.27; g.add(box);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(w * 0.45, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.9, emissive: 0x0a3a1a, emissiveIntensity: 0.3 })); bush.scale.y = 0.7; bush.position.y = h * 0.12; g.add(bush); }
    else if (kind === "ac") { const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.7), new THREE.MeshStandardMaterial({ color: 0x9aa0b0, roughness: 0.45, metalness: 0.6, normalMap: K.tex("metal_plate", "nor") })); g.add(box);
      const fan = new THREE.Mesh(new THREE.CircleGeometry(h * 0.36, 20), new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6 })); fan.position.z = 0.36; g.add(fan); g.userData.fan = fan; }
    else { const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), new THREE.MeshStandardMaterial({ color: 0x0b0820, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0 })); g.add(board); g.userData.board = board;
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, 0.12)), new THREE.LineBasicMaterial({ color: 0xffffff })); g.add(edge); g.userData.edge = edge; }
    scene.add(g); return g; };
  const takeHaz = (kind) => { const pool = hazPool[kind] || (hazPool[kind] = []), u = hazUsed[kind] || 0; let m = pool[u]; if (!m) m = pool[u] = mkHaz(kind); hazUsed[kind] = u + 1; m.visible = true; return m; };
  const dronePool = [], mkDrone = () => { const g = new THREE.Group(), dm = new THREE.MeshStandardMaterial({ color: 0x15161c, metalness: 0.85, roughness: 0.3 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), dm)); const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 8, 32), dm); r.rotation.x = Math.PI / 2; g.add(r);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.08, 0.2).multiplyScalar(4) })); eye.position.z = 0.3; g.add(eye); g.userData.eye = eye;
    const l = new THREE.PointLight(0xff1030, 3, 2.5, 2); l.position.z = 0.5; g.add(l); scene.add(g); return g; };
  const debM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x6a6280, roughness: 0.7, metalness: 0.3 }), 80); debM.frustumCulled = false; scene.add(debM);

  const post = K.post(renderer, scene, camera, { bloom: [0.5, 0.45, 0.9], vignette: 0.7, grain: 0.018 });
  let W = 0, H = 0;
  const resize = (w, h) => { if (w === W && h === H) return; W = w; H = h; const dpr = Math.min(devicePixelRatio || 1, q === "high" ? 2 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); post.composer.setPixelRatio(dpr); post.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
  const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), SC3 = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color(), up = new THREE.Vector3(), fwd = new THREE.Vector3(), rt = new THREE.Vector3(), B = new THREE.Matrix4();
  let last = performance.now();
  const orient = (upV, fwdV) => { up.copy(upV).normalize(); fwd.copy(fwdV).normalize(); rt.crossVectors(up, fwd).normalize(); fwd.crossVectors(rt, up).normalize(); B.makeBasis(rt, up, fwd); pose.quaternion.setFromRotationMatrix(B); };

  return {
    ok: true,
    render(t) {
      const L = S.layout; resize(L.W, L.H); const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      const camY = S.camY, SCk = L.SC, D = S.district(camY), xmas = S.XMAS;
      // camera fitted to the 2D mapping: x 0..LW -> OX..OX+LW*SC, y = camY at 70% of the height
      const fov = THREE.MathUtils.degToRad(camera.fov), visH = (H / SCk) * U, d = visH / (2 * Math.tan(fov / 2)), yc = (camY + (0.2 * H) / SCk) * U;
      camera.position.set(0, yc, d); camera.lookAt(0, yc, 0); camera.updateMatrixWorld();
      sky.position.set(0, yc, 0); key.target.position.set(0, yc, 0); key.position.set(-6, yc + 10, 12);
      // district colours
      skyU.a.value.set(D.sky[0]); skyU.b.value.set(D.sky[1]); skyU.c.value.set(D.sky[2]); scene.fog.color.set(D.sky[0]);
      towerU.uWall.value.set(D.wall); towerU.uWin0.value.set(D.win[0]); towerU.uWin1.value.set(D.win[1]); towerU.uWin2.value.set(D.win[2]); towerU.uXmas.value = xmas ? 1 : 0;
      trimMat.color.set(D.trim).multiplyScalar(2.4); botLight.color.set(D.trim);
      left.position.y = right.position.y = yc + 10; trims.forEach((m) => (m.position.y = yc + 10));
      for (let i = 0; i < farB.length; i++) { const b = farB[i]; M.compose(V.set(b.x, yc - 30 + b.h / 2, b.z), Q.identity(), SC3.set(b.w, b.h, b.w)); far.setMatrixAt(i, M); } far.instanceMatrix.needsUpdate = true;
      // ledges every 60 units along both inner edges
      const y0 = Math.floor((camY - H * 0.5 / SCk) / 60) * 60; let nl = 0;
      for (let k = 0; k < LEDGES && nl < LEDGES * 2; k++) { const y = y0 + k * 60; for (const side of [0, 1]) { M.compose(V.set(side ? X(WR) + 7 * U : X(WL) - 7 * U, Y(y), 0.1), Q.identity(), SC3.set(1, 1, 1)); ledges.setMatrixAt(nl++, M); } }
      ledges.count = nl; ledges.instanceMatrix.needsUpdate = true;
      const top = camY + (H * 0.7) / SCk + 60, bot = camY - (H * 0.3) / SCk - 60, vis = (y) => y < top && y > bot;
      // coins
      let nc = 0, nbau = 0;
      for (const k of S.coins) { if (!vis(k.y)) continue;
        if (xmas) { if (nbau >= MAXC) continue; M.compose(V.set(X(k.x), Y(k.y), 0.2), Q.identity(), SC3.setScalar(1)); bauM.setMatrixAt(nbau, M); bauM.setColorAt(nbau, C.set(S.BAUBLES[Math.floor(S.hash(k.y * 0.13 + k.ph) * S.BAUBLES.length)])); nbau++; }
        else { if (nc >= MAXC) continue; E.set(Math.PI / 2, 0, 0); Q.setFromEuler(E); const sp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * 2.4 + k.ph); M.compose(V.set(X(k.x), Y(k.y), 0.2), sp.multiply(Q), SC3.setScalar(1)); coinsM.setMatrixAt(nc++, M); } }
      coinsM.count = nc; bauM.count = nbau; coinsM.instanceMatrix.needsUpdate = bauM.instanceMatrix.needsUpdate = true; if (bauM.instanceColor) bauM.instanceColor.needsUpdate = true;
      // power-ups
      let pi = 0; for (const qq of S.pickups) { if (!vis(qq.y)) continue; let g = pickPool[pi];
        if (!g) { g = pickPool[pi] = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(20 * U, 24, 16), new THREE.MeshPhysicalMaterial({ roughness: 0.1, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0.6 })));
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); s.scale.setScalar(0.62); s.position.z = 0.55; g.add(s); const l = new THREE.PointLight(0xffffff, 3, 2.5, 2); l.position.z = 0.6; g.add(l); scene.add(g); }
        pi++; const col = S.PCOL[qq.type] || "#ffffff"; g.visible = true; g.position.set(X(qq.x), Y(qq.y + Math.sin(t * 3 + qq.ph) * 8), 0.2);
        g.children[0].material.color.set(col); g.children[0].material.emissive.set(col); g.children[1].material.map = glyph(qq.type); g.children[2].color.set(col); }
      for (let i = pi; i < pickPool.length; i++) pickPool[i].visible = false;
      // hazards on the walls
      for (const k in hazUsed) hazUsed[k] = 0;
      for (const h of S.hazards) { if (!vis(h.y)) continue; const d0 = S.HAZ[h.kind]; if (!d0) continue; const m = takeHaz(h.kind), w = d0.w;
        m.position.set(h.side ? X(WR - w / 2) : X(WL + w / 2), Y(h.y), 0.35);
        if (m.userData.fan) m.userData.fan.rotation.z = t * 8;
        if (m.userData.board) { const c = D.win[(Math.abs(Math.round(h.y)) >> 4) % 3]; m.userData.board.material.emissive.set(c); m.userData.board.material.emissiveIntensity = 0.7; m.userData.edge.material.color.set(c).multiplyScalar(2.2); } }
      for (const k in hazPool) for (let i = hazUsed[k] || 0; i < hazPool[k].length; i++) hazPool[k][i].visible = false;
      // drones
      let di = 0; for (const dr of S.drones) { if (!vis(dr.y)) continue; const g = dronePool[di] || (dronePool[di] = mkDrone()); di++; g.visible = true; g.position.set(X(dr.x), Y(dr.y), 0.4); g.rotation.y = dr.vx > 0 ? 0.6 : -0.6; g.children[1].rotation.z = t * 6; }
      for (let i = di; i < dronePool.length; i++) dronePool[i].visible = false;
      // debris
      let nd = 0; for (const b of S.debris) { if (nd >= 80 || !vis(b.y)) continue; const s = (b.s || b.size || 10) * U; E.set(b.rot || 0, (b.rot || 0) * 0.7, b.rot || 0); M.compose(V.set(X(b.x), Y(b.y), 0.3), Q.setFromEuler(E), SC3.set(s, s, s)); debM.setMatrixAt(nd++, M); }
      debM.count = nd; debM.instanceMatrix.needsUpdate = true;
      // the robot
      const p = S.p; let air = true;
      if (p) {
        const yy = Y(p.y), k = 1;
        if (p.dead) { rig.position.set(X(p.deadX), yy, 0.3); orient(new THREE.Vector3(Math.sin(-p.spin), Math.cos(p.spin), 0), new THREE.Vector3(0, 0, 1)); play("Death", 0.1); }
        else if (p.rocket > 0) { rig.position.set(X(LW / 2), yy, 0.3); orient(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); play("Jump"); }
        else if (p.jump) { const u = p.jump.t / p.jump.T, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; rig.position.set(X(p.jump.x0 + (p.jump.x1 - p.jump.x0) * e), yy, 0.3);
          orient(new THREE.Vector3(Math.sin(-(p.spin || 0)), Math.cos(p.spin || 0), 0), new THREE.Vector3(p.jump.to ? 1 : -1, 0, 0.35)); play("Jump", 0.08); }
        else { air = false; const side = p.side ? 1 : 0; rig.position.set(side ? X(WR) : X(WL), yy, 0.3); orient(new THREE.Vector3(side ? -1 : 1, 0, 0), new THREE.Vector3(0, 1, 0)); play("Running", 0.15); }
        void k;
        botLight.position.set(rig.position.x, rig.position.y + 0.4, 1.2);
        rocketFlame.visible = p.rocket > 0 && !p.dead; if (rocketFlame.visible) { rocketFlame.position.set(X(LW / 2), yy - 0.9, 0.3); rocketFlame.rotation.z = Math.PI; rocketFlame.scale.y = 0.7 + Math.random() * 0.6; }
        const sOn = !p.dead && (S.powers.shield > 0 || p.grace > 0); shield.visible = sOn; if (sOn) { shield.position.set(rig.position.x, yy, 0.3); shieldMat.uniforms.uC.value.set(p.grace > 0 ? "#ffffff" : "#9ef0a6"); }
      }
      rig.visible = !!p && S.state !== "menu";
      if (mixer) { if (cur === acts.Running) cur.timeScale = 1.4; mixer.update(dt); }
      void air;
      post.render(dt);
    },
  };
}
