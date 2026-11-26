// Night Arcade 3D kit: the shared pieces behind every game's 3D mode.
// three r160, imported as 'three' through the page's import map, so a game that already uses three.js shares one copy.
// Lighting from a night HDRI, real planar reflections for wet ground, rain, bloom and a colour grade, neon signs, light cones.
import * as THREE from 'three';
import { RGBELoader } from './addons/loaders/RGBELoader.js';
import { GLTFLoader } from './addons/loaders/GLTFLoader.js';
import { Reflector } from './addons/objects/Reflector.js';
import { EffectComposer } from './addons/postprocessing/EffectComposer.js';
import { RenderPass } from './addons/postprocessing/RenderPass.js';
import { ShaderPass } from './addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from './addons/geometries/RoundedBoxGeometry.js';
export { THREE, Reflector, GLTFLoader, RoundedBoxGeometry };

export const ASSETS = new URL('./assets/', import.meta.url).href;
export const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const Q = new URLSearchParams(location.search);

// Quality tier: phones and tablets start on medium, desktops on high; ?q=high|medium|low overrides.
export function tier() { const q = Q.get('q'); return q === 'high' || q === 'medium' || q === 'low' ? q : TOUCH ? 'medium' : 'high'; }
export const can3D = (renderer) => !!(renderer && renderer.capabilities && renderer.capabilities.isWebGL2);

let seed = 7;
export const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ---------- textures ----------
const texLoader = new THREE.TextureLoader(), texCache = new Map();
export const pending = { n: 0 };
export function tex(name, map, { srgb = map === 'diff', repeat = [1, 1] } = {}) {
  const key = `${name}/${map}/${repeat}`;
  if (texCache.has(key)) return texCache.get(key);
  pending.n++;
  const t = texLoader.load(`${ASSETS}tex/${name}/${map}.jpg`, () => pending.n--, undefined, () => pending.n--);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t); return t;
}
// A Poly Haven texture set as a lit material.
export function pbr(name, { repeat = [1, 1], color = 0xffffff, normal = true, roughness = 1, metalness = 0, normalScale = 1, envMapIntensity = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex(name, 'diff', { repeat }), roughnessMap: tex(name, 'rough', { repeat }), color, roughness, metalness, envMapIntensity });
  if (normal) { m.normalMap = tex(name, 'nor', { repeat }); m.normalScale.setScalar(normalScale); }
  return m;
}

// ---------- environment light ----------
// r160 has no scene.environmentIntensity/Rotation, so the HDR pixels are scaled and turned before they are filtered.
const envCache = new Map();
export async function hdri(renderer, file = 'modern_buildings_night_1k.hdr', { intensity = 1, rotY = 0 } = {}) {
  const key = `${file}/${intensity}/${rotY}`;
  if (envCache.has(key)) return envCache.get(key);
  const t = await new RGBELoader().setDataType(THREE.FloatType).loadAsync(`${ASSETS}hdri/${file}`);
  const { data, width, height } = t.image, shift = ((Math.round((rotY / (Math.PI * 2)) * width) % width) + width) % width;
  const row = new Float32Array(width * 4);
  for (let y = 0; y < height; y++) {
    const o = y * width * 4;
    for (let x = 0; x < width; x++) { const s = o + x * 4, d = ((x + shift) % width) * 4; row[d] = data[s] * intensity; row[d + 1] = data[s + 1] * intensity; row[d + 2] = data[s + 2] * intensity; row[d + 3] = 1; }
    data.set(row, o);
  }
  t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true;
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromEquirectangular(t).texture; t.dispose(); pm.dispose();
  envCache.set(key, env); return env;
}

