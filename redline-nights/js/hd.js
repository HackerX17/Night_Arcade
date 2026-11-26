// Redline Nights in 3D: the same city and cars, rendered with lit, textured buildings, a rain-wet road that mirrors the
// street, light cones under the lamps, rain, police lights that light up the block, clear-coat paint and a film grade.
// Loaded only when the graphics switch is on 3D; the Original renderer is untouched.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";
import { N, P, HALF, SIZE, FOG_COLOR } from "./world.js";

// called before the world is built: the light environment every car and window reflects
export async function prepare(renderer, scene) {
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const env = K.cityEnv(renderer, { sky: [0.02, 0.008, 0.06], horizon: [0.45, 0.1, 0.42], intensity: 1 });
  scene.environment = env;
  const hd = new HD(renderer, scene, env);
  try { await hd.loadCar(); } catch (e) { console.warn("3D car model unavailable", e); }
  globalThis.NA3D_CAR = (root) => hd.upgradeCar(root);
  return hd;
}

const QUALITY = { high: { mirror: 0.5, rain: 3800, beams: true, copLights: 2, head: true }, medium: { mirror: 0.32, rain: 2200, beams: true, copLights: 1, head: true }, low: { mirror: 0, rain: 1000, beams: false, copLights: 0, head: false } };

