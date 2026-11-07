// Finish for the expo (Jordan, 2026-11-01). Loaded last on every page. It reads the page's own controls
// and never reaches into the internals of app.js.
// Share metadata is in each page's head, because link preview crawlers do not run scripts.
(function () {
  "use strict";
    function $(id) { return document.getElementById(id); }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function playBtn() { return $("play"); }
  function isPlaying() { var b = playBtn(); return !!b && b.getAttribute("aria-pressed") === "true"; }

  // ---- favicon, only if the page did not already carry one
  if (!q('link[rel~="icon"]')) {
    var ic = document.createElement("link");
    ic.rel = "icon"; ic.type = "image/svg+xml"; ic.href = "favicon.svg";
    document.head.appendChild(ic);
  }

  // ---- tab strip: the current tab scrolls into view, and a fade marks the edge with more behind it
  (function () {
    var tabs = q(".tabs");
    if (!tabs) return;
    function fade() {
      var max = tabs.scrollWidth - tabs.clientWidth;
      tabs.classList.toggle("fade-end", max > 1 && tabs.scrollLeft < max - 1);
      tabs.classList.toggle("fade-start", max > 1 && tabs.scrollLeft > 1);
    }
    var cur = q('a[aria-current="page"]', tabs);
    if (cur) {
      // Centre the current tab by moving the strip, not the page.
      tabs.scrollLeft = Math.max(0, cur.offsetLeft - (tabs.clientWidth - cur.offsetWidth) / 2);
    }
    tabs.addEventListener("scroll", fade, { passive: true });
    window.addEventListener("resize", fade);
    fade();
  })();

  // ---- pinned top bar: how much of it stays on screen, so the playback bar pins under it. On a phone
  // the name row scrolls away and only the tab strip is pinned (style.css, Jordan, 2026-11-01).
  (function () {
    var nav = q(".topbar"), tabs = q(".tabs"), root = document.documentElement;
    if (!nav || !tabs) return;
    function measure() {
      var narrow = window.matchMedia("(max-width: 640px)").matches;
      var away = narrow ? Math.max(0, tabs.getBoundingClientRect().top - nav.getBoundingClientRect().top - 8) : 0;
      root.style.setProperty("--nav-top", (-away) + "px");
      root.style.setProperty("--nav-pin", (nav.offsetHeight - away) + "px");
    }
    measure();
    window.addEventListener("resize", measure);
    if (window.ResizeObserver) new ResizeObserver(measure).observe(nav);
  })();

  // ---- keep the screen awake while the run plays. Silent where unsupported or refused.
  (function () {
    var btn = playBtn();
    if (!btn || !("wakeLock" in navigator)) return;
    var lock = null, asking = false;
    function acquire() {
      if (lock || asking || !isPlaying() || document.visibilityState !== "visible") return;
      asking = true;
      var p;
      try { p = navigator.wakeLock.request("screen"); } catch (e) { asking = false; return; }
      Promise.resolve(p).then(function (s) {
        asking = false;
        if (!isPlaying()) { try { s.release(); } catch (e) { /* already released */ } return; }
        lock = s;
        s.addEventListener("release", function () { if (lock === s) lock = null; });
      }, function () { asking = false; });
    }
    function release() {
      var s = lock; lock = null;
      if (s) { try { Promise.resolve(s.release()).catch(function () {}); } catch (e) { /* nothing held */ } }
    }
    new MutationObserver(function () { if (isPlaying()) acquire(); else release(); })
      .observe(btn, { attributes: true, attributeFilter: ["aria-pressed"] });
    // The browser drops the lock when the page is hidden, so it is asked for again on return.
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") acquire(); });
    if (isPlaying()) acquire();
  })();
})();
