// Sandblade Siege in 3D: the same battle with real glow. Bloom on every neon line, rider and portal, a wet battlefield
// that mirrors the fortress, the horde and the city, and a film grade. Loaded only when the graphics switch is on 3D;
// the Original renderer is untouched.
import * as THREE from "three";
import * as K from "../../shared/na3d/kit.js";

export function attach({ renderer, scene, camera, groundMat, arenaMat, units = [] }) {
  if (!K.can3D(renderer)) throw new Error("3D mode needs WebGL 2");
  const q = K.tier();
  // the field and the arena: a planar reflection under them, sampled through their grid shaders
  const hide = []; scene.traverse((o) => { if (o.isMesh && (o.material === groundMat || o.material === arenaMat)) hide.push(o); });
  const mir = K.mirror(renderer, { w: 360, d: 400, x: 0, z: -40, scale: q === "high" ? 0.45 : q === "medium" ? 0.3 : 0.22, hide });
  scene.add(mir.mesh);
  const wet = (mat, pud) => {
    Object.assign(mat.uniforms, mir.uniforms, { uPud: { value: pud } });
    mat.fragmentShader = `uniform float uPud;\n${K.NOISE_GLSL}\n${K.WET_GLSL}\n` + mat.fragmentShader.replace("float f = smoothstep(70.0, 175.0,", `
        { float puddle = naPuddle(vW.xz * 0.9, uPud);
          vec2 rip = (vec2(naNoise(vW.xz * 2.5 + uTime * 0.8), naNoise(vW.xz * 2.7 - uTime * 0.7)) - 0.5) * 0.012;
          vec3 Vw = normalize(cameraPosition - vW); float fres = pow(1.0 - clamp(Vw.y, 0.0, 1.0), 3.0);
          vec3 refl = naReflect(vW, rip, mix(2.8, 0.2, puddle));
          float kR = clamp((0.3 + 0.7 * puddle) * (0.35 + 0.65 * fres), 0.0, 0.9);
          c = c * (1.0 - 0.35 * kR) + refl * kR; }
        float f = smoothstep(70.0, 175.0,`);
    mat.needsUpdate = true;
  };
  wet(groundMat, 0.5); wet(arenaMat, 0.42);
  // riders and horde: a little sheen so the bloom picks up their rims
  for (const m of units) if (m && m.material) { m.material.emissiveIntensity = (m.material.emissiveIntensity || 1) * 1.15; }
  // bloom and grade over the whole battle
  const post = K.post(renderer, scene, camera, { bloom: [0.55, 0.42, 0.82], vignette: 0.7, grain: 0.02 });
  let last = performance.now();
  return {
    post, mirror: mir,
    setSize(w, h) { post.composer.setPixelRatio(renderer.getPixelRatio()); post.setSize(w, h); if (mir.on) mir.resize(q === "high" ? 0.45 : q === "medium" ? 0.3 : 0.22); },
    render(flash = 0) { const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; post.grade.uniforms.flash.value = flash; post.render(dt); },
  };
}
