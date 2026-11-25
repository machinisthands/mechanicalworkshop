// എല്ലാ ഉപകരണങ്ങളുടെയും 3D മോഡലുകൾ (അളവ്: സെന്റീമീറ്റർ)
import * as THREE from 'three';
import { M, mesh, box, cyl, cylX, cylZ, roundBox, pickable } from './materials.js';
import { createGauge } from './gauge.js';
import { Port, label } from './ports.js';

// ---------- വർക്ക് ടേബിളും പ്രൊഫൈൽ ബോർഡും ----------
export function buildBench(scene) {
  const g = new THREE.Group();
  const top = box(210, 3, 62, M.table, 2, -1.5, 9);
  g.add(top);
  for (const [x, z] of [[-98, -18], [102, -18], [-98, 36], [102, 36]]) {
    g.add(box(4, 72, 4, M.aluDark, x, -39, z));
  }
  // Invisible floor that only shows the shadow (like the other 3D models)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -75;
  floor.receiveShadow = true;
  g.add(floor);

  // അലുമിനിയം പ്രൊഫൈൽ പ്ലേറ്റ് (ട്രെയിനർ ബോർഡ്)
  const board = box(150, 60, 1.6, M.board, 12, 31, -9.8);
  g.add(board);
  for (let y = 4; y <= 58; y += 5) {
    const s = box(150, 0.55, 0.12, M.slot, 12, y, -8.98);
    s.castShadow = false;
    g.add(s);
  }
  // ബോർഡിന്റെ കാലുകൾ
  g.add(box(4, 3, 14, M.aluDark, -60, 1.5, -6));
  g.add(box(4, 3, 14, M.aluDark, 84, 1.5, -6));
  scene.add(g);
  return g;
}