// A night-city light environment built on the spot (no download): a dusk-violet sky, a glowing horizon,
// a ring of towers with lit windows, neon strips and warm street lights. Used for reflections and soft fill.
export function cityEnv(renderer, { sky = [0.02, 0.01, 0.06], horizon = [0.5, 0.12, 0.45], windows = 1, neon = 1, intensity = 1, seed: s0 = 3 } = {}) {
  const key = JSON.stringify(['city', sky, horizon, windows, neon, intensity, s0]);
  if (envCache.has(key)) return envCache.get(key);
  let s = s0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const S = new THREE.Scene();
  S.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { a: { value: new THREE.Vector3(...sky).multiplyScalar(intensity) }, b: { value: new THREE.Vector3(...horizon).multiplyScalar(intensity) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 a, b; varying vec3 vP; void main(){ float y = vP.y; vec3 c = mix(b, a, smoothstep(-0.05, 0.5, y)); c = mix(c, a * 0.4, smoothstep(0.0, -0.4, y)); gl_FragColor = vec4(c, 1.0); }' })));
  // windows: one canvas of random lit cells shared by every tower
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) if (r() < 0.32) { g.fillStyle = ['#ffd9a0', '#bfe6ff', '#ffb4e8', '#fff1d0'][Math.floor(r() * 4)]; g.globalAlpha = 0.4 + r() * 0.6; g.fillRect(x * 4 + 1, y * 4 + 1, 2, 2); }
  const wt = new THREE.CanvasTexture(cv); wt.colorSpace = THREE.SRGBColorSpace; wt.magFilter = THREE.NearestFilter;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + r() * 0.1, d = 30 + r() * 25, h = 8 + r() * 40, w = 5 + r() * 9;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshBasicMaterial({ map: wt, color: new THREE.Color(1, 1, 1).multiplyScalar(1.6 * windows * intensity) }));
    m.position.set(Math.cos(a) * d, h / 2 - 6, Math.sin(a) * d); m.lookAt(0, h / 2 - 6, 0); S.add(m);
  }
  const strip = (c, k, y, a, len, th) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, th), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k * neon * intensity), side: THREE.DoubleSide }));
    m.position.set(Math.cos(a) * 28, y, Math.sin(a) * 28); m.lookAt(0, y, 0); S.add(m); };
  [[0xff2bd6, 4], [0x00e5ff, 4], [0xb46bff, 3], [0xffd23f, 3], [0xff2e4d, 3], [0xb6ff00, 2.5]].forEach(([c, k], i) => { for (let j = 0; j < 3; j++) strip(c, k, 2 + r() * 22, r() * 6.28, 6 + r() * 14, 0.4 + r() * 0.8); });
  for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.72, 0.42).multiplyScalar(8 * intensity) })); const a = r() * 6.28; l.position.set(Math.cos(a) * 18, 3 + r() * 3, Math.sin(a) * 18); S.add(l); }
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(S, 0.035).texture; pm.dispose();
  S.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); wt.dispose();
  envCache.set(key, env); return env;
}

// ---------- models ----------
const gltfLoader = new GLTFLoader(), gltfCache = new Map();
export async function model(file, { shadows = false } = {}) {
  if (!gltfCache.has(file)) gltfCache.set(file, gltfLoader.loadAsync(file.startsWith('http') || file.startsWith('.') || file.startsWith('/') ? file : `${ASSETS}models/${file}`));
  const g = await gltfCache.get(file); const o = g.scene.clone(true);
  o.traverse((m) => { if (m.isMesh) { m.castShadow = shadows; m.receiveShadow = shadows; } });
  o.userData.animations = g.animations; return o;
}

// ---------- post-processing: NaN guard, bloom, tone mapping, grade (vignette, violet shadows, grain, flash, speed blur) ----------
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
export function post(renderer, scene, camera, { bloom = [0.6, 0.45, 0.86], grade = true, vignette = 0.8, grain = 0.025 } = {}) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: QUAD_VS,
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(min(c.rgb, vec3(40.0)), 1.0); }' }));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), bloom[0], bloom[1], bloom[2]);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  const gradePass = makeGrade({ vignette, grain });
  gradePass.enabled = grade; composer.addPass(gradePass);
  const api = {
    composer, bloom: bloomPass, grade: gradePass,
    setSize(w, h) { composer.setSize(w, h); bloomPass.resolution.set(Math.max(1, w / 2), Math.max(1, h / 2)); gradePass.uniforms.res.value.set(w, h); },
    render(dt = 0.016) { gradePass.uniforms.time.value = (gradePass.uniforms.time.value + dt) % 100; composer.render(dt); },
  };
  const sz = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(); composer.setPixelRatio(pr); api.setSize(sz.x, sz.y);
  return api;
}

