// ന്യൂമാറ്റിക് ലാബ് – പ്രധാന ഫയൽ: scene, ഇന്ററാക്ഷൻ, ലൂപ്പ്
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { buildBench, buildCompressor, buildFRL, buildSlideManifold, buildValve52, buildCylinder, buildWall } from './components.js';
import { Tube } from './tube.js';
import { Sim } from './sim.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { DrainSpray, AirPuffs } from './effects.js';
import { t as tr, info, applyStatic } from './i18n.js';

const $ = (id) => document.getElementById(id);
const host = $('scene');

// ---------- Renderer / Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
host.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const LIGHT = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
const SCENE_BG = LIGHT ? 0xECE8E3 : 0x17151A;
scene.background = new THREE.Color(SCENE_BG);
scene.fog = new THREE.Fog(SCENE_BG, 400, 900);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.6;   // gentler, easier to stop on a part
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.7;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 20;
controls.maxDistance = 650;
const TARGET = new THREE.Vector3(8, 28, 0);
controls.target.copy(TARGET);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-60, 160, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 110, bottom: -60, near: 10, far: 450 });
sun.shadow.bias = -0.0005;
scene.add(sun);

// ---------- ഉപകരണങ്ങൾ ----------
buildBench(scene);
const comps = [buildWall(), buildCompressor(), buildFRL(), buildSlideManifold(), buildValve52(), buildCylinder()];
comps.forEach((c) => scene.add(c.group));
const C = Object.fromEntries(comps.map((c) => [c.key, c]));

const app = { ports: comps.flatMap((c) => c.ports), tubes: [] };
const portById = Object.fromEntries(app.ports.map((p) => [p.id, p]));

const sim = new Sim(app);
const sound = new Sound();
const ui = new UI();

let pressureColors = false;

// ---------- ക്യാമറ ഫിറ്റ് ----------
function resize() {
  // Everything below the top bar follows its real height (it can wrap on narrow screens)
  document.documentElement.style.setProperty('--tb', $('topbar').offsetHeight + 'px');
  document.documentElement.style.setProperty('--bb', $('tray').offsetHeight + 'px');
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function overviewView() {
  const portrait = camera.aspect < 0.9;
  const W = portrait ? 125 : 205, H = 85;
  const target = new THREE.Vector3(portrait ? 14 : 8, 28, 0);
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(H / 2 / t, W / 2 / (t * camera.aspect)) * 1.02;
  const pos = target.clone().addScaledVector(new THREE.Vector3(0, 0.3, 1).normalize(), dist);
  return { pos, target };
}
function fitCamera() {
  // ഫോൺ നിവർത്തി പിടിക്കുമ്പോൾ ബോർഡിലെ ഭാഗങ്ങളിലേക്ക് അടുത്ത്
  const portrait = camera.aspect < 0.9;
  const W = portrait ? 125 : 205, H = 85;
  TARGET.set(portrait ? 14 : 8, 28, 0);
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(H / 2 / t, W / 2 / (t * camera.aspect)) * 1.02;
  const dir = new THREE.Vector3(0, 0.3, 1).normalize();
  camera.position.copy(TARGET).addScaledVector(dir, dist);
  controls.target.copy(TARGET);
  controls.update();
}
window.addEventListener('resize', resize);
// The 3D area sits between the top bar and the tube bar; follow their size changes
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => resize());
  ro.observe($('topbar'));
  ro.observe($('tray'));
}
resize();
fitCamera();

// ---------- Smooth camera moves (focus on a part) ----------
let fly = null;
function flyTo(pos, target, dur = 0.8) {
  fly = { t: 0, dur, p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target };
}
controls.addEventListener('start', () => (fly = null));
const FOCUS_GROUP = { compressor: 'compressor', fr: 'frl', lub: 'frl', slide: 'manifold', manifold: 'manifold', valve: 'valve', silencer: 'valve', cylinder: 'cylinder' };
function focusOn(key) {
  const comp = C[FOCUS_GROUP[key]];
  if (!comp) return;
  const box = new THREE.Box3().setFromObject(comp.group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const W = Math.max(size.x, 14) * 2.4, H = Math.max(size.y, 14) * 2.2;
  const dist = Math.max(H / 2 / t, W / 2 / (t * camera.aspect));
  const pos = center.clone().addScaledVector(new THREE.Vector3(0, 0.22, 1).normalize(), dist);
  if (camera.position.distanceTo(pos) < 5 && controls.target.distanceTo(center) < 3) return;
  flyTo(pos, center);
}

// ---------- Raycasting ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function findPick(obj) {
  while (obj) {
    if (obj.userData && obj.userData.pick) return obj.userData.pick;
    obj = obj.parent;
  }
  return null;
}