// ---------- Compressor (Janatics silent compressor) ----------
// Spec plate drawn on a canvas, wrapped round the front of the motor
function specLabel() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#0d0d0f'; x.fillRect(0, 0, 512, 160);
  x.strokeStyle = '#e8e8e8'; x.lineWidth = 2;
  x.strokeRect(4, 4, 504, 152);
  x.beginPath(); x.moveTo(300, 4); x.lineTo(300, 156);
  for (const y of [44, 84, 120]) { x.moveTo(4, y); x.lineTo(300, y); }
  x.moveTo(44, 4); x.lineTo(44, 156); x.stroke();
  x.fillStyle = '#f2f2f2'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '600 20px Inter, Arial, sans-serif';
  [['230 V~ AC - 50 Hz', 24], ['0.34 KW - 2.4 A - 2900 rpm', 64], ['50 l/min', 102], ['32 l/min', 138]].forEach(([t, y]) => x.fillText(t, 172, y));
  x.font = '600 14px Inter, Arial, sans-serif';
  [['1ph', 24], ['M', 64], ['0 bar', 102], ['8 bar', 138]].forEach(([t, y]) => x.fillText(t, 24, y));
  x.font = '600 17px Inter, Arial, sans-serif';
  x.fillText('Max working time', 405, 28);
  x.fillText('15 min on / 15 min off', 405, 64);
  x.font = '500 14px Inter, Arial, sans-serif';
  x.fillText('Protect compressor against', 405, 104);
  x.fillText('rain and moisture', 405, 124);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function brandLabel() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#16181b'; x.fillRect(0, 0, 256, 64);
  x.fillStyle = '#1e88e5'; x.font = '800 40px Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('JANATICS', 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCompressor() {
  const g = new THREE.Group();
  g.position.set(-62, 0, 12);
  const comp = { key: 'compressor', group: g, ports: [] };
  pickable(g, { kind: 'comp', key: 'compressor' });

  const tankMat = new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.3, roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xeef1f4, metalness: 1, roughness: 0.12 });
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x141517, metalness: 0.2, roughness: 0.5 });

  // Flat round tank (pancake), standing on its base
  const TR = 17, TB = 2.2, TT = 15;
  const prof = [[0, TB], [TR - 2.5, TB], [TR - 0.6, TB + 0.8], [TR, TB + 2.4], [TR, TT - 2.4], [TR - 0.6, TT - 0.8], [TR - 2.5, TT], [0, TT]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  g.add(mesh(new THREE.LatheGeometry(prof, 64), tankMat));
  g.add(cyl(TR + 0.12, 0.5, tankMat, 0, (TB + TT) / 2, 0, 64)); // weld seam
  // Brand plate on the front of the tank
  const brand = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshStandardMaterial({ map: brandLabel(), roughness: 0.6 }));
  brand.position.set(0, TT - 3.6, TR + 0.08);
  brand.rotation.x = -0.12;
  g.add(brand);
  // Tank drain
  g.add(cyl(0.45, 1.4, M.brass, 3, TT + 0.6, 9, 12));
  g.add(box(1.6, 0.35, 0.35, M.brass, 3, TT + 1.2, 9));

  // Chrome carry frame: two posts in black sleeves with rubber feet, bar over the top
  const PX = 18.6, PZ = 4.5, TOP = 43;
  for (const s of [-1, 1]) {
    g.add(cyl(1.35, 2.2, M.rubber, s * PX, 1.1, PZ, 20));
    g.add(cyl(1.05, 13, M.black, s * PX, 8.6, PZ, 20));
  }
  const fp = [[-PX, 14, PZ], [-PX, TOP - 5, PZ], [-PX + 2, TOP - 1, PZ - 1], [-PX + 5, TOP, PZ - 2],
    [PX - 5, TOP, PZ - 2], [PX - 2, TOP - 1, PZ - 1], [PX, TOP - 5, PZ], [PX, 14, PZ]].map((p) => new THREE.Vector3(...p));
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fp, false, 'centripetal'), 90, 0.85, 14, false), chrome));

  // Motor and pump on top of the tank (vibrates while running)
  const pump = new THREE.Group();
  pump.add(box(17, 1.4, 13, M.black, 1, TT + 0.7, 0));
  pump.add(cyl(8, 9, motorMat, 0, TT + 6, 0, 48));
  // Spec plate on the front of the motor
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(8.04, 8.04, 4.6, 40, 1, true, -0.95, 1.9),
    new THREE.MeshStandardMaterial({ map: specLabel(), roughness: 0.5 }));
  lab.position.set(0, TT + 6.4, 0);
  pump.add(lab);
  // Ribbed cooling cover
  const coverY = TT + 10.5;
  pump.add(cyl(9.2, 5, motorMat, 0, coverY + 2.5, 0, 48));
  const dome = mesh(new THREE.SphereGeometry(9.2, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), motorMat, 0, coverY + 5, 0);
  dome.scale.y = 0.22;
  pump.add(dome);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const f = box(0.7, 5.6, 0.9, motorMat, Math.sin(a) * 9.4, coverY + 2.7, Math.cos(a) * 9.4);
    f.rotation.y = a;
    pump.add(f);
  }
  pump.add(cyl(0.9, 0.9, M.aluDark, 0, coverY + 7.4, 0, 6)); // top bolt
  // Oil filler plug and sight glass at the front of the pump base
  const oil = cylZ(1.1, 0.5, M.black, -2.4, TT + 2.6, 7.9, 24);
  pump.add(oil);
  pump.add(cylZ(1.1, 0.6, M.aluDark, 1.6, TT + 2.6, 7.9, 6));
  pump.add(cylZ(0.6, 0.3, new THREE.MeshStandardMaterial({ color: 0x8a4a1a, roughness: 0.3 }), 1.6, TT + 2.6, 8.3, 16));
  // Intake filter pointing up-right at the back
  const intake = cyl(0.9, 3, M.black, 8.4, TT + 12.5, -3, 16);
  intake.rotation.z = -0.8;
  pump.add(intake);
  g.add(pump);
  comp.pump = pump;

  // Pressure switch box on the right side
  const sw = new THREE.Group();
  sw.position.set(11.6, TT + 7, 2.5);
  sw.add(roundBox(5, 6.4, 6, 0.5, M.black));
  sw.add(box(2.2, 0.8, 1.6, M.black, -0.6, 3.6, -1));
  g.add(sw);
  // Motor lamp on the switch box
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, emissive: 0x000000 });
  const lamp = mesh(new THREE.SphereGeometry(0.45, 16, 12), lampMat, 11.6, TT + 8.6, 5.55);
  g.add(lamp);
  comp.lamp = lamp;
  // Safety valve below the switch box
  g.add(cylZ(0.5, 3, M.brass, 12.5, TT + 1.3, 3.5, 12));
  g.add(cylZ(1.3, 0.8, M.black, 12.5, TT + 1.3, 5.2, 24));

  // Air outlet line on the left: tank → ball valve → filter-regulator
  const VY = TT + 6.4, VZ = 8.6;
  g.add(cyl(0.7, 5.6, M.alu, -8.4, TT + 2.8, VZ - 1, 6)); // riser from tank (hex fitting)
  g.add(box(2, 2, 2, M.alu, -8.4, VY, VZ - 1));
  g.add(cylX(0.75, 4.4, M.alu, -11.6, VY, VZ - 1, 16)); // ball valve body
  const handle = box(3.4, 0.5, 0.9, M.red, -11.6, VY + 1.1, VZ - 1);
  handle.rotation.z = 0.15;
  g.add(handle);
  g.add(cylX(0.55, 1.6, M.brass, -14.4, VY, VZ - 1, 12));
  // Filter-regulator: knob, body, bowl
  const FX = -16;
  g.add(box(2.6, 3, 2.6, M.black, FX, VY, VZ - 1));
  g.add(cyl(1.25, 2.6, M.black, FX, VY + 2.8, VZ - 1, 20));
  g.add(cyl(1.1, 6, M.black, FX, VY - 4.4, VZ - 1, 20));
  g.add(cyl(0.3, 1.2, M.black, FX, VY - 8, VZ - 1, 8));
  // Tank pressure gauge on a bracket in front
  g.add(box(1.2, 6, 0.5, M.alu, -6.4, TT + 3, VZ + 0.4));
  const gauge = createGauge({ radius: 2.3, max: 12, step: 2, psiStep: 50 });
  gauge.group.position.set(-8.4, TT + 2.2, VZ + 1.6);
  g.add(gauge.group);
  comp.gauge = gauge;

  comp.ports.push(new Port(g, { id: 'C.out', name: 'Compressor outlet', size: 10, pos: [FX, VY, VZ + 0.3], normal: [0, 0, 1], comp: 'compressor',
    // The hose drops in front of the tank and runs round its right side, clear of the compressor
    lead: [[FX, VY - 1, VZ + 6], [-11, 13, 21.5], [2, 6, 23], [16, 3, 19], [23, 4, 11]] }));

  const l = label('A', 'lbl num');
  l.position.set(0, TOP + 4, 0);
  g.add(l);

  let shown = 0;
  comp.update = (sim, dt, t) => {
    shown += (sim.tankP - shown) * Math.min(1, dt * 6);
    lampMat.emissive.set(sim.motorOn ? 0x33ff66 : 0x000000);
    lampMat.color.set(sim.motorOn ? 0x66ff88 : 0x1b5e20);
    pump.position.x = sim.motorOn ? Math.sin(t * 90) * 0.04 : 0;
    pump.position.y = sim.motorOn ? Math.cos(t * 77) * 0.04 : 0;
    gauge.set(shown);
  };
  return comp;
}

