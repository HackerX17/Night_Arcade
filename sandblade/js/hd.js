// Sandblade in 3D: the same ride over the neon dune islands, which now stand in a night sea that mirrors them.
// Every island keeps its own colours and pattern on real dunes (sand grain, wind ripples, surf at the waterline) under a
// glowing crest rail; a 3D masked rider on a gold blade follows the game's own rig (poses, squash, cloak and scarf);
// crystal shards, glossy power-ups, the ramp chevrons and the island gate in neon; the storm, whose lightning lights up
// the dunes and the sea; a city on the far shore, the moon (the storm eclipses it), bloom and a film grade.
// The camera is fitted so the riding line matches the 2D layer, which keeps the speed lines, the landing marker and
// the pop-ups. Loaded only when the graphics switch is on 3D.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";
import { mergeGeometries } from "../../shared/na3d/addons/utils/BufferGeometryUtils.js";

const U = 1 / 40;                                         // game units -> metres
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const v = i / 255; LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
const lin = (v) => LIN[v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v)];
const PAT = { bands: 0, dots: 1, stripes: 2, grid: 3, chevrons: 4, zigzag: 5 };
// a sine-free hash, so noise stays clean a million units out along the islands
const HASH_GLSL = `float sbH(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float sbN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sbH(i), sbH(i + vec2(1.0, 0.0)), u.x), mix(sbH(i + vec2(0.0, 1.0)), sbH(i + vec2(1.0, 1.0)), u.x), u.y); }
float sbF(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * sbN(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }`;

