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

  function drawDay() {
    var lvl = state.data.fleets[state.fleet];
    ARMS.forEach(function (arm) {
      var g = layers[arm];
      g.clearLayers();
      var day = lvl[arm].days[state.day];
      if (!day) return;
      day.routes.forEach(function (r) {
        var colour = r.kind === "electric" ? ELECTRIC : DIESEL;
        // A white casing under each route keeps it readable over the road layer and
        // street tiles, and the dash keeps diesel apart from electric without colour.
        L.polyline(r.path, { color: "#FFFFFF", weight: 7, opacity: 0.85, interactive: false }).addTo(g);
        L.polyline(r.path, { color: colour, weight: 4, opacity: 1,
          dashArray: r.kind === "diesel" ? "9 6" : null })
          .bindTooltip("Truck " + r.vehicle + (r.trip > 1 ? ", trip " + r.trip : "") + ", " +
            (r.kind === "electric" ? "electric" : "diesel") + ", " + fmt(r.km, 1) + " km, " +
            fmt(r.co2e_kg, 1) + " kg CO2-e, " + r.stops.length + " stops", { sticky: true })
          .addTo(g);
        r.stops.forEach(function (s) {
          L.circleMarker([s.lat, s.lon], { radius: 5, color: "#FFFFFF", weight: 1.5,
            fillColor: colour, fillOpacity: 1 })
            .bindTooltip("Request " + s.id + ", " + fmt(s.vol, 1) + " m3, waited " +
              s.age + (s.age === 1 ? " business day" : " business days"))
            .addTo(g);
        });
      });
    });
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
      [signed(dKg, 2) + " kg", "CO2-e per request"],
      [p === null ? "n/a" : signed(p, 1) + "%", "CO2-e per request, percent"],
      [signed(ke.km_total - kd.km_total, 0) + " km", "Distance"],
      [signed(ke.km_diesel - kd.km_diesel, 0) + " km", "Diesel distance"],
      [signed(ke.km_electric - kd.km_electric, 0) + " km", "Electric distance"]
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
  }

  function render() { drawDay(); updatePanels(); }

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
    render();
  }

  function stop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    $("play").textContent = "Play"; $("play").setAttribute("aria-pressed", "false");
  }

  function play() {
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
    $("illustration").textContent = m.illustration;
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
    $("meta-line").textContent = "Run scenario " + m.seed + ", " + m.arrivals_per_day +
      " requests a day, " + days(m.measured_days, "measured") + " after " +
      days(m.warmup_days, "warm-up") + ", commit " + m.commit + ", exported " + m.generated_at + " Sydney time. Routes drawn as " +
      m.geometry_source + ".";
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

  // Where the live API is. On the laptop it is the same origin with no password. On the hosted
  // page it is the proxy function of scripts/cloud/live_replan/, and every call carries the
  // demo password, which the proxy checks (the page itself checks nothing, it can be read).
  var LIVE = { api: "", pass: "" };
  function liveFetch(path, opts) {
    opts = opts || {};
    var h = { "Content-Type": "application/json" };
    if (LIVE.pass) h["X-Demo-Password"] = LIVE.pass;
    return fetch(LIVE.api + path, { method: opts.method || "GET", headers: h, body: opts.body, cache: "no-store" });
  }
  function store(key, value) {   // per-tab convenience only, the page works without it
    try { if (value === undefined) return sessionStorage.getItem(key); sessionStorage.setItem(key, value); } catch (e) { return null; }
  }

  function liveSetup() {
    $("live-random").addEventListener("change", function () { $("live-seed").disabled = this.checked; });
    $("live-back").addEventListener("click", function () { useData(recorded, false); $("live-status").textContent = ""; });
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
          if (res.code === 401) { relock("The demo password was not accepted."); }
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

  // ---- hosted page: server status, unlock with the demo password, presenter start

  var hosted = { control: "", server: null, unlocked: false, timer: null };

  function sydneyTime(iso) {
    return new Date(iso).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" });
  }

  function hostedSetup(control) {
    hosted.control = control;
    $("live-off").hidden = true;
    $("live-hosted").hidden = false;
    $("live-unlock").addEventListener("submit", function (ev) {
      ev.preventDefault();
      LIVE.pass = $("live-pass").value;
      $("live-unlock-msg").textContent = "Checking";
      checkUnlock(true);
    });
    $("admin-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      $("admin-start").disabled = true;
      $("admin-msg").textContent = "Asking AWS to start the server";
      fetch(hosted.control + "/start", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: $("admin-pass").value }) })
        .then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); })
        .then(function (res) {
          $("admin-start").disabled = false;
          if (res.code === 202) $("admin-msg").textContent = "Starting. It takes about two minutes.";
          else if (res.code === 200) $("admin-msg").textContent = "Already running.";
          else $("admin-msg").textContent = res.j.error || "Could not start the server.";
          if (res.code < 300) { $("admin-pass").value = ""; refreshStatus(); }
        })
        .catch(function (e) { $("admin-start").disabled = false; $("admin-msg").textContent = "Could not reach AWS: " + e.message; });
    });
    var saved = store("srcro-live-pass");
    if (saved) LIVE.pass = saved;
    refreshStatus();
    hosted.timer = setInterval(function () { if (!document.hidden) refreshStatus(); }, 15000);
  }

  function refreshStatus() {
    fetch(hosted.control + "/status", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (s) {
      hosted.server = s;
      var line;
      if (s.expired) line = "The live re-plan has ended for this expo. The recorded run above is still here.";
      else if (s.state === "stopped") line = "The live server is off. Ask at the stand and the presenter will start it.";
      else if (s.state === "pending") line = "The live server is starting, about two minutes.";
      else if (s.state === "stopping") line = "The live server is turning off.";
      else if (s.state === "running") line = "The live server is on until about " + sydneyTime(s.off_at) +
        " Sydney time, one hour after the last re-plan.";
      else line = "The live server is " + s.state + ".";
      $("live-server").textContent = line;
      if (s.state === "running" && LIVE.pass) checkUnlock(false);
      if (s.state !== "running" && hosted.unlocked) { hosted.unlocked = false; $("live-form").hidden = true; $("live-unlock").hidden = false; }
    }).catch(function () { $("live-server").textContent = "Could not reach the live server's status."; });
  }

  function checkUnlock(fromForm) {
    liveFetch("/api/health").then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); })
      .then(function (res) {
        if (res.code === 401) return relock(fromForm ? "That is not the demo password." : "");
        if (res.code === 503) { $("live-unlock-msg").textContent = fromForm ? "Password noted. The server is off, it unlocks once it is on." : ""; store("srcro-live-pass", LIVE.pass); return; }
        if (!res.j.live) { $("live-unlock-msg").textContent = "The server is still warming up its routing services."; store("srcro-live-pass", LIVE.pass); return; }
        store("srcro-live-pass", LIVE.pass);
        hosted.unlocked = true;
        $("live-unlock-msg").textContent = "";
        $("live-unlock").hidden = true;
        $("live-form").hidden = false;
      })
      .catch(function () { $("live-unlock-msg").textContent = fromForm ? "The server is not reachable yet." : ""; });
  }

  function relock(msg) {
    LIVE.pass = ""; store("srcro-live-pass", "");
    hosted.unlocked = false;
    $("live-form").hidden = true;
    $("live-unlock").hidden = false;
    $("live-unlock-msg").textContent = msg;
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
  useData(recorded, false);
  liveSetup();
})();
