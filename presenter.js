// Presenter page. A sign-in screen first, then the dashboard that starts and stops the hosted live
// re-plan server (scripts/cloud/live_replan/control.py). The control function checks the admin
// password on every call, including start and stop. This page only decides what to show, so the
// sign-in screen is a convenience and not the protection. Since 2026-11-02 (Jordan) the page stays
// signed in until Sign out, across reloads and visits to the demo, so it keeps the password in this
// browser's local storage for this site. Use it on the presenter's own device only.
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
  var KEY = "srcro_presenter";
  function remember(p) { try { if (p === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch (e) { /* private mode, this visit only */ } }
  function remembered() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  function post(path, body) {
    return fetch(control + path, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); });
  }

  function sydneyTime(iso) {
    // Time only, the idle stop is 10 minutes away since 2026-11-02 afternoon (it was 48 hours that morning).
    return new Date(iso).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" });
  }

  function showDashboard(on) {
    $("login-section").hidden = on;
    $("dashboard").hidden = !on;
    $("admin-signout").hidden = !on;
    $("page-h").textContent = on ? "Presenter Controls" : "Presenter Sign In";
    $("page-sub").textContent = on ? "Starts the live plan server for visitors."
      : "Sign in to start and stop the live plan server.";
    document.title = on ? "Presenter Controls" : "Presenter Sign In";
  }

  // ---- sign in

  function signIn(typed, quiet) {
    $("login-go").disabled = true;
    $("login-msg").textContent = quiet ? "Signing you back in" : "Checking";
    post("/login", { password: typed }).then(function (res) {
      $("login-go").disabled = false;
      if (res.code === 200) {
        password = typed;
        remember(typed);
        $("admin-pass").value = "";
        $("login-msg").textContent = "";
        showDashboard(true);
        refresh();
        refreshStats();
        clearInterval(timer);
        timer = setInterval(function () { if (!document.hidden) { refresh(); refreshStats(); } }, 15000);
      } else if (quiet) {
        if (res.code === 403) remember(null);   // the stored password no longer works
        $("login-msg").textContent = res.code === 403 ? "Please sign in again." : "";
      } else {
        $("login-msg").textContent = res.code === 403 ? "That password is not right." : (res.j.error || "Could not sign in.");
        $("admin-pass").select();
      }
    }).catch(function (e) {
      $("login-go").disabled = false;
      $("login-msg").textContent = "Could not reach AWS: " + e.message;
    });
  }
  $("login-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    signIn($("admin-pass").value, false);
  });
  if (remembered()) signIn(remembered(), true);

  function signOut(message) {
    password = null;
    remember(null);
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
      if (s.expired) line = "The live plan window has ended.";
      else if (s.state === "stopped") line = "The live server is asleep. A visitor's re-plan starts it.";
      else if (s.state === "pending") line = "The live server is starting.";
      else if (s.state === "stopping") line = "The live server is turning off.";
      else if (s.state === "running") line = s.held ? "The live server is on while a re-plan runs or waits, then 10 more minutes." :
        "The live server is on until about " + sydneyTime(s.off_at) + " Sydney time, later if someone re-plans.";
      else line = "The live server is " + s.state + ".";
      $("live-server").textContent = line;
      // The switch shows what AWS holds. An older control function sends no auto_wake, the box stays off limits.
      var box = $("admin-autowake");
      if (typeof s.auto_wake === "boolean" && !box.dataset.busy) { box.checked = s.auto_wake; box.disabled = false; }
      queueLine(s.state === "running");
    }).catch(function () { $("live-server").textContent = "Could not reach the live server's status."; });
  }

  // How many visitors are waiting, from the same health route the visitor page reads.
  function queueLine(running) {
    if (!running || !proxy) { $("live-queue").textContent = ""; $("stats-server").textContent = ""; return; }
    fetch(proxy + "/api/health", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (h) {
      if (h.busy === undefined) { $("live-queue").textContent = ""; return; }
      // More run statistics (Jordan, 2026-11-02), from what the health route already reports.
      $("stats-server").textContent = "Since this server started: " + (h.finished || 0) + (h.finished === 1 ? " re-plan" : " re-plans") + " finished" +
        (h.seconds_per_day ? ", about " + h.seconds_per_day + " s of planning per simulated day" : "") +
        (h.timeout_s ? ", a run stops after " + Math.round(h.timeout_s / 60) + " min" : "") +
        (h.max_waiting ? ", up to " + h.max_waiting + " may wait in the queue" : "") + ".";
      $("live-queue").textContent = h.waiting ? h.waiting + (h.waiting === 1 ? " re-plan is" : " re-plans are") + " waiting." :
        (h.busy ? (h.running_count > 1 ? h.running_count + " re-plans are running." : "One re-plan is running.") : "Nobody is waiting.") +
        (h.parallel ? " Up to " + h.parallel + " run at once." : "");
      // The waiting re-plans in order, their settings only (Jordan, 2026-11-02).
      var q = h.queued || [], ol = $("admin-queue");
      ol.hidden = !q.length;
      ol.innerHTML = q.map(function (x) {
        var p = x.params || {}, t = [];
        if (p.n_electric) t.push(p.n_electric + " electric");
        if (p.n_diesel) t.push(p.n_diesel + " diesel");
        return "<li>" + t.join(" and ") + ", " + p.arrivals_per_day + " requests a day, " + p.measure_days + " measured days</li>";
      }).join("");
    }).catch(function () { $("live-queue").textContent = ""; });
  }

  // Run statistics, from the control function's /stats (admin password, counts of re-plans started).
  function listHtml(obj, unit) {
    var keys = Object.keys(obj);
    if (!keys.length) return "<li>none yet</li>";
    // Runs logged before 2026-11-02 have no electric count (Python's None), so say so instead.
    return keys.map(function (k) { return "<li><strong>" + obj[k] + "</strong> " + (k === "None" || k === "null" ? "not logged" : "at " + k + unit) + "</li>"; }).join("");
  }
  function sydneyClock(iso) {
    return new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Sydney", weekday: "short", hour: "numeric",
      minute: "2-digit", second: "2-digit" });
  }
  function refreshStats() {
    if (password === null) return;
    post("/stats", { password: password }).then(function (res) {
      if (res.code === 403) { signOut("Please sign in again."); return; }
      if (res.code !== 200) { $("stats-summary").textContent = res.j.error || "Could not load the statistics."; return; }
      var s = res.j;
      $("stats-summary").textContent = s.total + (s.total === 1 ? " re-plan" : " re-plans") + " in the last " +
        s.window_hours + " hours, " + s.last_hour + " in the last hour" +
        (s.last ? ", the latest at " + sydneyClock(s.last) + " Sydney time." : ".");
      $("stats-days").innerHTML = listHtml(s.by_measure_days, " measured days");
      $("stats-fleet").innerHTML = listHtml(s.by_fleet_ev, " electric");
      $("stats-recent").tBodies[0].innerHTML = s.recent.map(function (r) {
        return "<tr><td>" + sydneyClock(r.t) + "</td><td>" + (r.seed === null || r.seed === undefined ? "random" : r.seed) +
          "</td><td>" + (r.fleet_ev === null || r.fleet_ev === undefined ? "not logged" : r.fleet_ev) + "</td><td>" + r.arrivals_per_day + "</td><td>" + r.measure_days + "</td></tr>";
      }).join("") || "<tr><td colspan=5>none yet</td></tr>";
    }).catch(function () { $("stats-summary").textContent = "Could not reach AWS for the statistics."; });
  }

  function send(action) {
    var btns = [$("admin-start"), $("admin-stop")];
    btns.forEach(function (b) { b.disabled = true; });
    $("admin-msg").textContent = action === "stop" ? "Asking AWS to stop the server" : "Asking AWS to start the server";
    post("/" + action, { password: password }).then(function (res) {
      btns.forEach(function (b) { b.disabled = false; });
      if (res.code === 403 && /password/.test(res.j.error || "")) { signOut("Please sign in again."); return; }
      if (res.code === 202) $("admin-msg").textContent = action === "stop" ? "Stopping. The server is off in about a minute." : "Starting. It takes under a minute.";
      else if (res.code === 200) $("admin-msg").textContent = action === "stop" ? "Already off." : "Already running.";
      else $("admin-msg").textContent = res.j.error || "Could not reach the control function.";
      if (res.code < 300) refresh();
    }).catch(function (e) {
      btns.forEach(function (b) { b.disabled = false; });
      $("admin-msg").textContent = "Could not reach AWS: " + e.message;
    });
  }
  $("admin-start").addEventListener("click", function () { send("start"); });

  // Automatic start on or off (Jordan, 2026-11-02). Off, visitors see "ask the presenter" again and
  // only Start live server wakes it. The 10 minute idle stop applies either way.
  $("admin-autowake").addEventListener("change", function () {
    var box = this, want = box.checked;
    box.disabled = true; box.dataset.busy = "1";
    $("admin-msg").textContent = want ? "Turning automatic start on" : "Turning automatic start off";
    post("/autowake", { password: password, enabled: want }).then(function (res) {
      if (res.code === 403 && /password/.test(res.j.error || "")) { signOut("Please sign in again."); return; }
      if (res.code === 200) $("admin-msg").textContent = res.j.auto_wake ? "Automatic start is on. A visitor's re-plan wakes the server." :
        "Automatic start is off. Only Start live server wakes the server.";
      else { box.checked = !want; $("admin-msg").textContent = res.j.error || "Could not change automatic start."; }
    }).catch(function (e) { box.checked = !want; $("admin-msg").textContent = "Could not reach AWS: " + e.message; })
      .then(function () { box.disabled = false; delete box.dataset.busy; });
  });

  // Restart (Jordan, 2026-11-02): stop, wait until AWS reports the instance stopped, then start. The
  // control function has no restart of its own, so the page runs the two steps it already offers.
  function restart() {
    var btns = [$("admin-start"), $("admin-stop"), $("admin-restart")], tries = 0;
    function done(msg) { btns.forEach(function (b) { b.disabled = false; }); $("admin-msg").textContent = msg; refresh(); }
    btns.forEach(function (b) { b.disabled = true; });
    $("admin-msg").textContent = "Restarting: asking AWS to stop the server";
    post("/stop", { password: password }).then(function (res) {
      if (res.code === 403 && /password/.test(res.j.error || "")) { signOut("Please sign in again."); return; }
      if (res.code >= 300) { done(res.j.error || "Could not stop the server."); return; }
      (function wait() {
        fetch(control + "/status", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (st) {
          if (st.state !== "stopped") {
            if (++tries > 60) { done("The server did not stop within 5 minutes. Try Start live server later."); return; }
            $("admin-msg").textContent = "Restarting: waiting for the server to stop (" + st.state + ")";
            setTimeout(wait, 5000); return;
          }
          $("admin-msg").textContent = "Restarting: asking AWS to start the server";
          post("/start", { password: password }).then(function (r2) {
            done(r2.code < 300 ? "Restarted. It takes under a minute to come up." : (r2.j.error || "Could not start the server."));
          }).catch(function (e) { done("Could not reach AWS: " + e.message); });
        }).catch(function () { setTimeout(wait, 5000); });
      })();
    }).catch(function (e) { done("Could not reach AWS: " + e.message); });
  }
  $("admin-restart").addEventListener("click", restart);
  $("admin-stop").addEventListener("click", function () { send("stop"); });
})();
