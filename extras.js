// Statistics across the 90 scenarios, diesel factor re-scoring and the intake check. Reads the
// seed index (seeds/seeds.js) only, so it needs no seed file. Presentation only. Every figure is
// descriptive and none is a pre-registered result (docs/DEMO.md, the two tracks of docs/DECISIONS.md).
(function () {
  "use strict";
  var idx = window.SRCRO_SEED_INDEX || [];
  function $(id) { return document.getElementById(id); }
  function fmt(v, dp) { return v === null || v === undefined || isNaN(v) ? "n/a" : Number(v).toFixed(dp); }
  function signed(v, dp) { return (v > 0 ? "+" : "") + fmt(v, dp); }
  var FLEETS = ["0", "1", "2", "3", "4"];

  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length;
    return m % 2 ? s[(m - 1) / 2] : (s[m / 2 - 1] + s[m / 2]) / 2;
  }
  // A small seeded generator, so the interval on the page is the same every time it is drawn.
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function bootMedianCI(a, seed) {
    if (a.length < 3) return null;
    var rnd = mulberry32(seed), meds = [], n = a.length;
    for (var b = 0; b < 2000; b++) {
      var s = [];
      for (var i = 0; i < n; i++) s.push(a[Math.floor(rnd() * n)]);
      meds.push(median(s));
    }
    meds.sort(function (x, y) { return x - y; });
    return [meds[Math.floor(0.025 * meds.length)], meds[Math.ceil(0.975 * meds.length) - 1]];
  }
  // Exact two-sided sign test, p = 2 P(X <= min(k, n - k)) for X ~ Binomial(n, 1/2).
  function signTestP(neg, pos) {
    var n = neg + pos, k = Math.min(neg, pos);
    if (!n) return null;
    var lg = [0];
    for (var i = 1; i <= n; i++) lg.push(lg[i - 1] + Math.log(i));
    var tail = 0;
    for (var j = 0; j <= k; j++) tail += Math.exp(lg[n] - lg[j] - lg[n - j] - n * Math.LN2);
    return Math.min(1, 2 * tail);
  }
  function pfmt(p) { return p === null ? "n/a" : p < 0.0001 ? "< 0.0001" : fmt(p, 4); }

  function rowsFor(fleet, factor) {
    var out = [];
    idx.forEach(function (e) {
      var f = e.by_fleet[fleet];
      if (!f) return;
      var d = f.distance, em = f.emissions;
      if (factor && e.km_diesel && e.served) {
        d = e.km_diesel[fleet].distance * factor / 1000 / e.served[fleet].distance;
        em = e.km_diesel[fleet].emissions * factor / 1000 / e.served[fleet].emissions;
      }
      out.push({ seed: e.seed, d: d, e: em, pct: d > 0 ? (em - d) / d * 100 : null,
        ontime: e.on_time && e.on_time[fleet] ? e.on_time[fleet] : null });
    });
    return out;
  }
  function mean(a) { a = a.filter(function (v) { return v !== null && v !== undefined; }); return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }

  function statsTable() {
    var body = FLEETS.map(function (k) {
      var rows = rowsFor(k), pcts = rows.filter(function (r) { return r.pct !== null; }).map(function (r) { return r.pct; });
      if (!pcts.length) {
        return "<tr><th scope=\"row\">" + k + "</th><td colspan=\"6\">The distance-only plan already emits nothing at tier-1, so there is no change to measure</td></tr>";
      }
      var ci = bootMedianCI(pcts, 20261101 + Number(k)), neg = pcts.filter(function (v) { return v < 0; }).length,
        pos = pcts.filter(function (v) { return v > 0; }).length;
      return "<tr><th scope=\"row\">" + k + "</th><td>" + pcts.length + "</td><td>" + signed(median(pcts), 1) + "%</td><td>" +
        (ci ? signed(ci[0], 1) + "% to " + signed(ci[1], 1) + "%" : "n/a") + "</td><td>" + neg + " of " + pcts.length +
        "</td><td>" + pfmt(signTestP(neg, pos)) + "</td><td>" + fmt(mean(rows.map(function (r) { return r.ontime && r.ontime.distance; })), 1) +
        " and " + fmt(mean(rows.map(function (r) { return r.ontime && r.ontime.emissions; })), 1) + "</td></tr>";
    }).join("");
    $("stats-table").tBodies[0].innerHTML = body;
  }

  var FACTORS = { low: 780, central: 1000, high: 1140, stress: 1300 };
  function factorTable() {
    var f = FACTORS[(document.querySelector('input[name="factor"]:checked') || {}).value || "central"];
    $("factor-table").tBodies[0].innerHTML = FLEETS.map(function (k) {
      var rows = rowsFor(k, f), pcts = rows.filter(function (r) { return r.pct !== null; }).map(function (r) { return r.pct; });
      var md = median(rows.map(function (r) { return r.d; })), me = median(rows.map(function (r) { return r.e; }));
      return "<tr><th scope=\"row\">" + k + "</th><td>" + fmt(md, 3) + "</td><td>" + fmt(me, 3) + "</td><td>" +
        (pcts.length ? signed(median(pcts), 1) + "%" : "n/a") + "</td><td>" +
        (pcts.length ? pcts.filter(function (v) { return v < 0; }).length + " of " + pcts.length : "n/a") + "</td></tr>";
    }).join("");
    $("factor-now").textContent = f + " g CO2-e per diesel kilometre";
  }

  // ---------------------------------------------------------------- intake check

  var page = function () { return window.SRCRO_PAGE; };
  var DEFAULT_EXAMPLES = {
    inside: { lat: -32.9283, lon: 151.7817, volume_m3: 1, arrival_day: 0 },
    outside: { lat: -32.7647, lon: 151.7447, volume_m3: 1, arrival_day: 0 },
    over: { lat: -32.9283, lon: 151.7817, volume_m3: 3.5, arrival_day: 0 },
    novolume: { lat: -32.9283, lon: 151.7817, volume_m3: 0, arrival_day: 0 },
    nocoords: { lat: null, lon: null, volume_m3: 1, arrival_day: 0 },
    noday: { lat: -32.9283, lon: 151.7817, volume_m3: 1, arrival_day: null }
  };
  var intakeMap = null, intakeMarker = null;

  function num(id) { var v = $(id).value.trim(); return v === "" || isNaN(Number(v)) ? null : Number(v); }

  function fillIntake(r) {
    $("intake-lat").value = r.lat === null ? "" : r.lat;
    $("intake-lon").value = r.lon === null ? "" : r.lon;
    $("intake-vol").value = r.volume_m3 === null ? "" : r.volume_m3;
    $("intake-noday").checked = r.arrival_day === null;
    placeMarker();
  }
  function placeMarker() {
    if (!intakeMap) return;
    var lat = num("intake-lat"), lon = num("intake-lon");
    if (intakeMarker) { intakeMap.removeLayer(intakeMarker); intakeMarker = null; }
    if (lat !== null && lon !== null) intakeMarker = L.circleMarker([lat, lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#0072B2", fillOpacity: 1 }).addTo(intakeMap);
  }

  function checkIntake() {
    var body = { lat: num("intake-lat"), lon: num("intake-lon"), volume_m3: num("intake-vol"), arrival_day: $("intake-noday").checked ? null : 0 };
    $("intake-result").textContent = "Checking";
    page().liveFetch("/api/intake", { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || "the check failed");
        var j = res.j;
        $("intake-result").innerHTML = '<span class="chip chip-' + j.status + '">' + j.status + "</span> " +
          (j.reason ? "<code>" + j.reason + "</code> " : "") + j.explanation +
          ' <span class="note">Checked by the planner\'s own intake code, volume cap ' + j.volume_cap_m3 + " m3.</span>";
      }).catch(function (e) { $("intake-result").textContent = "Could not check: " + e.message; });
  }

  function intakeSetup() {
    var sec = $("intake"), form = $("live-form");
    if (!sec || !form) return;
    // On the hosted page the route exists only once the stack is redeployed, which writes
    // features: ["intake", "solutions"] into live-config.js. The laptop server always has it.
    function sync() { sec.hidden = form.hidden || !page() || !page().feature("intake"); }
    new MutationObserver(sync).observe(form, { attributes: true, attributeFilter: ["hidden"] });
    sync();
    if (window.L && window.SRCRO_LAYERS) {
      intakeMap = L.map("intake-map", { zoomSnap: 0.25, attributionControl: false });
      (window.SRCRO_LAYERS.boundary || []).forEach(function (ring) {
        L.polygon(ring, { color: "#6B7580", weight: 2, fill: true, fillColor: "#8DB8DD", fillOpacity: 0.15, interactive: false }).addTo(intakeMap);
      });
      (window.SRCRO_LAYERS.basemap || []).forEach(function (r) { L.polyline(r.p, { color: "#B9C0C8", weight: 1, interactive: false }).addTo(intakeMap); });
      var pts = [window.SRCRO_LAYERS.depot];
      (window.SRCRO_LAYERS.boundary || []).forEach(function (r) { pts = pts.concat(r); });
      // The council area plus a margin, so a point just outside it can be placed. The section is
      // hidden at first and a hidden map has no size, so the fit happens when it is first shown.
      var bounds = L.latLngBounds(pts).pad(0.1), fitted = false;
      intakeMap.on("click", function (e) {
        $("intake-lat").value = e.latlng.lat.toFixed(5); $("intake-lon").value = e.latlng.lng.toFixed(5); placeMarker();
      });
      new MutationObserver(function () {
        if (sec.hidden) return;
        setTimeout(function () { intakeMap.invalidateSize(); if (!fitted) { intakeMap.fitBounds(bounds); fitted = true; placeMarker(); } }, 50);
      }).observe(sec, { attributes: true, attributeFilter: ["hidden"] });
    }
    $("intake-go").addEventListener("click", checkIntake);
    ["lat", "lon"].forEach(function (k) { $("intake-" + k).addEventListener("change", placeMarker); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-intake]"), function (b) {
      b.addEventListener("click", function () { fillIntake(DEFAULT_EXAMPLES[b.getAttribute("data-intake")]); checkIntake(); });
    });
    fillIntake(DEFAULT_EXAMPLES.inside);
  }

  if (idx.length && $("stats-table")) {
    statsTable();
    factorTable();
    Array.prototype.forEach.call(document.querySelectorAll('input[name="factor"]'), function (r) { r.addEventListener("change", factorTable); });
  }
  intakeSetup();
})();
