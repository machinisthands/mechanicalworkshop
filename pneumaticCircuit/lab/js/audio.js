// Web Audio കൊണ്ട് ഉണ്ടാക്കുന്ന ശബ്ദങ്ങൾ (ഫയലുകൾ ഒന്നും വേണ്ട)
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // ആദ്യ ടാപ്പിൽ മാത്രമേ ബ്രൗസർ ശബ്ദം അനുവദിക്കൂ
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    // noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;

    // motor hum (silent compressor → താഴ്ന്ന മൂളൽ)
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380;
    for (const [f, type, g] of [[49, 'sawtooth', 0.5], [98, 'triangle', 0.35], [147, 'sine', 0.15]]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(lp);
      o.start();
    }
    lp.connect(this.motorGain).connect(this.master);

    // തുടർച്ചയായ ലീക്ക് ശബ്ദം
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.6;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    src.connect(bp).connect(this.hissGain).connect(this.master);
    src.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  motor(on) {
    if (!this.ctx) return;
    this.motorGain.gain.setTargetAtTime(on ? 0.09 : 0, this.ctx.currentTime, 0.15);
  }

  hiss(level) {
    if (!this.ctx) return;
    this.hissGain.gain.setTargetAtTime(Math.min(0.35, level * 0.08), this.ctx.currentTime, 0.05);
  }

  // ഒറ്റ "ശ്ശ്" (exhaust)
  puff(strength = 1, silenced = true, dur = 0.45) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = silenced ? 'lowpass' : 'highpass';
    f.frequency.value = silenced ? 1100 : 1800;
    const g = ctx.createGain();
    const peak = Math.min(1, strength) * (silenced ? 0.12 : 0.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  click() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square'; o.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.05);
  }

  clunk() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.15);
  }
}
