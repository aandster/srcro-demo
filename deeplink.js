// Deep links and a per-view QR code for Explore Scenarios (Jordan, 2026-11-01). The address carries
// ?seed=12&ev=2&day=7&maps=both|distance|emissions. It is applied through the page's own controls
// (the scenario select, the fleet buttons, the maps radios and the run slider), so app.js is not
// touched, and kept up to date with history.replaceState as the visitor changes them.
// The presenter shows a scenario on the laptop and a visitor scans its QR code to get the same
// view on their phone. Needs the scenario picker, so it does nothing on live.html, where that picker
// is hidden and a live result cannot be rebuilt from an address.
(function () {
  "use strict";
  var plan = document.getElementById("plan"), fleetBox = document.getElementById("fleet-buttons"),
    run = document.getElementById("run"), label = document.getElementById("run-label"),
    row = document.querySelector(".ctl-scenario .ctl-row");
  if (!plan || !fleetBox || !run || !label || !row || !plan.getClientRects().length) return;

  var PUBLIC_BASE = "https://srcro.aandster.me/";
  var MAPS = ["both", "distance", "emissions"];
  var ready = false, timer = null;

  function mapRadios() { return document.querySelectorAll('input[name="mapview"]'); }
  function curSeed() { var m = /^seed:(\d+)$/.exec(plan.value); return m ? m[1] : null; }
  function curFleet() { var b = fleetBox.querySelector('button[aria-pressed="true"]'); return b ? b.getAttribute("data-fleet") : null; }
  function curMaps() { var r = document.querySelector('input[name="mapview"]:checked'); return r ? r.value : "both"; }
  function dayInfo() {
    var m = /Day (\d+) \/ (\d+)/.exec(label.textContent);
    return m ? { day: +m[1], n: +m[2] } : null;
  }
  function loaded() { return !plan.disabled && !!fleetBox.querySelector("button:not(:disabled)") && !!dayInfo(); }

  function query() {
    var seed = curSeed(), fleet = curFleet(), d = dayInfo(), parts = [];
    if (seed) parts.push("seed=" + seed);
    if (fleet !== null) parts.push("ev=" + fleet);
    if (d) parts.push("day=" + d.day);
    parts.push("maps=" + curMaps());
    return "?" + parts.join("&");
  }

  // A link for a phone must name a host the phone can reach, so a laptop copy (localhost or a
  // private address) shares the public site, as qr.js does for the home page.
  function shareUrl() {
    var host = location.hostname;
    var local = /^(localhost|127\.|0\.0\.0\.0|\[::1\]|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || /\.local$/.test(host);
    var base = local ? PUBLIC_BASE : location.origin + location.pathname.replace(/[^\/]*$/, "");
    return base + (location.pathname.split("/").pop() || "explore.html") + query();
  }

  // Parameters this file does not own (kiosk=1 for the stand screen, tour) stay in the address bar,
  // so a reload of the stand screen comes back in stand mode. Shared links leave them out.
  var OWN = { seed: 1, ev: 1, day: 1, maps: 1 };
  function kept() {
    return location.search.replace(/^\?/, "").split("&").filter(function (p) {
      return p && !OWN[p.split("=")[0]];
    });
  }

  function sync() {
    timer = null;
    if (!ready || !loaded()) return;
    var extra = kept(), q = query() + (extra.length ? "&" + extra.join("&") : "");
    if (q !== location.search) { try { history.replaceState(null, "", q + location.hash); } catch (e) { /* kept off the address bar */ } }
  }
  function soon() { if (!timer) timer = setTimeout(sync, 150); }

  function waitFor(test, then, tries) {
    if (test()) return then(true);
    if (tries <= 0) return then(false);
    setTimeout(function () { waitFor(test, then, tries - 1); }, 100);
  }

  // ---- apply the address on load

  function apply(p, done) {
    var seed = p.get("seed"), ev = p.get("ev"), day = parseInt(p.get("day"), 10), maps = p.get("maps");
    function afterSeed() {
      if (ev !== null && /^[0-4]$/.test(ev)) {
        var b = fleetBox.querySelector('button[data-fleet="' + ev + '"]');
        if (b && !b.disabled && b.getAttribute("aria-pressed") !== "true") b.click();
      }
      if (maps && MAPS.indexOf(maps) >= 0) {
        var r = document.querySelector('input[name="mapview"][value="' + maps + '"]');
        if (r && !r.checked) r.click();
      }
      // The slider holds STEPS values a day. The last value of a day is its finished view, which is
      // how a day opens. STEPS comes from the slider, so it follows app.js if that changes.
      var d = dayInfo();
      if (d && day >= 1) {
        var steps = (parseInt(run.max, 10) + 1) / d.n;
        run.value = String(Math.min(day, d.n) * steps - 1);
        run.dispatchEvent(new Event("input", { bubbles: true }));
      }
      done();
    }
    var opt = seed && plan.querySelector('option[value="seed:' + seed + '"]');
    if (opt && curSeed() !== seed) {
      plan.value = "seed:" + seed;
      plan.dispatchEvent(new Event("change", { bubbles: true }));
      // plan is disabled while the seed file loads, and the page resets the day when it arrives
      waitFor(function () { return loaded() && curSeed() === seed; }, afterSeed, 300);
    } else afterSeed();
  }

  // ---- Share this view

  var style = document.createElement("style");
  style.textContent =
    // One small share button that opens Copy link and QR code (Jordan, 2026-11-02, was two big buttons).
    ".share-view{position:relative;align-self:flex-end}" +
    ".share-view>summary{list-style:none;display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--rule);border-radius:8px;color:var(--ink);cursor:pointer}" +
    ".share-view>summary::-webkit-details-marker{display:none}" +
    ".share-view>summary:hover,.share-view>summary:focus-visible,.share-view[open]>summary{border-color:var(--accent);color:var(--accent)}" +
    ".share-pop{position:absolute;right:calc(100% + 6px);top:50%;transform:translateY(-50%);z-index:1100;display:flex;flex-direction:row;gap:6px;white-space:nowrap;padding:8px;background:var(--panel);border:1px solid var(--rule);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.35)}" +
    ".share-pop button{min-height:36px;text-align:left;background:transparent;color:var(--ink);border:1px solid var(--rule);font-weight:600}" +
    ".share-pop button:hover,.share-pop button:focus-visible{border-color:var(--accent)}" +
    // On a phone the button wraps to the left edge, so the menu opens to its right there.
    "@media (max-width:760px){.share-pop{right:auto;left:calc(100% + 6px)}}" +
    "dialog.qr-dialog{border:1px solid var(--rule);border-radius:12px;background:var(--panel);color:var(--ink);padding:18px 20px;width:min(460px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:visible}" +
    "dialog.qr-dialog::backdrop{background:rgba(0,0,0,.6)}" +
    "dialog.qr-dialog:not([open]){display:none}" +
    ".qr-dialog h2{margin:0 0 4px;font-size:18px}" +
    ".qr-dialog p{margin:0 0 10px;color:var(--muted);font-size:14px}" +
    ".qr-dialog .qr{width:min(100%,60vh);margin:0 auto 10px}" +
    ".qr-dialog .qr-link{word-break:break-all;font-size:13px;color:var(--ink)}" +
    ".qr-dialog .qr-actions{display:flex;justify-content:flex-end}";
  document.head.appendChild(style);

  var group = document.createElement("details");
  group.className = "share-view";
  group.innerHTML = '<summary aria-label="Share this view" title="Share this view">' +
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></summary>' +
    '<div class="share-pop" role="group" aria-label="Share this view">' +
    '<button type="button" id="share-copy">Copy link</button>' +
    '<button type="button" id="share-qr" aria-haspopup="dialog">QR code</button></div>' +
    '<span id="share-status" class="visually-hidden" role="status"></span>';
  row.appendChild(group);
  var shareBtn = group.querySelector("summary");
  // The menu closes on a click elsewhere or Escape, like the info notes.
  document.addEventListener("click", function (e) { if (group.open && !group.contains(e.target)) group.open = false; });
  group.addEventListener("keydown", function (e) { if (e.key === "Escape" && group.open) { group.open = false; shareBtn.focus(); } });
  var copyBtn = group.querySelector("#share-copy"), qrBtn = group.querySelector("#share-qr"),
    status = group.querySelector("#share-status"), copyTimer = null;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {
      var t = document.createElement("textarea");
      t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;top:0;opacity:0";
      document.body.appendChild(t); t.select();
      var good = false;
      try { good = document.execCommand("copy"); } catch (e) { /* falls through */ }
      t.remove();
      good ? ok() : fail(new Error("copy refused"));
    });
  }
  function flash(text, said) {
    copyBtn.textContent = text; status.textContent = said;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(function () { copyBtn.textContent = "Copy link"; status.textContent = ""; }, 2000);
  }
  copyBtn.addEventListener("click", function () {
    var url = shareUrl();
    copyText(url).then(function () { flash("Copied", "Link copied"); },
      function () { flash("Not copied", "The link could not be copied, use the QR code instead"); });
  });

  var dlg = null;
  function openQr() {
    var url = shareUrl();
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "qr-dialog";
      dlg.setAttribute("aria-labelledby", "qr-dialog-h");
      dlg.innerHTML = '<h2 id="qr-dialog-h">Open this view on a phone</h2>' +
        '<p>Point the phone camera at the code. It opens the same scenario, electric share, day and maps.</p>' +
        '<div class="qr" id="qr-dialog-code"></div><p class="qr-link" id="qr-dialog-link"></p>' +
        '<div class="qr-actions"><button type="button" id="qr-dialog-close">Close</button></div>';
      document.body.appendChild(dlg);
      dlg.querySelector("#qr-dialog-close").addEventListener("click", closeQr);
      dlg.addEventListener("click", function (e) { if (e.target === dlg) closeQr(); });
      dlg.addEventListener("close", function () { shareBtn.focus(); });
    }
    dlg.querySelector("#qr-dialog-link").textContent = url;
    drawQr(url, dlg.querySelector("#qr-dialog-code"));
    group.open = false;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }
  function closeQr() {
    if (!dlg) return;
    if (dlg.close) dlg.close(); else { dlg.removeAttribute("open"); shareBtn.focus(); }
  }
  // The same call pattern as qr.js: white ground and a wide quiet zone so a camera reads it.
  function drawQr(url, box) {
    function paint() {
      var qr = window.qrcode(0, "M");
      qr.addData(url); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true });
    }
    if (window.qrcode) return paint();
    box.textContent = "Loading the code";
    var s = document.createElement("script");
    s.src = "vendor/qrcode.js";
    s.onload = paint;
    s.onerror = function () { box.textContent = "The code could not load. Use Copy link instead."; };
    document.head.appendChild(s);
  }
  qrBtn.addEventListener("click", openQr);

  // ---- keep the address current

  new MutationObserver(soon).observe(label, { childList: true, characterData: true, subtree: true });
  new MutationObserver(soon).observe(fleetBox, { attributes: true, attributeFilter: ["aria-pressed"], childList: true, subtree: true });
  new MutationObserver(soon).observe(plan, { childList: true });
  plan.addEventListener("change", soon);
  Array.prototype.forEach.call(mapRadios(), function (r) { r.addEventListener("change", soon); });

  var p = new URLSearchParams(location.search), has = ["seed", "ev", "day", "maps"].some(function (k) { return p.has(k); });
  // Wait for the first scenario to finish loading, then apply the address, then start syncing.
  waitFor(loaded, function () {
    if (has) apply(p, function () { ready = true; soon(); });
    else ready = true;
  }, 600);
})();
