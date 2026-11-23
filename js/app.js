/* Mechanical Workshop – app.js: menu, banner slideshow, ads, lazy 3D viewer */
(function () {
  "use strict";
  var jsBase = (document.currentScript && document.currentScript.src || "").replace(/[^/]*$/, "");

  /* ---------- Menu ---------- */
  var btn = document.querySelector(".menu-btn");
  var menu = document.getElementById("menu");
  if (btn && menu) {
    var setOpen = function (open) {
      btn.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
    };
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(menu.hidden);
    });
    document.addEventListener("click", function (e) {
      if (!menu.hidden && !menu.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { setOpen(false); btn.focus(); }
    });
  }

  /* ---------- Banner slideshow ---------- */
  var slides = document.querySelectorAll(".banner img");
  var dots = document.querySelectorAll(".banner .dot");
  if (slides.length > 1) {
    var current = 0, timer = null;
    var show = function (n) {
      slides[current].classList.remove("on");
      if (dots[current]) dots[current].setAttribute("aria-current", "false");
      current = (n + slides.length) % slides.length;
      slides[current].classList.add("on");
      if (dots[current]) dots[current].setAttribute("aria-current", "true");
    };
    // runs only while the banner is on screen and the tab is visible
    var onScreen = true;
    var start = function () {
      clearInterval(timer); timer = null;
      if (onScreen && !document.hidden) timer = setInterval(function () { show(current + 1); }, 3000);
    };
    Array.prototype.forEach.call(dots, function (dot, i) {
      dot.addEventListener("click", function () { show(i); start(); });
    });
    document.addEventListener("visibilitychange", start);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting; start();
      }).observe(document.querySelector(".banner"));
    }
    start();
  }

  /* ---------- Google AdSense ----------
     Create the ad units in AdSense (Ads > By ad unit > Display ads, "Responsive")
     and paste each data-ad-slot number below. Empty slot = that ad space is removed. */
  var ADS = {
    client: "ca-pub-7727895345119500",
    // Student site: ask Google for its under-18 ("teen") ad treatment on every request.
    // 0 = none, 1 = child, 2 = teen. Content blocking itself is set in AdSense > Brand safety.
    ageTreatment: "2",
    slots: {
      article: "1281073793",   // job pages: between content sections
      end: "6888623694",       // job pages: after Resources
      home: "7710750771"       // home page: after the job cards
    }
  };
  var preview = document.documentElement.hasAttribute("data-ad-preview");
  Array.prototype.forEach.call(document.querySelectorAll(".ad[data-ad]"), function (box) {
    var slot = ADS.slots[box.getAttribute("data-ad")];
    if (preview) { box.classList.add("ad-preview"); return; }
    if (!slot) { box.remove(); return; }
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", ADS.client);
    ins.setAttribute("data-ad-slot", slot);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    ins.setAttribute("data-tag-for-age-treatment", ADS.ageTreatment);
    box.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { box.remove(); }
    // Ad blocked or script failed: no status and no ad frame after 8 s -> remove the empty space
    setTimeout(function () {
      if (!ins.getAttribute("data-ad-status") && !ins.querySelector("iframe")) box.remove();
    }, 8000);
  });

  /* ---------- Pneumatics lab (iframe): Full screen and Reset ---------- */
  var labBox = document.getElementById("lab-box");
  var lab = document.getElementById("lab");
  if (labBox && lab) {
    var enterFull = function () {
      labBox.classList.add("max");
      document.documentElement.classList.add("lab-open");
      try { var p = labBox.requestFullscreen && labBox.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    };
    var exitFull = function () {
      labBox.classList.remove("max");
      document.documentElement.classList.remove("lab-open");
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    };
    document.getElementById("btn-lab-full").addEventListener("click", enterFull);
    document.getElementById("btn-lab-exit").addEventListener("click", exitFull);
    document.getElementById("btn-lab-reset").addEventListener("click", function () {
      lab.contentWindow.postMessage({ type: "lab-reset" }, "*");
    });
    document.addEventListener("fullscreenchange", function () {
      if (!document.fullscreenElement && labBox.classList.contains("max")) exitFull();
    });
  }

  /* ---------- 3D viewer: load Three.js only when the model scrolls near ---------- */
  var scene = document.getElementById("viewer");
  if (!scene) return;

  var scripts = ["vendor/three-bundle.min.js", "viewer.js"].map(function (f) { return jsBase + f; });

  function loadSequential(list, done, fail) {
    if (!list.length) return done();
    var s = document.createElement("script");
    s.src = list[0];
    s.onload = function () { loadSequential(list.slice(1), done, fail); };
    s.onerror = fail;
    document.head.appendChild(s);
  }

  var started = false;
  function boot() {
    if (started) return;
    started = true;
    var msg = document.getElementById("viewer-msg");
    loadSequential(scripts, function () {
      if (window.initViewer) window.initViewer(jsBase);
    }, function () {
      if (msg) msg.textContent = "3D viewer could not be loaded.";
      var st = document.getElementById("viewer-status");
      if (st) st.classList.add("error");
    });
  }

  // Start after the page itself has finished loading (keeps the first paint fast),
  // and only once the 3D area is close to the screen.
  function whenIdle(fn) {
    var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(fn, { timeout: 2000 }); };
    if (document.readyState === "complete") go(); else window.addEventListener("load", go);
  }
  whenIdle(function () {
    if (!("IntersectionObserver" in window)) return boot();
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); boot(); }
    }, { rootMargin: "400px 0px" });
    io.observe(scene);
  });
})();
