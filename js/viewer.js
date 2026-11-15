/* Mechanical Workshop – 3D model viewer (Three.js r112), started by app.js.
   Renders only when something changes: a short auto-rotation, user drag/zoom, resize.
   Nothing runs while the model is off-screen or the model is still. */
window.initViewer = function (container, jsBase) {
  "use strict";
  var ROTATE_MS = 12000;           // auto-rotate this long after the model appears / Reset View

  container.innerHTML = "";
  var status = document.createElement("div");
  status.className = "model-status";
  status.textContent = "Loading 3D model…";
  container.appendChild(status);
  var setStatus = function (t) { status.textContent = t; status.style.display = t ? "flex" : "none"; };

  if (!window.THREE || !THREE.GLTFLoader) { setStatus("3D viewer could not be loaded."); return; }

  var width = container.clientWidth || 600, height = container.clientHeight || 400;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 5000);
  scene.add(new THREE.AmbientLight(0x404040, 2));
  var key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(20, 20, 50); scene.add(key);
  var fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-30, -10, -40); scene.add(fill);

  var renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { setStatus("Your browser does not support 3D (WebGL)."); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 600 ? 1.5 : 2));
  renderer.setSize(width, height);
  container.insertBefore(renderer.domElement, status);

  /* ---- on-demand render loop ---- */
  var running = false, visible = true, interacting = false, settleUntil = 0, rotateUntil = 0, controls = null;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    var now = performance.now(), moved = false;
    if (controls) {
      if (controls.autoRotate && now > rotateUntil) controls.autoRotate = false;
      moved = controls.update();                     // true while damping is still moving the camera
    }
    renderer.render(scene, camera);
    // stop when nothing is moving any more (or the short settle time is over)
    if (!(controls && controls.autoRotate) && !interacting && (!moved || now > settleUntil)) running = false;
  }
  function wake(ms) {
    settleUntil = Math.max(settleUntil, performance.now() + (ms || 300));
    if (!running && visible) { running = true; requestAnimationFrame(frame); }
  }
  function startRotation() {
    if (!controls) return;
    controls.autoRotate = true;
    rotateUntil = performance.now() + ROTATE_MS;
    wake();
  }

  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.autoRotateSpeed = 2.0;
    controls.addEventListener("start", function () { interacting = true; controls.autoRotate = false; wake(); });
    controls.addEventListener("end", function () { interacting = false; wake(1000); });   // let damping settle
    controls.addEventListener("change", function () { if (!running) wake(); });   // e.g. mouse-wheel zoom
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) wake(); else running = false;
    }).observe(container);
  }

  /* ---- load the model ---- */
  var loader = new THREE.GLTFLoader();
  if (THREE.DRACOLoader) {
    var draco = new THREE.DRACOLoader();
    draco.setDecoderPath(jsBase + "vendor/draco/");
    if (container.getAttribute("data-draco-type") === "js") draco.setDecoderConfig({ type: "js" });
    loader.setDRACOLoader(draco);
  }

  loader.load(container.getAttribute("data-model"), function (gltf) {
    var model = gltf.scene;
    scene.add(model);
    var box = new THREE.Box3().setFromObject(model);
    var size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    var dist = (maxDim / 2) / Math.tan((camera.fov * Math.PI) / 360) * 1.6;
    camera.position.set(dist * 0.6, dist * 0.4, dist * 0.7).setLength(dist);
    camera.near = dist / 100; camera.far = dist * 100;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    if (controls) { controls.minDistance = dist * 0.3; controls.maxDistance = dist * 4; controls.update(); }

    var home = camera.position.clone();
    var reset = document.querySelector("[data-reset-view]");
    if (reset) reset.addEventListener("click", function () {
      camera.position.copy(home); camera.lookAt(0, 0, 0);
      if (controls) controls.target.set(0, 0, 0);
      startRotation();
    });

    setStatus("");
    var hint = document.createElement("div");
    hint.className = "model-hint";
    hint.textContent = "Drag to rotate · Pinch / scroll to zoom";
    container.appendChild(hint);
    wake();                                            // draw the model once
    // Auto-rotate once the visitor is active on the page (scroll, touch, mouse, key):
    // nothing spins in the background for a tab nobody is looking at.
    var events = ["pointerdown", "pointermove", "wheel", "scroll", "touchstart", "keydown"];
    var go = function () {
      events.forEach(function (ev) { window.removeEventListener(ev, go, true); });
      startRotation();
    };
    events.forEach(function (ev) { window.addEventListener(ev, go, { capture: true, passive: true }); });
  }, function (xhr) {
    if (xhr && xhr.total) setStatus("Loading 3D model… " + Math.round(xhr.loaded / xhr.total * 100) + "%");
  }, function (err) {
    console.error("3D model load error:", err);
    setStatus("Unable to load the 3D model.");
  });

  window.addEventListener("resize", function () {
    var w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    wake();
  });
};
