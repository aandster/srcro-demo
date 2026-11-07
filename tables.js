// Tables without their own scrollbars (Jordan, 2026-11-01). Scroll areas inside the scrolling page make
// it hard to move down the page quickly, so every table grows to its full height instead, and:
// - a table of more than LIMIT rows shows its first SHOW rows and a button that shows all of them
// - each cell carries its column name, so on a narrow screen the rows reflow into labelled cards
//   (style.css) instead of scrolling sideways
// Tables are filled by other scripts after load, so a watcher relabels them whenever they change.
(function () {
  "use strict";
  var LIMIT = 20, SHOW = 15;

  // Column names from the header rows, joining a group heading to its sub-heading where there are two.
  function columnNames(table) {
    var rows = table.tHead ? Array.prototype.slice.call(table.tHead.rows) : [];
    var grid = [];
    rows.forEach(function (tr, r) {
      grid[r] = grid[r] || [];
      var c = 0;
      Array.prototype.forEach.call(tr.cells, function (cell) {
        while (grid[r][c] !== undefined) c++;
        var text = cell.textContent.replace(/\s+/g, " ").trim();
        for (var dr = 0; dr < (cell.rowSpan || 1); dr++) {
          for (var dc = 0; dc < (cell.colSpan || 1); dc++) {
            grid[r + dr] = grid[r + dr] || [];
            grid[r + dr][c + dc] = text;
          }
        }
        c += cell.colSpan || 1;
      });
    });
    var n = grid.reduce(function (m, row) { return Math.max(m, row.length); }, 0), names = [];
    for (var i = 0; i < n; i++) {
      var parts = [];
      grid.forEach(function (row) { if (row[i] && parts.indexOf(row[i]) < 0) parts.push(row[i]); });
      names.push(parts.join(", "));
    }
    return names;
  }

  function tidy(table) {
    var names = columnNames(table);
    Array.prototype.forEach.call(table.tBodies, function (tb) {
      Array.prototype.forEach.call(tb.rows, function (tr) {
        var c = 0;
        Array.prototype.forEach.call(tr.cells, function (cell) {
          if (names[c] && cell.getAttribute("data-label") !== names[c]) cell.setAttribute("data-label", names[c]);
          c += cell.colSpan || 1;
        });
      });
      var rows = tb.rows, wrap = table.closest(".table-scroll") || table.parentNode;
      var btn = wrap.nextElementSibling && wrap.nextElementSibling.classList.contains("table-more") ? wrap.nextElementSibling : null;
      if (rows.length <= LIMIT) { if (btn) btn.hidden = true; Array.prototype.forEach.call(rows, function (r) { r.hidden = false; }); return; }
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button"; btn.className = "table-more secondary";
        btn.addEventListener("click", function () {
          var open = table.getAttribute("data-open") !== "true";
          table.setAttribute("data-open", String(open));
          tidy(table);
          if (!open) wrap.scrollIntoView({ block: "start" });
        });
        wrap.parentNode.insertBefore(btn, wrap.nextSibling);
      }
      var open = table.getAttribute("data-open") === "true";
      Array.prototype.forEach.call(rows, function (r, i) {
        // the highlighted row (the scenario on the maps) always shows
        r.hidden = !open && i >= SHOW && !r.classList.contains("cur");
      });
      btn.hidden = false;
      btn.textContent = open ? "Show fewer rows" : "Show all " + rows.length + " rows";
    });
  }

  var pending = false;
  function tidyAll() {
    pending = false;
    Array.prototype.forEach.call(document.querySelectorAll("main table"), tidy);
  }
  function soon() { if (!pending) { pending = true; requestAnimationFrame(tidyAll); } }
  new MutationObserver(function (muts) {
    // react only to rows changing, not to this script's own attribute edits
    if (muts.some(function (m) { return m.type === "childList"; })) soon();
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
  tidyAll();
})();
