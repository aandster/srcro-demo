// Presenter page. A sign-in screen first, then the dashboard that starts and stops the hosted live
// re-plan server (scripts/cloud/live_replan/control.py). The control function checks the admin
// password on every call, including start and stop. This page only decides what to show, so the
// sign-in screen is a convenience and not the protection. The password stays in this page's memory
// and is forgotten on reload or sign out.
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var cfg = window.SRCRO_LIVE;
  if (!cfg || !cfg.control) {
    $("login-msg").textContent = "No hosted live server is configured in live-config.js.";
    $("login-go").disabled = true;
    return;
  }
  var control = cfg.control.replace(/\/$/, "");
  var proxy = cfg.proxy ? cfg.proxy.replace(/\/$/, "") : "";
  var password = null;      // set after a successful sign in
  var timer = null;

  function post(path, body) {
    return fetch(control + path, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); });
  }

  function sydneyTime(iso) {
    return new Date(iso).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" });
  }

  function showDashboard(on) {
    $("login-section").hidden = on;
    $("dashboard").hidden = !on;
    $("page-h").textContent = on ? "Presenter Controls" : "Presenter Sign In";
    $("page-sub").textContent = on ? "Starts the live re-plan server for visitors."
      : "Sign in to start and stop the live re-plan server.";
    document.title = on ? "Presenter Controls" : "Presenter Sign In";
  }

  // ---- sign in

  $("login-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var typed = $("admin-pass").value;
    $("login-go").disabled = true;
    $("login-msg").textContent = "Checking";
    post("/login", { password: typed }).then(function (res) {
      $("login-go").disabled = false;
      if (res.code === 200) {
        password = typed;
        $("admin-pass").value = "";
        $("login-msg").textContent = "";
        showDashboard(true);
        refresh();
        timer = setInterval(function () { if (!document.hidden) refresh(); }, 15000);
      } else {
        $("login-msg").textContent = res.code === 403 ? "That password is not right." : (res.j.error || "Could not sign in.");
        $("admin-pass").select();
      }
    }).catch(function (e) {
      $("login-go").disabled = false;
      $("login-msg").textContent = "Could not reach AWS: " + e.message;
    });
  });

  function signOut(message) {
    password = null;
    clearInterval(timer);
    $("admin-msg").textContent = "";
    showDashboard(false);
    $("login-msg").textContent = message || "";
  }
  $("admin-signout").addEventListener("click", function () { signOut(""); });

  // ---- dashboard

  function refresh() {
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
      queueLine(s.state === "running");
    }).catch(function () { $("live-server").textContent = "Could not reach the live server's status."; });
  }

  // How many visitors are waiting, from the same health route the visitor page reads.
  function queueLine(running) {
    if (!running || !proxy) { $("live-queue").textContent = ""; return; }
    fetch(proxy + "/api/health", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (h) {
      if (h.busy === undefined) { $("live-queue").textContent = ""; return; }
      $("live-queue").textContent = !h.busy && !h.waiting ? "No re-plan is running and none is waiting."
        : (h.busy ? "A re-plan is running" : "No re-plan is running") + ", " + (h.waiting || 0) +
          ((h.waiting || 0) === 1 ? " is" : " are") + " waiting.";
    }).catch(function () { $("live-queue").textContent = ""; });
  }

  function send(action) {
    var btns = [$("admin-start"), $("admin-stop")];
    btns.forEach(function (b) { b.disabled = true; });
    $("admin-msg").textContent = action === "stop" ? "Asking AWS to stop the server" : "Asking AWS to start the server";
    post("/" + action, { password: password }).then(function (res) {
      btns.forEach(function (b) { b.disabled = false; });
      if (res.code === 403 && /password/.test(res.j.error || "")) { signOut("Please sign in again."); return; }
      if (res.code === 202) $("admin-msg").textContent = action === "stop" ? "Stopping. The server is off in about a minute." : "Starting. It takes about two minutes.";
      else if (res.code === 200) $("admin-msg").textContent = action === "stop" ? "Already off." : "Already running.";
      else $("admin-msg").textContent = res.j.error || "Could not reach the control function.";
      if (res.code < 300) refresh();
    }).catch(function (e) {
      btns.forEach(function (b) { b.disabled = false; });
      $("admin-msg").textContent = "Could not reach AWS: " + e.message;
    });
  }
  $("admin-start").addEventListener("click", function () { send("start"); });
  $("admin-stop").addEventListener("click", function () { send("stop"); });
})();
