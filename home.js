// Home page hero and tour card (expo, 2026-11-01). Inserted by script so index.html keeps its own markup.
// The three tiles are the pre-registered 100-seed figures from docs/CLAIMS.md (C1's replication), with the
// first 30-seed test (Poster Set P1) beside them, copied as written and not rounded again. The route sketch is drawn from window.SRCRO_LAYERS (layers.js,
// loaded after the page is up) as a plain SVG with no map library. Presentation only, nothing is computed.
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var main = document.querySelector("main.home"), cards = document.querySelector(".home-cards");
  if (!main || !cards) return;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function s(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  // Lead with the pre-registered 100-seed replication (docs/CLAIMS.md line under the C1 table, task 062
  // part A), the figures the poster prints as 28.4 and 55.8. The 30-seed figures (P1, 28.57 and 55.38)
  // ran on 2026-10-02, before the first pre-registration in git on 2026-10-04, so they are the first
  // test, not a pre-registered result (demo sweep, 2026-11-02). The all-diesel arm is +0.27 percent, not
  // significant, at 100 seeds (H2 holds).
  var TILES = [
    { electric: 1, big: "28.35%", unit: "lower", what: "1 electric truck of 4", rep: "First test, 30 seeds: 28.57%" },
    { electric: 2, big: "55.78%", unit: "lower", what: "2 electric trucks of 4", rep: "First test, 30 seeds: 55.38%" },
    { electric: 0, big: "No saving", unit: "", what: "4 diesel trucks", rep: "+0.27%, not significant" }
  ];

  function fleetIcon(n) {
    var svg = s("svg", { viewBox: "0 0 76 16", width: 76, height: 16, "aria-hidden": "true", "class": "home-fleet" });
    for (var i = 0; i < 4; i++) svg.appendChild(s("circle", { cx: 8 + i * 20, cy: 8, r: 6.5, "class": i < n ? "home-ev" : "home-diesel" }));
    return svg;
  }

  var hero = h("section", "home-hero");
  hero.setAttribute("aria-labelledby", "home-hero-h");
  var lead = h("h2", "visually-hidden", "The project in brief");
  lead.id = "home-hero-h";
  var text = h("div", "home-hero-text");
  text.appendChild(h("p", "home-lead", "Routing Newcastle's kerbside reuse collections to cut CO2-e, against distance-only routing on the same requests."));
  text.appendChild(h("p", "home-kicker", "CO2-e per request. Blue is electric, orange is diesel."));
  var ul = h("ul", "home-tiles");
  TILES.forEach(function (t) {
    // Plain figures, not links (Jordan, 2026-11-01): a tile that looks like a card but is not one,
    // next to a map sketch that is not one either, misled visitors. The cards below do the navigating.
    var li = h("li"), a = h("div", "home-tile");
    a.appendChild(fleetIcon(t.electric));
    var fig = h("span", "home-fig");
    fig.appendChild(h("span", "home-num" + (t.unit ? "" : " home-num-text"), t.big));
    if (t.unit) fig.appendChild(h("span", "home-unit", " " + t.unit));
    a.appendChild(fig);
    a.appendChild(h("span", "home-what", t.what));
    a.appendChild(h("span", "home-tag", "Pre-registered, 100 seeds"));
    a.appendChild(h("span", "home-tag home-rep", t.rep));
    li.appendChild(a); ul.appendChild(li);
  });
  text.appendChild(ul);
  hero.appendChild(lead); hero.appendChild(text);

  var sketch = h("figure", "home-sketch");
  sketch.hidden = true;
  hero.appendChild(sketch);
  main.insertBefore(hero, cards);

  // The tour card comes first in the grid and spans two columns, the page cards follow in the
  // top bar's order (Jordan, 2026-11-01, every page in the bar has a card).
  var tour = h("a", "home-card home-tour");
  tour.href = "explore.html?tour=1";
  var play = s("svg", { viewBox: "0 0 24 24", width: 44, height: 44, "aria-hidden": "true", "class": "home-tour-ic" });
  play.appendChild(s("circle", { cx: 12, cy: 12, r: 11 }));
  play.appendChild(s("path", { d: "M10 7.5v9l7-4.5z" }));
  tour.appendChild(play);
  tour.appendChild(h("h2", "", "Take the 2 minute tour"));
  tour.appendChild(h("p", "", "A short guided walk through the Explore Scenarios page."));
  cards.insertBefore(tour, cards.firstChild);

  // ---------------------------------------------------------------- live server badge
  // A small badge on the Live Plan card says whether the live server is on (Jordan, 2026-11-01).
  // It reads the same public /status as the live page, every 30 s while the tab is visible, and
  // stays hidden when the site has no live plan or the status cannot be read.
  var badge = document.getElementById("home-live-badge"), cfg = window.SRCRO_LIVE;
  function liveBadge() {
    fetch(cfg.control.replace(/\/$/, "") + "/status", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then(function (st) {
      var on = st.state === "running" && !st.expired, wait = st.state === "pending";
      badge.className = "live-badge " + (on ? "lb-on" : wait ? "lb-wait" : "lb-off");
      badge.textContent = on ? "Server online" : wait ? "Starting" : st.expired ? "Ended" : "Server off";
      badge.hidden = false;
    }).catch(function () { /* keep the last answer, a missed poll is not news */ });
  }
  if (badge && cfg && cfg.control) {
    liveBadge();
    setInterval(function () { if (!document.hidden) liveBadge(); }, 30000);
  }

  // ---------------------------------------------------------------- route sketch
  function drawSketch() {
    var L = window.SRCRO_LAYERS;
    if (!L || !L.boundary || !L.boundary[0]) return;
    var ring = L.boundary[0], B = 200, M = 6;
    var lat0 = 0, lon0 = 1e9, la1 = -1e9, lo1 = -1e9, la0 = 1e9;
    ring.forEach(function (p) { la0 = Math.min(la0, p[0]); la1 = Math.max(la1, p[0]); lon0 = Math.min(lon0, p[1]); lo1 = Math.max(lo1, p[1]); });
    lat0 = (la0 + la1) / 2;
    var kx = Math.cos(lat0 * Math.PI / 180);
    var wUnits = (lo1 - lon0) * kx, hUnits = la1 - la0, scale = (B - 2 * M) / Math.max(wUnits, hUnits);
    var offX = (B - wUnits * scale) / 2, offY = (B - hUnits * scale) / 2;
    function pt(p) { return [offX + (p[1] - lon0) * kx * scale, offY + (la1 - p[0]) * scale]; }
    function path(points, close) {
      var d = "", last = null;
      points.forEach(function (p) {
        var q = pt(p);
        if (last && Math.abs(q[0] - last[0]) + Math.abs(q[1] - last[1]) < 0.9) return;
        d += (last ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1); last = q;
      });
      return d + (close ? "Z" : "");
    }
    var svg = s("svg", { viewBox: "0 0 " + B + " " + B, "class": "home-sketch-svg", role: "img",
      "aria-label": "Outline of the Newcastle local government area with its major roads and the depot" });
    svg.appendChild(s("path", { d: path(ring, true), "class": "sk-area" }));
    var minor = "", major = "";
    (L.basemap || []).forEach(function (r) {
      if (r.c === "secondary") minor += path(r.p);
      else if (r.c === "motorway" || r.c === "trunk" || r.c === "primary") major += path(r.p);
    });
    svg.appendChild(s("path", { d: minor, "class": "sk-minor" }));
    svg.appendChild(s("path", { d: major, "class": "sk-major" }));
    svg.appendChild(s("path", { d: path(ring, true), "class": "sk-edge" }));
    var d = pt(L.depot);
    svg.appendChild(s("rect", { x: (d[0] - 4).toFixed(1), y: (d[1] - 4).toFixed(1), width: 8, height: 8, "class": "sk-depot" }));
    sketch.appendChild(svg);
    sketch.appendChild(h("figcaption", "", "Newcastle, major roads and depot"));
    sketch.hidden = false;
  }
  if (window.SRCRO_LAYERS) drawSketch();
  else {
    var load = function () {
      var sc = document.createElement("script");
      sc.src = "layers.js"; sc.onload = drawSketch;
      document.body.appendChild(sc);
    };
    if (document.readyState === "complete") load(); else window.addEventListener("load", load);
  }
})();
