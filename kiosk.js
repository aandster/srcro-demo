// Stand screen mode for Explore Scenarios (Jordan, 2026-11-01), started by explore.html?kiosk=1.
// After a quiet spell the page plays itself: a random scenario, a fleet from a fixed sequence, the replay to
// the last day, a short hold on the end figures, then the next scenario. Any touch, pointer or key press
// hands the page back. The page's own controls do the work (scenario list, fleet buttons, run slider, Play,
// speed button), so nothing here reaches into app.js. Without ?kiosk=1 this file does nothing at all.
// window.SRCRO_KIOSK_FAST shortens every wait, for the browser check only.
(function () {
  "use strict";
  if (!/[?&]kiosk=1(&|$)/.test(location.search)) return;

  var FAST = !!window.SRCRO_KIOSK_FAST;
  var IDLE_MS = FAST ? 1500 : 90000;         // quiet time before attract mode
  var HOLD_MS = FAST ? 400 : 4000;           // pause on the end of run figures
  var CAP_MS = FAST ? 3000 : 240000;         // longest a replay may take before it is moved to its end
  var POLL_MS = FAST ? 100 : 500;
  var FLEETS = [1, 2, 1, 3, 0];              // electric trucks of four, in this order
  var PAGE = "https://srcro.aandster.me/";
  var CAPTION = "Seeing Reuse: Collection Routing Optimisation. Distance-only planning on the left, emissions-aware on the right. Touch anything to explore.";

  function $(s) { return document.querySelector(s); }

  var attract = false, cycleNo = 0, timers = [], idleTimer = null, lastActivity = Date.now();
  var lastX = null, lastY = null, shield = null, strip = null, nowLine = null;
  var savedSpeed = null, lock = null;

  function later(fn, ms) {
    var id = setTimeout(function () {
      var i = timers.indexOf(id);
      if (i >= 0) timers.splice(i, 1);
      fn();
    }, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---- page controls
  function ready() {
    var sel = $("#plan"), fb = $("#fleet-buttons"), k = $("#kpi-distance");
    return !!(sel && !sel.disabled && fb && fb.children.length && k && k.children.length);
  }
  function playPressed() { var p = $("#play"); return !!p && p.getAttribute("aria-pressed") === "true"; }
  function setRun(v) {
    var r = $("#run");
    if (!r) return;
    r.value = String(v);
    r.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function setSpeedFour() {
    var sp = $("#speed");
    if (!sp) return;
    if (savedSpeed === null) savedSpeed = sp.textContent;
    for (var k = 0; k < 4 && sp.textContent.trim() !== "4×"; k++) sp.click();
  }
  function restoreSpeed() {
    var sp = $("#speed");
    if (sp && savedSpeed !== null) for (var k = 0; k < 4 && sp.textContent !== savedSpeed; k++) sp.click();
    savedSpeed = null;
  }

  // ---- wake lock, so the screen stays on while attract mode runs. Failure is ignored.
  function takeLock() {
    try {
      if (!navigator.wakeLock || lock) return;
      navigator.wakeLock.request("screen").then(function (s) {
        if (!attract) { try { s.release(); } catch (e) { /* already released */ } return; }
        lock = s;
        if (s.addEventListener) s.addEventListener("release", function () { if (lock === s) lock = null; });
      }).catch(function () { /* not allowed here, carry on */ });
    } catch (e) { /* no wake lock in this browser */ }
  }
  function dropLock() {
    var s = lock;
    lock = null;
    try { if (s) s.release().catch(function () {}); } catch (e) { /* ignore */ }
  }

  // ---- the caption strip
  function drawQr(box) {
    function draw() {
      if (!window.qrcode) { box.textContent = PAGE; return; }
      var qr = window.qrcode(0, "M");
      qr.addData(PAGE);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true });
    }
    if (window.qrcode) return draw();
    var s = document.createElement("script");
    s.src = "vendor/qrcode.js";
    s.onload = draw;
    s.onerror = function () { box.textContent = PAGE; };
    document.head.appendChild(s);
  }

  function build() {
    strip = document.createElement("div");
    strip.className = "kiosk-strip";
    strip.innerHTML =
      '<div class="kiosk-text"><p class="kiosk-caption"></p><p class="kiosk-now"></p></div>' +
      '<div class="kiosk-qr"><div class="kiosk-qrbox" role="img" aria-label="QR code for ' + PAGE + '"></div>' +
      '<p class="kiosk-url">srcro.aandster.me</p></div>';
    strip.querySelector(".kiosk-caption").textContent = CAPTION;
    nowLine = strip.querySelector(".kiosk-now");
    document.body.appendChild(strip);
    drawQr(strip.querySelector(".kiosk-qrbox"));

  }

  // ---- attract mode
  function pickSeed() {
    var idx = window.SRCRO_SEED_INDEX, list = [], i;
    if (idx && idx.length) for (i = 0; i < idx.length; i++) list.push(idx[i].seed);
    else for (i = 1; i <= 90; i++) list.push(i);
    var cur = $("#plan") ? $("#plan").value : "";
    list = list.filter(function (n) { return "seed:" + n !== cur; });
    return list[Math.floor(Math.random() * list.length)];
  }

  function enter() {
    if (attract) return;
    attract = true;
    clearTimeout(idleTimer);
    document.documentElement.classList.add("kiosk-attract");
    document.body.classList.add("kiosk-attract");
    shield = document.createElement("div");
    shield.className = "kiosk-shield";
    document.body.appendChild(shield);
    window.scrollTo(0, 0);
    takeLock();
    cycle();
  }

  function leave(swallow) {
    if (!attract) return;
    attract = false;
    clearTimers();
    if (playPressed()) $("#play").click();
    restoreSpeed();
    dropLock();
    document.documentElement.classList.remove("kiosk-attract");
    document.body.classList.remove("kiosk-attract");
    // The press that ended attract mode must not land on a control, so the shield stays a moment longer.
    var s = shield;
    shield = null;
    if (s) {
      if (swallow) later(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 400);
      else if (s.parentNode) s.parentNode.removeChild(s);
    }
    setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 50);
    touch();
  }

  function cycle() {
    if (!attract) return;
    var seed = pickSeed(), fleet = FLEETS[cycleNo % FLEETS.length];
    cycleNo++;
    var sel = $("#plan");
    if (!sel) return;
    sel.value = "seed:" + seed;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    var tries = 0;
    (function wait() {
      if (!attract) return;
      if (!(ready() && $("#plan").value === "seed:" + seed)) {
        if (++tries > 200) return later(cycle, 1000);   // a seed that will not load, try another
        return later(wait, 100);
      }
      var b = $('#fleet-buttons [data-fleet="' + fleet + '"]');
      if (b && !b.disabled && b.getAttribute("aria-pressed") !== "true") b.click();
      var both = $('input[name="mapview"][value="both"]');
      if (both) { both.checked = true; both.dispatchEvent(new Event("change", { bubbles: true })); }
      nowLine.textContent = "Scenario seed " + seed + ", " + fleet + " of 4 trucks electric. One illustrative run, not a result.";
      later(replay, 300);
    })();
  }

  function replay() {
    if (!attract) return;
    setSpeedFour();
    setRun(0);
    if (!playPressed()) $("#play").click();
    var t0 = Date.now(), sawPlay = false, jumped = false;
    (function watch() {
      if (!attract) return;
      var playing = playPressed();
      if (playing) sawPlay = true;
      var over = Date.now() - t0 > (FAST ? 800 : CAP_MS);
      if (over && !jumped && (playing || !sawPlay)) {
        // Fast test mode, or a replay that has run too long: move to the last day.
        jumped = true;
        if (playing) $("#play").click();
        var r = $("#run");
        setRun(r ? r.max : 0);
        return later(finish, 0);
      }
      if (sawPlay && !playing) return finish();
      later(watch, POLL_MS);
    })();
  }
  function finish() {
    if (!attract) return;
    later(cycle, HOLD_MS);
  }

  // ---- activity
  function touch() {
    lastActivity = Date.now();
    clearTimeout(idleTimer);
    if (!attract) idleTimer = setTimeout(function () {
      if (Date.now() - lastActivity >= IDLE_MS) enter(); else touch2();
    }, IDLE_MS);
  }
  function touch2() { clearTimeout(idleTimer); idleTimer = setTimeout(function () { touch(); }, 200); }

  function onActivity(e) {
    if (e.type === "mousemove") {
      // The browser repeats the last mouse position after a scroll or layout change. That is not movement.
      if (e.clientX === lastX && e.clientY === lastY) return;
      lastX = e.clientX; lastY = e.clientY;
    }
    if (attract) {
      var press = e.type !== "mousemove" && e.type !== "wheel";
      leave(press);
      if (press && e.cancelable) { e.preventDefault(); }
      return;
    }
    touch();
  }

  build();
  ["mousemove", "mousedown", "pointerdown", "touchstart", "touchmove", "keydown", "wheel"].forEach(function (n) {
    window.addEventListener(n, onActivity, { capture: true, passive: n === "mousemove" || n === "touchmove" || n === "wheel" });
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && attract) takeLock(); });
  enter();
})();
