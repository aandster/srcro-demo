// Info buttons on the live form (Jordan, 2026-11-01). Hover and keyboard focus are pure CSS, so this
// only handles taps: one note open at a time, closed by a second tap, a tap elsewhere or Escape.
(function () {
  "use strict";
  function closeAll(except) {
    document.querySelectorAll(".field-label.open").forEach(function (f) {
      if (f === except) return;
      f.classList.remove("open");
      f.querySelector(".info-btn").setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest(".info-btn");
    if (!btn) { if (!ev.target.closest || !ev.target.closest(".info-tip")) closeAll(null); return; }
    var field = btn.parentElement, open = !field.classList.contains("open");
    closeAll(field);
    field.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeAll(null); });
})();