// ---------- FRL ----------
export function buildFRL() {
  const g = new THREE.Group();
  g.position.set(-16, 0, -3);
  const comp = { key: 'frl', group: g, ports: [] };
  const Y = 44;

  // ബ്രാക്കറ്റ്
  g.add(box(16, 3.4, 0.6, M.aluDark, 0, Y + 4.2, -5.6));
  g.add(box(2, 3, 3, M.aluDark, 0, Y + 4.2, -4));

  // Filter-Regulator
  const fr = new THREE.Group();
  pickable(fr, { kind: 'comp', key: 'fr' });
  fr.add(roundBox(6, 6, 5.2, 0.5, M.alu, -3.6, Y, 0));
  fr.add(cyl(2.3, 2.4, M.black, -3.6, Y + 4.1, 0));
  fr.add(cyl(2.36, 0.5, M.red, -3.6, Y + 3.2, 0));
  // Stem band: becomes visible when the knob is pulled up (unlocked)
  const band = cyl(1.7, 1.2, new THREE.MeshStandardMaterial({ color: 0xff8f00, roughness: 0.4, emissive: 0x3a1a00 }), -3.6, Y + 5.6, 0, 24);
  fr.add(band);
  // knob
  const knob = new THREE.Group();
  knob.position.set(-3.6, Y + 6.6, 0);
  knob.add(cyl(2.5, 2.8, M.black, 0, 0, 0, 24));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = box(0.4, 2.8, 0.35, M.black, Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5);
    r.rotation.y = -a;
    knob.add(r);
  }
  knob.add(box(0.3, 0.1, 2, M.alu, 0, 1.42, 0.6)); // അടയാളം
  pickable(knob, { kind: 'control', action: 'regulator', comp: 'fr' });
  fr.add(knob);
  comp.knob = knob;
  comp.knobUp = false;
  const knobBaseY = knob.position.y;
  // gauge
  const gauge = createGauge({ radius: 2.5, max: 10, step: 2, unit: 'kg/cm²', psiStep: 25, rim: M.black });
  gauge.group.position.set(-3.6, Y + 0.3, 3.1);
  fr.add(gauge.group);
  comp.gauge = gauge;
  // ബൗൾ
  fr.add(cyl(2.4, 8, M.alu, -3.6, Y - 7, 0));
  fr.add(box(0.8, 5, 0.3, M.slot, -3.6, Y - 7, 2.35));
  // Water collected in the filter bowl (seen through the sight slot)
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x5fb4ff, roughness: 0.1, transparent: true, opacity: 0.9, emissive: 0x0a2a4a });
  const water = box(0.72, 1, 0.34, waterMat, -3.6, Y - 9.5, 2.36);
  water.castShadow = false;
  fr.add(water);
  // Condensation seen through the sight glass: first a mist on the glass,
  // then small droplets form and slowly run down into the water at the bottom
  const fogMat = new THREE.MeshBasicMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0, depthWrite: false });
  const fog = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 4.9), fogMat);
  fog.position.set(-3.6, Y - 7, 2.55);
  fr.add(fog);
  const dropGeo = new THREE.SphereGeometry(0.2, 12, 10);
  const cdropMat = new THREE.MeshStandardMaterial({ color: 0x8fd0ff, roughness: 0.05, metalness: 0.1, emissive: 0x1a5a9a });
  const cdrops = [];
  for (let i = 0; i < 6; i++) {
    const d = mesh(dropGeo, cdropMat, -3.6, Y - 5, 2.62);
    d.castShadow = false;
    d.visible = false;
    fr.add(d);
    cdrops.push({ m: d, state: 0, t: 0, v: 0, x: 0, size: 1 });
  }
  // Drain knob at the bottom of the bowl (press to drain)
  const drain = new THREE.Group();
  drain.position.set(-3.6, Y - 11.6, 0);
  drain.add(cyl(1.0, 1.2, M.black, 0, 0, 0, 16));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    drain.add(box(0.3, 1.2, 0.3, M.black, Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0));
  }
  const nozzle = cyl(0.35, 2.0, M.black, 0, -1.6, 0, 8);
  drain.add(nozzle);
  const dpick = new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  dpick.position.y = -0.6;
  drain.add(dpick);
  pickable(drain, { kind: 'control', action: 'drain', comp: 'fr' });
  fr.add(drain);
  comp.drainTip = new THREE.Object3D();
  comp.drainTip.position.set(0, -2.7, 0);
  drain.add(comp.drainTip);
  g.add(fr);

  // Lubricator
  const lub = new THREE.Group();
  pickable(lub, { kind: 'comp', key: 'lub' });
  lub.add(roundBox(6, 6, 5.2, 0.5, M.alu, 3.6, Y, 0));
  lub.add(cyl(1.6, 1, M.black, 3.6, Y + 3.5, 0));
  const dome = cyl(1.2, 2.2, M.clear, 3.6, Y + 5.1, 0);
  dome.castShadow = false;
  lub.add(dome);
  lub.add(cyl(0.5, 0.6, M.black, 3.6, Y + 6.5, 0, 12));
  const drop = mesh(new THREE.SphereGeometry(0.28, 12, 10), M.oil, 3.6, Y + 5.6, 0);
  drop.visible = false;
  lub.add(drop);
  comp.drop = drop;
  lub.add(cyl(2.4, 9, M.alu, 3.6, Y - 7.5, 0));
  lub.add(box(0.8, 6, 0.3, M.slot, 3.6, Y - 7.5, 2.35));
  const oilLevel = box(0.7, 3.5, 0.32, M.oil, 3.6, Y - 9, 2.36);
  lub.add(oilLevel);
  lub.add(cyl(1.6, 1.2, M.black, 3.6, Y - 12.6, 0, 16));
  g.add(lub);

  // ഇടയിലെ ക്ലാമ്പ്
  g.add(box(1.2, 6.4, 5.4, M.aluDark, 0, Y, 0));

  comp.ports.push(new Port(g, { id: 'F.in', name: 'FRL inlet', size: 10, pos: [-6.7, Y, 0], normal: [-1, 0, 0], comp: 'fr' }));
  comp.ports.push(new Port(g, { id: 'F.out', name: 'FRL outlet', size: 10, pos: [6.7, Y, 0], normal: [1, 0, 0], comp: 'lub' }));

  const l = label('B', 'lbl num');
  l.position.set(0, Y + 9.5, 0);
  g.add(l);

  let dropT = 0, shown = 0, knobY = 0, fogAmt = 0, spawnT = 0;
  comp.update = (sim, dt) => {
    // Needle moves smoothly towards the real value
    shown += (sim.p('F.out') - shown) * Math.min(1, dt * 6);
    gauge.set(shown);
    knob.rotation.y = -sim.regSet * 0.9;
    knobY += ((comp.knobUp ? 1.1 : 0) - knobY) * Math.min(1, dt * 12);
    knob.position.y = knobBaseY + knobY;
    // Water level in the bowl
    const h = Math.max(0.02, (sim.water / 0.3) * 1.6);
    water.scale.y = h;
    water.position.y = Y - 9.5 + h / 2;
    water.visible = sim.water > 0.004;
    // 1) Mist builds up on the glass while moist air is passing
    const fogTarget = sim.condensing ? 1 : 0;
    fogAmt += (fogTarget - fogAmt) * Math.min(1, dt * (sim.condensing ? 0.08 : 0.04));
    fogMat.opacity = fogAmt * 0.8;
    // 2) Once misted, droplets form, grow and slowly run down
    const surface = Y - 9.5 + h + 0.1;
    spawnT -= dt;
    if (sim.condensing && fogAmt > 0.5 && spawnT <= 0) {
      const d = cdrops.find((c) => c.state === 0);
      if (d) {
        d.state = 1; d.t = 0; d.v = 0;
        d.x = -3.6 + (Math.random() - 0.5) * 0.45;
        d.y = Y - 4.9 + Math.random() * -1.6;
        d.size = 0.8 + Math.random() * 0.6;
        d.m.position.set(d.x, d.y, 2.62);
        d.m.visible = true;
      }
      spawnT = 5 + Math.random() * 4;
    }
    for (const d of cdrops) {
      if (d.state === 0) continue;
      d.t += dt;
      if (d.state === 1) {                 // growing on the glass
        const k = Math.min(1, d.t / 5);
        d.m.scale.set(d.size * k, d.size * k * 1.1, d.size * k * 0.6);
        if (k >= 1) { d.state = 2; d.t = 0; }
      } else {                             // running down, slowly speeding up
        d.v = Math.min(0.7, d.v + dt * 0.15);
        d.y -= d.v * dt;
        d.m.position.y = d.y;
        d.m.scale.y = d.size * (1.1 + d.v * 0.4);
        if (d.y <= surface) { d.state = 0; d.m.visible = false; }
      }
    }
    drain.rotation.y = sim.drainOpen ? 0.6 : 0;
    // ഒഴുക്ക് ഉള്ളപ്പോൾ എണ്ണത്തുള്ളി വീഴുന്നു
    if (sim.lubFlow > 0.01) {
      dropT += dt * (0.8 + sim.lubFlow * 2);
      const k = dropT % 1;
      drop.visible = true;
      drop.position.y = Y + 5.8 - k * 1.8;
    } else drop.visible = false;
  };
  return comp;
}