function pickAt(x, y, ignoreTube = null) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const roots = [...comps.map((c) => c.group)];
  for (const t of app.tubes) if (t !== ignoreTube) roots.push(t.mesh, t.handle);
  const hits = raycaster.intersectObjects(roots, true);
  // പോർട്ടിന് മുൻഗണന (ചെറിയതായതിനാൽ)
  for (const h of hits) {
    const p = findPick(h.object);
    if (p && p.kind === 'port') return p;
    if (p) {
      // തൊട്ടടുത്ത് ഒരു പോർട്ട് ഉണ്ടോ?
      const near = hits.find((hh) => findPick(hh.object)?.kind === 'port' && hh.distance - h.distance < 3);
      return near ? findPick(near.object) : p;
    }
  }
  return null;
}

function rayToPlaneZ(x, y, z) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
  const out = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, out) ? out : null;
}

// ---------- ട്യൂബ് ഘടിപ്പിക്കൽ ----------
const state = { mode: 'idle', size: null, tube: null, end: -1, hoverPort: null, selectedTube: null };

function setTraySize(size) {
  document.querySelectorAll('#tray .tube').forEach((b) => b.classList.toggle('on', +b.dataset.size === size));
  $('btnCancel').classList.toggle('hidden', !size);
}

function startPlacing(size) {
  cancelPlacing();
  state.mode = 'first';
  state.size = size;
  setTraySize(size);
  ui.setHint(tr('hintFirst', { size }), true);
  ui.close();
}

function cancelPlacing() {
  if (state.mode === 'second' && state.tube) {
    // പുതുതായി എടുത്ത ട്യൂബ് ആണെങ്കിൽ കളയുന്നു; നിലത്തുനിന്ന് എടുത്തതാണെങ്കിൽ താഴെ ഇടുന്നു
    if (state.tube.isNew) removeTube(state.tube);
    else state.tube.dragTarget = null;
  }
  state.mode = 'idle';
  state.size = null;
  state.tube = null;
  setTraySize(null);
  clearHover();
  ui.setHint(tr('hintIdle'));
}

function portProblem(port, size) {
  if (port.tube) return tr('errOccupied');
  // Air blowing out of an open port pushes the tube back – it cannot be pushed in
  if (!port.selfSealing && sim.p(port.id) > 0.2) return tr('errBlowing');
  if (port.size !== size) return tr('errSize');
  if (state.tube && state.tube.attachedPort === port) return tr('errSame');
  return null;
}

function removeTube(t) {
  t.dispose();
  app.tubes = app.tubes.filter((x) => x !== t);
  if (state.selectedTube === t) state.selectedTube = null;
}

function connect(a, b, size) {
  const t = new Tube(size, scene);
  t.attach(0, portById[a]);
  t.attach(1, portById[b]);
  app.tubes.push(t);
  return t;
}

function onPortClickPlacing(port) {
  if (state.mode === 'first') {
    const err = portProblem(port, state.size);
    if (err) { ui.toast(err, true); sound.click(); return; }
    const t = new Tube(state.size, scene);
    t.isNew = true;
    t.attach(0, port);
    port.tip(t.freePos);
    t.dragTarget = port.tip(new THREE.Vector3()).addScaledVector(port.worldNormal(new THREE.Vector3()), 6);
    app.tubes.push(t);
    state.tube = t;
    state.end = 1;
    state.mode = 'second';
    sound.click();
    ui.setHint(tr('hintSecond'), true);
  } else if (state.mode === 'second') {
    const t = state.tube;
    const err = portProblem(port, t.size);
    if (err) { ui.toast(err, true); sound.click(); return; }
    t.attach(state.end, port);
    t.dragTarget = null;
    t.isNew = false;
    sound.click();
    ui.toast(tr('connected', { a: t.ends[0].port.name, b: t.ends[1].port.name }));
    setTimeout(commit, 0);
    state.tube = null;
    state.mode = 'idle';
    cancelPlacing();
  }
}

