// Glowline in 3D: the same arena and snakes in real 3D. Glossy bead snakes with eyes on a dark mirror floor, glowing
// light to eat, a red neon wall around the arena, bloom and a film grade. Loaded only when the graphics switch is on 3D.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

const U = 0.01;   // game units to metres
export function attach(S) {
  const q = K.tier(), WORLD = S.WORLD;
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05001a); scene.fog = new THREE.FogExp2(0x05001a, 0.02);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  scene.environment = K.cityEnv(renderer, { sky: [0.02, 0.01, 0.07], horizon: [0.35, 0.1, 0.5], windows: 0.5 });
  scene.add(new THREE.HemisphereLight(0x8a6aff, 0x100818, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(-10, 30, 10); scene.add(key, key.target);

  // the floor: a dark mirror with a faint neon grid; outside the wall it turns deep red
  const R = WORLD * U, floorMat = new THREE.ShaderMaterial({ uniforms: { uR: { value: R }, uFogC: { value: new THREE.Color(0x05001a) }, uFogD: { value: 0.02 }, uT: { value: 0 } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform float uR, uFogD, uT; uniform vec3 uFogC; varying vec3 vW;
      ${K.NOISE_GLSL}
      ${K.WET_GLSL}
      float grid(vec2 p){ vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(g.x, g.y), 1.0); }
      void main(){ vec2 p = vW.xz; float d = length(p);
        vec3 col = vec3(0.022, 0.012, 0.05) + vec3(0.5, 0.38, 1.0) * grid(p / 1.4) * 0.16;
        vec3 Vw = normalize(cameraPosition - vW); float fres = pow(1.0 - clamp(Vw.y, 0.0, 1.0), 2.0);
        float puddle = naPuddle(p * 2.0, 0.55);
        vec3 refl = naReflect(vW, (vec2(naNoise(p * 9.0 + uT), naNoise(p * 9.3 - uT)) - 0.5) * 0.006, mix(1.6, 0.0, puddle));
        col += refl * (0.1 + 0.22 * puddle) * (0.5 + 0.5 * fres);
        if (d > uR) col = mix(col, vec3(0.16, 0.0, 0.08), 0.7);
        float f = 1.0 - exp(-uFogD * uFogD * dot(vW - cameraPosition, vW - cameraPosition)); gl_FragColor = vec4(mix(col, uFogC, f), 1.0); }` });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R * 2 + 80, R * 2 + 80), floorMat); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const mir = K.mirror(renderer, { w: R * 2 + 80, d: R * 2 + 80, scale: q === "high" ? 0.45 : q === "medium" ? 0.3 : 0.22, hide: [floor] }); scene.add(mir.mesh);
  Object.assign(floorMat.uniforms, mir.uniforms);
  // the arena wall
  const wall = new THREE.Mesh(new THREE.TorusGeometry(R, 0.12, 10, 256), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2e4d).multiplyScalar(2.6) })); wall.rotation.x = Math.PI / 2; wall.position.y = 0.06; scene.add(wall);
  const wallGlow = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.9, 256, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: "varying float vY; void main(){ vY = position.y + 0.45; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying float vY; void main(){ gl_FragColor = vec4(vec3(1.0, 0.18, 0.3) * 0.5 * pow(1.0 - clamp(vY / 0.9, 0.0, 1.0), 2.0), 1.0); }" }));
  wallGlow.position.y = 0.45; scene.add(wallGlow);

  // light to eat: the Original's dot (a solid centre, a quick falloff, a soft rim of glow), composited normally so that
  // thousands of dots stay separate instead of adding up into a haze; the hot centre is bright enough for the bloom
  const MAXF = 4000, fPos = new Float32Array(MAXF * 3), fCol = new Float32Array(MAXF * 3), fSize = new Float32Array(MAXF), fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3)); fGeo.setAttribute("color", new THREE.BufferAttribute(fCol, 3)); fGeo.setAttribute("size", new THREE.BufferAttribute(fSize, 1));
  const fMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.NormalBlending, uniforms: { uScale: { value: 400 } },
    vertexShader: "attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(3.0, size * uScale / -mv.z); gl_Position = projectionMatrix * mv; }",
    fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
      float a = d < 0.18 ? mix(1.0, 0.92, d / 0.18) : d < 0.42 ? mix(0.92, 0.3, (d - 0.18) / 0.24) : 0.3 * pow(1.0 - (d - 0.42) / 0.58, 2.0);
      float core = 1.0 - smoothstep(0.08, 0.24, d);
      gl_FragColor = vec4(vC * (1.0 + 1.1 * core) + vec3(0.22) * core * core, a); }` });
  const foodPts = new THREE.Points(fGeo, fMat); foodPts.frustumCulled = false; scene.add(foodPts); mir.hide.push(foodPts);   // the floor reflects the snakes, not the dots (blurred dot reflections read as haze)

  // snakes: glossy beads, eyes with pupils
  const MAXB = q === "low" ? 5000 : 9000;
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }), MAXB);
  beads.count = 0; beads.frustumCulled = false; scene.add(beads);
  const eyesW = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf4f4ff, roughness: 0.3 }), 120);
  const eyesP = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x05030a }), 120);
  eyesW.count = eyesP.count = 0; eyesW.frustumCulled = eyesP.frustumCulled = false; scene.add(eyesW, eyesP);
  const headLight = new THREE.PointLight(0xffffff, 0, 6, 2); scene.add(headLight);

  const post = K.post(renderer, scene, camera, { bloom: [0.65, 0.18, 0.9], vignette: 0.7, grain: 0.012 });   // a tight bloom: crisp glows, no fog
  let W = 0, H = 0;
  const resize = (w, h) => { if (w === W && h === H) return; W = w; H = h; const dpr = Math.min(devicePixelRatio || 1, q === "high" ? 2 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); post.composer.setPixelRatio(dpr); post.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
  const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), C = new THREE.Color(), V2 = new THREE.Vector3();
  const TILT = THREE.MathUtils.degToRad(18);

  return {
    ok: true,
    project(x, y, h = 0) { V.set(x * U, h, y * U).project(camera); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * H]; },
    render(v) {
      resize(v.W, v.H);
      const t = S.t; floorMat.uniforms.uT.value = t;
      // camera: the same view the 2D game shows, from a little behind
      const span = (v.H / v.zoom) * U, fov = THREE.MathUtils.degToRad(camera.fov), d = span / (2 * Math.tan(fov / 2));
      const cx = v.camX * U, cz = v.camY * U;
      camera.position.set(cx, Math.cos(TILT) * d, cz + Math.sin(TILT) * d); camera.lookAt(cx, 0, cz);
      const fogD = 0.5 / Math.max(6, d); scene.fog.density = fogD; floorMat.uniforms.uFogD.value = fogD;
      fMat.uniforms.uScale.value = H * renderer.getPixelRatio() * 0.5 / Math.tan(fov / 2);   // gl_PointSize counts device pixels
      key.position.set(cx - 10, 30, cz + 10); key.target.position.set(cx, 0, cz);
      // food in view
      const pad = 200, x0 = v.x0 - pad, x1 = v.x1 + pad, y0 = v.y0 - pad, y1 = v.y1 + pad, FG = S.FG, FGN = S.FGN, grid = S.fgrid;
      const c0 = Math.max(0, Math.floor((x0 + WORLD) / FG)), c1 = Math.min(FGN - 1, Math.floor((x1 + WORLD) / FG)), r0 = Math.max(0, Math.floor((y0 + WORLD) / FG)), r1 = Math.min(FGN - 1, Math.floor((y1 + WORLD) / FG));
      let nf = 0;
      for (let r = r0; r <= r1 && nf < MAXF; r++) for (let c = c0; c <= c1 && nf < MAXF; c++) for (const f of grid[r * FGN + c]) { if (nf >= MAXF) break;
        const pulse = 1 + 0.14 * Math.sin(t * 3 + (f.ph || 0)); fPos[nf * 3] = f.x * U; fPos[nf * 3 + 1] = f.r * U * 1.2; fPos[nf * 3 + 2] = f.y * U;
        C.set(f.col); fCol[nf * 3] = C.r; fCol[nf * 3 + 1] = C.g; fCol[nf * 3 + 2] = C.b; fSize[nf] = f.r * U * 5.2 * pulse; nf++; }
      fGeo.setDrawRange(0, nf); fGeo.attributes.position.needsUpdate = fGeo.attributes.color.needsUpdate = fGeo.attributes.size.needsUpdate = true;
      // snakes in view, smallest first
      let nb = 0, ne = 0; const me = S.me;
      const order = S.snakes.filter((s) => s.alive).sort((a, b) => a.mass - b.mass);
      for (const s of order) {
        const p = s.pts, n = p.length, r = s.r; if (!n) continue;
        let vis = false; for (let i = 0; i < n; i += 6) { const qq = p[i]; if (qq.x > x0 - r && qq.x < x1 + r && qq.y > y0 - r && qq.y < y1 + r) { vis = true; break; } } if (!vis) continue;
        const step = Math.max(1, Math.round((r * 0.5) / Math.max(1e-3, s.gap)));
        for (let i = n - 1; i >= 0 && nb < MAXB; i -= (i > step ? step : 1)) {
          const pt = p[i]; if (pt.x < x0 - r || pt.x > x1 + r || pt.y < y0 - r || pt.y > y1 + r) continue;
          const u = i / n, rr = (i === 0 ? r * 1.1 : u > 0.7 ? r * (1 - ((u - 0.7) / 0.3) * 0.38) : r) * U;
          M.compose(V.set(pt.x * U, rr, pt.y * U), Q.identity(), SC.set(rr, rr * 0.92, rr)); beads.setMatrixAt(nb, M);
          C.setStyle(S.skinCol(s.skin, i, n, t)); if ((i / step) % 3 < 1) C.multiplyScalar(0.8); beads.setColorAt(nb, C); nb++;
          if (i === 0) break;
        }
        // eyes looking where it's heading
        if (ne < 118) { const ca = Math.cos(s.a), sa = Math.sin(s.a), look = s.ta, er = r * 0.34 * U, ru = r * U;
          for (const side of [-1, 1]) { const ex = s.x * U + ca * ru * 0.36 - sa * side * ru * 0.46, ez = s.y * U + sa * ru * 0.36 + ca * side * ru * 0.46;
            M.compose(V.set(ex, ru * 1.55, ez), Q.identity(), SC.set(er, er, er)); eyesW.setMatrixAt(ne, M);
            M.compose(V.set(ex + Math.cos(look) * er * 0.45, ru * 1.55 + er * 0.55, ez + Math.sin(look) * er * 0.45), Q.identity(), SC.set(er * 0.56, er * 0.56, er * 0.56)); eyesP.setMatrixAt(ne, M); ne++; } }
        if (s === me) { headLight.intensity = 2.2; headLight.color.setStyle(S.skinCol(s.skin, 0, n, t)); headLight.position.set(s.x * U, r * U * 4, s.y * U); headLight.distance = r * U * 14; }
      }
      if (!me || !me.alive) headLight.intensity = 0;
      beads.count = nb; beads.instanceMatrix.needsUpdate = true; if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
      eyesW.count = eyesP.count = ne; eyesW.instanceMatrix.needsUpdate = eyesP.instanceMatrix.needsUpdate = true;
      post.render(1 / 60);
    },
  };
}
