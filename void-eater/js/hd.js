// Void Eater in 3D: the same city and voids after a rainstorm. Wet streets that mirror the towers and the neon,
// brick and concrete walls under the lit windows, glossy cars, falling rain and a film grade.
// Loaded only when the graphics switch is on 3D; the Original look is untouched.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

export function attach(P) {
  const { renderer, scene, camera, composer, ground, groundMat, winMat, SHAPES, U, SIZE } = P;
  const q = K.tier();
  const env = K.cityEnv(renderer, { sky: [0.03, 0.012, 0.09], horizon: [0.4, 0.1, 0.45] });   // reflections on the cars only

  // wet streets: a planar reflection under the city, puddles from noise
  const W = SIZE * U * 3, mir = K.mirror(renderer, { w: W, d: W, x: SIZE * U / 2, z: SIZE * U / 2, scale: q === "high" ? 0.45 : q === "medium" ? 0.3 : 0.22, hide: [ground] });
  scene.add(mir.mesh);
  const timeU = { value: 0 };
  Object.assign(groundMat.uniforms, mir.uniforms, { uTimeW: timeU });
  groundMat.fragmentShader = `uniform float uTimeW;\n${K.NOISE_GLSL}\n${K.WET_GLSL}\n` + groundMat.fragmentShader.replace("float f = 1.0 - exp(", `
      { float puddle = naPuddle(vW.xz * 1.1, 0.62);
        vec2 rip = (vec2(naNoise(vW.xz * 6.0 + uTimeW), naNoise(vW.xz * 6.3 - uTimeW)) - 0.5) * 0.01;
        vec3 Vw = normalize(cameraPosition - vW); float fres = pow(1.0 - clamp(Vw.y, 0.0, 1.0), 3.0);
        vec3 refl = naReflect(vW, rip, mix(2.4, 0.2, puddle));
        float kR = clamp((0.4 + 0.6 * puddle) * (0.45 + 0.55 * fres), 0.0, 0.95);
        col = col * (1.0 - 0.4 * kR) + refl * kR; }
      float f = 1.0 - exp(`);
  groundMat.needsUpdate = true;

  // brick and concrete on the building walls (windows and neon roofs stay as they are)
  Object.assign(winMat.uniforms, { tBrick: { value: K.tex("brick_4", "diff") }, tConc: { value: K.tex("concrete_panels", "diff") } });
  winMat.fragmentShader = "uniform sampler2D tBrick, tConc;\n" + winMat.fragmentShader.replace("vec3 base = vec3(0.07, 0.05, 0.16);", `
      vec2 fuv = vec2(abs(vN.x) > 0.5 ? vW.z : vW.x, vW.y) / 1.4;
      vec3 wallT = fract(vC.r * 7.0 + vC.g * 3.0) > 0.5 ? texture2D(tBrick, fuv).rgb : texture2D(tConc, fuv * 0.8).rgb;
      vec3 base = vec3(0.07, 0.05, 0.16) * (abs(vN.y) < 0.5 ? 0.5 + 1.6 * wallT : vec3(1.0));`);
  winMat.needsUpdate = true;

  // glossy cars and props in the city light
  if (SHAPES.car) { Object.assign(SHAPES.car.mat, { metalness: 0.7, roughness: 0.2, envMap: env, envMapIntensity: 0.8 }); SHAPES.car.mat.needsUpdate = true; }

  // rain around the camera, and the film grade on top of the bloom
  const rain = K.rain(q === "high" ? 2600 : q === "medium" ? 1600 : 900, { area: [40, 30, 40], speed: 22, len: 0.9, opacity: 0.2, color: 0xb4c4ff });
  scene.add(rain);
  const grade = K.makeGrade({ vignette: 0.7, grain: 0.02 }); composer.addPass(grade);
  const setRes = () => grade.uniforms.res.value.set(innerWidth, innerHeight); setRes(); addEventListener("resize", setRes);

  return { tick(dt, t) { timeU.value = t; rain.userData.update(camera, t); grade.uniforms.time.value = t % 100; } };
}