function dropFreeEnd() {
  const t = state.tube;
  t.dragTarget = null;
  t.isNew = false;
  state.tube = null;
  state.mode = 'idle';
  cancelPlacing();
  ui.toast(tr('dropped'));
  commit();
}

// ---------- Undo / Redo of tube connections ----------
const history = { undo: [], redo: [] };
let currentSnap = [];
function snapshot() {
  return app.tubes
    .filter((t) => !(t.isNew && t === state.tube)) // a tube still being placed is not saved yet
    .map((t) => ({ size: t.size, a: t.ends[0].port ? t.ends[0].port.id : null, b: t.ends[1].port ? t.ends[1].port.id : null, free: t.freePos.toArray() }));
}
function updateHistoryButtons() {
  $('btnUndo').disabled = !history.undo.length;
  $('btnRedo').disabled = !history.redo.length;
}
function commit() {
  history.undo.push(currentSnap);
  if (history.undo.length > 100) history.undo.shift();
  currentSnap = snapshot();
  history.redo.length = 0;
  updateHistoryButtons();
}
function restore(snap) {
  if (state.mode === 'second' && state.tube) state.tube.dragTarget = null;
  state.tube = null;
  cancelPlacing();
  [...app.tubes].forEach(removeTube);
  for (const d of snap) {
    const t = new Tube(d.size, scene);
    if (d.a) t.attach(0, portById[d.a]);
    if (d.b) t.attach(1, portById[d.b]);
    t.freePos.fromArray(d.free);
    app.tubes.push(t);
  }
  currentSnap = snap;
  ui.close();
  updateHistoryButtons();
}
function undo() {
  if (!history.undo.length) return;
  history.redo.push(currentSnap);
  restore(history.undo.pop());
  sound.click();
}
function redo() {
  if (!history.redo.length) return;
  history.undo.push(currentSnap);
  restore(history.redo.pop());
  sound.click();
}

function pickUpFreeEnd(t) {
  // A tube whipping around under pressure cannot be caught
  if (t.whip > 0.15) { ui.toast(tr('errWhip'), true); return; }
  cancelPlacing();
  state.mode = 'second';
  state.tube = t;
  state.end = t.freeIndex;
  t.dragTarget = t.freePos.clone();
  setTraySize(null);
  $('btnCancel').classList.remove('hidden');
  ui.setHint(tr('hintPickup'), true);
  ui.close();
}

// ---------- പാനലുകൾ ----------
function refreshPanel() {
  const k = ui.current;
  if (!k) return;
  if (typeof k === 'object' && k.tube) openTubePanel(k.tube);
  else if (typeof k === 'string') openComp(k);
}

function openComp(key) {
  // Only the part's name and its controls — no explanation of what it is for.
  const ctl = [];
  if (key === 'fr') {
    const sl = ui.slider(tr('regLabel'), 0, 6, 0.1, sim.regSet, (v) => { sim.regSet = v; C.frl.knobUp = true; }, 'bar');
    sl.id = 'regSlider';
    ctl.push(sl);
  }
  if (key === 'slide') {
    ctl.push(ui.btn(sim.svOpen ? tr('svClose') : tr('svOpen'), () => toggleSlide(), sim.svOpen ? 'danger' : 'ok'));
  }
  if (key === 'valve' || key === 'silencer') {
    // one compact toggle for the lever; the arrow shows which way it is now
    ctl.push(ui.btn(tr('leverToggle') + (sim.lever === 0 ? ' ◀' : ' ▶'), () => setLever(sim.lever ? 0 : 1), 'primary'));
    for (const [n, side] of [[5, 'Left'], [3, 'Right']]) {
      ctl.push(ui.btn(tr('sil' + side) + (sim.silencer[n] ? ' ✓' : ' ✕'), () => { sim.silencer[n] = !sim.silencer[n]; sound.click(); refreshPanel(); }, sim.silencer[n] ? '' : 'danger'));
    }
  }
  ui.open(key, ctl);
  ui.current = key;
  $('pSub').textContent = '';
  $('pText').textContent = '';
  const lk = key === 'lub' ? 'fr' : key === 'silencer' ? 'valve' : key;
  document.querySelectorAll('#legendList li').forEach((li) => li.classList.toggle('on', li.dataset.key === lk));
}