// the colour grade on its own (vignette, violet shadows, grain, flash, speed blur), for games that already have a composer
export function makeGrade({ vignette = 0.8, grain = 0.025 } = {}) {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, speed: { value: 0 }, flash: { value: 0 }, vig: { value: vignette }, grain: { value: grain }, tint: { value: new THREE.Vector3(1, 1, 1) } },
    vertexShader: QUAD_VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, speed, flash, vig, grain; uniform vec2 res; uniform vec3 tint; varying vec2 vUv;
      float h(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec2 d = vUv - 0.5; float r2 = dot(d, d); vec3 col;
        if (speed > 0.001) { col = vec3(0.0); for (int i = 0; i < 6; i++) { float k = float(i) / 5.0 * speed * r2 * 0.6; col += texture2D(tDiffuse, vUv - d * k).rgb; } col /= 6.0; }
        else col = texture2D(tDiffuse, vUv).rgb;
        col *= tint;
        col = mix(col, col * vec3(1.03, 0.97, 1.07), 0.6) + vec3(0.010, 0.003, 0.022) * (1.0 - col);
        col *= 1.0 - r2 * vig;
        col += (h(vUv * res + time) - 0.5) * grain;
        col = mix(col, vec3(1.0), flash);
        gl_FragColor = vec4(col, 1.0); }`,
  });
}

// ---------- wet ground: a real planar reflection any material can sample ----------
// mirror() renders the scene upside-down into a texture (skipping the ground itself); WET_GLSL gives a shader the sampling code.
export function mirror(renderer, { w, d, x = 0, y = 0, z = 0, scale = 0.5, hide = [] }) {
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
  const m = new Reflector(new THREE.PlaneGeometry(w, d), { textureWidth: Math.max(64, Math.round(sz.x * scale)), textureHeight: Math.max(64, Math.round(sz.y * scale)), clipBias: 0.003 });
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.material.colorWrite = false; m.material.depthWrite = false; m.renderOrder = -1000; m.frustumCulled = false;
  const rt = m.getRenderTarget(); rt.texture.generateMipmaps = true; rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  const worldMat = new THREE.Matrix4(), inv = new THREE.Matrix4();
  const uniforms = { tMirror: { value: rt.texture }, uMirrorMat: { value: worldMat }, uMirrorOn: { value: 1 } };
  const before = m.onBeforeRender; let armed = true, once = false;
  m.onBeforeRender = function (r, s, cam, ...rest) {
    if (!uniforms.uMirrorOn.value || (once && !armed)) return;
    armed = false;
    const vis = hide.map((o) => o.visible); hide.forEach((o) => (o.visible = false));
    before.call(this, r, s, cam, ...rest);
    hide.forEach((o, k) => (o.visible = vis[k]));
    worldMat.copy(m.material.uniforms.textureMatrix.value).multiply(inv.copy(m.matrixWorld).invert());
  };
  return { mesh: m, uniforms, hide,
    // games with several render passes per frame call this once per frame, so the reflection renders once
    beginFrame() { once = true; armed = true; },
    resize(s = scale) { scale = s; const z2 = renderer.getDrawingBufferSize(new THREE.Vector2()); rt.setSize(Math.max(64, Math.round(z2.x * s)), Math.max(64, Math.round(z2.y * s))); },
    set on(v) { uniforms.uMirrorOn.value = v ? 1 : 0; m.visible = !!v; }, get on() { return !!uniforms.uMirrorOn.value; } };
}
export const NOISE_GLSL = `float naHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float naNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(naHash(i), naHash(i + vec2(1, 0)), u.x), mix(naHash(i + vec2(0, 1)), naHash(i + vec2(1, 1)), u.x), u.y); }
float naFbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * naNoise(p); p *= 2.03; a *= 0.5; } return s; }`;
export const WET_GLSL = `uniform sampler2D tMirror; uniform mat4 uMirrorMat; uniform float uMirrorOn;
vec3 naReflect(vec3 wp, vec2 nudge, float lod){
  if (uMirrorOn < 0.5) return vec3(0.0);
  vec4 mc = uMirrorMat * vec4(wp, 1.0); mc.xy += nudge * mc.w;
  return mc.w > 1e-4 ? clamp(textureProjLod(tMirror, mc, lod).rgb, 0.0, 30.0) : vec3(0.0); }
