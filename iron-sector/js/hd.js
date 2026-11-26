// Iron Sector in 3D: the same district and fight, with photo-scanned brick, concrete, asphalt and paving (Poly Haven, CC0),
// streets wet from the rain that mirror the neon, puddles, falling rain and steam from the drains.
// Loaded only when the graphics switch is on 3D; the Original renderer and its Classic / Neon styles are untouched.
import * as THREE from 'three';
import * as K from '../../shared/na3d/kit.js';

const SWAP = { brick: ['brick_4', 1.0], concrete: ['concrete_panels', 0.9], asphalt: ['asphalt_02', 1.0] };   // the plaza paving keeps its own tile pattern
const GROUND = { asphalt: [0.75, 0.5], paving: [0.6, 0.38], tiles: [0.55, 0.32], dirt: [0.35, 0.42] };

// real textures in place of the baked ones (same UV scale, same lighting patches)
export function upgradeMaterials(MAT) {
  for (const [key, [name, tone]] of Object.entries(SWAP)) {
    const m = MAT[key]; if (!m || !m.isMeshStandardMaterial) continue;
    m.map = K.tex(name, 'diff'); m.normalMap = K.tex(name, 'nor'); m.roughnessMap = K.tex(name, 'rough');
    m.color.setScalar(tone); m.normalScale.set(1, 1); m.needsUpdate = true;
  }
  for (const key of ['metalGrey', 'metalWhite', 'metalBlue', 'metalGreen', 'metalRed']) {
    const m = MAT[key]; if (!m || !m.isMeshStandardMaterial) continue;
    m.normalMap = K.tex('metal_plate', 'nor'); m.roughnessMap = K.tex('metal_plate', 'rough'); m.needsUpdate = true;
  }
}

export function attach(R, MAT, { neon, quality }) {
  const scene = R.scene, r = R.r;
  // the ground meshes: what the puddles live on, and what the reflection must not see of itself
  const groundMats = new Set(Object.keys(GROUND).map((k) => MAT[k]).filter(Boolean)), hide = [];
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  scene.traverse((o) => { if (o.isMesh && groundMats.has(o.material)) { hide.push(o); box.union(tmp.setFromObject(o)); } });
  if (box.isEmpty()) box.set(new THREE.Vector3(-150, 0, -150), new THREE.Vector3(150, 0, 150));
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const scale = quality === 'low' ? 0.22 : quality === 'medium' ? 0.32 : quality === 'ultra' ? 0.55 : 0.45;
  const mirror = K.mirror(r, { w: size.x + 60, d: size.z + 60, x: c.x, z: c.z, y: 0, scale: Math.max(scale, 0.2), hide });
  mirror.mesh.userData.noAO = true; mirror.on = scale > 0; scene.add(mirror.mesh);
  for (const [key, [wet, puddles]] of Object.entries(GROUND)) if (MAT[key]) K.wetStandard(MAT[key], mirror, { wet: neon ? wet : wet * 0.6, puddles, groundY: 0 });
  // ambient occlusion renders the scene again: it must not trigger the reflection or see the mirror plane
  if (R.gtao) { const ov = R.gtao.overrideVisibility.bind(R.gtao); R.gtao.overrideVisibility = () => { ov(); mirror.mesh.visible = false; }; const rv = R.gtao.restoreVisibility.bind(R.gtao); R.gtao.restoreVisibility = () => { rv(); mirror.mesh.visible = mirror.on; }; }
  // rain at night (after a storm in the Classic golden hour: wet streets, no rain), steam from the drains
  const rain = neon ? K.rain(quality === 'low' ? 1200 : quality === 'medium' ? 2200 : 3400, { area: [60, 30, 60], speed: 24, len: 0.6, opacity: 0.18, color: 0xa8b8ff }) : null;
  if (rain) { rain.userData.noAO = true; scene.add(rain); }
  const steam = new THREE.Group(); steam.userData.noAO = true; scene.add(steam);
  const spots = hide.filter((m) => m.material === MAT.asphalt).map((m) => new THREE.Box3().setFromObject(m)).filter((b) => b.max.x - b.min.x > 6 || b.max.z - b.min.z > 6);
  for (let k = 0; k < Math.min(10, spots.length * 2); k++) {
    const b = spots[k % spots.length], p = K.puffs(6, { spread: [1.2, 1.2, 1.2], size: [1.2, 3.4], color: neon ? 0xcdbcff : 0xe8dccb, opacity: 0.06, rise: 2.6 });
    p.position.set(b.min.x + (b.max.x - b.min.x) * K.rand(), 0.15, b.min.z + (b.max.z - b.min.z) * K.rand()); p.traverse((s) => (s.userData.noAO = true)); steam.add(p);
  }
  let t = 0;
  R.tickers.push((dt) => {
    t += dt; mirror.beginFrame();
    if (mirror.on && (R.dynScale || 1) < 0.72) mirror.on = false;   // the game is struggling: drop the reflection first
    for (const m of groundMats) if (m.userData.timeU) m.userData.timeU.value = t;
    if (rain) rain.userData.update(R.camera, t);
    steam.children.forEach((g) => g.children.forEach((s, j) => { s.material.rotation += dt * 0.15 * (j % 2 ? 1 : -1); s.position.y = (s.position.y + dt * 0.4) % 3.6; }));
  });
  return { mirror, rain, steam, setQuality(q) { const s2 = q === 'low' ? 0 : q === 'medium' ? 0.32 : 0.45; mirror.on = s2 > 0; if (s2 > 0) mirror.resize(s2); if (rain) rain.geometry.setDrawRange(0, (q === 'low' ? 1200 : q === 'medium' ? 2200 : 3400) * 2); } };
}