function openTubePanel(t) {
  const [a, b] = t.ends;
  const name = (e) => (e.port ? e.port.name : tr('endFree'));
  const ctl = [];
  [a, b].forEach((e, i) => {
    if (e.port) ctl.push(ui.btn(tr('endRemove', { n: i + 1 }), () => { t.detach(i); sound.click(); commit(); refreshPanel(); }));
  });
  if (t.freeIndex >= 0 && t.connectedCount === 1) ctl.push(ui.btn(tr('pickLoose'), () => pickUpFreeEnd(t), 'primary'));
  ctl.push(ui.btn(tr('removeTube'), () => { removeTube(t); ui.close(); sound.click(); commit(); }, 'danger'));
  ui.open({ title: tr('tubeTitle', { size: t.size }), sub: '', text: tr('endLine', { n: 1, name: name(a) }) + '\n' + tr('endLine', { n: 2, name: name(b) }), tube: t }, ctl);
}

// ---------- നിയന്ത്രണങ്ങൾ ----------
function toggleMains() {
  sim.mains = !sim.mains;
  sound.click();
  ui.toast(sim.mains ? tr('toastMainsOn') : tr('toastMainsOff'));
  updateStatus();
}
function togglePower() {
  sim.power = !sim.power;
  sound.click();
  ui.toast(sim.power ? tr('toastCompOn') : tr('toastCompOff'));
  refreshPanel();
}
function toggleSlide() {
  sim.svOpen = !sim.svOpen;
  sound.click();
  ui.toast(sim.svOpen ? tr('toastSvOpen') : tr('toastSvClose'));
  refreshPanel();
}
function setLever(v) {
  if (sim.lever === v) return;
  sim.lever = v;
  sound.clunk();
  refreshPanel();
}