// ---------- Sliding valve + Manifold (ഒറ്റ യൂണിറ്റ്) ----------
export function buildSlideManifold() {
  const g = new THREE.Group();
  g.position.set(4, 0, -3);
  const comp = { key: 'manifold', group: g, ports: [] };
  const Y = 44;

  // Manifold
  const man = new THREE.Group();
  pickable(man, { kind: 'comp', key: 'manifold' });
  man.add(box(20, 5, 5, M.alu, 22, Y, 0));
  for (const x of [13.2, 30.8]) man.add(cylZ(0.45, 5.1, M.aluDark, x, Y, 0, 12)); // മൗണ്ടിങ് ദ്വാരങ്ങൾ
  g.add(man);
  for (const x of [14, 30]) g.add(box(2, 4, 3, M.black, x, Y, -4));

  // Sliding valve
  const sv = new THREE.Group();
  pickable(sv, { kind: 'comp', key: 'slide' });
  sv.add(cylX(1.0, 9, M.brass, 7.5, Y, 0));
  const hexOut = cylX(1.5, 1.6, M.brass, 11.0, Y, 0, 6);
  sv.add(hexOut);
  sv.add(cylX(0.9, 0.8, M.brass, 12.0, Y, 0, 16));
  sv.add(cylX(0.85, 1.2, M.brass, 3.6, Y, 0, 16));
  g.add(sv);
  const sleeve = new THREE.Group();
  sleeve.add(cylX(1.9, 4.4, M.blue, 0, 0, 0));
  for (const dx of [-1.2, 0, 1.2]) sleeve.add(cylX(2.15, 0.55, M.blue, dx, 0, 0));
  sleeve.position.set(5.8, Y, 0);
  pickable(sleeve, { kind: 'control', action: 'slide', comp: 'slide' });
  g.add(sleeve);
  comp.sleeve = sleeve;

  comp.ports.push(new Port(g, { id: 'S.in', name: 'Sliding valve IN', size: 10, pos: [3.0, Y, 0], normal: [-1, 0, 0], comp: 'slide' }));
  // 7 ഔട്ട്‌ലെറ്റുകൾ: മുകളിൽ 3, താഴെ 3, അറ്റത്ത് 1
  const xs = [16, 22, 28];
  xs.forEach((x, i) => comp.ports.push(new Port(g, { id: `M.${i + 1}`, name: `Manifold port ${i + 1}`, size: 4, pos: [x, Y + 2.5, 0], normal: [0, 1, 0], selfSealing: true, comp: 'manifold' })));
  xs.forEach((x, i) => comp.ports.push(new Port(g, { id: `M.${i + 4}`, name: `Manifold port ${i + 4}`, size: 4, pos: [x, Y - 2.5, 0], normal: [0, -1, 0], selfSealing: true, comp: 'manifold' })));
  comp.ports.push(new Port(g, { id: 'M.7', name: 'Manifold port 7', size: 4, pos: [32, Y, 0], normal: [1, 0, 0], selfSealing: true, comp: 'manifold' }));

  const l1 = label('C', 'lbl num');
  l1.position.set(5.8, Y + 4, 0);
  g.add(l1);
  const l2 = label('D', 'lbl num');
  l2.position.set(22, Y + 6.5, 0);
  g.add(l2);

  let pos = 0;
  comp.update = (sim, dt) => {
    const target = sim.svOpen ? 1 : 0;
    pos += (target - pos) * Math.min(1, dt * 12);
    sleeve.position.x = 5.6 + pos * 2.6; // manifold-ന്റെ നേരെ നീക്കിയാൽ open
  };
  return comp;
}

