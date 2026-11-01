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

  // Both buttons submit the one form, so a password manager sees an ordinary sign-in form
  // (username and password fields, one submit) and offers to fill and save it.
  function send(action, ev) {
    ev.preventDefault();
    var btns = [$("admin-start"), $("admin-stop")];
    btns.forEach(function (b) { b.disabled = true; });
    $("admin-msg").textContent = action === "stop" ? "Asking AWS to stop the server" : "Asking AWS to start the server";
    fetch(control + "/" + action, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("admin-pass").value }) })
      .then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); })
      .then(function (res) {
        btns.forEach(function (b) { b.disabled = false; });
        if (res.code === 202) $("admin-msg").textContent = action === "stop" ? "Stopping. The server is off in about a minute." : "Starting. It takes about two minutes.";
        else if (res.code === 200) $("admin-msg").textContent = action === "stop" ? "Already off." : "Already running.";
        else $("admin-msg").textContent = res.j.error || "Could not reach the control function.";
        if (res.code < 300) refreshStatus();
      })
      .catch(function (e) { btns.forEach(function (b) { b.disabled = false; }); $("admin-msg").textContent = "Could not reach AWS: " + e.message; });
  }
  $("admin-form").addEventListener("submit", function (ev) {
    send(ev.submitter && ev.submitter.value === "stop" ? "stop" : "start", ev);
  });

  refreshStatus();
  setInterval(function () { if (!document.hidden) refreshStatus(); }, 15000);
})();
