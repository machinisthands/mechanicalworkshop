/* EDM Scooter: 3D view of the parameter-experiment plate.
   A bar or plate (sizes from the figure); the wire cuts across it and one piece comes off each time.
   Uses the shared three.js bundle; if WebGL is not available the drawing in the figure stays. */
(function () {
  const figs = document.querySelectorAll('[data-edm-plate]');
  if (!figs.length) return;
  const jsBase = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');

  function need3D(cb) {
    if (window.THREE && window.THREE.BoxGeometry && window.THREEX) return cb(window.THREE, window.THREEX);
    const src = jsBase + 'vendor/three-bundle.min.js';
    let s = [...document.scripts].find((x) => x.src === new URL(src, location.href).href);
    if (!s) { s = document.createElement('script'); s.src = src; document.head.appendChild(s); }
    s.addEventListener('load', () => cb(window.THREE, window.THREEX), { once: true });
  }

  function start(fig, T, X) {
    const host = document.createElement('div');
    host.className = 'edm-3d';
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }  // keep the drawing
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.appendChild(renderer.domElement);
    const svg = fig.querySelector('svg');
    if (svg) svg.style.display = 'none';
    fig.insertBefore(host, fig.firstChild);

    const scene = new T.Scene();
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new X.RoomEnvironment(), 0.04).texture;
    scene.add(new T.HemisphereLight(0xffffff, 0x444444, 0.6));
    const sun = new T.DirectionalLight(0xffffff, 1.2); sun.position.set(30, 50, 40); scene.add(sun);

    // sizes from the figure (mm): data-edm-plate="width thickness piece count"; x = length, y = thickness, z = width
    const [W, TH, P, N] = (fig.dataset.edmPlate || '10 10 5 4').split(' ').map(Number);
    const LEN = N * P + Math.max(15, 3 * P);
    const steel = new T.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.85, roughness: 0.32 });
    const box = (x0, x1, m) => { const g = new T.BoxGeometry(x1 - x0, TH, W); const o = new T.Mesh(g, m); o.position.set((x0 + x1) / 2 - LEN / 2, 0, 0); return o; };
    const plate = new T.Group(); scene.add(plate);
    const rest = box(0, LEN - N * P, steel); plate.add(rest);
    const pieces = [];
    for (let k = 0; k < N; k++) { const pc = box(LEN - (k + 1) * P, LEN - k * P, steel); pc.userData.x0 = pc.position.x; plate.add(pc); pieces.push(pc); }

    // the wire: a thin brass line through the thickness, with its two guides
    const wire = new T.Group(); plate.add(wire);
    wire.add(new T.Mesh(new T.CylinderGeometry(0.12, 0.12, TH + 16, 8), new T.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.7, roughness: 0.3 })));
    const guideM = new T.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.4, roughness: 0.5 });
    [1, -1].forEach((s) => { const g = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 3, 16), guideM); g.position.y = s * (TH / 2 + 6.5); wire.add(g); });

    // the slot the wire leaves behind: grows with the wire, so the cut is seen before the piece comes off
    const kerfM = new T.MeshStandardMaterial({ color: 0x141416, roughness: 0.9, metalness: 0 });
    const kerfs = [];
    for (let k = 0; k < N; k++) {
      const g = new T.BoxGeometry(0.35, TH + 0.04, 1); g.translate(0, 0, -0.5);   // grows from the near edge
      const m = new T.Mesh(g, kerfM); m.position.set(LEN / 2 - (k + 1) * P, 0, W / 2); m.scale.z = 0.0001; plate.add(m); kerfs.push(m);
    }
    // the size of one piece, shown once it is off
    const tag = document.createElement('div'); tag.className = 'edm-3d-tag'; tag.textContent = W + ' × ' + TH + ' × ' + P + ' mm'; host.appendChild(tag);

    const camera = new T.PerspectiveCamera(32, 16 / 9, 1, 500);
    const sc = Math.max(LEN, W * 1.6) / 40;
    camera.position.set(38 * sc, 46 * sc, 66 * sc);
    const controls = new X.OrbitControls(camera, renderer.domElement);
    controls.target.set(6 * sc, 0, 0); controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 20; controls.maxDistance = 200; controls.update();

    function size() {
      const w = host.clientWidth, h = Math.round(w * (w < 560 ? 0.75 : 0.5));
      renderer.setSize(w, h, false); renderer.domElement.style.height = h + 'px';
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    size(); window.addEventListener('resize', size);

    // timeline: for each piece the wire crosses the width (2 s), then the piece moves away (0.8 s)
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CROSS = 3.2, MOVE = 0.9, STEP = CROSS + MOVE, HOLD = 3;
    const gap = Math.max(1.2, P / 2), shift = (k) => gap * (N - k);                       // final gap of 2 mm between pieces
    function pose(t) {
      for (let k = 0; k < N; k++) {
        const tk = t - k * STEP - CROSS;
        const off = shift(k) * Math.min(1, Math.max(0, tk / MOVE));
        pieces[k].position.x = pieces[k].userData.x0 + off;
        const cutU = Math.min(1, Math.max(0, (t - k * STEP) / CROSS));
        kerfs[k].scale.z = Math.max(0.0001, Math.min(W, (W + 2) * cutU - 1));
        kerfs[k].visible = cutU > 0 && tk < 0;               // once the piece is off the slot is the gap itself
      }
      const k = Math.min(N - 1, Math.floor(t / STEP)), u = t - k * STEP;
      wire.visible = t < N * STEP;
      wire.position.x = LEN / 2 - (k + 1) * P;
      wire.position.z = W / 2 + 1 - Math.min(1, u / CROSS) * (W + 2);
      // label on the first piece once it has come off
      const v = Math.min(1, Math.max(0, (t - CROSS - MOVE) / 0.4));
      tag.style.opacity = v;
      if (v > 0) {
        const p = new T.Vector3(pieces[0].position.x, TH / 2 + 1, 0).project(camera);
        const hw = tag.offsetWidth / 2 + 6; tag.style.left = Math.min(host.clientWidth - hw, Math.max(hw, (p.x + 1) / 2 * host.clientWidth)) + 'px';
        tag.style.top = ((1 - p.y) / 2 * host.clientHeight) + 'px';
      }
    }
    let t = still ? N * STEP : 0, last = performance.now(), on = true;
    new IntersectionObserver((e) => { on = e[0].isIntersecting; last = performance.now(); }).observe(host);
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!on) return;
      if (!still) { t += Math.min(0.05, (now - last) / 1000); if (t > N * STEP + HOLD) t = 0; }
      last = now; pose(t); controls.update(); renderer.render(scene, camera);
    })(last);
  }

  // load three.js only when the figure comes near the screen
  figs.forEach((fig) => new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); need3D((T, X) => start(fig, T, X)); } }, { rootMargin: '300px' }).observe(fig));
})();
