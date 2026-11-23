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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), M.floor);
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

// ---------- Compressor ----------
export function buildCompressor() {
  const g = new THREE.Group();
  g.position.set(-64, 0, 12);
  const comp = { key: 'compressor', group: g, ports: [] };
  pickable(g, { kind: 'comp', key: 'compressor' });

  // ടാങ്ക്
  const tankY = 14, tankR = 11, tankL = 32;
  g.add(cylX(tankR, tankL, M.tank, 0, tankY, 0, 48));
  for (const s of [-1, 1]) {
    const cap = mesh(new THREE.SphereGeometry(tankR, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.tank, s * tankL / 2, tankY, 0);
    cap.scale.y = 0.45;
    cap.rotation.z = -s * Math.PI / 2;
    g.add(cap);
    g.add(cylX(tankR + 0.15, 0.6, M.aluDark, s * (tankL / 2 - 0.3), tankY, 0, 48));
  }
  // കാലുകളും ചക്രങ്ങളും
  g.add(box(3, 4, 14, M.rubber, 12, 2, 0));
  for (const z of [-8, 8]) {
    const w = cylZ(3, 1.6, M.rubber, -12, 3, z, 24);
    g.add(w);
    g.add(cylZ(1.2, 1.8, M.aluDark, -12, 3, z, 16));
  }
  g.add(box(26, 1, 14, M.aluDark, 0, 25.4, 0));

  // മോട്ടോറും പമ്പും
  const pump = new THREE.Group();
  pump.add(cylZ(5.2, 13, M.motor, -4, 31.2, 0, 32));
  pump.add(cylZ(5.4, 1, M.black, -4, 31.2, 6.8, 32));
  pump.add(cylZ(5.4, 1, M.black, -4, 31.2, -6.8, 32));
  for (const z of [-3.6, 3.6]) {
    const head = cyl(2.5, 6, M.alu, 5.5, 30, z, 24);
    pump.add(head);
    for (let i = 0; i < 4; i++) pump.add(cyl(3.1, 0.35, M.alu, 5.5, 28 + i * 1.3, z, 24));
    pump.add(box(5.6, 1.6, 5.6, M.black, 5.5, 33.8, z));
  }
  g.add(pump);
  comp.pump = pump;

  // പിടി
  for (const z of [-5, 5]) g.add(cyl(0.6, 10, M.black, -16, 31, z, 12));
  g.add(cylZ(0.8, 12, M.black, -16, 36, 0, 16));

  // Pressure switch box
  const sw = new THREE.Group();
  sw.position.set(12, 30.5, 4);
  sw.add(roundBox(6.4, 7, 5, 0.6, M.black));
  g.add(sw);
  // മോട്ടോർ ലാമ്പ്
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, emissive: 0x000000 });
  const lamp = mesh(new THREE.SphereGeometry(0.45, 16, 12), lampMat, 14.4, 33.2, 6.55);
  g.add(lamp);
  comp.lamp = lamp;
  // ടാങ്ക് ഗേജ്
  const gauge = createGauge({ radius: 2.5, max: 12, step: 2, psiStep: 50 });
  gauge.group.position.set(11.4, 30, 6.7);
  g.add(gauge.group);
  comp.gauge = gauge;
  // ഔട്ട്‌ലെറ്റ് പൈപ്പ്
  g.add(cylX(0.6, 4, M.brass, 17, 29.5, 4, 16));
  g.add(cyl(0.5, 4, M.brass, 2, 27.8, 4, 12)); // ടാങ്ക് കണക്ഷൻ
  // ഡ്രെയിൻ
  g.add(cyl(0.5, 1.6, M.brass, 0, 2.6, 0, 12));

  comp.ports.push(new Port(g, { id: 'C.out', name: 'Compressor outlet', size: 10, pos: [19, 29.5, 4], normal: [1, 0, 0], comp: 'compressor' }));

  const l = label('A', 'lbl num');
  l.position.set(0, 43, 0);
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
    s.add(cyl(0.45, 0.6, M.brass, 0, -0.3, 0, 12));
    s.add(cyl(0.6, 1.8, bronze, 0, -1.5, 0, 16));
    s.add(mesh(new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bronze, 0, -2.4, 0));
    pickable(s, { kind: 'comp', key: 'silencer' });
    g.add(s);
    comp.silencers[num] = s;
    // ദ്വാരം (silencer ഊരുമ്പോൾ കാണാൻ)
    const hole = cyl(0.42, 0.1, M.black, x, Y - 1.82, 0, 12);
    g.add(hole);
    comp.exhaustPos[num] = new THREE.Vector3(x, Y - 4.2, 0);      // tip of the silencer
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

  const l = label('F', 'lbl num');
  l.position.set(9, 4.2, 0);
  g.add(l);

  comp.update = (sim) => {
    rod.position.x = sim.cylPos * STROKE;
  };
  return comp;
}

// ---------- Wall with switchboard; compressor plugged into the socket ----------
export function buildWall() {
  const g = new THREE.Group();
  const comp = { key: 'wall', group: g, ports: [] };
  const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const wallMat = new THREE.MeshStandardMaterial({ color: light ? 0xf1ede6 : 0x4a454c, roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(500, 220), wallMat);
  wall.position.set(10, 35, -32);
  wall.receiveShadow = true;
  g.add(wall);

  // Switchboard (modular plate): socket with plug + switch + indicator
  const SX = -82, SY = 54, SZ = -31.6;
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

  // Power cable: compressor switch box → table → wall → plug
  const pts = [
    [-52, 30.5, 11], [-52, 27, 6], [-58, 12, -6], [-70, 1, -18], [-84, 0.5, -22],
    [-89, 4, -29], [-88, 30, -30.6], [-86.5, 48, -30.5], [-86.5, 51.2, -29.5],
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
