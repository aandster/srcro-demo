// Expo demo (task 063). Plain JavaScript and Leaflet 1.9.4. The shared map layers are in
// layers.js (window.SRCRO_LAYERS), each scenario in seeds/seed-<n>.js, both written by
// scripts/export_demo_data.py. Presentation only, every number on the page is descriptive
// and the page says so.
(function () {
  "use strict";

  var DIESEL = "#D55E00", ELECTRIC = "#0072B2", ROAD = "#B9C0C8", INK = "#15181C";
  var ARMS = ["distance", "emissions"];

  var LAYERS = window.SRCRO_LAYERS;
  var seedIndex = window.SRCRO_SEED_INDEX || [];
  var DEFAULT_SEED = seedIndex.length ? seedIndex[0].seed : 1;
  var state = { data: null, fleet: null, day: 0, timer: null, live: false, key: "seed:" + DEFAULT_SEED };
  var maps = {}, layers = {}, syncing = false, streetLayers = {};

  function $(id) { return document.getElementById(id); }
  function fmt(v, dp) { return v === null || v === undefined || isNaN(v) ? "n/a" : Number(v).toFixed(dp); }
  function days(n, word) { return n + " " + word + (n === 1 ? " day" : " days"); }
  function signed(v, dp) { return (v > 0 ? "+" : "") + fmt(v, dp); }

  if (!window.L || !LAYERS) {
    var msg = !window.L
      ? "The map library did not load. Check the internet connection, or add demo/vendor/leaflet.js for offline use (docs/DEMO.md)."
      : "No map layers. Generate demo/layers.js with scripts/export_demo_data.py --layers-out (docs/DEMO.md).";
    var div = document.createElement("div");
    div.className = "nodata"; div.setAttribute("role", "alert"); div.textContent = msg;
    document.querySelector("main").prepend(div);
    if (!LAYERS) return;
  }

  // ---------------------------------------------------------------- maps

  function makeMap(arm) {
    // No zoom on the scroll wheel, so scrolling the page never gets caught by a map (Jordan, 2026-11-01).
    var m = L.map("map-" + arm, { preferCanvas: true, zoomSnap: 0.25, attributionControl: true, scrollWheelZoom: false });
    m.attributionControl.setPrefix(false);
    backgroundControl().addTo(m);
    var base = L.layerGroup().addTo(m);
    var d = LAYERS;
    (d.basemap || []).forEach(function (r) {
      L.polyline(r.p, { color: ROAD, weight: r.c === "motorway" || r.c === "trunk" ? 2.5 : 1.5,
        opacity: 0.9, interactive: false }).addTo(base);
    });
    (d.boundary || []).forEach(function (ring) {
      L.polygon(ring, { color: "#6B7580", weight: 1.5, dashArray: "2 4", fill: false,
        interactive: false }).addTo(base);
    });
    layers[arm] = L.layerGroup().addTo(m);
    L.marker(d.depot, { icon: L.divIcon({ className: "", iconSize: [14, 14],
      html: '<svg width="14" height="14" aria-hidden="true"><rect x="1" y="1" width="12" height="12" fill="' + INK + '" stroke="#fff" stroke-width="1.5"/></svg>' }),
      keyboard: false, title: "Depot" }).bindTooltip("Depot").addTo(m);
    maps[arm] = m;
    return m;
  }

  function fitAll() {
    var pts = [LAYERS.depot];
    (LAYERS.boundary || []).forEach(function (r) { pts = pts.concat(r); });
    if (pts.length < 3 && state.data) {
      Object.keys(state.data.fleets).forEach(function (k) {
        ARMS.forEach(function (a) { state.data.fleets[k][a].days.forEach(function (d) {
          d.routes.forEach(function (r) { pts = pts.concat(r.path); }); }); });
      });
    }
    var b = L.latLngBounds(pts);
    // Only a map with a size. With one map chosen (Jordan's map view, 2026-11-01) the other is hidden,
    // and fitting a zero-size map jumps to the highest zoom, which the pan sync then copied onto the
    // visible map: a blank map with only the depot, "+" greyed out (iPhone, 2026-11-02).
    // invalidateSize first: a map that has just reappeared still holds its hidden size of 0 by 0 until
    // told, and a fit at that size gives an infinite zoom (the same blank map, found switching back to Both).
    ARMS.forEach(function (a) { if (mapSized(a)) { maps[a].invalidateSize(false); maps[a].fitBounds(b, { padding: [10, 10] }); } });
  }
  function mapSized(a) { var e = $("map-" + a); return !!e && e.clientWidth > 0 && e.clientHeight > 0; }

  function syncMaps() {
    ARMS.forEach(function (a) {
      var other = a === "distance" ? "emissions" : "distance";
      maps[a].on("move", function () {
        if (syncing || !mapSized(a) || !mapSized(other)) return;   // a hidden map neither leads nor follows
        syncing = true;
        maps[other].setView(maps[a].getCenter(), maps[a].getZoom(), { animate: false });
        syncing = false;
      });
    });
  }

  // Movement through the day. The export has no clock times, so each truck drives its planned
  // route at one constant speed (the same for every truck, both plans), which makes a longer
  // route take longer. Stop dwell time is not modelled. animT runs 0 to 1 over the longest
  // route of the day across both plans, and 1 is the finished day.
  // dots is true only while the time-of-day animation is in use (Animate day or its slider).
  // A finished day, and Play through the days, show routes without trucks, because at the end
  // of a day every truck sits stacked on the depot (Jordan, 2026-11-01).
  var anim = { t: 1, raf: null, routes: [], t0: 18000, t1: 18000, dots: false };
  var TRUCK_CAPACITY_M3 = 11;   // medium rigid rear-loader body, docs/FLEET.md
  function bodyM3() {
    var lp = state.data && state.data.liveParams;
    return TRUCK_CAPACITY_M3 * (lp && lp.compaction ? lp.compaction : 1);
  }
  var FALLBACK_KMH = 30;   // only for an export without planned times

  function hhmm(sec) {
    var m = Math.round(sec / 60), h = Math.floor(m / 60) % 24;
    return (h < 10 ? "0" : "") + h + ":" + (m % 60 < 10 ? "0" : "") + (m % 60);
  }

  // Each route becomes a list of anchors (clock time, metres along the road geometry). A truck
  // drives between two stops at an even pace along the geometry, standing still for each
  // stop's service time, so the planned arrival and departure times are met exactly.
  function buildRouteAnim(r, colour, g, arm) {
    var cum = [0], i, d = 0;
    for (i = 1; i < r.path.length; i++) {
      d += L.latLng(r.path[i - 1]).distanceTo(L.latLng(r.path[i]));
      cum.push(d);
    }
    // First path vertex within 10 m of the closest one, searching forward only, so a road
    // driven twice maps each visit to its own pass.
    var from = 0, idx = r.stops.map(function (st) {
      var best = Infinity, dist = [];
      for (var k = from; k < r.path.length; k++) {
        var dl = (r.path[k][0] - st.lat) * 111320, dn = (r.path[k][1] - st.lon) * 111320 * 0.84;
        dist.push(Math.sqrt(dl * dl + dn * dn));
        best = Math.min(best, dist[dist.length - 1]);
      }
      for (var j = 0; j < dist.length; j++) if (dist[j] <= best + 10) { from = from + j; return from; }
      return from;
    });
    var timed = r.t0 !== null && r.t0 !== undefined && r.t1 !== null && r.t1 !== undefined;
    var anchors = [];
    if (timed) {
      anchors.push({ t: r.t0, d: 0 });
      r.stops.forEach(function (st, j) {
        anchors.push({ t: st.t, d: cum[idx[j]] });
        anchors.push({ t: st.d, d: cum[idx[j]] });
      });
      anchors.push({ t: r.t1, d: cum[cum.length - 1] });
    } else {
      var t = 18000, perM = 3600 / (FALLBACK_KMH * 1000), last = 0;
      anchors.push({ t: t, d: 0 });
      r.stops.forEach(function (st, j) {
        t += (cum[idx[j]] - last) * perM; last = cum[idx[j]];
        anchors.push({ t: t, d: last });
        anchors.push({ t: t, d: last });
      });
      anchors.push({ t: t + (cum[cum.length - 1] - last) * perM, d: cum[cum.length - 1] });
    }
    var trailCase = L.polyline([], { color: "#FFFFFF", weight: 7, opacity: 0.85, interactive: false }).addTo(g);
    var trail = L.polyline([], { color: colour, weight: 4, opacity: 1, interactive: false }).addTo(g);
    var truck = L.marker(r.path[0], { interactive: false, keyboard: false, zIndexOffset: 1000,
      icon: L.divIcon({ className: "truck", iconSize: [24, 24],
        html: '<span style="background:' + colour + '">' + r.vehicle + "</span>" }) }).addTo(g);
    var stops = r.stops.map(function (st, j) { return { leave: anchors[2 * j + 2].t, marker: st.marker, vol: st.vol || 0 }; });
    return { path: r.path, cum: cum, anchors: anchors, trail: trail, trailCase: trailCase, truck: truck, stops: stops, colour: colour,
      arm: arm, co2: r.co2e_kg || 0, km: r.km || 0,
      dot: truck.getElement() && truck.getElement().firstChild };
  }

  function distanceAt(ra, T) {
    var a = ra.anchors, k = 0;
    if (T <= a[0].t) return 0;
    if (T >= a[a.length - 1].t) return a[a.length - 1].d;
    while (k < a.length - 2 && a[k + 1].t <= T) k++;
    var span = a[k + 1].t - a[k].t;
    return span > 0 ? a[k].d + (a[k + 1].d - a[k].d) * (T - a[k].t) / span : a[k + 1].d;
  }

  // A colour mixed towards black by f (0 leaves it, 1 is black), for the truck load.
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), k = 1 - f;
    var c = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v * k); });
    return "rgb(" + c.join(",") + ")";
  }

  function applyAnim() {
    var T = anim.t0 + anim.t * (anim.t1 - anim.t0);
    var today = { distance: { co2: 0, vol: 0, km: 0 }, emissions: { co2: 0, vol: 0, km: 0 } };
    anim.routes.forEach(function (ra) {
      var d = distanceAt(ra, T), k = 0, total = ra.cum[ra.cum.length - 1];
      // CO2-e builds up with the distance driven, the route's own figure spread over its length
      if (today[ra.arm]) today[ra.arm].co2 += total > 0 ? ra.co2 * Math.min(1, d / total) : 0;
      // and so does the distance, the route's planned km (not the drawn line's length) spread the same way
      if (today[ra.arm]) today[ra.arm].km += total > 0 ? ra.km * Math.min(1, d / total) : 0;
      while (k < ra.cum.length - 1 && ra.cum[k + 1] <= d) k++;
      var pts = ra.path.slice(0, k + 1), pos = ra.path[k];
      if (k < ra.path.length - 1 && ra.cum[k + 1] > ra.cum[k]) {
        var f = (d - ra.cum[k]) / (ra.cum[k + 1] - ra.cum[k]);
        pos = [ra.path[k][0] + (ra.path[k + 1][0] - ra.path[k][0]) * f, ra.path[k][1] + (ra.path[k + 1][1] - ra.path[k][1]) * f];
        pts.push(pos);
      }
      ra.trail.setLatLngs(pts);
      ra.trailCase.setLatLngs(pts);
      // While the clock runs only the road already driven shows, the route ahead is hidden
      // (Jordan, 2026-11-01). Paused at the end of a day, every route shows whole.
      if (ra.plan) ra.plan.forEach(function (pl) { pl[0].setStyle({ opacity: anim.dots ? 0 : pl[1] }); });
      ra.truck.setLatLng(pos);
      // A truck that has finished its route is back at the depot, so it is hidden (Jordan, 2026-11-01).
      var home = T >= ra.anchors[ra.anchors.length - 1].t;
      ra.truck.setOpacity(anim.dots && !home ? 1 : 0);
      var load = 0;
      ra.stops.forEach(function (st) {
        var done = T >= st.leave;
        if (done) load += st.vol;
        st.marker.setStyle({ fillColor: done ? ra.colour : "#15181C", fillOpacity: done ? 1 : 0.6 });
      });
      // The truck darkens with what it has picked up, from its own colour when empty to a deep shade
      // at the full body (Jordan, 2026-11-01, in place of growing). A live run with compaction holds
      // more, so its full body is 11 m3 times the compaction the visitor chose.
      if (ra.dot) ra.dot.style.background = shade(ra.colour, 0.65 * Math.min(1, load / bodyM3()));
      if (today[ra.arm]) today[ra.arm].vol += load;
    });
    showTotals(today);
  }

  // ---- one run clock (Jordan, 2026-11-01). Play moves the trucks through a day on their planned
  // times, holds the finished day for a moment, then starts the next day, to the last one. One slider
  // spans the whole run, 101 steps a day (start to end of day), so dragging it moves through the days
  // and through the hours. It replaces the separate day replay and day animation.
  var run = { raf: null, hold: null, speed: 1 };
  // A day takes 12 s at 1x. The speed button steps through 1x to 4x (Jordan, 2026-11-01).
  var DAY_MS = 12000, SPEEDS = [1, 2, 3, 4], HOLD_MS = 1200, STEPS = 101;
  // 0 before a fleet is chosen (the first scenario load pauses before it sets the fleet).
  function runDays() {
    var f = state.data && state.data.fleets[state.fleet];
    return f ? f.distance.days.length : 0;
  }
  function playing() { return !!(run.raf || run.hold); }
  // Trucks show while the run plays and part way through a day. At the end of a day they all sit on
  // the depot, so the finished day is shown as routes only (Jordan, 2026-11-01).
  function dotsFor(t) { return playing() || (t > 0 && t < 1); }

  // ---- running totals (Jordan, 2026-11-01). Emissions so far and volume collected so far for both plans,
  // growing as the run plays: every finished day before this one, plus the part of today driven or
  // collected by the clock's time. Bars are scaled to the larger plan's total over the whole run.
  var totalsCache = { key: null };
  function runTotals() {
    var key = state.key + "|" + state.fleet;
    if (totalsCache.key === key) return totalsCache;
    var lvl = state.data.fleets[state.fleet], out = { key: key };
    ARMS.forEach(function (a) {
      var vol = [0], km = [0];   // volume collected and km driven before each day
      lvl[a].days.forEach(function (d) {
        var v = 0;
        (d.routes || []).forEach(function (r) { r.stops.forEach(function (st) { v += st.vol || 0; }); });
        vol.push(vol[vol.length - 1] + v);
        km.push(km[km.length - 1] + (d.km || 0));
      });
      out[a] = { vol: vol, km: km, co2End: lvl[a].days.length ? lvl[a].days[lvl[a].days.length - 1].co2e_running_kg : 0 };
    });
    out.maxCo2 = Math.max(out.distance.co2End, out.emissions.co2End) || 1;
    out.maxVol = Math.max(out.distance.vol[out.distance.vol.length - 1], out.emissions.vol[out.emissions.vol.length - 1]) || 1;
    out.maxKm = Math.max(out.distance.km[out.distance.km.length - 1], out.emissions.km[out.emissions.km.length - 1]) || 1;
    totalsCache = out;
    return out;
  }
  function showTotals(today) {
    if (!$("totals") || !runDays()) return;   // nothing to total before a fleet is chosen
    var tt = runTotals(), lvl = state.data.fleets[state.fleet];
    ARMS.forEach(function (a) {
      var before = state.day > 0 ? lvl[a].days[state.day - 1].co2e_running_kg : 0;
      var co2 = before + today[a].co2, vol = tt[a].vol[state.day] + today[a].vol;
      $("tot-co2-" + a).textContent = fmt(co2, 0) + " kg";
      $("tot-vol-" + a).textContent = fmt(vol, 0) + " m3";
      $("bar-co2-" + a).style.width = (100 * co2 / tt.maxCo2).toFixed(1) + "%";
      $("bar-vol-" + a).style.width = (100 * vol / tt.maxVol).toFixed(1) + "%";
      // Distance travelled (Jordan, 2026-11-02), beside CO2-e, so the run shows the emissions-aware plan
      // driving more km for less CO2-e when electric trucks take the longer routes.
      if ($("tot-km-" + a)) {
        var km = tt[a].km[state.day] + today[a].km;
        $("tot-km-" + a).textContent = fmt(km, 0) + " km";
        $("bar-km-" + a).style.width = (100 * km / tt.maxKm).toFixed(1) + "%";
      }
    });
  }

  function syncRun() {
    var n = runDays();
    if (!n) return;
    var T = anim.t0 + anim.t * (anim.t1 - anim.t0);
    $("run").max = String(n * STEPS - 1);
    var ticks = $("run-ticks");
    if (ticks && ticks.getAttribute("data-n") !== String(n)) {
      ticks.setAttribute("data-n", String(n));
      var html = "";
      for (var i = 0; i < n; i++) {
        var lab = (i === 0 || (i + 1) % 5 === 0) ? "<span>" + (i + 1) + "</span>" : "";
        html += '<i style="left:' + (100 * i * STEPS / (n * STEPS - 1)).toFixed(2) + '%">' + lab + "</i>";
      }
      ticks.innerHTML = html;
    }
    $("run").value = String(state.day * STEPS + Math.round(anim.t * (STEPS - 1)));
    var when = anim.t >= 1 ? (run.hold ? "day complete" : "end of day") : anim.t <= 0 ? "start of day" : hhmm(T);
    $("run-label").textContent = "Day " + (state.day + 1) + " / " + n + "  \u00b7  " + when;
  }

  function showDay(day, t) {
    state.day = day; anim.t = t; anim.dots = dotsFor(t);
    drawDay(); updatePanels(); syncRun();
  }

  function pause() {
    if (run.raf) cancelAnimationFrame(run.raf);
    if (run.hold) clearTimeout(run.hold);
    run.raf = run.hold = null;
    $("play").setAttribute("aria-label", "Play"); $("play").setAttribute("aria-pressed", "false");
    anim.dots = dotsFor(anim.t); applyAnim(); syncRun();
  }

  function playRun() {
    var n = runDays();
    if (state.day >= n - 1 && anim.t >= 1) showDay(0, 0);          // run complete, start again
    else if (anim.t >= 1) showDay(state.day + 1, 0);              // a finished day, go on to the next
    $("play").setAttribute("aria-label", "Pause"); $("play").setAttribute("aria-pressed", "true");
    var last = null;
    function frame(now) {
      if (last === null) last = now;
      anim.t = Math.min(1, anim.t + (now - last) / (DAY_MS / run.speed));
      last = now; anim.dots = true; applyAnim();
      if (anim.t < 1) { run.raf = requestAnimationFrame(frame); syncRun(); return; }
      run.raf = null;
      run.hold = setTimeout(function () {
        run.hold = null;
        if (state.day >= runDays() - 1) {
          pause();
          $("run-label").textContent = "Run complete, " + runDays() + " days";
          return;
        }
        showDay(state.day + 1, 0);
        last = null; run.raf = requestAnimationFrame(frame);
      }, HOLD_MS);
      syncRun();
    }
    run.raf = requestAnimationFrame(frame);
  }

  function drawDay() {
    var lvl = state.data.fleets[state.fleet];
    anim.routes = [];
    ARMS.forEach(function (arm) {
      var g = layers[arm];
      g.clearLayers();
      var day = lvl[arm].days[state.day];
      if (!day) return;
      day.routes.forEach(function (r) {
        var colour = r.kind === "electric" ? ELECTRIC : DIESEL;
        // A white casing under each route keeps it readable over the road layer and
        // street tiles. The full route stays faint underneath the trail, so the plan is
        // visible while the truck is part way along it.
        var planCase = L.polyline(r.path, { color: "#FFFFFF", weight: 7, opacity: 0.85, interactive: false }).addTo(g);
        var planLine = L.polyline(r.path, { color: colour, weight: 4, opacity: 0.35 })
          .bindTooltip("Truck " + r.vehicle + (r.trip > 1 ? ", trip " + r.trip : "") + ", " +
            (r.kind === "electric" ? "electric" : "diesel") + ", " + fmt(r.km, 1) + " km, " +
            fmt(r.co2e_kg, 1) + " kg CO2-e, " + r.stops.length + " stops", { sticky: true })
          .addTo(g);
        r.stops.forEach(function (st) {
          // A scheduled stop is a ring in its truck's colour, filled in once collected, so it reads
          // apart from the small white dots of today's new requests (Jordan, 2026-11-01).
          st.marker = L.circleMarker([st.lat, st.lon], { radius: 5.5, color: colour, weight: 2.5,
            fillColor: "#15181C", fillOpacity: 0.6 })
            .bindTooltip("Request " + st.id + ", " + fmt(st.vol, 1) + " m3, waited " +
              st.age + (st.age === 1 ? " business day" : " business days"))
            .addTo(g);
        });
        var ra = buildRouteAnim(r, colour, g, arm);
        ra.plan = [[planCase, 0.85], [planLine, 0.35]];
        anim.routes.push(ra);
      });
    });
    // One clock for both plans, from the earliest departure to the last truck home.
    anim.t0 = Infinity; anim.t1 = 0;
    anim.routes.forEach(function (ra) {
      anim.t0 = Math.min(anim.t0, ra.anchors[0].t);
      anim.t1 = Math.max(anim.t1, ra.anchors[ra.anchors.length - 1].t);
    });
    if (!isFinite(anim.t0)) { anim.t0 = 18000; anim.t1 = 18001; }
    applyAnim();
    requestsView();
  }

  // ---------------------------------------------------------------- panels

  // The figures under each map are for the day it shows (Jordan, 2026-11-01). They were the
  // whole run's, which made it hard to tell which numbers moved with the playback bar. The
  // whole run's figures are in the comparison section's table.
  function dayBlock(d) {
    var rows = [
      ["CO2-e this day", fmt(d.co2e_kg, 1) + " kg"],
      ["Distance", fmt(d.km, 1) + " km"],
      ["Collected", fmt(d.collected, 0)],
      ["New requests", fmt(d.arrivals, 0)],
      ["Waiting at day end", fmt(d.backlog_end, 0)]
    ];
    return rows.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("");
  }

  function pct(a, b) { return b ? (a - b) / b * 100 : null; }

  function updatePanels() {
    var lvl = state.data.fleets[state.fleet];
    var kd = lvl.distance.kpis, ke = lvl.emissions.kpis;
    var dKg = ke.co2e_kg_per_request - kd.co2e_kg_per_request;
    var p = pct(ke.co2e_kg_per_request, kd.co2e_kg_per_request);
    var items = [
      [signed(dKg, 2) + " kg", "Change in CO2-e per request"],
      [p === null ? "n/a" : signed(p, 1) + "%", "Change in CO2-e per request, percent"],
      [signed(ke.km_total - kd.km_total, 0) + " km", "Change in distance"],
      [signed(ke.km_diesel - kd.km_diesel, 0) + " km", "Change in diesel distance"],
      [signed(ke.km_electric - kd.km_electric, 0) + " km", "Change in electric distance"]
    ];
    $("diff").innerHTML = items.map(function (i) {
      return '<div><div class="v">' + i[0] + '</div><div class="l">' + i[1] + "</div></div>";
    }).join("");

    $("kpi-distance").innerHTML = dayBlock(lvl.distance.days[state.day]);
    $("kpi-emissions").innerHTML = dayBlock(lvl.emissions.days[state.day]);
    var n = lvl.distance.days.length;
    Array.prototype.forEach.call(document.querySelectorAll(".fs-day, .day-label"), function (e) {
      e.textContent = "Day " + (state.day + 1) + " of " + n;
    });
    $("run-table").tBodies[0].innerHTML = KPI_ROWS.filter(function (r) {
      return kd[r[1]] !== null && kd[r[1]] !== undefined || ke[r[1]] !== null && ke[r[1]] !== undefined;
    }).map(function (r) {
      return "<tr><th scope=\"row\">" + r[0] + "</th><td>" + fmt(kd[r[1]], r[2]) + "</td><td>" + fmt(ke[r[1]], r[2]) +
        "</td><td>" + signed(ke[r[1]] - kd[r[1]], r[2]) + "</td></tr>";
    }).join("");
    drawCumulative(lvl);
    drawFleetBars();
  }

  // Keeps the run position, so a fleet change compares both maps at the same moment.
  function render() { anim.dots = dotsFor(anim.t); drawDay(); updatePanels(); syncRun(); }


  // ---------------------------------------------------------------- tables and graphs

  var KPI_ROWS = [
    ["CO2-e per request, kg", "co2e_kg_per_request", 2],
    ["CO2-e, measured days, kg", "co2e_kg_total", 0],
    ["Requests collected", "requests_served", 0],
    ["Distance, km", "km_total", 0],
    ["Diesel distance, km", "km_diesel", 0],
    ["Electric distance, km", "km_electric", 0],
    ["Collected on the advised day, percent", "advised_on_time_pct", 1],
    ["Collected within one business day of the advised day, percent", "late_within_1_bday_pct", 1],
    ["Collected within 7 business days of booking, percent", "pct_within_7_bdays", 1],
    ["Mean wait, business days", "mean_age_bdays", 2],
    ["90th percentile wait, business days", "p90_age_bdays", 1],
    ["Longest wait, business days", "max_age_bdays", 0],
    ["Requests waiting at steady state", "steady_state_backlog", 1]
  ];

  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }

  // Hand-drawn SVG so the page stays offline-capable. Each plan has its own colour, kept apart
  // from the diesel orange and electric blue of the maps, which mean a truck type.
  function frame(W, H, l, r, t, b, maxV) {
    var out = "";
    for (var i = 0; i <= 4; i++) {
      var v = maxV * i / 4, y = t + (H - t - b) * (1 - i / 4);
      out += '<line class="ch-axis" x1="' + l + '" x2="' + (W - r) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="ch-text" x="' + (l - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + String(+v.toFixed(2)) + "</text>";
    }
    return out;
  }
  function legend(x, y) {
    return '<rect class="ch-bar-dist" x="' + x + '" y="' + y + '" width="14" height="10"/><text class="ch-text" x="' + (x + 20) + '" y="' + (y + 9) + '">Distance-only</text>' +
      '<rect class="ch-bar-emis" x="' + (x + 120) + '" y="' + y + '" width="14" height="10"/><text class="ch-text" x="' + (x + 140) + '" y="' + (y + 9) + '">Emissions-aware</text>';
  }

  function drawCumulative(lvl) {
    var W = 560, H = 260, l = 52, r = 16, t = 34, b = 34;
    var dd = lvl.distance.days, de = lvl.emissions.days, n = dd.length;
    var top = 0;
    dd.concat(de).forEach(function (d) { top = Math.max(top, d.co2e_running_kg); });
    var maxV = niceMax(top);
    function X(i) { return l + (n > 1 ? i * (W - l - r) / (n - 1) : 0); }
    function Y(v) { return t + (H - t - b) * (1 - v / maxV); }
    function path(days) { return days.map(function (d, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(d.co2e_running_kg).toFixed(1); }).join(" "); }
    var svg = frame(W, H, l, r, t, b, maxV);
    svg += '<path class="ch-dist" d="' + path(dd) + '"/><path class="ch-emis" d="' + path(de) + '"/>';
    svg += '<line class="ch-now" x1="' + X(state.day) + '" x2="' + X(state.day) + '" y1="' + t + '" y2="' + (H - b) + '"/>';
    [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i) {
      svg += '<text class="ch-text" x="' + X(i) + '" y="' + (H - 14) + '" text-anchor="' + (i === n - 1 ? "end" : i === 0 ? "start" : "middle") + '">Day ' + (i + 1) + "</text>";
    });
    $("chart-cum").innerHTML = svg + legend(l, 8);
  }

  function drawFleetBars() {
    var W = 560, H = 260, l = 52, r = 16, t = 34, b = 34;
    var keys = Object.keys(state.data.fleets).sort();
    var top = 0;
    keys.forEach(function (k) {
      ARMS.forEach(function (a) { top = Math.max(top, state.data.fleets[k][a].kpis.co2e_kg_per_request); });
    });
    var maxV = niceMax(top), slot = (W - l - r) / keys.length, bw = Math.min(34, slot / 3);
    function Y(v) { return t + (H - t - b) * (1 - v / maxV); }
    var svg = frame(W, H, l, r, t, b, maxV);
    // A pre-calculated fleet key is the electric trucks of four, so k * 25 is its share. A live run can
    // have one to six trucks, so its label comes from the counts the visitor chose (liveParams).
    var lp = state.data.liveParams;
    function fleetLabel(k) {
      return lp ? lp.n_electric + " electric, " + lp.n_diesel + " diesel" : (k * 25) + "% electric";
    }
    keys.forEach(function (k, i) {
      var cx = l + slot * (i + 0.5);
      [["distance", -bw - 2, "ch-bar-dist"], ["emissions", 2, "ch-bar-emis"]].forEach(function (a) {
        var v = state.data.fleets[k][a[0]].kpis.co2e_kg_per_request;
        svg += '<rect class="' + a[2] + '" x="' + (cx + a[1]) + '" y="' + Y(v) + '" width="' + bw + '" height="' + (Y(0) - Y(v)) + '"><title>' +
          (a[0] === "distance" ? "Distance-only" : "Emissions-aware") + ", " + fleetLabel(k) + ", " + fmt(v, 2) + " kg per request</title></rect>";
      });
      svg += '<text class="ch-text' + (k === state.fleet ? " ch-now-label" : "") + '" x="' + cx + '" y="' + (H - 14) + '" text-anchor="middle">' + fleetLabel(k) + "</text>";
    });
    $("chart-fleet").innerHTML = svg + legend(l, 8);
  }

  // ---------------------------------------------------------------- pre-calculated plans

  var livePlans = [];
  function allPlans() {
    var seeds = seedIndex.length ? seedIndex.map(function (e) { return e.seed; }) : [DEFAULT_SEED];
    var list = seeds.map(function (n) { return { kind: "seed", seed: n, key: "seed:" + n, label: "Scenario, seed " + n }; });
    return list.concat(livePlans);
  }
  function syncPlan() {
    var sel = $("plan");
    sel.innerHTML = "";
    allPlans().forEach(function (pl) {
      var o = document.createElement("option");
      o.value = pl.key; o.textContent = pl.label;
      if (pl.key === state.key) o.selected = true;
      sel.appendChild(o);
    });
    renderSeeds();
  }

  function loadSeed(n, done) {
    window.SRCRO_SEEDS = window.SRCRO_SEEDS || {};
    if (window.SRCRO_SEEDS[n]) return done(window.SRCRO_SEEDS[n]);
    var sc = document.createElement("script");
    sc.src = "seeds/seed-" + n + ".js";
    sc.onload = function () { done(window.SRCRO_SEEDS[n]); };
    sc.onerror = function () { document.body.classList.remove("is-loading"); $("source-note").hidden = false; $("source-note").className = "source-note source-warn"; $("source-note").textContent = "Could not load seed " + n + ". Check the connection and pick it again."; $("plan").disabled = false; };
    document.head.appendChild(sc);
  }

  function pickPlan(key) {
    key = typeof key === "string" ? key : $("plan").value;
    var pl = allPlans().filter(function (p) { return p.key === key; })[0];
    if (!pl) return;
    if (pl.kind === "live") return useData(pl.data, "live", pl.key);
    $("plan").disabled = true;
    // A scenario file is about 3 MB, so on a phone the wait is long enough to look like a frozen page.
    // The note becomes a highlighted banner with a spinner and the old figures dim until the new ones
    // arrive (Jordan, 2026-11-02).
    $("source-note").hidden = false;
    $("source-note").className = "source-note source-loading";
    $("source-note").textContent = "Loading scenario " + pl.seed + ", one moment";
    document.body.classList.add("is-loading");
    loadSeed(pl.seed, function (d) {
      document.body.classList.remove("is-loading");
      $("plan").disabled = false; useData(d, "seed", pl.key);
    });
  }

  // ---------------------------------------------------------------- all scenarios

  function seedChange(e, fleet) {
    var f = e.by_fleet[fleet];
    if (!f || !f.distance) return null;
    return { d: f.distance, e: f.emissions, pct: (f.emissions - f.distance) / f.distance * 100 };
  }

  function renderSeeds() {
    var sec = $("seeds");
    if (!seedIndex.length || state.fleet === null) return;
    sec.hidden = false;
    var rows = seedIndex.map(function (e) { return { seed: e.seed, c: seedChange(e, state.fleet), raw: e.by_fleet[state.fleet] }; });
    var ok = rows.filter(function (r) { return r.c; });
    var pcts = ok.map(function (r) { return r.c.pct; }).sort(function (a, b) { return a - b; });
    var med = pcts.length ? (pcts[Math.floor((pcts.length - 1) / 2)] + pcts[Math.ceil((pcts.length - 1) / 2)]) / 2 : null;
    var lower = ok.filter(function (r) { return r.c.pct < 0; }).length;
    var items = pcts.length ? [
      [signed(med, 1) + "%", "Median change in CO2-e per request"],
      [signed(pcts[0], 1) + "% to " + signed(pcts[pcts.length - 1], 1) + "%", "Range over the seeds"],
      [lower + " of " + ok.length, "Seeds where emissions-aware is lower"]
    ] : [["n/a", "No change to show, the distance-only plan already emits nothing at this fleet"]];
    $("seed-summary").innerHTML = items.map(function (i) {
      return '<div><div class="v">' + i[0] + '</div><div class="l">' + i[1] + "</div></div>";
    }).join("");

    // Drawn at the card's own width so it fills the page, and against the distance-only plan's CO2-e per
    // request, how emission-heavy each scenario was to begin with, instead of the seed number, which
    // carries no meaning (Jordan, 2026-11-02). Text stays at its real size because the view box is the
    // drawn size.
    var svgEl = $("chart-seeds"), box = svgEl.parentNode.getBoundingClientRect();
    var W = Math.max(320, Math.round(box.width) || 560), H = W < 600 ? 260 : 320, l = 70, r = 16, t = 16, b = 52;
    svgEl.setAttribute("viewBox", "0 0 " + W + " " + H);
    var lo = Math.min(0, pcts[0] || 0), hi = Math.max(0, pcts[pcts.length - 1] || 0);
    var span = Math.max(1, hi - lo);
    var ds = ok.map(function (rw) { return rw.c.d; });
    if (!ds.length) ds = [0, 1];   // all electric: no change to plot, so just the axes
    var xlo = Math.min.apply(null, ds), xhi = Math.max.apply(null, ds), pad = Math.max(0.02, (xhi - xlo) * 0.05);
    xlo -= pad; xhi += pad;
    function X(v) { return l + (W - l - r) * (v - xlo) / (xhi - xlo); }
    function Y(v) { return t + (H - t - b) * (1 - (v - lo) / span); }
    var svg = "";
    for (var q = 0; q <= 4; q++) {
      var v = lo + span * q / 4, y = Y(v);
      svg += '<line class="ch-axis" x1="' + l + '" x2="' + (W - r) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="ch-text" x="' + (l - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + String(+v.toFixed(0)) + "%</text>";
    }
    var xt = W < 600 ? 3 : 5;
    for (var k = 0; k <= xt; k++) {
      var xv = xlo + (xhi - xlo) * k / xt;
      svg += '<text class="ch-text" x="' + X(xv) + '" y="' + (H - b + 18) + '" text-anchor="' + (k === 0 ? "start" : k === xt ? "end" : "middle") + '">' + fmt(xv, 2) + "</text>";
    }
    svg += '<text class="ch-text" x="' + (l + (W - l - r) / 2) + '" y="' + (H - 8) + '" text-anchor="middle">Distance-only plan, kg CO2-e per request</text>';
    // The y axis says what it is, so the caption above only says one point per seed (Jordan, 2026-11-02).
    var ym = t + (H - t - b) / 2;
    svg += '<text class="ch-text" x="14" y="' + ym + '" text-anchor="middle" transform="rotate(-90 14 ' + ym + ')">Change in CO2-e per request</text>';
    svg += '<line class="ch-now" x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
    ok.slice().sort(function (a, c) { return (state.key === "seed:" + a.seed) - (state.key === "seed:" + c.seed); }).forEach(function (rw) {
      var cur = state.key === "seed:" + rw.seed;   // drawn last, so the chosen seed sits on top
      svg += '<circle cx="' + X(rw.c.d) + '" cy="' + Y(rw.c.pct) + '" r="' + (cur ? 6 : 4) + '" class="' + (cur ? "ch-dot-now" : "ch-dot") +
        '" data-seed="' + rw.seed + '"><title>Seed ' + rw.seed + ", distance-only " + fmt(rw.c.d, 2) + " kg per request, change " + signed(rw.c.pct, 1) + "%</title></circle>";
    });
    $("chart-seeds").innerHTML = svg;

    $("seed-table").tBodies[0].innerHTML = rows.map(function (rw) {
      var cur = state.key === "seed:" + rw.seed;
      return "<tr" + (cur ? ' class="cur"' : "") + '><th scope="row"><button type="button" class="linkbtn" data-seed="' + rw.seed +
        '">Seed ' + rw.seed + "</button></th>" +
        (rw.c ? "<td>" + fmt(rw.c.d, 2) + "</td><td>" + fmt(rw.c.e, 2) + "</td><td>" + signed(rw.c.e - rw.c.d, 2) +
          "</td><td>" + signed(rw.c.pct, 1) + "%</td>"
          : "<td>" + fmt(rw.raw && rw.raw.distance, 2) + "</td><td>" + fmt(rw.raw && rw.raw.emissions, 2) + "</td><td>n/a</td><td>n/a</td>") + "</tr>";
    }).join("");
  }

  // ---------------------------------------------------------------- planner input and output

  // The 900 pre-calculated runs are the planner's own solution.json files, gzipped in raw/ and
  // unpacked here. A live run's files come from the live server. The input view is cut from
  // the same file (settings, requests, intake outcomes), so there is no second copy to drift.
  var raw = { cache: {}, plan: null };
  var RAW_PREVIEW_CHARS = 60000;

  function rawSource(armOverride) {
    var arm = armOverride || (document.querySelector('input[name="rawarm"]:checked') || {}).value || "distance";
    var pl = allPlans().filter(function (p) { return p.key === state.key; })[0];
    if (!pl) return null;
    if (pl.kind === "live") {
      if (!pl.jobId || !liveFeature("solutions")) return null;
      return { url: LIVE.api + "/api/job/" + pl.jobId + "/solution/" + arm, gz: false, headers: {},
        name: "live-" + pl.jobId + "-" + state.fleet + "ev-" + arm };
    }
    var name = "seed-" + pl.seed + "-" + state.fleet + "ev-" + arm;
    return { url: "raw/" + name + ".json.gz", gz: true, name: name };
  }

  function gunzipText(buf) {
    if (!window.DecompressionStream) return Promise.reject(new Error("this browser cannot unpack the compressed file, use Download compressed original"));
    var ds = new DecompressionStream("gzip");
    var stream = new Response(new Blob([buf]).stream().pipeThrough(ds));
    return stream.text();
  }

  function loadRaw() {
    var src = rawSource();
    if (!src) return Promise.reject(new Error("this live run's files are not offered by the live server yet"));
    if (raw.cache[src.url]) return Promise.resolve({ src: src, sol: raw.cache[src.url] });
    $("raw-status").textContent = "Loading " + src.name;
    return fetch(src.url, { headers: src.headers || {} }).then(function (r) {
      if (!r.ok) throw new Error("the file is not available (" + r.status + ")");
      return src.gz ? r.arrayBuffer().then(gunzipText) : r.text();
    }).then(function (text) {
      var sol = { text: text, json: JSON.parse(text) };
      raw.cache = {}; raw.cache[src.url] = sol;   // one file at a time, they are about 1 MB
      $("raw-status").textContent = "";
      return { src: src, sol: sol };
    });
  }

  // ---- requests arriving and the day each is assigned (Jordan, 2026-11-01). From each plan's own
  // solution.json: today's arrivals as small white dots on that plan's map, and a panel with the day's
  // re-plan figures, how far ahead today's requests were booked and the requests themselves.
  var reqCache = {}, reqToken = 0;
  function loadSolution(arm) {
    var src = rawSource(arm);
    if (!src) return Promise.reject(new Error("no files for this run"));
    if (reqCache[src.url]) return Promise.resolve(reqCache[src.url]);
    return fetch(src.url, { headers: src.headers || {} }).then(function (r) {
      if (!r.ok) throw new Error("the file is not available (" + r.status + ")");
      return src.gz ? r.arrayBuffer().then(gunzipText) : r.text();
    }).then(function (text) {
      var j = JSON.parse(text), byId = {};
      (j.collected || []).forEach(function (c) { byId[c.id] = c; });
      var keys = Object.keys(reqCache);
      if (keys.length >= 4) delete reqCache[keys[0]];   // a few files of about 1 MB each
      reqCache[src.url] = { j: j, byId: byId };
      return reqCache[src.url];
    });
  }

  function requestsView() {
    if (!$("requests") || !state.data) return;
    var token = ++reqToken, lvl = state.data.fleets[state.fleet];
    ARMS.forEach(function (arm) {
      var dayRec = lvl[arm].days[state.day];
      if (!dayRec) return;
      var simDay = dayRec.day, box = $("req-" + arm);
      // solution.json counts days from the first warm-up day, the playback bar from the first measured
      // day, so table and tooltip days are shifted onto the bar's numbering to match "Day N of M".
      var shown = function (d) { return d - simDay + state.day + 1; };
      loadSolution(arm).then(function (s) {
        if (token !== reqToken) return;   // the day or scenario moved on while the file loaded
        var today = (s.j.arrivals || []).filter(function (a) { return a.arrival_day === simDay; });
        var daily = (s.j.daily || []).filter(function (d) { return d.day === simDay; })[0] || {};
        var hist = {}, notYet = 0;
        today.forEach(function (a) {
          var c = s.byId[a.id];
          if (!c || c.advised_day === undefined) { notYet++; } else { var k = c.advised_day - simDay; hist[k] = (hist[k] || 0) + 1; }
          // Today's new requests are small white dots with a dark edge, readable on every base map.
          L.circleMarker([a.lat, a.lon], { radius: 3.5, color: "#15181C", weight: 1.5,
            fillColor: "#FFFFFF", fillOpacity: 1 })
            .bindTooltip("New request " + a.id + ", " + fmt(a.volume_m3, 1) + " m3, arrived today. " +
              (c && c.advised_day !== undefined ? "Advised for day " + shown(c.advised_day) + " (" + (c.advised_day - simDay) + " business days ahead), collected on day " + shown(c.collected_day) + "." : "Not collected within this run."))
            .addTo(layers[arm]);
        });
        var maxH = 1; Object.keys(hist).forEach(function (k) { maxH = Math.max(maxH, hist[k]); });
        var bars = "";
        for (var k = 1; k <= 7; k++) {
          var n = hist[k] || 0;
          bars += '<div class="req-bar"><span style="height:' + (100 * n / maxH).toFixed(0) + '%"></span><b>' + n + "</b><i>+" + k + "</i></div>";
        }
        var later = Object.keys(hist).filter(function (k) { return +k > 7; }).reduce(function (m, k) { return m + hist[k]; }, 0);
        box.querySelector(".req-figs").innerHTML = [
          // Arrived, collected and waiting are already under the map, so only what is new here.
          [daily.planned_later, "planned for later days"], [fmt((daily.solver_ms || 0) / 1000, 1) + " s", "re-plan solve time"]
        ].map(function (f) { return '<div><div class="v">' + (f[0] === undefined ? "n/a" : f[0]) + '</div><div class="l">' + f[1] + "</div></div>"; }).join("");
        box.querySelector(".req-hist").innerHTML = bars;
        box.querySelector(".req-hist-note").textContent = "Business days from arrival to the advised day" +
          (later ? ", " + later + " more than 7 ahead" : "") + (notYet ? ", " + notYet + " not collected within the run" : "") + ".";
        box.querySelector("tbody").innerHTML = today.map(function (a) {
          var c = s.byId[a.id];
          return "<tr><th scope=\"row\">" + a.id + "</th><td>" + fmt(a.volume_m3, 1) + "</td><td>" +
            (c && c.advised_day !== undefined ? shown(c.advised_day) + " (+" + (c.advised_day - simDay) + ")" : "n/a") + "</td><td>" +
            (c ? shown(c.collected_day) : "not in run") + "</td><td>" + (c ? c.age_bdays : "n/a") + "</td></tr>";
        }).join("");
        $("requests-note").textContent = "";
      }).catch(function (e) { if (token === reqToken) $("requests-note").textContent = "Request detail is not available for this run: " + e.message + "."; });
    });
  }

  function inputOf(j) {
    return { _about: "Input of one run, cut from its solution.json. config is the resolved settings, arrivals are every request the planner received, flagged and rejected are the intake outcomes.",
      tag: j.tag, manifest: j.manifest, config: j.config, depot: j.depot, arrivals: j.arrivals,
      flagged: j.flagged || [], rejected: j.rejected || [] };
  }

  function pretty(obj, full) {
    var t = JSON.stringify(obj, null, 1);
    if (full || t.length <= RAW_PREVIEW_CHARS) return t;
    return t.slice(0, RAW_PREVIEW_CHARS) + "\n... cut here, " + Math.round((t.length - RAW_PREVIEW_CHARS) / 1000) + " thousand more characters. Download the file for all of it.";
  }

  function showRaw(kind) {
    loadRaw().then(function (res) {
      var j = res.sol.json, view = $("raw-view");
      var obj = kind === "in" ? inputOf(j) : j;
      var sum = kind === "in" ? [
        [String((j.arrivals || []).length), "Requests that arrived"],
        [String((j.flagged || []).length), "Flagged at intake"],
        [String((j.rejected || []).length), "Rejected at intake"],
        [String(j.config.demand.arrivals_per_day), "Arrivals per day, setting"],
        [String(j.config.fleet.length), "Trucks in the fleet"]
      ] : [
        [String((j.collected || []).length), "Requests collected"],
        [String(Object.keys(j.day_routes || {}).length), "Days with routes"],
        [String((j.daily || []).length), "Days simulated"],
        [fmt(j.kpis.total_emissions_kg_co2e, 0) + " kg", "Tier-1 CO2-e, measured days"]
      ];
      $("raw-status").textContent = "Run tag " + j.tag;
      $("raw-summary").innerHTML = sum.map(function (i) { return '<div><div class="v">' + i[0] + '</div><div class="l">' + i[1] + "</div></div>"; }).join("");
      var rows = kind === "in" ? (j.arrivals || []).slice(0, 15) : (j.collected || []).slice(0, 15);
      var wrap = $("raw-table-wrap");
      if (rows.length) {
        var cols = Object.keys(rows[0]).filter(function (c) { return typeof rows[0][c] !== "object" || rows[0][c] === null; }).slice(0, 8);
        $("raw-table").tHead.innerHTML = "<tr>" + cols.map(function (c) { return '<th scope="col">' + c + "</th>"; }).join("") + "</tr>";
        $("raw-table").tBodies[0].innerHTML = rows.map(function (r) {
          return "<tr>" + cols.map(function (c) { var v = r[c]; return "<td>" + (typeof v === "number" ? +v.toFixed(5) : v === null ? "" : String(v)) + "</td>"; }).join("") + "</tr>";
        }).join("");
        $("raw-table-cap").textContent = "First " + rows.length + (kind === "in" ? " requests that arrived" : " requests collected");
        wrap.hidden = false;
      } else { wrap.hidden = true; }
      // The file shows in full height, with no scroll area of its own, so long files open at their
      // first lines with a button for the rest (Jordan, 2026-11-01).
      var lines = pretty(obj, false).split("\n"), PREVIEW = 80, more = $("raw-more");
      if (!more) {
        more = document.createElement("button");
        more.id = "raw-more"; more.type = "button"; more.className = "secondary";
        view.parentNode.insertBefore(more, view.nextSibling);
      }
      function fill(all) {
        view.textContent = all || lines.length <= PREVIEW ? lines.join("\n") : lines.slice(0, PREVIEW).join("\n") + "\n...";
        more.hidden = lines.length <= PREVIEW;
        more.textContent = all ? "Show the first " + PREVIEW + " lines" : "Show the whole file (" + lines.length.toLocaleString() + " lines)";
        more.onclick = function () { fill(!all); if (all) view.scrollIntoView({ block: "start" }); };
      }
      fill(false);
      view.hidden = false;
      var gz = $("raw-gz");
      gz.hidden = !res.src.gz; gz.href = res.src.url; gz.setAttribute("download", res.src.name + ".json.gz");
    }).catch(function (e) { $("raw-status").textContent = "Could not load: " + e.message; });
  }

  function downloadRaw(kind) {
    loadRaw().then(function (res) {
      var text = kind === "in" ? JSON.stringify(inputOf(res.sol.json), null, 1) : res.sol.text;
      var url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      var a = document.createElement("a");
      a.href = url; a.download = res.src.name + (kind === "in" ? ".input.json" : ".solution.json");
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }).catch(function (e) { $("raw-status").textContent = "Could not load: " + e.message; });
  }

  function rawSetup() {
    $("raw-view-in").addEventListener("click", function () { showRaw("in"); });
    $("raw-view-out").addEventListener("click", function () { showRaw("out"); });
    $("raw-dl-in").addEventListener("click", function () { downloadRaw("in"); });
    $("raw-dl-out").addEventListener("click", function () { downloadRaw("out"); });
    // A new scenario or fleet makes what is on screen stale, so it is cleared until asked for.
    Array.prototype.forEach.call(document.querySelectorAll('input[name="rawarm"]'), function (r) {
      r.addEventListener("change", function () { rawClear(); });
    });
  }
  function rawClear() {
    $("raw-view").hidden = true; $("raw-table-wrap").hidden = true; $("raw-summary").innerHTML = "";
    $("raw-status").textContent = ""; $("raw-gz").hidden = true;
  }

  // ---------------------------------------------------------------- full screen maps

  function setExpanded(wrap, on) {
    wrap.classList.toggle("expanded", on);
    var btn = wrap.querySelector(".fs-btn");
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", (on ? "Exit full screen, " : "Full screen, ") + btn.getAttribute("data-map") + " map");
    document.body.classList.toggle("fs-open", on);
    movePlayer(wrap, on);
    // The container changes size under Leaflet, so it re-measures once the layout settles.
    setTimeout(function () { ARMS.forEach(function (a) { maps[a].invalidateSize(); }); }, 60);
  }
  // The browser's full screen shows only the map, so the playback bar moves into it while it is
  // open and back to its marker after (Jordan, 2026-11-01). Moving the node keeps every listener.
  var playerHome = null;
  function movePlayer(wrap, on) {
    var bar = document.querySelector(".player");
    if (!bar) return;
    if (on) {
      if (!playerHome) { playerHome = document.createComment("player"); bar.parentNode.insertBefore(playerHome, bar); }
      wrap.appendChild(bar);
    } else if (playerHome && bar.parentNode === wrap) {
      playerHome.parentNode.insertBefore(bar, playerHome);
    }
  }
  function collapseAll() {
    // Also leave the browser's own full screen, or its fixed layout outlives the overlay class.
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen().catch(function () {}); } catch (e) { /* already out */ } }
    Array.prototype.forEach.call(document.querySelectorAll(".map-wrap.expanded"), function (w) { setExpanded(w, false); });
  }
  // Full screen is the browser's where it exists, and a fixed overlay where it does not
  // (iPhone Safari), so the button works on every device.
  function setupFullscreen() {
    Array.prototype.forEach.call(document.querySelectorAll(".fs-btn"), function (btn) {
      btn.addEventListener("click", function () {
        var wrap = btn.closest(".map-wrap");
        if (wrap.classList.contains("expanded")) {
          if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
          setExpanded(wrap, false);
          return;
        }
        setExpanded(wrap, true);
        if (wrap.requestFullscreen) { try { wrap.requestFullscreen().catch(function () {}); } catch (e) { /* overlay only */ } }
      });
    });
    document.addEventListener("fullscreenchange", function () { if (!document.fullscreenElement) collapseAll(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") collapseAll(); });
  }

  // ---------------------------------------------------------------- controls

  function buildFleetButtons() {
    var box = $("fleet-buttons");
    box.innerHTML = "";
    [0, 1, 2, 3, 4].forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = (n * 25) + "%";
      b.setAttribute("aria-label", (n * 25) + " percent electric, " + n + " of 4 trucks");
      b.setAttribute("data-fleet", String(n));
      b.title = n + " of 4 trucks electric";
      var have = !!(state.data && state.data.fleets[String(n)]);
      b.disabled = !have;
      if (!have) b.title = "Not in this export";
      b.setAttribute("aria-pressed", String(String(n) === state.fleet));
      b.addEventListener("click", function () { setFleet(String(n)); });
      box.appendChild(b);
    });
  }

  function setFleet(k) {
    pause();
    state.fleet = k;
    var n = state.data.fleets[k].distance.days.length;
    state.day = Math.min(state.day, n - 1);
    Array.prototype.forEach.call($("fleet-buttons").children, function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-fleet") === k));
    });
    syncPlan();
    render();
    $("rawdata").hidden = false;
    rawClear();
  }

  var BASEMAPS = {
    street: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", opacity: 0.6, maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
    satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      opacity: 0.9, maxZoom: 19,
      attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics and the GIS User Community" }
  };
  // Background switch inside each map (Jordan, 2026-11-01, as on the bus tracker). Both maps change
  // together, so the two plans are always compared on the same background.
  var basemapNow = "none";
  function backgroundControl() {
    var Ctl = L.Control.extend({
      options: { position: "bottomleft" },
      onAdd: function () {
        var box = L.DomUtil.create("div", "map-bg");
        box.setAttribute("role", "group"); box.setAttribute("aria-label", "Map background");
        [["none", "Plain"], ["street", "Street"], ["satellite", "Satellite"]].forEach(function (o) {
          var b = L.DomUtil.create("button", "", box);
          b.type = "button"; b.textContent = o[1]; b.setAttribute("data-bg", o[0]);
          b.setAttribute("aria-pressed", String(o[0] === basemapNow));
          L.DomEvent.on(b, "click", function (e) { L.DomEvent.stop(e); setBasemap(o[0]); });
        });
        L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box);
        return box;
      }
    });
    return new Ctl();
  }

  function setBasemap(mode) {
    basemapNow = mode;
    Array.prototype.forEach.call(document.querySelectorAll(".map-bg button"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-bg") === mode));
    });
    ARMS.forEach(function (a) {
      Object.keys(BASEMAPS).forEach(function (k) {
        var layer = streetLayers[a + k];
        if (layer && k !== mode) maps[a].removeLayer(layer);
      });
      if (!BASEMAPS[mode]) return;
      var key = a + mode;
      if (!streetLayers[key]) {
        var b = BASEMAPS[mode];
        streetLayers[key] = L.tileLayer(b.url, { maxZoom: b.maxZoom, opacity: b.opacity, attribution: b.attribution });
      }
      streetLayers[key].addTo(maps[a]);
      streetLayers[key].bringToBack();
    });
  }

  function showSource(data) {
    var m = data.meta;
    var note = $("source-note");
    note.hidden = false;
    note.className = "source-note" + (m.test_data ? " source-warn" : "");
    if (m.test_data) {
      note.textContent = "TEST DATA from the unit test fixture. Not a run of the planner.";
    } else if (state.live) {
      note.textContent = "Showing the live plan, seed " + m.seed + ", " + m.arrivals_per_day +
        " requests a day, " + days(m.measured_days, "measured") + " after " + days(m.warmup_days, "warm-up") + ".";
    } else {
      note.textContent = "Pre-calculated scenario, seed " + m.seed + ", " + m.arrivals_per_day +
        " requests a day, " + days(m.measured_days, "measured") + " after " + days(m.warmup_days, "warm-up") + ".";
    }
  }

  // mode is "seed" for a pre-calculated scenario or "live" for a visitor's re-plan. Neither
  // carries map layers, the boundary and roads of layers.js stay on the maps.
  function useData(data, mode, key) {
    pause();
    var live = mode === "live";
    state.data = data;
    state.live = live;
    state.key = key;
    buildFleetButtons();
    var keys = Object.keys(state.data.fleets).sort();
    var k = state.data.fleets[state.fleet] ? state.fleet : (state.data.fleets["1"] ? "1" : keys[0]);
    state.day = 0; anim.t = 1;   // a new scenario opens on day 1, drawn whole
    showSource(state.data);
    setFleet(k);
    // A finished live run gets a fresh view. On an iPhone (2026-11-02) a live run showed only the depot
    // square on an empty map, which fits a view zoomed far out that the visitor's touch then kept.
    if (live && maps.distance) {
      userMoved = false;
      setTimeout(function () { ARMS.forEach(function (a) { maps[a].invalidateSize(); }); if (mapsSized()) fitAll(); }, 50);
    }
  }

  // ---------------------------------------------------------------- live plan

  // Where the live API is. On the laptop it is the same origin. On the hosted page it is the
  // proxy function of scripts/cloud/live_replan/. Visitors type nothing, the presenter starts
  // the server from presenter.html.
  var LIVE = { api: "" };
  function liveFetch(path, opts) {
    opts = opts || {};
    return fetch(LIVE.api + path, { method: opts.method || "GET", headers: { "Content-Type": "application/json" },
      body: opts.body, cache: "no-store" });
  }
  // Whether the live server has a feature. The laptop's own server has all of them. The hosted
  // stack lists what it has in live-config.js (written by scripts/cloud/live_replan/deploy.sh),
  // so a page published before its stack is redeployed does not offer what would fail.
  function liveFeature(name) {
    if (!LIVE.api) return true;
    var f = (window.SRCRO_LIVE || {}).features;
    return !!f && f.indexOf(name) >= 0;
  }
  window.SRCRO_PAGE = { liveFetch: liveFetch, feature: liveFeature };   // for extras.js, the intake check

  // A random id the page keeps so the server can tell one phone from another behind a shared
  // network address. It is not a login and carries nothing about the visitor.
  function visitorId() {
    var id = null;
    try { id = localStorage.getItem("srcro_visitor"); } catch (e) { /* private mode */ }
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      var a = new Uint8Array(12);
      (window.crypto || window.msCrypto).getRandomValues(a);
      id = Array.prototype.map.call(a, function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
      try { localStorage.setItem("srcro_visitor", id); } catch (e) { /* kept for this page view only */ }
    }
    return id;
  }
  var VISITOR = visitorId();
  // This device's re-plan, kept until it finishes (Jordan, 2026-11-02). The server already lets a device
  // have one run queued or running. Keeping its id means a reload picks the run back up, shows its
  // progress and keeps Re-plan now greyed until it is done, instead of offering a button that is refused.
  function myJob(id) {
    try { if (id) localStorage.setItem("srcro_job", id); else localStorage.removeItem("srcro_job"); } catch (e) { /* this view only */ }
  }
  function myJobId() { try { return localStorage.getItem("srcro_job"); } catch (e) { return null; } }

  function secs(n) {
    n = Math.round(n);
    return n < 90 ? n + " s" : Math.round(n / 60) + " min";
  }

  // Live Plan page (Jordan, 2026-11-01). The page always shows its content, greyed out with a message
  // over it while the live server cannot take a re-plan. Other pages keep hiding the live parts.
  var LIVE_PAGE = document.body.getAttribute("data-page") === "live";
  var LIVE_OFF = ["The live plan is not available", "The pre-calculated scenarios are on Explore Scenarios."];
  // Automatic start turned off by the presenter (2026-11-02): the page as it was before auto-wake.
  var LIVE_OFF_MANUAL = ["The live plan is off", "Ask the presenter at the stand to switch it on. The pre-calculated scenarios are on Explore Scenarios."];
  function liveGate(on, msg) {
    if (!LIVE_PAGE) return;
    document.body.classList.toggle("live-off", !on);
    var main = document.querySelector("main");
    if (main) main.inert = !on;   // greyed out also means out of reach for the keyboard and screen readers
    if (!on && $("live-off-title")) {
      var m = msg || LIVE_OFF;
      $("live-off-title").textContent = m[0];
      $("live-off-detail").textContent = m[1] || "";
    }
  }

  function liveSetup() {
    // A fresh random seed on every page load (Jordan, 2026-11-01), in the server's own random range,
    // so two visitors rarely run the same scenario but either can type a seed back in to repeat one.
    function newSeed() { $("live-seed").value = String(1 + Math.floor(Math.random() * 99999)); }
    newSeed();
    // Randomise settings (Jordan, 2026-11-01): a random scenario and random choices inside the server's
    // limits (1 to 6 trucks in all). Measured days are randomised too since 2026-11-02 (Jordan), a 40 day
    // run takes a few minutes, and the status line names the length picked.
    // It only fills the form, the visitor still presses Re-plan now.
    $("live-shuffle").addEventListener("click", function () {
      function pick(sel) { var o = $(sel).options; $(sel).selectedIndex = Math.floor(Math.random() * o.length); }
      var ev, diesel;
      do { ev = Math.floor(Math.random() * 5); diesel = Math.floor(Math.random() * 5); } while (ev + diesel < 1 || ev + diesel > 6);
      $("live-ev").value = String(ev); $("live-diesel").value = String(diesel);
      pick("live-compaction"); pick("live-factor"); pick("live-days");
      // 10 to 50 a day, the rates the project tested, so a random pick rarely meets the time limit.
      $("live-arrivals").value = String(10 + Math.floor(Math.random() * 41));
      newSeed();
      $("live-status").textContent = "Settings randomised: " + ev + " electric and " + diesel + " diesel trucks, " +
        $("live-compaction").selectedOptions[0].textContent.toLowerCase() + " compaction, " +
        $("live-factor").selectedOptions[0].textContent.split(",")[0].toLowerCase() + " diesel factor, " +
        $("live-arrivals").value + " requests a day, " + $("live-days").value + " measured days, seed " + $("live-seed").value + ".";
    });
    $("live-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var body = {
        seed: parseInt($("live-seed").value, 10),
        n_electric: parseInt($("live-ev").value, 10),
        n_diesel: parseInt($("live-diesel").value, 10),
        // The server reads n_electric and ignores fleet_ev beside it, but the proxy's LIVE_RUN log line,
        // which the presenter's statistics count, only has fleet_ev (it showed null before).
        fleet_ev: parseInt($("live-ev").value, 10),
        compaction: parseFloat($("live-compaction").value),
        diesel_factor: $("live-factor").value,
        arrivals_per_day: parseInt($("live-arrivals").value, 10),
        measure_days: parseInt($("live-days").value, 10),
        visitor: VISITOR
      };
      var trucks = body.n_electric + body.n_diesel;
      if (trucks < 1 || trucks > 6) { $("live-status").textContent = "Choose between 1 and 6 trucks in total."; return; }
      $("live-go").disabled = true;
      // Re-plan now always re-plans, also for settings identical to a recent run (Jordan, 2026-11-02,
      // replacing the same evening's instant answer from the cache). The recent list is how to reopen one.
      // Asleep or still starting: wake it and send once it is ready (Jordan, 2026-11-02, 10 minute idle stop).
      if (hosted.control && !hosted.ready) { wakeThenSend(body); return; }
      sendReplan(body);
    });

    function sendReplan(body) {
      $("live-go").disabled = true;
      $("live-status").textContent = "Sending your settings to the planner";
      liveFetch("/api/replan", { method: "POST", body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, code: r.status, j: j || {} }; }); })
        .then(function (res) {
          if (res.code === 401) throw new Error("the live server refused the request (401), ask at the stand");
          if (res.code === 429 || res.code === 503) {
            // A limit, not a fault. The server says which one and when to try again.
            $("live-go").disabled = false;
            // The server's own limits reply with error, API Gateway's throttle with message only.
            $("live-status").textContent = (res.j.error || res.j.message || "The live server is busy, try again in a moment") +
              (res.j.retry_after_s ? " (about " + secs(res.j.retry_after_s) + ")" : "");
            return null;
          }
          if (!res.ok) throw new Error(res.j.error || "the re-plan could not start");
          if (res) { myJob(res.j.id); poll(res.j.id); }
        })
        .catch(function (e) { $("live-go").disabled = false; $("live-status").textContent = "Could not start: " + e.message; });
    }

    // POST /wake every 5 s (idempotent, it starts a stopped server and answers 409 while one is still
    // stopping) until the health route says live, then sends the visitor's settings. Gives up after
    // 6 minutes, a normal start takes about 2.
    function wakeThenSend(body) {
      var t0 = Date.now();
      hosted.waking = true;
      $("live-status").textContent = "Starting the live server, under a minute. Your re-plan starts by itself when it is ready.";
      (function beat() {
        if (hosted.ready) { hosted.waking = false; sendReplan(body); return; }
        if (Date.now() - t0 > 6 * 60 * 1000) {
          hosted.waking = false; $("live-go").disabled = false;
          $("live-status").textContent = "The live server did not start in time. Press Re-plan now to try again.";
          return;
        }
        fetch(hosted.control + "/wake", { method: "POST", cache: "no-store" })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { code: r.status, j: j || {} }; }); })
          .then(function (res) {
            if (res.code === 403) {
              hosted.waking = false; $("live-go").disabled = false;
              $("live-status").textContent = res.j.auto_wake === false ?
                "The live server is off and automatic start is turned off. Ask the presenter at the stand." :
                "The live plan has finished. The pre-calculated scenarios are still on Explore Scenarios.";
              refreshStatus();
              return;
            }
            if (res.j.state === "running") checkReady();
            setTimeout(beat, 5000);
          })
          .catch(function () { setTimeout(beat, 5000); });
      })();
    }

    var local = location.protocol === "http:" && /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
    if (local) {
      // Served by scripts/demo_server.py on the laptop, task 063's path, unchanged.
      liveFetch("/api/health").then(function (r) { return r.json(); }).then(function (h) {
        if (!h.live) { liveGate(false); return; }   // routing services are down, the section stays out of sight
        $("live").hidden = false;
        $("live-form").hidden = false;
        liveGate(true);
      }).catch(function () { liveGate(false); /* no server, the section stays hidden */ });
      return;
    }
    var cfg = window.SRCRO_LIVE;
    if (!cfg || !cfg.proxy || !cfg.control) { liveGate(false); return; }   // no web live plan configured
    LIVE.api = cfg.proxy.replace(/\/$/, "");
    // Only the Live Plan page shows the server, so only it polls. Explore Scenarios (and its stand
    // screen, open all day) would otherwise add to API Gateway's 10 requests a second for nothing.
    if (LIVE_PAGE) hostedSetup(cfg.control.replace(/\/$/, ""));
    var mine = LIVE_PAGE && myJobId();
    if (mine) {   // a run this device started before a reload: follow it to the end
      $("live-go").disabled = true;
      $("live-status").textContent = "Picking up your re-plan";
      poll(mine);
    }
  }

  // ---- hosted page: server status, the form opens by itself once the presenter's server is on

  // misses counts status or health polls in a row that got no answer. The account runs at most 10
  // Lambda calls at once, so a burst of phones can get a 503 now and then (stress_check.py,
  // 2026-11-01). One miss must not grey out the page, three in a row (about 15 to 45 s) do.
  var hosted = { control: "", timer: null, misses: 0, ready: false, waking: false, recent: [] };
  var MISSES_BEFORE_OFF = 3;

  function sydneyTime(iso) {
    // Time only, with the weekday when it is not today, the recent list keeps every run (2026-11-04, was 24 hours).
    var d = new Date(iso), opts = { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" };
    var day = function (x) { return x.toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" }); };
    if (day(d) !== day(new Date())) opts.weekday = "short";
    return d.toLocaleString("en-AU", opts);
  }

  function hostedSetup(control) {
    hosted.control = control;
    $("live").hidden = false;
    $("live-hosted").hidden = false;
    renderRecent();
    refreshStatus();
    hosted.timer = setInterval(function () { if (!document.hidden) refreshStatus(); }, 15000);
    // The status box's job progress moves faster than the server state, so health has its own beat.
    hosted.fast = setInterval(function () { if (!document.hidden && hosted.on) checkReady(); }, 5000);
    hosted.wakeBeat = setInterval(function () { if (!document.hidden && hosted.waking) refreshStatus(); }, 5000);
    loadRecent();
    hosted.recentBeat = setInterval(function () { if (!document.hidden) loadRecent(); }, 60000);
  }

  // Status box (Jordan, 2026-11-01): shows the server is up, its two routing services answer,
  // and what the planner is computing right now, from the public part of /api/health.
  function statusBox(kind, title) {
    $("sb-dot").className = "sb-dot sb-" + kind;
    $("sb-state").textContent = title;
    if (kind !== "on") { showQueue([]); $("sb-run").hidden = true; ["sb-osrm", "sb-vroom"].forEach(function (id) { $(id).className = "sb-check"; }); $("sb-done").textContent = ""; }
  }
  // "2 electric and 1 diesel trucks, 25 requests a day, 10 measured days", from a run's public settings.
  function runWhat(p) {
    var trucks = [];
    if (p.n_electric) trucks.push(p.n_electric + " electric");
    if (p.n_diesel) trucks.push(p.n_diesel + " diesel");
    return trucks.join(" and ") + (p.n_electric + p.n_diesel === 1 ? " truck, " : " trucks, ") +
      p.arrivals_per_day + " requests a day, " + p.measure_days + " measured days";
  }
  // The re-plans waiting in line, in order (Jordan, 2026-11-02). The server lists their settings only.
  function showQueue(list) {
    var ol = $("sb-queue");
    if (!ol) return;
    list = list || [];
    ol.hidden = !list.length;
    ol.innerHTML = list.map(function (q) { return "<li>" + runWhat(q.params || {}) + "</li>"; }).join("");
  }
  function statusHealth(h) {
    $("sb-osrm").className = "sb-check " + (h.osrm ? "sb-ok" : "sb-bad");
    $("sb-vroom").className = "sb-check " + (h.vroom ? "sb-ok" : "sb-bad");
    $("sb-done").textContent = (h.finished || 0) + (h.finished === 1 ? " re-plan" : " re-plans") + " finished since start";
    showQueue(h.queued);
    var r = h.running;
    $("sb-run").hidden = !r;
    if (!r) return;
    // Several re-plans can plan at once since 2026-11-02, this line describes the one running longest.
    var n = h.running_count || 1;
    $("sb-run-what").textContent = (n > 1 ? n + " at once, the longest: " : "") + runWhat(r.params || {}) + ", " + secs(r.elapsed_s) + " so far";
    ["distance", "emissions"].forEach(function (arm) {
      var d = (r.days_done || {})[arm] || 0;
      $("sb-prog-" + arm).value = r.days_total ? d / r.days_total : 0;
      $("sb-day-" + arm).textContent = "day " + d + " of " + r.days_total;
    });
  }

  function refreshStatus() {
    fetch(hosted.control + "/status", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("status " + r.status);
      return r.json();
    }).then(function (s) {
      hosted.misses = 0;
      var line;
      if (s.expired) line = "The live plan has finished for this expo. The pre-calculated scenarios are still available.";
      else if (s.state === "stopped" && s.auto_wake === false) line = "The live server is off. Ask the presenter at the stand to start it.";
      else if (s.state === "stopped") line = "The live server is asleep. Press Re-plan now and it starts by itself in under a minute.";
      else if (s.state === "pending") line = "The live server is starting. This takes under a minute.";
      else if (s.state === "stopping") line = "The live server is going to sleep. Press Re-plan now and it starts again.";
      else if (s.state === "running") line = "The live server is on. It sleeps 10 minutes after the last re-plan has finished.";
      else line = "The live server is " + s.state + ".";
      $("live-server").textContent = line;
      hosted.on = s.state === "running" && !s.expired;
      if (!hosted.on) hosted.ready = false;
      if (s.expired) statusBox("off", "Ended");
      else if (s.state === "running") statusBox("on", "Live");
      else if (s.state === "pending") statusBox("wait", "Starting");
      else if (s.state === "stopping") statusBox("wait", "Going to sleep");
      else statusBox("off", "Asleep");
      // An expired window can still report running until the scheduled stop, so the form stays shut.
      if (s.expired) {
        $("live-form").hidden = true;
        liveGate(false, ["The live plan has finished", "Thanks for visiting. The pre-calculated scenarios are still on Explore Scenarios."]);
      } else if (s.state === "running") checkReady();
      else if (s.auto_wake === false && !hosted.waking) {
        $("live-form").hidden = true;
        liveGate(false, s.state === "pending" ? ["Starting up", "This takes under a minute. The page will update automatically when it is ready."] : LIVE_OFF_MANUAL);
      } else {
        // Asleep, starting or going to sleep: the form stays open, Re-plan now wakes the server.
        $("live-form").hidden = false;
        liveGate(true);
        $("live-queue").textContent = "";
      }
    }).catch(function () {
      if (++hosted.misses < MISSES_BEFORE_OFF) return;   // keep what the page shows, try again next beat
      $("live-server").textContent = "The live server is not responding right now.";
      hosted.on = false; statusBox("off", "Unreachable");
      liveGate(false, ["Cannot reach the live server", "Check your internet connection, or ask the presenter at the stand."]);
    });
  }

  function checkReady() {
    liveFetch("/api/health").then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); })
      .then(function (res) {
        // Throttled, not off: treat as a missed beat. 429 is API Gateway's own throttle.
        if ((res.code === 503 && !(res.j && res.j.off)) || res.code === 429) {
          if (++hosted.misses < MISSES_BEFORE_OFF) return;
        } else hosted.misses = 0;
        if (res.code === 401) {
          $("live-server").textContent = "The live plan is not open yet. Ask the presenter at the stand.";
          $("live-form").hidden = true;
        } else if (res.code !== 200 || !res.j.live) {
          hosted.ready = false;
          if (res.code === 200) { statusBox("wait", "Warming up"); statusHealth(res.j); }
          // Still warming up its routing services. The form stays open, a re-plan waits for it.
          $("live-form").hidden = false;
          liveGate(true);
        } else {
          hosted.ready = true;
          $("live-form").hidden = false;
          liveGate(true);
          statusBox("on", "Live"); statusHealth(res.j);
          // Short lines (Jordan, 2026-11-02): the list below names what is waiting.
          var q = res.j.waiting ? res.j.waiting + (res.j.waiting === 1 ? " re-plan is" : " re-plans are") + " waiting." :
            (res.j.busy ? "One re-plan is running." : "Nobody is waiting.");
          $("live-queue").textContent = q;
        }
      })
      .catch(function () {
        if (++hosted.misses < MISSES_BEFORE_OFF) return;
        $("live-form").hidden = true; liveGate(false);
      });
  }

  // A poll gives up, and gives the button back, when the job is gone (404: the server restarted or
  // the presenter stopped it), the server says it is off, or about a minute of polls in a row got no
  // usable answer. Before this it polled forever with Re-plan now greyed out (demo sweep, 2026-11-02).
  var POLL_GIVE_UP = 30;
  function poll(id) {
    var bar = $("live-progress");
    bar.hidden = false;
    var misses = 0, over = false;
    function stop(msg) {
      over = true;
      myJob(null);
      clearInterval(t);
      bar.hidden = true;
      $("live-go").disabled = false;
      if (msg) $("live-status").textContent = msg;
    }
    function miss() {
      if (++misses >= POLL_GIVE_UP) stop("Lost contact with the live server while your re-plan ran. Press Re-plan now to try again.");
    }
    var t = setInterval(function () {
      liveFetch("/api/job/" + id).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { code: r.status, j: j || {} }; });
      }).then(function (res) {
        if (over) return;   // a slow reply that lands after the run was already handled
        var j = res.j;
        if (res.code === 404) { stop("The live server no longer has your re-plan, it may have restarted. Press Re-plan now to try again."); return; }
        if (j.off) { stop("The live server was switched off before your re-plan finished."); return; }
        if (!j.progress) { miss(); return; }   // a dropped or throttled request, keep polling for a while
        misses = 0;
        bar.value = j.progress.fraction;
        var d = j.progress.days_done, q = j.queue || {};
        // Clearer lines (Jordan, 2026-11-02). Days are counted the way the visitor chose them: the first
        // days of a run are warm-up days that fill the backlog and are not measured.
        if (j.state === "queued") {
          var ahead = (q.position || 1) - 1;
          $("live-status").textContent = (ahead ? "Waiting in line, " + ahead + (ahead === 1 ? " re-plan" : " re-plans") + " ahead of yours. " :
            "Yours is next. ") + "Starts in about " + secs(q.est_wait_s) + ", then takes about " + secs(q.est_run_s) + ".";
        } else if (j.state === "running") {
          var total = j.progress.days_total, measured = (j.params && j.params.measure_days) || total, warm = total - measured;
          var slow = Math.min(d.distance, d.emissions);
          $("live-status").textContent = "Planning your run: " + (slow < warm ? "warming up the backlog, day " + (slow + 1) + " of " + warm :
            "measured day " + Math.min(measured, slow - warm + 1) + " of " + measured) + ", " + Math.round(j.elapsed_s) + " s so far.";
        }
        if (j.state === "queued" || j.state === "running") return;
        stop();
        if (j.state === "done") {
          $("live-status").textContent = "Finished in " + Math.round(j.elapsed_s) + " seconds. The maps below now show your run.";
          showLiveResult(j, false);
          if (hosted.control) { refreshStatus(); setTimeout(loadRecent, 8000); }   // the server copies it to the cache meanwhile
        } else {
          $("live-status").textContent = "The re-plan did not finish: " + (j.error || "an unknown error");
        }
      }).catch(function () { if (!over) miss(); });   // keep polling through a dropped request, for a while
    }, hosted.control ? 2000 : 1000);
  }

  // A finished run on the maps, from the server (cached false) or from the recent re-plans cache, whose
  // files the server may no longer hold, so a cached run offers no solution downloads.
  function showLiveResult(j, cached) {
    var lf = Object.keys(j.result.fleets)[0];
    var plan = { kind: "live", key: "live:" + livePlans.length, data: j.result, jobId: cached ? null : j.id, label: "Live plan, scenario " +
      j.result.meta.seed + ", " + (j.params.n_electric !== undefined ? j.params.n_electric + " electric and " + j.params.n_diesel + " diesel" : (lf * 25) + "% electric fleet") + ", " + j.result.meta.arrivals_per_day + " requests a day, " +
      j.result.meta.measured_days + " measured days" + (cached ? ", from the recent list" : "") };
    // The result keys its one fleet by electric trucks only, so the counts the visitor chose
    // travel with it for the chart labels and the truck shading (compacted body size).
    if (j.params) j.result.liveParams = j.params;
    livePlans.push(plan);
    state.fleet = lf;
    useData(j.result, "live", plan.key);
  }

  // ---- recent re-plans (Jordan, 2026-11-02, kept indefinitely since 2026-11-04), served by the control function
  // from what the server copies to S3, so they open while the server sleeps. Everyone's runs, settings only.
  // The control function sends 50 at a time. hosted.recent is the newest page, hosted.older the pages the
  // visitor asked for, so the minute-by-minute refresh of the newest does not drop them.
  var FACTOR_NAMES = { low: "low", central: "central", high: "high", stress: "stress" };
  function recentLine(r) {
    var p = r.params || {};
    return runWhat(p) + ", seed " + p.seed + ", " + (FACTOR_NAMES[p.diesel_factor] || p.diesel_factor) + " diesel factor" +
      (p.compaction && p.compaction !== 1 ? ", " + p.compaction + " times compaction" : "");
  }
  function renderRecent() {
    var box = $("live-recent"), ul = $("live-recent-list"), more = $("live-recent-more");
    if (!box || !ul) return;
    var seen = {}, runs = (hosted.recent || []).concat(hosted.older || []).filter(function (r) {
      if (seen[r.id]) return false;
      seen[r.id] = true; return true;
    });
    box.hidden = false;   // also while empty, a hidden box looked like a fault (2026-11-04)
    ul.textContent = "";
    if (!runs.length) {
      var none = document.createElement("li");
      none.className = "recent-what";
      none.textContent = hosted.recentLoaded ? "No re-plans yet." : hosted.recentFailed ? "The recent re-plans could not be loaded. It tries again every minute." : "Loading the recent re-plans.";
      ul.appendChild(none);
    }
    runs.forEach(function (r) {
      var li = document.createElement("li"), t = document.createElement("span"), what = document.createElement("span");
      t.className = "recent-time"; t.textContent = sydneyTime(r.t);
      what.className = "recent-what"; what.textContent = recentLine(r);
      li.appendChild(t); li.appendChild(what);
      if (r.outcome === "timed_out") {
        var tag = document.createElement("span");
        tag.className = "recent-time"; tag.textContent = "Timed out after " + Math.round((r.elapsed_s || 0) / 60) + " minutes, no result";
        li.appendChild(tag);
      } else {
        var b = document.createElement("button");
        b.type = "button"; b.className = "secondary"; b.textContent = "Open";
        b.addEventListener("click", function () { openRecent(r, "Opened the run from " + sydneyTime(r.t) + ". The maps below now show it."); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
    if (more) more.hidden = !hosted.recentMore;
  }
  function loadRecent() {
    if (!hosted.control) return;
    fetch(hosted.control + "/recent?limit=50", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.runs) { hosted.recentFailed = true; renderRecent(); return; }
        hosted.recent = j.runs; hosted.recentLoaded = true; hosted.recentFailed = false;
        // Until the visitor has asked for older runs, the end of the list is the newest page's.
        if (!(hosted.older && hosted.older.length)) { hosted.recentMore = !!j.more; hosted.recentNext = j.next; }
        renderRecent();
      })
      .catch(function () { hosted.recentFailed = true; renderRecent(); /* keeps any list the page already has */ });
  }
  function loadOlder() {
    if (!hosted.control || !hosted.recentNext) return;
    var btn = $("live-recent-more");
    btn.disabled = true;
    fetch(hosted.control + "/recent?limit=50&before=" + encodeURIComponent(hosted.recentNext), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        btn.disabled = false;
        if (!j || !j.runs) return;
        hosted.older = (hosted.older || []).concat(j.runs);
        hosted.recentMore = !!j.more; hosted.recentNext = j.next;
        renderRecent();
      })
      .catch(function () { btn.disabled = false; });
  }
  if ($("live-recent-more")) $("live-recent-more").addEventListener("click", loadOlder);
  function openRecent(r, msg) {
    $("live-status").textContent = "Opening the run from " + sydneyTime(r.t);
    return fetch(hosted.control + "/recent/" + encodeURIComponent(r.id)).then(function (res) {
      if (!res.ok) throw new Error(res.status === 404 ? "that run has no result to open" : "status " + res.status);
      return res.arrayBuffer();
    }).then(function (buf) {
      // Served gzip with Content-Encoding, which the browser normally unpacks. If the bytes still start
      // with the gzip magic number, unpack them here, as the raw data files are.
      var u = new Uint8Array(buf);
      if (u[0] === 0x1f && u[1] === 0x8b && window.DecompressionStream) {
        return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).json();
      }
      return JSON.parse(new TextDecoder().decode(u));
    }).then(function (j) {
      showLiveResult(j, true);
      $("live-status").textContent = msg;
      return true;
    }).catch(function (e) { $("live-status").textContent = "Could not open that run: " + e.message + "."; loadRecent(); return false; });
  }

  // ---------------------------------------------------------------- start

  if (!window.L) return;
  // A page opened in a background tab or a hidden pane has map containers of zero size at
  // load. Leaflet then fits the view to nothing, the centre becomes NaN, the pan sync below
  // throws and the maps stay empty (found on the laptop check of 2026-10-31 with a hidden
  // frame). So the first fit waits until both containers have a real size. Leaflet queues the
  // layers until a view exists. Later resizes keep the visitor's own pan and zoom.
  function mapsSized() {
    return ARMS.some(mapSized);   // at least one map to fit, fitAll skips a hidden one
  }
  makeMap("distance"); makeMap("emissions");
  // A view more than 3 zoom levels further out than the city's own fit shows nothing useful (the
  // whole city under the depot marker), so a resize refits it even after the visitor moved the map.
  function zoomedAway() {
    var shown = ARMS.filter(mapSized)[0];
    if (!shown) return false;
    var m = maps[shown], pts = [LAYERS.depot];
    (LAYERS.boundary || []).forEach(function (r) { pts = pts.concat(r); });
    if (pts.length < 3) return false;
    return m.getZoom() < m.getBoundsZoom(L.latLngBounds(pts)) - 3;
  }
  // The first fit can happen at a size the pane later leaves, so until the visitor pans or
  // zooms a resize refits the view, after that their own view is kept.
  var userMoved = false;
  ARMS.forEach(function (a) {
    ["pointerdown", "wheel", "keydown"].forEach(function (ev) {
      maps[a].getContainer().addEventListener(ev, function () { userMoved = true; }, { passive: true });
    });
  });
  var wasSized = mapsSized();
  if (wasSized) fitAll();
  syncMaps();
  if (window.ResizeObserver) {
    var shownBefore = {};
    ARMS.forEach(function (a) { shownBefore[a] = mapSized(a); });
    var watcher = new ResizeObserver(function () {
      var now = mapsSized();
      // A map that has just appeared takes the view of the one already shown, or a fresh fit.
      var appeared = ARMS.filter(function (a) { return mapSized(a) && !shownBefore[a]; });
      ARMS.forEach(function (a) { shownBefore[a] = mapSized(a); });
      if (now && (!wasSized || !userMoved || zoomedAway())) fitAll();
      else appeared.forEach(function (a) {
        var other = maps[a === "distance" ? "emissions" : "distance"];
        maps[a].invalidateSize();
        if (mapSized(a === "distance" ? "emissions" : "distance")) maps[a].setView(other.getCenter(), other.getZoom(), { animate: false });
        else fitAll();
      });
      wasSized = now;
    });
    ARMS.forEach(function (a) { watcher.observe($("map-" + a)); });
  }
  $("play").addEventListener("click", function () { if (playing()) pause(); else playRun(); });
  $("speed").addEventListener("click", function () {
    run.speed = SPEEDS[(SPEEDS.indexOf(run.speed) + 1) % SPEEDS.length];
    this.textContent = run.speed + "×";
    this.setAttribute("aria-label", "Playback speed, " + run.speed + " times");
    this.setAttribute("aria-pressed", String(run.speed > 1));
  });
  $("run").addEventListener("input", function () {
    var v = parseInt(this.value, 10);   // read before pause(), which moves the slider back to the clock
    pause();
    var day = Math.min(runDays() - 1, Math.floor(v / STEPS)), t = (v % STEPS) / (STEPS - 1);
    if (day !== state.day) showDay(day, t);
    else { anim.t = t; anim.dots = dotsFor(t); applyAnim(); syncRun(); }
  });
  // Which maps show (Jordan, 2026-11-01): both side by side, or one at full width.
  Array.prototype.forEach.call(document.querySelectorAll('input[name="mapview"]'), function (r) {
    r.addEventListener("change", function () {
      if (!this.checked) return;
      document.querySelector(".maps").setAttribute("data-view", this.value);
      setTimeout(function () { ARMS.forEach(function (a) { maps[a].invalidateSize(); }); fitAll(); }, 50);
    });
  });
  setupFullscreen();
  // The playback bar hides itself while none of the views it drives is on screen: the scenario
  // controls, the running totals, the maps and the day table and charts (Jordan, 2026-11-01). The top
  // margin leaves out what sits under the bar itself.
  if (window.IntersectionObserver && document.querySelector(".player")) {
    var onScreen = [];
    var watcherIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = onScreen.indexOf(e.target);
        if (e.isIntersecting && i < 0) onScreen.push(e.target);
        if (!e.isIntersecting && i >= 0) onScreen.splice(i, 1);
      });
      document.querySelector(".player").classList.toggle("player-away", onScreen.length === 0);
    }, { rootMargin: "-90px 0px 0px 0px" });
    [".controls", "#totals", ".maps", ".compare", "#requests"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) watcherIO.observe(el);
    });
  }
  rawSetup();
  $("plan").addEventListener("change", function () { pickPlan(); });
  function seedClick(ev) {
    var el = ev.target.closest("[data-seed]");
    if (el) { pickPlan("seed:" + el.getAttribute("data-seed")); $("plan").scrollIntoView({ block: "center" }); }
  }
  $("seed-table").addEventListener("click", seedClick);
  $("chart-seeds").addEventListener("click", seedClick);
  var seedResize = null;   // the seed chart is drawn at the card's width, so it is redrawn when that changes
  window.addEventListener("resize", function () {
    clearTimeout(seedResize);
    seedResize = setTimeout(function () { if (state.data && !$("seeds").hidden) renderSeeds(); }, 200);
  });
  // The maps and controls are up before any scenario has loaded. Seed 1 loads like any other.
  buildFleetButtons();
  syncPlan();
  pickPlan(state.key);
  liveSetup();
})();