class HD {
  constructor(renderer, scene, env) {
    this.r = renderer; this.scene = scene; this.env = env; this.q = "high"; this.t = 0; this.last = performance.now();
    scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), 0.0016);
    this.paints = new Set();
  }

  // the detailed sports car (CarConcept by Eric Chadwick, CC BY 4.0) for the player's sporty cars and the title car
  async loadCar() {
    const proto = await K.model("car_concept.gltf");
    proto.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(proto); this.carBox = box;
    // wheel pivots: tyre, rim and disc spin; pads only steer
    const corners = {};
    proto.traverse((n) => { const m = /^Wheel(Front|Rear)(L|R)(Rim|BrakeDisc|BrakePad)?$/.exec(n.name || ""); if (m) (corners[m[1] + m[2]] = corners[m[1] + m[2]] || []).push({ n, part: m[3] || "Tyre" }); });
    this.wheelKeys = [];
    for (const [key, list] of Object.entries(corners)) {
      const tyre = list.find((x) => x.part === "Tyre") || list[0]; const c = new THREE.Box3().setFromObject(tyre.n).getCenter(new THREE.Vector3());
      const steer = new THREE.Group(); steer.name = "naSteer" + key; steer.position.copy(c); proto.add(steer); steer.updateMatrixWorld(true);
      const spin = new THREE.Group(); spin.name = "naSpin" + key; steer.add(spin); spin.updateMatrixWorld(true);
      for (const { n, part } of list) (part === "BrakePad" ? steer : spin).attach(n);
      this.wheelKeys.push({ key, front: key.startsWith("Front"), side: Math.sign(c.x) });
    }
    proto.traverse((m) => { if (!m.isMesh) return; const n = m.material.name || "";
      if (n === "Headlight") { m.material.emissive = new THREE.Color(0xf0f6ff); m.material.emissiveIntensity = 6; }
      if (n === "Brakelight") { m.material.emissive = new THREE.Color(0xff1030); m.material.emissiveIntensity = 5; }
      if (n === "Signallight") { m.material.emissive = new THREE.Color(0xff9a20); m.material.emissiveIntensity = 0.6; }
      if (m.material.envMap === null || m.material.envMap === undefined) { m.material.envMap = this.env; m.material.envMapIntensity = 0.8; } });
    this.carProto = proto; this.heroes = [];
  }
  hero(root) {
    const u = root.userData, S = u.shape;
    if (!this.carProto || !["coupe", "muscle", "tuner", "super"].includes(u.kind)) return;
    const car = this.carProto.clone(true), b = this.carBox, len = b.max.z - b.min.z, k = (S.L * 0.98) / len;
    car.scale.setScalar(k); car.position.set(-(b.min.x + b.max.x) / 2 * k, -b.min.y * k, -(b.min.z + b.max.z) / 2 * k);
    // own paint material, so the garage colours still apply
    let paint = null;
    car.traverse((m) => { if (!m.isMesh) return; const n = m.material.name || "";
      if (/^Paint 1/.test(n)) { if (!paint) { paint = m.material.clone(); paint.color.copy(u.paintMat.color); paint.metalness = 0.75; paint.roughness = 0.36; paint.clearcoat = 1; paint.clearcoatRoughness = 0.03; paint.envMap = this.env; paint.envMapIntensity = 0.75; } m.material = paint; }
      if (/^Paint 2/.test(n)) { m.material = m.material.clone(); m.material.color.set(0x121218); m.material.metalness = 0.6; m.material.roughness = 0.35; } });
    u.body.children.forEach((c) => (c.visible = false)); u.wheels.forEach((w) => (w.spin.visible = false));
    u.body.add(car);
    if (paint) { u.paintMat = paint; }
    const spins = this.wheelKeys.map((w) => ({ ...w, steer: car.getObjectByName("naSteer" + w.key), spin: car.getObjectByName("naSpin" + w.key) }));
    this.heroes.push({ root, spins });
  }

  // clear-coat paint that mirrors the city (player, rivals: built by makeCarModel)
  upgradeCar(root) {
    const u = root.userData, old = u.paintMat; if (!old || old.isMeshPhysicalMaterial) return;
    const pm = new THREE.MeshPhysicalMaterial({ vertexColors: old.vertexColors, color: old.color.clone(), metalness: 0.45, roughness: 0.34, envMap: this.env, envMapIntensity: 0.75, clearcoat: 1, clearcoatRoughness: 0.04 });
    root.traverse((m) => { if (m.isMesh && m.material === old) m.material = pm; });
    u.paintMat = pm; old.dispose(); this.paints.add(pm);
  }

  // called once the world, traffic and police exist
  attach({ world, camera, G, police, getPlayer }) {
    this.world = world; this.camera = camera; this.G = G; this.police = police; this.getPlayer = getPlayer;
    const scene = this.scene, r = this.r;
    // traffic and police bodies: clear-coat paint too
    scene.traverse((m) => {
      if (!m.isMesh || !m.material || !m.material.isMeshStandardMaterial || m.material.isMeshPhysicalMaterial || m.material.envMap !== this.env) return;
      const o = m.material; m.material = new THREE.MeshPhysicalMaterial({ vertexColors: o.vertexColors, color: o.color.clone(), metalness: o.metalness, roughness: Math.min(o.roughness, 0.4), envMap: this.env, envMapIntensity: 0.75, clearcoat: 1, clearcoatRoughness: 0.06 });
    });
    // light: a cool moon from above, the purple city glow below
    scene.traverse((o) => { if (o.isHemisphereLight) o.intensity = 0.3; if (o.isDirectionalLight) o.intensity *= 0.45; });
    r.toneMappingExposure = 0.85;

    // the road mirrors the street: one planar reflection under the whole city
    this.mirror = K.mirror(r, { w: SIZE + 600, d: SIZE + 600, x: SIZE / 2, z: SIZE / 2, scale: 0.5, hide: [world.ground] });
    scene.add(this.mirror.mesh);
    this.patchRoad(world.road);

    // buildings: brick and concrete walls lit by the moon, the street lamps and the city's glow; windows glow and reflect
    this.facade = facadeMaterial(this.env);
    world.buildings.material = this.facade;

    // street lamps: a soft light cone under every lamp head
    const lamps = world.lamps, bGeo = K.beamGeometry(7.4, 3.2), bMat = K.beamMaterial(0xffc98a, 0.085, 7.4);
    const beams = new THREE.InstancedMesh(bGeo, bMat, lamps.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    lamps.forEach((l, k) => { q.setFromAxisAngle(up, l.rot); v.set(0, 7.05, 0.85).applyQuaternion(q).add(new THREE.Vector3(l.x, 0, l.z)); m4.compose(v, q, s); beams.setMatrixAt(k, m4); });
    beams.frustumCulled = false; beams.renderOrder = 4; scene.add(beams); this.beams = beams;

    // rain, and steam drifting up from a few drains at the crossings
    this.rain = K.rain(3800, { area: [90, 40, 90], speed: 26, len: 0.9, opacity: 0.26 }); scene.add(this.rain);
    this.steam = new THREE.Group(); scene.add(this.steam);
    for (let k = 0; k < 26; k++) { const i = Math.floor(K.rand() * (N + 1)), j = Math.floor(K.rand() * N); const p = K.puffs(6, { spread: [1.6, 1.4, 1.6], size: [1.6, 4.2], color: 0xc9b8ff, opacity: 0.07, rise: 3 });
      p.position.set(i * P + (K.rand() - 0.5) * 10, 0.2, j * P + HALF + 8 + K.rand() * (P - 2 * HALF - 16)); this.steam.add(p); }

    // police lights and the player's headlights light up the street for real
    this.copLights = [0, 1].map(() => { const l = new THREE.PointLight(0xff2040, 0, 34, 2); scene.add(l); return l; });
    this.head = new THREE.SpotLight(0xdfe8ff, 0, 70, 0.48, 0.55, 1.6); scene.add(this.head, this.head.target);

    this.post = K.post(r, scene, camera, { bloom: [0.5, 0.45, 1.0], vignette: 0.8, grain: 0.022 });
    this.quality(this.q);
  }

  patchRoad(mat) {
    mat.uniforms = Object.assign(mat.uniforms, this.mirror.uniforms, { uWet: { value: 1 }, tAsph: { value: K.tex("asphalt_02", "diff", { repeat: [1, 1] }) }, tAsphN: { value: K.tex("asphalt_02", "nor", { repeat: [1, 1] }) } });
    mat.fragmentShader = mat.fragmentShader
      .replace("uniform sampler2D uBlocks;", `uniform sampler2D uBlocks; uniform sampler2D tAsph, tAsphN; uniform float uWet;\n${K.NOISE_GLSL}\n${K.WET_GLSL}`)
      .replace("float fogDist = length(vWorld - cameraPosition);", `
        // 3D: real asphalt grain, a wet sheen everywhere and puddles that mirror the street
        vec3 tA = texture2D(tAsph, p * 0.22).rgb;
        vec3 tN = texture2D(tAsphN, p * 0.22).rgb * 2.0 - 1.0;
        if (city && (onV || onH)) col *= 0.55 + 1.1 * tA;
        float puddle = city ? naPuddle(p, onV || onH ? 0.5 : 0.32) : 0.0;
        vec2 rip = (vec2(naNoise(p * 2.7 + uTime * 0.9), naNoise(p * 2.9 - uTime * 0.8)) - 0.5) * 0.012;
        vec3 Vw = normalize(cameraPosition - vWorld); float fres = pow(1.0 - clamp(Vw.y, 0.0, 1.0), 4.0);
        vec3 refl = naReflect(vWorld, tN.xy * (puddle > 0.5 ? 0.004 : 0.016) + rip, mix(3.0, 0.2, puddle));
        float kR = clamp((0.3 + 0.7 * puddle) * uWet * (0.25 + 0.75 * fres), 0.0, 0.95);
        col = col * (1.0 - 0.45 * kR * (city ? 1.0 : 0.3)) + refl * kR * (city ? 1.0 : 0.35);
        float fogDist = length(vWorld - cameraPosition);`);
    mat.needsUpdate = true;
  }

  quality(q) {
    this.q = q; const Q = QUALITY[q] || QUALITY.high;
    this.mirror.on = Q.mirror > 0; if (Q.mirror > 0) this.mirror.resize(Q.mirror);
    this.rain.geometry.setDrawRange(0, Q.rain * 2);
    this.beams.visible = Q.beams;
    this.post.bloom.enabled = q !== "low";
    this.copN = Q.copLights; this.headOn = Q.head;
  }

  setSize(w, h, dpr) { if (!this.post) return; this.post.composer.setPixelRatio(dpr); this.post.setSize(w, h); if (this.mirror.on) this.mirror.resize((QUALITY[this.q] || QUALITY.high).mirror); }

  render(me) {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    const G = this.G, cam = this.camera;
    this.rain.userData.update(cam, this.t);
    // the sports car's wheels follow the game's wheel spin and steering
    this.heroes = this.heroes.filter((h) => h.root.parent);
    for (const h of this.heroes) { const ws = h.root.userData.wheels; for (const s of h.spins) { const w = ws.find((x) => x.front === s.front) || ws[0]; if (s.spin) s.spin.rotation.x = w.spin.rotation.x; if (s.steer && s.front) s.steer.rotation.y = w.pivot.rotation.y; } }
    // steam: a slow rise and spin
    this.steam.children.forEach((g, k) => g.children.forEach((s, j) => { s.material.rotation += dt * 0.15 * (j % 2 ? 1 : -1); s.position.y = ((s.position.y + dt * 0.45) % 4.2); }));
    // police lights on the nearest chasing cops
    const cops = this.police.cops.filter((c) => c.mode === "chase" || c.mode === "block").sort((a, b) => Math.hypot(a.body.x - me.x, a.body.z - me.z) - Math.hypot(b.body.x - me.x, b.body.z - me.z));
    this.copLights.forEach((l, k) => {
      const c = k < this.copN ? cops[k] : null;
      if (!c) { l.intensity = 0; return; }
      const ph = (G.t * 3.2 + c.phase) % 1; l.color.setHex(ph < 0.5 ? 0xff1a3a : 0x2a5bff); l.intensity = 260; l.position.set(c.body.x, 2.6, c.body.z);
    });
    // headlights
    if (this.headOn && me && G.mode !== "title") {
      const sh = Math.sin(me.h), ch = Math.cos(me.h);
      this.head.intensity = 700; this.head.position.set(me.x + sh * 1.6, 1.0, me.z + ch * 1.6); this.head.target.position.set(me.x + sh * 30, 0, me.z + ch * 30); this.head.target.updateMatrixWorld();
    } else this.head.intensity = 0;
    // grade: the crash flash and a speed blur at the edges when the nitro is on
    const spd = me ? Math.hypot(me.vx || 0, me.vz || 0) : 0;
    this.post.grade.uniforms.flash.value = (G.flash || 0) * 0.5;
    this.post.grade.uniforms.speed.value = me && me.nitroOn ? Math.min(0.22, spd / 300) : Math.max(0, (spd - 45) / 400);
    this.world.road.uniforms.uTime.value = G.t;
    this.post.render(dt);
  }
}

