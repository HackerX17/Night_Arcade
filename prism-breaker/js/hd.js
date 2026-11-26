// Prism Breaker in 3D: the same field in real 3D. Glossy neon blocks with depth, shadows and their numbers on top,
// glowing balls with trails, 3D pickups (rings, stars, lasers, prisms), laser beams, bomb rings, floating prisms round
// the field, bloom and a film grade. The camera is tilted a little; aiming follows the 3D view exactly.
// Loaded only when the graphics switch is on 3D.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

export function attach(S) {
  const COLS = S.COLS, LINE = S.LINE, FLOOR = S.FLOOR, R = S.R, GAP = S.GAP, q = K.tier();
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = q !== "low"; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x06012a);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
  scene.environment = K.cityEnv(renderer, { sky: [0.02, 0.01, 0.08], horizon: [0.4, 0.1, 0.5], windows: 0.4 });
  scene.add(new THREE.HemisphereLight(0x8a6aff, 0x100818, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-4, 14, 6); key.castShadow = q !== "low";
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 8, bottom: -8, near: 1, far: 40 }); key.shadow.mapSize.set(1024, 1024); scene.add(key, key.target);
  const cx0 = COLS / 2, cz0 = FLOOR / 2, P = (x, y, h = 0) => new THREE.Vector3(x - cx0, h, y - cz0);

  // the field: a dark glossy floor with a faint grid, a neon frame, the red line, a soft glow beneath
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(COLS, FLOOR), new THREE.MeshStandardMaterial({ color: 0x0a0624, roughness: 0.25, metalness: 0.3, envMapIntensity: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const lines = new THREE.Group(), lineM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6a5aff).multiplyScalar(0.45) }); scene.add(lines);
  for (let c = 1; c < COLS; c++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, LINE), lineM); b.position.copy(P(c, LINE / 2, 0.003)); lines.add(b); }
  for (let r = 1; r < LINE; r++) { const b = new THREE.Mesh(new THREE.BoxGeometry(COLS, 0.004, 0.012), lineM); b.position.copy(P(COLS / 2, r, 0.003)); lines.add(b); }
  const frameMat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2) });
  for (const [w, d, x, y, c] of [[COLS + 0.12, 0.06, COLS / 2, -0.03, 0x00e5ff], [0.06, FLOOR + 0.12, -0.03, FLOOR / 2, 0x8a2bff], [0.06, FLOOR + 0.12, COLS + 0.03, FLOOR / 2, 0xff2bd6], [COLS + 0.12, 0.06, COLS / 2, FLOOR + 0.03, 0xff2bd6]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), frameMat(c)); m.position.copy(P(x, y, 0.04)); scene.add(m); }
  const deadMat = new THREE.ShaderMaterial({ transparent: true, uniforms: { uA: { value: 0.5 } }, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ if (fract(vUv.x * ${(COLS * 2.6).toFixed(1)}) > 0.58) discard; gl_FragColor = vec4(vec3(1.0, 0.18, 0.3) * 2.0, uA); }` });
  const dead = new THREE.Mesh(new THREE.PlaneGeometry(COLS, 0.05), deadMat); dead.rotation.x = -Math.PI / 2; dead.position.copy(P(COLS / 2, LINE, 0.01)); scene.add(dead);
  // floating prisms around the field
  const deco = new THREE.Group(); scene.add(deco);
  for (let i = 0; i < 18; i++) { const side = i % 2 ? 1 : -1, c = [0xff2bd6, 0x00e5ff, 0xb46bff, 0xffd23f][i % 4];
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + K.rand() * 0.6), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c).multiplyScalar(0.35), emissive: c, emissiveIntensity: 0.45, roughness: 0.1, clearcoat: 1, flatShading: true }));
    m.position.set(side * (COLS / 2 + 1.2 + K.rand() * 4), -1.5 + K.rand() * 3, (K.rand() - 0.5) * (FLOOR + 6)); m.userData.spin = (K.rand() - 0.5) * 0.6; deco.add(m); }

  // blocks: glossy rounded boxes (instanced, coloured by strength) with their number on top
  const MAXK = COLS * (LINE + 2);
  const blockMat = new THREE.MeshPhysicalMaterial({ roughness: 0.16, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xffffff, emissiveIntensity: 0.0 });
  blockMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n #if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )\n totalEmissiveRadiance = vColor * 0.32;\n #endif"); };
  const blocks = new THREE.InstancedMesh(new K.RoundedBoxGeometry(1 - 2 * GAP, 0.5, 1 - 2 * GAP, 3, 0.1), blockMat, MAXK); blocks.castShadow = true; blocks.receiveShadow = true; blocks.count = 0; scene.add(blocks);
  const edges = new THREE.InstancedMesh(new THREE.BoxGeometry(1 - 2 * GAP + 0.02, 0.02, 1 - 2 * GAP + 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXK); edges.count = 0; scene.add(edges);
  const numCache = new Map(), numGeo = new THREE.PlaneGeometry(0.8, 0.8), numPool = [];
  const numTex = (txt) => { let t = numCache.get(txt); if (t) return t; if (numCache.size > 260) { for (const v of numCache.values()) v.dispose(); numCache.clear(); }
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), fs = txt.length > 5 ? 34 : txt.length > 3 ? 44 : 62;
    g.font = `800 ${fs}px Jost, "Arial Black", system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 10; g.strokeStyle = "rgba(8,2,26,.85)"; g.strokeText(txt, 64, 68); g.fillStyle = "#fff"; g.fillText(txt, 64, 68);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; numCache.set(txt, t); return t; };
  const numMesh = (i) => { let m = numPool[i]; if (!m) { m = numPool[i] = new THREE.Mesh(numGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: new THREE.Color(1.15, 1.15, 1.15) })); m.rotation.x = -Math.PI / 2; m.renderOrder = 3; scene.add(m); } return m; };
  // pickups
  const itemPool = {}, used = {};
  const mk = {
    ring: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7dff3a).multiplyScalar(2.2) })));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaffd8).multiplyScalar(2) }))); g.children[0].rotation.x = Math.PI / 2; return g; },
    star: () => { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.08 : 0.19, a = -Math.PI / 2 + (i * Math.PI) / 5; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }); geo.center();
      const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xffd23f, metalness: 1, roughness: 0.2, emissive: 0xff9a00, emissiveIntensity: 0.6 })); m.rotation.x = -Math.PI / 2; const g = new THREE.Group(); g.add(m); m.castShadow = true; return g; },
    lh: () => { const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0a0).multiplyScalar(2.2) });
      const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.5, 4, 10), mat); bar.rotation.z = Math.PI / 2; g.add(bar);
      for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 12), mat); tip.rotation.z = -s * Math.PI / 2; tip.position.x = s * 0.32; g.add(tip); } return g; },
    split: () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 3), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transmission: 0.0, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.3, emissive: 0x8a6aff, emissiveIntensity: 0.25 }));
      m.castShadow = true; g.add(m); return g; },
  };
  mk.lv = () => { const g = mk.lh(); g.rotation.y = Math.PI / 2; return g; };
  const take = (k) => { const pool = itemPool[k] || (itemPool[k] = []), u = used[k] || 0; let m = pool[u]; if (!m) { m = pool[u] = mk[k](); scene.add(m); } used[k] = u + 1; m.visible = true; return m; };
  // balls, trails, sparks, beams, bomb rings, the launcher, the aim
  const MAXB = 520;
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXB); balls.count = 0; balls.frustumCulled = false; scene.add(balls);
  const glowGeo = new THREE.BufferGeometry(), gPos = new Float32Array(MAXB * 3 * 6), gCol = new Float32Array(MAXB * 3 * 6), gSize = new Float32Array(MAXB * 6);
  glowGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3)); glowGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3)); glowGeo.setAttribute("size", new THREE.BufferAttribute(gSize, 1));
  const glowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTex: { value: K.softTexture() }, uScale: { value: 400 } },
    vertexShader: "attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform sampler2D uTex; varying vec3 vC; void main(){ gl_FragColor = vec4(vC * texture2D(uTex, gl_PointCoord).a, 1.0); }" });
  const glows = new THREE.Points(glowGeo, glowMat); glows.frustumCulled = false; scene.add(glows);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.94, 0.6).multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamPool = [], ringPool = [];
  const launcher = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2) })); scene.add(launcher);
  const launchLight = new THREE.PointLight(0x9fe8ff, 3, 3, 2); scene.add(launchLight);

  const post = K.post(renderer, scene, camera, { bloom: [0.5, 0.42, 0.9], vignette: 0.7, grain: 0.018 });
  let W = 0, H = 0;
  const resize = (w, h) => { if (w === W && h === H) return; W = w; H = h; const dpr = Math.min(devicePixelRatio || 1, q === "high" ? 2 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); post.composer.setPixelRatio(dpr); post.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
  // camera framed on the 2D layout's field rectangle, tilted 14 degrees
  const TILT = THREE.MathUtils.degToRad(14), M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), C = new THREE.Color();
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  const fit = (L, sx, sy) => {
    const fov = THREE.MathUtils.degToRad(camera.fov), d = ((FLOOR + 0.6) * H) / (2 * Math.tan(fov / 2) * Math.max(60, L.CELL * FLOOR));
    camera.position.set(sx, Math.cos(TILT) * d, Math.sin(TILT) * d + sy); camera.lookAt(sx, 0, sy);
    const cx = L.FX + (COLS * L.CELL) / 2, cy = L.FY + (FLOOR * L.CELL) / 2; camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H); camera.updateMatrixWorld();
    glowMat.uniforms.uScale.value = H * 0.5 / Math.tan(fov / 2);
  };
  const spark = (k, x, y, h, col, size) => { gPos[k * 3] = x - cx0; gPos[k * 3 + 1] = h; gPos[k * 3 + 2] = y - cz0; gCol[k * 3] = col.r; gCol[k * 3 + 1] = col.g; gCol[k * 3 + 2] = col.b; gSize[k] = size; };

  return {
    ok: true,
    project(x, y, h = 0.3) { V.copy(P(x, y, h)).project(camera); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * H]; },
    // a screen point to field cells, through the 3D view (so aiming matches what you see)
    toCell(px, py) { ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1); ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hit)) return null; return { x: hit.x + cx0, y: hit.z + cz0 }; },
    render(t) {
      const L = S.layout; resize(L.W, L.H);
      const sk = (S.shake || 0) * 0.25 * (window.ARCADE_CALM ? 0.15 : 1); fit(L, sk ? (Math.random() - 0.5) * sk : 0, sk ? (Math.random() - 0.5) * sk : 0);
      deco.children.forEach((m, i) => { m.rotation.x += m.userData.spin * 0.016; m.rotation.y += 0.01; m.position.y += Math.sin(t * 0.7 + i) * 0.002; });
      const grid = S.grid, state = S.state; for (const k in used) used[k] = 0;
      let nb = 0, nn = 0;
      if (grid) {
        const u = state === "advance" ? Math.min(1, S.shiftT / 0.32) : 1, ease = 1 - Math.pow(1 - u, 3), off = -(1 - ease);
        deadMat.uniforms.uA.value = S.warn && state === "aim" ? 0.55 + 0.45 * Math.sin(t * 8) : 0.5;
        for (let r = 0; r <= LINE; r++) for (let c = 0; c < COLS; c++) {
          const it = grid[r][c]; if (!it) continue; const y = r + off + 0.5, x = c + 0.5, rise = r === 0 ? ease : 1;
          if (it.k === "b" || it.k === "bomb") {
            const fl = it.flash > 0 ? it.flash : 0, danger = S.warn && Math.round(r + off) === LINE - 1 && state === "aim";
            M.compose(V.copy(P(x, y, 0.25 * rise)), Q.identity(), SC.set(rise, rise * (1 - fl * 0.15), rise)); blocks.setMatrixAt(nb, M);
            C.setStyle(S.blockCol(it)); if (danger) C.lerp(new THREE.Color(1, 0.18, 0.3), 0.5 + 0.5 * Math.sin(t * 8)); C.multiplyScalar(0.55 + fl * 0.8); blocks.setColorAt(nb, C);
            M.compose(V.copy(P(x, y, 0.505 * rise)), Q.identity(), SC.set(rise, 1, rise)); edges.setMatrixAt(nb, M); C.setStyle(S.blockCol(it)).multiplyScalar(1.8); edges.setColorAt(nb, C); nb++;
            const n = numMesh(nn++); n.visible = true; n.material.map = numTex(it.hp.toLocaleString()); n.material.opacity = rise; n.position.copy(P(x, y, 0.52 * rise));
          } else if (mk[it.k]) {
            const m = take(it.k); const bob = 0.3 + Math.sin(t * 3 + x + y) * 0.04; m.position.copy(P(x, y, bob)); m.scale.setScalar(rise);
            if (it.k === "ring") m.rotation.y = t * 1.5; else if (it.k === "star") m.rotation.y = t * 0.6; else if (it.k === "split") m.rotation.y = t;
            m.traverse((o) => { if (o.material && o.material.opacity !== undefined) { o.material.transparent = !!it.used; o.material.opacity = it.used ? 0.5 : 1; } });
          }
        }
      }
      blocks.count = edges.count = nb; blocks.instanceMatrix.needsUpdate = edges.instanceMatrix.needsUpdate = true;
      if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true; if (edges.instanceColor) edges.instanceColor.needsUpdate = true;
      for (let i = nn; i < numPool.length; i++) numPool[i].visible = false;
      for (const k in itemPool) for (let i = used[k] || 0; i < itemPool[k].length; i++) itemPool[k][i].visible = false;
      // beams and bomb rings
      let bi = 0; for (const b of S.beams) { let m = beamPool[bi]; if (!m) { m = beamPool[bi] = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1), beamMat.clone()); scene.add(m); } bi++;
        m.visible = true; m.material.opacity = b.life; if (b.k === "lh") { m.scale.set(COLS, 1, 0.22); m.position.copy(P(COLS / 2, b.i + 0.5, 0.3)); } else { m.scale.set(0.22, 1, LINE); m.position.copy(P(b.i + 0.5, LINE / 2, 0.3)); } }
      for (let i = bi; i < beamPool.length; i++) beamPool[i].visible = false;
      let ri = 0; for (const g of S.rings) { let m = ringPool[ri]; if (!m) { m = ringPool[ri] = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.54, 0.24).multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = Math.PI / 2; scene.add(m); } ri++;
        m.visible = true; m.material.opacity = g.life; m.position.copy(P(g.x, g.y, 0.3)); m.scale.setScalar(0.4 + (1 - g.life) * 1.4); }
      for (let i = ri; i < ringPool.length; i++) ringPool[i].visible = false;
      // balls with trails, sparks
      let nbl = 0, k = 0; const all = state === "fire" ? S.flying.concat(S.ghosts) : [];
      all.forEach((b, i) => { if (nbl >= MAXB) return; const col = C.setStyle(b.ghost ? "#ffffff" : S.ballCol(i, t));
        M.compose(V.copy(P(b.x, b.y, R * 1.2)), Q.identity(), SC.setScalar(R * 0.95)); balls.setMatrixAt(nbl, M); balls.setColorAt(nbl, b.done ? col : C.setRGB(2, 2, 2)); nbl++;
        C.setStyle(b.ghost ? "#ffffff" : S.ballCol(i, t)).multiplyScalar(0.9);
        if (k < MAXB * 6) spark(k++, b.x, b.y, R * 1.2, C, R * 4.2);
        const tr = b.trail; if (tr && tr.length >= 4 && !b.done) for (let j = 0; j + 1 < tr.length && k < MAXB * 6; j += 4) { const a = j / tr.length; spark(k++, tr[j], tr[j + 1], R * 1.2, C.clone().multiplyScalar(0.35 * a + 0.1), R * 2.4 * (0.4 + a)); } });
      for (const p of S.particles) { if (k >= MAXB * 6) break; C.setStyle(p.col).multiplyScalar(Math.max(0, Math.min(1, p.life)) * 1.6); spark(k++, p.x, p.y, 0.4, C, p.s * 2.2); }
      balls.count = nbl; balls.instanceMatrix.needsUpdate = true; if (balls.instanceColor) balls.instanceColor.needsUpdate = true;
      glowGeo.setDrawRange(0, k); glowGeo.attributes.position.needsUpdate = glowGeo.attributes.color.needsUpdate = glowGeo.attributes.size.needsUpdate = true;
      const showL = state === "aim" || state === "advance" || (state === "fire" && S.toFire > 0); launcher.visible = showL;
      if (showL) { launcher.position.copy(P(S.launchX, FLOOR - R, R * 1.1)); launchLight.position.copy(P(S.launchX, FLOOR - R, 0.6)); launchLight.color.setStyle(S.ballCol(0, t)); launchLight.intensity = 3; } else launchLight.intensity = 0;
      post.render(1 / 60);
    },
  };
}