float naPuddle(vec2 xz, float amt){ return smoothstep(1.0 - amt, 1.0 - amt + 0.07, naFbm(xz * 0.11 + 3.0)); }`;

// Make a standard material wet: darker, glossy, puddles that mirror the street.
export function wetStandard(material, mir, { wet = 0.6, puddles = 0.5, ripple = 1, groundY = null } = {}) {
  material.userData.wet = { wet, puddles };
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  if (groundY !== null) material.defines = Object.assign({}, material.defines, { NA_GROUND: '' });
  material.customProgramCacheKey = () => 'naWet|' + prevKey + '|' + (groundY !== null);
  material.onBeforeCompile = (sh, rr) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(material, sh, rr);
    Object.assign(sh.uniforms, mir.uniforms, { uWet: { value: wet }, uPuddles: { value: puddles }, uRipple: { value: ripple }, uGroundY: { value: groundY || 0 }, uTimeW: material.userData.timeU || (material.userData.timeU = { value: 0 }) });
    sh.vertexShader = 'varying vec3 vWPw;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWPw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWPw; uniform float uWet, uPuddles, uRipple, uTimeW, uGroundY;\n' + NOISE_GLSL + '\n' + WET_GLSL + '\n' + sh.fragmentShader
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float wetMask = 1.0;
        #ifdef NA_GROUND
          vec3 gNw = inverseTransformDirection(normalize(vNormal), viewMatrix);
          wetMask = smoothstep(0.8, 0.95, gNw.y) * (1.0 - smoothstep(0.12, 0.4, abs(vWPw.y - uGroundY)));
        #endif
        float puddle = naPuddle(vWPw.xz, uPuddles) * wetMask;
        roughnessFactor = mix(roughnessFactor, 0.05, max(puddle, uWet * 0.5 * wetMask));`)
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 1.0 - 0.4 * uWet;')
      .replace('#include <opaque_fragment>', `
        vec3 Vd = normalize(vViewPosition); float fres = pow(1.0 - clamp(dot(normalize(normal), Vd), 0.0, 1.0), 4.0);
        vec2 rip = (vec2(naNoise(vWPw.xz * 2.7 + uTimeW * 0.7), naNoise(vWPw.xz * 2.9 - uTimeW * 0.6)) - 0.5) * 0.03 * uRipple;
        vec3 refl = naReflect(vWPw, normal.xy * (puddle > 0.5 ? 0.01 : 0.04) + rip, mix(4.0, 0.3, max(puddle, uWet * 0.25)));
        float kR = clamp((puddle * 0.95 + uWet * 0.45 * wetMask) * (0.35 + 0.65 * fres), 0.0, 1.0);
        outgoingLight = outgoingLight * (1.0 - 0.6 * kR) + refl * kR;
        #include <opaque_fragment>`);
  };
  material.needsUpdate = true; return material;
}