// ---------- 5/2 hand lever valve ----------
function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#2b8ad8'; x.fillRect(0, 0, 512, 160);
  x.strokeStyle = '#e8f2ff'; x.lineWidth = 3; x.strokeRect(6, 6, 500, 148);
  x.fillStyle = '#fff';
  x.font = 'bold 34px sans-serif';
  x.fillText('5/2  HAND LEVER VALVE', 20, 48);
  x.font = '24px sans-serif';
  x.fillText('MAX PR : 10 bar', 230, 90);
  x.fillText('PORT 1,2,4 : G1/4   3,5 : G1/8', 230, 128);
  // ലളിതമായ ചിഹ്നം
  x.strokeStyle = '#fff'; x.lineWidth = 2;
  x.strokeRect(30, 70, 70, 60); x.strokeRect(100, 70, 70, 60);
  x.beginPath();
  x.moveTo(45, 130); x.lineTo(60, 76); x.moveTo(85, 76); x.lineTo(85, 130);
  x.moveTo(120, 130); x.lineTo(120, 76); x.moveTo(140, 76); x.lineTo(155, 130);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildValve52() {
  const g = new THREE.Group();
  g.position.set(62, 0, -3);
  const comp = { key: 'valve', group: g, ports: [] };
  const Y = 28;
  pickable(g, { kind: 'comp', key: 'valve' });

  g.add(box(8.6, 3.6, 3.0, M.alu, 1.2, Y, 0));
  g.add(box(3.2, 3.9, 3.4, M.black, -4.7, Y, 0));
  g.add(box(1.0, 3.7, 3.2, M.black, 6.0, Y, 0));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.0), new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.5 }));
  plate.position.set(1.2, Y, 1.52);
  g.add(plate);
  g.add(box(2, 3, 5.5, M.black, 1.2, Y, -4.2)); // ബോർഡിലേക്കുള്ള ബ്രാക്കറ്റ്

  // Lever (മുന്നിലേക്ക്, ഇടത്തോട്ടും വലത്തോട്ടും ചരിക്കാം)
  const lever = new THREE.Group();
  lever.position.set(-4.7, Y, 1.7);
  lever.add(cylZ(1.55, 0.8, M.rubber, 0, 0, 0.4, 24));
  lever.add(cylZ(1.15, 0.8, M.rubber, 0, 0, 1.1, 24));
  lever.add(cylZ(0.35, 3.6, M.black, 0, 0, 2.8, 12));
  const k = mesh(new THREE.CylinderGeometry(0.75, 0.95, 3.6, 20), M.black, 0, 0, 5.6);
  k.rotation.x = -Math.PI / 2;
  lever.add(k);
  pickable(lever, { kind: 'control', action: 'lever', comp: 'valve' });
  g.add(lever);
  comp.lever = lever;

  // പോർട്ടുകൾ: 5, 1, 3 താഴെ; 4, 2 മുകളിൽ
  comp.ports.push(new Port(g, { id: 'V.1', name: '5/2 valve – Port 1', size: 4, pos: [1.0, Y - 1.8, 0], normal: [0, -1, 0], comp: 'valve', tag: '1' }));
  comp.ports.push(new Port(g, { id: 'V.2', name: '5/2 valve – Port 2', size: 4, pos: [2.6, Y + 1.8, 0], normal: [0, 1, 0], comp: 'valve', tag: '2' }));
  comp.ports.push(new Port(g, { id: 'V.4', name: '5/2 valve – Port 4', size: 4, pos: [-0.6, Y + 1.8, 0], normal: [0, 1, 0], comp: 'valve', tag: '4' }));

  // Silencers (3, 5)
  const bronze = new THREE.MeshStandardMaterial({ color: 0xa47a3c, metalness: 0.6, roughness: 0.75 });
  comp.silencers = {};
  comp.exhaustPos = {};
  for (const [num, x] of [[5, -1.6], [3, 3.6]]) {
    const s = new THREE.Group();
    s.position.set(x, Y - 1.8, 0);
    // Small flat sintered-bronze silencer: brass hex body with a flat filter disc
    s.add(cyl(0.62, 0.4, M.brass, 0, -0.2, 0, 6));
    s.add(cyl(0.58, 0.45, M.brass, 0, -0.62, 0, 20));
    s.add(cyl(0.48, 0.06, bronze, 0, -0.87, 0, 20));
    pickable(s, { kind: 'comp', key: 'silencer' });
    g.add(s);
    comp.silencers[num] = s;
    // ദ്വാരം (silencer ഊരുമ്പോൾ കാണാൻ)
    const hole = cyl(0.42, 0.1, M.black, x, Y - 1.82, 0, 12);
    g.add(hole);
    comp.exhaustPos[num] = new THREE.Vector3(x, Y - 2.8, 0);      // face of the silencer
    (comp.portPos = comp.portPos || {})[num] = new THREE.Vector3(x, Y - 2.0, 0); // the valve's own exhaust hole
  }

  const l = label('E', 'lbl num');
  l.position.set(-4.7, Y + 4.2, 0);
  g.add(l);

  let tilt = 0;
  comp.update = (sim, dt) => {
    const target = sim.lever === 0 ? -0.38 : 0.38;
    tilt += (target - tilt) * Math.min(1, dt * 14);
    lever.rotation.y = tilt;
    comp.silencers[3].visible = sim.silencer[3];
    comp.silencers[5].visible = sim.silencer[5];
  };
  return comp;
}

