// Presenter page. Starts the hosted live re-plan server (scripts/cloud/live_replan/control.py)
// and shows its state. The admin password is checked by the control function, never by this page.
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var cfg = window.SRCRO_LIVE;
  if (!cfg || !cfg.control) {
    $("live-server").textContent = "No hosted live server is configured in live-config.js.";
    $("admin-form").hidden = true;
    return;
  }
  var control = cfg.control.replace(/\/$/, "");

  function sydneyTime(iso) {
    return new Date(iso).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" });
  }

  function refreshStatus() {
    fetch(control + "/status", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (s) {
      var line;
      if (s.expired) line = "The live re-plan window has ended.";
      else if (s.state === "stopped") line = "The live server is off.";
      else if (s.state === "pending") line = "The live server is starting, about two minutes.";
      else if (s.state === "stopping") line = "The live server is turning off.";
      else if (s.state === "running") line = "The live server is on until about " + sydneyTime(s.off_at) +
        " Sydney time, one hour after the last re-plan.";
      else line = "The live server is " + s.state + ".";
      $("live-server").textContent = line;
    }).catch(function () { $("live-server").textContent = "Could not reach the live server's status."; });
  }

  $("admin-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    $("admin-start").disabled = true;
    $("admin-msg").textContent = "Asking AWS to start the server";
    fetch(control + "/start", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("admin-pass").value }) })
      .then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); })
      .then(function (res) {
        $("admin-start").disabled = false;
        if (res.code === 202) $("admin-msg").textContent = "Starting. It takes about two minutes.";
        else if (res.code === 200) $("admin-msg").textContent = "Already running.";
        else $("admin-msg").textContent = res.j.error || "Could not start the server.";
        if (res.code < 300) { $("admin-pass").value = ""; refreshStatus(); }
      })
      .catch(function (e) { $("admin-start").disabled = false; $("admin-msg").textContent = "Could not reach AWS: " + e.message; });
  });

  refreshStatus();
  setInterval(function () { if (!document.hidden) refreshStatus(); }, 15000);
})();
