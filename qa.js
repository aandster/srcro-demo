// Questions page (Jordan, 2026-11-01). Renders window.SRCRO_QA (demo/qa-data.js) as one <details> per
// question, with a word search, topic chips and deep links. The answer text is never edited here.
(function () {
  "use strict";
  var QA = window.SRCRO_QA || [];
  function $(id) { return document.getElementById(id); }
  var list = $("qa-list"), input = $("qa-q"), count = $("qa-count"), chips = $("qa-chips");
  if (!list || !QA.length) return;

  // Search results open by themselves when few enough to read at once, so a visitor who types a
  // word sees the answers without a second tap.
  var OPEN_AT_MOST = 8;
  var topic = "All", items = [];

  // Text nodes only, so an answer can never become markup, and the highlights are added the same way.
  function setHighlighted(el, text, words) {
    el.textContent = "";
    if (!words.length) { el.appendChild(document.createTextNode(text)); return; }
    var re = new RegExp("(" + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var mark = document.createElement("mark"); mark.textContent = m[0]; el.appendChild(mark);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  QA.forEach(function (it) {
    var d = document.createElement("details"); d.className = "qa-item"; d.id = it.id;
    var s = document.createElement("summary"), q = document.createElement("span"); q.className = "qa-q";
    var cat = document.createElement("span"); cat.className = "qa-cat";
    s.appendChild(q); s.appendChild(cat); d.appendChild(s);
    var body = document.createElement("div"); body.className = "qa-body";
    var a = document.createElement("p"); a.className = "qa-a";
    // No Source line or Copy link button (Jordan, 2026-11-01). The sources stay in qa-data.js, and the
    // address bar still carries the open question's link.
    body.appendChild(a); d.appendChild(body);
    // The hash follows the open question, so the address bar links straight to it.
    d.addEventListener("toggle", function () {
      if (d.open) { try { history.replaceState(null, "", location.search + "#" + it.id); } catch (e) { /* kept off the address bar */ } }
    });
    list.appendChild(d);
    var hay = (it.q + " " + it.a + " " + it.category).toLowerCase();
    items.push({ it: it, el: d, q: q, cat: cat, a: a, hay: hay });
  });

  // Topic chips in the order the topics first appear in the data, which follows the poster's story.
  var cats = ["All"];
  QA.forEach(function (it) { if (cats.indexOf(it.category) < 0) cats.push(it.category); });
  cats.forEach(function (c) {
    var b = document.createElement("button"); b.type = "button"; b.className = "qa-chip"; b.textContent = c;
    b.setAttribute("aria-pressed", String(c === "All"));
    b.addEventListener("click", function () { topic = c; render(false); });
    chips.appendChild(b);
  });

  function words() { return input.value.toLowerCase().split(/\s+/).filter(Boolean); }

  function render(fromLoad) {
    var w = words(), shown = 0;
    Array.prototype.forEach.call(chips.children, function (b) { b.setAttribute("aria-pressed", String(b.textContent === topic)); });
    items.forEach(function (x) {
      // every typed word must appear somewhere in the question, answer or topic (AND)
      var ok = (topic === "All" || x.it.category === topic) && w.every(function (word) { return x.hay.indexOf(word) >= 0; });
      x.el.hidden = !ok;
      if (!ok) return;
      shown++;
      setHighlighted(x.q, x.it.q, w); setHighlighted(x.cat, x.it.category, w);
      setHighlighted(x.a, x.it.a, w);
    });
    count.textContent = shown + " of " + QA.length + " questions";
    $("qa-empty").hidden = shown > 0;
    if (w.length && shown <= OPEN_AT_MOST) items.forEach(function (x) { if (!x.el.hidden) x.el.open = true; });
    // keep ?search= in step with the box, so the address shares the search as typed
    if (!fromLoad) {
      var q = input.value.trim(), url = location.pathname + (q ? "?search=" + encodeURIComponent(q) : "") + location.hash;
      try { history.replaceState(null, "", url); } catch (e) { /* kept off the address bar */ }
    }
  }

  var timer = null;
  input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { render(false); }, 120); });
  $("qa-expand").addEventListener("click", function () { items.forEach(function (x) { if (!x.el.hidden) x.el.open = true; }); });
  $("qa-collapse").addEventListener("click", function () { items.forEach(function (x) { x.el.open = false; }); });

  // Deep links: ?search=word fills the search, #q012 opens that question and brings it into view.
  var params = new URLSearchParams(location.search);
  if (params.get("search")) input.value = params.get("search");
  render(true);
  function openHash() {
    var id = decodeURIComponent(location.hash.slice(1)), x = id && items.filter(function (y) { return y.it.id === id; })[0];
    if (!x) return;
    // a question hidden by a search or topic is shown again, the link has to land somewhere
    if (x.el.hidden) { input.value = ""; topic = "All"; render(true); }
    x.el.open = true;
    x.el.scrollIntoView({ block: "start" });
  }
  openHash();
  window.addEventListener("hashchange", openHash);
})();