// ---------- Pointer ----------
let down = null;
let knobDrag = null;
let drainHold = false, drainUntil = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  sound.unlock();
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (state.mode !== 'idle') return;
  const pick = pickAt(e.clientX, e.clientY);
  if (pick && pick.kind === 'control' && pick.action === 'regulator' && C.frl.knobUp) {
    // Knob is pulled up: drag to turn it
    knobDrag = { x: e.clientX, y: e.clientY, start: sim.regSet, last: sim.regSet };
    controls.enabled = false;
  } else if (pick && pick.kind === 'control' && pick.action === 'drain') {
    drainHold = true;
    controls.enabled = false;
  }
});
function endPointer() {
  if (drainHold) { drainHold = false; drainUntil = performance.now() + 250; }
  controls.enabled = true;
  setTimeout(() => { knobDrag = null; }, 0);
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
function regBubble(x, y) {
  // shown above the finger so it is not hidden under it
  ui.showTooltip(tr('setBubble', { s: sim.regSet.toFixed(1), o: sim.p('F.out').toFixed(1) }), x, y, true);
}
// Mouse wheel over the lifted knob turns it (instead of zooming)
host.addEventListener('wheel', (e) => {
  if (!C.frl.knobUp) return;
  const pick = pickAt(e.clientX, e.clientY);
  if (!(pick && pick.kind === 'control' && pick.action === 'regulator')) return;
  e.preventDefault();
  e.stopPropagation();
  setReg(sim.regSet + (e.deltaY < 0 ? 0.1 : -0.1));
  regBubble(e.clientX, e.clientY);
}, { capture: true, passive: false });
function setReg(v) {
  const nv = Math.round(Math.min(6, Math.max(0, v)) * 10) / 10;
  if (Math.floor(nv * 2) !== Math.floor(sim.regSet * 2)) sound.click();
  sim.regSet = nv;
}
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 600;
  down = null;
  if (knobDrag && moved >= 7) { ui.showTooltip(null); return; }
  if (moved < 7 && quick) handleClick(e.clientX, e.clientY);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (knobDrag) {
    const d = (e.clientX - knobDrag.x) - (e.clientY - knobDrag.y);
    setReg(knobDrag.start + d * 0.015);
    regBubble(e.clientX, e.clientY);
    return;
  }
  if (state.mode === 'second' && state.tube) {
    const zp = state.tube.attachedPort.tip(new THREE.Vector3()).z + 4;
    const pick = pickAt(e.clientX, e.clientY, state.tube);
    hoverPort(pick && pick.kind === 'port' ? pick.port : null);
    if (pick && pick.kind === 'port' && !portProblem(pick.port, state.tube.size)) {
      state.tube.dragTarget = pick.port.tip(new THREE.Vector3());
    } else {
      const p = rayToPlaneZ(e.clientX, e.clientY, zp);
      if (p) state.tube.dragTarget = p;
    }
    return;
  }
  if (e.pointerType !== 'mouse') return;
  const pick = pickAt(e.clientX, e.clientY);
  if (state.mode === 'first') hoverPort(pick && pick.kind === 'port' ? pick.port : null);
  else hoverPort(pick && pick.kind === 'port' ? pick.port : null, true);
  ui.showTooltip(tooltipFor(pick), e.clientX, e.clientY);
  renderer.domElement.style.cursor = pick ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('pointerleave', () => ui.showTooltip(null));

function tooltipFor(pick) {
  if (!pick) return null;
  if (pick.kind === 'port') return pick.port.desc + (pick.port.tube ? tr('ttHasTube') : '');
  if (pick.kind === 'control') return (pick.action === 'regulator' ? tr(C.frl.knobUp ? 'ttRegUp' : 'ttRegDown') : tr({ power: 'ttPower', mains: 'ttMains', slide: 'ttSlide', lever: 'ttLever', drain: 'ttDrain' }[pick.action]));
  if (pick.kind === 'comp') return info(pick.key)?.title;
  if (pick.kind === 'tube') return tr('ttTube', { size: pick.tube.size });
  if (pick.kind === 'freeEnd') return tr('ttFree');
  return null;
}

function clearHover() {
  if (state.hoverPort) state.hoverPort.highlight(null);
  state.hoverPort = null;
}
function hoverPort(port, plain = false) {
  if (state.hoverPort === port) return;
  clearHover();
  if (!port) return;
  state.hoverPort = port;
  if (plain) port.highlight('hover');
  else {
    const size = state.mode === 'second' ? state.tube.size : state.size;
    port.highlight(portProblem(port, size) ? 'bad' : 'ok');
  }
}

function handleClick(x, y) {
  const pick = pickAt(x, y, state.mode === 'second' ? state.tube : null);

  // Switches and valves always work, even while a tube is in your hand
  // (e.g. to stop the air quickly when something goes wrong)
  if (state.mode !== 'idle' && pick && pick.kind === 'control') {
    if (pick.action === 'mains') toggleMains();
    else if (pick.action === 'slide') toggleSlide();
    else if (pick.action === 'lever') setLever(sim.lever ? 0 : 1);
    else if (pick.action === 'regulator') { C.frl.knobUp = !C.frl.knobUp; sound.click(); }
    return;
  }

  if (state.mode === 'first') {
    if (pick && pick.kind === 'port') onPortClickPlacing(pick.port);
    else ui.toast(tr('tapPort'));
    return;
  }
  if (state.mode === 'second') {
    if (pick && pick.kind === 'port') onPortClickPlacing(pick.port);
    else dropFreeEnd();
    return;
  }

  // idle
  if (!pick) { ui.close(); return; }
  switch (pick.kind) {
    case 'control':
      if (pick.action === 'mains') { toggleMains(); break; }
      if (pick.action === 'power') togglePower();
      else if (pick.action === 'slide') toggleSlide();
      else if (pick.action === 'lever') setLever(sim.lever ? 0 : 1);
      if (pick.action === 'regulator') {
        C.frl.knobUp = !C.frl.knobUp;
        sound.click();
        ui.toast(tr(C.frl.knobUp ? 'knobUp' : 'knobDown'));
        focusOn('fr');
      } else if (pick.action === 'drain') {
        if (sim.water <= 0.004) ui.toast(tr(sim.p('F.in') < 0.2 ? 'drainEmpty' : 'drainDry'));
        else if (sim.p('F.in') < 0.2) ui.toast(tr('drainNoAir'));
      } else if (ui.current !== pick.comp) openComp(pick.comp);
      break;
    case 'comp':
      openComp(pick.key);
      focusOn(pick.key);
      break;
    case 'port':
      if (pick.port.tube) openTubePanel(pick.port.tube);
      else ui.toast(pick.port.desc);
      break;
    case 'tube':
      openTubePanel(pick.tube);
      break;
    case 'freeEnd':
      pickUpFreeEnd(pick.tube);
      break;
  }
}

// ---------- ബട്ടണുകൾ ----------
document.querySelectorAll('#tray .tube').forEach((b) => {
  b.onclick = () => { sound.unlock(); const s = +b.dataset.size; state.mode !== 'idle' && state.size === s ? cancelPlacing() : startPlacing(s); };
});
$('btnCancel').onclick = () => cancelPlacing();
$('btnParts').onclick = (e) => {
  // Part letters on the model + the side list appear only while this is on
  const on = e.currentTarget.classList.toggle('on');
  $('app').classList.toggle('labels-off', !on);
};
$('btnColors').onclick = (e) => {
  pressureColors = e.currentTarget.classList.toggle('on');
  ui.toast(pressureColors ? tr('toastColorsOn') : tr('toastColorsOff'));
};
$('btnSound').onclick = (e) => {
  sound.unlock();
  const on = e.currentTarget.classList.toggle('on');
  sound.setMuted(!on);
};
if (window.innerWidth < window.innerHeight && window.innerWidth < 700) {
  setTimeout(() => ui.toast(tr('toastLandscape')), 1500);
}
$('btnReset').onclick = () => location.reload();
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
});
updateHistoryButtons();
$('btnPower').onclick = () => { sound.unlock(); toggleMains(); };
$('btnHome').onclick = () => { const v = overviewView(); flyTo(v.pos, v.target); };
// When the lab is embedded in a page, that page can ask for the overview ("Reset View")
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'lab-reset') { const v = overviewView(); flyTo(v.pos, v.target); }
});
applyStatic();
ui.setHint(tr('hintIdle'));
document.querySelectorAll('#legendList li').forEach((li) => {
  li.onclick = () => {
    openComp(li.dataset.key);
    focusOn(li.dataset.key);
  };
});
$('btnHelp').onclick = () => $('help').classList.remove('hidden');
$('helpOk').onclick = () => { sound.unlock(); $('help').classList.add('hidden'); };
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancelPlacing(); });

