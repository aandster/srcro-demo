// Guided tour of the Explore Scenarios page (Jordan, 2026-11-01). Six steps that follow the video script
// in docs/DEMO.md. The tour drives the page only through its own controls (the scenario list, the fleet
// buttons, the run slider, Play, the speed button and the Maps shown choice), so it needs nothing from app.js.
// Every timer it starts is kept in one list and cleared when a step is left or the tour closes.
// Wording adapted from the script, with no figures, so nothing here reads as a result.
(function () {
  "use strict";

  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  var STEPS = [
    { title: "The problem",
      text: "Residents book reuse collections on demand. A distance-only plan treats every kilometre alike, but an electric kilometre has no tailpipe emissions and a loaded uphill kilometre burns more diesel. This page asks how much an emissions-aware plan saves on the same requests and fleet.",
      targets: [".masthead"], scroll: ".masthead", offset: 0 },
    { title: "The two plans side by side",
      text: "Both maps show the same requests on the same day. Orange routes are diesel trucks and blue routes are electric. In this view the emissions-aware plan on the right drives more kilometres in total yet emits less, because more of them are electric. Read the figures under each map.",
      targets: [".maps"], scroll: ".maps", offset: 90 },
    { title: "Replay",
      text: "Each day the planner re-plans the coming business days and carries out the first one. Watch the running CO2-e totals as the trucks drive. In this run the gap in CO2-e builds up day by day.",
      targets: [".player", "#totals"], scroll: "#totals", offset: 90 },
    { title: "Fleet switch",
      text: "The tour is now switching the fleet. With no electric trucks the two plans are almost the same. With most of the fleet electric the emissions-aware plan uses no diesel at all in this run. Changing the fleet is a fleet decision, so the planning saving is the gap between the plans within each fleet.",
      targets: [".controls .fleet"], scroll: ".controls", offset: 70 },
    { title: "Across the 90 scenarios",
      text: "Each scenario is one illustrative run, so this table counts, fleet by fleet, how often the emissions-aware plan comes out lower. These figures are descriptive.",
      targets: ["#stats"], scroll: "#stats", offset: 80 },
    { title: "Limits",
      text: "Requests are synthetic. The diesel factor and the electric planning distance are not sourced for this truck. CMEM figures are within the model, and battery manufacture is outside the boundary. Nothing here claims minimal emissions.",
      targets: ["#stats > h3 + .note", "#stats > h3"], scroll: "#stats > h3", offset: 80 }
  ];

  var timers = [], token = 0, index = -1, card = null, spots = [];
  var savedSpeed = null, startedPlay = false, started = false;

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

  // ---- driving the page through its own controls
  function ready() {
    var sel = $("#plan"), fb = $("#fleet-buttons"), k = $("#kpi-distance");
    return !!(sel && !sel.disabled && fb && fb.children.length && k && k.children.length);
  }
  // Polls until the page has a loaded scenario, then runs fn. A step change cancels the wait.
  function whenReady(fn) {
    var my = token, tries = 0;
    (function poll() {
      if (my !== token) return;
      if (ready()) return fn();
      if (++tries > 150) return;
      later(poll, 100);
    })();
  }
  function fleetButton(n) { return $('#fleet-buttons [data-fleet="' + n + '"]'); }
  function pressFleet(n) {
    var b = fleetButton(n);
    if (b && !b.disabled && b.getAttribute("aria-pressed") !== "true") b.click();
  }
  function setRun(v) {
    var r = $("#run");
    if (!r) return;
    r.value = String(v);
    r.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function playPressed() { var p = $("#play"); return !!p && p.getAttribute("aria-pressed") === "true"; }
  function pausePlay() { if (playPressed()) $("#play").click(); }

  // Seed 1, one electric truck, both maps. Calls done once the scenario is on screen.
  function baseView(done) {
    var sel = $("#plan");
    if (sel && sel.value !== "seed:1") {
      sel.value = "seed:1";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    whenReady(function () {
      pressFleet(1);
      var both = $('input[name="mapview"][value="both"]');
      if (both && !both.checked) both.click();
      done();
    });
  }

  // ---- spotlight and scrolling
  function spot(sel) {
    clearSpots();
    sel.forEach(function (s) { $$(s).forEach(function (e) { e.classList.add("tour-spot"); spots.push(e); }); });
  }
  function clearSpots() { spots.forEach(function (e) { e.classList.remove("tour-spot"); }); spots = []; }
  function scrollTo(sel, offset) {
    var e = $(sel);
    if (!e) return;
    var y = e.getBoundingClientRect().top + window.pageYOffset - offset;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
  }

  // ---- per step actions
  function enterStep(i) {
    if (i === 1) {
      baseView(function () { setRun(100); });   // day 1, drawn whole
    } else if (i === 2) {
      baseView(function () {
        setRun(0);
        var sp = $("#speed");
        if (sp) {
          savedSpeed = sp.textContent;
          for (var k = 0; k < 4 && sp.textContent.trim() !== "4×"; k++) sp.click();   // 4x so the totals move while the card is read
        }
        later(function () { if (!playPressed()) { $("#play").click(); startedPlay = true; } }, 400);
      });
    } else if (i === 3) {
      baseView(function () {
        var r = $("#run");
        setRun(r ? r.max : 0);   // end of the run, so the totals show every day
        var seq = [0, 2, 3, 4, 1], n = 0;
        (function next() {
          later(function () { pressFleet(seq[n]); n++; if (n < seq.length) next(); }, n === 0 ? 1200 : 2500);
        })();
      });
    }
  }
  function leaveStep(i) {
    clearTimers();
    token++;
    if (i === 2) {
      if (startedPlay) pausePlay();
      startedPlay = false;
      var sp = $("#speed");
      if (sp && savedSpeed) for (var k = 0; k < 4 && sp.textContent !== savedSpeed; k++) sp.click();
      savedSpeed = null;
    }
    if (i === 3) pressFleet(1);
  }

  // ---- card
  function build() {
    card = document.createElement("div");
    card.className = "tour-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Guided tour");
    card.innerHTML =
      '<p class="tour-progress"></p><h2 class="tour-title"></h2><p class="tour-text" aria-live="polite"></p>' +
      '<div class="tour-actions"><button type="button" class="secondary tour-back">Back</button>' +
      '<button type="button" class="tour-next">Next</button>' +
      '<button type="button" class="secondary tour-close">Close</button></div>';
    document.body.appendChild(card);
    card.querySelector(".tour-back").addEventListener("click", function () { go(index - 1); });
    card.querySelector(".tour-next").addEventListener("click", function () { go(index + 1); });
    card.querySelector(".tour-close").addEventListener("click", close);
  }

  function go(i) {
    if (i < 0) return;
    if (i >= STEPS.length) return close();
    if (index >= 0) leaveStep(index);
    index = i;
    var s = STEPS[i];
    card.querySelector(".tour-progress").textContent = "Step " + (i + 1) + " of " + STEPS.length;
    card.querySelector(".tour-title").textContent = s.title;
    card.querySelector(".tour-text").textContent = s.text;
    var back = card.querySelector(".tour-back"), next = card.querySelector(".tour-next");
    back.disabled = i === 0;
    next.textContent = i === STEPS.length - 1 ? "Finish" : "Next";
    spot(s.targets);
    scrollTo(s.scroll, s.offset);
    enterStep(i);
    // Leaving a step can re-render the page (the fleet switch puts the fleet back), which moves the
    // target after the smooth scroll has set off for its old place, and step 5 ended at the foot of the
    // page. Aim again once the layout has settled (Jordan, 2026-11-02).
    later(function () { scrollTo(s.scroll, s.offset); }, 700);
    later(function () { scrollTo(s.scroll, s.offset); }, 1600);
    try { next.focus({ preventScroll: true }); } catch (e) { /* focus is a convenience */ }
  }

  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Escape") {
      // A map open full screen takes the first Escape (app.js collapses it).
      if (!document.querySelector(".map-wrap.expanded") && !document.fullscreenElement) close();
      return;
    }
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    else if (e.key === "Enter" && !(t && t.closest && t.closest("button, a, summary"))) { e.preventDefault(); go(index + 1); }
  }

  function open() {
    if (started) return;
    started = true;
    build();
    document.body.classList.add("tour-open");
    document.addEventListener("keydown", onKey, true);
    go(0);
  }

  function close() {
    if (!started) return;
    if (index >= 0) leaveStep(index);
    clearTimers();
    clearSpots();
    document.removeEventListener("keydown", onKey, true);
    if (card && card.parentNode) card.parentNode.removeChild(card);
    card = null; index = -1; started = false;
    document.body.classList.remove("tour-open");
  }

  // ---- entry points: a button beside the heading, and ?tour=1
  var head = $(".masthead"), h1 = head && head.querySelector("h1");
  if (head && h1) {
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "tour-start"; btn.textContent = "Take the 2 minute tour";
    head.classList.add("has-tour");
    h1.insertAdjacentElement("afterend", btn);
    btn.addEventListener("click", open);
  }
  if (/[?&]tour=1(&|$)/.test(location.search)) open();
})();
