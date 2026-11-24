/* Machinist Hands — CNC lathe simulation (js/cncsim.js).
 * Reads the Siemens 802D program shown on the page (<pre class="program">), runs it on a turned 3D bar
 * and shows the tool moving, the current block highlighted and the contour (AB … BC) as a profile.
 * Tap a contour block to see it on the profile, or tap the profile to find its block.
 * Supported: G00 G01 G02 G03 (CR=), G75 home, T/D, S, F, M00/M01/M03/M05/M30, R parameters,
 * IF … GOTO, N labels and CYCLE95 (roughing + finishing, simplified for teaching). */
(function () {
  'use strict';
  const pre = document.querySelector('pre.program');
  const host = document.querySelector('[data-cncsim]');
  if (!pre || !host) return;
  const jsBase = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  const SRC = pre.textContent.replace(/\r/g, '').split('\n');

  /* ---------- tiny expression evaluator: numbers, R1…, + - * /, ( ) ---------- */
  function evalExpr(s, R) {
    const t = s.replace(/\s+/g, '').match(/R\d+|\d*\.?\d+|[-+*/()]/g) || [];
    let i = 0;
    const atom = () => {
      const k = t[i++];
      if (k === '(') { const v = sum(); i++; return v; }
      if (k === '-') return -atom();
      if (k === '+') return atom();
      if (/^R\d+$/.test(k)) return R[k] || 0;
      return parseFloat(k);
    };
    const prod = () => { let v = atom(); while (t[i] === '*' || t[i] === '/') v = t[i++] === '*' ? v * atom() : v / atom(); return v; };
    const sum = () => { let v = prod(); while (t[i] === '+' || t[i] === '-') v = t[i++] === '+' ? v + prod() : v - prod(); return v; };
    return sum();
  }
  const clean = (l) => l.split(';')[0].trim().toUpperCase();

  /* ---------- geometry ---------- */
  // Points are {z, r} (r = radius = X/2). Arcs: G02 clockwise / G03 counter-clockwise seen with Z to the right, X up.
  function arcPoints(a, b, R, cw) {
    const dz = b.z - a.z, dr = b.r - a.r, d = Math.hypot(dz, dr);
    if (d < 1e-9) return [b];
    const rad = Math.max(R, d / 2), h = Math.sqrt(Math.max(rad * rad - d * d / 4, 0));
    const mz = (a.z + b.z) / 2, mr = (a.r + b.r) / 2, nz = -dr / d, nr = dz / d;
    const s = cw ? -1 : 1;                          // centre on the left of a→b for CCW (minor arc)
    const cz = mz + s * nz * h, cr = mr + s * nr * h;
    let a0 = Math.atan2(a.r - cr, a.z - cz), a1 = Math.atan2(b.r - cr, b.z - cz);
    if (cw) { while (a1 > a0) a1 -= 2 * Math.PI; } else { while (a1 < a0) a1 += 2 * Math.PI; }
    const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * rad / 0.15));
    const out = [];
    for (let k = 1; k <= n; k++) { const t = a0 + (a1 - a0) * k / n; out.push({ z: cz + rad * Math.cos(t), r: cr + rad * Math.sin(t) }); }
    return out;
  }

  /* ---------- program structure ---------- */
  const labelAt = {};                     // 'AB' / 'N1005' → line index
  SRC.forEach((l, i) => {
    const c = clean(l);
    let m = c.match(/^([A-Z_][A-Z0-9_]*):$/); if (m) labelAt[m[1]] = i;
    m = c.match(/^(N\d+)\b/); if (m && labelAt[m[1]] === undefined) labelAt[m[1]] = i;
  });

  function contourFrom(name1, name2) {          // elements between the labels, with the line of each
    const i1 = labelAt[name1], i2 = labelAt[name2];
    const els = []; let p = null, mode = 1;
    for (let i = i1 + 1; i < i2; i++) {
      const c = clean(SRC[i]); if (!c) continue;
      const g = c.match(/G0?([0-3])(?!\d)/); if (g) mode = +g[1];
      const x = c.match(/X\s*(-?\d*\.?\d+)/), z = c.match(/Z\s*(-?\d*\.?\d+)/), cr = c.match(/CR\s*=\s*(-?\d*\.?\d+)/);
      const q = { z: z ? +z[1] : (p ? p.z : 0), r: x ? +x[1] / 2 : (p ? p.r : 0) };
      if (!p) { p = q; els.push({ line: i, pts: [q], start: true }); continue; }
      const pts = (mode >= 2 && cr) ? arcPoints(p, q, +cr[1], mode === 2) : [q];
      els.push({ line: i, from: p, pts }); p = q;
    }
    return els;
  }
  function profileR(els, z) {                    // largest contour radius at z (keeps material at steps)
    let best = -1, prev = null;
    els.forEach((e) => e.pts.forEach((q) => {
      if (prev) {
        const z0 = prev.z, z1 = q.z;
        if ((z <= z0 && z >= z1) || (z <= z1 && z >= z0)) {
          const t = Math.abs(z1 - z0) < 1e-9 ? 0 : (z - z0) / (z1 - z0);
          best = Math.max(best, Math.abs(z1 - z0) < 1e-9 ? Math.max(prev.r, q.r) : prev.r + t * (q.r - prev.r));
        }
      }
      prev = q;
    }));
    return best;
  }

  /* ---------- run the program into a list of moves ---------- */
  const HOME = { z: 40, r: 30 };
  function run() {
    const moves = []; const R = {};
    let pos = { ...HOME }, mode = 0, tool = 0, i = 0, guard = 0, spindle = '', feed = '', speed = '';
    const push = (to, kind, line, extra) => { moves.push({ from: { ...pos }, to: { ...to }, kind, line, tool, spindle, feed, speed, ...extra }); pos = { ...to }; };
    while (i < SRC.length && guard++ < 20000) {
      const c = clean(SRC[i]); const line = i; i++;
      if (!c || /^[A-Z_][A-Z0-9_]*:$/.test(c)) continue;
      let m;
      if ((m = c.match(/^IF\s+(.+?)\s*(>=|<=|==|<>|>|<)\s*(.+?)\s+GOTO[FB]?\s+(\w+)/))) {
        const a = evalExpr(m[1], R), b = evalExpr(m[3], R), op = m[2];
        const ok = op === '>=' ? a >= b : op === '<=' ? a <= b : op === '==' ? a === b : op === '<>' ? a !== b : op === '>' ? a > b : a < b;
        if (ok && labelAt[m[4]] !== undefined) i = labelAt[m[4]] + 1;
        moves.push({ kind: 'mark', line, from: { ...pos }, to: { ...pos }, tool, spindle, feed, speed }); continue;
      }
      if ((m = c.match(/^(R\d+)\s*=\s*(.+)$/))) { R[m[1]] = evalExpr(m[2], R); moves.push({ kind: 'mark', line, from: { ...pos }, to: { ...pos }, tool, spindle, feed, speed }); continue; }
      if ((m = c.match(/^CYCLE95\s*\(\s*"?([A-Z0-9_]+):([A-Z0-9_]+)"?\s*,(.*)\)/))) { cycle95(m[1], m[2], m[3].split(',').map((v) => parseFloat(v)), line); continue; }
      const t = c.match(/T\s*(\d+)/); if (t) tool = +t[1];
      const f = c.match(/(?:^|\s)F\s*=?\s*(\d*\.?\d+)/); if (f) feed = 'F' + f[1];
      const s = c.match(/(?:^|\s)S\s*(\d+)/); if (s) speed = (/G96/.test(c) ? 'G96 S' : 'G97 S') + s[1];
      if (/M0?3\b/.test(c)) spindle = 'M03'; if (/M0?4\b/.test(c)) spindle = 'M04'; if (/M0?5\b/.test(c)) spindle = '';
      if (/^G75\b/.test(c)) { push(HOME, 'rapid', line); continue; }
      const g = c.match(/G0?([0-3])(?!\d)/); if (g) mode = +g[1];
      const x = c.match(/X\s*(=\s*[^ ]+|-?\d*\.?\d+)/), z = c.match(/Z\s*(=\s*[^ ]+|-?\d*\.?\d+)/), cr = c.match(/CR\s*=\s*(-?\d*\.?\d+)/);
      const val = (v) => v[1].startsWith('=') ? evalExpr(v[1].slice(1), R) : +v[1];
      if (x || z) {
        const to = { z: z ? val(z) : pos.z, r: x ? val(x) / 2 : pos.r };
        if (mode >= 2 && cr) { let p = { ...pos }; const pts = arcPoints(pos, to, +cr[1], mode === 2); pts.forEach((q) => { pos = p; push(q, 'cut', line); p = q; }); }
        else push(to, mode === 0 ? 'rapid' : 'cut', line);
        continue;
      }
      const stop = /\bM0?0\b/.test(c) ? 'M00' : /\bM30\b/.test(c) ? 'M30' : '';
      moves.push({ kind: 'mark', line, stop, from: { ...pos }, to: { ...pos }, tool, spindle, feed, speed });
      if (stop === 'M30') break;
    }
    return moves;

    function cycle95(n1, n2, p, line) {
      const els = contourFrom(n1, n2); CONTOUR = els;
      const MID = p[0] || 1, FALZ = p[1] || 0, FALX = p[2] || 0, VARI = p[7] || 9;
      const start = { ...pos };
      const zs = []; els.forEach((e) => e.pts.forEach((q) => zs.push(q.z)));
      const zMax = Math.max(...zs), zMin = Math.min(...zs);
      if (VARI <= 4 || VARI >= 9) {                              // roughing: 1–4 rough, 9–12 rough + finish
        const top = start.r - 0.5;
        for (let lev = top - MID; lev > 0; lev -= MID) {
          // cut along every interval where the contour (+ allowance) is below this level
          let inCut = false, zA = 0;
          const step = 0.05, segs = [];
          for (let z = zMax + 1; z >= zMin - step; z -= step) {
            const pr = z > zMax ? -1 : profileR(els, z);
            const below = z >= zMin && (pr < 0 || pr + FALX < lev);
            if (below && !inCut) { inCut = true; zA = z; }
            if ((!below || z < zMin) && inCut) { inCut = false; segs.push([zA, z + step + FALZ]); }
          }
          if (inCut) segs.push([zA, zMin + FALZ]);
          segs.forEach(([a, b]) => {
            if (a - b < 0.1) return;
            push({ z: a + 0.5, r: lev + 1 }, 'rapid', line, { cycle: true });
            push({ z: a, r: lev }, 'cut', line, { cycle: true });
            push({ z: b, r: lev }, 'cut', line, { cycle: true });
            push({ z: b + 0.5, r: lev + 1 }, 'cut', line, { cycle: true });
          });
          if (lev - MID < 0) break;
        }
      }
      if (VARI >= 5) {                                           // finishing along the contour
        const s0 = els[0].pts[0];
        push({ z: pos.z, r: start.r }, 'rapid', line, { cycle: true });
        push({ z: s0.z + 1, r: start.r }, 'rapid', line, { cycle: true });
        push({ z: s0.z + 1, r: s0.r }, 'rapid', line, { cycle: true });
        push(s0, 'cut', els[0].line, { cycle: true, seg: els[0].line });
        els.slice(1).forEach((e) => e.pts.forEach((q) => push(q, 'cut', e.line, { cycle: true, seg: e.line })));
      }
      push({ z: pos.z, r: start.r }, 'rapid', line, { cycle: true });
      push(start, 'rapid', line, { cycle: true });
    }
  }
  let CONTOUR = null;
  const MOVES = run();
  if (!CONTOUR) {                                                // contour for the profile view even without CYCLE95
    const n = Object.keys(labelAt).filter((k) => !/^N\d/.test(k));
    if (n.length >= 2) CONTOUR = contourFrom(n[0], n[1]);
  }

  /* ---------- page parts ---------- */
  const zs = []; (CONTOUR || []).forEach((e) => e.pts.forEach((q) => zs.push(q.z)));
  const rs = []; (CONTOUR || []).forEach((e) => e.pts.forEach((q) => rs.push(q.r)));
  const PART_Z = Math.min(...zs), STOCK_R = Math.max(...rs) + 0.0;
  const STOCK_Z_END = PART_Z - 18;                                 // bar continues into the chuck

  host.innerHTML = `
    <div class="sim-view" id="sim-view"><p class="sim-msg">Loading the simulation…</p></div>
    <div class="sim-bar" role="toolbar" aria-label="Simulation controls">
      <button type="button" class="sim-btn sim-play" aria-pressed="false">▶ Play</button>
      <button type="button" class="sim-btn sim-step" title="Run one block">Single block</button>
      <button type="button" class="sim-btn sim-reset">⟲ Reset</button>
      <label class="sim-speed">Speed <select><option value="1">1×</option><option value="3" selected>3×</option><option value="8">8×</option><option value="20">20×</option></select></label>
    </div>
    <div class="sim-dro" aria-live="off"><span>X <b class="d-x">–</b></span><span>Z <b class="d-z">–</b></span><span class="d-t">T–</span><span class="d-s"></span><span class="d-f"></span><span class="d-msg"></span></div>
    <div class="sim-cols">
      <ol class="sim-code" aria-label="CNC program – tap a contour block to see it on the profile"></ol>
      <figure class="sim-prof"><svg class="sim-svg" aria-label="Contour AB to BC – tap a segment to find its block"></svg><figcaption>Contour (AB … BC) – tap a line here or a block in the program</figcaption></figure>
    </div>`;
  pre.hidden = true;
  const $ = (s) => host.querySelector(s);
  const codeOl = $('.sim-code'), svg = $('.sim-svg');
  const segLines = new Set((CONTOUR || []).filter((e) => !e.start).map((e) => e.line));
  SRC.forEach((l, i) => {
    const li = document.createElement('li'); li.dataset.line = i;
    li.textContent = l || ' ';
    if (segLines.has(i)) li.classList.add('is-seg');
    if (/^\s*;/.test(l)) li.classList.add('is-note');
    codeOl.appendChild(li);
  });
  const liAt = (i) => codeOl.children[i];

  /* profile SVG (half above the axis solid, mirror below faint) */
  if (CONTOUR) {
    const pad = 2, z0 = PART_Z - pad, z1 = 1 + pad, rMax = STOCK_R + pad;
    const W = z1 - z0, H = 2 * rMax;
    svg.setAttribute('viewBox', `${z0} ${-rMax} ${W} ${H}`);
    const P = (q) => `${q.z.toFixed(3)} ${(-q.r).toFixed(3)}`;
    const M = (q) => `${q.z.toFixed(3)} ${q.r.toFixed(3)}`;
    let all = '', mirror = '';
    let prev = CONTOUR[0].pts[0];
    const parts = [];
    CONTOUR.slice(1).forEach((e) => {
      const d = 'M' + P(prev) + e.pts.map((q) => ' L' + P(q)).join('');
      mirror += 'M' + M(prev) + e.pts.map((q) => ' L' + M(q)).join('');
      parts.push(`<path class="seg" data-line="${e.line}" d="${d}"/><path class="hit" data-line="${e.line}" d="${d}"/>`);
      prev = e.pts[e.pts.length - 1];
    });
    svg.innerHTML = `<line class="axis" x1="${z0}" y1="0" x2="${z1}" y2="0"/><path class="mirror" d="${mirror}"/>${parts.join('')}`;
    svg.style.setProperty('--sw', (W / 300).toFixed(3));
  }
  function pickSeg(line, scroll) {
    host.querySelectorAll('.sim-svg .seg.on, .sim-code li.picked').forEach((n) => n.classList.remove('on', 'picked'));
    if (line == null) return;
    svg.querySelectorAll(`.seg[data-line="${line}"]`).forEach((n) => n.classList.add('on'));
    const li = liAt(line); if (li) { li.classList.add('picked'); if (scroll) li.scrollIntoView({ block: 'nearest' }); }
  }
  codeOl.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li && li.classList.contains('is-seg')) pickSeg(+li.dataset.line, false); });
  svg.addEventListener('click', (e) => { const p = e.target.closest('[data-line]'); if (p) pickSeg(+p.dataset.line, true); });

  /* ---------- 3D (Three.js, shared with the model viewer) ---------- */
  // Full Three.js as an ES module (the model viewer's bundle has only what the viewer needs).
  // The page's import map points "three" at js/vendor/three/three.module.min.js.
  function need3D(cb) {
    Promise.all([import('three'), import(jsBase + 'vendor/three/addons/controls/OrbitControls.js'),
      import(jsBase + 'vendor/three/addons/environments/RoomEnvironment.js')])
      .then(([T, oc, re]) => cb(T, { OrbitControls: oc.OrbitControls, RoomEnvironment: re.RoomEnvironment }))
      .catch(() => { $('.sim-msg').textContent = 'The simulation could not be loaded.'; });
  }
  const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); need3D(start); } }, { rootMargin: '300px' });
  io.observe(host);

  function start(T, X) {
    const view = $('#sim-view');
    // Phones allow only a few 3D views at a time (the model viewer above is one). Create ours gently,
    // try again on a tap if the browser refuses, and recover when the browser takes the 3D view away.
    let renderer = null;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    for (const opts of [{ antialias: !small, alpha: true, powerPreference: 'low-power' }, { antialias: false, alpha: true, powerPreference: 'low-power' }]) {
      try { renderer = new T.WebGLRenderer(opts); break; } catch (e) { renderer = null; }
    }
    if (!renderer) {
      $('.sim-msg').innerHTML = '<button type="button" class="sim-btn sim-retry">Tap to start the simulation</button>';
      $('.sim-retry').addEventListener('click', () => start(T, X), { once: true });
      return;
    }
    view.innerHTML = ''; view.appendChild(renderer.domElement);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const lost = document.createElement('button'); lost.type = 'button'; lost.className = 'sim-btn sim-lost'; lost.hidden = true;
    lost.textContent = 'The browser paused the 3D view – tap to continue'; view.appendChild(lost);
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost.hidden = false; });
    renderer.domElement.addEventListener('webglcontextrestored', () => { lost.hidden = true; dirty = true; });
    lost.addEventListener('click', () => { lost.hidden = true; try { renderer.forceContextRestore(); } catch (e) { /* the browser restores it itself */ } });
    const scene = new T.Scene();
    scene.environment = new T.PMREMGenerator(renderer).fromScene(new X.RoomEnvironment(), 0.04).texture;
    scene.add(new T.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dl = new T.DirectionalLight(0xffffff, 1.4); dl.position.set(20, 40, 30); scene.add(dl);
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 2000);
    const midZ = (PART_Z + 2) / 2;
    camera.position.set(midZ + 4, 12 + STOCK_R, 112 + STOCK_R * 3.8);
    const controls = new X.OrbitControls(camera, renderer.domElement);
    controls.target.set(midZ + 2, 8, 0); controls.enableDamping = true; controls.update(); controls.saveState();

    // world: X = machine Z (to the right), Y = radius (up)
    const steel = new T.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 0.9, roughness: 0.32 });
    // Three-jaw chuck: body behind the bar, three stepped jaws 120° apart gripping it. It turns with the spindle.
    const chuckM = new T.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.6, roughness: 0.45 });
    const jawM = new T.MeshStandardMaterial({ color: 0x8d939a, metalness: 0.8, roughness: 0.35 });
    const chuck = new T.Group();
    const bodyR = STOCK_R * 2.6 + 6, face0 = STOCK_Z_END;            // chuck face where the bar leaves it
    const body = new T.Mesh(new T.CylinderGeometry(bodyR, bodyR, 16, 48), chuckM);
    body.rotation.z = Math.PI / 2; body.position.x = face0 - 8 - 2; chuck.add(body);
    const jawH = bodyR - STOCK_R - 2;
    for (let j = 0; j < 3; j++) {
      const jaw = new T.Group();
      const a = new T.Mesh(new T.BoxGeometry(12, jawH * 0.45, 7), jawM);      // gripping step, touches the bar
      a.position.set(face0 + 4, STOCK_R + jawH * 0.225, 0);
      const b = new T.Mesh(new T.BoxGeometry(7, jawH * 0.55, 7), jawM);       // outer step
      b.position.set(face0 + 1.5, STOCK_R + jawH * 0.45 + jawH * 0.275, 0);
      jaw.add(a, b); jaw.rotation.x = j * 2 * Math.PI / 3 + Math.PI / 2; chuck.add(jaw);
    }

    // material: radius per 0.05 mm cell
    const DZ = 0.05, ZTOP = 1, N = Math.round((ZTOP - STOCK_Z_END) / DZ) + 1;
    let mat;
    const zOf = (k) => ZTOP - k * DZ, kOf = (z) => Math.round((ZTOP - z) / DZ);
    // The bar starts short inside the chuck. At the M00 after the stopper it is pulled out against the sleeve,
    // whose face is 1 mm past Z0 – so the bar face sits at Z+1 and the facing pass takes that 1 mm off.
    const FACE0 = -20, SLEEVE = 1;
    let face = FACE0, pulling = false;
    function fillTo(z) { for (let k = 0; k < N; k++) if (zOf(k) <= z && mat[k] === 0) mat[k] = STOCK_R; dirty = true; }
    function resetMat() { mat = new Float32Array(N); face = FACE0; pulling = false; fillTo(FACE0); }
    let part = null, dirty = true;
    resetMat();
    const spin = new T.Group(); scene.add(spin); spin.add(chuck);
    function rebuild() {
      const pts = [new T.Vector2(0, ZTOP)];
      for (let k = 0; k < N; k += 3) pts.push(new T.Vector2(Math.max(mat[k], 0.001), zOf(k)));
      pts.push(new T.Vector2(0, STOCK_Z_END));
      const g = new T.LatheGeometry(pts, 40); g.rotateZ(-Math.PI / 2);   // axis along world X
      g.computeVertexNormals();
      if (part) { part.geometry.dispose(); part.geometry = g; } else { part = new T.Mesh(g, steel); spin.add(part); }
      dirty = false;
    }
    // tools
    const toolMats = { 1: 0xd4af37, 7: 0xd4af37, 3: 0xd4af37, 4: 0x111114 };   // gold-coloured (coated carbide) inserts; stopper sleeve black so it stands out from the bar
    const tools = {};
    /* Tools as on the machine (insert shapes from the holder codes):
     *  T1 PCLNR 2020 K12 – 95° holder, CNMG 1204 insert (80° rhombic, 12.7 mm IC)
     *  T7 MVJNR 2020 K16 – 93° holder, VNMG 1604 insert (35° rhombic, 9.525 mm IC)
     *  T3 CFIR 2020 K06 – Seco MDT parting/grooving holder, LC..1606 insert, 6 mm wide
     *  T4 sleeve (stopper) – black, its face 1 mm past its Z0 */
    const PART_W = 6;
    const holderM = new T.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.5, roughness: 0.5 });
    function rhombicInsert(kappaDeg, cornerDeg, ic, m) {
      const k = kappaDeg * Math.PI / 180, c = cornerDeg * Math.PI / 180, L = ic / Math.sin(c);
      const a1 = Math.PI - k, a2 = a1 - c;                         // main and minor edge directions from the tip (Z right, X up)
      const P1 = [L * Math.cos(a1), L * Math.sin(a1)], P3 = [L * Math.cos(a2), L * Math.sin(a2)];
      const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(P1[0], P1[1]); sh.lineTo(P1[0] + P3[0], P1[1] + P3[1]); sh.lineTo(P3[0], P3[1]); sh.lineTo(0, 0);
      const ins = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 4.76, bevelEnabled: false }), m); ins.position.z = -4.76;   // top face at centre height
      return { ins, P1, P3 };
    }
    function makeTool(n) {
      const g = new T.Group(), m = new T.MeshStandardMaterial({ color: toolMats[n] || 0xd9a383, metalness: 0.4, roughness: 0.45 });
      if (n === 3) {                                               // 6 mm parting blade, reference on its right edge
        // insert at the tip, a thin blade (narrower than the insert) going up to a 20 × 20 shank on its right
        const ins = new T.Mesh(new T.BoxGeometry(PART_W, 5, 6), m); ins.position.set(-PART_W / 2, 2.5, -3); g.add(ins);
        const blade = new T.Mesh(new T.BoxGeometry(PART_W - 1.2, 26, 20), holderM); blade.position.set(-PART_W / 2, 5 + 13, -10); g.add(blade);
        const shank = new T.Mesh(new T.BoxGeometry(20, 60, 20), holderM); shank.position.set(-PART_W / 2 + 12.6, 31 + 30, -10); g.add(shank);
      } else if (n === 4) {
        const c = new T.Mesh(new T.CylinderGeometry(5, 5, 24, 32), m); c.rotation.z = Math.PI / 2; c.position.set(SLEEVE + 0.05 + 12, 0, 0); g.add(c);
      } else {
        const r = n === 7 ? rhombicInsert(93, 35, 9.525, m) : rhombicInsert(95, 80, 12.7, m);
        g.add(r.ins);
        // The holder head follows the insert: its sides run along the insert's edges, so on the narrow 35° VNMG
        // the head stays clear of the work in profiling. The 20 × 20 shank starts only after the head length
        // (LH ≈ 32 mm MVJNR, 28 mm PCLNR). Functional width 25 mm: the shank's far side is 25 mm from the tip.
        const LH = n === 7 ? 32 : 28, WF = 25, [p1, p3] = [r.P1, r.P3];
        const hs = new T.Shape();
        hs.moveTo(0.4, 0.4); hs.lineTo(p1[0], p1[1]); hs.lineTo(p1[0], LH); hs.lineTo(WF, LH); hs.lineTo(WF, p3[1]); hs.lineTo(p3[0], p3[1]); hs.lineTo(0.4, 0.4);
        const head = new T.Mesh(new T.ExtrudeGeometry(hs, { depth: 20, bevelEnabled: false }), holderM);
        head.position.z = -4.76 - 20; g.add(head);
        const shank = new T.Mesh(new T.BoxGeometry(20, 60, 20), holderM);
        shank.position.set(WF - 10, LH + 30, -4.76 - 10); g.add(shank);
      }
      g.visible = false; scene.add(g); return g;
    }
    // tool path trace
    const pathCut = [], pathRap = [];
    const lineCut = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xd9a383 }));
    const lineRap = new T.LineSegments(new T.BufferGeometry(), new T.LineDashedMaterial({ color: 0x8a8a8a, dashSize: 0.8, gapSize: 0.6 }));
    scene.add(lineCut, lineRap);
    function flushPaths() {
      lineCut.geometry.setAttribute('position', new T.Float32BufferAttribute(pathCut, 3));
      lineRap.geometry.setAttribute('position', new T.Float32BufferAttribute(pathRap, 3)); lineRap.computeLineDistances();
    }

    function cut(tool, q) {                           // remove material at the tool tip q = {z, r}
      if (tool === 4 || tool === 0) return;
      let a, b;
      if (tool === 3) { a = q.z - PART_W; b = q.z; }            // 6 mm parting blade (CFIR 2020 K06), reference on its right edge
      else { a = q.z; b = q.z + (tool === 1 ? 1.5 : 0.12); }   // facing tool clears the face; the profile tool cuts at its tip
      const k0 = Math.max(0, kOf(b)), k1 = Math.min(N - 1, kOf(a));
      for (let k = k0; k <= k1; k++) if (mat[k] > q.r) { mat[k] = Math.max(q.r, 0); dirty = true; }
    }

    /* playback */
    let idx = 0, along = 0, playing = false, stepTo = -1, speedF = 3, last = 0, spinOn = false;
    const dro = { x: $('.d-x'), z: $('.d-z'), t: $('.d-t'), s: $('.d-s'), f: $('.d-f'), m: $('.d-msg') };
    let curLine = -1, tip = { ...HOME };
    function showLine(l, seg) {
      if (l === curLine) return; curLine = l;
      codeOl.querySelectorAll('li.run').forEach((n) => n.classList.remove('run'));
      const li = liAt(l); if (li) { li.classList.add('run'); const top = li.offsetTop; if (top < codeOl.scrollTop || top > codeOl.scrollTop + codeOl.clientHeight - 30) codeOl.scrollTop = top - codeOl.clientHeight / 3; }
      svg.querySelectorAll('.seg.run').forEach((n) => n.classList.remove('run'));
      if (seg != null) svg.querySelectorAll(`.seg[data-line="${seg}"]`).forEach((n) => n.classList.add('run'));
    }
    function placeTool(m, q) {
      Object.values(tools).forEach((g) => { g.visible = false; });
      if (m.tool) { const g = tools[m.tool] || (tools[m.tool] = makeTool(m.tool)); g.visible = true; g.position.set(q.z, q.r, 0); }
      dro.x.textContent = (q.r * 2).toFixed(3); dro.z.textContent = q.z.toFixed(3);
      dro.t.textContent = m.tool ? `T${m.tool} D1` : 'T–'; dro.s.textContent = m.speed + (m.spindle ? ' ' + m.spindle : '');
      dro.f.textContent = m.kind === 'rapid' ? 'G00 rapid' : m.feed; spinOn = !!m.spindle;
    }
    function reset() {
      idx = 0; along = 0; playing = false; stepTo = -1; resetMat(); dirty = true;
      pathCut.length = 0; pathRap.length = 0; flushPaths();
      $('.sim-play').textContent = '▶ Play'; $('.sim-play').setAttribute('aria-pressed', 'false'); dro.m.textContent = '';
      tip = { ...HOME }; curLine = -1; spinOn = false; placeTool(MOVES[0] || { tool: 0, speed: '', spindle: '', feed: '' }, tip); showLine(MOVES[0] ? MOVES[0].line : 0, null);
      if (part) rebuild(); controls.reset();
    }
    function advance(dist) {
      while (dist > 0 && idx < MOVES.length) {
        const m = MOVES[idx];
        showLine(m.line, m.seg); if (m.kind === 'mark') {
          placeTool(m, m.to);
          if (m.stop === 'M00') {
            idx++;
            if (m.tool === 4 && face < SLEEVE) { pulling = true; dro.m.textContent = 'M00 – open the chuck, pull the bar out against the sleeve (1 mm past Z0) and clamp it'; return 'pull'; }
            dro.m.textContent = 'M00 – program stop: press Play to go on'; return 'stop';
          }
          if (m.stop === 'M30') { dro.m.textContent = 'M30 – program end'; idx++; return 'end'; }
          idx++; along = 0; continue;
        }
        const L = Math.hypot(m.to.z - m.from.z, m.to.r - m.from.r), v = m.kind === 'rapid' ? 6 : 1;
        const need = (L - along) / v;
        const go = Math.min(dist, need); dist -= go; const prev = along; along += go * v;
        const t0 = L ? prev / L : 1, t1 = L ? Math.min(along / L, 1) : 1;
        const n = Math.max(1, Math.ceil((t1 - t0) * L / 0.04));
        for (let k = 1; k <= n; k++) {
          const t = t0 + (t1 - t0) * k / n, q = { z: m.from.z + (m.to.z - m.from.z) * t, r: m.from.r + (m.to.r - m.from.r) * t };
          if (m.kind === 'cut') cut(m.tool, q);
          tip = q;
        }
        const a = { z: m.from.z + (m.to.z - m.from.z) * t0, r: m.from.r + (m.to.r - m.from.r) * t0 };
        (m.kind === 'rapid' ? pathRap : pathCut).push(a.z, a.r, 0.05, tip.z, tip.r, 0.05);
        placeTool(m, tip);
        if (along >= L - 1e-9) { idx++; along = 0; if (stepTo >= 0 && (idx >= MOVES.length || MOVES[idx].line !== m.line)) { stepTo = -1; flushPaths(); return 'step'; } }
      }
      flushPaths();
      if (idx >= MOVES.length) return 'end';
      return '';
    }
    function setPlay(on) { playing = on; $('.sim-play').textContent = on ? '❚❚ Pause' : '▶ Play'; $('.sim-play').setAttribute('aria-pressed', String(on)); }
    $('.sim-play').addEventListener('click', () => { if (pulling) return; if (idx >= MOVES.length) reset(); setPlay(!playing); if (playing) dro.m.textContent = ''; });
    $('.sim-step').addEventListener('click', () => { if (idx >= MOVES.length) reset(); setPlay(false); stepTo = idx; dro.m.textContent = ''; let r = ''; let guard = 0; while (stepTo >= 0 && guard++ < 100000) { r = advance(0.5); if (r) break; } stepTo = -1; if (dirty) rebuild(); });
    $('.sim-reset').addEventListener('click', reset);
    $('.sim-speed select').addEventListener('change', (e) => { speedF = +e.target.value; });

    function size() { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(size).observe(view); size();
    reset(); rebuild();
    let lastBuild = 0;
    new IntersectionObserver((en) => { renderer.setAnimationLoop(en[0].isIntersecting ? loop : null); last = 0; }).observe(view);
    function loop(now) {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now;
      if (playing) {
        const r = advance(dt * 12 * speedF);                  // 12 mm/s of feed at 1×, rapids 6× faster
        if (r === 'stop' || r === 'end' || r === 'pull') setPlay(false);
      }
      if (pulling) {                                        // the bar slides out of the chuck to the sleeve
        face = Math.min(SLEEVE, face + dt * 10); fillTo(face);
        if (face >= SLEEVE) { pulling = false; dro.m.textContent += ' – done. Press Play to go on.'; }
      }
      if (spinOn) spin.rotation.x += dt * 12;
      if (dirty && now - lastBuild > 90) { rebuild(); lastBuild = now; }
      controls.update(); renderer.render(scene, camera);
    }
  }
})();
