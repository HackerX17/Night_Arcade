// Chopper Cave in 3D: the same cave in real 3D, as loud and colourful as the Original. Rock walls with depth (Poly Haven rock,
// CC0) carved with the level's neon grid, thick glowing edges and pillar outlines that pulse with the beat, a deep cavern sky
// in the colour scheme (gradient, haze, drifting grid, stars, slow clouds), a lightning storm in the deep whose bolts light up
// the rock, electric arcs crackling between the crystals, a thunder strike at every new colour zone and a burst when you crash,
// speed streaks, floating embers, a camera that leans with the helicopter, a modelled helicopter with a turning rotor and a
// searchlight, 3D power-ups and portals, the shield bubble, sparks, bloom and a film grade. Hyperspace keeps its own look.
// Loaded only when the graphics switch is on 3D. Players who ask for reduced motion get no shake and soft, slow light.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

const U = 1 / 40;
// glowing lines (wall edges, pillar outlines, lightning, speed streaks): flat ribbons facing the camera, a hot core and a soft halo
const RIB_VS = `attribute float aSide, aHot; attribute vec3 aCol; varying float vS, vH; varying vec3 vC;
  void main(){ vS = aSide; vH = aHot; vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RIB_FS = `varying float vS, vH; varying vec3 vC;
  void main(){ float s = abs(vS), core = 1.0 - smoothstep(0.08, 0.24, s), halo = exp(-s * s * 5.0) * (1.0 - s) * 0.5;
    gl_FragColor = vec4(vC * (core * 1.15 + halo) + vec3(dot(vC, vec3(0.3, 0.45, 0.25))) * core * vH, 1.0); }`;
// the cavern beyond the tunnel: the Original's backdrop (gradient, haze right of centre, drifting grid, twinkling stars) plus
// slow clouds in the scheme's colours that light up around a bolt
const SKY_VS = `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `uniform vec3 uS0, uS1, uS2, uA, uB, uBoltCol; uniform float uT, uScroll, uGrid, uFlash, uCheap, uGain; uniform vec4 uBolt; uniform sampler2D uNeb;
  varying vec2 vP;
  float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec2 p = vP; float v = clamp(p.y / 7.5, -1.0, 1.0);
    vec3 col = mix(uS0, uS1, 0.5 + 0.3 * (1.0 - v * v));
    vec2 tq = vec2(p.x + uScroll * 0.12 + uT * 0.05, p.y) / vec2(40.0, 20.0);
    float n1 = texture2D(uNeb, tq).r, n2 = uCheap > 0.5 ? n1 : texture2D(uNeb, tq * 1.73 + vec2(0.31 - uT * 0.0025, 0.17)).g;
    float cl = smoothstep(0.32, 0.95, n1 * 0.62 + n2 * 0.38);
    col += uS2 * cl * 0.13 * (0.55 + 0.45 * (1.0 - abs(v))) + uB * smoothstep(0.62, 1.0, n2) * 0.07;
    vec2 hz = p - vec2(2.6, 0.0); col += uS2 * exp(-dot(hz, hz) / 70.0) * 0.14;
    vec2 gq = vec2(p.x + uScroll * 0.46, p.y + 0.75) / 1.5, gd = (0.5 - abs(fract(gq) - 0.5)) / fwidth(gq);
    col += uA * (1.0 - clamp(min(gd.x, gd.y) - 0.3, 0.0, 1.0)) * uGrid;
    vec2 sp = (p + vec2(uScroll * 0.08, 0.0)) * 1.6, si = floor(sp); float sr = hsh(si);
    vec2 so = vec2(hsh(si + 1.7), hsh(si + 9.2)) * 0.6 + 0.2; float sd = length(fract(sp) - so) / (fwidth(sp.x) * 1.3 + 1e-4);
    col += vec3(0.85, 0.9, 1.0) * step(0.92, sr) * (0.25 + 0.55 * abs(sin(uT * 1.3 + sr * 60.0))) * (1.0 - smoothstep(0.6, 1.5, sd));
    vec2 bd = p - uBolt.xy; col += uBoltCol * uBolt.z * exp(-dot(bd, bd) / (uBolt.w * uBolt.w)) * (0.15 + 0.9 * cl);
    gl_FragColor = vec4(col * uGain * (1.0 + uFlash), 1.0); }`;
// thin anti-aliased lines at whole numbers of v (about a pixel and a half wide, whatever the distance)
const LINE_GLSL = `float naLine(float v, float w){ float d = 0.5 - abs(fract(v) - 0.5); return 1.0 - clamp(d / max(fwidth(v), 1e-5) - w, 0.0, 1.0); }`;

