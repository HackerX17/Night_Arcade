// Sound: a synthesised engine (rises and drops through the gears), tyre squeal, wind, the siren, and the one-shot effects.
const AS = () => window.ArcadeSound;
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.lastHit = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    try {
      const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.6;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; this.master.connect(comp); comp.connect(ctx.destination);
      // engine: two detuned saws and a sub through a low-pass that opens with the throttle
      this.eng = ctx.createGain(); this.eng.gain.value = 0; this.engLP = ctx.createBiquadFilter(); this.engLP.type = "lowpass"; this.engLP.Q.value = 3;
      this.o1 = ctx.createOscillator(); this.o1.type = "sawtooth"; this.o2 = ctx.createOscillator(); this.o2.type = "sawtooth"; this.o2.detune.value = 14; this.o3 = ctx.createOscillator(); this.o3.type = "square";
      const g3 = ctx.createGain(); g3.gain.value = 0.5;
      this.o1.connect(this.engLP); this.o2.connect(this.engLP); this.o3.connect(g3); g3.connect(this.engLP); this.engLP.connect(this.eng); this.eng.connect(this.master);
      for (const o of [this.o1, this.o2, this.o3]) o.start();
      // noise for tyres and wind
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const loop = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
      this.tyre = ctx.createGain(); this.tyre.gain.value = 0; const tbp = ctx.createBiquadFilter(); tbp.type = "bandpass"; tbp.frequency.value = 1700; tbp.Q.value = 6; loop().connect(tbp); tbp.connect(this.tyre); this.tyre.connect(this.master);
      this.wind = ctx.createGain(); this.wind.gain.value = 0; const wlp = ctx.createBiquadFilter(); wlp.type = "lowpass"; wlp.frequency.value = 700; loop().connect(wlp); wlp.connect(this.wind); this.wind.connect(this.master);
      this.nos = ctx.createGain(); this.nos.gain.value = 0; const nhp = ctx.createBiquadFilter(); nhp.type = "highpass"; nhp.frequency.value = 2500; loop().connect(nhp); nhp.connect(this.nos); this.nos.connect(this.master);
      // siren: one voice for the nearest police car, wailing far off and yelping up close
      this.siren = ctx.createGain(); this.siren.gain.value = 0; this.so = ctx.createOscillator(); this.so.type = "square"; const sl = ctx.createBiquadFilter(); sl.type = "lowpass"; sl.frequency.value = 2200;
      this.so.connect(sl); sl.connect(this.siren); this.siren.connect(this.master); this.so.start(); this.sirenT = 0;
    } catch (e) { this.ctx = null; }
  }
  get sfxOn() { return this.ctx && !this.muted && !(AS() && !AS().sfx); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05); }
  // every frame: s = { on, rpm, throttle, speed, slip, nitro, siren (0..1 loudness), close (0..1) }
  update(s, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, on = s.on && this.sfxOn;
    const f = 34 + s.rpm * 150 + s.throttle * 6;
    this.o1.frequency.setTargetAtTime(f, t, 0.03); this.o2.frequency.setTargetAtTime(f * 1.005, t, 0.03); this.o3.frequency.setTargetAtTime(f / 2, t, 0.03);
    this.engLP.frequency.setTargetAtTime(300 + s.throttle * 1500 + s.rpm * 1100, t, 0.05);
    this.eng.gain.setTargetAtTime(on ? 0.07 + s.throttle * 0.06 : 0, t, 0.06);
    this.tyre.gain.setTargetAtTime(on ? Math.min(0.12, s.slip * 0.16) : 0, t, 0.05);
    this.wind.gain.setTargetAtTime(on ? Math.min(0.1, s.speed / 900) : 0, t, 0.2);
    this.nos.gain.setTargetAtTime(on && s.nitro ? 0.05 : 0, t, 0.08);
    this.sirenT += dt * (s.close > 0.5 ? 5 : 0.42);
    const ph = this.sirenT % 1, sf = s.close > 0.5 ? (ph < 0.5 ? 700 + ph * 1800 : 1600 - (ph - 0.5) * 1800) : 650 + 650 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2));
    this.so.frequency.setTargetAtTime(sf, t, 0.02);
    this.siren.gain.setTargetAtTime(on ? s.siren * 0.045 : 0, t, 0.1);
  }
  tone(freq, dur, vol, type = "triangle", delay = 0, slide = 1) {
    if (!this.sfxOn) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, freq = 900, delay = 0) {
    if (!this.sfxOn) return;
    const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = "lowpass"; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  hit(k) { const now = performance.now(); if (now - this.lastHit < 90) return; this.lastHit = now; this.noise(0.25 + k * 0.25, Math.min(0.5, 0.1 + k * 0.4), 500 + k * 900); this.tone(70, 0.25, Math.min(0.25, k * 0.3), "sine", 0, 0.5); }
  checkpoint() { [880, 1320].forEach((f, i) => this.tone(f, 0.18, 0.06, "triangle", i * 0.07)); }
  beep(hi) { this.tone(hi ? 1320 : 660, hi ? 0.5 : 0.22, 0.09, "square"); }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 0.07, "triangle", i * 0.09)); }
  lose() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.35, 0.07, "triangle", i * 0.14)); }
  busted() { this.tone(180, 0.6, 0.12, "sawtooth", 0, 0.6); this.tone(120, 0.8, 0.1, "square", 0.2, 0.7); }
  escaped() { [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.3, 0.07, "triangle", i * 0.08)); }
  heat() { this.tone(330, 0.15, 0.08, "square"); this.tone(495, 0.25, 0.08, "square", 0.16); }
  cash() { [1568, 2093].forEach((f, i) => this.tone(f, 0.2, 0.05, "sine", i * 0.06)); }
  boom() { this.noise(1.2, 0.5, 500); this.tone(55, 1.0, 0.25, "sine", 0, 0.4); }
  spikes() { this.noise(0.6, 0.35, 3000); this.tone(900, 0.4, 0.05, "sawtooth", 0, 0.3); }
  nitroStart() { this.noise(0.4, 0.15, 4000); }
  click() { this.tone(1200, 0.05, 0.04, "sine"); }
}
