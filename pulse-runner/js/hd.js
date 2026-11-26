// Pulse Runner in 3D: the same run, rain-soaked. A wet highway that mirrors the trains, the city and the runner,
// steel rails and sleepers down every lane, falling rain, a chrome runner, train headlights that cut through the
// rain, and a film grade. Loaded only when the graphics switch is on 3D; the Original look is untouched.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

const WET_ROAD = `
  { vec2 pw = vec2(vW.x, vW.z + uOff);
    float puddle = naPuddle(pw * 1.6, uPud);
    vec2 rip = (vec2(naNoise(pw * 3.0 + uTimeW * 1.3), naNoise(pw * 3.2 - uTimeW * 1.1)) - 0.5) * 0.014;
    vec3 Vw = normalize(cameraPosition - vW); float fres = pow(1.0 - clamp(Vw.y, 0.0, 1.0), 4.0);
    vec3 refl = naReflect(vW, rip, mix(2.6, 0.2, puddle));
    float kR = clamp((0.3 + 0.7 * puddle) * uWetK * (0.3 + 0.7 * fres), 0.0, 0.92);
    col = col * (1.0 - 0.4 * kR) + refl * kR; }
`;

export function attach(P) {
  const { renderer, scene, camera, composer, road, roadMat, plain, plainMat, LANE, X } = P;
  const q = K.tier();
  scene.environment = K.cityEnv(renderer, { sky: [0.03, 0.01, 0.08], horizon: [0.55, 0.12, 0.5] });

  // the wet highway: a planar reflection under it, puddles that scroll with the road
  const mir = K.mirror(renderer, { w: 160, d: 420, x: 0, z: 170, scale: q === "high" ? 0.45 : q === "medium" ? 0.3 : 0.22, hide: [road, plain] });
  scene.add(mir.mesh);
  const timeU = { value: 0 };
  const wet = (mat, pud, k) => {
    Object.assign(mat.uniforms, mir.uniforms, { uTimeW: timeU, uPud: { value: pud }, uWetK: { value: k } });
    mat.fragmentShader = `uniform float uTimeW, uPud, uWetK;\n${K.NOISE_GLSL}\n${K.WET_GLSL}\n` + mat.fragmentShader.replace("float f = 1.0 - exp(", WET_ROAD + " float f = 1.0 - exp(");
    mat.needsUpdate = true;
  };
  wet(roadMat, 0.45, 1.0); wet(plainMat, 0.38, 0.75);

  // steel rails and concrete sleepers down every lane
  const railMat = new THREE.MeshStandardMaterial({ color: 0xb8bccc, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.2 });
  const railGeo = new THREE.BoxGeometry(0.07, 0.09, 700);
  for (const lane of [-1, 0, 1]) for (const s of [-1, 1]) { const r = new THREE.Mesh(railGeo, railMat); r.position.set(X(lane * LANE) + s * 0.42, 0.06, 330); scene.add(r); }
  const SLEEP = 130, sleepMat = new THREE.MeshStandardMaterial({ color: 0x4a4458, roughness: 0.85, metalness: 0.05, map: K.tex("concrete_panels", "diff", { repeat: [0.3, 0.1] }), normalMap: K.tex("concrete_panels", "nor", { repeat: [0.3, 0.1] }) });
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.12, 0.06, 0.2), sleepMat, SLEEP * 3); sleepers.frustumCulled = false; scene.add(sleepers);
  const M4 = new THREE.Matrix4(), I = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);

  // rain that follows the camera
  const rain = K.rain(q === "high" ? 3000 : q === "medium" ? 1800 : 1000, { area: [40, 22, 50], speed: 26, len: 0.7, opacity: 0.22, color: 0xb4c4ff, wind: [0.2, -0.9] });
  scene.add(rain);

  // the film grade on top of the game's bloom
  const grade = K.makeGrade({ vignette: 0.75, grain: 0.02 }); composer.addPass(grade);
  const setRes = () => grade.uniforms.res.value.set(innerWidth, innerHeight); setRes(); addEventListener("resize", setRes);

  // chrome runner once the model has loaded; headlights and light cones on every train
  let chromed = false;
  const chrome = () => { const r = P.robot; if (!r || chromed) return; chromed = true;
    r.traverse((o) => { if (!o.isMesh) return; const m = o.material, n = m.name;
      if (n === "Main") { m.color.set("#c3cbe4"); m.metalness = 0.95; m.roughness = 0.16; m.emissive.set("#2a0a6a"); m.emissiveIntensity = 0.25; m.envMapIntensity = 1.3; }
      if (n === "Grey") { m.color.set("#3a3f5c"); m.metalness = 0.85; m.roughness = 0.3; } }); };
  const beamGeo = K.beamGeometry(16, 2.4), beamMat = K.beamMaterial(0xfff0d8, 0.1, 16);
  P.onBuild = (m, o) => {
    if (o.t !== "train" || m.userData.naBeams) return; m.userData.naBeams = true;
    for (const s of [-0.42, 0.42]) { const b = new THREE.Mesh(beamGeo, beamMat); b.rotation.x = Math.PI / 2 + 0.07; b.position.set(s, 1.05, -0.08); b.renderOrder = 4; m.add(b);
      const g = K.glowSprite(0xfff4e0, 0.9, 3.2); g.position.set(s, 1.05, -0.12); m.add(g); }
  };
  for (const m of P.liveMeshes ? P.liveMeshes() : []) P.onBuild(m.m, m.o);

  return {
    tick(dt, t, dist, flash) {
      timeU.value = t; rain.userData.update(camera, t); chrome();
      roadMat.uniforms.uOff.value = dist; plainMat.uniforms.uOff.value = dist;
      let k = 0; for (const lane of [-1, 0, 1]) { const x = X(lane * LANE); for (let i = 0; i < SLEEP; i++) { M4.compose(V.set(x, 0.03, i * 0.9 - (dist % 0.9) - 4), I, S1); sleepers.setMatrixAt(k++, M4); } }
      sleepers.instanceMatrix.needsUpdate = true;
      grade.uniforms.time.value = t % 100; grade.uniforms.flash.value = 0;
    },
  };
}
