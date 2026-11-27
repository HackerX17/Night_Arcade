// Sandblade Legion in 3D: the same march down a three-lane neon road, built for real. Little armoured riders (legs,
// armour, a helmet with a glowing visor and a light blade) march in step; the road is dark glass that mirrors the gates,
// the soldiers and the pylons; the plain's grid rushes past; the skyline and the moon hang on the horizon; gates are
// frames of light, walls are neon-edged brick, and the horde waits at the end. The camera reproduces the 2D game's own
// projection (a level pinhole camera 400 units behind the legion), so the 2D layer keeps the numbers on the gates,
// walls and squads, the pop-ups and the sparks exactly where they were. Loaded only when the graphics switch is on 3D.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

const F = 400;                                                     // the 2D projection's focal length (and the camera's distance)
const LIN = (h) => new THREE.Color(h);
const HASH_GLSL = `float lgH(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`;

export function attach(S) {
  const q = K.tier();
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) { renderer.dispose(); throw new Error("3D mode needs WebGL 2"); }
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x000000, 2600, 16000);
  const camera = new THREE.PerspectiveCamera(60, 1, 20, 40000);
  scene.environment = K.cityEnv(renderer, { sky: [0.02, 0.01, 0.07], horizon: [0.4, 0.12, 0.55] });
  const attr = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const C = new THREE.Color(), M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), SC = new THREE.Vector3(), E = new THREE.Euler();

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight(0x8a7aff, 0x140a28, 0.85); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xe8e0ff, 1.25); key.position.set(-600, 1400, 900); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xff8ad8, 0.9); rim.position.set(700, 500, -1600); scene.add(rim, rim.target);
  const armyL = new THREE.PointLight(0x2b8cff, 0, 900, 1.6); scene.add(armyL);
  const hordeL = new THREE.PointLight(0xff2e4d, 0, 1400, 1.6); scene.add(hordeL);

  // ---------- sky, stars and moon (the 2D gradient, by height above the horizon) ----------
  const skyU = { u0: { value: new THREE.Color() }, u1: { value: new THREE.Color() }, u2: { value: new THREE.Color() }, uK: { value: 2 }, uT: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(30000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: skyU,
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 u0, u1, u2; uniform float uK, uT; varying vec3 vP; ${HASH_GLSL}
      void main(){ float tn = vP.y / max(1e-3, length(vP.xz)), t = 1.0 - tn * uK;
        vec3 c = t < 0.62 ? mix(u0, u1, clamp(t / 0.62, 0.0, 1.0)) : mix(u1, u2, clamp((t - 0.62) / 0.38, 0.0, 1.0));
        vec2 sp = vec2(atan(vP.x, -vP.z), tn) * 340.0; vec2 cl = floor(sp); float h = lgH(cl);
        float star = step(0.9965, h) * step(t, 0.75) * (0.3 + 0.5 * abs(sin(uT * 1.3 + h * 50.0))) * smoothstep(0.5, 0.15, length(fract(sp) - 0.5));
        gl_FragColor = vec4(c + vec3(star), 1.0); }` }));
  sky.renderOrder = -100; sky.frustumCulled = false; scene.add(sky);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf4f2ff).multiplyScalar(1.15), fog: false })); moon.frustumCulled = false; scene.add(moon);
  const moonGlow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uC: { value: new THREE.Color() } },
    vertexShader: "varying vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uC; varying vec2 vU; void main(){ float r = length(vU); gl_FragColor = vec4(uC * pow(max(0.0, 1.0 - r), 2.0) * 0.5, 1.0); }" }));
  moonGlow.frustumCulled = false; scene.add(moonGlow);

  // ---------- the skyline on the horizon: the 2D game's own towers, standing far out on the plain ----------
  const TW = S.towers, cityU = { uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uG: { value: new THREE.Color() } };
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.1, envMapIntensity: 0.2 }), TW.length);
  { const aT = new Float32Array(TW.length * 4); TW.forEach((b, i) => { aT[i * 4] = b.layer; aT[i * 4 + 1] = b.seed || i * 7.31; aT[i * 4 + 2] = 0; aT[i * 4 + 3] = 0; });
    city.geometry.setAttribute("aT", new THREE.InstancedBufferAttribute(aT, 4)); city.userData.aT = aT; }
  city.material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, cityU);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 aT; varying vec3 vWS, vNS; varying vec4 vT;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n vWS = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vNS = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal); vT = aT;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vWS, vNS; varying vec4 vT; uniform vec3 uA, uB, uG;\n${HASH_GLSL}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        // vT: layer, seed, cell size (world units per 2D pixel at this distance), roof height
        float px = vT.z, side = 1.0 - step(0.5, abs(vNS.y)); vec2 g = vec2(vWS.x / (6.0 * px), vWS.y / (7.0 * px)); vec2 cl = floor(g), f = fract(g);
        float u = lgH(cl + vT.y * 17.0), win = side * step(0.6, u) * step(0.25, f.x) * step(f.x, 0.62) * step(0.3, f.y) * step(f.y, 0.75) * step(vWS.y, vT.w - 7.0 * px);
        float pick = fract(u * 40.0 / 4.0) * 4.0; vec3 wc = pick < 1.0 ? uA : pick < 2.0 ? uB : pick < 3.0 ? uG : vec3(1.0, 0.9, 0.62);
        float roof = side * (1.0 - smoothstep(0.0, 1.5 * px, abs(vWS.y - vT.w + 0.75 * px)));
        totalEmissiveRadiance = wc * win * 0.5 + (vT.x > 0.5 ? uA : uG) * roof * 0.75;`);
  };
  city.frustumCulled = false; scene.add(city);
  let cityFor = "";

  // ---------- the ground: a glass road with neon rails on a plain with a grid rushing past ----------
  const mir = q !== "low" ? K.mirror(renderer, { w: 10, d: 10, y: 0, scale: q === "high" ? 0.5 : 0.33 }) : null;
  if (mir) scene.add(mir.mesh);
  const mirU = mir ? mir.uniforms : { tMirror: { value: null }, uMirrorMat: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 } };
  const gU = Object.assign({ uCity0: { value: new THREE.Color() }, uCity1: { value: new THREE.Color() }, uSky0: { value: new THREE.Color() }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uG: { value: new THREE.Color() },
    uScroll: { value: 0 }, uLaneW: { value: 170 }, uBK: { value: 0.7 }, uLane: { value: 1 }, uLaneOn: { value: 0 }, uFogC: { value: new THREE.Color() }, uT: { value: 0 } }, mirU);
  const groundMat = (road) => new THREE.ShaderMaterial({ uniforms: gU, defines: road ? { ROAD: "" } : {}, transparent: false,
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform vec3 uCity0, uCity1, uSky0, uA, uB, uG, uFogC; uniform float uScroll, uLaneW, uBK, uLane, uLaneOn, uT; varying vec3 vW;
      ${K.NOISE_GLSL}
      ${K.WET_GLSL}
      float lineAA(float d, float w){ float fw = fwidth(d); return 1.0 - smoothstep(w, w + fw * 1.2, abs(d)); }
      void main(){ float d = -vW.z, s = ${F.toFixed(1)} / (${F.toFixed(1)} + max(d, -180.0)), tt = clamp(s * uBK, 0.0, 1.0);
        vec3 V = normalize(cameraPosition - vW); float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
        vec3 refl = naReflect(vW, vec2(0.0), 1.6);
        #ifdef ROAD
          vec3 c = mix(uCity1 * 0.92, uCity0 * 0.96, tt);
          float cr = mod(d + 180.0 + uScroll, 80.0); cr = min(cr, 80.0 - cr);
          c += uB * lineAA(cr, 0.4) * (0.04 + 0.16 * s);
          float lx = abs(abs(vW.x) - 0.5 * uLaneW), dash = mod(d + 180.0 + uScroll, 120.0);
          c += vec3(0.85, 0.95, 1.0) * lineAA(lx, 2.0) * step(dash, 55.0) * 0.7;
          float ln = abs(vW.x - (uLane - 1.0) * uLaneW) - 0.5 * uLaneW;
          c += uA * step(ln, 0.0) * 0.2 * tt * uLaneOn * step(d, 2600.0);
          c = mix(c, refl, clamp(0.07 + fres * 0.38, 0.0, 0.45));
        #else
          vec3 c = mix(uCity0, uSky0, tt);
          float gl = mod(d + 180.0 + uScroll, 140.0); gl = min(gl, 140.0 - gl);
          c += uA * lineAA(gl, 0.35) * min(0.5, 0.05 + 0.45 * s * s);
          float vx = abs(fract(vW.x / uLaneW + 0.5) - 0.5) * uLaneW;
          c += uA * lineAA(vx, 0.35) * 0.22 * smoothstep(9000.0, 2500.0, d);
          c = mix(c, refl, clamp(fres * 0.14, 0.0, 0.16));
        #endif
        float hzG = smoothstep(4000.0, 14000.0, d); c += uG * hzG * 0.25;
        c = mix(c, uFogC, smoothstep(5000.0, 22000.0, d));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const plain = new THREE.Mesh(new THREE.PlaneGeometry(90000, 46000).rotateX(-Math.PI / 2), groundMat(false)); plain.position.set(0, -0.5, -22000); plain.frustumCulled = false; scene.add(plain);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), groundMat(true)); road.frustumCulled = false; scene.add(road);
  if (mir) mir.hide.push(plain, road, moon, moonGlow);
  const railM = new THREE.MeshBasicMaterial({ color: 0xffffff }), rails = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), railM); m.frustumCulled = false; scene.add(m); return m; });
  const railGlowM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const railGlow = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), railGlowM); m.frustumCulled = false; scene.add(m); return m; });

  // ---------- neon pylons along both sides ----------
  const PY = 40, pylon = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.6, envMapIntensity: 0.6 }), PY);
  const strip = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), PY);
  const orb = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), PY);
  for (const m of [pylon, strip, orb]) { m.frustumCulled = false; scene.add(m); }

  // ---------- glow points (pylon tops, gates, bolts) ----------
  const GP = 600, gPos = new Float32Array(GP * 3), gCol = new Float32Array(GP * 3), gSize = new Float32Array(GP), gGeo = new THREE.BufferGeometry();
  const gaP = attr(gPos, 3), gaC = attr(gCol, 3), gaS = attr(gSize, 1); gGeo.setAttribute("position", gaP); gGeo.setAttribute("aCol", gaC); gGeo.setAttribute("aSize", gaS);
  const glowU = { uPx: { value: 400 } };
  const glowPts = new THREE.Points(gGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: glowU,
    vertexShader: "attribute float aSize; attribute vec3 aCol; varying vec3 vC; uniform float uPx; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * uPx / -mv.z, 1.0, 400.0); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vC * pow(max(0.0, 1.0 - r), 1.8), 1.0); }" }));
  glowPts.frustumCulled = false; glowPts.renderOrder = 5; scene.add(glowPts);
  let ng = 0; const glow = (x, y, z, size, r, g, b) => { if (ng >= GP) return; const o = ng * 3; gPos[o] = x; gPos[o + 1] = y; gPos[o + 2] = z; gCol[o] = r; gCol[o + 1] = g; gCol[o + 2] = b; gSize[ng++] = size; };

  // ---------- gates: posts, a neon top bar, a glowing frame and a curtain of light with scan lines ----------
  const gatePool = [];
  const curtainMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: new THREE.Color() }, uA: { value: 0.17 } },
    vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uC; uniform float uA; varying vec2 vU; void main(){ float sl = 0.0; for (int i = 1; i < 6; i++) { float d = abs(vU.y - float(i) / 6.0); sl += 1.0 - smoothstep(0.004, 0.004 + fwidth(vU.y) * 1.5, d); } gl_FragColor = vec4(uC * (uA + sl * 0.14 + 0.08 * (1.0 - vU.y)), 1.0); }" });
  const mkGate = () => {
    const g = new THREE.Group(), postM = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.35, metalness: 0.7, envMapIntensity: 0.8 }), neon = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const halo = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const box = (m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m); g.add(b); return b; };
    const P = { postL: box(postM), postR: box(postM), top: box(neon), fl: box(neon), fr: box(neon), ft: box(neon), fb: box(neon), hl: box(halo), hr: box(halo), ht: box(halo) };
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), curtainMat()); g.add(cur); P.cur = cur; g.userData = { P, neon, halo, postM };
    scene.add(g); return g; };
  const placeGate = (g, o, laneW, t) => {
    const { P, neon, halo, postM } = g.userData, w = laneW * 0.92, h = laneW * 0.95, pw = 7, th = 6, gold = o.bonus || o.mega, good = S.gateGood(o);
    const col = gold ? [1, 0.64, 0.05] : good ? [0.02, 0.69, 1] : [1, 0.03, 0.07], pulse = o.pulse ? 1 + o.pulse * 4 : 1;
    g.position.set((o.lane - 1) * laneW, 0, -o.d); g.visible = true;
    const set = (m, x, y, sx, sy, sz, z = 0) => { m.position.set(x, y, z); m.scale.set(sx, sy, sz); };
    set(P.postL, -w / 2 - pw / 2, (h + pw) / 2, pw, h + pw, th); set(P.postR, w / 2 + pw / 2, (h + pw) / 2, pw, h + pw, th); set(P.top, 0, h + pw - 1.5, w + pw * 2, 3, th + 1);
    const fw = 3; set(P.fl, -w / 2 + fw / 2, h / 2, fw, h, 2, 1); set(P.fr, w / 2 - fw / 2, h / 2, fw, h, 2, 1); set(P.ft, 0, h - fw / 2, w, fw, 2, 1); set(P.fb, 0, fw / 2, w, fw, 2, 1);
    const hw = gold ? 16 : 10; set(P.hl, -w / 2, h / 2, hw, h + hw, 1, 1.5); set(P.hr, w / 2, h / 2, hw, h + hw, 1, 1.5); set(P.ht, 0, h, w + hw, hw, 1, 1.5);
    P.cur.position.set(0, h / 2, 0); P.cur.scale.set(w, h, 1); P.cur.material.uniforms.uC.value.setRGB(col[0], col[1], col[2]); P.cur.material.uniforms.uA.value = (gold ? 0.24 : 0.17) * pulse;
    neon.color.setRGB(col[0] * 2.4 * pulse, col[1] * 2.4 * pulse, col[2] * 2.4 * pulse); halo.color.setRGB(col[0], col[1], col[2]); postM.color.copy(gU.uCity1.value).multiplyScalar(1.6);
    glow((o.lane - 1) * laneW, h * 0.6, -o.d + 4, w * 1.6, col[0] * 0.12, col[1] * 0.12, col[2] * 0.12);
  };

  // ---------- walls: brick with neon edges ----------
  const wallPool = [];
  const wallU = { uTop: gU.uCity1, uBot: gU.uCity0, uLine: gU.uB };
  const wallMat = () => { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.05, envMapIntensity: 0.3 });
    m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, wallU);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vBU; varying vec3 vBN;").replace("#include <uv_vertex>", "#include <uv_vertex>\n vBU = uv; vBN = normal;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vBU; varying vec3 vBN; uniform vec3 uTop, uBot, uLine;")
        .replace("#include <map_fragment>", `#include <map_fragment>
          float rows = 4.0, r = floor(vBU.y * rows), fy = fract(vBU.y * rows), bx = fract(vBU.x * 4.0 + mod(r, 2.0) * 0.5);
          float mortar = max(1.0 - smoothstep(0.0, 0.05, min(fy, 1.0 - fy)), 1.0 - smoothstep(0.0, 0.03, min(bx, 1.0 - bx)));
          diffuseColor.rgb = mix(uBot, uTop, vBU.y) * 2.2;`)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance = uLine * mortar * 0.5 * step(0.5, abs(vBN.z)) + mix(uBot, uTop, vBU.y) * 0.25;"); };
    return m; };
  const mkWall = () => { const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat()), neon = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const halo = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const box = (m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m); g.add(b); return b; };
    g.add(body); const P = { body, l: box(neon), r: box(neon), t: box(neon), b: box(neon), hl: box(halo), hr: box(halo), ht: box(halo) }; g.userData = { P, neon, halo }; scene.add(g); return g; };
  const placeWall = (g, o, laneW) => {
    const { P, neon, halo } = g.userData, w = laneW * 0.95, h = laneW * 0.62, dep = laneW * 0.32, jig = o.pulse ? (Math.random() - 0.5) * 4 : 0;
    g.position.set((o.lane - 1) * laneW + jig, 0, -o.d); g.visible = true;
    P.body.position.set(0, h / 2, -dep / 2); P.body.scale.set(w, h, dep);
    const e = 2.5, set = (m, x, y, sx, sy) => { m.position.set(x, y, 1); m.scale.set(sx, sy, 2); };
    set(P.l, -w / 2, h / 2, e, h + e); set(P.r, w / 2, h / 2, e, h + e); set(P.t, 0, h, w + e, e); set(P.b, 0, 0, w + e, e);
    set(P.hl, -w / 2, h / 2, 9, h + 9); set(P.hr, w / 2, h / 2, 9, h + 9); set(P.ht, 0, h, w + 9, 9);
    neon.color.copy(gU.uA.value).multiplyScalar(2.2 + (o.pulse ? 2 : 0)); halo.color.copy(gU.uA.value);
  };

  // ---------- soldiers: instanced parts, both teams in the same meshes ----------
  const MAXD = 760, SZ = 24 / 1.1;
  const teamC = [{ armour: LIN(0x2b8cff), dark: LIN(0x0f2a5c), helm: LIN(0xe6f6ff), visor: LIN(0x7fe8ff).multiplyScalar(2.6), blade: LIN(0x7fe8ff).multiplyScalar(1.9) },
    { armour: LIN(0xff2e4d), dark: LIN(0x3a0716), helm: LIN(0x2a0812), visor: LIN(0xffd23f).multiplyScalar(2.6), blade: LIN(0xff9aae).multiplyScalar(1.9) }];
  const litMat = (em) => { const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.2, clearcoat: 0.35, envMapIntensity: 0.35 });
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * ${em.toFixed(2)};`); }; m.customProgramCacheKey = () => "lgDude" + em; return m; };
  const PARTS = [
    { key: "legL", geo: new THREE.CapsuleGeometry(0.075, 0.3, 4, 8).translate(0, -0.2, 0), mat: litMat(0.05), at: [-0.09, 0.43, 0], tone: "dark", leg: 1 },
    { key: "legR", geo: new THREE.CapsuleGeometry(0.075, 0.3, 4, 8).translate(0, -0.2, 0), mat: litMat(0.05), at: [0.09, 0.43, 0], tone: "dark", leg: -1 },
    { key: "body", geo: new THREE.CapsuleGeometry(0.16, 0.24, 4, 12), mat: litMat(0.14), at: [0, 0.62, 0], tone: "armour" },
    { key: "shoulders", geo: new THREE.CapsuleGeometry(0.085, 0.3, 4, 8).rotateZ(Math.PI / 2), mat: litMat(0.14), at: [0, 0.8, 0], tone: "armour" },
    { key: "helm", geo: new THREE.SphereGeometry(0.15, 16, 12), mat: litMat(0.06), at: [0, 1.02, 0], tone: "helm" },
    { key: "visor", geo: new THREE.BoxGeometry(0.2, 0.055, 0.06), mat: new THREE.MeshBasicMaterial({ color: 0xffffff }), at: [0, 1.04, 0.13], tone: "visor" },
    { key: "blade", geo: new THREE.BoxGeometry(0.04, 0.62, 0.04), mat: new THREE.MeshBasicMaterial({ color: 0xffffff }), at: [0.27, 0.72, 0.1], tone: "blade", blade: 1 },
  ].map((p) => { const im = new THREE.InstancedMesh(p.geo, p.mat, MAXD); im.frustumCulled = false; im.count = 0; im.setColorAt(0, C.set(0xffffff)); scene.add(im); return Object.assign(p, { im }); });
  const pools = [];                                                  // light pools under each crowd
  const poolMat = (c) => new THREE.MeshBasicMaterial({ map: K.softTexture(), color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const mkPool = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), poolMat(0xffffff)); m.frustumCulled = false; scene.add(m); return m; };
  let nd = 0, np = 0;
  const offsCache = new Map(), offsets = (n, spread) => { const k = n + "|" + spread; let o = offsCache.get(k); if (!o) { o = S.crowdOffsets(n, spread); offsCache.set(k, o); if (offsCache.size > 300) offsCache.clear(); } return o; };
  const quatFace = (yaw) => Q.setFromAxisAngle(V.set(0, 1, 0), yaw);
  // a crowd standing on the ground at (x, depth d), facing the camera (team 1) or marching away (team 0)
  const crowd = (cx, d, count, team, t, maxDraw, spread, widthCap, scale = 1) => {
    const n = Math.min(count, maxDraw), tc = teamC[team], face = team ? 0 : Math.PI, S2 = SZ * scale;
    const rad = Math.min(Math.sqrt(n) * spread * scale + 14 * scale, widthCap || 1e9);
    const pl = pools[np] || (pools[np] = mkPool()); np++; pl.visible = true; pl.position.set(cx, 0.6, -d); pl.scale.set(rad * 1.25, 1, rad * 1.25 * 0.8);
    pl.material.color.setRGB(team ? 0.36 : 0.06, team ? 0.03 : 0.3, team ? 0.07 : 0.75);
    for (const [ox, oy] of offsets(n, spread)) {
      if (nd >= MAXD) break;
      let x = ox * scale; if (widthCap) x = Math.max(-widthCap, Math.min(widthCap, x));
      const px = cx + x, pz = -(d - oy * 2.2 * scale), ph = t * 14 + ox * 0.3 + oy, bob = Math.abs(Math.sin(ph)) * 0.04 * S2;
      const yaw = face + Math.sin(ox * 1.7 + oy) * 0.18; quatFace(yaw);
      for (const p of PARTS) {
        V.set(p.at[0] * S2, p.at[1] * S2 + bob, p.at[2] * S2).applyQuaternion(Q);
        let qq = Q; if (p.leg) { Q2.setFromAxisAngle(SC.set(1, 0, 0), Math.sin(ph) * 0.55 * p.leg); qq = Q2.premultiply(Q); }
        else if (p.blade) { Q2.setFromEuler(E.set(-0.5 + Math.sin(ph * 0.5) * 0.1, 0, -0.3)); qq = Q2.premultiply(Q); }
        M.compose(V.set(px + V.x, V.y, pz + V.z), qq, SC.setScalar(S2)); p.im.setMatrixAt(nd, M); p.im.setColorAt(nd, tc[p.tone]);
      }
      nd++;
    }
  };

  // ---------- bolts: white-hot shots with a blue glow ----------
  const BN = 120, boltCore = new THREE.InstancedMesh(new THREE.CapsuleGeometry(1, 1, 4, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.97, 1).multiplyScalar(3) }), BN);
  const boltGlow = new THREE.InstancedMesh(new THREE.CapsuleGeometry(1, 1, 4, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.4, 1), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), BN);
  for (const m of [boltCore, boltGlow]) { m.frustumCulled = false; m.count = 0; scene.add(m); }

  // ---------- post ----------
  const post = K.post(renderer, scene, camera, { bloom: [0.5, 0.42, 0.86], vignette: 0.6, grain: 0.018 });
  let RW = 0, RH = 0, dprNow = 0, lowFx = false, last = performance.now(), slow = 0;
  const resize = () => { const w = innerWidth, h = innerHeight, want = lowFx ? 1 : Math.min(devicePixelRatio || 1, q === "high" ? 1.75 : q === "medium" ? 1.3 : 1);
    if (w === RW && h === RH && want === dprNow) return; RW = w; RH = h; dprNow = want;
    renderer.setPixelRatio(want); renderer.setSize(w, h, false); post.composer.setPixelRatio(want); post.setSize(w, h); if (mir) mir.resize(); };
  const hexLin = (h, out) => out.set(h);

  return {
    ok: true, info: renderer.info,
    render(t) {
      resize();
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      slow = dt > 0.04 ? slow + dt : Math.max(0, slow - dt); if (!lowFx && slow > 2.5) { lowFx = true; if (mir) mir.on = false; resize(); }
      const W = S.W, H = S.H, hz = S.hz, baseY = S.baseY, laneW = S.laneW, T = S.T, h = baseY - hz;
      // the camera: the 2D projection exactly (principal point on the horizon, focal length 400)
      const fH = 2 * (H - hz); camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((fH / 2) / F)); camera.aspect = W / fH; camera.near = 20; camera.far = 40000;
      camera.setViewOffset(W, fH, 0, fH / 2 - hz, W, H);
      const sx = S.shakeOff[0], sy = S.shakeOff[1];                     // the same shake as the 2D layer, so the numbers stay on their gates
      camera.position.set(-sx, h + sy, F); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      sky.position.copy(camera.position);
      glowU.uPx.value = (RH * dprNow) / H * F;
      // colours of the level (Spectrum Run cycles them)
      hexLin(T.sky[0], skyU.u0.value); hexLin(T.sky[1], skyU.u1.value); hexLin(T.sky[2], skyU.u2.value); skyU.uK.value = F / hz; skyU.uT.value = t;
      hexLin(T.city[0], gU.uCity0.value); hexLin(T.city[1], gU.uCity1.value); hexLin(T.sky[0], gU.uSky0.value); hexLin(T.a, gU.uA.value); hexLin(T.b, gU.uB.value); hexLin(T.sky[2], gU.uG.value);
      gU.uScroll.value = S.scroll; gU.uLaneW.value = laneW; gU.uBK.value = h / (H - hz); gU.uLane.value = S.lane; gU.uLaneOn.value = S.phase === "run" ? 1 : 0; gU.uT.value = t;
      scene.fog.color.copy(gU.uG.value).multiplyScalar(0.35).lerp(gU.uCity0.value, 0.5); gU.uFogC.value.copy(scene.fog.color);
      cityU.uA.value.copy(gU.uA.value); cityU.uB.value.copy(gU.uB.value); cityU.uG.value.copy(gU.uG.value);
      hemi.color.copy(gU.uG.value).lerp(new THREE.Color(0x8a7aff), 0.6); rim.color.copy(gU.uG.value);
      // moon: where the 2D game puts it (86% across, 60% of the way down to the horizon)
      const mx = W * 0.86, my = hz * 0.6, mr = Math.min(W, H) * 0.055, md = 20000;
      V.set((mx - W / 2) / F, (hz - my) / F, -1); const dl = V.length(); V.normalize();
      moon.position.copy(camera.position).addScaledVector(V, md); moon.scale.setScalar(md * dl * mr / F); moonGlow.position.copy(moon.position).addScaledVector(V, 10); moonGlow.scale.setScalar(md * dl * mr * 3.2 / F);
      moonGlow.material.uniforms.uC.value.copy(gU.uG.value);
      // the skyline (rebuilt when the screen size or the level changes)
      const ck = `${W}|${H}|${S.THEME.name}`;
      if (ck !== cityFor) { cityFor = ck; const aT = city.userData.aT;
        TW.forEach((b, i) => { const d = b.layer ? 6500 : 9500, k = (F + d) / F, bh = b.h * hz * (b.layer ? 0.5 : 0.8), top = h + bh * k;
          M.compose(V.set((b.x * W + b.w * W / 2 - W / 2) * k, 0, -d), Q.identity(), SC.set(b.w * W * k, top, 40 * k)); city.setMatrixAt(i, M);
          aT[i * 4 + 2] = k; aT[i * 4 + 3] = top; city.setColorAt(i, C.set(b.layer ? S.THEME.city[1] : S.THEME.city[0]).multiplyScalar(b.layer ? 1.4 : 1.2)); });
        city.instanceMatrix.needsUpdate = true; city.geometry.attributes.aT.needsUpdate = true; if (city.instanceColor) city.instanceColor.needsUpdate = true; }
      // the road and its rails
      road.position.set(0, 0.2, -(20000 - 180) / 2 + 180); road.scale.set(3 * laneW, 1, 20000);
      const railCol = gU.uA.value; railM.color.copy(railCol).multiplyScalar(2.4); railGlowM.color.copy(railCol);
      [-1, 1].forEach((sd, i) => { rails[i].position.set(sd * 1.5 * laneW, 2, -(20000 - 180) / 2 + 180); rails[i].scale.set(3, 4, 20000); railGlow[i].position.copy(rails[i].position); railGlow[i].scale.set(12, 10, 20000); });
      ng = 0;
      // pylons
      let npy = 0; const sc = S.scroll;
      for (let k = 0; k < PY / 2; k++) { const d0 = ((k * 380 - sc) % 7600 + 7600) % 7600 - 150;
        for (const [side, dd] of [[-0.95, d0], [2.95, d0 + 190]]) { const x = (side - 1) * laneW;
          M.compose(V.set(x, 0, -dd), Q.identity(), SC.set(8, 150, 8)); pylon.setMatrixAt(npy, M); pylon.setColorAt(npy, C.copy(gU.uCity1.value).multiplyScalar(1.8));
          M.compose(V.set(x, 0, -dd + 4.2), Q.identity(), SC.set(2.4, 150, 1)); strip.setMatrixAt(npy, M); strip.setColorAt(npy, C.copy(gU.uA.value).multiplyScalar(2.2));
          M.compose(V.set(x, 150, -dd), Q.identity(), SC.setScalar(5)); orb.setMatrixAt(npy, M); orb.setColorAt(npy, C.setRGB(3, 3, 3));
          const g2 = gU.uG.value; glow(x, 150, -dd, 78, g2.r * 0.85, g2.g * 0.85, g2.b * 0.85); npy++; } }
      for (const m of [pylon, strip, orb]) { m.count = npy; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      // gates, walls and crowds
      nd = 0; np = 0; let ngate = 0, nwall = 0;
      const objs = S.objs.filter((o) => !o.dead || o.type === "boss");
      for (const o of objs) {
        if (o.d > 3000) continue;
        if (o.type === "gate") { if (o.done && o.d <= -30) continue; const g = gatePool[ngate] || (gatePool[ngate] = mkGate()); ngate++; placeGate(g, o, laneW, t); }
        else if (o.type === "wall") { const g = wallPool[nwall] || (wallPool[nwall] = mkWall()); nwall++; placeWall(g, o, laneW); }
        else if (o.type === "enemy") crowd((o.lane - 1) * laneW, o.d, o.n, 1, t + o.ph, 40, 8, laneW * 0.45);
        else if (o.type === "boss" && o.n > 0) crowd(0, o.d, o.n, 1, t, 110, 10, laneW * 1.45);
      }
      for (let i = ngate; i < gatePool.length; i++) gatePool[i].visible = false;
      for (let i = nwall; i < wallPool.length; i++) wallPool[i].visible = false;
      const ph = S.phase, army = S.army; armyL.intensity = 0; hordeL.intensity = 0;
      if (ph === "menu") crowd(0, 0, 24, 0, t, 24, 7.5, laneW * 0.55);
      else if (army > 0) { const shown = Math.min(army, Math.round(40 + 22 * Math.log10(Math.max(1, army)))), sc2 = 1 + S.armyPop * 0.25;
        const cap = (ph === "clash" ? laneW * 1.4 : laneW * (0.55 + Math.min(0.35, Math.log10(Math.max(1, army)) * 0.05))) * sc2;
        crowd((S.laneX - 1) * laneW, 0, shown, 0, t, 200, 7.5, cap, sc2); armyL.intensity = 3500; armyL.position.set((S.laneX - 1) * laneW, 90, 60); }
      const boss = S.objs.find((o) => o.type === "boss" && o.n > 0 && o.d < 3000); if (boss) { hordeL.intensity = 9000; hordeL.position.set(0, 140, -boss.d + 80); }
      for (const p of PARTS) { p.im.count = nd; p.im.instanceMatrix.needsUpdate = true; if (p.im.instanceColor) p.im.instanceColor.needsUpdate = true; }
      for (let i = np; i < pools.length; i++) pools[i].visible = false;
      // bolts
      let nb = 0;
      for (const b of S.bolts) { if (nb >= BN) break; const z0 = -b.d, z1 = -Math.max(0, b.d - 70), x = (b.x - 1) * laneW, len = Math.max(1, z0 - z1 < 0 ? z1 - z0 : z0 - z1);
        M.compose(V.set(x, 18, (z0 + z1) / 2), Q.identity(), SC.set(2, 2, len)); boltCore.setMatrixAt(nb, M); M.compose(V.set(x, 18, (z0 + z1) / 2), Q.identity(), SC.set(6, 6, len + 8)); boltGlow.setMatrixAt(nb, M);
        glow(x, 18, z0, 40, 0.1, 0.35, 0.9); nb++; }
      boltCore.count = boltGlow.count = nb; boltCore.instanceMatrix.needsUpdate = boltGlow.instanceMatrix.needsUpdate = true;
      gaP.needsUpdate = gaC.needsUpdate = gaS.needsUpdate = true; gGeo.setDrawRange(0, ng);
      if (mir) mir.beginFrame();
      post.render(dt);
    },
  };
}
