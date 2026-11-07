// Extra views of the project's own finished evidence, on the visitor page (expo, 2026-11-01).
// Each reads a data file written by a script in scripts/ from the repository's evidence folders
// and says which claim in docs/CLAIMS.md it comes from. None of it is a result of the 90 scenarios
// above, and none is a new run. Technical reductions and reductions from changed operating rules
// are kept in separate columns wherever a view shows both.
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(x, d) { return x === null || x === undefined ? "n/a" : x.toFixed(d).replace("-", "−"); }
  function signed(x, d) { return x === null || x === undefined ? "n/a" : (x > 0 ? "+" : "") + num(x, d); }
  function pval(p) { return p === null ? "n/a" : (p < 0.0001 ? "< 0.0001" : p.toFixed(4)); }

  // ---------------------------------------------------------------- solver comparison (C10, C14, C17, C20)

  var CAVEATS = [
    "Each alternative solver ran at one untuned setting, and the PyVRP releases on a reformulated problem at stopping settings not shown to converge. The table does not show that any solver is best among all solvers, or that VROOM beats a converged alternative.",
    "A larger saving for an alternative solver is partly its distance-only plan driving more kilometres, so it is not a finding that the solver saves more.",
    "The change is within each solver, emissions-aware plan against distance-only plan on the same requests and fleet. The cost against VROOM compares the solvers' plans by the planner's shared objective, a different measure.",
    "Solve times came from spot instances under load and are not timing evidence for the planner's performance requirement.",
    "All of it is single trip under one rule set, so every figure is a technical reduction. None comes from changed operating rules."
  ];

  function solverSetup() {
    var data = window.SRCRO_SOLVERS, sec = $("solvers");
    if (!data || !sec) return;
    sec.hidden = false;
    $("solver-intro").textContent = "The same daily re-plans solved by VROOM, which the project uses, and by six alternatives, 30 seeds each, 25 requests a day, 10 warm-up and 20 measured days. " +
      "These are the project's campaign results (claims C10, C14, C17 and C20 of the claims register), not figures from the 90 scenarios on this page and not a new run. " +
      "Status says whether the claim was tested against pre-registered hypotheses or is descriptive. " + data.meta.kind;
    $("solver-note").textContent = data.meta.note;
    $("solver-caveats").innerHTML = CAVEATS.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");

    function render() {
      var fleet = document.querySelector('input[name="solver-fleet"]:checked').value;
      $("solver-table").tBodies[0].innerHTML = data.solvers.map(function (s) {
        var f = s.fleets[fleet];
        var gap = s.cvrplib ? s.cvrplib.A + " and " + s.cvrplib.X + " percent" : "not in the claim";
        var mixed = fleet === "0ev" ? "" : "";
        return "<tr" + (s.role === "reference" ? ' class="cur"' : "") + ">" +
          '<th scope="row">' + esc(s.label) + '<br><span class="small">' + esc(s.setting) + ", claim " + esc(s.claim) + "</span></th>" +
          "<td>" + esc(s.status) + "</td>" +
          "<td>" + num(f.distance_kg, 3) + "</td><td>" + num(f.emissions_kg, 3) + "</td>" +
          "<td>" + signed(f.change_kg, 3) + " (" + signed(f.ci_low_kg, 3) + " to " + signed(f.ci_high_kg, 3) + ")</td>" +
          "<td>" + signed(f.change_pct, 1) + "</td><td>" + pval(f.p_adjusted) + "</td>" +
          "<td>" + num(f.solve_s_distance, 1) + " s and " + num(f.solve_s_emissions, 1) + " s</td>" +
          "<td>" + esc(s.vs_vroom || "reference") + "</td><td>" + esc(gap) + "</td></tr>" + mixed;
      }).join("");
    }
    Array.prototype.forEach.call(document.querySelectorAll('input[name="solver-fleet"]'), function (r) { r.addEventListener("change", render); });
    render();
  }

  // ---------------------------------------------------------------- multi-trip (C6) and stage 2 (X7)

  var FLEET_NAME = { "0ev": "0% electric (all diesel)", "1ev": "25% electric", "2ev": "50% electric" };

  function tripsSetup() {
    var data = window.SRCRO_TRIPS, sec = $("trips");
    if (!data || !sec) return;
    sec.hidden = false;
    $("trips-intro").textContent = "Each truck may make up to three trips a day, 30 seeds per cell, from the project's multi-trip campaign (claim C6 of the claims register), not from the 90 scenarios on this page and not a new run. " +
      "The gradient-aware plan is compared with the distance-only plan, each with the load-aware routing stage. The first group is a technical reduction, better planning under the planner's own trip rules. " +
      "The second is what loosening those rules adds (an electric truck's trips re-timed back to back, and its 110 km daily planning distance shared across them), so it comes from a changed operating rule, not from better routing. " +
      "The two are never added. The last group is the looser-rule result as run, which includes both. All figures are descriptive and within the CMEM model.";
    $("stage2-note").textContent = "";
    $("trips-note").textContent = "Extra saving is the change in the saving, flexible minus fixed trip rules, as the median of per-seed differences, over the seeds both campaigns ran alike (29 for one electric truck at 50 a day, where seed 15 differs, 30 elsewhere), so negative means the looser rules saved more. " +
      "A 100 percent saving on 2 electric trucks means the diesel trucks drove no kilometres. Quote the kg figure beside any percentage. " + data.meta.trips_evidence + " is the source.";

    function render() {
      var k = document.querySelector('input[name="trips-kpi"]:checked').value;
      $("trips-table").tBodies[0].innerHTML = data.trips.map(function (r) {
        var c = r[k];
        return "<tr><th scope=\"row\">" + esc(FLEET_NAME[r.fleet]) + '<br><span class="small">' + esc(r.case_label) + "</span></th>" +
          "<td>" + signed(c.fixed_kg, 3) + "</td><td>" + signed(c.fixed_pct, 1) + "</td>" +
          "<td>" + signed(c.rules_kg, 3) + " (" + signed(c.rules_ci_low, 3) + " to " + signed(c.rules_ci_high, 3) + ")</td>" +
          "<td>" + pval(c.rules_p_adjusted) + "</td><td>" + (c.rules_significant ? "yes" : "no") + "</td>" +
          "<td>" + signed(c.combined_kg, 3) + "</td><td>" + signed(c.combined_pct, 1) + "</td></tr>";
      }).join("");
    }
    Array.prototype.forEach.call(document.querySelectorAll('input[name="trips-kpi"]'), function (r) { r.addEventListener("change", render); });
    render();
  }

  function stage2Setup() {
    var data = window.SRCRO_TRIPS, sec = $("stage2");
    if (!data || !sec) return;
    sec.hidden = false;
    $("stage2-intro").textContent = "One trip a day, 100 seeds, 25 requests a day, from the project's re-score of its headline runs with the load-aware routing stage (claim X7, exploratory). " +
      "The stage re-routes each executed day with the load the truck actually carries, on both plans. It changes no operating rule, so these are technical reductions. " +
      "It never replaces the pre-registered figures above, which are made without the stage.";
    $("stage2-table").tBodies[0].innerHTML = data.stage2.map(function (r) {
      return "<tr><th scope=\"row\">" + esc(FLEET_NAME[r.fleet]) + "</th><td>" + signed(r.stage1_cmem_pct, 2) + "</td>" +
        "<td>" + signed(r.stage2_cmem_pct, 2) + " (" + signed(r.stage2_cmem_kg, 3) + ")</td>" +
        "<td>" + signed(r.stage2_tier1_pct, 2) + " (" + signed(r.stage2_tier1_kg, 3) + ")</td>" +
        "<td>" + signed(r.stage2_on_emissions_cmem_pct, 2) + "</td></tr>";
    }).join("");
    $("stage2-note").textContent = "CMEM figures are within the model, so they are not a measured real-world saving. On 4 diesel trucks the emissions-aware plan's tier-1 figure is slightly higher, the CMEM advantage there is within-model only. Source: " + data.meta.stage2_evidence + ".";
  }

  // ---------------------------------------------------------------- gradient and elevation explorer

  function gradientSetup() {
    var g = window.SRCRO_GRADIENT, sec = $("gradient");
    if (!g || !sec) return;
    sec.hidden = false;
    var m = g.meta, t = g.totals;
    $("gradient-intro").textContent = "One executed diesel route of the pre-calculated scenario 1, all diesel fleet, distance-only plan (day " + m.day + ", truck " + m.fleet_id + ", " + m.stops +
      " stops), picked because it has the most total climb of the routes of 8 to 15 stops, so it shows the effect at its largest and is not a typical route. " +
      "The road heights come from the project's elevation table (a 1 m LiDAR model averaged to 5 m) at each road node, merged into chunks of at least " + m.chunk_min_m + " m so that small height errors do not add false climbs. " +
      "Fuel comes from the project's post-hoc CMEM model (claim FR-17, docs/CMEM.md) at the gross mass on each leg, the truck's " + Math.round(m.tare_kg) + " kg tare plus " + m.density_kg_per_m3 +
      " kg for every cubic metre collected so far. It is a within-model figure, not a measured fuel use, and it is descriptive.";
    $("grad-summary").textContent = "Whole route: " + t.km.toFixed(1) + " km, " + t.fuel_l.toFixed(2) + " L of diesel (" + t.co2e_kg.toFixed(1) + " kg CO2-e), " +
      Math.round(t.climb_m) + " m of climbing and " + Math.round(t.descent_m) + " m of descent in total. The same route with an empty body would burn " + t.fuel_l_if_empty.toFixed(2) +
      " L, so the load adds " + (100 * (t.fuel_l / t.fuel_l_if_empty - 1)).toFixed(1) + " percent here.";

    // chart: elevation line on top, fuel per km bars below, a stop marker where each leg ends. Drawn at
    // the figure's own width so it fills the page with text at its real size, and redrawn on a resize
    // (Jordan, 2026-11-02). Its key is the list above it in results.html.
    function draw() {
    var svgEl = $("grad-chart"), W = Math.max(320, Math.round(svgEl.parentNode.getBoundingClientRect().width) || 900);
    var L = 56, R = 12, top = 18, h1 = W < 600 ? 120 : 170, gap = 36, h2 = W < 600 ? 80 : 110, P = g.profile;
    svgEl.setAttribute("viewBox", "0 0 " + W + " " + (top + h1 + gap + h2 + 24));
    var kmMax = P[P.length - 1].km, hs = P.map(function (p) { return p.m; });
    var hmin = Math.floor(Math.min.apply(null, hs) / 10) * 10, hmax = Math.ceil(Math.max.apply(null, hs) / 10) * 10;
    var fmax = Math.max.apply(null, P.slice(1).map(function (p) { return p.fuel_l_per_km; }));
    function X(km) { return L + (W - L - R) * km / kmMax; }
    function Y1(m) { return top + h1 * (1 - (m - hmin) / (hmax - hmin || 1)); }
    var y2 = top + h1 + gap;
    function Y2(f) { return y2 + h2 * (1 - f / fmax); }
    var s = "";
    for (var i = 0; i <= 4; i++) {
      var hv = hmin + (hmax - hmin) * i / 4;
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y1(hv) + '" y2="' + Y1(hv) + '" class="grad-grid"/><text x="' + (L - 6) + '" y="' + (Y1(hv) + 4) + '" text-anchor="end" class="grad-tick">' + Math.round(hv) + ' m</text>';
    }
    for (var k = 0; k <= Math.floor(kmMax / 5); k++) {
      s += '<text x="' + X(k * 5) + '" y="' + (y2 + h2 + 16) + '" text-anchor="middle" class="grad-tick">' + (k * 5) + ' km</text>';
    }
    var line = P.map(function (p, j) { return (j ? "L" : "M") + X(p.km).toFixed(1) + " " + Y1(p.m).toFixed(1); }).join(" ");
    s += '<path d="' + line + ' L' + X(kmMax) + " " + Y1(hmin) + " L" + X(0) + " " + Y1(hmin) + ' Z" class="grad-area"/><path d="' + line + '" class="grad-line"/>';
    for (var j = 1; j < P.length; j++) {
      var a = P[j - 1], b = P[j], x0 = X(a.km), bw = Math.max(1, X(b.km) - x0 - 0.5);
      s += '<rect x="' + x0.toFixed(1) + '" y="' + Y2(b.fuel_l_per_km).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (y2 + h2 - Y2(b.fuel_l_per_km)).toFixed(1) +
        '" class="' + (b.grade_pct > 1 ? "grad-up" : b.grade_pct < -1 ? "grad-down" : "grad-flat") + '"><title>' + b.km.toFixed(2) + " km, grade " + b.grade_pct + " percent, " + b.fuel_l_per_km + " L per km</title></rect>";
    }
    var ends = {};
    P.forEach(function (p) { if (p.leg) ends[p.leg] = p.km; });
    Object.keys(ends).forEach(function (leg) {
      var n = parseInt(leg, 10);
      if (n >= g.legs.length) return;
      s += '<line x1="' + X(ends[leg]) + '" x2="' + X(ends[leg]) + '" y1="' + top + '" y2="' + (y2 + h2) + '" class="grad-stop"/><text x="' + X(ends[leg]) + '" y="' + (top - 3) + '" text-anchor="middle" class="grad-tick">' + n + '</text>';
    });
    s += '<text x="' + L + '" y="' + (y2 - 8) + '" class="grad-tick">Fuel, litres per km</text>';
    $("grad-chart").innerHTML = s;
    }
    draw();
    var redraw = null;
    window.addEventListener("resize", function () { clearTimeout(redraw); redraw = setTimeout(draw, 200); });
    $("grad-chart-title").textContent = "Elevation profile of the route in metres above sea level against distance, and the CMEM fuel in litres per km for each chunk of road. The table below gives the same route leg by leg.";

    $("grad-table").tBodies[0].innerHTML = g.legs.map(function (l) {
      return "<tr><th scope=\"row\">" + l.leg + ", " + esc(l.from) + " to " + esc(l.to) + "</th><td>" + l.km.toFixed(2) + "</td><td>" + l.load_m3.toFixed(1) + "</td><td>" + l.mass_kg +
        "</td><td>+" + Math.round(l.climb_m) + " and −" + Math.round(l.descent_m) + "</td><td>" + l.fuel_l.toFixed(3) + "</td><td>" + l.fuel_l_per_100km.toFixed(1) +
        "</td><td>" + l.fuel_l_if_empty.toFixed(3) + "</td><td>" + l.co2e_kg.toFixed(3) + "</td></tr>";
    }).join("");
    $("grad-note").textContent = "Heights are bare-earth model values at road nodes and bridges and tunnels are interpolated, so short grades can be off. " + t.chunks_without_height +
      " chunks of this route lacked a height and would count as flat. Technical figure, single route, same operating rules as the plan. Source: scripts/export_demo_gradient.py on the raw output of scenario 1.";
  }

  solverSetup();
  tripsSetup();
  stage2Setup();
  gradientSetup();
})();