export function attach(S) {
  const q = K.tier();
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) { renderer.dispose(); throw new Error("3D mode needs WebGL 2"); }
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x2b0a7a, 70, 1100);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 2600);
  scene.environment = K.cityEnv(renderer, { sky: [0.02, 0.01, 0.07], horizon: [0.45, 0.12, 0.5] });
  const X = (x) => x * U, Y = (y) => -y * U, waterY = Y(S.WATER_Y), YB = Y(S.WATER_Y + 40);
  const attr = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const touch = (a, n) => { if (a.clearUpdateRanges) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n)); } a.needsUpdate = true; };
  const col = (h) => new THREE.Color(h);
  const hexCache = new Map(), hex = (h) => { let c = hexCache.get(h); if (!c) { c = S.hexRgb(h); hexCache.set(h, c); } return c; };
  const rgbStr = new Map(), rgbOf = (s) => { let c = rgbStr.get(s); if (!c) { const m = s.match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/); c = m ? [lin(+m[1]), lin(+m[2]), lin(+m[3])] : [1, 1, 1]; rgbStr.set(s, c); } return c; };

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight(0x8a7aff, 0x1a0830, 0.5); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2f2, 1.1); scene.add(key, key.target);          // moonlight over the camera's shoulder
  const rim = new THREE.DirectionalLight(0x8fe9ff, 0.8); scene.add(rim, rim.target);          // a cold rim from the moon's side
  const boardL = new THREE.PointLight(0x66e8ff, 0, 7, 2); scene.add(boardL);
  const boltL = new THREE.PointLight(0xd29cff, 0, 90, 1.5); scene.add(boltL);
  const pickL = [0, 1].map(() => { const l = new THREE.PointLight(0xffffff, 0, 6, 2); scene.add(l); return l; });

  // ---------- sky, stars and the moon ----------
  const skyU = { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uT: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: skyU,
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 uTop, uMid, uGlow; uniform float uT; varying vec3 vP; ${HASH_GLSL}
      void main(){ float y = vP.y; vec3 c = mix(uGlow, uMid, smoothstep(0.0, 0.17, y)); c = mix(c, uTop, smoothstep(0.17, 0.62, y)); c = mix(c, uMid * 0.6, smoothstep(0.0, -0.15, y));
        vec2 sp = vec2(atan(vP.z, vP.x), asin(clamp(y, -1.0, 1.0))) * 230.0; vec2 cell = floor(sp); float h = sbH(cell);
        float star = step(0.9975, h) * smoothstep(0.06, 0.32, y) * (0.35 + 0.65 * abs(sin(uT * 1.5 + h * 70.0))) * smoothstep(0.5, 0.12, length(fract(sp) - 0.5));
        // neon wind streaks drifting down the sky, as in the 2D sky
        vec2 w2 = vec2(atan(vP.x, -vP.z), asin(clamp(y, -1.0, 1.0))) * 9.0 + vec2(uT * 0.11, uT * 0.23);
        vec2 ci = floor(w2), cf = fract(w2) - 0.5; float hs = sbH(ci + 31.7), streak = 0.0;
        if (hs > 0.74) { vec2 dir = normalize(vec2(-0.35, -1.0)), o = cf - (vec2(sbH(ci + 5.1), sbH(ci + 9.3)) - 0.5) * 0.4;
          float along = dot(o, dir), across = abs(o.x * dir.y - o.y * dir.x), L = 0.18 + 0.25 * sbH(ci + 2.2), fw = fwidth(across) * 1.2 + 0.002;
          streak = (1.0 - smoothstep(0.008, 0.008 + fw, across)) * (1.0 - smoothstep(L * 0.55, L, abs(along))) * smoothstep(0.0, 0.25, y + 0.03); }
        gl_FragColor = vec4(c + vec3(star) * 1.4 + vec3(0.5, 0.99, 1.0) * streak * 0.32, 1.0); }` }));
  sky.renderOrder = -100; sky.frustumCulled = false; scene.add(sky);
  const moonU = { uEcl: { value: 0 } };
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ fog: false, uniforms: moonU,
    vertexShader: "varying vec3 vN; varying vec2 vL; void main(){ vN = normalize(normalMatrix * normal); vL = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uEcl; varying vec3 vN; varying vec2 vL; ${HASH_GLSL}
      void main(){ vec3 c = vec3(0.89, 0.87, 1.0) * 0.98;
        float cr = smoothstep(0.19, 0.15, length(vL - vec2(-0.3, 0.2))) + smoothstep(0.25, 0.21, length(vL - vec2(0.25, -0.1))) + smoothstep(0.13, 0.1, length(vL - vec2(-0.1, -0.4))) + smoothstep(0.11, 0.08, length(vL - vec2(0.35, 0.35)));
        c = mix(c, vec3(0.4, 0.36, 0.79) * 1.2, clamp(cr, 0.0, 1.0) * 0.38) * (0.88 + 0.24 * sbF(vL * 6.0 + 3.0));
        c *= 0.72 + 0.28 * pow(max(vN.z, 0.0), 0.4);
        float sh = smoothstep(1.04, 0.99, length(vL - vec2(-2.0 + 2.0 * uEcl, 0.0)));
        gl_FragColor = vec4(mix(c, vec3(0.03, 0.0, 0.06), 0.92 * uEcl * sh), 1.0); }` }));
  moon.frustumCulled = false; scene.add(moon);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: "varying vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec2 vU; void main(){ float r = length(vU); float a = pow(max(0.0, 1.0 - r), 2.2); vec3 c = mix(vec3(0.25, 0.95, 1.0), vec3(1.0, 0.03, 0.7), smoothstep(0.25, 0.9, r)); gl_FragColor = vec4(c * a * 0.32, 1.0); }" }));
  halo.frustumCulled = false; scene.add(halo);

  // ---------- the sea: a real planar reflection with ripples, neon glints and the horizon haze ----------
  const waterU = { uDeep: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uT: { value: 0 }, uFogC: { value: new THREE.Color() }, uFogN: { value: 70 }, uFogF: { value: 1100 } };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3600).rotateX(-Math.PI / 2), null);
  const mir = q !== "low" ? K.mirror(renderer, { w: 10, d: 10, y: waterY, scale: q === "high" ? 0.5 : 0.32, hide: [water] }) : null;
  Object.assign(waterU, mir ? mir.uniforms : { tMirror: { value: null }, uMirrorMat: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 } });
  if (mir) scene.add(mir.mesh);
  water.material = new THREE.ShaderMaterial({ uniforms: waterU, fog: false,
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform vec3 uDeep, uMid, uGlow, uFogC; uniform float uT, uFogN, uFogF; varying vec3 vW;
      ${HASH_GLSL}
      ${K.NOISE_GLSL}
      ${K.WET_GLSL}
      void main(){ vec3 V = cameraPosition - vW; float dist = length(V); V /= dist; float ct = clamp(V.y, 0.0, 1.0);
        float fres = 0.05 + 0.95 * pow(1.0 - ct, 4.0);
        vec2 p = vec2(mod(vW.x, 2048.0), vW.z);
        vec2 nrm = vec2(sbN(p * vec2(0.3, 1.1) + vec2(uT * 0.22, 0.0)), sbN(p * vec2(0.45, 1.5) - vec2(0.0, uT * 0.18))) - 0.5;
        vec3 refl = naReflect(vW, nrm * 0.03 * (1.0 - smoothstep(60.0, 500.0, dist)), 0.6);
        vec3 base = mix(uMid * 0.55, uDeep * 0.5, smoothstep(0.0, 0.5, ct));
        vec3 c = mix(base, refl, clamp(fres, 0.0, 0.9));
        float st = smoothstep(0.78, 0.96, sbN(vec2(p.x * 0.5 - uT * 0.55, p.y * 2.8))) * (1.0 - smoothstep(25.0, 200.0, dist));
        c += vec3(0.5, 0.96, 1.0) * st * 0.22 + uGlow * 0.04;
        c = mix(c, uFogC, smoothstep(uFogN, uFogF, dist));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  water.frustumCulled = false; scene.add(water);

  // ---------- the city on the far shore: two rows of towers with lit windows, roof neon and blinking aerials ----------
  let seedC = 17; const rnd = () => { seedC = (seedC * 16807) % 2147483647; return seedC / 2147483647; };
  const cityLayer = (n, z, span, w0, w1, h0, h1, cell, winK) => {
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const aB = new Float32Array(n * 4), B = [];
    for (let i = 0; i < n; i++) { const w = w0 + rnd() * (w1 - w0), h = (h0 + rnd() * (h1 - h0)) * (rnd() < 0.14 ? 1.55 : 1);
      B.push({ bx: (i + rnd() * 0.4) / n * span, w, h, d: w * (0.6 + rnd() * 0.6), s: rnd() }); aB[i * 4] = B[i].s; aB[i * 4 + 1] = h; aB[i * 4 + 2] = i % 5; aB[i * 4 + 3] = rnd(); }
    geo.setAttribute("aB", new THREE.InstancedBufferAttribute(aB, 4));
    const u = { uBase: { value: waterY }, uCell: { value: new THREE.Vector2(cell[0], cell[1]) }, uWinK: { value: winK } };
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a0b55, roughness: 0.85, metalness: 0.1, envMapIntensity: 0.15 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 aB; varying vec3 vWS, vNS, vLoc; varying vec4 vB;")
        .replace("#include <project_vertex>", "#include <project_vertex>\n vWS = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vNS = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal); vB = aB; vLoc = position;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vWS, vNS, vLoc; varying vec4 vB; uniform float uBase, uWinK; uniform vec2 uCell;\n${HASH_GLSL}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          vec3 nS = normalize(vNS); float side = 1.0 - step(0.5, abs(nS.y));
          float uu = abs(nS.x) > 0.5 ? vWS.z : mod(vWS.x, 2048.0), hy = vWS.y - uBase;
          vec2 g = vec2(uu, hy) / uCell, cl = floor(g), f = fract(g);
          float win = side * step(0.24, f.x) * step(f.x, 0.72) * step(0.27, f.y) * step(f.y, 0.74) * step(uCell.y, hy) * step(hy, vB.y - uCell.y * 0.6);
          float hh = sbH(cl + vB.x * 131.0), lit = step(0.56, hh);
          vec3 neon = vB.z < 0.5 ? vec3(0.0, 0.87, 1.0) : vB.z < 1.5 ? vec3(1.0, 0.03, 0.68) : vB.z < 2.5 ? vec3(0.2, 1.0, 0.04) : vB.z < 3.5 ? vec3(1.0, 0.75, 0.07) : vec3(0.25, 0.2, 1.0);
          vec3 wc = hh > 0.86 ? neon * 1.4 : vec3(1.0, 0.84, 0.6);
          float roof = side * (1.0 - smoothstep(0.0, uCell.y * 0.3, abs(hy - vB.y + uCell.y * 0.18)));
          // a neon sign on some fronts: an outline with a bar inside, like the 2D city's
          float sy0 = vB.y * 0.3, sh0 = uCell.y * 1.15, front = step(0.5, nS.z);
          vec2 sq = vec2(abs(vLoc.x) / 0.36, (hy - sy0) / sh0);
          float inSign = front * step(0.72, vB.w) * step(sq.x, 1.0) * step(0.0, sq.y) * step(sq.y, 1.0);
          float edgeS = inSign * (1.0 - step(0.9, 1.0 - max(abs(sq.y - 0.5) * 2.0 * 0.92, sq.x)) );
          float frame = inSign * step(0.86, max(abs(sq.y - 0.5) * 2.0, sq.x)), bar = inSign * step(abs(sq.y - 0.5), 0.12) * step(sq.x, 0.25 + vB.w * 0.6);
          win *= 1.0 - inSign;
          totalEmissiveRadiance = wc * win * lit * uWinK + neon * roof * 1.4 * uWinK + neon * (frame + bar) * 2.2 * uWinK;`)
        .replace("#include <fog_fragment>", `#ifdef USE_FOG
            float fogF = smoothstep(fogNear, fogFar, vFogDepth), hk = 1.0 - smoothstep(0.0, 40.0, vWS.y - uBase);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * 0.72, clamp(fogF * 0.42 + hk * 0.24, 0.0, 0.85));
          #endif`);
    };
    const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.frustumCulled = false; scene.add(mesh);
    return { mesh, mat, B, span, z, n };
  };
  const cityFar = cityLayer(44, -380, 1100, 14, 28, 34, 95, [3.2, 4.2], 0.3), cityMid = cityLayer(46, -150, 520, 6, 12, 10, 40, [1.6, 2.1], 0.7);
  const blink = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 10, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.06, 0.2).multiplyScalar(4) }), cityMid.n);
  blink.frustumCulled = false; scene.add(blink);

  // ---------- the islands: one dune strip rebuilt each frame from the game's own ground ----------
  const NC = q === "high" ? 330 : q === "medium" ? 250 : 180, CMAX = 900, R0 = 0.25;
  const zOfDrop = (dr) => dr < R0 ? Math.sqrt(R0 * dr) : R0 + (dr - R0) * 0.12;             // a rounded crest, then a steep face down to the sea
  const dropB = (a) => 0.6 * a * a / (a + 0.5) + 0.04 * a * a;                                // the long back slope
  const FD = [0.004, 0.02, 0.06, 0.13, 0.25, 0.5, 0.9, 1.5, 2.3, 3.2, 4.3, 5.6, 7.2, 9.2, 11.6, 14.5, 18, 22.5, 28, 35, 44];
  const ZB = [-13, -9.5, -6.5, -4.2, -2.6, -1.5, -0.8, -0.35, -0.12], NB = ZB.length, R = NB + 1 + FD.length;
  const nV = CMAX * R;
  const tPos = new Float32Array(nV * 3), tNor = new Float32Array(nV * 3), tCol = new Float32Array(nV * 3), tCre = new Float32Array(nV * 3), tPat = new Float32Array(nV), tDrop = new Float32Array(nV);
  const tIdx = new Uint32Array((CMAX - 1) * (R - 1) * 6);
  for (let i = 0, o = 0; i < CMAX - 1; i++) for (let r = 0; r < R - 1; r++) { const a = i * R + r, b = (i + 1) * R + r; tIdx[o++] = a; tIdx[o++] = a + 1; tIdx[o++] = b; tIdx[o++] = b; tIdx[o++] = a + 1; tIdx[o++] = b + 1; }
  const tGeo = new THREE.BufferGeometry();
  const aPos = attr(tPos, 3), aNor = attr(tNor, 3), aCol = attr(tCol, 3), aCre = attr(tCre, 3), aPat = attr(tPat, 1), aDrp = attr(tDrop, 1);
  tGeo.setAttribute("position", aPos); tGeo.setAttribute("normal", aNor); tGeo.setAttribute("color", aCol); tGeo.setAttribute("aCrest", aCre); tGeo.setAttribute("aPat", aPat); tGeo.setAttribute("aDrop", aDrp);
  tGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));
  const terrU = { uT: { value: 0 }, uWaterY: { value: waterY }, uFoam: { value: new THREE.Color() } };
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0, envMapIntensity: 0.16 });
  terrainMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, terrU);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 aCrest; attribute float aPat, aDrop; varying vec3 vWS, vNW, vCrest; varying float vPat, vDrop;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n vWS = (modelMatrix * vec4(transformed, 1.0)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal); vCrest = aCrest; vPat = aPat; vDrop = aDrop;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
        varying vec3 vWS, vNW, vCrest; varying float vPat, vDrop; uniform float uT, uWaterY; uniform vec3 uFoam;
        ${HASH_GLSL}
        float sbLine(float d, float hw, float fw){ return 1.0 - smoothstep(hw - fw, hw + fw, d); }
        // each island's pattern, in game units below the crest (dr) and across the world (g), as the 2D game paints it
        float sbPattern(float P, vec2 g, float dr, float fw){
          if (P < 0.5) { float k = floor(dr / 34.0 + 0.5); return (k >= 1.0 && k <= 6.0) ? sbLine(abs(dr - k * 34.0), 7.0, fw) * (mod(k, 2.0) > 0.5 ? 0.95 : 0.45) : 0.0; }
          if (P < 1.5) { float sp = 34.0, row = floor(g.y / sp + 0.5), off = mod(row, 2.0) * sp * 0.5; vec2 c = vec2(floor((g.x - off) / sp + 0.5) * sp + off, row * sp); return sbLine(length(g - c), 5.0, fw); }
          if (P < 2.5) { float s = mod(g.x + g.y, 60.0); return sbLine(min(s, 60.0 - s), 7.0, fw) * 1.1; }
          if (P < 3.5) { float s = mod(g.x, 50.0), k = floor(dr / 40.0 + 0.5); return max(sbLine(min(s, 50.0 - s), 1.2, fw), (k >= 1.0 && k <= 8.0) ? sbLine(abs(dr - k * 40.0), 1.2, fw) : 0.0); }
          float per = P > 4.5 ? 24.0 : 40.0, amp = P > 4.5 ? 10.0 : 16.0, ph = mod(g.x, per) / per, z = (ph < 0.5 ? ph : 1.0 - ph) * 2.0 * amp;
          float d2 = dr - z, k = floor(d2 / 42.0 + 0.5); return (k >= 1.0 && k <= 6.0) ? sbLine(abs(d2 - k * 42.0), 2.0, fw) : 0.0;
        }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 nWo = normalize(vNW);
        vec2 gW = vec2(mod(vWS.x * 40.0, 81600.0), -vWS.y * 40.0);
        float fwD = fwidth(vDrop) + fwidth(gW.x) * 0.5 + 0.6;
        float pat = vDrop > 0.0 ? sbPattern(floor(vPat + 0.5), gW, vDrop, fwD) : 0.0;
        vec2 rp = vec2(mod(vWS.x, 2040.0), vWS.y + vWS.z * 0.3);
        float gk = 1.0 - smoothstep(0.004, 0.03, fwidth(rp.x));
        float grain = mix(0.5, sbH(floor(rp * 70.0)), gk);
        float streak = sbF(vec2(rp.x * 1.4, vWS.y * 0.22)) * (1.0 - smoothstep(0.35, 0.75, nWo.y));
        diffuseColor.rgb *= (0.92 + 0.16 * grain) * (0.86 + 0.3 * streak);
        diffuseColor.rgb = mix(diffuseColor.rgb, vCrest, pat * 0.32);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        float rph = rp.y * 13.0 + sin(rp.x * 1.1) * 0.8 + sbN(rp * vec2(0.6, 1.4)) * 3.5;
        float rk = (1.0 - smoothstep(0.6, 2.2, fwidth(rph))) * 0.3 * smoothstep(0.25, 0.7, nWo.y);
        vec3 pert = vec3(0.0, cos(rph) * rk, 0.0); pert -= nWo * dot(nWo, pert);
        normal = normalize(normal + (viewMatrix * vec4(pert, 0.0)).xyz);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float foam = (1.0 - smoothstep(0.0, 0.6, vWS.y - uWaterY)) * (0.5 + 0.5 * sbN(vec2(rp.x * 2.6 - uT * 0.8, vWS.z * 3.0 + uT * 0.5)));
        vec2 sc = floor(rp * 34.0); float spark = step(0.9968, sbH(sc)) * (0.5 + 0.5 * sin(uT * 5.0 + sbH(sc + 7.0) * 40.0)) * gk;
        totalEmissiveRadiance = diffuseColor.rgb * 0.26 + vCrest * (pat * 0.1 + spark * 1.3) + uFoam * foam * 0.9;`);
  };
  const terrain = new THREE.Mesh(tGeo, terrainMat); terrain.frustumCulled = false; scene.add(terrain);
  // the glowing crest rail along every island
  const TS = 6, cPos = new Float32Array(CMAX * TS * 3), cCol = new Float32Array(CMAX * TS * 3), cIdx = new Uint32Array(CMAX * TS * 6);
  const cGeo = new THREE.BufferGeometry(), caPos = attr(cPos, 3), caCol = attr(cCol, 3), caIdx = attr(cIdx, 1);
  cGeo.setAttribute("position", caPos); cGeo.setAttribute("color", caCol); cGeo.setIndex(caIdx);
  const crestRail = new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); crestRail.frustumCulled = false; scene.add(crestRail);

  const colX = new Float64Array(CMAX), colKind = new Uint8Array(CMAX), colTop = new Float64Array(CMAX), colC = new Float32Array(CMAX * 3);
  const themeInfo = new Map();
  const info = (T) => { let I = themeInfo.get(T); if (!I) { I = { pat: PAT[T.pat] ?? 0, crest: hex(T.crest || "#ffffff"), hill: T.type ? null : T.hill.map(hex) }; themeInfo.set(T, I); } return I; };
  const c0 = [0, 0, 0], c1 = [0, 0, 0], c2 = [0, 0, 0], cr = [0, 0, 0];
  const grad = (dropG, k, o) => {                                     // top -> middle -> deep colour with depth below the crest
    let a, b, t; if (dropG < 160) { a = c0; b = c1; t = dropG / 160; } else if (dropG < 520) { a = c1; b = c2; t = (dropG - 160) / 360; } else { a = c2; b = c2; t = 0; }
    tCol[o] = lin(a[0] + (b[0] - a[0]) * t) * k; tCol[o + 1] = lin(a[1] + (b[1] - a[1]) * t) * k; tCol[o + 2] = lin(a[2] + (b[2] - a[2]) * t) * k;
  };
  let nCols = 0;
  function buildIslands(xL, xR) {
    const span = xR - xL, step = Math.pow(2, Math.ceil(Math.log2(Math.max(1, span / NC)))), E = S.END;
    let n = 0, li = 0; while (li < E.length && E[li] < xL - step) li++;
    const add = (x, kind) => { colX[n] = x; colKind[n] = kind; n++; };
    for (let x = Math.floor(xL / step) * step - step; x <= xR + step && n < CMAX - 3; x += step) {
      while (li < E.length && E[li] < x && n < CMAX - 3) { const e = E[li++]; add(e, 2); add(e + 0.5, 3); }   // the cliff at the end of an island
      add(x, 0);
    }
    nCols = n;
    for (let i = 0; i < n; i++) {
      const x = colX[i], kind = colKind[i]; let top = YB, k = S.islandAt(x), land = kind !== 3;
      if (land) { let g = S.groundY(x); if (g >= S.ABYSS) { const nose = S.noseY(x, k); if (nose !== null) { g = nose; k++; } else land = false; } if (land) top = Y(g); }
      if (kind === 0 && !land) colKind[i] = 1;
      colTop[i] = top;
      const v0 = i * R, T = S.isl(k), I = info(T);
      if (kind === 3) {                                                // the foot of the cliff: straight below the lip
        const p = (i - 1) * R;
        for (let r = 0; r < R; r++) { const o = (v0 + r) * 3, po = (p + r) * 3; tPos[o] = x * U; tPos[o + 1] = YB; tPos[o + 2] = tPos[po + 2];
          tCol[o] = lin(c2[0]); tCol[o + 1] = lin(c2[1]); tCol[o + 2] = lin(c2[2]); tCre[o] = tCre[po]; tCre[o + 1] = tCre[po + 1]; tCre[o + 2] = tCre[po + 2];
          tPat[v0 + r] = tPat[p + r]; tDrop[v0 + r] = r < NB ? tDrop[p + r] : (colTop[i - 1] - YB) / U; }
        continue;
      }
      if (T.type) { const h = S.hillAt(k, x)[0]; for (let j = 0; j < 3; j++) { c0[j] = h[j]; c1[j] = h[j] * 0.7; c2[j] = h[j] * 0.2; cr[j] = h[j] + (255 - h[j]) * 0.55; } }
      else { const H3 = I.hill; for (let j = 0; j < 3; j++) { c0[j] = H3[0][j]; c1[j] = H3[1][j]; c2[j] = H3[2][j]; cr[j] = I.crest[j]; } }
      const crL0 = lin(cr[0]), crL1 = lin(cr[1]), crL2 = lin(cr[2]); colC[i * 3] = crL0; colC[i * 3 + 1] = crL1; colC[i * 3 + 2] = crL2;
      const full = Math.max(0, top - YB);
      for (let r = 0; r < R; r++) {
        let z, dr;
        if (r < NB) { z = ZB[r]; dr = Math.min(dropB(-z), full); } else if (r === NB) { z = 0; dr = 0; } else { dr = Math.min(FD[r - NB - 1], full); z = zOfDrop(dr); }
        const v = v0 + r, o = v * 3;
        tPos[o] = x * U; tPos[o + 1] = top - dr; tPos[o + 2] = z;
        grad(dr / U, r < NB ? 0.82 : 1, o);
        tCre[o] = crL0; tCre[o + 1] = crL1; tCre[o + 2] = crL2; tPat[v] = I.pat; tDrop[v] = r < NB ? -dr / U : dr / U;
      }
    }
    // normals from the grid (one-sided next to a cliff, flat out across the cliff itself)
    for (let i = 0; i < n; i++) {
      const kind = colKind[i];
      if (kind === 2 || kind === 3) { for (let r = 0; r < R; r++) { const o = (i * R + r) * 3; tNor[o] = 1; tNor[o + 1] = 0; tNor[o + 2] = 0; } continue; }
      let iL = i - 1, iR = i + 1; if (iL < 0 || colKind[iL] === 3) iL = i; if (iR >= n || colKind[iR] === 2) iR = i;
      for (let r = 0; r < R; r++) {
        const o = (i * R + r) * 3, oL = (iL * R + r) * 3, oR = (iR * R + r) * 3, oa = (i * R + Math.max(0, r - 1)) * 3, ob = (i * R + Math.min(R - 1, r + 1)) * 3;
        const dxx = tPos[oR] - tPos[oL], dxy = tPos[oR + 1] - tPos[oL + 1], dxz = tPos[oR + 2] - tPos[oL + 2];
        const drx = tPos[ob] - tPos[oa], dry = tPos[ob + 1] - tPos[oa + 1], drz = tPos[ob + 2] - tPos[oa + 2];
        let nx = dry * dxz - drz * dxy, ny = drz * dxx - drx * dxz, nz = drx * dxy - dry * dxx; const l = Math.hypot(nx, ny, nz);
        if (l < 1e-9) { nx = 0; ny = 1; nz = 0; } else { nx /= l; ny /= l; nz /= l; }
        tNor[o] = nx; tNor[o + 1] = ny; tNor[o + 2] = nz;
      }
    }
    const nv = n * R; touch(aPos, nv * 3); touch(aNor, nv * 3); touch(aCol, nv * 3); touch(aCre, nv * 3); touch(aPat, nv); touch(aDrp, nv);
    tGeo.setDrawRange(0, Math.max(0, n - 1) * (R - 1) * 6);
  }
  function buildCrest(sc) {
    const rT = Math.max(1.15 / sc, 2.1) * U, lift = rT * 0.55; let nv = 0, ni = 0, prevOk = false; const n = nCols, cIdxA = cIdx;
    for (let i = 0; i < n; i++) {
      const ok = (colKind[i] === 0 || colKind[i] === 2) && colTop[i] > waterY - 0.5;
      if (!ok) { prevOk = false; continue; }
      let iL = Math.max(0, i - 1), iR = Math.min(n - 1, i + 1); const x = colX[i] * U, y = colTop[i] + lift;
      if (colKind[iL] === 1 || colKind[iL] === 3) iL = i; if (colKind[iR] === 1 || colKind[iR] === 3) iR = i;
      let tx = (colX[iR] - colX[iL]) * U, ty = colTop[iR] - colTop[iL]; const tl = Math.hypot(tx, ty); if (tl < 1e-7) { tx = 1; ty = 0; } else { tx /= tl; ty /= tl; }
      const g = colKind[i] === 2 ? 2.2 : 2.6;
      for (let j = 0; j < TS; j++) { const a = (j / TS) * Math.PI * 2, ca = Math.cos(a) * rT, sa = Math.sin(a) * rT, o = (nv + j) * 3;
        cPos[o] = x - ty * ca; cPos[o + 1] = y + tx * ca; cPos[o + 2] = sa; cCol[o] = colC[i * 3] * g; cCol[o + 1] = colC[i * 3 + 1] * g; cCol[o + 2] = colC[i * 3 + 2] * g; }
      if (prevOk) { const a0 = nv - TS; for (let j = 0; j < TS; j++) { const j1 = (j + 1) % TS; cIdxA[ni++] = a0 + j; cIdxA[ni++] = nv + j; cIdxA[ni++] = a0 + j1; cIdxA[ni++] = a0 + j1; cIdxA[ni++] = nv + j; cIdxA[ni++] = nv + j1; } }
      nv += TS; prevOk = true;
    }
    touch(caPos, nv * 3); touch(caCol, nv * 3); touch(caIdx, ni); cGeo.setDrawRange(0, ni);
  }

  // ---------- glow points: sparks, spray, halos ----------
  const GP = 1600, gPos = new Float32Array(GP * 3), gCol = new Float32Array(GP * 3), gSize = new Float32Array(GP);
  const gGeo = new THREE.BufferGeometry(), gaPos = attr(gPos, 3), gaCol = attr(gCol, 3), gaSize = attr(gSize, 1);
  gGeo.setAttribute("position", gaPos); gGeo.setAttribute("aCol", gaCol); gGeo.setAttribute("aSize", gaSize);
  const glowU = { uPx: { value: 600 } };
  const glowPts = new THREE.Points(gGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: glowU,
    vertexShader: "attribute float aSize; attribute vec3 aCol; varying vec3 vC; uniform float uPx; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * uPx / -mv.z, 1.0, 512.0); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 1.7); gl_FragColor = vec4(vC * a, 1.0); }" }));
  glowPts.frustumCulled = false; glowPts.renderOrder = 5; scene.add(glowPts);
  let ng = 0;
  const glow = (x, y, z, size, r, g, b) => { if (ng >= GP) return; const o = ng * 3; gPos[o] = x; gPos[o + 1] = y; gPos[o + 2] = z; gCol[o] = r; gCol[o + 1] = g; gCol[o + 2] = b; gSize[ng++] = size; };

  // ---------- ribbons: trail, scarf, lightning, meteors ----------
  const ribbon = (maxPts, mat, soft = false) => { const VP = soft ? 3 : 2, pos = new Float32Array(maxPts * VP * 3), cl = new Float32Array(maxPts * VP * 3), idx = new Uint16Array((maxPts - 1) * 6 * (VP - 1));
    for (let i = 0, o = 0; i < maxPts - 1; i++) for (let k = 0; k < VP - 1; k++) { const a = i * VP + k, b = a + VP; idx[o++] = a; idx[o++] = a + 1; idx[o++] = b; idx[o++] = b; idx[o++] = a + 1; idx[o++] = b + 1; }
    const g = new THREE.BufferGeometry(), ap = attr(pos, 3), ac = attr(cl, 3); g.setAttribute("position", ap); g.setAttribute("color", ac); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(maxPts * VP * 3).map((v, i) => (i % 3 === 2 ? 1 : 0)), 3));
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
    // pts: [x, y] in game units, width(i), colour(i) -> [r, g, b]
    return { mesh: m, set(pts, z, width, colour) {
      const n = Math.min(pts.length, maxPts);
      for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; const w = width(i, n), c = colour(i, n), o = i * VP * 3;
        pos[o] = X(pts[i][0] + nx * w); pos[o + 1] = Y(pts[i][1] + ny * w); pos[o + 2] = z; const e = o + (VP - 1) * 3; pos[e] = X(pts[i][0] - nx * w); pos[e + 1] = Y(pts[i][1] - ny * w); pos[e + 2] = z;
        if (soft) { pos[o + 3] = X(pts[i][0]); pos[o + 4] = Y(pts[i][1]); pos[o + 5] = z; cl[o] = cl[o + 1] = cl[o + 2] = cl[e] = cl[e + 1] = cl[e + 2] = 0; cl[o + 3] = c[0]; cl[o + 4] = c[1]; cl[o + 5] = c[2]; }
        else { cl[o] = cl[e] = c[0]; cl[o + 1] = cl[e + 1] = c[1]; cl[o + 2] = cl[e + 2] = c[2]; } }
      touch(ap, n * VP * 3); touch(ac, n * VP * 3); g.setDrawRange(0, Math.max(0, n - 1) * 6 * (VP - 1)); m.visible = n > 1; } };
  };
  const addMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const trailGlow = ribbon(30, addMat(), true), trailCore = ribbon(30, addMat());
  const scarfR = ribbon(8, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: 0xff2bd6, emissiveIntensity: 0.7, side: THREE.DoubleSide }));
  const boltMat = addMat(); boltMat.depthTest = false; const bolt = ribbon(9, boltMat); bolt.mesh.renderOrder = 1001;
  // meteors: one quad each, dim at the tail
  const MET = 24, mPos = new Float32Array(MET * 4 * 3), mCl = new Float32Array(MET * 4 * 3), mIdx = new Uint16Array(MET * 6);
  for (let i = 0; i < MET; i++) { const a = i * 4, o = i * 6; mIdx[o] = a; mIdx[o + 1] = a + 1; mIdx[o + 2] = a + 2; mIdx[o + 3] = a + 2; mIdx[o + 4] = a + 1; mIdx[o + 5] = a + 3; }
  const mGeo = new THREE.BufferGeometry(), maPos = attr(mPos, 3), maCl = attr(mCl, 3); mGeo.setAttribute("position", maPos); mGeo.setAttribute("color", maCl); mGeo.setIndex(new THREE.BufferAttribute(mIdx, 1));
  const metMesh = new THREE.Mesh(mGeo, addMat()); metMesh.frustumCulled = false; scene.add(metMesh);
  // dashed lines: the flight path and the echo's beam
  const dashLine = (maxPts) => { const pos = new Float32Array(maxPts * 2 * 3), cl = new Float32Array(maxPts * 2 * 3), s = new Float32Array(maxPts * 2), idx = new Uint16Array((maxPts - 1) * 6);
    for (let i = 0, o = 0; i < maxPts - 1; i++) { const a = i * 2; idx[o++] = a; idx[o++] = a + 1; idx[o++] = a + 2; idx[o++] = a + 2; idx[o++] = a + 1; idx[o++] = a + 3; }
    const g = new THREE.BufferGeometry(), ap = attr(pos, 3), ac = attr(cl, 3), as = attr(s, 1); g.setAttribute("position", ap); g.setAttribute("aCol", ac); g.setAttribute("aS", as); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const u = { uOff: { value: 0 }, uDash: { value: 20 }, uGap: { value: 16 } };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: u,
      vertexShader: "attribute vec3 aCol; attribute float aS; varying vec3 vC; varying float vS; void main(){ vC = aCol; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform float uOff, uDash, uGap; varying vec3 vC; varying float vS; void main(){ float f = mod(vS + uOff, uDash + uGap); if (f > uDash) discard; gl_FragColor = vec4(vC, 1.0); }" }));
    m.frustumCulled = false; scene.add(m);
    return { mesh: m, u, set(pts, z, w, colour) { const n = Math.min(pts.length, maxPts); let acc = 0;
      for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; const c = colour(i, n), o = i * 6;
        pos[o] = X(pts[i][0] + nx * w); pos[o + 1] = Y(pts[i][1] + ny * w); pos[o + 2] = z; pos[o + 3] = X(pts[i][0] - nx * w); pos[o + 4] = Y(pts[i][1] - ny * w); pos[o + 5] = z;
        cl[o] = cl[o + 3] = c[0]; cl[o + 1] = cl[o + 4] = c[1]; cl[o + 2] = cl[o + 5] = c[2]; s[i * 2] = s[i * 2 + 1] = acc; }
      touch(ap, n * 6); touch(ac, n * 6); touch(as, n * 2); g.setDrawRange(0, Math.max(0, n - 1) * 6); m.visible = n > 1; } };
  };
  const arcLine = dashLine(41), echoBeam = dashLine(12);

  // ---------- rings (shock waves) ----------
  const RN = 16, ringGeo = new THREE.PlaneGeometry(2, 2), rCol = new Float32Array(RN * 3), rW = new Float32Array(RN);
  ringGeo.setAttribute("aCol", new THREE.InstancedBufferAttribute(rCol, 3)); ringGeo.setAttribute("aW", new THREE.InstancedBufferAttribute(rW, 1));
  const rings = new THREE.InstancedMesh(ringGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "attribute vec3 aCol; attribute float aW; varying vec2 vL; varying vec3 vC; varying float vW; void main(){ vL = position.xy; vC = aCol; vW = aW; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec2 vL; varying vec3 vC; varying float vW; void main(){ float r = length(vL), fw = fwidth(r) * 1.2; float a = 1.0 - smoothstep(vW - fw, vW + fw, abs(r - (1.0 - vW))); if (a <= 0.001) discard; gl_FragColor = vec4(vC * a, 1.0); }" }), RN);
  rings.frustumCulled = false; scene.add(rings);

  // ---------- shards and power-ups ----------
  const SH = 200, shardM = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshPhysicalMaterial({ color: 0xe9fbff, emissive: 0x7fd3ef, emissiveIntensity: 0.85, roughness: 0.06, metalness: 0.05, clearcoat: 1, flatShading: true, envMapIntensity: 1.6 }), SH);
  shardM.frustumCulled = false; scene.add(shardM);
  const texCache = new Map();
  const textTex = (text, font, colour, px) => { const keyT = text + "|" + font + "|" + colour; let t = texCache.get(keyT); if (t) return t;
    const c = document.createElement("canvas"), g = c.getContext("2d");
    const draw = () => { g.font = font; const w = Math.ceil(g.measureText(text).width) + px; c.width = Math.max(8, w); c.height = Math.ceil(px * 1.5); g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = colour; g.fillText(text, c.width / 2, c.height / 2 + px * 0.04); };
    draw(); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.redraw = () => { draw(); t.dispose(); t.needsUpdate = true; t.userData.aspect = c.width / c.height; }; t.userData.aspect = c.width / c.height;
    texCache.set(keyT, t); return t; };
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("96px Audiowide"), document.fonts.load("700 96px Jost")]).then(() => { for (const t of texCache.values()) t.userData.redraw(); }).catch(() => {});
  const pickPool = [];
  const mkPick = () => { const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.12, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0.35 }));
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.075, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const glyph = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); glyph.position.z = 1.08;
    g.add(orb, ringM, glyph); g.userData = { orb, ringM, glyph }; scene.add(g); return g; };
  // the ramp: chevrons painted up it, the glowing lip, and the gate to the next island hanging over the sea
  const chevGeo = (() => { const a = new THREE.CapsuleGeometry(3.5, 28.4, 4, 8), b = a.clone(); a.rotateZ(Math.atan2(22, 18)); a.translate(-3, 9, 0); b.rotateZ(-Math.atan2(22, 18)); b.translate(-3, -9, 0); return mergeGeometries([a, b]); })();
  const chevs = new THREE.InstancedMesh(chevGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 24); chevs.frustumCulled = false; scene.add(chevs);
  const lipPost = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 220, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb9fbff).multiplyScalar(2.4) })); scene.add(lipPost);
  const gate = new THREE.Group(); scene.add(gate);
  const gateOuter = new THREE.Mesh(new THREE.TorusGeometry(170, 6, 14, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6be6).multiplyScalar(2.2) }));
  const gateInner = new THREE.Mesh(new THREE.TorusGeometry(146, 2.6, 10, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x96faff), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const plate = () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
  const gateTitle = plate(), gateName = plate(); gate.add(gateOuter, gateInner, gateTitle, gateName); gate.scale.setScalar(U);
  let gateFor = -1;

  // ---------- the rider ----------
  const GEO = { torso: new THREE.CapsuleGeometry(6.5, 20, 6, 14), leg: new THREE.CapsuleGeometry(3.25, 14, 4, 10), arm: new THREE.CapsuleGeometry(2.5, 10, 4, 10), head: new THREE.SphereGeometry(8.5, 24, 16), stripe: new THREE.CapsuleGeometry(1.9, 20, 3, 8) };
  const bladeGeo = (() => { const s = new THREE.Shape(); s.moveTo(-40, 3); s.lineTo(36, 3); s.lineTo(50, -1); s.lineTo(36, -4); s.lineTo(-40, -4); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 16, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1, bevelSegments: 2, steps: 1 }); g.translate(0, 0, -8); return g; })();
  const UP = new THREE.Vector3(0, 1, 0), VA = new THREE.Vector3(), VB = new THREE.Vector3(), VD = new THREE.Vector3();
  function makeFigure(mono) {
    const g = new THREE.Group(); scene.add(g);
    const one = mono ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }) : null;
    const suit = one || new THREE.MeshPhysicalMaterial({ color: 0x2a1d86, roughness: 0.42, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.7, sheenColor: new THREE.Color(0x8f7bff), envMapIntensity: 0.9, emissive: 0x120a46, emissiveIntensity: 0.5 });
    const dark = one || new THREE.MeshPhysicalMaterial({ color: 0x170c52, roughness: 0.5, metalness: 0.1, clearcoat: 0.4, envMapIntensity: 0.7 });
    const skin = one || new THREE.MeshPhysicalMaterial({ color: 0x241a66, roughness: 0.25, metalness: 0.3, clearcoat: 1, envMapIntensity: 1.2 });
    const cloakM = one || new THREE.MeshStandardMaterial({ color: 0x3b2bd0, roughness: 0.55, emissive: 0x2a1ca0, emissiveIntensity: 0.35, side: THREE.DoubleSide });
    const limb = (geo, mat, z, L) => { const m = new THREE.Mesh(geo, mat); m.userData = { z, L }; g.add(m); return m; };
    const P = { torso: limb(GEO.torso, suit, 0, 20), thB: limb(GEO.leg, dark, -4.5, 14), shB: limb(GEO.leg, dark, -4.5, 14), thF: limb(GEO.leg, suit, 4.5, 14), shF: limb(GEO.leg, suit, 4.5, 14),
      uaB: limb(GEO.arm, dark, -7, 10), laB: limb(GEO.arm, dark, -7, 10), uaF: limb(GEO.arm, suit, 7, 10), laF: limb(GEO.arm, suit, 7, 10) };
    const headG = new THREE.Group(); g.add(headG); headG.add(new THREE.Mesh(GEO.head, skin));
    let stripe = null, eyes = null;
    if (!mono) {
      stripe = limb(GEO.stripe, new THREE.MeshStandardMaterial({ color: 0x5b4bff, emissive: 0x5b4bff, emissiveIntensity: 1.3, roughness: 0.4 }), 5.2, 20);
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(8.75, 8.75, 3.4, 24, 1, true, Math.PI * 0.06, Math.PI * 0.88), new THREE.MeshStandardMaterial({ color: 0xffd6f2, emissive: 0xffc4ee, emissiveIntensity: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
      visor.position.set(0, 1.2, 0); headG.add(visor);
      const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6).multiplyScalar(3.2) });
      eyes = [1, -1].map((sd) => { const e = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), eyeM); e.position.set(7.1, 1.2, 6.5 * sd); headG.add(e); return e; });
    }
    // the cloak tail: a fan from the hip, flapping behind
    const clPos = new Float32Array(8 * 3), clGeo = new THREE.BufferGeometry(), clA = attr(clPos, 3); clGeo.setAttribute("position", clA);
    clGeo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(8 * 3).map((v, i) => (i % 3 === 2 ? 1 : 0)), 3));
    clGeo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7]);
    const cloak = new THREE.Mesh(clGeo, cloakM); cloak.frustumCulled = false; g.add(cloak);
    // the blade
    const blade = new THREE.Group(); g.add(blade);
    if (mono) blade.add(new THREE.Mesh(new THREE.BoxGeometry(92, 7, 16).translate(2, -0.5, 0), one));
    else {
      blade.add(new THREE.Mesh(bladeGeo, new THREE.MeshPhysicalMaterial({ color: 0xf0c45a, metalness: 0.7, roughness: 0.28, clearcoat: 0.6, envMapIntensity: 1.3, emissive: 0x7a4e08, emissiveIntensity: 0.75 })));
      const bronze = new THREE.MeshStandardMaterial({ color: 0x8a5d22, metalness: 0.85, roughness: 0.35 });
      const guard = new THREE.Mesh(new THREE.BoxGeometry(6, 16, 21), bronze); guard.position.set(-41, 0, 0); blade.add(guard);
      const pommel = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 9), bronze); pommel.position.set(-48, -0.5, 0); blade.add(pommel);
      const gemM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe0ff).multiplyScalar(1.7) });
      for (const z of [10.8, -10.8]) { const gm = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 8), gemM); gm.position.set(-41, 0, z); blade.add(gm); }
      const under = new THREE.Mesh(new THREE.PlaneGeometry(116, 26), new THREE.MeshBasicMaterial({ map: K.softTexture(), color: new THREE.Color(0x78e6ff).multiplyScalar(0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      under.position.set(4, -1.5, -10); blade.add(under);
    }
    const place = (m, ax, ay, bx, by) => { const z = m.userData.z; VA.set(ax, -ay, z); VB.set(bx, -by, z); VD.subVectors(VB, VA); const len = VD.length() || 1;
      m.position.addVectors(VA, VB).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, VD.multiplyScalar(1 / len)); m.scale.set(1, Math.max(0.6, len / m.userData.L), 1); };
    return { group: g, mat: one, blade,
      pose(r, t, sp) {
        const L = S.rigPoints(r);
        place(P.torso, L.hip.x, L.hip.y, L.sh.x, L.sh.y);
        place(P.thB, L.hip.x - 2, L.hip.y, L.kb.x, L.kb.y); place(P.shB, L.kb.x, L.kb.y, L.fb.x, L.fb.y);
        place(P.thF, L.hip.x + 2, L.hip.y, L.kf.x, L.kf.y); place(P.shF, L.kf.x, L.kf.y, L.ff.x, L.ff.y);
        place(P.uaB, L.sh.x, L.sh.y, L.ba[0].x, L.ba[0].y); place(P.laB, L.ba[0].x, L.ba[0].y, L.ba[1].x, L.ba[1].y);
        place(P.uaF, L.sh.x, L.sh.y, L.fa[0].x, L.fa[0].y); place(P.laF, L.fa[0].x, L.fa[0].y, L.fa[1].x, L.fa[1].y);
        if (stripe) place(stripe, L.hip.x + 3, L.hip.y - 2, L.sh.x + 3, L.sh.y);
        headG.position.set(L.head.x, -L.head.y, 0); headG.rotation.z = -(r.torso + r.head);
        const flap = Math.sin(t * 18) * 3, x0 = L.sh.x - 2, y0 = L.sh.y, cx = L.hip.x - 14 * sp, cy = L.hip.y - 4 + flap, x1 = L.hip.x - 26 * sp, y1 = L.hip.y + 6 + flap * 1.5;
        clPos[0] = L.hip.x + 2; clPos[1] = -(L.hip.y + 2); clPos[2] = -2.5;
        for (let j = 0; j <= 6; j++) { const u = j / 6, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u, o = (j + 1) * 3; clPos[o] = a * x0 + b * cx + c * x1; clPos[o + 1] = -(a * y0 + b * cy + c * y1); clPos[o + 2] = -2.5; }
        clA.needsUpdate = true;
      } };
  }
  const rider = makeFigure(false), echoFig = makeFigure(true), ghostFigs = [];
  const shield = new THREE.Mesh(new THREE.SphereGeometry(62, 32, 20), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: new THREE.Color(0x9ef0a6) } },
    vertexShader: "varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 uC; varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uC * (0.12 + f * 1.4), 1.0); }" }));
  shield.scale.setScalar(U); scene.add(shield);
  const aura = K.glowSprite(0xff8a3d, 1, 2.2); scene.add(aura);
  const shadow = new THREE.Group(), blobM = K.blob(1, 1, 0.55); shadow.add(blobM); scene.add(shadow);

  // ---------- the storm: a churning wall that swallows everything behind its front, lit from inside by lightning ----------
  const stormU = { uT: { value: 0 }, uFront: { value: 0 }, uFlash: { value: 0 } };
  const storm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, uniforms: stormU,
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform float uT, uFront, uFlash; varying vec3 vW; ${HASH_GLSL}
      void main(){ float gx = vW.x * 40.0, gy = -vW.y * 40.0, u = (gx - uFront) / 520.0;
        if (u > 0.65) discard;
        vec2 q = vec2(mod(gx, 40960.0), gy) * 0.0024 + vec2(-uT * 0.18, uT * 0.04);
        vec2 w = vec2(sbF(q + vec2(0.0, uT * 0.07)), sbF(q + vec2(5.2, 1.3) - uT * 0.05));
        float n = sbF(q + w * 1.6);
        float e = u + (n - 0.5) * 1.1;
        float dens = 1.0 - smoothstep(-0.32, 0.2, e);
        vec3 c = mix(vec3(0.012, 0.0, 0.03), vec3(0.1, 0.035, 0.22), smoothstep(0.35, 0.8, n));
        c *= mix(1.0, 0.45, smoothstep(-0.3, -1.6, e));
        float rimG = exp(-pow((e + 0.04) / 0.075, 2.0));
        c += vec3(1.0, 0.08, 0.8) * rimG * (0.5 + 0.3 * sin(uT * 3.0 + gy * 0.01)) * 0.4;
        c += vec3(0.8, 0.5, 1.0) * uFlash * (0.3 + n) * dens * 1.4;
        gl_FragColor = vec4(c, clamp(dens * 0.985 + rimG * 0.25, 0.0, 1.0)); }` }));
  storm.frustumCulled = false; storm.renderOrder = 1000; scene.add(storm);
  if (mir) mir.hide.push(storm, bolt.mesh);

  // ---------- post ----------
  const post = K.post(renderer, scene, camera, { bloom: [0.45, 0.4, 0.9], vignette: 0.55, grain: 0.018 });
  let W = 0, H = 0, dprNow = 0, lowFx = false;
  const resize = (w, h) => { const want = lowFx ? 1 : Math.min(devicePixelRatio || 1, q === "high" ? 1.75 : q === "medium" ? 1.3 : 1);
    if (w === W && h === H && want === dprNow) return; W = w; H = h; dprNow = want;
    renderer.setPixelRatio(want); renderer.setSize(W, H, false); post.composer.setPixelRatio(want); post.setSize(W, H); if (mir) mir.resize();
    camera.aspect = W / H; camera.updateProjectionMatrix(); };
  const M = new THREE.Matrix4(), V3 = new THREE.Vector3(), Q = new THREE.Quaternion(), SC3 = new THREE.Vector3(), E3 = new THREE.Euler(), C = new THREE.Color(), Z = new THREE.Vector3(0, 0, 1);
  const setLin = (c, rgb, k = 1) => c.setRGB(lin(rgb[0]) * k, lin(rgb[1]) * k, lin(rgb[2]) * k);
  const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  let last = performance.now();

  const api = {
    ok: true, debugZoom: 0, info: renderer.info,
    render(t) {
      resize(S.W, S.H);
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!lowFx && S.QUALITY && S.QUALITY.bloom === false) { lowFx = true; if (mir) mir.on = false; resize(S.W, S.H); }
      const cam = S.cam, p = S.p, sc = S.baseScale() * cam.zoom, viewW = W / sc, viewH = H / sc, cx = cam.x + viewW / 2, cy = cam.y + viewH / 2;
      const fovR = THREE.MathUtils.degToRad(camera.fov), tanH = Math.tan(fovR / 2), dist = (viewH * U / 2) / tanH;
      let shx = 0, shy = 0; if (S.shake > 0) { const k = S.shake * 16 * (window.ARCADE_CALM ? 0.15 : 1) / sc * U; shx = (Math.random() - 0.5) * k; shy = (Math.random() - 0.5) * k; }
      const CX = cx * U + shx, CY = -cy * U + shy;
      camera.position.set(CX, CY, dist); camera.lookAt(CX, CY, 0);
      if (api.debugZoom > 0) { const rx = X(p.x), ry = Y(p.y - 30); camera.position.set(rx + api.debugZoom * 0.25, ry + api.debugZoom * 0.12, api.debugZoom); camera.lookAt(rx, ry, 0); }   // test hook: a close-up on the rider
      camera.updateMatrixWorld();
      sky.position.copy(camera.position);
      glowU.uPx.value = (H * dprNow) / (2 * tanH);
      // the island's colours for the sky, the sea, the fog and the far shore
      const P = S.pal(), sk = P.sky;
      setLin(skyU.uTop.value, sk[0]); setLin(skyU.uMid.value, sk[1]); setLin(skyU.uGlow.value, P.glow, 0.95); skyU.uT.value = t;
      setLin(scene.fog.color, P.glow, 0.95); waterU.uFogC.value.copy(scene.fog.color);
      setLin(waterU.uDeep.value, sk[0]); setLin(waterU.uMid.value, sk[1]); setLin(waterU.uGlow.value, P.glow); waterU.uT.value = t;
      setLin(terrU.uFoam.value, P.glow, 1.2); terrU.uT.value = t;
      setLin(hemi.color, sk[1], 1.6); hemi.color.offsetHSL(0, 0, 0.06);
      cityFar.mat.color.set(P.city[0]).multiplyScalar(0.7); cityMid.mat.color.set(P.city[1]).multiplyScalar(0.7);
      key.position.set(CX - 30, CY + 22, 16); key.target.position.set(CX, CY, 0); rim.position.set(CX + 26, CY + 9, -20); rim.target.position.set(CX, CY, 0);
      // moon: pinned to the same spot on screen as in 2D (80% across, 30% down), far behind everything
      const asp = W / H, md = 900, dir = V3.set(0.6 * tanH * asp, 0.4 * tanH, -1).normalize(), mr = Math.min(W, H) * 0.12, fpx = (H / 2) / tanH;
      moon.position.copy(camera.position).addScaledVector(dir, md); moon.scale.setScalar(md * mr / fpx);
      halo.position.copy(moon.position); halo.position.z -= 1; halo.scale.setScalar(md * mr / fpx * 2.6);
      moonU.uEcl.value = S.state === "play" ? Math.min(1, Math.max(0, 1 - (p.x - S.storm.x - 300) / 1800)) : 0;
      // sea and city follow the camera
      water.position.set(CX, waterY, -1700);
      for (const L of [cityFar, cityMid]) {
        const halfW = (dist - L.z) * tanH * asp;
        for (let i = 0; i < L.n; i++) { const b = L.B[i]; let x = b.bx + L.span * Math.floor((CX - b.bx) / L.span + 0.5);
          const vis = Math.abs(x - CX) < halfW + b.w; M.compose(V3.set(x, waterY - 0.5, L.z - b.d * 0.5), Q.identity(), SC3.set(vis ? b.w : 0, vis ? b.h + 0.5 : 0, vis ? b.d : 0)); L.mesh.setMatrixAt(i, M);
          if (L === cityMid) { const on = b.s > 0.6 && Math.sin(t * 3 + i) > 0 && vis; M.compose(V3.set(x, waterY + b.h + 0.9, L.z), Q.identity(), SC3.setScalar(on ? 1 : 0)); blink.setMatrixAt(i, M); } }
        L.mesh.instanceMatrix.needsUpdate = true;
      }
      blink.instanceMatrix.needsUpdate = true;
      // the islands
      const halfB = (dist - ZB[0]) * tanH * asp / U * 1.06;
      buildIslands(cx - halfB, cx + halfB); buildCrest(sc);
      ng = 0;
      // the ramp, its lip and the gate to the next island
      const idx = S.islandIdx, E = S.END; let nch = 0; lipPost.visible = false; gate.visible = false;
      if (idx < E.length) {
        const e = E[idx];
        for (let x = e - S.RAMP * 0.38; x < e - 60 && nch < 24; x += 140) { if (Math.abs(x - cx) > halfB) continue;
          const on = Math.sin(t * 8 - x * 0.01) > 0, a = Math.atan(S.slopeAt(x));
          M.compose(V3.set(X(x), Y(S.groundY(x) - 40), 0.05), Q.setFromAxisAngle(Z, -a), SC3.setScalar(U)); chevs.setMatrixAt(nch, M); chevs.setColorAt(nch, on ? C.setRGB(2.4, 2.4, 2.4) : C.setRGB(2.6, 0.05, 1.7)); nch++; }
        const ly = S.groundY(e - 1);
        if (Math.abs(e - cx) < halfB) { lipPost.visible = true; lipPost.position.set(X(e), Y(ly - 110), 0); lipPost.scale.setScalar(U); for (let k = 0; k < 6; k++) glow(X(e), Y(ly - 20 - k * 40), 0.1, 2.2, 0.25, 0.9, 1.0); }
        const gx = e + S.GAP / 2;
        if (Math.abs(gx - cx) < halfB + 400) {
          gate.visible = true; gate.position.set(X(gx), Y(-1050), 0); gateInner.material.opacity = 0.6 + 0.4 * Math.sin(t * 5);
          if (gateFor !== idx) { gateFor = idx; const Nx = S.isl(idx + 1);
            const t1 = textTex(`ISLAND ${idx + 2}`, "96px Audiowide, system-ui, sans-serif", "#ffffff", 96), t2 = textTex(Nx.name.toUpperCase(), "64px Audiowide, system-ui, sans-serif", Nx.crest || "#ffffff", 64);
            gateTitle.material.map = t1; gateTitle.material.needsUpdate = true; gateName.material.map = t2; gateName.material.needsUpdate = true; }
          const a1 = gateTitle.material.map.userData.aspect, a2 = gateName.material.map.userData.aspect;
          gateTitle.scale.set(45 * a1, 45, 1); gateTitle.position.set(0, 200, 0); gateName.scale.set(30 * a2, 30, 1); gateName.position.set(0, -236, 0);
          glow(X(gx), Y(-1050), -0.2, 340 * U * 2.2, 0.16, 0.02, 0.12);
        }
      }
      chevs.count = nch; chevs.instanceMatrix.needsUpdate = true; if (chevs.instanceColor) chevs.instanceColor.needsUpdate = true;
      // shards
      let ns = 0;
      for (const s of S.shards) { if (ns >= SH || Math.abs(s.x - cx) > viewW * 0.75) continue;
        const yy = s.y + Math.sin(t * 3 + s.ph) * 6, r = 13 + 3 / sc;
        E3.set(0, t * 2 + s.ph, Math.sin(t * 2 + s.ph) * 0.3); M.compose(V3.set(X(s.x), Y(yy), 0), Q.setFromEuler(E3), SC3.set(r * 0.7 * U, r * 1.3 * U, r * 0.7 * U)); shardM.setMatrixAt(ns, M);
        shardM.setColorAt(ns, s.star ? C.setRGB(0.6, 0.7, 1.4) : C.setRGB(1, 1, 1)); ns++;
        glow(X(s.x), Y(yy), 0, r * 6 * U, s.star ? 0.2 : 0.22, s.star ? 0.26 : 0.42, 0.55); }
      shardM.count = ns; shardM.instanceMatrix.needsUpdate = true; if (shardM.instanceColor) shardM.instanceColor.needsUpdate = true;
      // power-ups
      let pi = 0; const near = [];
      for (const qq of S.pickups) { if (Math.abs(qq.x - cx) > viewW * 0.8) continue; const Pw = S.POWER[qq.type]; if (!Pw) continue;
        const g = pickPool[pi] || (pickPool[pi] = mkPick()); pi++; const r = 22 + 6 / sc, yy = qq.y + Math.sin(t * 2.5 + qq.ph) * 10;
        g.visible = true; g.position.set(X(qq.x), Y(yy), 0); g.scale.setScalar(r * U); g.rotation.y = Math.sin(t * 1.3 + qq.ph) * 0.4;
        const u = g.userData; u.orb.material.emissive.set(Pw.color); u.ringM.material.color.set(Pw.color).multiplyScalar(2.6); u.ringM.scale.setScalar(1 + 0.08 * Math.sin(t * 6)); u.ringM.rotation.y = t * 1.6;
        const tx = textTex(Pw.glyph, "700 96px Jost, system-ui, sans-serif", "#3b2a1c", 96); if (u.glyph.material.map !== tx) { u.glyph.material.map = tx; u.glyph.material.needsUpdate = true; }
        u.glyph.scale.set(1.65 * tx.userData.aspect, 1.65, 1);
        const c3 = hex(Pw.color); glow(X(qq.x), Y(yy), -0.05, r * 5.2 * U, lin(c3[0]) * 0.8, lin(c3[1]) * 0.8, lin(c3[2]) * 0.8); near.push([Math.abs(qq.x - p.x), qq.x, yy, Pw.color]); }
      for (let i = pi; i < pickPool.length; i++) pickPool[i].visible = false;
      near.sort((a, b) => a[0] - b[0]);
      pickL.forEach((l, i) => { const nn = near[i]; if (!nn) { l.intensity = 0; return; } l.intensity = 9; l.color.set(nn[3]); l.position.set(X(nn[1]), Y(nn[2]), 1.2); });
      // the rider, the echo twin and the afterimages
      const st = S.state, sp = Math.min(1.4, Math.max(0.2, Math.hypot(p.vx, p.vy) / 1500)), rig = S.rig;
      rider.pose(rig, t, sp);
      rider.group.position.set(X(p.x), Y(p.y), 0); rider.group.rotation.z = -p.rot; rider.group.scale.set(U * (1 + rig.sq * 0.55), U * (1 - rig.sq), U);
      boardL.intensity = 3.2; boardL.position.set(X(p.x), Y(p.y + 9), 0.7);
      const pw = S.powers;
      aura.visible = pw.comet > 0; if (aura.visible) { aura.position.set(X(p.x), Y(p.y - 28), 0.2); aura.scale.setScalar(200 * U); }
      shield.visible = pw.ward > 0; if (shield.visible) shield.position.set(X(p.x), Y(p.y - 28), 0);
      const gY = S.groundY(p.x), alt = gY < S.ABYSS ? gY - p.y : 1e9;
      shadow.visible = alt < 900; if (shadow.visible) { const k = 1 / (1 + Math.max(0, alt) / 380); shadow.position.set(X(p.x), Y(gY) + 0.015, 0); shadow.rotation.z = -Math.atan(S.slopeAt(p.x)); blobM.scale.set(95 * k * U, 30 * k * U, 1); blobM.material.opacity = 0.6 * k * (1 - alt / 900); }
      const E1 = S.echo;
      echoFig.group.visible = !!E1;
      if (E1) { const fade = Math.min(1, pw.echo / 0.6); echoFig.pose(rig, t, sp); echoFig.group.position.set(X(E1.x), Y(E1.y), 0); echoFig.group.rotation.z = -E1.rot; echoFig.group.scale.setScalar(U);
        echoFig.mat.color.setRGB(0.75, 0.8, 1.0); echoFig.mat.opacity = 0.7 * fade * (0.85 + 0.15 * Math.sin(t * 9));
        const a0 = 0.35 * fade, pts = []; for (let i = 0; i <= 11; i++) { const u = i / 11; pts.push([E1.x + (p.x - E1.x) * u, E1.y - 30 + (p.y - 40 - (E1.y - 30)) * u]); }
        echoBeam.set(pts, 0.1, 1.5 + 0.5 / sc, (i, n) => { const a = a0 * (1 - i / (n - 1)); return [0.74 * a, 0.78 * a, a]; }); echoBeam.u.uOff.value = -t * 60; echoBeam.u.uDash.value = 6 + 2 / sc; echoBeam.u.uGap.value = 8 + 2 / sc;
        glow(X(E1.x), Y(E1.y - 28), 0, 140 * U, 0.2 * fade, 0.24 * fade, 0.3 * fade);
      } else echoBeam.mesh.visible = false;
      const tc = rgbOf(S.trailColor()), G = S.ghosts;
      for (let i = 0; i < Math.max(G.length, ghostFigs.length); i++) {
        const gh = G[i]; let f = ghostFigs[i];
        if (!gh) { if (f) f.group.visible = false; continue; }
        if (!f) f = ghostFigs[i] = makeFigure(true);
        f.group.visible = true; f.pose(gh.r, t, sp); f.group.position.set(X(gh.x), Y(gh.y), -0.05); f.group.rotation.z = -gh.rot; f.group.scale.setScalar(U);
        f.mat.color.setRGB(tc[0], tc[1], tc[2]); f.mat.opacity = (gh.life / 0.28) * 0.35;
      }
      // scarf and trail
      const sca = S.scarf; scarfR.set(sca.map((s2) => [s2.x, s2.y]), -0.17, () => 3.5, () => [1, 0.03, 0.68]);
      const tr = S.trail;
      if (tr.length >= 3) { const speed = Math.hypot(p.vx, p.vy), k = Math.min(1, Math.max(0.2, (speed - 250) / 900)), boost = pw.gale > 0 || S.fever > 0, pts = tr.map((q2) => [q2.x, q2.y]);
        const ga = (boost ? 0.35 : 0.25) * k * 2.2, ca2 = (boost ? 0.9 : 0.7) * k * 1.15;
        trailGlow.set(pts, 0.3, (i, n) => (i / n) * (boost ? 22 : 14), () => [tc[0] * ga, tc[1] * ga, tc[2] * ga]);
        trailCore.set(pts, 0.31, (i, n) => (i / n) * (boost ? 7 : 4), () => [tc[0] * ca2, tc[1] * ca2, tc[2] * ca2]);
      } else { trailGlow.mesh.visible = false; trailCore.mesh.visible = false; }
      // the flight path writing itself across the sky
      const A = S.arcPath;
      if (A) { const upto = A.T * easeOut(A.t / 0.55), pts = []; for (let i = 0; i <= 40; i++) { const tt = upto * i / 40; pts.push([A.x0 + A.vx * tt, A.y0 + A.vy * tt + 0.5 * A.g * tt * tt - 30]); }
        const c3 = hex(A.color), a = 0.85 * Math.min(1, Math.max(0, A.fade)) * 1.6; arcLine.set(pts, 0.2, 2.5 + 1 / sc, () => [lin(c3[0]) * a, lin(c3[1]) * a, lin(c3[2]) * a]);
        arcLine.u.uOff.value = -t * 80; arcLine.u.uDash.value = 16 + 4 / sc; arcLine.u.uGap.value = 12 + 4 / sc; const h = pts[pts.length - 1]; glow(X(h[0]), Y(h[1]), 0.25, (12 + 5 / sc) * U, 1.4, 1.4, 1.4);
      } else arcLine.mesh.visible = false;
      // rings
      let nr = 0;
      for (const r of S.rings) { if (nr >= RN) break; const u = 1 - r.life / r.max, R1 = easeOut(u) * r.maxR, lw = Math.max(1 / sc, r.width * (1 - u) + 1 / sc), s = R1 + lw / 2; if (s <= 0) continue;
        M.compose(V3.set(X(r.x), Y(r.y), 0.2), Q.identity(), SC3.set(s * U, s * 0.55 * U, 1)); rings.setMatrixAt(nr, M); const c3 = hex(r.color), a = (1 - u) * 0.9 * 1.5;
        rCol[nr * 3] = lin(c3[0]) * a; rCol[nr * 3 + 1] = lin(c3[1]) * a; rCol[nr * 3 + 2] = lin(c3[2]) * a; rW[nr] = Math.min(0.5, (lw / 2) / s); nr++; }
      rings.count = nr; rings.instanceMatrix.needsUpdate = true; ringGeo.attributes.aCol.needsUpdate = true; ringGeo.attributes.aW.needsUpdate = true;
      // meteors
      let nm = 0;
      for (const m of S.meteors) { if (nm >= MET) break; const x0 = m.x - m.vx * 0.12, y0 = m.y - m.vy * 0.12; let nx = -(m.y - y0), ny = m.x - x0; const l = Math.hypot(nx, ny) || 1; const w = Math.max(1 / sc, 3.5); nx = nx / l * w; ny = ny / l * w;
        const o = nm * 12; const P4 = [[x0 + nx, y0 + ny], [x0 - nx, y0 - ny], [m.x + nx, m.y + ny], [m.x - nx, m.y - ny]];
        for (let j = 0; j < 4; j++) { mPos[o + j * 3] = X(P4[j][0]); mPos[o + j * 3 + 1] = Y(P4[j][1]); mPos[o + j * 3 + 2] = 0.15; const head = j >= 2; mCl[o + j * 3] = head ? 0.6 * 1.6 : 0; mCl[o + j * 3 + 1] = head ? 0.68 * 1.6 : 0; mCl[o + j * 3 + 2] = head ? 1.6 : 0; }
        glow(X(m.x), Y(m.y), 0.2, 22 * U, 1.5, 1.6, 1.8); glow(X(m.x), Y(m.y), 0.2, 60 * U, 0.08, 0.12, 0.45); nm++; }
      touch(maPos, nm * 12); touch(maCl, nm * 12); mGeo.setDrawRange(0, nm * 6); metMesh.visible = nm > 0;
      // sparks and spray
      for (const q2 of S.particles) { const a = q2.life / q2.max, c3 = rgbOf(q2.color), k = a * 0.9 * 1.3; glow(X(q2.x), Y(q2.y), 0.3, (q2.size * (0.6 + a * 0.6) + 0.5 / sc) * 3.6 * U, c3[0] * k, c3[1] * k, c3[2] * k); }
      if (pw.comet > 0) glow(X(p.x), Y(p.y - 28), 0.2, 160 * U, 0.5, 0.2, 0.06);
      // the storm and its lightning
      const L1 = S.lightning; storm.visible = st !== "menu";
      if (storm.visible) { const sx = S.storm.x; stormU.uFront.value = sx; stormU.uT.value = t; stormU.uFlash.value = L1 ? L1.life * 0.8 : 0;
        storm.position.set(X(sx - 2800), Y(cy), 0.5); storm.scale.set(7400 * U, viewH * 2.6 * U, 1); }
      if (L1 && storm.visible) { const a = L1.life / 0.16; bolt.set(L1.pts, 0.6, () => Math.max(1.6 / sc, 2.2), () => [2.6 * a, 2.1 * a, 2.8 * a]); const b = L1.pts[L1.pts.length - 1];
        boltL.intensity = 260 * a; boltL.position.set(X(b[0]), Y(b[1]), 6); }
      else { bolt.mesh.visible = false; boltL.intensity = 0; }
      touch(gaPos, ng * 3); touch(gaCol, ng * 3); touch(gaSize, ng); gGeo.setDrawRange(0, ng);
      if (mir) mir.beginFrame();
      post.render(dt);
    },
  };
  return api;
}
