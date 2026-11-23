// ലളിതമായ ന്യൂമാറ്റിക് സിമുലേഷൻ
// ഓരോ ഫ്രെയിമിലും ട്യൂബുകളും വാൽവ് സ്ഥാനങ്ങളും നോക്കി ഏതൊക്കെ പോർട്ടുകൾ
// ഒരേ "എയർ സ്പേസ്" ആണെന്ന് കണ്ടെത്തുന്നു (union-find), എന്നിട്ട് പ്രഷർ കൊടുക്കുന്നു.

export const CUT_OUT = 5.0;   // ഈ പ്രഷറിൽ motor നിൽക്കും
export const CUT_IN = 4.0;    // ഈ പ്രഷറിൽ motor വീണ്ടും ഓണാകും

const FILL_RATE = 0.04;       // bar/s, motor ഓടുമ്പോൾ (1×)
const NATURAL_LEAK = 0.0014;  // bar/s, ചെറിയ സ്വാഭാവിക ലീക്ക് → 5→4 bar ഏകദേശം 12 മിനിറ്റ്
const OPEN_LEAK = { 10: 0.1, 4: 0.04 }; // തുറന്ന പോർട്ട്/ട്യൂബ് വഴിയുള്ള ലീക്ക് (ഓരോ bar-നും)

class UF {
  constructor() { this.p = new Map(); }
  add(x) { if (!this.p.has(x)) this.p.set(x, x); }
  find(x) { let r = x; while (this.p.get(r) !== r) r = this.p.get(r); this.p.set(x, r); return r; }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

export class Sim {
  constructor(app) {
    this.app = app;
    this.mains = false;        // wall switch (mains supply)
    this.power = true;         // compressor's own ON/OFF switch
    this.motorOn = false;
    this.tankP = 0;
    this.regSet = 3.0;
    this.svOpen = false;
    this.lever = 0;            // 0: 1→2, 4→5   1: 1→4, 2→3
    this.silencer = { 3: true, 5: true };
    this.cylPos = 0;           // 0 = പിന്നിൽ, 1 = മുന്നിൽ
    this.cylVel = 0;
    this.speed = 10;           // fixed time speed (10×)
    this.nodeP = new Map();
    this.prevP = new Map();
    this.vents = [];
    this.lubFlow = 0;
    this.events = [];          // ശബ്ദത്തിനും ഇഫക്റ്റിനും
    this.water = 0;            // water collected in the filter bowl (0 = dry, 0.3 = max shown)
    this.condensing = false;
    this.drainOpen = false;
  }

  p(id) { return this.nodeP.get(id) || 0; }

  // compressor gets power only when both the wall switch and its own switch are ON
  get live() { return this.mains && this.power; }

  // എയർ നെറ്റ്‌വർക്ക് കണക്കാക്കുന്നു
  network() {
    const { ports, tubes } = this.app;
    const uf = new UF();
    for (const p of ports) uf.add(p.id);
    for (const n of ['MAN', 'CAP', 'ROD']) uf.add(n);
    const vents = [];

    for (const t of tubes) {
      const [a, b] = t.ends;
      if (a.port && b.port) uf.union(a.port.id, b.port.id);
      else if (a.port || b.port) vents.push({ node: (a.port || b.port).id, type: 'free', tube: t, size: t.size });
    }
    for (const p of ports) {
      if (p.selfSealing) { if (p.tube) uf.union(p.id, 'MAN'); }
      else if (!p.tube) vents.push({ node: p.id, type: 'open', port: p, size: p.size });
    }
    if (this.svOpen) uf.union('S.in', 'MAN');
    else vents.push({ node: 'MAN', type: 'exhaust', where: 'slide', size: 10 });

    if (this.lever === 0) { uf.union('V.1', 'V.2'); vents.push({ node: 'V.4', type: 'exhaust', where: 5, size: 4 }); }
    else { uf.union('V.1', 'V.4'); vents.push({ node: 'V.2', type: 'exhaust', where: 3, size: 4 }); }
    uf.union('Y.A', 'CAP');
    uf.union('Y.B', 'ROD');

    // പ്രഷർ ഉറവിടങ്ങൾ
    const gP = new Map();
    const src = new Set();
    const rc = uf.find('C.out');
    gP.set(rc, this.tankP); src.add(rc);
    const rin = uf.find('F.in'), rout = uf.find('F.out');
    if (rout !== rin) {
      const pin = gP.get(rin) || 0;
      gP.set(rout, Math.max(gP.get(rout) || 0, Math.min(this.regSet, pin)));
      if (pin > 0) src.add(rout);
    }
    const vented = new Set(vents.map((v) => uf.find(v.node)));

    // ഓരോ നോഡിനും പ്രഷർ
    const all = [...uf.p.keys()];
    const trapped = new Map(); // ഉറവിടമോ ലീക്കോ ഇല്ലാത്തവ പഴയ പ്രഷർ നിലനിർത്തും
    for (const id of all) {
      const r = uf.find(id);
      if (!gP.has(r) && !vented.has(r)) trapped.set(r, Math.max(trapped.get(r) || 0, this.prevP.get(id) || 0));
    }
    this.prevP = this.nodeP;
    this.nodeP = new Map();
    for (const id of all) {
      const r = uf.find(id);
      this.nodeP.set(id, gP.has(r) ? gP.get(r) : trapped.get(r) || 0);
    }
    this.uf = uf;
    this.src = src;
    this.vents = vents;
  }