// ---------- rain that follows the camera (streaks wrap around a box centred on it) ----------
export function rain(n = 3000, { area = [70, 36, 70], color = 0x9fb4ff, opacity = 0.28, speed = 24, len = 0.8, wind = [0.6, 0.25] } = {}) {
  const pos = new Float32Array(n * 6), end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const x = rand() * area[0], y = rand() * area[1], z = rand() * area[2]; pos.set([x, y, z, x, y, z], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 0.6 + rand() * 0.8; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uArea: { value: new THREE.Vector3(...area) }, uSpeed: { value: speed }, uLen: { value: len }, uWind: { value: new THREE.Vector2(...wind) }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `attribute float aEnd; uniform float uTime, uSpeed, uLen; uniform vec3 uCam, uArea; uniform vec2 uWind; varying float vA;
      void main(){ vec3 o = uCam - uArea * 0.5; vec3 p = position; p.y -= uTime * uSpeed; vec3 wp = o + mod(p - o, uArea);
        wp += vec3(uWind.x, -1.0, uWind.y) * aEnd * uLen; vA = 1.0 - aEnd * 0.5;
        float dc = length(wp - uCam); vA *= smoothstep(0.5, 3.0, dc) * (1.0 - smoothstep(uArea.x * 0.35, uArea.x * 0.5, dc));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor * uOpacity * vA, 1.0); }' });
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.renderOrder = 5;
  lines.userData.update = (camera, t) => { mat.uniforms.uTime.value = t; mat.uniforms.uCam.value.copy(camera.position); };
  return lines;
}

// ---------- neon sign: glowing tube letters on a dark board ----------
export function neonSign(text, { color = '#ff2bd6', font = '900 120px "Arial Black", Arial, sans-serif', w = 4, h, board = true, glow = 2.6, sub } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = font; const tw = g.measureText(text).width;
  c.width = Math.ceil(tw + 160); c.height = sub ? 300 : 220; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (board) { g.fillStyle = 'rgba(8,4,20,0.85)'; g.beginPath(); g.roundRect(10, 10, c.width - 20, c.height - 20, 30); g.fill(); g.lineWidth = 6; g.strokeStyle = color; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1; }
  for (const [blur, lw, a] of [[40, 14, 0.5], [18, 8, 0.8], [0, 3, 1]]) { g.shadowColor = color; g.shadowBlur = blur; g.lineWidth = lw; g.strokeStyle = a < 1 ? color : '#ffffff'; g.globalAlpha = a; g.strokeText(text, c.width / 2, sub ? 120 : c.height / 2); }
  g.globalAlpha = 1; g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.fillText(text, c.width / 2, sub ? 120 : c.height / 2);
  if (sub) { g.font = '700 54px Arial, sans-serif'; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 16; g.fillText(sub, c.width / 2, 235); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide }); mat.color.setScalar(glow);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h ?? (w * c.height) / c.width), mat);
}

// ---------- soft light cone (fake volumetric beam) ----------
export function beamMaterial(color = 0xffd8a0, strength = 0.2, len = 6) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { col: { value: new THREE.Color(color) }, s: { value: strength }, len: { value: len } },
    vertexShader: 'varying float vY; varying vec3 vN, vV; uniform float len; void main(){ vY = -position.y / len; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 col; uniform float s; varying float vY; varying vec3 vN, vV; void main(){ float edge = pow(max(abs(dot(vN, vV)), 1e-4), 1.6); gl_FragColor = vec4(col * s * edge * pow(clamp(1.0 - vY, 0.0, 1.0), 1.4), 1.0); }' });
}
export function beamGeometry(len = 6, rad = 2.2) { const g = new THREE.ConeGeometry(rad, len, 24, 1, true); g.translate(0, -len / 2, 0); return g; }
export function beam(color, len = 6, rad = 2.2, strength = 0.2) { return new THREE.Mesh(beamGeometry(len, rad), beamMaterial(color, strength, len)); }

// ---------- soft round sprite (glow, smoke, steam) ----------
let softTex = null;
export function softTexture() {
  if (softTex) return softTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  softTex = new THREE.CanvasTexture(c); return softTex;
}
export function glowSprite(color, size = 1, k = 2) { const m = new THREE.SpriteMaterial({ map: softTexture(), color: new THREE.Color(color).multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); const s = new THREE.Sprite(m); s.scale.setScalar(size); return s; }
export function puffs(n, { spread = [1, 2, 1], size = [1, 3], color = 0xffffff, opacity = 0.12, rise = 2.5 } = {}) {
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) { const m = new THREE.SpriteMaterial({ map: softTexture(), color, transparent: true, opacity: opacity * (0.5 + rand()), depthWrite: false });
    const s = new THREE.Sprite(m), k = i / n; s.position.set((rand() - 0.5) * spread[0] * (0.5 + k), k * rise * spread[1], (rand() - 0.5) * spread[2] * (0.5 + k)); const sz = size[0] + (size[1] - size[0]) * k; s.scale.set(sz, sz, 1); m.rotation = rand() * 6.28; grp.add(s); }
  return grp;
}

// ---------- contact shadow ----------
let blobTex = null;
export function blobMaterial(strength = 0.7) {
  if (!blobTex) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); blobTex = new THREE.CanvasTexture(c); }
  return new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: strength, depthWrite: false });
}
export function blob(w, d, strength = 0.7) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blobMaterial(strength)); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; return m; }

// Wait until every texture asked for so far has arrived (games call this behind their loading screen).
export function texturesReady(timeout = 8000) { const t0 = performance.now(); return new Promise((res) => { const go = () => (pending.n > 0 && performance.now() - t0 < timeout ? setTimeout(go, 50) : res()); go(); }); }
