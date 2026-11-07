// "Where the plans differ" (Jordan, 2026-11-01). Explains the mechanism behind the saving, that the
// emissions-aware plan gives the longest routes to the electric trucks. It reads the planner's own
// solution.json of both plans for the scenario and fleet on screen (raw/seed-<n>-<k>ev-<arm>.json.gz,
// unpacked as app.js does) and compares them over the measured days. Descriptive, this scenario
// only. Fetched only when the card is near the screen, so the page stays fast.
(function () {
  "use strict";
  var anchor = document.querySelector("section.compare");
  var plan = document.getElementById("plan"), fleetBox = document.getElementById("fleet-buttons");
  if (!anchor || !plan || !fleetBox) return;

  var sec = document.createElement("section");
  sec.className = "plans-differ";
  sec.id = "plans-differ";
  sec.setAttribute("aria-labelledby", "plans-differ-h");
  sec.innerHTML =
    '<h2 id="plans-differ-h"><span class="scope-pill scope-run">Whole run</span> Where the plans differ</h2>' +
    '<p class="pd-tag">Descriptive, this scenario only</p>' +
    '<p class="note">The two plans get the same requests. This compares them request by request over the measured days, using the planner\'s own output for the scenario and electric share chosen above.</p>' +
    '<p id="pd-status" class="note" aria-live="polite"></p>' +
    '<div id="pd-body" hidden>' +
    '<div id="pd-figures" class="diff"></div>' +
    '<p id="pd-def" class="note pd-def"></p>' +
    '<div id="pd-bars" class="pd-bars"></div>' +
    '<p id="pd-sentence" class="pd-sentence"></p></div>';
  anchor.parentNode.insertBefore(sec, anchor.nextSibling);
  var $ = function (id) { return document.getElementById(id); };

  var cache = {}, order = [], shown = null, token = 0, near = false;

  function fmt0(v) { return String(Math.round(v)); }
  function isEv(type) { return /_ev$/.test(type); }
  function current() {
    var m = /^seed:(\d+)$/.exec(plan.value), b = fleetBox.querySelector('button[aria-pressed="true"]');
    return m && b ? { seed: m[1], fleet: b.getAttribute("data-fleet") } : null;
  }

  function gunzip(buf) {
    if (!window.DecompressionStream) return Promise.reject(new Error("this browser cannot unpack the compressed plan files"));
    var ds = new DecompressionStream("gzip");
    return new Response(new Blob([buf]).stream().pipeThrough(ds)).text();
  }
  function fetchPlan(seed, fleet, arm) {
    return fetch("raw/seed-" + seed + "-" + fleet + "ev-" + arm + ".json.gz").then(function (r) {
      if (!r.ok) throw new Error("a plan file is not available (" + r.status + ")");
      return r.arrayBuffer();
    }).then(gunzip).then(function (t) { return summarise(JSON.parse(t)); });
  }

  // Keeps only what the card needs, so the 1 MB files can be dropped after reading.
  function summarise(j) {
    var types = {}, measured = {}, km = {}, truck = {}, served = {}, nServed = 0;
    j.config.fleet.forEach(function (f) { types[f.id] = f.type; km[f.id] = 0; });
    j.daily.forEach(function (d) { if (d.measured) measured[d.day] = true; });
    Object.keys(j.day_routes).forEach(function (k) {
      var day = +k, inRun = !!measured[day];
      j.day_routes[k].routes.forEach(function (r) {
        if (inRun) km[r.fleet_id] = (km[r.fleet_id] || 0) + r.route.distance / 1000;
        r.route.steps.forEach(function (s) { if (s.type === "job") truck[s.id] = r.fleet_id; });
      });
    });
    j.collected.forEach(function (c) {
      if (!measured[c.collected_day] || truck[c.id] === undefined) return;
      served[c.id] = { day: c.collected_day, type: types[truck[c.id]] };
      nServed++;
    });
    var byType = j.kpis.distance_km_by_type || {}, evKm = 0;
    Object.keys(byType).forEach(function (t) { if (isEv(t)) evKm += byType[t]; });
    return { types: types, km: km, served: served, nServed: nServed, totalKm: j.kpis.total_distance_km, evKm: evKm };
  }

  function compare(d, e) {
    var r = { same: 0, type: 0, earlier: 0, later: 0, both: 0 };
    Object.keys(d.served).forEach(function (id) {
      var b = e.served[id];
      if (!b) return;
      var a = d.served[id];
      r.both++;
      if (a.type !== b.type) r.type++;
      else if (a.day !== b.day) { if (b.day < a.day) r.earlier++; else r.later++; }
      else r.same++;
    });
    r.onlyD = d.nServed - r.both;
    r.onlyE = e.nServed - r.both;
    return r;
  }

  function figure(v, l, sub) {
    return '<div><div class="v">' + v + '</div><div class="l">' + l + (sub ? '<br>' + sub : "") + "</div></div>";
  }

  function bars(p, max, name) {
    var ids = Object.keys(p.types).sort(function (a, b) { return a - b; });
    return '<div class="pd-plan"><h3>' + name + "</h3><ul>" + ids.map(function (id) {
      var ev = isEv(p.types[id]), km = p.km[id] || 0;
      return '<li><span class="pd-name">Truck ' + id + '<span class="pd-type">' + (ev ? "electric" : "diesel") + "</span></span>" +
        '<span class="pd-track" aria-hidden="true"><span class="pd-bar ' + (ev ? "pd-ev" : "pd-dsl") + '" style="width:' +
        (max > 0 ? (100 * km / max).toFixed(1) : 0) + '%"></span></span><span class="pd-km">' + fmt0(km) + " km</span></li>";
    }).join("") + '</ul><p class="pd-total">All trucks <strong>' + fmt0(p.totalKm) + " km</strong></p></div>";
  }

  function share(p) { return p.totalKm > 0 ? Math.round(100 * p.evKm / p.totalKm) : 0; }

  function render(d, e, fleet) {
    var c = compare(d, e), n = +fleet, nEv = Object.keys(d.types).filter(function (id) { return isEv(d.types[id]); }).length;
    $("pd-figures").innerHTML =
      figure(c.type, "requests served by a different truck type", "diesel in one plan, electric in the other") +
      figure(c.earlier + c.later, "requests collected on a different day", c.earlier + " earlier and " + c.later + " later in the emissions-aware plan") +
      figure(c.same, "requests served by the same truck type and day");
    $("pd-def").textContent = "Counted over the " + c.both + " requests collected on a measured day in both plans, each in one group only. " +
      "A request that changes truck type and day is counted under truck type. " +
      "Not counted: " + c.onlyD + " collected on a measured day only in the distance-only plan and " + c.onlyE +
      " only in the emissions-aware plan, so distance-only collected " + d.nServed + " and emissions-aware " + e.nServed + ".";
    var max = 0;
    [d, e].forEach(function (p) { Object.keys(p.km).forEach(function (id) { max = Math.max(max, p.km[id]); }); });
    $("pd-bars").innerHTML = bars(d, max, "Distance-only") + bars(e, max, "Emissions-aware");
    var s;
    if (nEv === 0) s = "There are no electric trucks in this fleet, so every kilometre is diesel in both plans, " + fmt0(d.totalKm) + " km distance-only and " + fmt0(e.totalKm) + " km emissions-aware.";
    else if (nEv === Object.keys(d.types).length) s = "Every truck is electric in this fleet, so every kilometre is electric in both plans, " + fmt0(d.totalKm) + " km distance-only and " + fmt0(e.totalKm) + " km emissions-aware.";
    else s = "In the emissions-aware plan the electric " + (nEv === 1 ? "truck drives " : "trucks drive ") + fmt0(e.evKm) + " km of " + fmt0(e.totalKm) + " km (" + share(e) +
      " percent), in the distance-only plan " + fmt0(d.evKm) + " km of " + fmt0(d.totalKm) + " km (" + share(d) + " percent).";
    $("pd-sentence").textContent = s;
    $("pd-body").hidden = false;
    $("pd-status").textContent = "";
  }

  function load() {
    var cur = current();
    if (!cur) {
      $("pd-body").hidden = true;
      $("pd-status").textContent = "Shown for the pre-calculated scenarios.";
      shown = null;
      return;
    }
    var key = cur.seed + "-" + cur.fleet;
    if (key === shown) return;
    shown = key;
    var my = ++token;
    if (cache[key]) return render(cache[key][0], cache[key][1], cur.fleet);
    $("pd-body").hidden = true;
    $("pd-status").innerHTML = "Loading both plans for seed " + cur.seed + ".";
    Promise.all([fetchPlan(cur.seed, cur.fleet, "distance"), fetchPlan(cur.seed, cur.fleet, "emissions")]).then(function (pair) {
      cache[key] = pair; order.push(key);
      if (order.length > 4) delete cache[order.shift()];
      if (my === token) render(pair[0], pair[1], cur.fleet);
    }).catch(function (err) {
      if (my !== token) return;
      shown = null;
      $("pd-status").innerHTML = "";
      $("pd-status").appendChild(document.createTextNode("Could not load the plans: " + err.message + ". "));
      var b = document.createElement("button");
      b.type = "button"; b.className = "secondary"; b.textContent = "Try again";
      b.addEventListener("click", load);
      $("pd-status").appendChild(b);
    });
  }

  var pending = null;
  function soon() {
    if (!near || pending) return;
    pending = setTimeout(function () { pending = null; load(); }, 200);
  }
  new MutationObserver(soon).observe(fleetBox, { attributes: true, attributeFilter: ["aria-pressed"], childList: true, subtree: true });
  new MutationObserver(soon).observe(plan, { childList: true });

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      near = es.some(function (x) { return x.isIntersecting; });
      soon();
    }, { rootMargin: "700px 0px" }).observe(sec);
  } else { near = true; soon(); }
})();