  step(dtReal) {
    const dt = Math.min(dtReal, 0.05);
    this.events.length = 0;
    this.network();

    // Pressure switch
    if (this.live) {
      if (!this.motorOn && this.tankP <= CUT_IN) { this.motorOn = true; this.events.push({ type: 'motorStart' }); }
      if (this.motorOn && this.tankP >= CUT_OUT) { this.motorOn = false; this.events.push({ type: 'cutOut' }); }
    } else if (this.motorOn) {
      this.motorOn = false;
    }

    // ലീക്കുകൾ
    let leak = 0;
    this.leaks = [];
    this.whips = [];
    this.exhaustFlows = [];
    for (const v of this.vents) {
      const P = this.p(v.node);
      if (v.type === 'free') {
        v.tube.whip = P;
        if (P > 0.15) this.whips.push(v);
      }
      if (P <= 0.15) continue;
      const fed = this.src.has(this.uf.find(v.node));
      if (v.type === 'exhaust') {
        // Supply connected straight to an exhaust path (e.g. air into port 2 with 2→3 open):
        // air keeps blowing out through the silencer
        if (fed) { leak += P * 0.03; this.exhaustFlows.push(v); }
        continue;
      }
      if (fed) leak += P * OPEN_LEAK[v.size];
      if (v.type === 'open') this.leaks.push(v);
    }
    for (const t of this.app.tubes) if (t.connectedCount !== 1) t.whip = 0;

    // Exhaust ഇവന്റുകൾ (പ്രഷർ പെട്ടെന്ന് പോയാൽ "ശ്ശ്" ശബ്ദം)
    for (const v of this.vents) {
      if (v.type !== 'exhaust') continue;
      const before = this.prevP.get(v.node) || 0;
      if (before > 0.3 && this.p(v.node) < 0.05) this.events.push({ type: 'exhaust', where: v.where, p: before });
    }

    // Cylinder
    const Pa = this.p('CAP'), Pb = this.p('ROD');
    const F = Pa * 1.0 - Pb * 0.86;
    let v = 0;
    // Speed follows the pressure: ~4 bar fast, ~3 bar good, low pressure slow
    if (Math.abs(F) > 0.3) v = Math.sign(F) * Math.min(2.2, 0.5 * (Math.abs(F) - 0.3));
    // Low pressure: air reaches the cylinder but too weakly (only reported, no hints)
    const drive = Math.max(Pa, Pb);
    this.lowPressure = drive > 0.15 && drive < 2.0;
    if (v < 0 && this.cylPos < 0.15) v *= 0.35; // cushioning (cap end)
    const old = this.cylPos;
    this.cylPos = Math.min(1, Math.max(0, this.cylPos + v * dt));
    const moved = Math.abs(this.cylPos - old);
    this.cylVel = moved / dt;
    const driveP = v > 0 ? Pa : Pb;
    const driveRoot = this.uf.find(v > 0 ? 'CAP' : 'ROD');
    let consume = 0;
    if (moved > 0 && this.src.has(driveRoot)) consume = moved * 0.015 * driveP;
    if (old > 0 && old < 1 && (this.cylPos === 0 || this.cylPos === 1)) this.events.push({ type: 'cylEnd' });

    // Lubricator-ലൂടെയുള്ള ഒഴുക്ക്
    const lubRoot = this.uf.find('F.out');
    let lubLeak = 0;
    for (const vv of this.vents) if (vv.type !== 'exhaust' && this.uf.find(vv.node) === lubRoot) lubLeak += this.p(vv.node);
    this.lubFlow = (this.src.has(driveRoot) && driveRoot === lubRoot ? this.cylVel : 0) + lubLeak * 0.2;

    // Filter bowl: compressed air leaves moisture; the drain blows it out
    // Moisture condenses slowly, only while compressed air is passing through the filter
    const pFilter = this.p('F.in');
    this.condensing = pFilter > 0.2 && (this.motorOn || this.lubFlow > 0.005) && this.water < 0.3;
    if (this.condensing) this.water = Math.min(0.3, this.water + 0.00025 * this.speed * dt);
    // Water itself is removed by the spray effect (drop by drop); here only the air loss
    if (this.drainOpen && pFilter > 0.2 && this.src.has(this.uf.find('F.in'))) leak += pFilter * 0.03;
    this.drainP = this.drainOpen ? pFilter : 0;

    // ടാങ്ക് പ്രഷർ
    const fill = this.motorOn ? FILL_RATE * this.speed * Math.max(0.2, 1 - this.tankP / 9) : 0;
    const natural = this.tankP > 0 ? NATURAL_LEAK * this.speed : 0;
    this.tankP = Math.max(0, this.tankP + (fill - natural - leak) * dt - consume);
    this.totalLeak = leak;
  }
}
