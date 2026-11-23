// Water spray from the filter drain: droplets + a little mist
import * as THREE from 'three';

const G = new THREE.Vector3(0, -60, 0); // gravity (cm/s²) – a bit softened so the spray is visible

export class DrainSpray {
  constructor(scene) {
    this.drops = [];
    this.mists = [];
    const dropGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const dropMat = new THREE.MeshStandardMaterial({ color: 0x9fd3ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 80; i++) {
      const m = new THREE.Mesh(dropGeo, dropMat);
      m.visible = false;
      scene.add(m);
      this.drops.push({ m, v: new THREE.Vector3(), life: 0 });
    }
    const mistGeo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(mistGeo, mat);
      m.visible = false;
      scene.add(m);
      this.mists.push({ m, v: new THREE.Vector3(), life: 0, max: 1 });
    }
    this.acc = 0;
    this.macc = 0;
  }

  // Called every frame. Sprays only while the drain is held open.
  // With air pressure: the collected water shoots out as droplets, then only an air/mist jet.
  // Without pressure: the water just drips out slowly.
  emit(dt, origin, sim) {
    if (!sim.drainOpen) { this.acc = 0; this.macc = 0; return; }
    const pressure = sim.drainP;
    const strong = pressure > 0.2;
    const hasWater = sim.water > 0.004;
    const rate = hasWater ? (strong ? 60 : 3) : 0; // drops per second
    this.acc += rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      const d = this.drops.find((x) => x.life <= 0);
      if (!d) break;
      sim.water = Math.max(0, sim.water - 0.006); // every drop empties the bowl a little
      d.m.visible = true;
      d.m.position.copy(origin);
      const sp = strong ? 6 + pressure * 5 : 0.5;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (strong ? 0.75 : 0.1);
      d.v.set(Math.cos(a) * r * sp, -sp * (0.6 + Math.random() * 0.5), Math.sin(a) * r * sp);
      d.life = 1.2;
      d.m.scale.setScalar(0.6 + Math.random() * 0.8);
    }
    if (strong) {
      this.macc += 22 * dt;
      while (this.macc >= 1) {
        this.macc -= 1;
        const m = this.mists.find((x) => x.life <= 0);
        if (!m) break;
        m.m.visible = true;
        m.m.position.copy(origin);
        const a = Math.random() * Math.PI * 2;
        m.v.set(Math.cos(a) * 3, -6 - pressure * 3, Math.sin(a) * 3);
        m.life = m.max = 0.6 + Math.random() * 0.4;
        m.m.scale.setScalar(0.3);
      }
    }
  }

  update(dt) {
    for (const d of this.drops) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v.addScaledVector(G, dt);
      d.m.position.addScaledVector(d.v, dt);
      if (d.m.position.y < 0.2 || d.life <= 0) { d.life = 0; d.m.visible = false; }
    }
    for (const m of this.mists) {
      if (m.life <= 0) continue;
      m.life -= dt;
      const k = 1 - m.life / m.max;
      m.m.position.addScaledVector(m.v, dt);
      m.v.multiplyScalar(1 - dt * 2.5);
      m.m.scale.setScalar(0.3 + k * 2.2);
      m.m.material.opacity = 0.35 * (1 - k);
      if (m.life <= 0) m.m.visible = false;
    }
  }
}

// Small white air puffs: continuous jets (open ports, exhausts) and short bursts
export class AirPuffs {
  constructor(scene) {
    this.p = [];
    const geo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.p.push({ m, v: new THREE.Vector3(), life: 0, max: 1, grow: 1, op: 0.3 });
    }
    this.acc = new Map();
  }

  _spawn(pos, dir, strength, grow, op) {
    const q = this.p.find((x) => x.life <= 0);
    if (!q) return;
    q.m.visible = true;
    q.m.position.copy(pos);
    const sp = 3 + strength * 4;
    q.v.copy(dir).multiplyScalar(sp).add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));
    q.life = q.max = 0.45 + Math.random() * 0.35;
    q.grow = grow;
    q.op = op;
    q.m.scale.setScalar(0.15);
  }

  // key: any id so each source keeps its own timing
  stream(dt, key, pos, dir, strength, rate = 18, grow = 1.2, op = 0.3) {
    let a = (this.acc.get(key) || 0) + rate * dt;
    while (a >= 1) { a -= 1; this._spawn(pos, dir, strength, grow, op); }
    this.acc.set(key, a);
  }

  burst(pos, dir, strength, n = 8, grow = 1.4, op = 0.35) {
    for (let i = 0; i < n; i++) this._spawn(pos, dir, strength, grow, op);
  }

  update(dt) {
    for (const q of this.p) {
      if (q.life <= 0) continue;
      q.life -= dt;
      const k = 1 - q.life / q.max;
      q.m.position.addScaledVector(q.v, dt);
      q.v.multiplyScalar(1 - dt * 3);
      q.m.scale.setScalar(0.15 + k * q.grow);
      q.m.material.opacity = q.op * (1 - k);
      if (q.life <= 0) q.m.visible = false;
    }
  }
}
