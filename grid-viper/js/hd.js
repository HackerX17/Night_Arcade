// Grid Viper in 3D: the same board and snake in real 3D. A board of glass tiles with a neon frame, the snake as a run of
// glossy beads with eyes, the dot as a glowing orb that lights the tiles, the gold star with its countdown ring, maze
// blocks with neon caps, sparks, bloom and a film grade. Loaded only when the graphics switch is on 3D.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

export function attach(S) {
  const N = S.N, half = (N - 1) / 2, q = K.tier();
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = q === "high"; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05001a); scene.fog = new THREE.FogExp2(0x05001a, 0.004);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 400);
  const env = K.cityEnv(renderer, { sky: [0.02, 0.01, 0.07], horizon: [0.3, 0.1, 0.45], windows: 0.6 }); scene.environment = env;
  scene.add(new THREE.HemisphereLight(0x8a6aff, 0x100818, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(-8, 25, 12); key.castShadow = q === "high";
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 }); key.shadow.mapSize.set(1024, 1024); scene.add(key);
  // a soft violet glow under the board
  const under = new THREE.Mesh(new THREE.CircleGeometry(24, 64), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec2 vUv; void main(){ float r = length(vUv) * 2.0; gl_FragColor = vec4(vec3(0.16, 0.05, 0.32) * pow(max(0.0, 1.0 - r), 1.6), 1.0); }" }));
  under.rotation.x = -Math.PI / 2; under.position.y = -1.2; scene.add(under);
  // glass tiles
  const tiles = new THREE.InstancedMesh(new K.RoundedBoxGeometry(0.94, 0.2, 0.94, 3, 0.05), new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.2 }), N * N);
  const M = new THREE.Matrix4(), C = new THREE.Color(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), SC = new THREE.Vector3();
  for (let y = 0, k = 0; y < N; y++) for (let x = 0; x < N; x++, k++) { M.makeTranslation(x - half, -0.1, y - half); tiles.setMatrixAt(k, M); C.set((x + y) % 2 ? 0x130e2a : 0x221a44); tiles.setColorAt(k, C); }
  tiles.receiveShadow = true; scene.add(tiles);
  // the neon frame (dashed and moving in No-walls mode)
  const frame = new THREE.Group(); scene.add(frame);
  const frameMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uWrap: { value: 0 } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform float uT, uWrap; varying vec3 vW;
      void main(){ float a = atan(vW.z, vW.x); vec3 c = mix(mix(vec3(0.71, 1.0, 0.0), vec3(0.0, 0.9, 1.0), smoothstep(-2.4, 0.0, a)), vec3(1.0, 0.17, 0.84), smoothstep(0.0, 2.4, a));
        float dash = uWrap > 0.5 ? step(0.5, fract((vW.x + vW.z) * 0.9 - uT * 2.0)) : 1.0; if (dash < 0.5) discard; gl_FragColor = vec4(c * 1.35, 1.0); }` });
  for (const [w, d, x, z] of [[N + 0.4, 0.2, 0, -half - 0.6], [N + 0.4, 0.2, 0, half + 0.6], [0.2, N + 0.4, -half - 0.6, 0], [0.2, N + 0.4, half + 0.6, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), frameMat); b.position.set(x, 0.05, z); frame.add(b); }
  // maze blocks
  const wallMat = new THREE.MeshPhysicalMaterial({ color: 0x40084e, emissive: 0xff2bd6, emissiveIntensity: 0.14, roughness: 0.25, clearcoat: 1 });
  const capMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6).multiplyScalar(1.7) });
  const walls = new THREE.InstancedMesh(new K.RoundedBoxGeometry(0.9, 0.7, 0.9, 3, 0.1), wallMat, N * N), caps = new THREE.InstancedMesh(new K.RoundedBoxGeometry(0.7, 0.05, 0.7, 2, 0.02), capMat, N * N);
  walls.castShadow = true; walls.count = caps.count = 0; scene.add(walls, caps); let wallSig = "";
  // the dot
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaffb8).multiplyScalar(2.6) }));
  const dotGlow = K.glowSprite(0xb6ff00, 2.2, 1.4), dotLight = new THREE.PointLight(0xb6ff00, 10, 5, 2); scene.add(dot, dotGlow, dotLight);
  // the gold star and its countdown ring
  const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.2 : 0.46, a = (i / 10) * Math.PI * 2 - Math.PI / 2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 }), new THREE.MeshPhysicalMaterial({ color: 0xffd23f, metalness: 1, roughness: 0.2, emissive: 0xff9a00, emissiveIntensity: 0.5 }));
  star.geometry.center(); star.castShadow = true;
  const ringMat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 1 } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform float uK; varying vec3 vP; void main(){ float a = atan(vP.x, vP.y); a = (a < 0.0 ? a + 6.2831853 : a) / 6.2831853; if (a > uK) discard; gl_FragColor = vec4(vec3(1.0, 0.82, 0.25) * 3.0, 1.0); }" });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 72), ringMat); ring.rotation.x = -Math.PI / 2;
  const starLight = new THREE.PointLight(0xffb020, 8, 4, 2); scene.add(star, ring, starLight);
  // the snake: glossy beads, three to a cell
  const MAXB = N * N * 3 + 8;
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 }), MAXB);
  beads.castShadow = true; beads.count = 0; beads.frustumCulled = false; scene.add(beads);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0xeeeef6, roughness: 0.35 }), pupM = new THREE.MeshBasicMaterial({ color: 0x05030a });
  const eyes = [0, 1].map(() => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), eyeM), p = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), pupM); scene.add(e, p); return { e, p }; });
  const headLight = new THREE.PointLight(0x9aff20, 2.5, 6, 2); scene.add(headLight);
  // sparks
  const MAXP = 600, pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.28, map: K.softTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; scene.add(sparks);

  const post = K.post(renderer, scene, camera, { bloom: [0.42, 0.4, 0.92], vignette: 0.7, grain: 0.018 });
  let W = 0, H = 0, dpr = 1;
  const resize = () => { const b = S.box; if (b.W === W && b.H === H) return; W = b.W; H = b.H; dpr = Math.min(devicePixelRatio || 1, q === "high" ? 2 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); post.composer.setPixelRatio(dpr); post.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
  // camera: tilted over the board, framed on the 2D layout's board rectangle (so the words drawn on top land in place)
  const fit = (sx, sy) => {
    const b = S.box, tilt = THREE.MathUtils.degToRad(24), fov = THREE.MathUtils.degToRad(camera.fov);
    const d = ((N + 1.2) * H) / (2 * Math.tan(fov / 2) * Math.max(80, b.size));
    camera.position.set(sx, Math.cos(tilt) * d, Math.sin(tilt) * d + sy); camera.lookAt(sx, 0, sy);
    const cx = b.bx + b.size / 2, cy = b.by + b.size / 2; camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  };
  const tmpC = new THREE.Color();
  const colOf = (str) => tmpC.setStyle(str);
  const cellTo = (x, y) => V.set(x - half, 0, y - half);

  return {
    ok: true,
    screen(px, py) { const b = S.box; return this.project((px - b.bx) / b.cell - 0.5, (py - b.by) / b.cell - 0.5); },
    project(x, y) { V.set(x - half, 0.5, y - half).project(camera); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * H]; },
    render(f) {
      resize();
      const t = S.t, state = S.state, mode = S.mode, sk = S.shake || 0;
      fit((Math.random() - 0.5) * sk * 0.25, (Math.random() - 0.5) * sk * 0.25);
      frameMat.uniforms.uT.value = t; frameMat.uniforms.uWrap.value = mode === "wrap" ? 1 : 0;
      // maze blocks: rebuild when the set changes
      const wk = S.walls, sig = wk.size + ":" + [...wk].slice(0, 6).join(",");
      if (sig !== wallSig) { wallSig = sig; let k = 0; for (const c of wk) { const x = c % N, y = Math.floor(c / N); M.makeTranslation(x - half, 0.35, y - half); walls.setMatrixAt(k, M); M.makeTranslation(x - half, 0.71, y - half); caps.setMatrixAt(k, M); k++; }
        walls.count = caps.count = k; walls.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = true; }
      // the dot
      const food = S.food; dot.visible = dotGlow.visible = !!food; dotLight.intensity = food ? 10 : 0;
      if (food) { const g = Math.min(1, (t - (food.born || 0)) * 5), p = 1 + 0.12 * Math.sin(t * 6); cellTo(food.x, food.y); dot.position.set(V.x, 0.45, V.z); dot.scale.setScalar(g * p); dotGlow.position.copy(dot.position); dotGlow.scale.setScalar(2.2 * g); dotLight.position.set(V.x, 1.2, V.z); }
      // the star
      const bonus = S.bonus; star.visible = ring.visible = !!bonus; starLight.intensity = bonus ? 8 : 0;
      if (bonus) { const k = bonus.life / bonus.max, blink = k < 0.3 && Math.sin(t * 22) < 0; cellTo(bonus.x, bonus.y); star.visible = !blink; star.position.set(V.x, 0.75, V.z); star.rotation.set(-0.5, t * 1.5, 0); star.scale.setScalar(1.5);
        ring.position.set(V.x, 0.12, V.z); ringMat.uniforms.uK.value = k; starLight.position.set(V.x, 1.8, V.z); }
      // the snake
      const snake = S.snake, n = snake.length; let nb = 0;
      const dying = state === "dying", over = state === "over" && S.cause !== "win";
      if (n > 1 && !over) {
        const pts = S.bodyPoints(f), skin = S.skin, white = dying && S.deadT < 0.25 && S.cause !== "win";
        const popped = dying && S.cause !== "win" ? Math.max(0, Math.floor((S.deadT - 0.3) * Math.max(14, n * 1.6))) : 0;
        const segs = pts.length - 1, total = segs * 3;
        for (let s = 0; s <= total; s++) {
          const seg = Math.min(segs - 1, Math.floor(s / 3)), u0 = (s - seg * 3) / 3, a = pts[seg], b = pts[seg + 1];
          if (seg < popped) continue;
          let x = a[0] + (b[0] - a[0]) * u0, y = a[1] + (b[1] - a[1]) * u0;
          if (mode === "wrap") { x = ((x % N) + N) % N; y = ((y % N) + N) % N; if (x > N - 0.5) x -= N; if (y > N - 0.5) y -= N; }
          const u = s / Math.max(1, total); let w = 0.42 * (1 - u * 0.3);
          for (const bl of S.bulges) { const dd = s / 3 - (bl.i + f); w *= 1 + (bl.big ? 0.5 : 0.32) * Math.exp(-dd * dd * 0.9); }
          if (s === 0) w *= 1.32;
          cellTo(x, y); M.compose(V.set(V.x, w * 0.95, V.z), Q.identity(), SC.set(w, w * 0.9, w)); beads.setMatrixAt(nb, M);
          if (white) C.setRGB(1.6, 1.6, 1.6); else { colOf(S.bodyCol(skin, u, t)); C.copy(tmpC); if (s % 3 === 1) C.multiplyScalar(0.82); }
          beads.setColorAt(nb, C); nb++; if (nb >= MAXB) break;
        }
        // eyes on the head, looking where it's going
        const h = pts[0], nx = pts[1] ? h[0] - pts[1][0] : 1, ny = pts[1] ? h[1] - pts[1][1] : 0, len = Math.hypot(nx, ny) || 1, dx = nx / len, dy = ny / len;
        let hx = h[0], hy = h[1]; if (mode === "wrap") { hx = ((hx % N) + N) % N; hy = ((hy % N) + N) % N; }
        const showEyes = popped === 0; cellTo(hx, hy); const cx = V.x, cz = V.z;
        eyes.forEach((o, i) => { const sd = i ? 1 : -1; o.e.visible = o.p.visible = showEyes;
          o.e.position.set(cx + dx * 0.2 - dy * sd * 0.24, 0.78, cz + dy * 0.2 + dx * sd * 0.24); o.p.position.set(o.e.position.x + dx * 0.1, 0.84, o.e.position.z + dy * 0.1); });
        headLight.position.set(cx, 2.2, cz); headLight.color.copy(white ? C.setRGB(1, 1, 1) : colOf(S.bodyCol(skin, 0, t)));
      } else { eyes.forEach((o) => (o.e.visible = o.p.visible = false)); }
      beads.count = nb; beads.instanceMatrix.needsUpdate = true; if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
      // sparks from the game (board pixels to cells)
      const b = S.box, parts = S.parts; let k = 0;
      for (const p of parts) { if (k >= MAXP) break; const x = (p.x - b.bx) / b.cell - 0.5, y = (p.y - b.by) / b.cell - 0.5; pPos[k * 3] = x - half; pPos[k * 3 + 1] = 0.5; pPos[k * 3 + 2] = y - half;
        colOf(p.col); const a = Math.max(0, Math.min(1, p.life / p.max)) * 2; pCol[k * 3] = tmpC.r * a; pCol[k * 3 + 1] = tmpC.g * a; pCol[k * 3 + 2] = tmpC.b * a; k++; }
      pGeo.setDrawRange(0, k); pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true;
      post.render(1 / 60);
    },
  };
}
