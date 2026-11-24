/* Machinist Hands — CNC milling simulation (js/millsim.js).
 * Reads the milling program shown on the page (<pre class="program">) and runs it on a 3D plate: the tool moves,
 * the material comes off and the running block is highlighted. Tap a cutting block to see it on the top view,
 * or tap the top view to find its block.
 * Supported: G00 G01 G02 G03 (R), G90/G91, G28 home, G40/G41/G42 with D (cutter radius compensation),
 * G54 work zero, T/M06, S, F, M03/M05/M08/M09/M30, M97 P… L… local subprogram call with N labels and M99.
 * The host element: data-millsim="X Y thickness" (plate in mm) and data-tool="engrave" or "end 10" (end mill, diameter). */
(function () {
  'use strict';
  const pre = document.querySelector('pre.program');
  const host = document.querySelector('[data-millsim]');
  if (!pre || !host) return;
  const jsBase = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  const [PW, PH, PT] = (host.dataset.millsim || '70 70 5').split(' ').map(Number);
  const [TOOL, TD] = (host.dataset.tool || 'engrave').split(' ');
  const END = TOOL === 'end', TR = END ? (+TD || 10) / 2 : 0;          // cutter radius (D01)
  const SRC = pre.textContent.replace(/\r/g, '').split('\n');
  const HOME = { x: PW + 15 + TR, y: PH + 10, z: 30 };                  // where G28 sends the tool, clear of the plate

  /* ---------- arcs (G02 clockwise / G03 counter-clockwise seen from above, R = radius, minor arc) ---------- */
  function arcPts(a, b, R, cw) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 1e-9) return [b];
    const r = Math.max(Math.abs(R), d / 2), h = Math.sqrt(Math.max(r * r - d * d / 4, 0));
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -dy / d, ny = dx / d, s = cw ? -1 : 1;
    const cx = mx + s * nx * h, cy = my + s * ny * h;
    let t0 = Math.atan2(a.y - cy, a.x - cx), t1 = Math.atan2(b.y - cy, b.x - cx);
    if (cw) { while (t1 > t0) t1 -= 2 * Math.PI; } else { while (t1 < t0) t1 += 2 * Math.PI; }
    const n = Math.max(6, Math.ceil(Math.abs(t1 - t0) * r / 0.4)), out = [];
    for (let k = 1; k <= n; k++) { const t = t0 + (t1 - t0) * k / n; out.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t), z: a.z + (b.z - a.z) * k / n }); }
    return out;
  }

  /* ---------- run the program: programmed moves, then the tool centre with cutter compensation ---------- */
  const words = (c) => { const w = {}; (c.match(/[A-Z]-?\d*\.?\d+/g) || []).forEach((t) => { (w[t[0]] = w[t[0]] || []).push(parseFloat(t.slice(1))); }); return w; };
  const LINES = SRC.map((raw) => raw.split(';')[0].replace(/\(.*?\)/g, '').trim().toUpperCase());
  const labelAt = {}; LINES.forEach((c, i) => { const m = c.match(/^N(\d+)\b/); if (m && labelAt[m[1]] === undefined) labelAt[m[1]] = i; });
  // walk the program in the order the control runs it (M97 P… L… calls the block at N…, M99 returns)
  function walk(each) {
    const stack = []; let pc = 0, guard = 0;
    while (pc < LINES.length && guard++ < 5000) {
      const c = LINES[pc], line = pc; pc++;
      if (!c) continue;
      if (each(c, line) === 'end') break;
      const call = c.match(/M97\s*P(\d+)(?:\s*L(\d+))?/);
      if (call && labelAt[call[1]] !== undefined) { stack.push({ back: pc, left: (+call[2] || 1) - 1, target: labelAt[call[1]] }); pc = labelAt[call[1]]; }
      if (/M99\b/.test(c) && stack.length) { const s = stack[stack.length - 1]; if (s.left > 0) { s.left--; pc = s.target; } else { pc = s.back; stack.pop(); } }
    }
  }
  function run() {
    const prog = []; let p = { ...HOME }, mode = 0, abs = true, comp = 40, feed = '', speed = '', spindle = '', tool = 0, cool = false;
    const st = () => ({ tool, feed, speed, spindle, cool, comp });
    walk((c, line) => {
      const w = words(c);
      if (/^O\d+/.test(c)) { prog.push({ kind: 'mark', line, to: p, ...st() }); return; }
      (w.G || []).forEach((g) => { if (g <= 3) mode = g; if (g === 90) abs = true; if (g === 91) abs = false; if (g === 40 || g === 41 || g === 42) comp = g; });
      if (w.T) tool = w.T[0];
      if (w.S) speed = 'S' + w.S[0];
      if (w.F) feed = 'F' + w.F[0];
      let stop = '';
      (w.M || []).forEach((m) => { if (m === 3) spindle = 'M03'; if (m === 5) spindle = ''; if (m === 8) cool = true; if (m === 9) cool = false; if (m === 30) stop = 'M30'; });
      if ((w.G || []).includes(28)) {
        const up = { ...p, z: HOME.z }; prog.push({ kind: 'rapid', line, from: p, pts: [up], to: up, ...st() }); p = up;
        prog.push({ kind: 'rapid', line, from: p, pts: [{ ...HOME }], to: { ...HOME }, ...st() }); p = { ...HOME };
        return;
      }
      if (w.X || w.Y || w.Z) {
        const v = (k, cur) => (w[k] ? (abs ? w[k][0] : cur + w[k][0]) : cur);
        const q = { x: v('X', p.x), y: v('Y', p.y), z: v('Z', p.z) };
        if (mode === 2 || mode === 3) prog.push({ kind: 'cut', line, from: p, pts: arcPts(p, q, w.R ? w.R[0] : 0, mode === 2), to: q, ...st() });
        else prog.push({ kind: mode === 0 ? 'rapid' : 'cut', line, from: p, pts: [q], to: q, ...st() });
        p = q;
      } else prog.push({ kind: 'mark', line, to: p, stop, ...st() });
      if (stop) return 'end';
    });
    return TR ? compensate(prog) : prog;
  }
  // Cutter radius compensation: G41 keeps the tool on the left of the path, G42 on the right, by the cutter radius.
  // The move that switches it on ends offset; the move with G40 starts offset; convex corners are rounded by the cutter.
  function compensate(prog) {
    const out = [];
    const nrm = (a, b, side) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; const s = side === 41 ? 1 : -1; return { x: -dy / d * TR * s, y: dx / d * TR * s }; };
    const off = (q, n) => ({ x: q.x + n.x, y: q.y + n.y, z: q.z });
    const planar = (m) => m.kind === 'cut' && Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) > 1e-6;
    let prevN = null, at = null;
    prog.forEach((m, i) => {
      if (m.kind === 'mark') { out.push(m); return; }
      if (m.comp === 40) {                                 // off, or the move that switches it off: ends on the programmed point
        out.push({ ...m, from: at || m.from }); at = m.to; prevN = null; return;
      }
      if (!planar(m)) { const q = prevN ? off(m.to, prevN) : m.to; out.push({ ...m, from: at || m.from, pts: [q], to: q }); at = q; return; }
      const ptsIn = [m.from, ...m.pts];
      if (!prevN) {                                        // the move that switches it on: aim at the offset start of the next cut
        const nx = prog.slice(i + 1).find(planar);
        const n = nx ? nrm(nx.from, nx.pts[0], m.comp) : nrm(ptsIn[0], ptsIn[1], m.comp);
        const q = off(m.to, n); out.push({ ...m, from: at || m.from, pts: [q], to: q }); at = q; prevN = n; return;
      }
      const res = [];
      for (let k = 1; k < ptsIn.length; k++) {
        const n = nrm(ptsIn[k - 1], ptsIn[k], m.comp);
        const cross = prevN.x * n.y - prevN.y * n.x, s = m.comp === 41 ? -1 : 1;
        if (cross * s > 1e-9) {                            // convex corner: go round it on the cutter radius
          const c = ptsIn[k - 1], a0 = Math.atan2(prevN.y, prevN.x); let a1 = Math.atan2(n.y, n.x);
          if (m.comp === 41) { while (a1 > a0) a1 -= 2 * Math.PI; } else { while (a1 < a0) a1 += 2 * Math.PI; }
          const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) * TR / 0.4));
          for (let j = 1; j <= steps; j++) { const t = a0 + (a1 - a0) * j / steps; res.push({ x: c.x + TR * Math.cos(t), y: c.y + TR * Math.sin(t), z: c.z }); }
        }
        res.push(off(ptsIn[k], n)); prevN = n;
      }
      const q = res[res.length - 1]; out.push({ ...m, from: at, pts: res, to: q }); at = q;
    });
    return out;
  }
  // straight pieces for playback
  const MOVES = [];
  run().forEach((m) => {
    if (m.kind === 'mark') { MOVES.push(m); return; }
    let a = m.from; m.pts.forEach((b) => { MOVES.push({ ...m, from: a, to: b }); a = b; });
  });
  const CUTLINES = new Set(MOVES.filter((m) => m.kind === 'cut' && Math.min(m.from.z, m.to.z) < 0 && Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) > 1e-6).map((m) => m.line));

  /* ---------- page parts ---------- */
  host.innerHTML = `
    <div class="sim-view" id="mill-view"><p class="sim-msg">Loading the simulation…</p></div>
    <div class="sim-bar" role="toolbar" aria-label="Simulation controls">
      <button type="button" class="sim-btn sim-play" aria-pressed="false">▶ Play</button>
      <button type="button" class="sim-btn sim-home" title="Back to the starting view – the program keeps running">⌖ View</button>
      <button type="button" class="sim-btn sim-reset" title="Start the program again">⟲ Reset</button>
      <label class="sim-speed">Speed <select><option value="1">1×</option><option value="3" selected>3×</option><option value="8">8×</option><option value="20">20×</option></select></label>
    </div>
    <div class="sim-dro" aria-live="off"><span>X <b class="d-x">–</b></span><span>Y <b class="d-y">–</b></span><span>Z <b class="d-z">–</b></span><span class="d-t">T–</span><span class="d-s"></span><span class="d-f"></span><span class="d-msg"></span></div>
    <div class="sim-cols">
      <ol class="sim-code" aria-label="CNC program – tap a cutting block to see it on the top view"></ol>
      <figure class="sim-prof"><svg class="sim-svg" aria-label="Top view of the plate – tap a line to find its block"></svg><figcaption>Top view – tap a line here or a block in the program</figcaption></figure>
    </div>`;
  pre.hidden = true;
  const $ = (s) => host.querySelector(s);
  const codeOl = $('.sim-code'), svg = $('.sim-svg');
  SRC.forEach((l, i) => {
    const li = document.createElement('li'); li.dataset.line = i; li.textContent = l || ' ';
    if (CUTLINES.has(i)) li.classList.add('is-seg');
    codeOl.appendChild(li);
  });
  const liAt = (i) => codeOl.children[i];

  /* top view: the plate and the programmed path (not the tool centre) of each cutting block, drawn once */
  {
    const pad = 4 + TR;
    svg.setAttribute('viewBox', `${-pad} ${-PH - pad} ${PW + 2 * pad} ${PH + 2 * pad}`);
    const seen = new Set(), parts = [];
    let mode = 0, abs = true, q = { ...HOME };
    walk((c, line) => {
      const w = words(c);
      (w.G || []).forEach((g) => { if (g <= 3) mode = g; if (g === 90) abs = true; if (g === 91) abs = false; });
      if ((w.G || []).includes(28)) { q = { ...HOME }; return; }
      if (w.X || w.Y || w.Z) {
        const v = (k, cur) => (w[k] ? (abs ? w[k][0] : cur + w[k][0]) : cur);
        const n = { x: v('X', q.x), y: v('Y', q.y), z: v('Z', q.z) };
        if (CUTLINES.has(line) && !seen.has(line) && Math.hypot(n.x - q.x, n.y - q.y) > 1e-6) {
          seen.add(line);
          const ps = mode === 2 || mode === 3 ? arcPts(q, n, w.R ? w.R[0] : 0, mode === 2) : [n];
          const d = `M${q.x} ${-q.y}` + ps.map((s) => ` L${s.x.toFixed(3)} ${(-s.y).toFixed(3)}`).join('');
          parts.push(`<path class="seg" data-line="${line}" d="${d}"/><path class="hit" data-line="${line}" d="${d}"/>`);
        }
        q = n;
      }
      if (/\bM30\b/.test(c)) return 'end';
    });
    svg.innerHTML = `<rect class="mirror" x="0" y="${-PH}" width="${PW}" height="${PH}"/>${parts.join('')}`;
    svg.style.setProperty('--sw', ((PW + 2 * pad) / 300).toFixed(3));
  }
  function pickSeg(line, scroll) {
    host.querySelectorAll('.sim-svg .seg.on, .sim-code li.picked').forEach((n) => n.classList.remove('on', 'picked'));
    svg.querySelectorAll(`.seg[data-line="${line}"]`).forEach((n) => n.classList.add('on'));
    const li = liAt(line); if (li) { li.classList.add('picked'); if (scroll) li.scrollIntoView({ block: 'nearest' }); }
  }
  codeOl.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li && li.classList.contains('is-seg')) pickSeg(+li.dataset.line, false); });
  svg.addEventListener('click', (e) => { const p = e.target.closest('[data-line]'); if (p) pickSeg(+p.dataset.line, true); });

  /* ---------- 3D (the shared three.js bundle) ---------- */
  function need3D(cb) {
    const ready = () => cb(window.THREE, window.THREEX);
    if (window.THREE && window.THREE.CylinderGeometry) return ready();
    const src = jsBase + 'vendor/three-bundle.min.js';
    let s = [...document.scripts].find((x) => x.src === new URL(src, location.href).href);
    if (!s) { s = document.createElement('script'); s.src = src; document.head.appendChild(s); }
    s.addEventListener('load', ready, { once: true });
    s.addEventListener('error', () => { $('.sim-msg').textContent = 'The simulation could not be loaded.'; }, { once: true });
  }
  const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); need3D(start); } }, { rootMargin: '300px' });
  io.observe(host);

  function start(T, X) {
    const view = $('#mill-view');
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
    renderer.domElement.addEventListener('webglcontextrestored', () => { lost.hidden = true; });
    lost.addEventListener('click', () => { lost.hidden = true; try { renderer.forceContextRestore(); } catch (e) { /* restored by the browser */ } });

    const scene = new T.Scene();
    scene.environment = new T.PMREMGenerator(renderer).fromScene(new X.RoomEnvironment(), 0.04).texture;
    scene.add(new T.HemisphereLight(0xffffff, 0x444444, 1.1));
    const dl = new T.DirectionalLight(0xffffff, 1.3); dl.position.set(40, 80, 60); scene.add(dl);
    // world: x = machine X, y = machine Z (up), z = -machine Y (machine Y goes away from us)
    const W = (q) => new T.Vector3(q.x, q.z, -q.y);
    const alu = new T.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.75, roughness: 0.35 });
    /* machine vise: the plate sits on two parallel blocks and is gripped between the fixed (back) and the moving (front) jaw */
    const zCut = Math.min(0, ...MOVES.filter((m) => m.kind === 'cut').map((m) => m.to.z));
    const PAR = 8, BASE = 16, JW = 12;                                 // parallel height, vise body height, jaw thickness
    const zPar = -PT - PAR, zBase = zPar - BASE, jawTop = Math.max(-PT + 1, Math.min(-3, zCut - 2));   // the work stands at least 3 mm above the jaws
    const box = (x0, x1, y0, y1, z0, z1, mat) => { const m = new T.Mesh(new T.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat); m.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2); scene.add(m); return m; };
    const viseM = new T.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.55, roughness: 0.45 });
    const jawM = new T.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.85, roughness: 0.3 });
    const parM = new T.MeshStandardMaterial({ color: 0xd2d6da, metalness: 0.9, roughness: 0.2 });
    const X0 = -12, X1 = PW + 12;
    box(X0, X1, -JW - 18, PH + JW + 6, zBase, zPar, viseM);                         // vise body
    box(X0, X1, PH, PH + JW, zPar, jawTop, jawM);                                     // fixed jaw (back)
    box(X0, X1, -JW, 0, zPar, jawTop, jawM);                                          // moving jaw (front)
    box(X0 + 8, X1 - 8, -JW - 16, -JW, zPar, zPar + 3, viseM);                        // moving jaw slide
    box(-4, PW + 4, 2, 7, zPar, -PT, parM); box(-4, PW + 4, PH - 7, PH - 2, zPar, -PT, parM);   // parallel blocks
    const screw = new T.Mesh(new T.CylinderGeometry(3, 3, 26, 20), jawM); screw.rotation.x = Math.PI / 2; screw.position.set(PW / 2, zPar - BASE / 2, JW + 18 + 13); scene.add(screw);
    const handle = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 44, 16), jawM); handle.rotation.z = Math.PI / 2; handle.position.set(PW / 2, zPar - BASE / 2, JW + 18 + 26); scene.add(handle);
    const tableM = new T.MeshStandardMaterial({ color: 0x3b4048, metalness: 0.5, roughness: 0.55 });
    const table = new T.Mesh(new T.BoxGeometry(PW + 120, 8, PH + 120), tableM); table.position.set(PW / 2, zBase - 4, -PH / 2 + 10); scene.add(table);
    const slotM = new T.MeshStandardMaterial({ color: 0x23262b, roughness: 0.8 });
    for (let k = -1; k <= 1; k++) { const s = new T.Mesh(new T.BoxGeometry(PW + 120, 0.4, 4), slotM); s.position.set(PW / 2, zBase + 0.01, -PH / 2 + 10 + k * 36); scene.add(s); }

    /* the work: a plain box for engraving; for an end mill a height map that the cutter lowers */
    const zMin = Math.min(0, ...MOVES.filter((m) => m.kind === 'cut').map((m) => m.to.z));
    let hf = null;
    if (END) {
      const bodyTop = zMin - 0.2;                          // below the deepest cut, so it never shows through the cut floor
      const body = new T.Mesh(new T.BoxGeometry(PW, PT + bodyTop, PH), alu); body.position.set(PW / 2, -PT + (PT + bodyTop) / 2, -PH / 2); scene.add(body);
      const C = Math.max(0.2, Math.max(PW, PH) / 250), nx = Math.round(PW / C), ny = Math.round(PH / C), cols = nx + 3, rows = ny + 3;
      const H = new Float32Array((nx + 1) * (ny + 1));
      const pos = new Float32Array(cols * rows * 3), idx = [];
      const gx = (i) => Math.min(Math.max(i - 1, 0), nx), gy = (j) => Math.min(Math.max(j - 1, 0), ny);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const k = (j * cols + i) * 3; pos[k] = gx(i) * C; pos[k + 2] = -gy(j) * C; }
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; idx.push(a, c, b, b, c, d); }
      const col = new Float32Array(cols * rows * 3).fill(1);
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setIndex(idx);   // under 65 536 points, so a 16-bit index works on every phone
      const mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.75, roughness: 0.35, side: 2, flatShading: true, vertexColors: true }));
      scene.add(mesh);                                    // flat shading: crisp machined walls
      hf = {
        reset() { H.fill(0); this.update(); },
        cut(x, y, z) {
          let hit = false; const i0 = Math.max(0, Math.floor((x - TR) / C)), i1 = Math.min(nx, Math.ceil((x + TR) / C));
          const j0 = Math.max(0, Math.floor((y - TR) / C)), j1 = Math.min(ny, Math.ceil((y + TR) / C));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            if ((i * C - x) ** 2 + (j * C - y) ** 2 > TR * TR) continue;
            const k = j * (nx + 1) + i; if (H[k] > z) { H[k] = z; hit = true; }
          }
          return hit;
        },
        update() {
          for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const edge = i === 0 || j === 0 || i === cols - 1 || j === rows - 1;
            const h = edge ? bodyTop : H[gy(j) * (nx + 1) + gx(i)], k = (j * cols + i) * 3;
            pos[k + 1] = h;
            const c = h < -1e-4 ? 0.78 : 1; col[k] = c; col[k + 1] = c; col[k + 2] = c * 1.02;   // machined floor a little darker
          }
          geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
        },
      };
      hf.reset();
    } else {
      const plate = new T.Mesh(new T.BoxGeometry(PW, PT, PH), alu); plate.position.set(PW / 2, -PT / 2, -PH / 2); scene.add(plate);
    }

    /* tools */
    const tool = new T.Group(); scene.add(tool);
    const steelM = new T.MeshStandardMaterial({ color: 0xb9bfc6, metalness: 0.9, roughness: 0.3, side: 2 });
    let topY;
    if (END) {
      // end mill Ø10 × 30 flute length × 75 long, four flutes: the fluted part is coated (coffee colour), with four
      // helical flutes running up from the four cutting edges on the end face; a bright shank above
      const coatM = new T.MeshStandardMaterial({ color: 0x7a5232, metalness: 0.75, roughness: 0.3 });
      const fluteM = new T.MeshStandardMaterial({ color: 0x3a2516, metalness: 0.6, roughness: 0.5 });
      const FL = 30, SH = 45, STEPS = 40, TURN = Math.PI * 0.9;            // the flutes turn about half a turn over the flute length
      const core = new T.Mesh(new T.CylinderGeometry(TR * 0.98, TR * 0.98, FL, 40), coatM); core.position.y = FL / 2; tool.add(core);
      for (let f = 0; f < 4; f++) for (let s = 0; s < STEPS; s++) {
        const a = f * Math.PI / 2 + s / STEPS * TURN, y = (s + 0.5) * FL / STEPS;
        const g = new T.Mesh(new T.BoxGeometry(TR * 0.42, FL / STEPS + 0.12, TR * 0.55), fluteM);
        g.position.set(Math.cos(a) * TR * 0.82, y, Math.sin(a) * TR * 0.82); g.rotation.y = -a; tool.add(g);
      }
      for (let f = 0; f < 4; f++) {                                       // the four cutting edges on the end face
        const edge = new T.Mesh(new T.BoxGeometry(TR * 0.95, 0.25, 0.5), coatM);
        edge.position.y = 0.1; edge.rotation.y = f * Math.PI / 2; edge.translateX(TR * 0.48); tool.add(edge);
      }
      const shank = new T.Mesh(new T.CylinderGeometry(TR, TR, SH, 40), steelM); shank.position.y = FL + SH / 2; tool.add(shank);
      topY = FL + SH;
    } else {
      // engraving tool (single flute): a round shank ground to a half (D shape) near the end, running into a sharp point
      const faceM = new T.MeshStandardMaterial({ color: 0xe3e7eb, metalness: 0.95, roughness: 0.15, side: 2 });
      const R = 1.6, TIP = 4.5, FLAT = 7;
      const cone = new T.Mesh(new T.CylinderGeometry(R, 0.02, TIP, 24, 1, true, 0, Math.PI), steelM); cone.position.y = TIP / 2; tool.add(cone);
      const half = new T.Mesh(new T.CylinderGeometry(R, R, FLAT, 24, 1, true, 0, Math.PI), steelM); half.position.y = TIP + FLAT / 2; tool.add(half);
      const tri = new T.Shape(); tri.moveTo(-R, TIP); tri.lineTo(R, TIP); tri.lineTo(0, 0); tri.lineTo(-R, TIP);
      tool.add(new T.Mesh(new T.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false }), faceM));
      const flat = new T.Mesh(new T.BoxGeometry(2 * R, FLAT, 0.02), faceM); flat.position.y = TIP + FLAT / 2; tool.add(flat);
      const shank = new T.Mesh(new T.CylinderGeometry(R, R, 20, 24), steelM); shank.position.y = TIP + FLAT + 10; tool.add(shank);
      topY = TIP + FLAT + 20;
    }
    const nose = new T.Mesh(new T.CylinderGeometry(9 + TR, 9 + TR, 18, 32), new T.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.6, roughness: 0.4 }));
    nose.position.y = topY + 9; tool.add(nose);

    // engraving: a thin dark strip on the top face, grown as the tool cuts
    const lineM = new T.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9, metalness: 0.1 });
    const strip = new T.Mesh(new T.BufferGeometry(), lineM); scene.add(strip);
    const pts = [];
    function rebuildStrip() {
      const pos = [], half = 0.45, y = 0.03;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i]; if (!a || !b) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy); if (d < 1e-6) continue;
        const nx = -dy / d * half, ny = dx / d * half;
        const A = [a[0] + nx, y, -(a[1] + ny)], B = [a[0] - nx, y, -(a[1] - ny)], Cc = [b[0] + nx, y, -(b[1] + ny)], D = [b[0] - nx, y, -(b[1] - ny)];
        pos.push(...A, ...B, ...Cc, ...Cc, ...B, ...D);
      }
      strip.geometry.dispose(); strip.geometry = new T.BufferGeometry();
      strip.geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); strip.geometry.computeVertexNormals();
    }
    // path lines: rapids dashed, feed moves solid (the tool centre)
    const rapM = new T.LineDashedMaterial({ color: 0x9aa3ad, dashSize: 2, gapSize: 1.5 });
    const feedM = new T.LineBasicMaterial({ color: 0xd9a383 });
    const rapG = new T.BufferGeometry(), feedG = new T.BufferGeometry();
    const rapL = new T.LineSegments(rapG, rapM), feedL = new T.LineSegments(feedG, feedM); scene.add(rapL, feedL);
    const rap = [], fed = [];
    function flushPaths() {
      rapG.setAttribute('position', new T.Float32BufferAttribute(rap, 3)); rapL.computeLineDistances();
      feedG.setAttribute('position', new T.Float32BufferAttribute(fed, 3));
    }

    const camera = new T.PerspectiveCamera(32, 1, 0.5, 3000);
    const sc = Math.max(PW, PH) / 70;
    camera.position.set(PW / 2 + 70 * sc, 120 * sc, 140 * sc);
    const controls = new X.OrbitControls(camera, renderer.domElement);
    controls.target.set(PW / 2, 0, -PH / 2); controls.enableDamping = true; controls.update(); controls.saveState();

    /* playback */
    const dro = { x: $('.d-x'), y: $('.d-y'), z: $('.d-z'), t: $('.d-t'), s: $('.d-s'), f: $('.d-f'), m: $('.d-msg') };
    let idx = 0, along = 0, playing = false, speedF = 3, last = 0, cur = { ...HOME }, curLine = -1, spinOn = false, dirty = false;
    function showLine(l) {
      if (l === curLine) return; curLine = l;
      codeOl.querySelectorAll('li.run').forEach((n) => n.classList.remove('run'));
      svg.querySelectorAll('.seg.run').forEach((n) => n.classList.remove('run'));
      const li = liAt(l); if (li) { li.classList.add('run'); const top = li.offsetTop; if (top < codeOl.scrollTop || top > codeOl.scrollTop + codeOl.clientHeight - 30) codeOl.scrollTop = top - codeOl.clientHeight / 3; }
      svg.querySelectorAll(`.seg[data-line="${l}"]`).forEach((n) => n.classList.add('run'));
    }
    function place(m, q) {
      tool.position.copy(W(q)); tool.visible = !!m.tool;
      dro.x.textContent = q.x.toFixed(3); dro.y.textContent = q.y.toFixed(3); dro.z.textContent = q.z.toFixed(3);
      dro.t.textContent = m.tool ? `T${m.tool}` + (m.comp && m.comp !== 40 ? ` G${m.comp} D01` : '') : 'T–';
      dro.s.textContent = m.speed + (m.spindle ? ' ' + m.spindle : '') + (m.cool ? ' M08' : '');
      dro.f.textContent = m.kind === 'rapid' ? 'G00 rapid' : m.feed; spinOn = !!m.spindle;
    }
    function reset() {
      idx = 0; along = 0; playing = false; cur = { ...HOME }; curLine = -1; spinOn = false;
      pts.length = 0; rebuildStrip(); rap.length = 0; fed.length = 0; flushPaths(); if (hf) hf.reset();
      $('.sim-play').textContent = '▶ Play'; $('.sim-play').setAttribute('aria-pressed', 'false'); dro.m.textContent = '';
      place(MOVES[0] || {}, cur); showLine(MOVES[0] ? MOVES[0].line : 0);
    }
    function advance(dist) {
      while (dist > 0 && idx < MOVES.length) {
        const m = MOVES[idx]; showLine(m.line);
        if (m.kind === 'mark') { place(m, m.to); idx++; if (m.stop === 'M30') { dro.m.textContent = 'M30 – program end'; return 'end'; } continue; }
        const L = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y, m.to.z - m.from.z), v = m.kind === 'rapid' ? 8 : 1;
        const go = Math.min(dist, (L - along) / v); dist -= go; const prev = along; along += go * v;
        const t0 = L ? prev / L : 1, t1 = L ? Math.min(along / L, 1) : 1;
        const at = (t) => ({ x: m.from.x + (m.to.x - m.from.x) * t, y: m.from.y + (m.to.y - m.from.y) * t, z: m.from.z + (m.to.z - m.from.z) * t });
        const a = at(t0); cur = at(t1);
        (m.kind === 'rapid' ? rap : fed).push(...W(a).toArray(), ...W(cur).toArray());
        if (m.kind === 'cut' && cur.z < 0) {
          if (hf) {
            const n = Math.max(1, Math.ceil(Math.hypot(cur.x - a.x, cur.y - a.y) / 0.1));
            for (let k = 1; k <= n; k++) { const s = at(t0 + (t1 - t0) * k / n); if (hf.cut(s.x, s.y, s.z)) dirty = true; }
          } else {
            if (!(pts.length && pts[pts.length - 1] && Math.hypot(pts[pts.length - 1][0] - a.x, pts[pts.length - 1][1] - a.y) < 1e-6)) pts.push(null, [a.x, a.y]);
            pts.push([cur.x, cur.y]); dirty = true;
          }
        }
        place(m, cur);
        if (along >= L - 1e-9) { idx++; along = 0; }
      }
      flushPaths();
      return idx >= MOVES.length ? 'end' : '';
    }
    function setPlay(on) { playing = on; $('.sim-play').textContent = on ? '❚❚ Pause' : '▶ Play'; $('.sim-play').setAttribute('aria-pressed', String(on)); }
    $('.sim-play').addEventListener('click', () => { if (idx >= MOVES.length) reset(); setPlay(!playing); if (playing) dro.m.textContent = ''; });
    $('.sim-home').addEventListener('click', () => controls.reset());
    $('.sim-reset').addEventListener('click', () => { reset(); controls.reset(); });
    $('.sim-speed select').addEventListener('change', (e) => { speedF = +e.target.value; });

    function size() { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(size).observe(view); size();
    reset();
    let lastBuild = 0;
    new IntersectionObserver((en) => { renderer.setAnimationLoop(en[0].isIntersecting ? loop : null); last = 0; }).observe(view);
    function loop(now) {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now;
      if (playing) { const r = advance(dt * 10 * speedF); if (r === 'end') setPlay(false); }   // 10 mm/s of feed at 1×, rapids 8× faster
      if (dirty && now - lastBuild > 90) { if (hf) hf.update(); else rebuildStrip(); dirty = false; lastBuild = now; }
      if (spinOn) tool.rotation.y += dt * 30;
      controls.update(); renderer.render(scene, camera);
    }
  }
})();