// ---------- Double acting cylinder ----------
export function buildCylinder() {
  const g = new THREE.Group();
  g.position.set(52, 48, -2);
  const comp = { key: 'cylinder', group: g, ports: [] };
  pickable(g, { kind: 'comp', key: 'cylinder' });
  const S = 4.6, STROKE = 10;

  // end caps
  g.add(roundBox(3, S, S, 0.4, M.alu, 1.5, 0, 0));
  g.add(roundBox(3, S, S, 0.4, M.alu, 16.5, 0, 0));
  // barrel
  g.add(cylX(2.05, 12, M.alu, 9, 0, 0, 40));
  for (const x of [4.2, 13.8]) g.add(cylX(2.09, 0.9, M.bluePlate, x, 0, 0, 40));
  // tie rods
  for (const [y, z] of [[1.75, 1.75], [1.75, -1.75], [-1.75, 1.75], [-1.75, -1.75]]) {
    g.add(cylX(0.22, 18.6, M.steel, 9, y, z, 10));
  }
  // മുൻവശത്തെ bush
  g.add(cylX(1.25, 1.6, M.alu, 18.8, 0, 0, 24));
  // piston rod (നീങ്ങുന്ന ഭാഗം)
  const rod = new THREE.Group();
  rod.add(cylX(0.62, 16, M.steel, 12.5, 0, 0, 24));
  rod.add(cylX(0.5, 2.4, M.steel, 21.6, 0, 0, 16)); // thread
  rod.add(cylX(0.95, 0.8, M.steel, 21.0, 0, 0, 6));  // nut
  // Dome: black rubber cap on the rod end (it will press the limit switch later)
  // tapered on both sides, so a roller limit switch rides up smoothly going forward and back
  // 28 mm straight middle, short gentle taper (9 mm) at both ends
  const domeProf = [[0, 0], [0.75, 0], [1.3, 0.05], [2.0, 0.95], [2.0, 3.75], [1.3, 4.65], [1.2, 4.7], [0, 4.7]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const dome = mesh(new THREE.LatheGeometry(domeProf, 40), M.rubber, 21.4, 0, 0);
  dome.rotation.z = -Math.PI / 2; // lathe axis (Y) → along the rod (+X)
  rod.add(dome);
  // അകത്തെ piston (ഭാവിയിൽ cut-away view-ന്)
  rod.add(cylX(1.95, 1.6, M.black, 4.4, 0, 0, 32));
  g.add(rod);
  comp.rod = rod;

  // cushion screw: sliding valve തുറക്കുന്ന വശത്ത് (പിൻ cap)
  g.add(cylZ(0.38, 0.6, M.brass, 1.5, 1.45, 2.4, 12));
  g.add(box(0.5, 0.1, 0.05, M.black, 1.5, 1.45, 2.72));
  // മൗണ്ട്
  for (const x of [1.5, 16.5]) g.add(box(2.4, 3, 4.6, M.black, x, 0, -4.6));

  comp.ports.push(new Port(g, { id: 'Y.A', name: 'Cylinder – rear port', size: 4, pos: [1.5, -0.6, 2.3], normal: [0, 0, 1], comp: 'cylinder', tag: 'A' }));
  comp.ports.push(new Port(g, { id: 'Y.B', name: 'Cylinder – front port', size: 4, pos: [16.5, -0.6, 2.3], normal: [0, 0, 1], comp: 'cylinder', tag: 'B' }));

  // Single acting version: no front port, only a small breather vent (the spring is inside)
  const breather = new THREE.Group();
  breather.position.set(16.5, -0.6, 2.3);
  const bz = (r, h, mat, z, seg) => { const m = cyl(r, h, mat, 0, 0, z, seg); m.rotation.x = Math.PI / 2; return m; };
  breather.add(bz(0.55, 0.35, M.brass, 0.17, 6));
  breather.add(bz(0.45, 0.25, new THREE.MeshStandardMaterial({ color: 0xa47a3c, metalness: 0.6, roughness: 0.75 }), 0.45, 20));
  breather.visible = false;
  g.add(breather);
  comp.setType = (type) => {
    breather.visible = type === 'single';
    comp.ports.find((p) => p.id === 'Y.B').setEnabled(type !== 'single');
  };

  const l = label('F', 'lbl num');
  l.position.set(9, 4.2, 0);
  g.add(l);

  comp.update = (sim) => {
    rod.position.x = sim.cylPos * STROKE;
  };
  return comp;
}

// ---------- Switchboard on the trainer board; compressor plugged into the socket ----------
export function buildWall() {
  const g = new THREE.Group();
  const comp = { key: 'wall', group: g, ports: [] };

  // Switchboard (modular plate): socket with plug + switch + indicator
  const SX = -51, SY = 53, SZ = -8.4;
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4 });
  g.add(roundBox(17, 10, 1.2, 0.5, plateMat, SX, SY, SZ));
  // socket
  g.add(roundBox(6.4, 6.4, 0.6, 0.4, plateMat, SX - 4.5, SY, SZ + 0.85));
  // plug in the socket
  const plugMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  g.add(roundBox(4.2, 4.6, 3.2, 0.6, plugMat, SX - 4.5, SY, SZ + 2.7));
  // switch (big rocker) – the one that powers the socket
  g.add(roundBox(4, 6.4, 0.6, 0.3, plateMat, SX + 2, SY, SZ + 0.85));
  const sw = new THREE.Group();
  sw.position.set(SX + 2, SY, SZ + 1.3);
  const swMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  sw.add(box(3, 5, 0.9, swMat));
  sw.add(box(1.2, 0.5, 0.1, new THREE.MeshStandardMaterial({ color: 0xcc2222 }), 0, 1.6, 0.47));
  const swPick = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  sw.add(swPick);
  pickable(sw, { kind: 'control', action: 'mains', comp: 'wall' });
  g.add(sw);
  // red indicator
  const indMat = new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0x000000 });
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 16).rotateX(Math.PI / 2), indMat, SX + 6.3, SY + 2.5, SZ + 0.8));
  // dummy second switch (looks like a normal board)
  g.add(roundBox(2.6, 4.4, 0.8, 0.3, swMat, SX + 6.3, SY - 1.2, SZ + 0.9));

  // Power cable: compressor switch box → up the back of the compressor → plug on the board
  const pts = [
    [-50.4, 22, 11.4], [-51, 26, 6], [-54, 33, -1.5], [-55.5, 43, -4.6], [-55.5, 51, -5.4],
  ].map((p) => new THREE.Vector3(...p));
  const cable = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 80, 0.35, 8, false), plugMat);
  g.add(cable);

  comp.update = (sim) => {
    sw.rotation.x = sim.mains ? 0.22 : -0.22;
    indMat.emissive.set(sim.mains ? 0xff2222 : 0x000000);
    indMat.color.set(sim.mains ? 0xff5555 : 0x551111);
  };
  return comp;
}