// Buildings as lit PBR: brick or concrete by building, windows from the original pattern (lit ones glow, dark ones are glass
// that reflects the city), the neon crown and shop fronts kept, and warm light from the street lamps on the lower walls.
function facadeMaterial(env) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMap: env, envMapIntensity: 0.55 });
  const T = { tBrick: { value: K.tex("brick_4", "diff") }, tBrickN: { value: K.tex("brick_4", "nor") }, tBrickR: { value: K.tex("brick_4", "rough") },
    tConc: { value: K.tex("concrete_panels", "diff") }, tConcN: { value: K.tex("concrete_panels", "nor") }, tConcR: { value: K.tex("concrete_panels", "rough") } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, T);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        attribute vec3 aTint; attribute float aSeed; varying vec3 vNW, vWW, vTintF; varying float vSeedF, vTopF, vBaseF;`)
      .replace("#include <project_vertex>", `#include <project_vertex>
        mat4 naM = modelMatrix * instanceMatrix; vWW = (naM * vec4(transformed, 1.0)).xyz; vNW = normalize(mat3(naM) * objectNormal);
        vTintF = aTint; vSeedF = aSeed; vTopF = (naM * vec4(0.0, 0.5, 0.0, 1.0)).y; vBaseF = (naM * vec4(0.0, -0.5, 0.0, 1.0)).y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform sampler2D tBrick, tBrickN, tBrickR, tConc, tConcN, tConcR; varying vec3 vNW, vWW, vTintF; varying float vSeedF, vTopF, vBaseF;
        float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        vec3 nW = normalize(vNW); bool roofF = nW.y > 0.5, floorF = nW.y < -0.5;
        vec3 tW = abs(nW.x) > 0.5 ? vec3(0.0, 0.0, -sign(nW.x)) : vec3(sign(nW.z), 0.0, 0.0);
        float u = dot(vWW, tW), v = vWW.y; vec2 tuv = vec2(u, v) / 3.2;
        bool brick = fract(vSeedF * 7.3) < 0.55;
        vec3 albW = brick ? texture2D(tBrick, tuv).rgb : texture2D(tConc, tuv * 0.8).rgb;
        float roughW = brick ? texture2D(tBrickR, tuv).r : texture2D(tConcR, tuv * 0.8).r;
        vec3 nmW = (brick ? texture2D(tBrickN, tuv).rgb : texture2D(tConcN, tuv * 0.8).rgb) * 2.0 - 1.0;
        float style = fract(vSeedF * 3.7);
        float pw = style < 0.33 ? 3.0 : style < 0.66 ? 2.2 : 4.2, ph = style < 0.5 ? 3.6 : 3.2;
        vec2 cell = vec2(floor(u / pw), floor(v / ph)), f = vec2(fract(u / pw), fract(v / ph));
        float street = v - vBaseF, shop = (1.0 - step(4.2, street)) * step(vBaseF, 1.0);
        float sx = fract(u / 6.0), sCell = floor(u / 6.0); float sOpen = step(0.35, fhash(vec2(sCell, vSeedF * 31.0)));
        float sGlass = shop * step(0.08, sx) * step(sx, 0.92) * step(0.35, street) * step(street, 3.2);
        float sSign = shop * step(3.38, street) * step(street, 3.9) * step(0.05, sx) * step(sx, 0.95) * sOpen;
        float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.8) * (1.0 - shop);
        float hh = fhash(cell + vec2(vSeedF * 61.0, vSeedF * 17.0));
        float on = step(0.52 + 0.25 * fract(vSeedF * 9.1), hh);
        vec3 warm = vec3(1.0, 0.7, 0.4), cool = vec3(0.55, 0.82, 1.0);
        vec3 wc = mix(warm, cool, step(0.55, fract(hh * 7.31))) * (0.55 + 0.9 * fract(hh * 13.7));
        float fw = max(fwidth(u) / pw, fwidth(v) / ph), farF = smoothstep(0.35, 0.9, fw);
        float litFrac = 1.0 - (0.52 + 0.25 * fract(vSeedF * 9.1));
        float glassF = max(win * (1.0 - farF), sGlass);
        vec3 albedoF = roofF ? vec3(0.05, 0.045, 0.06) : mix(albW * mix(vec3(0.4, 0.36, 0.45), vec3(0.52, 0.48, 0.56), fract(vSeedF * 4.1)), vec3(0.02, 0.025, 0.04), glassF);
        float roughF = roofF ? 0.9 : mix(mix(0.72, 1.0, roughW), 0.06, glassF);
        float metalF = max(win * (1.0 - on) * (1.0 - farF), sGlass * (1.0 - sOpen)) * 0.55;
        vec3 emisF = vec3(0.0);
        if (!roofF && !floorF) {
          emisF += wc * 0.85 * win * on * (1.0 - farF);
          emisF += vec3(0.95, 0.78, 0.62) * litFrac * farF * 0.22;
          float top = vTopF - v; emisF += vTintF * (1.0 - smoothstep(0.0, 0.7, top)) * 2.6;
          vec3 inside = mix(vec3(1.0, 0.78, 0.52), vTintF, 0.35) * (0.25 + 0.2 * fhash(vec2(sCell, 7.0)));
          emisF += inside * sGlass * sOpen * (0.6 + 0.4 * smoothstep(3.2, 0.4, street));
          emisF += vTintF * sSign * 1.6;
          // warm pools from the nearest street lamps on the lower walls
          float lamp = 0.0;
          for (int a = 0; a < 2; a++) {
            float along = a == 0 ? vWW.z : vWW.x, across = a == 0 ? vWW.x : vWW.z;
            float k = floor(across / ${P.toFixed(1)} + 0.5) * ${P.toFixed(1)}; float side = sign(across - k);
            float lx = k + side * ${(HALF + 1.2).toFixed(2)};
            float ma = mod(along - ${HALF.toFixed(1)}, ${P.toFixed(1)}); float dz = min(abs(ma - 24.0), abs(ma - 72.0));
            float dx = across - lx, dy = v - 7.0; lamp += exp(-(dx * dx * 0.04 + dz * dz * 0.022 + dy * dy * 0.03));
          }
          emisF += vec3(1.0, 0.68, 0.38) * lamp * 0.3 * albW;
        }`)
      .replace("#include <map_fragment>", "diffuseColor.rgb = albedoF;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = roughF;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = metalF;")
      .replace("#include <normal_fragment_maps>", `
        if (!roofF && !floorF && farF < 0.99) {
          vec3 tV = normalize((viewMatrix * vec4(tW, 0.0)).xyz), bV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          vec3 nm = vec3(nmW.xy * (1.0 - win) * (1.0 - farF) * 0.9, nmW.z); normal = normalize(tV * nm.x + bV * nm.y + normal * nm.z);
        }`)
      .replace("#include <emissivemap_fragment>", "totalEmissiveRadiance = emisF;");
  };
  return mat;
}
