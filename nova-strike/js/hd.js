// Nova Strike in 3D: the same fight with real 3D ships. Your fighter and every enemy are built from the game's own
// outlines, extruded with metal hulls and neon edges; glowing shots, bosses with turning parts, a nebula and a planet
// far below, sparks and shockwaves, bloom and a film grade. Loaded only when the graphics switch is on 3D.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

const U = 1 / 40;   // game units to metres
export function attach(S) {
  const FW = S.FW, FH = S.FH, q = K.tier();
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x03001a);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
  scene.environment = K.cityEnv(renderer, { sky: [0.02, 0.01, 0.08], horizon: [0.3, 0.12, 0.55], windows: 0.2, neon: 1.4 });
  scene.add(new THREE.HemisphereLight(0x8a7aff, 0x100818, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-6, 12, -4); scene.add(key);
  const P = (x, y, h = 0) => new THREE.Vector3((x - FW / 2) * U, h, (y - FH / 2) * U);

  // deep space below the field: a nebula, a ringed planet, three star layers that scroll with the game's stars
  const nebula = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT; varying vec2 vUv; ${K.NOISE_GLSL}
      void main(){ vec2 p = vUv * 6.0; p.y += uT * 0.02; float n = naFbm(p + naFbm(p * 0.7 + uT * 0.01));
        vec3 c = mix(vec3(0.02, 0.0, 0.08), vec3(0.32, 0.06, 0.5), smoothstep(0.35, 0.8, n)); c = mix(c, vec3(0.0, 0.35, 0.55), smoothstep(0.62, 0.95, naFbm(p * 1.7 + 4.0)) * 0.6);
        c *= 0.9 * (1.0 - smoothstep(0.3, 0.75, length(vUv - 0.5))); gl_FragColor = vec4(c, 1.0); }` }));
  nebula.rotation.x = -Math.PI / 2; nebula.position.y = -60; nebula.scale.setScalar(3); scene.add(nebula);
  const planet = new THREE.Group(); planet.position.set(-4, -95, 52); planet.scale.setScalar(6); scene.add(planet);
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(4.2, 48, 32), new THREE.MeshStandardMaterial({ color: 0x3a1a7a, roughness: 0.8, emissive: 0x16063a, emissiveIntensity: 0.6 })));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(4.55, 48, 32), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: "varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.6, 0.3, 1.0) * f * 1.6, 1.0); }" })); planet.add(atmo);
  const pring = new THREE.Mesh(new THREE.RingGeometry(5.4, 7.6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8ad8).multiplyScalar(0.35), transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  pring.rotation.x = -Math.PI / 2 + 0.35; planet.add(pring);
  const MAXS = 200, sPos = new Float32Array(MAXS * 3), sGeo = new THREE.BufferGeometry(); sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  const starPts = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xdce6ff, size: 0.06, transparent: true, opacity: 0.9, depthWrite: false })); starPts.frustumCulled = false; scene.add(starPts);

  // hulls from 2D outlines: an extruded body, metal, with a neon edge line
  const hull = (pts, col, depth = 0.18) => {
    const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, -y) : sh.moveTo(x, -y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.03, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2); geo.translate(0, -depth / 2, 0);
    const g = new THREE.Group(), body = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(col).multiplyScalar(0.25), metalness: 0.7, roughness: 0.3, clearcoat: 0.8, emissive: col, emissiveIntensity: 0.55 }));
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(pts.concat([pts[0]]).map(([x, y]) => new THREE.Vector3(x, depth / 2 + 0.02, y)));
    const edge = new THREE.Line(edgeGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.6) }));
    g.add(body, edge); g.userData.body = body; g.userData.edge = edge; return g; };
  const sc = (pts, k) => pts.map(([x, y]) => [x * k * U, y * k * U]);
  const SHIP = [[0, -18], [14, 10], [5, 6], [0, 12], [-5, 6], [-14, 10]];
  const ship = hull(sc(SHIP, 1), 0x00e5ff, 0.22); ship.userData.body.material.color.set(0x16304a); ship.userData.body.material.emissiveIntensity = 0.35; scene.add(ship);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e5ff).multiplyScalar(2.6), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = Math.PI / 2; ship.add(flame); flame.position.set(0, 0, 0.5);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.6) })); cockpit.position.y = 0.14; ship.add(cockpit);
  const shipLight = new THREE.PointLight(0x00e5ff, 3, 4, 2); scene.add(shipLight);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(22 * U, 32, 20), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(vec3(0.49, 1.0, 0.23) * (0.1 + f * 1.6), 1.0); }" })); scene.add(shield);
  // enemies by kind
  const KIND = S.KIND, outline = {
    drone: (r) => [[0, r], [r, -r * 0.4], [0, -r * 0.1], [-r, -r * 0.4]],
    swoop: (r) => [[0, r], [r * 1.2, -r * 0.6], [0, -r * 0.2], [-r * 1.2, -r * 0.6]],
    pod: (r) => Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.7 : r; return [Math.cos(a) * rr, Math.sin(a) * rr]; }),
    kami: (r) => [[0, r * 1.3], [r * 0.7, -r], [-r * 0.7, -r]],
    tank: (r) => [[-r, -r * 0.7], [r, -r * 0.7], [r, r * 0.7], [r * 0.4, r * 0.7], [0, r * 1.1], [-r * 0.4, r * 0.7], [-r, r * 0.7]],
    mine: (r) => Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, rr = i % 2 ? r * 0.55 : r; return [Math.cos(a) * rr, Math.sin(a) * rr]; }),
  };
  const pools = {}, usedN = {};
  const takeEnemy = (kind) => { const pool = pools[kind] || (pools[kind] = []), u = usedN[kind] || 0; let m = pool[u];
    if (!m) { const k = KIND[kind] || { r: 12, col: "#ff2bd6" }; m = pool[u] = hull(sc((outline[kind] || outline.drone)(k.r), 1), new THREE.Color(k.col), 0.2); scene.add(m); }
    usedN[kind] = u + 1; m.visible = true; return m; };
  // bosses: a hexagon core with turrets and a turning ring, a great wing, a staring eye
  const bossGrp = new THREE.Group(); scene.add(bossGrp); let bossKey = "";
  const buildBoss = (B) => { bossGrp.clear(); const r = B.r, col = new THREE.Color(B.col || "#ff2bd6");
    if (B.k === 0) { bossGrp.add(hull(sc(Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r * 0.75]; }), 1), col, 0.45));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * U * 1.25, 0.05, 10, 80), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.4) })); ring.rotation.x = Math.PI / 2 - 0.3; ring.name = "ring"; bossGrp.add(ring);
      const core = new THREE.Mesh(new THREE.SphereGeometry(r * U * 0.35, 24, 16), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2) })); core.name = "core"; core.position.y = 0.2; bossGrp.add(core);
      for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(11 * U, 13 * U, 0.3, 16), new THREE.MeshPhysicalMaterial({ color: 0x222238, metalness: 0.9, roughness: 0.3, emissive: col, emissiveIntensity: 0.25 })); t.name = "turret" + i; bossGrp.add(t); } }
    else if (B.k === 1) { bossGrp.add(hull(sc([[0, r * 0.8], [r * 1.9, -r * 0.3], [r * 0.6, -r * 0.2], [r * 0.4, -r * 0.9], [-r * 0.4, -r * 0.9], [-r * 0.6, -r * 0.2], [-r * 1.9, -r * 0.3]], 1), col, 0.4));
      const core = new THREE.Mesh(new THREE.SphereGeometry(r * U * 0.25, 20, 14), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2) })); core.position.y = 0.25; bossGrp.add(core); }
    else { const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshPhysicalMaterial({ color: 0x14142a, metalness: 0.6, roughness: 0.25, clearcoat: 1 })); eye.scale.set(r * U * 1.25, r * U * 0.6, r * U * 0.85); bossGrp.add(eye);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(r * U * 0.42, 24, 16), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.8) })); iris.name = "iris"; bossGrp.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * U * 0.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0x05000f })); pupil.name = "pupil"; bossGrp.add(pupil); }
    const bl = new THREE.PointLight(col, 8, 8, 2); bl.position.y = 1; bossGrp.add(bl); };
  const laserMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.55, 0.6).multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const bossLaser = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), laserMat); bossLaser.rotation.x = -Math.PI / 2; scene.add(bossLaser);
  const pLaser = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.95, 1).multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); pLaser.rotation.x = -Math.PI / 2; scene.add(pLaser);
  // shots, bullets, pickups, sparks, rings
  const MAXE = 720, eBul = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXE); eBul.count = 0; eBul.frustumCulled = false; scene.add(eBul);
  const MAXPB = 300, pBul = new THREE.InstancedMesh(new THREE.CapsuleGeometry(1, 4, 4, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXPB); pBul.count = 0; pBul.frustumCulled = false; scene.add(pBul);
  const GL = 1800, gPos = new Float32Array(GL * 3), gCol = new Float32Array(GL * 3), gSize = new Float32Array(GL), gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3)); gGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3)); gGeo.setAttribute("size", new THREE.BufferAttribute(gSize, 1));
  const gMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTex: { value: K.softTexture() }, uScale: { value: 400 } },
    vertexShader: "attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform sampler2D uTex; varying vec3 vC; void main(){ gl_FragColor = vec4(vC * texture2D(uTex, gl_PointCoord).a, 1.0); }" });
  const glows = new THREE.Points(gGeo, gMat); glows.frustumCulled = false; scene.add(glows);
  const pickPool = [], ringPool = [], letterTex = {};
  const letter = (k, col) => letterTex[k] || (letterTex[k] = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.font = "800 44px Jost, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = col; g.fillText(k, 32, 35); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })());

  const post = K.post(renderer, scene, camera, { bloom: [0.55, 0.42, 0.86], vignette: 0.6, grain: 0.016 });
  let W = 0, H = 0;
  const resize = (w, h) => { if (w === W && h === H) return; W = w; H = h; const dpr = Math.min(devicePixelRatio || 1, q === "high" ? 2 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); post.composer.setPixelRatio(dpr); post.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
  const TILT = THREE.MathUtils.degToRad(16), M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), C = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), E = new THREE.Euler();
  const fit = (L, sx, sy) => { const fov = THREE.MathUtils.degToRad(camera.fov), d = (FH * U * 1.04 * H) / (2 * Math.tan(fov / 2) * Math.max(80, FH * L.S));
    camera.position.set(sx, Math.cos(TILT) * d, Math.sin(TILT) * d + sy); camera.lookAt(sx, 0, sy);
    const cx = L.OX + (FW * L.S) / 2, cy = L.OY + (FH * L.S) / 2; camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H); camera.updateMatrixWorld(); gMat.uniforms.uScale.value = H * 0.5 / Math.tan(fov / 2); };
  let ng = 0; const glow = (x, y, h, col, size) => { if (ng >= GL) return; const v = P(x, y, h); gPos[ng * 3] = v.x; gPos[ng * 3 + 1] = v.y; gPos[ng * 3 + 2] = v.z; gCol[ng * 3] = col.r; gCol[ng * 3 + 1] = col.g; gCol[ng * 3 + 2] = col.b; gSize[ng] = size; ng++; };

  return {
    ok: true,
    project(x, y, h = 0.3) { V.copy(P(x, y, h)).project(camera); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * H]; },
    render() {
      const L = S.layout; resize(L.W, L.H); const time = S.time, sk = (S.shake || 0) * 0.12 * (window.ARCADE_CALM ? 0.15 : 1);
      fit(L, sk ? (Math.random() - 0.5) * sk : 0, sk ? (Math.random() - 0.5) * sk : 0);
      nebula.material.uniforms.uT.value = time; planet.rotation.y = time * 0.03; ng = 0; for (const k in usedN) usedN[k] = 0;
      // stars
      let ns = 0; for (const l of S.stars || []) for (const st of l) { if (ns >= MAXS) break; const v = P(st.x, st.y, -3 - st.s * 1.5); sPos[ns * 3] = v.x; sPos[ns * 3 + 1] = v.y; sPos[ns * 3 + 2] = v.z; ns++; }
      sGeo.setDrawRange(0, ns); sGeo.attributes.position.needsUpdate = true;
      // the player
      const Pl = S.P, playing = S.state !== "menu";
      const showShip = !!(Pl && Pl.alive && playing && !(Pl.inv > 0 && Math.sin(time * 30) < 0));
      ship.visible = showShip; shipLight.intensity = showShip ? 3 : 0; shield.visible = !!(Pl && Pl.alive && Pl.shield && playing);
      if (Pl && showShip) { ship.position.copy(P(Pl.x, Pl.y, 0.3)); ship.rotation.set(0, 0, 0); ship.rotateZ(-(Pl.tilt || 0) * 0.5); flame.scale.set(1, 0.7 + Math.random() * 0.6, 1); shipLight.position.copy(P(Pl.x, Pl.y + 12, 0.8)); }
      if (Pl && shield.visible) shield.position.copy(P(Pl.x, Pl.y, 0.3));
      pLaser.visible = !!(Pl && Pl.laser > 0 && Pl.alive && playing);
      if (pLaser.visible) { const top = Pl.beamTop != null ? Pl.beamTop : -10, len = (Pl.y - top) * U, w = (8 + Math.sin(time * 40) * 2) * 2 * U; pLaser.scale.set(w, len, 1); pLaser.position.copy(P(Pl.x, (Pl.y + top) / 2, 0.35)); }
      // enemies
      for (const e of S.enemies || []) { const m = takeEnemy(e.kind); m.position.copy(P(e.x, e.y, 0.3));
        let rot = 0; if (e.kind === "swoop") rot = Math.sin(e.t * 4) * 0.4; else if (e.kind === "pod") rot = e.t * 0.6; else if (e.kind === "kami" && e.dived) rot = Math.atan2(e.vy, e.vx) - Math.PI / 2; else if (e.kind === "mine") rot = e.a || 0;
        m.rotation.set(0, -rot, 0); m.userData.edge.material.color.set(e.hit > 0 ? "#ffffff" : (S.KIND[e.kind] || {}).col || "#ff2bd6").multiplyScalar(2.6); m.userData.body.material.emissiveIntensity = e.hit > 0 ? 1.6 : 0.55; }
      for (const k in pools) for (let i = usedN[k] || 0; i < pools[k].length; i++) pools[k][i].visible = false;
      // the boss
      const B = S.boss; bossGrp.visible = !!B; bossLaser.visible = false;
      if (B) { const keyB = B.k + "|" + B.r + "|" + B.col; if (keyB !== bossKey) { bossKey = keyB; buildBoss(B); }
        bossGrp.position.copy(P(B.x, B.y, 0.4));
        const ring = bossGrp.getObjectByName("ring"); if (ring) ring.rotation.z = B.t * 0.8;
        const core = bossGrp.getObjectByName("core"); if (core) core.scale.setScalar(1 + 0.15 * Math.sin(B.t * 6));
        if (B.turrets) B.turrets.forEach((t, i) => { const tm = bossGrp.getObjectByName("turret" + i); if (!tm) return; tm.visible = !t.dead; tm.position.set(Math.cos(t.a + B.t * 0.5) * 58 * U, 0.2, Math.sin(t.a + B.t * 0.5) * 34 * U); });
        const iris = bossGrp.getObjectByName("iris"), pupil = bossGrp.getObjectByName("pupil");
        if (iris && Pl) { const px = Math.max(-1, Math.min(1, (Pl.x - B.x) / 200)) * B.r * 0.35 * U, pz = Math.max(-1, Math.min(1, (Pl.y - B.y) / 400)) * B.r * 0.25 * U; iris.position.set(px, B.r * U * 0.35, pz); pupil.position.set(px, B.r * U * 0.55, pz); }
        if (B.laser) { const Lz = B.laser, a = Lz.a != null ? Lz.a : Lz.a0, len = 900 * U, warm = Lz.t < 0.8; bossLaser.visible = Lz.t < 3;
          const w = warm ? 0.04 : 24 * U * (0.8 + 0.2 * Math.sin(time * 40)); laserMat.opacity = warm ? 0.4 + 0.3 * Math.sin(Lz.t * 40) : 1;
          bossLaser.scale.set(len, w, 1); bossLaser.rotation.set(-Math.PI / 2, 0, -a); const c = P(B.x, B.y, 0.45); bossLaser.position.set(c.x + Math.cos(a) * len / 2, 0.45, c.z + Math.sin(a) * len / 2); } }
      // enemy bullets
      let ne = 0; for (const b of S.eb || []) { if (ne >= MAXE) break; M.compose(V.copy(P(b.x, b.y, 0.32)), Q.identity(), SC.setScalar(b.r * U * 0.85)); eBul.setMatrixAt(ne, M); C.set(b.col).multiplyScalar(1.6); eBul.setColorAt(ne, C); glow(b.x, b.y, 0.32, C.multiplyScalar(0.4), b.r * U * 4.2); ne++; }
      eBul.count = ne; eBul.instanceMatrix.needsUpdate = true; if (eBul.instanceColor) eBul.instanceColor.needsUpdate = true;
      // player shots
      let np = 0; for (const b of S.pb || []) { if (np >= MAXPB) break; const missile = b.kind === "missile";
        M.compose(V.copy(P(b.x, b.y, 0.3)), Q.setFromEuler(E.set(Math.PI / 2, 0, 0)), SC.set(missile ? 3 * U : 1.5 * U, missile ? 1.5 * U : 1.75 * U, missile ? 3 * U : 1.5 * U)); pBul.setMatrixAt(np, M);
        C.set(missile ? "#ffb070" : b.kind === "side" ? "#c9a0ff" : "#8ff2ff").multiplyScalar(2.2); pBul.setColorAt(np, C); glow(b.x, b.y, 0.3, C.multiplyScalar(0.18), 16 * U); np++; }
      pBul.count = np; pBul.instanceMatrix.needsUpdate = true; if (pBul.instanceColor) pBul.instanceColor.needsUpdate = true;
      // pickups: a glowing ring with its letter
      let pi = 0; for (const p of S.pickups || []) { let g = pickPool[pi]; const col = { P: "#00e5ff", L: "#ff3de0", H: "#ff8a3d", S: "#7dff3a", B: "#ffd23f" }[p.k] || "#ffffff";
        if (!g) { g = pickPool[pi] = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(11 * U, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }))); g.children[0].rotation.x = Math.PI / 2;
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); s.scale.setScalar(0.42); g.add(s); scene.add(g); }
        pi++; g.visible = true; g.position.copy(P(p.x, p.y, 0.3)); g.children[0].material.color.set(col).multiplyScalar(2.4); g.children[0].rotation.z = time * 2; g.children[1].material.map = letter(p.k, col); }
      for (let i = pi; i < pickPool.length; i++) pickPool[i].visible = false;
      // sparks and shockwaves
      for (const p of S.parts || []) { C.set(p.col).multiplyScalar(Math.max(0, Math.min(1, p.life)) * 1.4); glow(p.x, p.y, 0.4, C, p.s * U * 2.6); }
      let ri = 0; for (const r of S.rings || []) { let m = ringPool[ri]; if (!m) { m = ringPool[ri] = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 8, 64), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = Math.PI / 2; scene.add(m); }
        ri++; const u = r.t / r.dur; m.visible = true; m.position.copy(P(r.x, r.y, 0.35)); m.scale.setScalar(Math.max(0.01, r.max * u * U)); m.material.color.set(r.col).multiplyScalar(2.4); m.material.opacity = 1 - u; }
      for (let i = ri; i < ringPool.length; i++) ringPool[i].visible = false;
      gGeo.setDrawRange(0, ng); gGeo.attributes.position.needsUpdate = gGeo.attributes.color.needsUpdate = gGeo.attributes.size.needsUpdate = true;
      post.grade.uniforms.flash.value = Math.min(0.6, (S.flash || 0) * 0.6 * (window.ARCADE_CALM ? 0.15 : 1));
      post.render(1 / 60);
    },
  };
}
