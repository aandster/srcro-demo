// Expo demo (task 063). Plain JavaScript and Leaflet 1.9.4. The shared map layers are in
// layers.js (window.SRCRO_LAYERS), each scenario in seeds/seed-<n>.js, both written by
// scripts/export_demo_data.py. Presentation only, every number on the page is descriptive
// and the page says so.
(function () {
  "use strict";

  var DIESEL = "#D55E00", ELECTRIC = "#0072B2", ROAD = "#B9C0C8", INK = "#15181C";
  var ARMS = ["distance", "emissions"];
  var PLAY_MS = 1400;

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
    var m = L.map("map-" + arm, { preferCanvas: true, zoomSnap: 0.25, attributionControl: true });
    m.attributionControl.setPrefix(false);
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
    ARMS.forEach(function (a) { maps[a].fitBounds(b, { padding: [10, 10] }); });
  }

  function syncMaps() {
    ARMS.forEach(function (a) {
      var other = a === "distance" ? "emissions" : "distance";
      maps[a].on("move", function () {
        if (syncing) return;
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
  var FALLBACK_KMH = 30;   // only for an export without planned times

  function hhmm(sec) {
    var m = Math.round(sec / 60), h = Math.floor(m / 60) % 24;
    return (h < 10 ? "0" : "") + h + ":" + (m % 60 < 10 ? "0" : "") + (m % 60);
  }

  // Each route becomes a list of anchors (clock time, metres along the road geometry). A truck
  // drives between two stops at an even pace along the geometry, standing still for each
  // stop's service time, so the planned arrival and departure times are met exactly.
  function buildRouteAnim(r, colour, g) {
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
    var trail = L.polyline([], { color: colour, weight: 4, opacity: 1, interactive: false }).addTo(g);
    var truck = L.marker(r.path[0], { interactive: false, keyboard: false, zIndexOffset: 1000,
      icon: L.divIcon({ className: "truck", iconSize: [24, 24],
        html: '<span style="background:' + colour + '">' + r.vehicle + "</span>" }) }).addTo(g);
    var stops = r.stops.map(function (st, j) { return { leave: anchors[2 * j + 2].t, marker: st.marker, vol: st.vol || 0 }; });
    return { path: r.path, cum: cum, anchors: anchors, trail: trail, truck: truck, stops: stops, colour: colour,
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

  function applyAnim() {
    var T = anim.t0 + anim.t * (anim.t1 - anim.t0);
    anim.routes.forEach(function (ra) {
      var d = distanceAt(ra, T), k = 0;
      while (k < ra.cum.length - 1 && ra.cum[k + 1] <= d) k++;
      var pts = ra.path.slice(0, k + 1), pos = ra.path[k];
      if (k < ra.path.length - 1 && ra.cum[k + 1] > ra.cum[k]) {
        var f = (d - ra.cum[k]) / (ra.cum[k + 1] - ra.cum[k]);
        pos = [ra.path[k][0] + (ra.path[k + 1][0] - ra.path[k][0]) * f, ra.path[k][1] + (ra.path[k + 1][1] - ra.path[k][1]) * f];
        pts.push(pos);
      }
      ra.trail.setLatLngs(pts);
      ra.truck.setLatLng(pos);
      ra.truck.setOpacity(anim.dots ? 1 : 0);
      var load = 0;
      ra.stops.forEach(function (st) {
        var done = T >= st.leave;
        if (done) load += st.vol;
        st.marker.setStyle({ fillColor: done ? ra.colour : "#FFFFFF", fillOpacity: done ? 1 : 0.35 });
      });
      // The truck dot grows with what it has picked up, to full size at the 11 m3 body.
      if (ra.dot) ra.dot.style.transform = "scale(" + (0.8 + 1.0 * Math.min(1, load / TRUCK_CAPACITY_M3)).toFixed(2) + ")";
    });
    $("anim").value = String(Math.round(anim.t * 100));
    $("anim-label").textContent = hhmm(T);
  }

  function stopAnim() {
    if (anim.raf) cancelAnimationFrame(anim.raf);
    anim.raf = null;
    $("anim-play").textContent = "Animate day";
  }

  function playAnim() {
    if (anim.t >= 1) anim.t = 0;
    anim.dots = true;
    $("anim-play").textContent = "Pause";
    var DURATION_MS = 20000, last = null;
    function frame(now) {
      if (last === null) last = now;
      anim.t = Math.min(1, anim.t + (now - last) / DURATION_MS);
      last = now;
      applyAnim();
      if (anim.t >= 1) { stopAnim(); return; }
      anim.raf = requestAnimationFrame(frame);
    }
    anim.raf = requestAnimationFrame(frame);
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
        L.polyline(r.path, { color: "#FFFFFF", weight: 7, opacity: 0.85, interactive: false }).addTo(g);
        L.polyline(r.path, { color: colour, weight: 4, opacity: 0.35 })
          .bindTooltip("Truck " + r.vehicle + (r.trip > 1 ? ", trip " + r.trip : "") + ", " +
            (r.kind === "electric" ? "electric" : "diesel") + ", " + fmt(r.km, 1) + " km, " +
            fmt(r.co2e_kg, 1) + " kg CO2-e, " + r.stops.length + " stops", { sticky: true })
          .addTo(g);
        r.stops.forEach(function (st) {
          st.marker = L.circleMarker([st.lat, st.lon], { radius: 5, color: "#FFFFFF", weight: 1.5,
            fillColor: colour, fillOpacity: 1 })
            .bindTooltip("Request " + st.id + ", " + fmt(st.vol, 1) + " m3, waited " +
              st.age + (st.age === 1 ? " business day" : " business days"))
            .addTo(g);
        });
        anim.routes.push(buildRouteAnim(r, colour, g));
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
  }

  // ---------------------------------------------------------------- panels

  function kpiBlock(k) {
    var rows = [
      ["CO2-e per request", fmt(k.co2e_kg_per_request, 2) + " kg"],
      ["CO2-e, measured days", fmt(k.co2e_kg_total, 0) + " kg"],
      ["Requests collected", fmt(k.requests_served, 0)],
      ["Distance", fmt(k.km_total, 0) + " km"],
      ["Diesel distance", fmt(k.km_diesel, 0) + " km"],
      ["Electric distance", fmt(k.km_electric, 0) + " km"]
    ];
    return rows.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("");
  }

  function pct(a, b) { return b ? (a - b) / b * 100 : null; }

  function updatePanels() {
    var lvl = state.data.fleets[state.fleet];
    var kd = lvl.distance.kpis, ke = lvl.emissions.kpis;
    $("kpi-distance").innerHTML = kpiBlock(kd);
    $("kpi-emissions").innerHTML = kpiBlock(ke);
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

    var dd = lvl.distance.days[state.day], de = lvl.emissions.days[state.day];
    var rows = [
      ["Requests arrived", dd.arrivals, de.arrivals, 0],
      ["Collected this day", dd.collected, de.collected, 0],
      ["Waiting at day end", dd.backlog_end, de.backlog_end, 0],
      ["Distance, km", dd.km, de.km, 1],
      ["CO2-e this day, kg", dd.co2e_kg, de.co2e_kg, 1],
      ["CO2-e so far, kg", dd.co2e_running_kg, de.co2e_running_kg, 1]
    ];
    $("day-table").tBodies[0].innerHTML = rows.map(function (r) {
      return "<tr><th scope=\"row\">" + r[0] + "</th><td>" + fmt(r[1], r[3]) + "</td><td>" + fmt(r[2], r[3]) + "</td></tr>";
    }).join("");
    var n = lvl.distance.days.length;
    $("day-label").textContent = (state.day + 1) + " of " + n;
    Array.prototype.forEach.call(document.querySelectorAll(".fs-day"), function (e) {
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

  function render() { stopAnim(); anim.t = 1; anim.dots = false; drawDay(); updatePanels(); }


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
    keys.forEach(function (k, i) {
      var cx = l + slot * (i + 0.5);
      [["distance", -bw - 2, "ch-bar-dist"], ["emissions", 2, "ch-bar-emis"]].forEach(function (a) {
        var v = state.data.fleets[k][a[0]].kpis.co2e_kg_per_request;
        svg += '<rect class="' + a[2] + '" x="' + (cx + a[1]) + '" y="' + Y(v) + '" width="' + bw + '" height="' + (Y(0) - Y(v)) + '"><title>' +
          (a[0] === "distance" ? "Distance-only" : "Emissions-aware") + ", " + k + " electric, " + fmt(v, 2) + " kg per request</title></rect>";
      });
      svg += '<text class="ch-text' + (k === state.fleet ? " ch-now-label" : "") + '" x="' + cx + '" y="' + (H - 14) + '" text-anchor="middle">' + k + " electric</text>";
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
    sc.onerror = function () { $("source-note").hidden = false; $("source-note").textContent = "Could not load seed " + n + ". Check the connection and pick it again."; $("plan").disabled = false; };
    document.head.appendChild(sc);
  }

  function pickPlan(key) {
    key = typeof key === "string" ? key : $("plan").value;
    var pl = allPlans().filter(function (p) { return p.key === key; })[0];
    if (!pl) return;
    if (pl.kind === "live") return useData(pl.data, "live", pl.key);
    $("plan").disabled = true;
    $("source-note").hidden = false;
    $("source-note").textContent = "Loading seed " + pl.seed + ".";
    loadSeed(pl.seed, function (d) { $("plan").disabled = false; useData(d, "seed", pl.key); });
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

    var W = 560, H = 260, l = 52, r = 16, t = 34, b = 34;
    var lo = Math.min(0, pcts[0] || 0), hi = Math.max(0, pcts[pcts.length - 1] || 0);
    var span = Math.max(1, hi - lo);
    var n = seedIndex.length;
    function X(i) { return l + (W - l - r) * (i + 0.5) / n; }
    function Y(v) { return t + (H - t - b) * (1 - (v - lo) / span); }
    var svg = "";
    for (var q = 0; q <= 4; q++) {
      var v = lo + span * q / 4, y = Y(v);
      svg += '<line class="ch-axis" x1="' + l + '" x2="' + (W - r) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="ch-text" x="' + (l - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + String(+v.toFixed(0)) + "%</text>";
    }
    svg += '<line class="ch-now" x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
    rows.forEach(function (rw, i) {
      if (!rw.c) return;
      var cur = state.key === "seed:" + rw.seed;
      svg += '<circle cx="' + X(i) + '" cy="' + Y(rw.c.pct) + '" r="' + (cur ? 6 : 3.5) + '" class="' + (cur ? "ch-dot-now" : "ch-dot") +
        '" data-seed="' + rw.seed + '"><title>Seed ' + rw.seed + ", " + signed(rw.c.pct, 1) + "%</title></circle>";
    });
    svg += '<text class="ch-text" x="' + l + '" y="' + (H - 14) + '">Seed ' + seedIndex[0].seed + '</text><text class="ch-text" x="' + (W - r) +
      '" y="' + (H - 14) + '" text-anchor="end">Seed ' + seedIndex[n - 1].seed + "</text>";
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

  function rawSource() {
    var arm = (document.querySelector('input[name="rawarm"]:checked') || {}).value || "distance";
    var pl = allPlans().filter(function (p) { return p.key === state.key; })[0];
    if (!pl) return null;
    if (pl.kind === "live") {
      if (!pl.jobId || !liveFeature("solutions")) return null;
      return { url: LIVE.api + "/api/job/" + pl.jobId + "/solution/" + arm, gz: false, headers: liveHeaders(),
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
      view.textContent = pretty(obj, false);
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
    // The container changes size under Leaflet, so it re-measures once the layout settles.
    setTimeout(function () { ARMS.forEach(function (a) { maps[a].invalidateSize(); }); }, 60);
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
      b.type = "button"; b.textContent = String(n);
      b.setAttribute("aria-label", n + " electric trucks of four");
      var have = !!(state.data && state.data.fleets[String(n)]);
      b.disabled = !have;
      if (!have) b.title = "Not in this export";
      b.setAttribute("aria-pressed", String(String(n) === state.fleet));
      b.addEventListener("click", function () { setFleet(String(n)); });
      box.appendChild(b);
    });
  }

  function setFleet(k) {
    state.fleet = k;
    var n = state.data.fleets[k].distance.days.length;
    state.day = Math.min(state.day, n - 1);
    $("day").max = String(n); $("day").value = String(state.day + 1);
    Array.prototype.forEach.call($("fleet-buttons").children, function (b) {
      b.setAttribute("aria-pressed", String(b.textContent === k));
    });
    syncPlan();
    render();
    $("rawdata").hidden = false;
    rawClear();
  }

  function stop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    $("play").textContent = "Play"; $("play").setAttribute("aria-pressed", "false");
  }

  function play() {
    stopAnim();
    var n = state.data.fleets[state.fleet].distance.days.length;
    if (state.day >= n - 1) state.day = -1;
    $("play").textContent = "Pause"; $("play").setAttribute("aria-pressed", "true");
    state.timer = setInterval(function () {
      if (state.day >= n - 1) { stop(); return; }
      state.day += 1; $("day").value = String(state.day + 1); render();
    }, PLAY_MS);
    state.day += 1; $("day").value = String(state.day + 1); render();
  }

  var BASEMAPS = {
    street: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", opacity: 0.6, maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
    satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      opacity: 0.9, maxZoom: 19,
      attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics and the GIS User Community" }
  };
  function setBasemap(mode) {
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
    if (m.test_data) {
      note.textContent = "TEST DATA from the unit test fixture. Not a run of the planner.";
    } else if (state.live) {
      note.textContent = "Showing the live re-plan, scenario " + m.seed + ", " + m.arrivals_per_day +
        " requests a day, " + days(m.measured_days, "measured") + " after " + days(m.warmup_days, "warm-up") + ".";
    } else {
      note.textContent = "Pre-calculated scenario, seed " + m.seed + ", " + m.arrivals_per_day +
        " requests a day, " + days(m.measured_days, "measured") + " after " + days(m.warmup_days, "warm-up") + ".";
    }
  }

  // mode is "seed" for a pre-calculated scenario or "live" for a visitor's re-plan. Neither
  // carries map layers, the boundary and roads of layers.js stay on the maps.
  function useData(data, mode, key) {
    stop();
    stopAnim();
    var live = mode === "live";
    state.data = data;
    state.live = live;
    state.key = key;
    buildFleetButtons();
    var keys = Object.keys(state.data.fleets).sort();
    var k = state.data.fleets[state.fleet] ? state.fleet : (state.data.fleets["1"] ? "1" : keys[0]);
    state.day = 0;
    showSource(state.data);
    setFleet(k);
    $("live-back").hidden = !live;
  }

  // ---------------------------------------------------------------- live re-plan

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

  function secs(n) {
    n = Math.round(n);
    return n < 90 ? n + " s" : Math.round(n / 60) + " min";
  }

  function liveSetup() {
    $("live-random").addEventListener("change", function () { $("live-seed").disabled = this.checked; });
    $("live-back").addEventListener("click", function () { state.fleet = "1"; pickPlan("seed:" + DEFAULT_SEED); $("live-status").textContent = ""; });
    $("live-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var body = {
        seed: $("live-random").checked ? null : parseInt($("live-seed").value, 10),
        fleet_ev: parseInt($("live-fleet").value, 10),
        arrivals_per_day: parseInt($("live-arrivals").value, 10),
        measure_days: parseInt($("live-days").value, 10),
        visitor: VISITOR
      };
      $("live-go").disabled = true;
      $("live-status").textContent = "Starting both plans";
      liveFetch("/api/replan", { method: "POST", body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, code: r.status, j: j }; }); })
        .then(function (res) {
          if (res.code === 401) throw new Error("the live server refused the request (401), ask at the stand");
          if (res.code === 429 || res.code === 503) {
            // A limit, not a fault. The server says which one and when to try again.
            $("live-go").disabled = false;
            $("live-status").textContent = res.j.error + (res.j.retry_after_s ? " (about " + secs(res.j.retry_after_s) + ")" : "");
            return null;
          }
          if (!res.ok) throw new Error(res.j.error || "the re-plan could not start");
          if (res) poll(res.j.id);
        })
        .catch(function (e) { $("live-go").disabled = false; $("live-status").textContent = "Could not start: " + e.message; });
    });

    var local = location.protocol === "http:" && /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
    if (local) {
      // Served by scripts/demo_server.py on the laptop, task 063's path, unchanged.
      liveFetch("/api/health").then(function (r) { return r.json(); }).then(function (h) {
        if (!h.live) return;   // routing services are down, the section stays out of sight
        $("live").hidden = false;
        $("live-form").hidden = false;
      }).catch(function () { /* no server, the section stays hidden */ });
      return;
    }
    var cfg = window.SRCRO_LIVE;
    if (!cfg || !cfg.proxy || !cfg.control) return;   // no web live re-plan configured
    LIVE.api = cfg.proxy.replace(/\/$/, "");
    hostedSetup(cfg.control.replace(/\/$/, ""));
  }

  // ---- hosted page: server status, the form opens by itself once the presenter's server is on

  var hosted = { control: "", timer: null };

  function sydneyTime(iso) {
    return new Date(iso).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" });
  }

  function hostedSetup(control) {
    hosted.control = control;
    $("live").hidden = false;
    $("live-hosted").hidden = false;
    refreshStatus();
    hosted.timer = setInterval(function () { if (!document.hidden) refreshStatus(); }, 15000);
  }

  function refreshStatus() {
    fetch(hosted.control + "/status", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (s) {
      var line;
      if (s.expired) line = "The live re-plan has ended for this expo. The pre-calculated scenarios above are still here.";
      else if (s.state === "stopped") line = "The live server is off. Ask at the stand and the presenter will start it.";
      else if (s.state === "pending") line = "The live server is starting, about two minutes.";
      else if (s.state === "stopping") line = "The live server is turning off.";
      else if (s.state === "running") line = "The live server is on until about " + sydneyTime(s.off_at) +
        " Sydney time, one hour after the last re-plan.";
      else line = "The live server is " + s.state + ".";
      $("live-server").textContent = line;
      if (s.state === "running") checkReady(); else $("live-form").hidden = true;
    }).catch(function () { $("live-server").textContent = "Could not reach the live server's status."; });
  }

  function checkReady() {
    liveFetch("/api/health").then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); })
      .then(function (res) {
        if (res.code === 401) {
          $("live-server").textContent = "Live re-plan is not open yet. Ask at the stand.";
          $("live-form").hidden = true;
        } else if (res.code !== 200 || !res.j.live) {
          $("live-form").hidden = true;   // still warming up its routing services
        } else {
          $("live-form").hidden = false;
          var q = res.j.waiting ? res.j.waiting + (res.j.waiting === 1 ? " re-plan is" : " re-plans are") + " waiting" +
            (res.j.busy ? " behind the one running." : ".") : (res.j.busy ? "One re-plan is running, none waiting." : "Nobody is waiting, a re-plan starts at once.");
          $("live-queue").textContent = q;
        }
      })
      .catch(function () { $("live-form").hidden = true; });
  }

  function poll(id) {
    var bar = $("live-progress");
    bar.hidden = false;
    var t = setInterval(function () {
      liveFetch("/api/job/" + id).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.progress) return;   // a dropped or refused request, keep polling
        bar.value = j.progress.fraction;
        var d = j.progress.days_done, q = j.queue || {};
        if (j.state === "queued") {
          $("live-status").textContent = "In the queue, number " + q.position + " of " + q.waiting + " waiting. About " + secs(q.est_wait_s) +
            " before it starts, then about " + secs(q.est_run_s) + " to run.";
        } else if (j.state === "running") {
          $("live-status").textContent = "Planning, distance-only day " + d.distance + " of " + j.progress.days_total +
            ", emissions-aware day " + d.emissions + " of " + j.progress.days_total + ", " + Math.round(j.elapsed_s) + " s";
        }
        if (j.state === "queued" || j.state === "running") return;
        clearInterval(t);
        bar.hidden = true;
        $("live-go").disabled = false;
        if (j.state === "done") {
          $("live-status").textContent = "Done in " + Math.round(j.elapsed_s) + " s. The maps now show the live run.";
          var lf = Object.keys(j.result.fleets)[0];
          var plan = { kind: "live", key: "live:" + livePlans.length, data: j.result, jobId: j.id, label: "Live re-plan, scenario " +
            j.result.meta.seed + ", " + lf + " of four trucks electric, " + j.result.meta.arrivals_per_day + " requests a day, " +
            j.result.meta.measured_days + " measured days" };
          livePlans.push(plan);
          state.fleet = lf;
          useData(j.result, "live", plan.key);
          if (hosted.control) refreshStatus();
        } else {
          $("live-status").textContent = "The re-plan failed: " + (j.error || "unknown error");
        }
      }).catch(function () { /* keep polling through a dropped request */ });
    }, hosted.control ? 2000 : 1000);
  }

  // ---------------------------------------------------------------- start

  if (!window.L) return;
  // A page opened in a background tab or a hidden pane has map containers of zero size at
  // load. Leaflet then fits the view to nothing, the centre becomes NaN, the pan sync below
  // throws and the maps stay empty (found on the laptop check of 2026-10-31 with a hidden
  // frame). So the first fit waits until both containers have a real size. Leaflet queues the
  // layers until a view exists. Later resizes keep the visitor's own pan and zoom.
  function mapsSized() {
    return ARMS.every(function (a) { var e = $("map-" + a); return e.clientWidth > 0 && e.clientHeight > 0; });
  }
  makeMap("distance"); makeMap("emissions");
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
    var watcher = new ResizeObserver(function () {
      var now = mapsSized();
      if (now && (!wasSized || !userMoved)) fitAll();
      wasSized = now;
    });
    ARMS.forEach(function (a) { watcher.observe($("map-" + a)); });
  }
  $("day").addEventListener("input", function () { stop(); state.day = parseInt(this.value, 10) - 1; render(); });
  $("play").addEventListener("click", function () { if (state.timer) stop(); else play(); });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="basemap"]'), function (r) {
    r.addEventListener("change", function () { if (this.checked) setBasemap(this.value); });
  });
  setupFullscreen();
  rawSetup();
  $("anim-play").addEventListener("click", function () { if (anim.raf) stopAnim(); else { stop(); playAnim(); } });
  $("anim").addEventListener("input", function () { stopAnim(); anim.dots = true; anim.t = parseInt(this.value, 10) / 100; applyAnim(); });
  $("plan").addEventListener("change", function () { pickPlan(); });
  function seedClick(ev) {
    var el = ev.target.closest("[data-seed]");
    if (el) { pickPlan("seed:" + el.getAttribute("data-seed")); $("plan").scrollIntoView({ block: "center" }); }
  }
  $("seed-table").addEventListener("click", seedClick);
  $("chart-seeds").addEventListener("click", seedClick);
  // The maps and controls are up before any scenario has loaded. Seed 1 loads like any other.
  buildFleetButtons();
  syncPlan();
  pickPlan(state.key);
  liveSetup();
})();
