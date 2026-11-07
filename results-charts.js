// Charts for the Project Results page (expo, 2026-11-01). Presentation only. Every chart draws figures that a
// table or list on this page already shows, read from the same data files the way views.js reads them
// (solvers.js, trips.js) or taken from the poster lines in the first panel (docs/CLAIMS.md, Poster Set). Nothing
// new is computed, no chart replaces its table, and each chart sits directly above the table it summarises.
// Charts are drawn at the width of their container (one SVG unit is one pixel) and drawn again when the
// width changes or a switch is used, so text stays readable on a phone and labels never overlap.
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var MINUS = "−", NB = " ";

  // ---------------------------------------------------------------- formatting, as in views.js
  function num(x, d) { return x === null || x === undefined ? "n/a" : x.toFixed(d).replace("-", MINUS); }
  function signed(x, d) { return x === null || x === undefined ? "n/a" : (x > 0 ? "+" : "") + num(x, d); }
  function pval(p) { return p === null ? "n/a" : (p < 0.0001 ? "< 0.0001" : p.toFixed(4)); }
  function $(id) { return document.getElementById(id); }

  // ---------------------------------------------------------------- small SVG kit
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  var ctx = null, stack = "";
  function measure(text, size, weight) {
    if (!ctx) {
      var cv = document.createElement("canvas");
      ctx = cv.getContext ? cv.getContext("2d") : null;
      stack = getComputedStyle(document.body).fontFamily || "sans-serif";
    }
    if (!ctx) return String(text).length * size * 0.58;
    ctx.font = (weight || 400) + " " + size + "px " + stack;
    return ctx.measureText(text).width;
  }
  function wrap(text, maxW, size, weight) {
    var words = String(text).split(" "), lines = [], cur = "";
    words.forEach(function (w) {
      var t = cur ? cur + " " + w : w;
      if (cur && measure(t, size, weight) > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // Bar from its baseline x0 to its data end x1, square at the baseline and rounded at the data end.
  function hbar(x0, x1, y, h, r) {
    var dir = x1 >= x0 ? 1 : -1, w = Math.abs(x1 - x0);
    if (w < 2) { x1 = x0 + dir * 2; w = 2; }
    r = Math.min(r, w, h / 2);
    var sw = dir > 0 ? 1 : 0;
    return "M" + x0 + " " + y + "H" + (x1 - dir * r) + "A" + r + " " + r + " 0 0 " + sw + " " + x1 + " " + (y + r) +
      "V" + (y + h - r) + "A" + r + " " + r + " 0 0 " + sw + " " + (x1 - dir * r) + " " + (y + h) + "H" + x0 + "Z";
  }
  function round1(v) { return Math.round(v * 10) / 10; }

  // ---------------------------------------------------------------- the chart drawer
  // spec: W, labelW, valueW [wide, narrow], annot, fx(v) -> 0..1, ticks [{v, label, minor}], axisTitle,
  // rows [{group} | {label, sub, bold, band, sep, text} | {label, sub, band, sep, slots}]
  // slot: {lines [text], tip, marks [{bar: v, near, whisker [lo, hi], cls} | {dots: [{v, cls}]}]}
  function draw(spec) {
    var W = spec.W, narrow = W < 600, pad = 2, FS = 13, FM = 12, FT = 11, LH = 16, VH = 14;
    var labelW = narrow ? 0 : Math.min(spec.labelW, Math.round(W * 0.3));
    var valueW = spec.valueW[narrow ? 1 : 0];
    var firstHalf = measure(spec.ticks[0].label, FT) / 2;
    var plotL = narrow ? Math.max(pad, Math.ceil(firstHalf) + 2) : pad + labelW + 14;
    var plotR = W - pad - valueW - 10;
    var textW = narrow ? W - 2 * pad : labelW;
    function X(v) { return round1(plotL + spec.fx(v) * (plotR - plotL)); }
    var zeroX = spec.zero ? X(0) : null;
    var top = spec.annot ? 20 : 4, y = top;
    var bands = [], seps = [], body = [], first = true;

    function text(str, x, yy, size, cls, anchor, weight) {
      var a = { x: x, y: round1(yy), "font-size": size, "class": cls };
      if (anchor) a["text-anchor"] = anchor;
      if (weight) a["font-weight"] = weight;
      return el("text", a, str);
    }
    function lineY(top0, i, lh, size) { return top0 + i * lh + lh / 2 + size * 0.35; }

    spec.rows.forEach(function (row) {
      if (row.group) {
        if (!first) seps.push(el("line", { x1: pad, x2: W - pad, y1: y + 6, y2: y + 6, "class": "rc-sep" }));
        body.push(text(row.group, pad, y + 24, FS, "rc-t", null, 700));
        y += 32; first = false; return;
      }
      var wLab = narrow ? W - 2 * pad : labelW;
      var lab = wrap(row.label, wLab, FS, row.bold ? 700 : 400);
      var sub = row.sub ? wrap(row.sub, wLab, FM, 400) : [];
      var labelH = lab.length * LH + sub.length * VH;
      var rowH, blockY, labelY, blockH = 0, slotInfo = [], textLines = null;
      if (row.slots) {
        var barH = row.slots.length > 1 ? 11 : 16;
        row.slots.forEach(function (s) {
          var vl = [];
          s.lines.forEach(function (ln, i) { wrap(ln, valueW, FM, s.lines.length > 1 && i === 0 ? 700 : 400).forEach(function (w) { vl.push({ t: w, b: s.lines.length > 1 && i === 0 }); }); });
          var h = Math.max(barH + 2, vl.length * VH);
          slotInfo.push({ s: s, vl: vl, h: h, barH: barH });
          blockH += h;
        });
        blockH += 2 * (row.slots.length - 1);
      } else {
        textLines = wrap(row.text, narrow ? W - 2 * pad : W - plotL - pad, FM, 400);
        blockH = textLines.length * VH;
      }
      if (narrow) { labelY = y + 6; blockY = labelY + labelH + 4; rowH = labelH + 4 + blockH + 12; }
      else { rowH = Math.max(labelH, blockH) + 16; labelY = y + (rowH - labelH) / 2; blockY = y + (rowH - blockH) / 2; }
      if (row.sep) seps.push(el("line", { x1: pad, x2: W - pad, y1: y, y2: y, "class": "rc-sep" }));
      if (row.band) bands.push(el("rect", { x: 0, y: y + 1, width: W, height: rowH - 2, rx: 6, "class": "rc-band" }));
      lab.forEach(function (t, i) { body.push(text(t, pad + (narrow ? 2 : 0), lineY(labelY, i, LH, FS), FS, "rc-t", null, row.bold ? 700 : null)); });
      sub.forEach(function (t, i) { body.push(text(t, pad + (narrow ? 2 : 0), lineY(labelY + lab.length * LH, i, VH, FM), FM, "rc-m")); });
      if (textLines) {
        textLines.forEach(function (t, i) { body.push(text(t, narrow ? pad + 2 : plotL, lineY(blockY, i, VH, FM), FM, "rc-m rc-i")); });
      } else {
        var sy = blockY;
        slotInfo.forEach(function (si) {
          var mid = sy + si.h / 2, bh = si.barH, by = mid - bh / 2, g = el("g", {});
          si.s.marks.forEach(function (m) {
            if (m.bar !== undefined) {
              var x1 = X(m.bar);
              if (m.near !== undefined) {
                g.appendChild(el("path", { d: hbar(zeroX, x1, by, bh, 4), "class": m.cls + " rc-pale" }));
                g.appendChild(el("path", { d: hbar(X(m.near), x1, by, bh, 4), "class": m.cls }));
              } else g.appendChild(el("path", { d: hbar(zeroX, x1, by, bh, 4), "class": m.cls }));
              if (m.whisker) {
                var a = X(m.whisker[0]), b = X(m.whisker[1]);
                [["rc-halo", 4], ["rc-whisk", 1.5]].forEach(function (st) {
                  g.appendChild(el("path", { d: "M" + a + " " + (mid - 4.5) + "V" + (mid + 4.5) + "M" + b + " " + (mid - 4.5) + "V" + (mid + 4.5) + "M" + a + " " + mid + "H" + b, "class": st[0] }));
                });
              }
            } else if (m.dots) {
              var xs = m.dots.map(function (d) { return X(d.v); });
              g.appendChild(el("line", { x1: Math.min.apply(null, xs), x2: Math.max.apply(null, xs), y1: mid, y2: mid, "class": "rc-link" }));
              m.dots.forEach(function (d, i) { g.appendChild(el("circle", { cx: xs[i], cy: mid, r: 5, "class": d.cls + " rc-ring" })); });
            }
          });
          var hit = el("rect", { x: 0, y: sy, width: W, height: si.h, fill: "transparent" });
          hit.appendChild(el("title", {}, si.s.tip || ""));
          g.appendChild(hit);
          body.push(g);
          si.vl.forEach(function (v, i) {
            body.push(text(v.t, plotR + 10, lineY(mid - si.vl.length * VH / 2, i, VH, FM), FM, v.b ? "rc-t" : (si.vl.length > 1 ? "rc-m" : "rc-t"), null, v.b ? 700 : null));
          });
          sy += si.h + 2;
        });
      }
      y += rowH; first = false;
    });

    var yEnd = y + 2, axis = [];
    spec.ticks.forEach(function (t) {
      var x = X(t.v);
      axis.push(el("line", { x1: x, x2: x, y1: top - 2, y2: yEnd, "class": t.v === 0 && spec.zero ? "rc-zero" : "rc-grid" }));
      if (!(narrow && t.minor)) axis.push(text(t.label, x, yEnd + 15, FT, "rc-m", "middle"));
    });
    var yy = yEnd + 24;
    wrap(spec.axisTitle, W - 2 * pad - (narrow ? 0 : labelW), FM, 400).forEach(function (t) {
      axis.push(text(t, narrow ? pad : plotL, yy + 9, FM, "rc-m")); yy += VH;
    });
    if (spec.annot && zeroX !== null) {
      axis.push(el("path", { d: "M" + (zeroX - 9) + " 6L" + (zeroX - 14) + " 10L" + (zeroX - 9) + " 14", "class": "rc-chev" }));
      axis.push(text("lower", zeroX - 18, 14.5, FM, "rc-m", "end"));
      axis.push(el("path", { d: "M" + (zeroX + 9) + " 6L" + (zeroX + 14) + " 10L" + (zeroX + 9) + " 14", "class": "rc-chev" }));
      axis.push(text("higher", zeroX + 18, 14.5, FM, "rc-m"));
    }
    var H = Math.ceil(yy + 6);
    var svg = el("svg", { "class": "rc-svg", width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": spec.aria });
    [bands, seps, axis, body].forEach(function (list) { list.forEach(function (n) { svg.appendChild(n); }); });
    return svg;
  }

  // ---------------------------------------------------------------- figures and redraw
  var figures = [], uid = 0;
  function legendNode(items) {
    var ul = document.createElement("ul"); ul.className = "rc-legend";
    items.forEach(function (it) {
      var li = document.createElement("li"), sw = document.createElement("span");
      sw.className = "rc-sw rc-sw-" + it.kind + (it.cls ? " " + it.cls : "");
      sw.setAttribute("aria-hidden", "true");
      li.appendChild(sw); li.appendChild(document.createTextNode(it.label)); ul.appendChild(li);
    });
    return ul;
  }
  // make({title, legend, caption, note, build(W) -> spec}) returns the figure element, drawn on insertion.
  function make(id, opts) {
    var fig = document.createElement("figure"), n = ++uid;
    fig.className = "rc-fig"; fig.setAttribute("data-rc", id);
    var h = document.createElement("h3"); h.className = "rc-title"; h.id = "rc-t" + n; h.textContent = opts.title;
    var host = document.createElement("div"); host.className = "rc-host";
    var cap = document.createElement("figcaption"); cap.className = "rc-cap"; cap.id = "rc-c" + n;
    var s1 = document.createElement("span"); s1.textContent = opts.caption; cap.appendChild(s1);
    if (opts.note) { var s2 = document.createElement("span"); s2.className = "rc-note"; s2.textContent = " " + opts.note; cap.appendChild(s2); }
    fig.setAttribute("aria-labelledby", h.id); fig.setAttribute("aria-describedby", cap.id);
    fig.appendChild(h);
    if (opts.legend) fig.appendChild(legendNode(opts.legend));
    fig.appendChild(host); fig.appendChild(cap);
    var rec = { host: host, w: 0, build: opts.build, title: opts.title };
    figures.push(rec);
    return { fig: fig, rec: rec };
  }
  function render(rec, force) {
    var W = Math.floor(rec.host.clientWidth);
    if (!W || (!force && W === rec.w)) return;
    rec.w = W;
    var spec = rec.build(W);
    spec.W = W;
    var svg = draw(spec);
    svg.classList.add("rc-redraw");
    while (rec.host.firstChild) rec.host.removeChild(rec.host.firstChild);
    rec.host.appendChild(svg);
  }
  function place(made, anchor) {
    anchor.parentNode.insertBefore(made.fig, anchor);
    render(made.rec, true);
  }
  var pending = false;
  window.addEventListener("resize", function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; figures.forEach(function (r) { render(r, false); }); });
  });
  function onSwitch(name, made) {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (r) {
      r.addEventListener("change", function () { render(made.rec, true); });
    });
  }
  function checked(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }

  function ticksFor(lo, hi, step, majorEvery) {
    var out = [], v;
    for (v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(v);
    var zi = -1; out.forEach(function (t, i) { if (Math.abs(t) < 1e-9) zi = i; });
    return out.map(function (t, i) {
      var tv = Math.abs(t) < 1e-9 ? 0 : t;
      return { v: tv, label: tv === 0 ? "0" : num(tv, step < 0.1 ? 2 : step < 1 ? 1 : 0), minor: majorEvery > 1 && ((i - Math.max(zi, 0)) % majorEvery !== 0) };
    });
  }

  // ---------------------------------------------------------------- a. poster results (docs/CLAIMS.md, Poster Set P1 to P5)
  // Figures as printed in the list above: P1 at 100 seeds (the pre-registered replication), P3 and P4 at
  // 30 seeds (demo sweep, 2026-11-02, P1 was the 30-seed first test before). P2 and P5 are not a change in CO2-e per request, so
  // they get a text row and no bar.
  function posterSetup() {
    var sec = $("poster"), list = sec && sec.querySelector("ul.claims");
    if (!list) return;
    var LO = -60, HI = 5;
    var made = make("poster", {
      title: "Poster claims, percent change in CO2-e per request",
      legend: [{ kind: "bar", cls: "rc-s-ev", label: "Fleet with electric trucks" }, { kind: "bar", cls: "rc-s-diesel", label: "Four diesel trucks" },
        { kind: "bar", cls: "rc-s-ev rc-pale", label: "Pale part runs from zero to the near end of a range" }],
      caption: "Percent change in tier-1 CO2-e per request for the poster claims that give one, the figures listed below drawn as bars and nothing new.",
      note: "The 1000 g per km diesel factor is not sourced for this truck, so absolute kilograms are not predictions.",
      build: function (W) {
        return {
          labelW: 250, valueW: [190, 124], annot: true, zero: true,
          fx: function (v) { return (v - LO) / (HI - LO); },
          ticks: ticksFor(LO, HI, 20, 1),
          axisTitle: "Percent change in tier-1 CO2-e per request, emissions-aware plan against distance-only plan, P1 100 seeds, P3 and P4 30 seeds",
          aria: "Bar chart of the poster claims P1, P3 and P4 as percent change in CO2-e per request. The list below gives the same figures.",
          rows: [
            { label: "P1, one electric truck of four", slots: [{ lines: ["28.35 percent lower", "0.725 kg per request"], tip: "P1, one electric truck of four, 100 seeds, 28.35 percent lower, 0.725 kg per request", marks: [{ bar: -28.35, cls: "rc-s-ev" }] }] },
            { label: "P1, two electric trucks of four", sep: true, slots: [{ lines: ["55.78 percent lower", "0.863 kg per request"], tip: "P1, two electric trucks of four, 100 seeds, 55.78 percent lower, 0.863 kg per request", marks: [{ bar: -55.78, cls: "rc-s-ev" }] }] },
            { label: "P2, share of that saving from giving the longest routes to the electric trucks", sep: true, text: "55.1 to 73.7 percent of the saving. A share of the saving, not a change per request, so no bar." },
            { label: "P3, electric trucks charged at New South Wales grid factors, 600 to 780 g per km", sep: true, slots: [{ lines: ["1.48 to 10.75 percent lower", "0.052 to 0.313 kg per request"], tip: "P3, grid charging, 1.48 to 10.75 percent lower, 0.052 to 0.313 kg per request", marks: [{ bar: -10.75, near: -1.48, cls: "rc-s-ev" }] }] },
            { label: "P4, four diesel trucks", sep: true, slots: [{ lines: ["0.66 to 0.92 percent higher", "0.028 to 0.039 kg per request"], tip: "P4, four diesel trucks, 0.66 to 0.92 percent higher, 0.028 to 0.039 kg per request", marks: [{ bar: 0.92, near: 0.66, cls: "rc-s-diesel" }] }] },
            { label: "P5, published refuse-truck diesel factors, 2,089 to 3,423 g per km", sep: true, text: "The saving stayed within 2 percentage points of its value at 1000 g per km. Not a change per request, so no bar." }
          ]
        };
      }
    });
    place(made, list);
  }

  // ---------------------------------------------------------------- b. solver comparison
  function solverSetup() {
    var data = window.SRCRO_SOLVERS, sec = $("solvers"), table = $("solver-table");
    if (!data || !sec || !table) return;
    var anchor = table.closest(".table-scroll") || table;
    var lo = 0, hi = 0;
    data.solvers.forEach(function (s) { Object.keys(s.fleets).forEach(function (k) { lo = Math.min(lo, s.fleets[k].ci_low_kg); hi = Math.max(hi, s.fleets[k].ci_high_kg); }); });
    var step = 0.2, dlo = Math.floor(lo / step) * step, dhi = Math.ceil(hi / step) * step;
    var LOG_LO = Math.log(0.5), LOG_HI = Math.log(1000);

    var change = make("solver-change", {
      title: "Change in CO2-e per request, by solver",
      legend: [{ kind: "bar", cls: "rc-s-accent", label: "VROOM, the planner the project uses" }, { kind: "bar", cls: "rc-s-grey", label: "Alternative solvers" }, { kind: "whisker", label: "95 percent interval" }],
      caption: "Change in kg CO2-e per request for each solver, emissions-aware plan against distance-only plan, with the 95 percent interval as a whisker, the table's figures drawn and nothing new.",
      note: "A larger saving for an alternative solver is partly its distance-only plan driving more kilometres, so it is not a finding that the solver saves more.",
      build: function () {
        var fleet = checked("solver-fleet") || "1ev";
        return {
          labelW: 250, valueW: [120, 100], annot: true, zero: true,
          fx: function (v) { return (v - dlo) / (dhi - dlo); },
          ticks: ticksFor(dlo, dhi, step, 2),
          axisTitle: "Change in kg CO2-e per request, 30 seeds, same axis for every fleet",
          aria: "Bar chart of the change in kg CO2-e per request for each solver with its 95 percent interval. The table below gives the same figures.",
          rows: data.solvers.map(function (s) {
            var f = s.fleets[fleet], ref = s.role === "reference";
            return { label: s.label, sub: s.status, bold: ref, band: ref, slots: [{
              lines: [signed(f.change_kg, 3) + " kg", signed(f.change_pct, 1) + " percent"],
              tip: s.label + ", change " + signed(f.change_kg, 3) + " kg (95% interval " + signed(f.ci_low_kg, 3) + " to " + signed(f.ci_high_kg, 3) + "), " + signed(f.change_pct, 1) + " percent, adjusted p " + pval(f.p_adjusted),
              marks: [{ bar: f.change_kg, whisker: [f.ci_low_kg, f.ci_high_kg], cls: ref ? "rc-s-accent" : "rc-s-grey" }] }] };
          })
        };
      }
    });
    place(change, anchor);
    onSwitch("solver-fleet", change);

    var time = make("solver-time", {
      title: "Solve time per re-plan, by solver",
      legend: [{ kind: "dot", cls: "rc-s-grey", label: "Distance-only plan" }, { kind: "dot", cls: "rc-s-green", label: "Emissions-aware plan" }],
      caption: "Solve time per re-plan for each solver on a log scale, the table's figures drawn and nothing new.",
      note: "Solve times came from spot instances under load and are not timing evidence for the planner's performance requirement.",
      build: function () {
        var fleet = checked("solver-fleet") || "1ev";
        return {
          labelW: 250, valueW: [140, 124], annot: false, zero: false,
          fx: function (v) { return (Math.log(v) - LOG_LO) / (LOG_HI - LOG_LO); },
          ticks: [{ v: 1, label: "1 s" }, { v: 10, label: "10 s" }, { v: 100, label: "100 s" }, { v: 1000, label: "1,000 s" }],
          axisTitle: "Seconds per re-plan, log scale",
          aria: "Dot chart of solve time per re-plan for each solver on a log scale. The table above gives the same figures.",
          rows: data.solvers.map(function (s) {
            var f = s.fleets[fleet], ref = s.role === "reference", txt = num(f.solve_s_distance, 1) + " s and " + num(f.solve_s_emissions, 1) + " s";
            return { label: s.label, bold: ref, band: ref, slots: [{ lines: [txt], tip: s.label + ", distance-only plan " + txt.replace(" and ", ", emissions-aware plan "),
              marks: [{ dots: [{ v: f.solve_s_distance, cls: "rc-s-grey" }, { v: f.solve_s_emissions, cls: "rc-s-green" }] }] }] };
          })
        };
      }
    });
    place(time, anchor);
    onSwitch("solver-fleet", time);
  }

  // ---------------------------------------------------------------- c. multiple trips
  var FLEET_NAME = { "0ev": "0% electric (all diesel)", "1ev": "25% electric", "2ev": "50% electric" };
  function tripsSetup() {
    var data = window.SRCRO_TRIPS, table = $("trips-table");
    if (!data || !table) return;
    var anchor = table.closest(".table-scroll") || table;
    var LO = -100, HI = 5;
    var made = make("trips", {
      title: "Technical reduction and looser-rule total, percent",
      legend: [{ kind: "bar", cls: "rc-s-accent", label: "Technical reduction, the planner's own trip rules" }, { kind: "bar", cls: "rc-s-grey", label: "Looser-rule total, not a technical figure" }],
      caption: "Technical reduction and looser-rule total for each fleet and demand row, drawn as separate bars that are never added, the table's figures and nothing new.",
      build: function () {
        var k = checked("trips-kpi") || "cmem", rows = [], last = null;
        data.trips.forEach(function (r) {
          var c = r[k];
          if (r.fleet !== last) { rows.push({ group: FLEET_NAME[r.fleet] }); last = r.fleet; }
          rows.push({ label: r.case_label, slots: [
            { lines: [signed(c.fixed_pct, 1) + " (" + signed(c.fixed_kg, 3) + NB + "kg)"], tip: FLEET_NAME[r.fleet] + ", " + r.case_label + ", technical reduction " + signed(c.fixed_pct, 1) + " percent (" + signed(c.fixed_kg, 3) + " kg)", marks: [{ bar: c.fixed_pct, cls: "rc-s-accent" }] },
            { lines: [signed(c.combined_pct, 1) + " (" + signed(c.combined_kg, 3) + NB + "kg)"], tip: FLEET_NAME[r.fleet] + ", " + r.case_label + ", looser-rule total " + signed(c.combined_pct, 1) + " percent (" + signed(c.combined_kg, 3) + " kg)", marks: [{ bar: c.combined_pct, cls: "rc-s-grey" }] }
          ] });
        });
        return {
          labelW: 220, valueW: [132, 112], annot: true, zero: true,
          fx: function (v) { return (v - LO) / (HI - LO); },
          ticks: ticksFor(LO, HI, 25, 2),
          axisTitle: "Percent change in CO2-e per request, with the change in kg beside it",
          aria: "Grouped bar chart of the technical reduction and the looser-rule total for each fleet and demand row. The table below gives the same figures.",
          rows: rows
        };
      }
    });
    place(made, anchor);
    onSwitch("trips-kpi", made);
  }

  // ---------------------------------------------------------------- d. load-aware routing stage
  function stage2Setup() {
    var data = window.SRCRO_TRIPS, table = $("stage2-table");
    if (!data || !table) return;
    var anchor = table.closest(".table-scroll") || table;
    var LO = -60, HI = 5;
    var made = make("stage2", {
      title: "Saving without and with the load-aware stage, CMEM percent",
      legend: [{ kind: "bar", cls: "rc-s-grey", label: "Without the stage" }, { kind: "bar", cls: "rc-s-accent", label: "With the stage" }],
      caption: "Saving without and with the load-aware routing stage for each fleet, CMEM percent, the table's figures drawn and nothing new.",
      build: function () {
        return {
          labelW: 200, valueW: [150, 112], annot: true, zero: true,
          fx: function (v) { return (v - LO) / (HI - LO); },
          ticks: ticksFor(LO, HI, 20, 1),
          axisTitle: "Percent change in CMEM CO2-e per request, within the model, 100 seeds",
          aria: "Paired bar chart of the saving without and with the load-aware routing stage for each fleet. The table below gives the same figures.",
          rows: data.stage2.map(function (r, i) {
            return { label: FLEET_NAME[r.fleet], sep: i > 0, slots: [
              { lines: [signed(r.stage1_cmem_pct, 2)], tip: FLEET_NAME[r.fleet] + ", without the stage " + signed(r.stage1_cmem_pct, 2) + " percent", marks: [{ bar: r.stage1_cmem_pct, cls: "rc-s-grey" }] },
              { lines: [signed(r.stage2_cmem_pct, 2) + " (" + signed(r.stage2_cmem_kg, 3) + NB + "kg)"], tip: FLEET_NAME[r.fleet] + ", with the stage " + signed(r.stage2_cmem_pct, 2) + " percent (" + signed(r.stage2_cmem_kg, 3) + " kg)", marks: [{ bar: r.stage2_cmem_pct, cls: "rc-s-accent" }] }
            ] };
          })
        };
      }
    });
    place(made, anchor);
  }

  posterSetup();
  solverSetup();
  tripsSetup();
  stage2Setup();
})();
