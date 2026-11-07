// Credits page. Lists the references in window.SRCRO_REFERENCES by group, each with what the project
// used it for. Built with text nodes only, so a citation can never inject markup.
(function () {
  "use strict";
  var refs = window.SRCRO_REFERENCES || [], box = document.getElementById("refs");
  var intro = document.getElementById("refs-intro");
  if (!box) return;
  var un = document.getElementById("unsourced");
  if (un) (window.SRCRO_UNSOURCED || []).forEach(function (a) {
    var li = document.createElement("li"); li.textContent = a; un.appendChild(li);
  });
  if (!refs.length) { intro.textContent = "The full reference list is being compiled and will appear here."; return; }
  intro.hidden = true;   // the list speaks for itself (Jordan, 2026-11-01)
  var groups = [];
  refs.forEach(function (r) { if (groups.indexOf(r.group) < 0) groups.push(r.group); });
  groups.forEach(function (g) {
    var h = document.createElement("h3"); h.textContent = g; box.appendChild(h);
    var ol = document.createElement("ol"); ol.className = "ref-list";
    refs.filter(function (r) { return r.group === g; }).forEach(function (r) {
      var li = document.createElement("li"), cite = document.createElement("p"), use = document.createElement("p");
      cite.className = "ref-cite"; cite.textContent = r.citation + " ";
      if (r.url) { var a = document.createElement("a"); a.href = r.url; a.textContent = r.url; a.rel = "noopener"; cite.appendChild(a); }
      use.className = "ref-use"; use.textContent = "Used for: " + r.used_for;
      li.appendChild(cite); li.appendChild(use); ol.appendChild(li);
    });
    box.appendChild(ol);
  });
})();