// ---------- സ്റ്റാറ്റസ്, അലാറം ----------
let uiTimer = 0;
function updateStatus() {
  const rs = $('regSlider');
  if (rs) {
    const r = rs.querySelector('input');
    if (document.activeElement !== r && Math.abs(+r.value - sim.regSet) > 0.001) {
      r.value = sim.regSet;
      rs.querySelector('.val').textContent = ` ${sim.regSet.toFixed(1)} bar`;
    }
  }
  $('stTank').textContent = sim.tankP.toFixed(1) + ' bar';
  const m = $('stMotor');
  m.textContent = sim.motorOn ? tr('mRun') : sim.live ? tr('mStandby') : tr('mOff');
  m.className = sim.motorOn ? 'on' : sim.live ? 'wait' : '';
  const bp = $('btnPower');
  bp.classList.toggle('on', sim.mains);
  bp.textContent = sim.mains ? tr('pwrOn') : tr('pwrOff');
  $('stReg').textContent = sim.p('F.out').toFixed(1) + ' bar';
  $('stCyl').textContent = sim.cylVel > 0.01 ? tr('cMoving') : sim.cylPos > 0.98 ? tr('cExt') : sim.cylPos < 0.02 ? tr('cRet') : tr('cMid');

  if (sim.whips.length) {
    const w = sim.whips[0];
    const port = w.tube.attachedPort;
    ui.setAlarm(`<b>${tr('alarmTitle')}</b> ` + (sim.live ? tr('alarmCompOn') : tr('alarmStill')) +
      tr('alarmBody', { p: w.tube.whip.toFixed(1) }));
  } else ui.setAlarm(null);

  // Only say that something is wrong — never how to fix it (students find out by trial and error)
  const msgs = [];
  if (sim.leaks.length || sim.exhaustFlows.length) msgs.push(tr('wrongAir'));
  if (sim.lowPressure) msgs.push(tr('lowPressure'));
  ui.setWarn(msgs.length ? msgs.join('<br>') : null);
}