// a seamless cloud texture (two layers of value noise), made once
function nebulaTexture() {
  const w = 256, h = 128, d = new Uint8Array(w * h * 4);
  const hash = (i, j, o) => { let x = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(o, 1442695041); x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  const vn = (x, y, px, py, o) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const i1 = (ix + 1) % px, j1 = (iy + 1) % py, a = hash(ix % px, iy % py, o), b = hash(i1, iy % py, o), c = hash(ix % px, j1, o), e = hash(i1, j1, o);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    for (let ch = 0; ch < 2; ch++) { let s = 0, amp = 0.5, norm = 0;
      for (let o = 0; o < 5; o++) { const f = 1 << o; s += vn((x / w) * 6 * f, (y / h) * 3 * f, 6 * f, 3 * f, o + ch * 7) * amp; norm += amp; amp *= 0.5; }
      d[i + ch] = Math.max(0, Math.min(255, Math.round(((s / norm - 0.5) * 2.2 + 0.5) * 255))); }
    d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, w, h); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

export function attach(S) {
  const VW = S.VW, VH = S.VH, COL = S.COL, q = K.tier(), CALM = !!window.ARCADE_CALM;
  let seed = 90210; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };   // own random numbers, so the game's never shift
  const renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const cv = renderer.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  S.cvs.parentNode.insertBefore(cv, S.cvs);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05010c); scene.fog = new THREE.FogExp2(0x07020f, 0.022);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 200);
  scene.environment = K.cityEnv(renderer, { sky: [0.02, 0.01, 0.06], horizon: [0.2, 0.08, 0.35], windows: 0.3 });
  const hemi = new THREE.HemisphereLight(0x8a6ad0, 0x201030, 0.45); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xb0a0ff, 0.55); fill.position.set(-4, 3, 10); scene.add(fill);
  const X = (x) => (x - VW / 2) * U, Y = (y) => (VH / 2 - y) * U, col3 = (c, k = 1) => new THREE.Color(c[0] / 255 * k, c[1] / 255 * k, c[2] / 255 * k);
  const lin = (c, o) => o.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
  // the scheme's colours in linear light, refreshed every frame as the cave melts from one scheme into the next
  const cA = new THREE.Color(), cB = new THREE.Color(), cS0 = new THREE.Color(), cS1 = new THREE.Color(), cS2 = new THREE.Color(), cC0 = new THREE.Color(), cC1 = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);

  // the cavern sky behind everything
  const skyU = { uS0: { value: cS0 }, uS1: { value: cS1 }, uS2: { value: cS2 }, uA: { value: cA }, uB: { value: cB }, uBoltCol: { value: new THREE.Color() }, uBolt: { value: new THREE.Vector4(0, 0, 0, 1) },
    uT: { value: 0 }, uScroll: { value: 0 }, uGrid: { value: 0.1 }, uFlash: { value: 0 }, uCheap: { value: 0 }, uGain: { value: 1.2 }, uNeb: { value: nebulaTexture() } };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, depthWrite: false }));
  sky.position.z = -7.4; sky.renderOrder = -1; scene.add(sky);

  // rock: ceiling and floor as surfaces running back into the dark (their front edge is exactly the game's wall), with the
  // Original's neon grid cut into it: lines across the rock face and a perspective grid on the rock running back
  const rock = K.pbr("rock_face", { repeat: [1, 1], color: 0x8a7f9a, roughness: 1 }); rock.side = THREE.DoubleSide;
  const gridU = { uGridCol: { value: new THREE.Color() }, uAnchor: { value: 0 } }, stripeU = { uStripeCol: { value: new THREE.Color() } };
  const withWorldPos = (sh) => { sh.vertexShader = "varying vec3 vWp;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;"); };
  rock.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, gridU); withWorldPos(sh);
    sh.fragmentShader = "varying vec3 vWp; uniform vec3 uGridCol; uniform float uAnchor;\n" + LINE_GLSL + "\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      { float gx = naLine((vWp.x + uAnchor) / 1.2, 0.35), gy = vWp.z > 0.02 ? naLine(vWp.y / 0.3, 0.2) : naLine(vWp.z / 0.7, 0.35);
        totalEmissiveRadiance += uGridCol * max(gx, gy * 0.75) * exp(min(vWp.z, 0.0) * 0.3); }`); };
  // HIST columns that already scrolled off the left are kept, so screens wider than the game see real rock past its edge
  const ND = 9, Z = [0.9, 0.0, -0.4, -1.0, -1.8, -2.8, -4.0, -5.4, -7.0], HIST = 12, NCOL = HIST + 80, hist = [];
  let prevFirst = null, prevCols = [];
  const surf = (top) => { const n = NCOL * 2 * ND, geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const idx = []; for (let c = 0; c < NCOL * 2 - 1; c++) for (let j = 0; j < ND - 1; j++) { const a = c * ND + j, b = (c + 1) * ND + j; top ? idx.push(a, b, a + 1, b, b + 1, a + 1) : idx.push(a, a + 1, b, b, a + 1, b + 1); }
    geo.setIndex(idx); const m = new THREE.Mesh(geo, rock); m.frustumCulled = false; scene.add(m); return m; };
  const ceil = surf(true), flo = surf(false);
  const rough = (x, z) => 0.18 * Math.sin(x * 1.7 + z * 0.9) + 0.1 * Math.sin(x * 3.1 - z * 2.3) + 0.06 * Math.sin(x * 5.3 + z * 4.1) + 0.14 * Math.sin(z * 0.8 + x * 0.3);
  // pillars: rock with the Original's glowing stripes; their outline is drawn as a neon ribbon
  const pillarMat = K.pbr("rock_face", { repeat: [0.5, 1], color: 0x6a5f7a }), pillarEdge = new THREE.LineBasicMaterial({ color: 0xffffff });
  pillarMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, stripeU); withWorldPos(sh);
    sh.fragmentShader = "varying vec3 vWp; uniform vec3 uStripeCol;\n" + LINE_GLSL + "\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += uStripeCol * naLine(vWp.y / 0.2, 0.3);"); };
  const pillars = [];
  // neon crystals growing out of the rock, anchored to the cave as it scrolls
  const crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshPhysicalMaterial({ roughness: 0.12, metalness: 0.1, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0.0 }), 90);
  crystals.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n #if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )\n totalEmissiveRadiance = vColor * 1.4;\n #endif"); };
  crystals.frustumCulled = false; scene.add(crystals);
  const cry = [], cvis = [], lights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 9, 2); scene.add(l); return l; });
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
  const icon = (type) => iconTex[type] || (iconTex[type] = (() => { const cvx = document.createElement("canvas"); cvx.width = cvx.height = 64; const g = cvx.getContext("2d"); g.strokeStyle = g.fillStyle = "#fff"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); const x = 32, y = 32;
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
  // trail, sparks and embers: soft glowing points
  const MAXG = 900, gPos = new Float32Array(MAXG * 3), gCol = new Float32Array(MAXG * 3), gSize = new Float32Array(MAXG), gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3)); gGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3)); gGeo.setAttribute("size", new THREE.BufferAttribute(gSize, 1));
  const gMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTex: { value: K.softTexture() }, uScale: { value: 400 } },
    vertexShader: "attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform sampler2D uTex; varying vec3 vC; void main(){ gl_FragColor = vec4(vC * texture2D(uTex, gl_PointCoord).a, 1.0); }" });
  const glows = new THREE.Points(gGeo, gMat); glows.frustumCulled = false; scene.add(glows);
  // the glowing ribbons: one set drawn over the rock (edges, outlines), one that the rock can hide (lightning, streaks)
  const ribbons = (max, depthTest) => {
    const pos = new Float32Array(max * 6), side = new Float32Array(max * 2), hot = new Float32Array(max * 2), col = new Float32Array(max * 6), idx = new Uint16Array(max * 6), geo = new THREE.BufferGeometry();
    const at = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", at(pos, 3)); geo.setAttribute("aSide", at(side, 1)); geo.setAttribute("aHot", at(hot, 1)); geo.setAttribute("aCol", at(col, 3)); geo.setIndex(at(idx, 1));
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: RIB_VS, fragmentShader: RIB_FS, transparent: true, depthWrite: false, depthTest, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    mesh.frustumCulled = false; mesh.renderOrder = depthTest ? 3 : 9; scene.add(mesh);
    let np = 0, ni = 0;
    return {
      begin() { np = 0; ni = 0; },
      // a line through n points (x, y, z in P), half-width w, colour already scaled by brightness, h = how white the core runs;
      // closed joins the last point to the first; fade 1 brightens from the first point to the last, -1 dims toward the last
      line(P, n, w, r, g, b, h = 0.25, closed = false, fade = 0) {
        const m = closed ? n + 1 : n; if (n < 2 || np + m > max) return;
        for (let i = 0; i < m; i++) {
          const c = i % n, x = P[c * 3], y = P[c * 3 + 1], z = P[c * 3 + 2], hasP = closed || i > 0, hasN = closed || i < m - 1;
          let ax = 0, ay = 0, bx = 0, by = 0;
          if (hasP) { const j = closed ? (c - 1 + n) % n : i - 1; ax = x - P[j * 3]; ay = y - P[j * 3 + 1]; const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; }
          if (hasN) { const j = closed ? (c + 1) % n : i + 1; bx = P[j * 3] - x; by = P[j * 3 + 1] - y; const l = Math.hypot(bx, by) || 1; bx /= l; by /= l; }
          if (!hasP) { ax = bx; ay = by; } if (!hasN) { bx = ax; by = ay; }
          let mx = -(ay + by), my = ax + bx, ml = Math.hypot(mx, my); if (ml < 1e-3) { mx = -ay; my = ax; ml = 1; }
          mx /= ml; my /= ml; const k = w / Math.max(0.4, -mx * ay + my * ax), a = fade > 0 ? i / (m - 1) : fade < 0 ? 1 - i / (m - 1) : 1, v = (np + i) * 2;
          pos[v * 3] = x + mx * k; pos[v * 3 + 1] = y + my * k; pos[v * 3 + 2] = z; pos[v * 3 + 3] = x - mx * k; pos[v * 3 + 4] = y - my * k; pos[v * 3 + 5] = z;
          side[v] = 1; side[v + 1] = -1; hot[v] = hot[v + 1] = h;
          col[v * 3] = col[v * 3 + 3] = r * a; col[v * 3 + 1] = col[v * 3 + 4] = g * a; col[v * 3 + 2] = col[v * 3 + 5] = b * a;
        }
        for (let i = 0; i < m - 1; i++) { const a = (np + i) * 2; idx[ni++] = a; idx[ni++] = a + 1; idx[ni++] = a + 2; idx[ni++] = a + 1; idx[ni++] = a + 3; idx[ni++] = a + 2; }
        np += m;
      },
      end() { geo.setDrawRange(0, ni); for (const k of ["position", "aSide", "aHot", "aCol"]) geo.attributes[k].needsUpdate = true; geo.index.needsUpdate = true; },
    };
  };
  const front = ribbons(900, false), deep = ribbons(1600, true);
  const EP = new Float32Array(200 * 3), PP = new Float32Array(12), BP = new Float32Array(20 * 3), BQ = new Float32Array(12 * 3), SP = new Float32Array(6);

  // ---------- lightning ----------
  // a bolt is a jagged line between two points (offsets across it, as a share of its length), with a few forks; sky bolts strike
  // in the cavern behind the tunnel, arcs jump between two crystals, bursts fly out from the helicopter
  const bolts = [];
  const jag = (o, rough) => { const n = o.length; o[0] = o[n - 1] = 0; for (let st = (n - 1) >> 1; st >= 1; st >>= 1) for (let i = st; i < n - 1; i += st * 2) o[i] = (o[i - st] + o[i + st]) * 0.5 + (R() - 0.5) * rough * (st / (n - 1)) * 2; return o; };
  const addBolt = (b) => { if (bolts.length > 36) return null; b.o = jag(new Float32Array(b.n), b.rough); b.age = 0; b.brs = [];
    for (let i = 0; i < (b.br || 0); i++) b.brs.push({ j: 2 + Math.floor(R() * (b.n - 5)), a: (R() < 0.5 ? -1 : 1) * (0.35 + R() * 0.6), l: 0.22 + R() * 0.3, o: jag(new Float32Array(9), b.rough * 1.2) });
    b.re = b.kind === "arc" ? [] : [0.08 + R() * 0.05, ...(b.kind === "sky" && R() < 0.6 ? [0.19 + R() * 0.07] : [])]; b.rs = 0; bolts.push(b); return b; };
  // the light a strike throws: one soft pulse (never a flicker) on the rock, and a glow in the clouds behind
  let lightE = 0, skyE = 0, skyR = 5, surge = 0, shake = 0; const lightP = new THREE.Vector3(), lightC = new THREE.Color(), skyC = new THREE.Color(), skyP = new THREE.Vector2();
  const storm = new THREE.PointLight(0xffffff, 0, 40, 1.3); scene.add(storm);
  const flashAt = (x, y, z, c, e, sky, r = 5) => { if (e >= lightE * 0.6) { lightP.set(x, y, z); lightC.copy(c); } lightE = Math.max(lightE, e);
    if (sky) { skyP.set(x * 1.12, y * 1.12); skyC.copy(c); skyR = r; skyE = Math.max(skyE, e); } };
  const pickCol = () => { const r = R(); return new THREE.Color().copy(r < 0.4 ? cA : r < 0.7 ? cS2 : r < 0.85 ? cB : WHITE); };
  const skyBolt = (x = camX + (R() - 0.5) * 20, big = false) => { const z = big ? -4.6 : -4.2 - R() * 2.6, c = big ? new THREE.Color().copy(cA).lerp(WHITE, 0.2) : pickCol();
    if (big || R() < 0.7) { const by = -3 - R() * 5; addBolt({ kind: "sky", ax: x, ay: 8, az: z, bx: x + (R() - 0.5) * 5, by, bz: z, n: 17, rough: 0.32, w: big ? 0.1 : 0.07 + R() * 0.035, life: big ? 0.7 : 0.5, col: c, k: big ? 2.6 : 2.4, hot: 0.85, br: 2 + Math.floor(R() * 3) });
      flashAt(x, Math.max(-4, (8 + by) / 2), -1, c, big ? 0.55 : 0.45 + R() * 0.25, true, big ? 5.5 : 4.5 + R() * 1.5); }
    else { const y = (3.8 + R() * 2.4) * (R() < 0.5 ? 1 : -1), l = 2.5 + R() * 2.5; addBolt({ kind: "sky", ax: x - l, ay: y, az: z, bx: x + l, by: y + (R() - 0.5) * 1.2, bz: z, n: 17, rough: 0.22, w: 0.06, life: 0.45, col: c, k: 2, hot: 0.85, br: 2 });
      flashAt(x, y * 0.6, -1.5, c, 0.4, true, 6); } };
  const megastrike = () => { for (const dx of [-7, 0, 7]) skyBolt(camX + dx + (R() - 0.5) * 2, true); surge = 1; if (!CALM) shake = Math.max(shake, 0.35); };
  const burst = (x, y, c, nb, k) => { for (let i = 0; i < nb; i++) { const a = ((i + R() * 0.6) / nb) * Math.PI * 2, len = 1.1 + R() * 1.6;
      addBolt({ kind: "burst", ax: x, ay: y, az: 0.12, bx: x + Math.cos(a) * len, by: y + Math.sin(a) * len, bz: 0.12, n: 9, rough: 0.45, w: 0.06, life: 0.32 + R() * 0.15, col: new THREE.Color().copy(c), k: 3 * k, hot: 0.9, br: 1, fade: -1 }); }
    flashAt(x, y, 1.2, c, 0.9 * k, false); if (!CALM) shake = Math.max(shake, 0.6 * k); };
  const env = (b) => { const a = b.age, u = a / b.life;
    if (CALM) return Math.sin(Math.min(1, u) * Math.PI) * 0.6;
    if (b.kind === "arc") return (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * (R() < 0.75 ? 1 : 0.3);
    let e = a < 0.025 ? a / 0.025 : Math.exp(-(a - 0.025) * 9);
    for (let i = 0; i < b.re.length; i++) if (a > b.re[i]) e += (i ? 0.55 : 0.85) * Math.exp(-(a - b.re[i]) * 15);
    return Math.min(1.25, e) * Math.min(1, (1 - u) * 6); };
  const drawBolt = (b) => {
    let ax = b.ax, ay = b.ay, az = b.az, bx = b.bx, by = b.by, bz = b.bz;
    if (b.ca) { ax = b.ca.tx; ay = b.ca.ty; az = b.ca.tz; bx = b.cb.tx; by = b.cb.ty; bz = b.cb.tz; }
    while (b.rs < b.re.length && b.age > b.re[b.rs]) { b.rs++; for (let i = 1; i < b.n - 1; i++) b.o[i] += (R() - 0.5) * b.rough * 0.2; }   // a restrike jumps a little
    if (b.kind === "arc" && !CALM) jag(b.o, b.rough);                                                                                         // arcs crackle every frame
    const e = env(b); if (b.ca) { b.ca.fl = Math.max(b.ca.fl || 0, e); b.cb.fl = Math.max(b.cb.fl || 0, e); } if (e < 0.01) return;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-3, px = -dy / len, py = dx / len, k = b.k * e;
    for (let i = 0; i < b.n; i++) { const u = i / (b.n - 1), o = b.o[i] * len; BP[i * 3] = ax + dx * u + px * o; BP[i * 3 + 1] = ay + dy * u + py * o; BP[i * 3 + 2] = az + (bz - az) * u; }
    deep.line(BP, b.n, b.w, b.col.r * k, b.col.g * k, b.col.b * k, b.hot, false, b.fade || 0);
    const ang = Math.atan2(dy, dx);
    for (const f of b.brs) { const sx = BP[f.j * 3], sy = BP[f.j * 3 + 1], sz = BP[f.j * 3 + 2], fl = len * f.l, ex = sx + Math.cos(ang + f.a) * fl, ey = sy + Math.sin(ang + f.a) * fl, qx = -(ey - sy) / fl, qy = (ex - sx) / fl;
      for (let i = 0; i < 9; i++) { const u = i / 8, o = f.o[i] * fl; BQ[i * 3] = sx + (ex - sx) * u + qx * o; BQ[i * 3 + 1] = sy + (ey - sy) * u + qy * o; BQ[i * 3 + 2] = sz; }
      const kb = k * 0.65; deep.line(BQ, 9, b.w * 0.6, b.col.r * kb, b.col.g * kb, b.col.b * kb, b.hot * 0.7, false, -1); }
  };
  // speed streaks rushing past behind the tunnel, and embers drifting in the dark
  const mkStreak = (init) => ({ x: init ? (R() - 0.5) * 34 : 17 + R() * 8, y: (R() - 0.5) * 12, z: -0.6 - R() * 4.2, l: 0.5 + R() * 1.3, v: 1.25 + R() * 1.1, k: 0.16 + R() * 0.26, c: Math.floor(R() * 3) });
  const mkMote = (init) => ({ x: init ? (R() - 0.5) * 32 : 16 + R() * 4, y: (R() - 0.5) * 11, z: -0.4 - R() * 5.5, ph: R() * 6.28, s: 0.05 + R() * 0.09, c: Math.floor(R() * 3), vy: (R() - 0.5) * 0.25 });
  const streaks = Array.from({ length: 34 }, () => mkStreak(true)), motes = Array.from({ length: 46 }, () => mkMote(true));

  const post = K.post(renderer, scene, camera, { bloom: [0.6, 0.45, 0.86], vignette: 0.7, grain: 0.02 });
  let W = 0, Hh = 0, dprCap = q === "high" ? 2 : 1.5;
  const resize = (w, h, force) => { if (w === W && h === Hh && !force) return; W = w; Hh = h; const dpr = Math.min(devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr); renderer.setSize(W, Hh, false); post.composer.setPixelRatio(dpr); post.setSize(W, Hh); camera.aspect = W / Hh; camera.updateProjectionMatrix(); };
  // the camera leans with the helicopter: it moves, and the lens shifts back by the same amount, so the plane of the game stays
  // exactly where the Original draws it while everything deeper slides past it
  let camX = 0, camY = 0;
  const fit = (L, sx, sy) => { const fov = THREE.MathUtils.degToRad(camera.fov), th = Math.tan(fov / 2), d = (VH * U * Hh) / (2 * th * Math.max(60, VH * L.S)), ppu = Hh / (2 * d * th);
    camera.position.set(camX + sx, camY + sy, d); camera.quaternion.identity();
    const cx = L.OX + (VW * L.S) / 2, cy = L.OY + (VH * L.S) / 2; camera.setViewOffset(W, Hh, W / 2 - cx - camX * ppu, Hh / 2 - cy + camY * ppu, W, Hh); camera.updateMatrixWorld();
    gMat.uniforms.uScale.value = Hh * 0.5 / th; };
  // frame guard: if frames keep running long, give up the costliest things one at a time (resolution, then the extras, then bloom)
  let lastNow = 0, warm = 0, slowT = 0, level = q === "low" ? 2 : 0;
  const guard = (L) => { const now = performance.now(), fdt = lastNow ? (now - lastNow) / 1000 : 0; lastNow = now; if (warm < 90) { warm++; return; }
    if (fdt <= 0 || fdt > 0.25) return; slowT = fdt > 0.022 ? slowT + fdt : Math.max(0, slowT - fdt * 0.5);
    if (slowT < 1.5 || level >= 3) return; slowT = 0; level++;
    if (level === 1) { if (Math.min(devicePixelRatio || 1, dprCap) > 1) { dprCap = 1; resize(L.W, L.H, true); } else level++; }
    if (level === 3) post.bloom.enabled = false; };
  if (level >= 2) skyU.uCheap.value = 1;
  const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color(), GREY = new THREE.Color(0x8a7f9a);
  let ng = 0; const glow = (x, y, z, c, size) => { if (ng >= MAXG) return; gPos[ng * 3] = x; gPos[ng * 3 + 1] = y; gPos[ng * 3 + 2] = z; gCol[ng * 3] = c.r; gCol[ng * 3 + 1] = c.g; gCol[ng * 3 + 2] = c.b; gSize[ng] = size; ng++; };
  let lastT = -1, lastState = "", lastGrace = 0, lastStage = 0, lastDist = 0, spd = 210, nextSky = 1.2, nextArc = 0.6, frame = 0;

  return {
    ok: true,
    project(x, y) { V.set(X(x), Y(y), 0).project(camera); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * Hh]; },
    fx: { strike: () => skyBolt(), mega: () => megastrike(), get level() { return level; } },   // test hooks
    render(t) {
      const L = S.layout; guard(L); resize(L.W, L.H);
      const gap = lastT < 0 ? 0 : t - lastT, dt = lastT < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, gap)); lastT = t; frame++;
      const P = S.P, cols = S.cols, scroll = S.scroll, dist = S.dist || 0, state = S.state, h = S.heli, extras = level < 2; ng = 0;
      front.begin(); deep.begin();
      // how fast the cave runs (from how far it moved), for the streaks and embers
      if (dt > 0) { const v = state === "play" ? Math.max(0, (dist - lastDist) / dt) : 40; spd += (Math.min(600, v) - spd) * (1 - Math.pow(0.9, dt * 60)); } lastDist = dist;
      // the scheme's colours; the beat (from the game's own soundtrack when it plays) and the surge after a thunder strike
      lin(P.a, cA); lin(P.b, cB); lin(P.s0, cS0); lin(P.s1, cS1); lin(P.s2, cS2); lin(P.c0, cC0); lin(P.c1, cC1);
      const A = col3(P.a), S2 = col3(P.s2), C0 = col3(P.c0);
      const AS = window.ArcadeSound, bt = AS && AS.playing && typeof AS.beat === "number" ? AS.beat : -1, synced = bt >= 0, bp = synced ? bt : (t * 130 / 60) % 1;
      const pulse = CALM ? 0 : Math.exp(-bp * 7) * (synced ? 1 : 0.4); surge = Math.max(0, surge - dt * 0.8); const glowK = 1 + 0.3 * pulse + 0.7 * surge;
      // events: a crash, a shield save, back from Hyperspace, a new colour zone
      if (h) { const hx = X(S.HELI_X), hy = Y(h.y);
        if (state === "dead" && lastState === "play") burst(hx, hy, WHITE, 7, 1);
        else if (state === "play" && lastState === "play" && gap > 0.3 && (S.flash || 0) > 0.5) burst(hx, hy, C.setRGB(1, 0.24, 0.88), 6, 0.8);   // back from Hyperspace (drawn by the page meanwhile)
        else if (state === "play" && lastState === "play" && S.grace > lastGrace + 0.5) burst(hx, hy, C.setRGB(0, 0.8, 1), 5, 0.6); }
      const stg = Math.floor(dist / 2500); if (stg < lastStage || state === "title") lastStage = stg; if (state === "play" && stg > lastStage) { lastStage = stg; megastrike(); }
      lastState = state; lastGrace = S.grace || 0;
      // the camera: leaning with the helicopter, swaying slowly, shaken by thunder and crashes
      const ez = 1 - Math.pow(0.95, dt * 60), ty = h ? Y(h.y) * (CALM ? 0.08 : 0.16) : 0, tx = CALM ? 0 : Math.sin(t * 0.19) * 0.35;
      camX += (tx - camX) * ez; camY += (ty - camY) * ez; shake *= Math.pow(0.015, dt);
      fit(L, shake > 0.003 ? (R() - 0.5) * shake * 0.5 : 0, shake > 0.003 ? (R() - 0.5) * shake * 0.5 : 0);
      // colour everything in the scheme
      scene.background.copy(cS0); scene.fog.color.copy(cS0).lerp(cS1, 0.45);
      hemi.color.setRGB(0.54, 0.42, 0.82).lerp(cS2, 0.35); hemi.groundColor.copy(cC1); fill.color.setRGB(0.69, 0.63, 1).lerp(cA, 0.3);
      rock.color.copy(C0).multiplyScalar(1.1).lerp(GREY, 0.3); rock.emissive.copy(C0).multiplyScalar(0.25);
      gridU.uGridCol.value.copy(cB).multiplyScalar(1.0 * glowK); gridU.uAnchor.value = (VW / 2 + dist) * U; stripeU.uStripeCol.value.copy(cS2).multiplyScalar(0.4 * glowK);
      pillarEdge.color.copy(cS2).multiplyScalar(1.2);
      skyU.uT.value = t; skyU.uScroll.value = dist * U; skyU.uGrid.value = 0.08 + 0.1 * pulse + 0.15 * surge; skyU.uCheap.value = extras ? 0 : 1;
      // walls, and the glowing edge along each
      const n = Math.min(80, cols.length);
      if (cols.length && cols[0] !== prevFirst) { const i = prevCols.indexOf(cols[0]); if (i < 0) hist.length = 0; else for (let j = 0; j < i; j++) hist.push(prevCols[j]);
        while (hist.length > HIST) hist.shift(); prevFirst = cols[0]; prevCols = cols.slice(0, 8); }
      const colAt = (ci) => (ci < 0 ? hist[hist.length + ci] || cols[0] : cols[Math.min(ci, n - 1)]);
      for (const [mesh, top] of [[ceil, true], [flo, false]]) {
        const pos = mesh.geometry.attributes.position.array, uv = mesh.geometry.attributes.uv.array;
        let v = 0, ne = 0;
        for (let c = -HIST; c < 80; c++) for (let s = 0; s < 2; s++) {
          const col = colAt(c), gx = c * COL - scroll + s * COL, gy = col ? (top ? S.wallTop(col) : S.wallBot(col)) : (top ? 0 : VH);
          const x = X(gx), y0 = Y(gy), ax = (gx + dist) * U;
          for (let j = 0; j < ND; j++) { const z = Z[j], k = z > 0 ? z * 18 : 0, back = z < 0 ? -z : 0;   // the rock face rises 16 units: enough to fill an upright phone
            const y = top ? y0 + rough(ax, z) * (back > 0.2 ? 1 : back * 5) + k + back * back * 0.04 : y0 - rough(ax + 7, z) * (back > 0.2 ? 1 : back * 5) - k - back * back * 0.04;
            pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; uv[v * 2] = ax * 0.35; uv[v * 2 + 1] = (z > 0 ? k * 0.09 : z * 0.35) + (top ? 0.5 : 0); v++; }
          if (!(ne && Math.abs(EP[ne * 3 - 3] - x) < 1e-5 && Math.abs(EP[ne * 3 - 2] - y0) < 1e-5)) { EP[ne * 3] = x; EP[ne * 3 + 1] = y0; EP[ne * 3 + 2] = 0.05; ne++; }
        }
        mesh.geometry.attributes.position.needsUpdate = mesh.geometry.attributes.uv.needsUpdate = true; mesh.geometry.computeVertexNormals();
        const ek = 1.2 * glowK; front.line(EP, ne, 0.13, cA.r * ek, cA.g * ek, cA.b * ek, 0.12);
      }
      // pillars, outlined in neon
      const bl = S.blocks || [], pk = 1.25 * glowK;
      bl.forEach((b0, i) => { let p = pillars[i]; if (!p) { p = pillars[i] = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), pillarMat); const ed = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), pillarEdge); p.add(box, ed); scene.add(p); }
        const b = S.blockBox(b0); p.visible = true; p.position.set(X(b.x + b.w / 2), Y(b.y + b.h / 2), -0.25); p.scale.set(b.w * U, b.h * U, 1.1);
        PP.set([X(b.x), Y(b.y), 0.31, X(b.x + b.w), Y(b.y), 0.31, X(b.x + b.w), Y(b.y + b.h), 0.31, X(b.x), Y(b.y + b.h), 0.31]); front.line(PP, 4, 0.11, cS2.r * pk, cS2.g * pk, cS2.b * pk, 0.12, true); });
      for (let i = bl.length; i < pillars.length; i++) pillars[i].visible = false;
      // crystals: spawn ahead as the cave scrolls, drop the ones left behind; they flare with the beat and when an arc hits them
      while (cryNext < dist + VW + 200) { cryNext += 18 + R() * 46; cry.push({ ax: cryNext, top: R() < 0.5, z: -0.2 - R() * 2.6, s: 0.12 + R() * 0.22, rot: R() * 3, tilt: (R() - 0.5) * 0.7, k: Math.floor(R() * 3), fl: 0 }); }
      while (cry.length && cry[0].ax < dist - 80) cry.shift();
      let nc = 0, li = 0; const kc = [A, S2, col3(P.b)]; cvis.length = 0;
      for (const c of cry) { c.fl = Math.max(0, (c.fl || 0) - dt * 5); if (nc >= 90) break; const gx = c.ax - dist; if (gx < -60 || gx > VW + 60) continue; const col = colAt(Math.floor((gx + scroll) / COL)); if (!col) continue;
        const gy = c.top ? S.wallTop(col) : S.wallBot(col), back = -c.z, y = Y(gy) + (c.top ? rough(c.ax * U, c.z) + back * back * 0.04 : -rough(c.ax * U + 7, c.z) - back * back * 0.04), cy = y + (c.top ? -c.s * 1.2 : c.s * 1.2);
        E.set(c.top ? Math.PI : 0, c.rot, c.tilt); M.compose(V.set(X(gx), cy, c.z), Q.setFromEuler(E), SC.set(c.s * 0.55, c.s * 2.2, c.s * 0.55)); crystals.setMatrixAt(nc, M);
        crystals.setColorAt(nc, C.copy(kc[c.k]).multiplyScalar(0.9 + 0.35 * pulse + c.fl * 2.2)); nc++;
        c.tx = X(gx); c.ty = cy + (c.top ? -1 : 1) * c.s * 1.9; c.tz = c.z; c.seen = frame; if (gx > -10 && gx < VW + 10) cvis.push(c);
        if (li < (extras ? 3 : 1) && c.z > -1.6 && gx > 40 && gx < VW - 40 && (nc % 4 === 1)) { const l = lights[li++]; l.position.set(X(gx), y + (c.top ? -0.5 : 0.5), c.z + 0.4); l.color.copy(kc[c.k]); l.intensity = 11 * (1 + 0.4 * pulse + c.fl); } }
      for (; li < 3; li++) lights[li].intensity = 0;
      crystals.count = nc; crystals.instanceMatrix.needsUpdate = true; if (crystals.instanceColor) crystals.instanceColor.needsUpdate = true;
      // lightning: storm bolts in the cavern, arcs between neighbouring crystals
      if ((nextSky -= dt) <= 0) { nextSky = CALM ? 3.5 + R() * 4 : 1.0 + R() * 2.6; skyBolt(); }
      if ((nextArc -= dt) <= 0) { nextArc = 0.18 + R() * 0.6;
        if (extras && cvis.length > 3) { const a = cvis[Math.floor(R() * cvis.length)]; let best = null, bd = 1e9;
          for (const b of cvis) { if (b === a || b.top !== a.top) continue; const dx = Math.abs(b.tx - a.tx); if (dx < 0.8 || dx > 4.2 || Math.abs(b.tz - a.tz) > 1.6) continue; const sc = Math.abs(dx - 2.2) + R(); if (sc < bd) { bd = sc; best = b; } }
          if (best) addBolt({ kind: "arc", ca: a, cb: best, n: 9, rough: 0.55, w: 0.045, life: 0.14 + R() * 0.2, col: lin(P[["a", "s2", "b"][a.k]], new THREE.Color()), k: 2.8, hot: 0.8, br: R() < 0.4 ? 1 : 0 }); } }
      for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.age += dt;
        if (b.age >= b.life || (b.ca && (b.ca.seen !== frame || b.cb.seen !== frame))) { bolts.splice(i, 1); continue; } drawBolt(b); }
      lightE *= Math.exp(-dt * 5.5); skyE *= Math.exp(-dt * 4.5);
      storm.position.copy(lightP); storm.color.copy(lightC); storm.intensity = lightE * 28 * (CALM ? 0.35 : 1); hemi.intensity = 0.45 + lightE * 0.12 * (CALM ? 0.3 : 1);
      skyU.uBolt.value.set(skyP.x, skyP.y, skyE * 0.6 * (CALM ? 0.4 : 1), skyR); skyU.uBoltCol.value.copy(skyC);
      // speed streaks and embers
      const vw = spd * U, lenK = 0.5 + spd / 240, sk = Math.min(1.1, Math.max(0.25, (spd - 120) / 260)), kcl = [cA, cS2, WHITE];
      for (let i = 0; i < streaks.length; i++) { const s = streaks[i]; s.x -= vw * s.v * dt; if (s.x + s.l * lenK < -18) Object.assign(s, mkStreak(false)); if (!extras && i % 2) continue;
        SP[0] = s.x + s.l * lenK; SP[1] = s.y; SP[2] = s.z; SP[3] = s.x; SP[4] = s.y; SP[5] = s.z; const c = kcl[s.c], k = s.k * sk; deep.line(SP, 2, 0.03, c.r * k, c.g * k, c.b * k, 0.2, false, 1); }
      for (let i = 0; i < motes.length; i++) { const m = motes[i]; m.x -= vw * dt; m.y += m.vy * dt; if (m.x < -17 || Math.abs(m.y) > 7) Object.assign(m, mkMote(false)); if (!extras && i % 2) continue;
        glow(m.x, m.y + Math.sin(t * 0.7 + m.ph) * 0.15, m.z, C.copy(kcl[m.c]).multiplyScalar(0.45 * (0.6 + 0.4 * Math.sin(t * 2.3 + m.ph * 3))), m.s); }
      // the helicopter
      const showH = state !== "dead" || S.deadT < 0.05, blink = S.grace > 0 && !S.powers.shield && Math.sin(t * 30) < -0.6;
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
      for (const s of S.sparks || []) { if (s.col) C.copy(col3(s.col)); else C.copy(s.life > 0.7 ? WHITE : s.life > 0.35 ? A : S2); C.multiplyScalar(Math.min(1, s.life * 1.6) * 1.5); glow(X(s.x), Y(s.y), 0.1, C, 7 * U); }
      gGeo.setDrawRange(0, ng); gGeo.attributes.position.needsUpdate = gGeo.attributes.color.needsUpdate = gGeo.attributes.size.needsUpdate = true;
      front.end(); deep.end();
      post.grade.uniforms.flash.value = Math.min(0.15, (S.flash || 0) * 0.15 * (CALM ? 0.15 : 1));   // the page already flashes the cave white; a touch more here, so the bolts still show
      post.render(1 / 60);
    },
  };
}
