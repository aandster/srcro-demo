// Expo demo (task 063). Plain JavaScript and Leaflet 1.9.4, data from data.js
// (window.SRCRO_DEMO, written by scripts/export_demo_data.py). Presentation only, every
// number on the page is from one illustrative run and the page says so.
(function () {
  "use strict";

  var DIESEL = "#D55E00", ELECTRIC = "#0072B2", ROAD = "#B9C0C8", INK = "#15181C";
  var ARMS = ["distance", "emissions"];
  var PLAY_MS = 1400;

  var recorded = window.SRCRO_DEMO;
  var state = { data: recorded, fleet: null, day: 0, timer: null, live: false };
  var maps = {}, layers = {}, syncing = false, streetLayers = {};

  function $(id) { return document.getElementById(id); }
  function fmt(v, dp) { return v === null || v === undefined || isNaN(v) ? "n/a" : Number(v).toFixed(dp); }
  function days(n, word) { return n + " " + word + (n === 1 ? " day" : " days"); }
  function signed(v, dp) { return (v > 0 ? "+" : "") + fmt(v, dp); }

  if (!window.L || !recorded) {
    var msg = !window.L
      ? "The map library did not load. Check the internet connection, or add demo/vendor/leaflet.js for offline use (docs/DEMO.md)."
      : "No demo data. Generate demo/data.js with scripts/export_demo_data.py (docs/DEMO.md).";
    var div = document.createElement("div");
    div.className = "nodata"; div.setAttribute("role", "alert"); div.textContent = msg;
    document.querySelector("main").prepend(div);
    if (!recorded) return;
  }

  // ---------------------------------------------------------------- maps

  function makeMap(arm) {
    var m = L.map("map-" + arm, { preferCanvas: true, zoomSnap: 0.25, attributionControl: true });
    m.attributionControl.setPrefix(false);
    var base = L.layerGroup().addTo(m);
    var d = state.data;
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
    var pts = [state.data.depot];
    (state.data.boundary || []).forEach(function (r) { pts = pts.concat(r); });
    if (pts.length < 3) {
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
  var anim = { t: 1, raf: null, routes: [], maxKm: 0 };

  function buildRouteAnim(r, colour, g) {
    var cum = [0], i, geo = 0;
    for (i = 1; i < r.path.length; i++) {
      geo += L.latLng(r.path[i - 1]).distanceTo(L.latLng(r.path[i]));
      cum.push(geo);
    }
    var scale = geo > 0 ? r.km / geo : 0;
    cum = cum.map(function (c) { return c * scale; });
    var trail = L.polyline([], { color: colour, weight: 4, opacity: 1, interactive: false }).addTo(g);
    var truck = L.marker(r.path[0], { interactive: false, keyboard: false, zIndexOffset: 1000,
      icon: L.divIcon({ className: "truck", iconSize: [24, 24],
        html: '<span style="background:' + colour + '">' + r.vehicle + "</span>" }) }).addTo(g);
    var stops = r.stops.map(function (st) {
      var best = 0, bd = Infinity;
      r.path.forEach(function (pt, k) {
        var dl = pt[0] - st.lat, dn = pt[1] - st.lon, d2 = dl * dl + dn * dn;
        if (d2 < bd) { bd = d2; best = k; }
      });
      return { at: cum[best], marker: st.marker };
    });
    return { path: r.path, cum: cum, km: r.km, trail: trail, truck: truck, stops: stops, colour: colour };
  }

  function applyAnim() {
    var s = anim.t * anim.maxKm;
    anim.routes.forEach(function (ra) {
      var d = Math.min(s, ra.km), k = 0;
      while (k < ra.cum.length - 1 && ra.cum[k + 1] <= d) k++;
      var pts = ra.path.slice(0, k + 1), pos = ra.path[k];
      if (k < ra.path.length - 1 && ra.cum[k + 1] > ra.cum[k]) {
        var f = (d - ra.cum[k]) / (ra.cum[k + 1] - ra.cum[k]);
        pos = [ra.path[k][0] + (ra.path[k + 1][0] - ra.path[k][0]) * f, ra.path[k][1] + (ra.path[k + 1][1] - ra.path[k][1]) * f];
        pts.push(pos);
      }
      ra.trail.setLatLngs(pts);
      ra.truck.setLatLng(pos);
      ra.stops.forEach(function (st) {
        var done = d >= st.at;
        st.marker.setStyle({ fillColor: done ? ra.colour : "#FFFFFF", fillOpacity: done ? 1 : 0.35 });
      });
    });
    var done = anim.t >= 1;
    $("anim").value = String(Math.round(anim.t * 100));
    $("anim-label").textContent = done ? "end of day" : fmt(s, 0) + " of " + fmt(anim.maxKm, 0) + " km along the longest route";
  }

  function stopAnim() {
    if (anim.raf) cancelAnimationFrame(anim.raf);
    anim.raf = null;
    $("anim-play").textContent = "Animate day";
  }

  function playAnim() {
    if (anim.t >= 1) anim.t = 0;
    $("anim-play").textContent = "Pause";
    var DURATION_MS = 14000, last = null;
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
    anim.maxKm = 0;
    ARMS.forEach(function (arm) {
      var g = layers[arm];
      g.clearLayers();
      var day = lvl[arm].days[state.day];
      if (!day) return;
      day.routes.forEach(function (r) {
        var colour = r.kind === "electric" ? ELECTRIC : DIESEL;
        anim.maxKm = Math.max(anim.maxKm, r.km);
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
    $("run-table").tBodies[0].innerHTML = KPI_ROWS.map(function (r) {
      return "<tr><th scope=\"row\">" + r[0] + "</th><td>" + fmt(kd[r[1]], r[2]) + "</td><td>" + fmt(ke[r[1]], r[2]) +
        "</td><td>" + signed(ke[r[1]] - kd[r[1]], r[2]) + "</td></tr>";
    }).join("");
    drawCumulative(lvl);
    drawFleetBars();
  }

  function render() { stopAnim(); anim.t = 1; drawDay(); updatePanels(); }


  // ---------------------------------------------------------------- tables and graphs

  var KPI_ROWS = [
    ["CO2-e per request, kg", "co2e_kg_per_request", 2],
    ["CO2-e, measured days, kg", "co2e_kg_total", 0],
    ["Requests collected", "requests_served", 0],
    ["Distance, km", "km_total", 0],
    ["Diesel distance, km", "km_diesel", 0],
    ["Electric distance, km", "km_electric", 0]
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
    var list = Object.keys(recorded.fleets).sort().map(function (k) {
      return { live: false, fleet: k, data: recorded,
        label: "Recorded run, scenario " + recorded.meta.seed + ", " + k + " of four trucks electric" };
    });
    return list.concat(livePlans);
  }
  function syncPlan() {
    var sel = $("plan"), list = allPlans(), cur = state.live ? state.data : recorded;
    sel.innerHTML = "";
    list.forEach(function (pl, i) {
      var o = document.createElement("option");
      o.value = String(i); o.textContent = pl.label;
      if ((pl.live ? pl.data.meta === cur.meta : !state.live) && pl.fleet === state.fleet) o.selected = true;
      sel.appendChild(o);
    });
  }
  function pickPlan() {
    var pl = allPlans()[parseInt($("plan").value, 10)];
    if (!pl) return;
    state.fleet = pl.fleet;
    useData(pl.data, pl.live);
  }

  // ---------------------------------------------------------------- full screen maps

  function setExpanded(wrap, on) {
    wrap.classList.toggle("expanded", on);
    var btn = wrap.querySelector(".fs-btn");
    btn.textContent = on ? "Exit full screen" : "Full screen";
    btn.setAttribute("aria-pressed", String(on));
    document.body.classList.toggle("fs-open", on);
    // The container changes size under Leaflet, so it re-measures once the layout settles.
    setTimeout(function () { ARMS.forEach(function (a) { maps[a].invalidateSize(); }); }, 60);
  }
  function collapseAll() {
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
      var have = !!state.data.fleets[String(n)];
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

  function streetToggle(on) {
    ARMS.forEach(function (a) {
      if (on && !streetLayers[a]) {
        streetLayers[a] = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19, opacity: 0.6,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });
      }
      if (on) streetLayers[a].addTo(maps[a]);
      else if (streetLayers[a]) maps[a].removeLayer(streetLayers[a]);
    });
  }

  function showSource(data) {
    var m = data.meta;
    var note = $("source-note");
    if (state.live) {
      note.hidden = false;
      note.textContent = "Showing the live re-plan, scenario " + m.seed + ", " + m.arrivals_per_day +
        " requests a day, " + days(m.measured_days, "measured") + " after " + days(m.warmup_days, "warm-up") + ".";
    } else if (m.test_data) {
      note.hidden = false;
      note.textContent = "TEST DATA from the unit test fixture. Not a run of the planner.";
    } else {
      note.hidden = true;
    }
  }

  function useData(data, live) {
    stop();
    // The live result carries one fleet level and no static layers, so the boundary and
    // roads of the recorded export stay on the maps.
    state.data = live ? Object.assign({}, recorded, { meta: data.meta, depot: data.depot, fleets: data.fleets }) : recorded;
    state.live = live;
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

  function liveSetup() {
    $("live-random").addEventListener("change", function () { $("live-seed").disabled = this.checked; });
    $("live-back").addEventListener("click", function () { state.fleet = "1"; useData(recorded, false); $("live-status").textContent = ""; });
    $("live-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var body = {
        seed: $("live-random").checked ? null : parseInt($("live-seed").value, 10),
        fleet_ev: parseInt($("live-fleet").value, 10),
        arrivals_per_day: parseInt($("live-arrivals").value, 10)
      };
      $("live-go").disabled = true;
      $("live-status").textContent = "Starting both plans";
      liveFetch("/api/replan", { method: "POST", body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, code: r.status, j: j }; }); })
        .then(function (res) {
          if (res.code === 401) throw new Error("live re-plan is not open to visitors yet, ask at the stand");
          if (!res.ok) throw new Error(res.j.error || "the re-plan could not start");
          poll(res.j.id);
        })
        .catch(function (e) { $("live-go").disabled = false; $("live-status").textContent = "Could not start: " + e.message; });
    });

    var local = location.protocol === "http:" && /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
    if (local) {
      // Served by scripts/demo_server.py on the laptop, task 063's path, unchanged.
      liveFetch("/api/health").then(function (r) { return r.json(); }).then(function (h) {
        if (!h.live) {
          $("live-off").textContent = "Live re-plan is off, the routing services are not running on this laptop.";
          return;
        }
        $("live-off").hidden = true;
        $("live-form").hidden = false;
      }).catch(function () { /* no server, keep the hosted wording */ });
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
    $("live-off").hidden = true;
    $("live-hosted").hidden = false;
    refreshStatus();
    hosted.timer = setInterval(function () { if (!document.hidden) refreshStatus(); }, 15000);
  }

  function refreshStatus() {
    fetch(hosted.control + "/status", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (s) {
      var line;
      if (s.expired) line = "The live re-plan has ended for this expo. The recorded run above is still here.";
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
          $("live-server").textContent = "Live re-plan is not open to visitors yet. Ask at the stand.";
          $("live-form").hidden = true;
        } else if (res.code !== 200 || !res.j.live) {
          $("live-form").hidden = true;   // still warming up its routing services
        } else {
          $("live-form").hidden = false;
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
        var d = j.progress.days_done;
        $("live-status").textContent = "Planning, distance-only day " + d.distance + " of " + j.progress.days_total +
          ", emissions-aware day " + d.emissions + " of " + j.progress.days_total + ", " + Math.round(j.elapsed_s) + " s";
        if (j.state === "running") return;
        clearInterval(t);
        bar.hidden = true;
        $("live-go").disabled = false;
        if (j.state === "done") {
          $("live-status").textContent = "Done in " + Math.round(j.elapsed_s) + " s. The maps now show the live run.";
          var lf = Object.keys(j.result.fleets)[0];
          livePlans.push({ live: true, fleet: lf, data: j.result, label: "Live re-plan, scenario " + j.result.meta.seed +
            ", " + lf + " of four trucks electric, " + j.result.meta.arrivals_per_day + " requests a day" });
          state.fleet = lf;
          useData(j.result, true);
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
  var wasSized = mapsSized();
  if (wasSized) fitAll();
  syncMaps();
  if (window.ResizeObserver) {
    var watcher = new ResizeObserver(function () {
      var now = mapsSized();
      if (now && !wasSized) fitAll();
      wasSized = now;
    });
    ARMS.forEach(function (a) { watcher.observe($("map-" + a)); });
  }
  $("day").addEventListener("input", function () { stop(); state.day = parseInt(this.value, 10) - 1; render(); });
  $("play").addEventListener("click", function () { if (state.timer) stop(); else play(); });
  $("street").addEventListener("change", function () { streetToggle(this.checked); });
  setupFullscreen();
  $("anim-play").addEventListener("click", function () { if (anim.raf) stopAnim(); else { stop(); playAnim(); } });
  $("anim").addEventListener("input", function () { stopAnim(); anim.t = parseInt(this.value, 10) / 100; applyAnim(); });
  $("plan").addEventListener("change", pickPlan);
  useData(recorded, false);
  liveSetup();
})();