// ---------- ലൂപ്പ് ----------
const spray = new DrainSpray(scene);
const puffs = new AirPuffs(scene);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
function exhaustWorld(where, out) {
  // With the silencer fitted the air leaves at its tip; without it, straight out of the valve's hole
  const p = sim.silencer[where] ? C.valve.exhaustPos[where] : C.valve.portPos[where];
  return C.valve.group.localToWorld(out.copy(p));
}
const sprayPos = new THREE.Vector3();
const clock = new THREE.Clock();
let first = true;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  sim.drainOpen = drainHold || performance.now() < drainUntil;
  // If the tube in your hand gets pressurised it whips out of your hand
  if (state.mode === 'second' && state.tube && state.tube.whip > 0.15) {
    state.tube.isNew = false;
    state.tube.dragTarget = null;
    state.tube = null;
    cancelPlacing();
    ui.toast(tr('errWhip'), true);
  }
  sim.step(dt);
  spray.emit(dt, C.frl.drainTip.getWorldPosition(sprayPos), sim);
  spray.update(dt);
  // Air leaving through the silencers / open ports (seen and heard, no messages)
  for (const v of sim.exhaustFlows) {
    if (v.where === 3 || v.where === 5) {
      const sil = sim.silencer[v.where];
      puffs.stream(dt, 'ex' + v.where, exhaustWorld(v.where, _v1), DOWN, sim.p(v.node) * (sil ? 0.3 : 1), sil ? 10 : 25, sil ? 0.9 : 1.6, sil ? 0.18 : 0.32);
    }
  }
  for (const v of sim.leaks) {
    const pp = sim.p(v.node);
    puffs.stream(dt, v.port.id, v.port.tip(_v1), v.port.worldNormal(_v2), pp, 25, 1.6, 0.3);
  }
  puffs.update(dt);
  if (fly) {
    fly.t += dt;
    const k = Math.min(1, fly.t / fly.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, e);
    controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (k >= 1) fly = null;
  }
  for (const c of comps) c.update(sim, dt, t);
  for (const tb of app.tubes) {
    const p = tb.attachedPort;
    tb.pressure = p ? sim.p(p.id) : 0;
    tb.setColor(pressureColors);
    tb.update(t);
  }

  // ശബ്ദം
  sound.motor(sim.motorOn);
  let hiss = 0;
  for (const v of sim.whips) hiss += sim.p(v.node);
  for (const v of sim.leaks) hiss += sim.p(v.node) * 0.6;
  hiss += sim.drainP * 0.5;
  for (const v of sim.exhaustFlows) {
    const sil = v.where === 'slide' || sim.silencer[v.where];
    hiss += sim.p(v.node) * (sil ? 0.25 : 0.9);
  }
  sound.hiss(hiss);
  for (const ev of sim.events) {
    if (ev.type === 'cutOut') sound.puff(0.7, false, 0.7);
    else if (ev.type === 'exhaust') {
      const silenced = ev.where === 'slide' ? true : sim.silencer[ev.where];
      sound.puff(ev.p / 3, silenced, silenced ? 0.5 : 0.35);
      if (ev.where === 3 || ev.where === 5) puffs.burst(exhaustWorld(ev.where, _v1), DOWN, ev.p * (silenced ? 0.3 : 1), silenced ? 6 : 12, silenced ? 1 : 1.8, silenced ? 0.2 : 0.35);
    } else if (ev.type === 'cylEnd') sound.clunk();
  }

  uiTimer += dt;
  if (uiTimer > 0.1) { uiTimer = 0; updateStatus(); }

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  if (first) { first = false; $('loading').classList.add('hidden'); }
  requestAnimationFrame(loop);
}
loop();

// ഡീബഗ്/ടെസ്റ്റിങ്ങിന്
window.__lab = { sim, app, connect, removeTube, portById, camera, THREE, C, controls }; // for testing in the browser console
