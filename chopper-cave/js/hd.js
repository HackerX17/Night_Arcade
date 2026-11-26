// Chopper Cave in 3D: the same cave in real 3D. Rock walls with depth (Poly Haven rock, CC0) lit by neon crystals and the
// level's colours, glowing edges where you can crash, a modelled helicopter with a turning rotor and a searchlight,
// 3D power-ups and portals, the shield bubble, sparks, bloom and a film grade. Hyperspace keeps its own look.
// Loaded only when the graphics switch is on 3D.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

const U = 1 / 40;
export function attach(S) {
  const VW = S.VW, VH = S.VH, COL = S.COL, q = K.tier();
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05010c); scene.fog = new THREE.FogExp2(0x07020f, 0.035);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 200);
  scene.environment = K.cityEnv(renderer, { sky: [0.02, 0.01, 0.06], horizon: [0.2, 0.08, 0.35], windows: 0.3 });
  const hemi = new THREE.HemisphereLight(0x8a6ad0, 0x201030, 0.55); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xb0a0ff, 0.9); fill.position.set(-4, 3, 10); scene.add(fill);
  const X = (x) => (x - VW / 2) * U, Y = (y) => (VH / 2 - y) * U, col3 = (c, k = 1) => new THREE.Color(c[0] / 255 * k, c[1] / 255 * k, c[2] / 255 * k);

  // rock: ceiling and floor as surfaces running back into the dark (their front edge is exactly the game's wall)
  const rock = K.pbr("rock_face", { repeat: [1, 1], color: 0x8a7f9a, roughness: 1 }); rock.side = THREE.DoubleSide;
  const ND = 9, Z = [0.9, 0.0, -0.4, -1.0, -1.8, -2.8, -4.0, -5.4, -7.0];
  const surf = (top) => { const n = 80 * 2 * ND, geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const idx = []; for (let c = 0; c < 80 * 2 - 1; c++) for (let j = 0; j < ND - 1; j++) { const a = c * ND + j, b = (c + 1) * ND + j; top ? idx.push(a, b, a + 1, b, b + 1, a + 1) : idx.push(a, a + 1, b, b, a + 1, b + 1); }
    geo.setIndex(idx); const m = new THREE.Mesh(geo, rock); m.frustumCulled = false; scene.add(m); return m; };
  const ceil = surf(true), flo = surf(false);
  const rough = (x, z) => 0.18 * Math.sin(x * 1.7 + z * 0.9) + 0.1 * Math.sin(x * 3.1 - z * 2.3) + 0.06 * Math.sin(x * 5.3 + z * 4.1) + 0.14 * Math.sin(z * 0.8 + x * 0.3);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), K.pbr("rock_face", { repeat: [8, 3], color: 0x2a2238 })); back.position.z = -7.2; scene.add(back);
  // the glowing edges where the walls are
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff }), edgeN = 80 * 2;
  const edgeLine = (top) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edgeN * 3), 3)); const l = new THREE.Line(g, edgeMat); l.frustumCulled = false; scene.add(l); return l; };
  const eTop = edgeLine(true), eBot = edgeLine(false);
  // pillars
  const pillarMat = K.pbr("rock_face", { repeat: [0.5, 1], color: 0x6a5f7a }), pillarEdge = new THREE.LineBasicMaterial({ color: 0xffffff });
  const pillars = [];
  // neon crystals growing out of the rock, anchored to the cave as it scrolls
  const crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshPhysicalMaterial({ roughness: 0.12, metalness: 0.1, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0.0 }), 90);
  crystals.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n #if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )\n totalEmissiveRadiance = vColor * 1.4;\n #endif"); };
  crystals.frustumCulled = false; scene.add(crystals);
  const cry = [], lights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 9, 2); scene.add(l); return l; });
  let cryNext = 0;
  // the helicopter
  const heli = new THREE.Group(); scene.add(heli);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x3a2aa8, metalness: 0.25, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15161c, metalness: 0.7, roughness: 0.4 }), neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e5ff).multiplyScalar(2.6) });
  const hk = 0.2; const H = new THREE.Group(); H.scale.setScalar(hk); heli.add(H);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), paint); body.scale.set(1.7, 1.0, 0.95); H.add(body);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x0a1830, metalness: 0.2, roughness: 0.03, clearcoat: 1, emissive: 0x00a0c0, emissiveIntensity: 0.45 }));
  canopy.rotation.z = -Math.PI / 2 + 0.5; canopy.position.set(0.75, 0.25, 0); canopy.scale.set(1, 1.1, 1); H.add(canopy);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.5, 3.6, 18), paint); boom.rotation.z = Math.PI / 2; boom.position.set(-2.9, 0.25, 0); H.add(boom);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 0.02), neon); stripe.position.set(-2.6, 0.18, 0.34); stripe.rotation.z = -0.07; H.add(stripe);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.08), paint); fin.position.set(-4.4, 0.7, 0); fin.rotation.z = -0.35; H.add(fin);
  const trot = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); trot.position.set(-4.5, 0.75, 0.12); H.add(trot);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 10), dark); mast.position.set(0, 1.15, 0); H.add(mast);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 40), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.set(0, 1.4, 0); H.add(disc);
  const blades = new THREE.Group(); blades.position.set(0, 1.41, 0); H.add(blades);
  for (const a of [0, Math.PI]) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.03, 0.22), dark); b.position.set(Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75); b.rotation.y = -a; blades.add(b); }
  for (const z of [-0.6, 0.6]) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), dark); sk.rotation.z = Math.PI / 2; sk.position.set(0, -1.05, z); H.add(sk);
    for (const x of [-0.6, 0.6]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), dark); st.position.set(x, -0.8, z); H.add(st); } }
  const trim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.025, 6, 48, Math.PI * 1.2), neon); trim.scale.set(1.7, 0.95, 1); trim.position.z = 0.6; trim.rotation.z = Math.PI * 0.9; H.add(trim);
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff1a3a).multiplyScalar(5) })); navL.position.set(-4.6, 1.2, 0); H.add(navL);
  const search = new THREE.SpotLight(0xdff2ff, 40, 9, 0.38, 0.55, 2); search.position.set(1.6 * hk, -0.3 * hk, 0); search.target.position.set(4, -1.2, 0); heli.add(search, search.target);
  const beam = K.beam(0xdff2ff, 2.2, 0.55, 0.07); beam.position.set(1.7 * hk, -0.35 * hk, 0); beam.rotation.z = Math.PI / 2 + 0.3; heli.add(beam);
  const heliGlow = new THREE.PointLight(0x50beff, 2.5, 3, 2); heliGlow.position.set(0, 0.2, 0.6); heli.add(heliGlow);
  const shieldMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 1 } },
    vertexShader: "varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform float uA; varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(vec3(0.0, 0.9, 1.0) * (0.08 + f * 1.4) * uA, 1.0); }" });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), shieldMat); shield.scale.set(36 * U, 22 * U, 22 * U); scene.add(shield);
  // power-ups: a glowing hexagon with its icon; portals: a swirling gate
  const pickPool = {}, pickUsed = {}, iconTex = {};
  const icon = (type, c) => iconTex[type] || (iconTex[type] = (() => { const cvx = document.createElement("canvas"); cvx.width = cvx.height = 64; const g = cvx.getContext("2d"); g.strokeStyle = g.fillStyle = "#fff"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); const x = 32, y = 32;
    if (type === "shield") { g.moveTo(x, y - 14); g.lineTo(x + 12, y - 9); g.lineTo(x + 10, y + 4); g.quadraticCurveTo(x + 6, y + 12, x, y + 16); g.quadraticCurveTo(x - 6, y + 12, x - 10, y + 4); g.lineTo(x - 12, y - 9); g.closePath(); }
    else if (type === "wide") { g.moveTo(x, y - 16); g.lineTo(x, y + 16); g.moveTo(x - 8, y - 8); g.lineTo(x, y - 16); g.lineTo(x + 8, y - 8); g.moveTo(x - 8, y + 8); g.lineTo(x, y + 16); g.lineTo(x + 8, y + 8); }
    else { g.arc(x, y, 14, 0, Math.PI * 2); g.moveTo(x, y); g.lineTo(x, y - 10); g.moveTo(x, y); g.lineTo(x + 8, y + 2); }
    g.stroke(); const t = new THREE.CanvasTexture(cvx); t.colorSpace = THREE.SRGBColorSpace; return t; })());
  const swirlMat = new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { uT: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform float uT; varying vec2 vUv; void main(){ float r = length(vUv) * 2.0, a = atan(vUv.y, vUv.x); float s = 0.5 + 0.5 * sin(a * 5.0 - r * 14.0 + uT * 4.0); vec3 c = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.2, 0.9), s) * (1.0 - r) * 1.7; gl_FragColor = vec4(c * step(r, 1.0), 1.0); }" });
  const takePick = (type) => { const pool = pickPool[type] || (pickPool[type] = []), u = pickUsed[type] || 0; let g = pool[u];
    if (!g) { const c = S.PICK[type].col; g = new THREE.Group();
      if (type === "portal") { g.add(new THREE.Mesh(new THREE.TorusGeometry(17 * U, 0.04, 10, 60), new THREE.MeshBasicMaterial({ color: col3(c, 2.6) }))); g.add(new THREE.Mesh(new THREE.CircleGeometry(16 * U, 48), swirlMat)); }
      else { const hex = new THREE.Mesh(new THREE.TorusGeometry(15 * U, 0.035, 8, 6), new THREE.MeshBasicMaterial({ color: col3(c, 2.6) })); hex.name = "hex"; g.add(hex);
        const core = new THREE.Mesh(new THREE.SphereGeometry(9 * U, 20, 14), new THREE.MeshPhysicalMaterial({ color: col3(c, 0.4), emissive: col3(c), emissiveIntensity: 0.5, roughness: 0.1, clearcoat: 1 })); g.add(core);
        const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon(type), transparent: true, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) })); ic.scale.setScalar(0.42); ic.position.z = 0.25; g.add(ic); }
      const l = new THREE.PointLight(col3(c), 3, 2.5, 2); l.position.z = 0.5; g.add(l); scene.add(g); pool[u] = g; }
    pickUsed[type] = u + 1; g.visible = true; return g; };
  // trail and sparks
  const MAXG = 900, gPos = new Float32Array(MAXG * 3), gCol = new Float32Array(MAXG * 3), gSize = new Float32Array(MAXG), gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3)); gGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3)); gGeo.setAttribute("size", new THREE.BufferAttribute(gSize, 1));
  const gMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTex: { value: K.softTexture() }, uScale: { value: 400 } },
    vertexShader: "attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform sampler2D uTex; varying vec3 vC; void main(){ gl_FragColor = vec4(vC * texture2D(uTex, gl_PointCoord).a, 1.0); }" });
  const glows = new THREE.Points(gGeo, gMat); glows.frustumCulled = false; scene.add(glows);

  const post = K.post(renderer, scene, camera, { bloom: [0.55, 0.45, 0.88], vignette: 0.75, grain: 0.02 });
  let W = 0, Hh = 0;
  const resize = (w, h) => { if (w === W && h === Hh) return; W = w; Hh = h; const dpr = Math.min(devicePixelRatio || 1, q === "high" ? 2 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, Hh, false); post.composer.setPixelRatio(dpr); post.setSize(W, Hh); camera.aspect = W / Hh; camera.updateProjectionMatrix(); };
  const fit = (L) => { const fov = THREE.MathUtils.degToRad(camera.fov), d = (VH * U * Hh) / (2 * Math.tan(fov / 2) * Math.max(60, VH * L.S));
    camera.position.set(0, 0, d); camera.lookAt(0, 0, 0); const cx = L.OX + (VW * L.S) / 2, cy = L.OY + (VH * L.S) / 2; camera.setViewOffset(W, Hh, W / 2 - cx, Hh / 2 - cy, W, Hh); camera.updateMatrixWorld();
    gMat.uniforms.uScale.value = Hh * 0.5 / Math.tan(fov / 2); };
  const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color();
  let ng = 0; const glow = (x, y, z, c, size) => { if (ng >= MAXG) return; gPos[ng * 3] = x; gPos[ng * 3 + 1] = y; gPos[ng * 3 + 2] = z; gCol[ng * 3] = c.r; gCol[ng * 3 + 1] = c.g; gCol[ng * 3 + 2] = c.b; gSize[ng] = size; ng++; };

  return {
    ok: true,
    project(x, y) { V.set(X(x), Y(y), 0).project(camera); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * Hh]; },
    render(t) {
      const L = S.layout; resize(L.W, L.H); fit(L);
      const P = S.P, cols = S.cols, scroll = S.scroll, dist = S.dist || 0, state = S.state; ng = 0;
      // the level's colours
      const A = col3(P.a), S2 = col3(P.s2), C0 = col3(P.c0); scene.background.copy(col3(P.s0, 0.45)); scene.fog.color.copy(col3(P.s0, 0.5));
      rock.color.copy(C0).multiplyScalar(1.4).lerp(new THREE.Color(0x8a7f9a), 0.5); rock.emissive.copy(C0).multiplyScalar(0.22); edgeMat.color.copy(A).multiplyScalar(3); pillarEdge.color.copy(S2).multiplyScalar(3);
      // walls
      const n = Math.min(80, cols.length);
      for (const [mesh, line, top] of [[ceil, eTop, true], [flo, eBot, false]]) {
        const pos = mesh.geometry.attributes.position.array, uv = mesh.geometry.attributes.uv.array, ep = line.geometry.attributes.position.array;
        let v = 0, e = 0;
        for (let c = 0; c < 80; c++) for (let s = 0; s < 2; s++) {
          const ci = Math.min(c, n - 1), col = cols[ci], gx = c * COL - scroll + s * COL, gy = col ? (top ? S.wallTop(col) : S.wallBot(col)) : (top ? 0 : VH);
          const x = X(gx), y0 = Y(gy), ax = (gx + dist) * U;
          for (let j = 0; j < ND; j++) { const z = Z[j], k = z > 0 ? z * 6 : 0, back = z < 0 ? -z : 0;
            const y = top ? y0 + rough(ax, z) * (back > 0.2 ? 1 : back * 5) + k + back * back * 0.04 : y0 - rough(ax + 7, z) * (back > 0.2 ? 1 : back * 5) - k - back * back * 0.04;
            pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; uv[v * 2] = ax * 0.35; uv[v * 2 + 1] = z * 0.35 + (top ? 0.5 : 0); v++; }
          ep[e * 3] = x; ep[e * 3 + 1] = y0; ep[e * 3 + 2] = 0.02; e++;
        }
        mesh.geometry.attributes.position.needsUpdate = mesh.geometry.attributes.uv.needsUpdate = true; mesh.geometry.computeVertexNormals();
        line.geometry.attributes.position.needsUpdate = true; line.geometry.setDrawRange(0, n * 2);
      }
      // pillars
      const bl = S.blocks || [];
      bl.forEach((b0, i) => { let p = pillars[i]; if (!p) { p = pillars[i] = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), pillarMat); const ed = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), pillarEdge); p.add(box, ed); scene.add(p); }
        const b = S.blockBox(b0); p.visible = true; p.position.set(X(b.x + b.w / 2), Y(b.y + b.h / 2), -0.25); p.scale.set(b.w * U, b.h * U, 1.1); });
      for (let i = bl.length; i < pillars.length; i++) pillars[i].visible = false;
      // crystals: spawn ahead as the cave scrolls, drop the ones left behind
      while (cryNext < dist + VW + 200) { cryNext += 18 + Math.random() * 46; cry.push({ ax: cryNext, top: Math.random() < 0.5, z: -0.2 - Math.random() * 2.6, s: 0.12 + Math.random() * 0.22, rot: Math.random() * 3, tilt: (Math.random() - 0.5) * 0.7, k: Math.floor(Math.random() * 3) }); }
      while (cry.length && cry[0].ax < dist - 80) cry.shift();
      let nc = 0, li = 0; const kc = [A, S2, col3(P.b)];
      for (const c of cry) { if (nc >= 90) break; const gx = c.ax - dist; if (gx < -60 || gx > VW + 60) continue; const ci = Math.floor((gx + scroll) / COL), col = cols[Math.max(0, Math.min(n - 1, ci))]; if (!col) continue;
        const gy = c.top ? S.wallTop(col) : S.wallBot(col), back = -c.z, y = Y(gy) + (c.top ? rough(c.ax * U, c.z) + back * back * 0.04 : -rough(c.ax * U + 7, c.z) - back * back * 0.04);
        E.set(c.top ? Math.PI : 0, c.rot, c.tilt); M.compose(V.set(X(gx), y + (c.top ? -c.s * 1.2 : c.s * 1.2), c.z), Q.setFromEuler(E), SC.set(c.s * 0.55, c.s * 2.2, c.s * 0.55)); crystals.setMatrixAt(nc, M);
        crystals.setColorAt(nc, C.copy(kc[c.k]).multiplyScalar(0.9)); nc++;
        if (li < 3 && c.z > -1.6 && gx > 40 && gx < VW - 40 && (nc % 4 === 1)) { const l = lights[li++]; l.position.set(X(gx), y + (c.top ? -0.5 : 0.5), c.z + 0.4); l.color.copy(kc[c.k]); l.intensity = 11; } }
      for (; li < 3; li++) lights[li].intensity = 0;
      crystals.count = nc; crystals.instanceMatrix.needsUpdate = true; if (crystals.instanceColor) crystals.instanceColor.needsUpdate = true;
      // the helicopter
      const h = S.heli, showH = state !== "dead" || S.deadT < 0.05, blink = S.grace > 0 && !S.powers.shield && Math.sin(t * 30) < -0.6;
      heli.visible = !!h && showH && !blink;
      if (h) { heli.position.set(X(S.HELI_X), Y(h.y), 0.05); heli.rotation.set(0, 0, -h.tilt); blades.rotation.y = t * 38; trot.rotation.z = t * 50; navL.visible = Math.sin(t * 9) > 0; heliGlow.color.copy(A); }
      const shOn = !!h && state === "play" && (S.powers.shield || S.grace > 0) && !(S.grace > 0 && !S.powers.shield && Math.sin(t * 30) < 0);
      shield.visible = shOn; if (shOn) { shield.position.copy(heli.position); shieldMat.uniforms.uA.value = 0.75 + 0.25 * Math.sin(t * 6); }
      // power-ups
      for (const k in pickUsed) pickUsed[k] = 0;
      for (const qp of S.pickups || []) { const g = takePick(qp.type), bob = Math.sin(qp.ph * 3) * 3; g.position.set(X(qp.x), Y(qp.y + bob), 0.1); const hx = g.getObjectByName("hex"); if (hx) hx.rotation.z = qp.ph * 0.6; }
      for (const k in pickPool) for (let i = pickUsed[k] || 0; i < pickPool[k].length; i++) pickPool[k][i].visible = false;
      swirlMat.uniforms.uT.value = t;
      // trail and sparks
      for (const s of S.trail || []) { const r = 2 + (1 - s.life) * 6; if (s.hue != null) C.setHSL(s.hue / 360, 1, 0.65); else C.copy(s.up ? A : S2); C.multiplyScalar(s.life * 0.7); glow(X(s.x), Y(s.y), 0, C, r * 2.4 * U); }
      for (const s of S.sparks || []) { if (s.col) C.copy(col3(s.col)); else C.copy(s.life > 0.7 ? new THREE.Color(1, 1, 1) : s.life > 0.35 ? A : S2); C.multiplyScalar(Math.min(1, s.life * 1.6) * 1.5); glow(X(s.x), Y(s.y), 0.1, C, 7 * U); }
      gGeo.setDrawRange(0, ng); gGeo.attributes.position.needsUpdate = gGeo.attributes.color.needsUpdate = gGeo.attributes.size.needsUpdate = true;
      post.grade.uniforms.flash.value = Math.min(0.55, (S.flash || 0) * 0.55 * (window.ARCADE_CALM ? 0.15 : 1));
      post.render(1 / 60);
    },
  };
}
