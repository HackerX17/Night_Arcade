// Effects: bloom (the neon glow), smoke / sparks / nitro flames, and skid marks.
import * as THREE from "../vendor/three.module.min.js";

// ---------- bloom: render the scene to an HDR target, blur the bright parts, add them back, tone-map ----------
const QUAD_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
export class Post {
  constructor(renderer) {
    this.r = renderer; this.w = 1; this.h = 1; this.strength = 0.9;
    const hf = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.rt = [0, 1, 2, 3].map(() => new THREE.WebGLRenderTarget(1, 1, hf));
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.scene.add(this.quad);
    this.bright = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, thr: { value: 0.85 } }, vertexShader: QUAD_VS, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tex; uniform float thr; varying vec2 vUv; void main() { vec3 c = texture2D(tex, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * max(l - thr, 0.0) / max(l, 1e-4), 1.0); }` });
    this.blur = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: QUAD_VS, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
        void main() { vec3 c = texture2D(tex, vUv).rgb * 0.227027;
          c += (texture2D(tex, vUv + dir * 1.3846).rgb + texture2D(tex, vUv - dir * 1.3846).rgb) * 0.3162162;
          c += (texture2D(tex, vUv + dir * 3.2308).rgb + texture2D(tex, vUv - dir * 3.2308).rgb) * 0.0702703;
          gl_FragColor = vec4(c, 1.0); }` });
    this.comp = new THREE.ShaderMaterial({ uniforms: { scene: { value: null }, b1: { value: null }, b2: { value: null }, k: { value: 1 }, flash: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) }, vig: { value: 0.35 } },
      vertexShader: QUAD_VS, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D scene, b1, b2; uniform float k, flash, vig; uniform vec3 tint; varying vec2 vUv;
        vec3 aces(vec3 x) { x *= 0.9; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        void main() {
          vec3 c = texture2D(scene, vUv).rgb + (texture2D(b1, vUv).rgb * 0.8 + texture2D(b2, vUv).rgb * 1.1) * k;
          c *= tint; c = aces(c);
          vec2 d = vUv - 0.5; c *= 1.0 - vig * dot(d, d) * 1.6;
          c = mix(c, vec3(1.0), flash);
          gl_FragColor = vec4(srgb(c), 1.0);
        }` });
  }
  setSize(w, h) {
    this.w = w; this.h = h; this.rtScene.setSize(w, h);
    const w2 = Math.max(1, w >> 2), h2 = Math.max(1, h >> 2), w3 = Math.max(1, w >> 3), h3 = Math.max(1, h >> 3);
    this.rt[0].setSize(w2, h2); this.rt[1].setSize(w2, h2); this.rt[2].setSize(w3, h3); this.rt[3].setSize(w3, h3);
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  render(scene, camera) {
    const r = this.r, [a, b, c, d] = this.rt;
    r.setRenderTarget(this.rtScene); r.render(scene, camera);
    this.bright.uniforms.tex.value = this.rtScene.texture; this.pass(this.bright, a);
    this.blur.uniforms.tex.value = a.texture; this.blur.uniforms.dir.value.set(1 / a.width, 0); this.pass(this.blur, b);
    this.blur.uniforms.tex.value = b.texture; this.blur.uniforms.dir.value.set(0, 1 / a.height); this.pass(this.blur, a);
    this.blur.uniforms.tex.value = a.texture; this.blur.uniforms.dir.value.set(2 / c.width, 0); this.pass(this.blur, c);
    this.blur.uniforms.tex.value = c.texture; this.blur.uniforms.dir.value.set(0, 2 / c.height); this.pass(this.blur, d);
    const u = this.comp.uniforms; u.scene.value = this.rtScene.texture; u.b1.value = a.texture; u.b2.value = d.texture; u.k.value = this.strength;
    this.pass(this.comp, null);
  }
}

// ---------- particles ----------
export class Particles {
  constructor(scene, max = 900) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max); this.life = new Float32Array(max); this.span = new Float32Array(max); this.grow = new Float32Array(max); this.drag = new Float32Array(max); this.base = new Float32Array(max * 3);
    const make = (blending) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 3), 3)); g.setAttribute("pcol", new THREE.BufferAttribute(new Float32Array(max * 4), 4)); g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(max), 1));
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending,
        vertexShader: `attribute float size; attribute vec4 pcol; varying vec4 vC; void main() { vC = pcol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * 340.0 / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying vec4 vC; void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC.rgb, vC.a * a); }` });
      const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts); return pts;
    };
    this.add = make(THREE.AdditiveBlending); this.norm = make(THREE.NormalBlending);
    this.kind = new Uint8Array(max);   // 0 additive, 1 normal (smoke)
  }
  emit(x, y, z, vx, vy, vz, r, g, b, a, size, life, opt = {}) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.base.set([r, g, b], i * 3); this.col[i * 4 + 3] = a;
    this.size[i] = size; this.life[i] = life; this.span[i] = life; this.grow[i] = opt.grow || 0; this.drag[i] = opt.drag || 0; this.kind[i] = opt.smoke ? 1 : 0;
  }
  update(dt) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt; if (this.life[i] <= 0) continue;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      for (let c = 0; c < 3; c++) { this.vel[i * 3 + c] *= k; this.pos[i * 3 + c] += this.vel[i * 3 + c] * dt; }
      if (this.kind[i] === 0) this.vel[i * 3 + 1] -= 9 * dt;
      this.size[i] += this.grow[i] * dt;
      if (w !== i) { this.pos.copyWithin(w * 3, i * 3, i * 3 + 3); this.vel.copyWithin(w * 3, i * 3, i * 3 + 3); this.base.copyWithin(w * 3, i * 3, i * 3 + 3); this.col[w * 4 + 3] = this.col[i * 4 + 3]; this.size[w] = this.size[i]; this.life[w] = this.life[i]; this.span[w] = this.span[i]; this.grow[w] = this.grow[i]; this.drag[w] = this.drag[i]; this.kind[w] = this.kind[i]; }
      w++;
    }
    this.n = w;
    // split into the two point clouds
    const fill = (pts, kind) => {
      const P = pts.geometry.attributes.position.array, C = pts.geometry.attributes.pcol.array, S = pts.geometry.attributes.size.array; let m = 0;
      for (let i = 0; i < this.n; i++) {
        if (this.kind[i] !== kind) continue;
        const f = this.life[i] / this.span[i];
        P[m * 3] = this.pos[i * 3]; P[m * 3 + 1] = this.pos[i * 3 + 1]; P[m * 3 + 2] = this.pos[i * 3 + 2];
        C[m * 4] = this.base[i * 3]; C[m * 4 + 1] = this.base[i * 3 + 1]; C[m * 4 + 2] = this.base[i * 3 + 2]; C[m * 4 + 3] = this.col[i * 4 + 3] * (kind ? f * f : f);
        S[m] = this.size[i]; m++;
      }
      pts.geometry.setDrawRange(0, m);
      pts.geometry.attributes.position.needsUpdate = pts.geometry.attributes.pcol.needsUpdate = pts.geometry.attributes.size.needsUpdate = true;
    };
    fill(this.add, 0); fill(this.norm, 1);
  }
  clear() { this.n = 0; this.update(0); }
}

// ---------- skid marks: dark strips left by the rear tyres while sliding ----------
export class Skids {
  constructor(scene, max = 700) {
    this.max = max; this.k = 0;
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(max * 6 * 3); this.alpha = new Float32Array(max * 6);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3)); g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      vertexShader: `attribute float alpha; varying float vA; void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vA; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, vA * 0.55); }` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; scene.add(this.mesh); this.last = [null, null];
  }
  // wheel: 0 left, 1 right; (x, z) its position this frame; on: still sliding
  mark(wheel, x, z, on, strength = 1) {
    const L = this.last[wheel];
    if (!on) { this.last[wheel] = null; return; }
    if (!L) { this.last[wheel] = [x, z]; return; }
    const dx = x - L[0], dz = z - L[1], d = Math.hypot(dx, dz); if (d < 0.5) return;
    const nx = (-dz / d) * 0.14, nz = (dx / d) * 0.14, i = this.k % this.max, y = 0.03;
    const q = [L[0] - nx, y, L[1] - nz, L[0] + nx, y, L[1] + nz, x + nx, y, z + nz, L[0] - nx, y, L[1] - nz, x + nx, y, z + nz, x - nx, y, z - nz];
    this.pos.set(q, i * 18); this.alpha.fill(Math.min(1, strength), i * 6, i * 6 + 6);
    this.k++; this.last[wheel] = [x, z];
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = g.attributes.alpha.needsUpdate = true; g.setDrawRange(0, Math.min(this.k, this.max) * 6);
  }
  clear() { this.k = 0; this.last = [null, null]; this.mesh.geometry.setDrawRange(0, 0); }
}
