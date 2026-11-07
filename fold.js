// Collapsible tables on Explore Scenarios and Live Plan (Jordan, 2026-11-01), so the maps and charts
// come first. Each table, with the Show all button tables.js puts after it, goes inside a <details>.
// Folded from the start on a phone, open on a wider screen, and either can be toggled. Runs before
// tables.js, so that button lands inside the fold.
(function () {
  "use strict";
  var phone = window.matchMedia("(max-width: 760px)").matches;
  Array.prototype.forEach.call(document.querySelectorAll("main table"), function (table) {
    var wrap = table.closest(".table-scroll") || table;
    if (wrap.closest("details")) return;
    var d = document.createElement("details"), s = document.createElement("summary");
    d.className = "table-fold";
    var cap = table.caption ? table.caption.textContent.trim() : "";
    s.innerHTML = '<span class="tf-label">Table</span>' + (cap ? ' <span class="tf-cap"></span>' : "");
    if (cap) s.querySelector(".tf-cap").textContent = cap;
    d.appendChild(s);
    wrap.parentNode.insertBefore(d, wrap);
    d.appendChild(wrap);
    d.open = !phone;
    // The two plans' request tables sit side by side, so they open and close together (Jordan,
    // 2026-11-02). They are paired by their panels, req-distance and req-emissions.
    var panel = table.closest("#req-distance, #req-emissions");
    if (panel) d.setAttribute("data-fold-pair", "requests");
  });
  document.addEventListener("toggle", function (ev) {
    var d = ev.target, key = d.getAttribute && d.getAttribute("data-fold-pair");
    if (!key) return;
    Array.prototype.forEach.call(document.querySelectorAll('details[data-fold-pair="' + key + '"]'), function (o) {
      if (o !== d && o.open !== d.open) o.open = d.open;   // the other's own toggle then finds them equal
    });
  }, true);   // toggle does not bubble, so listen in the capture phase
})();
