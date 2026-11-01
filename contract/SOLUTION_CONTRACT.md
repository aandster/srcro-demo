# solution.json contract (schema v1)

This document is the plain-prose companion to `schemas/solution_v1.json`
(JSON Schema, draft 2020-12). It exists so the Seeing Reuse AI Vision team
can read `results/<tag>/solution.json` without reading Python. `run.py`
validates every file it writes against the schema before the run is
considered successful (FR-13, NFR-04); a run that would produce a
non-conformant file fails loudly instead.

`config` and `manifest` are provenance: what was run and how to reproduce it.
`kpis` is the headline summary. `daily`, `collected`, `arrivals`, `flagged`,
`rejected` and `day_routes` are the operational data: what happened, and, for
`day_routes`, the actual routes a vehicle would drive.

**Coordinate order warning.** `depot`, `arrivals[]`, `collected[]` and
`day_routes.*.points[]` all give locations as `[lat, lon]`. Route step
`location` fields (inside `day_routes.*.routes[].route.steps[]`) give
`[lon, lat]` instead, because that is the array order VROOM returns. This is
not a bug to "fix" in a future version; it is documented here so integrators
don't get it backwards.

**Units.** All distances are metres, all durations are seconds, unless a
field says otherwise (`total_distance_km` and `distance_km_per_request` in
`kpis` are the two exceptions, named accordingly). All distance/duration
values are integers, never floats -- VROOM itself rejects float matrix
values, and this project keeps that constraint end to end for consistency.

## Top level

| Key | Type | Meaning |
|---|---|---|
| `schema_version` | integer, optional | Contract version. Currently written as `1`. Absent on evidence archived before this schema existed; a reader should treat a missing `schema_version` as `1`. |
| `tag` | string | Run identifier: `<config name>_<git short sha>_<config sha8>[_seed<N>]`. Matches the `results/<tag>/` directory this file lives in. |
| `manifest` | object, optional | Reproducibility metadata. See below. Optional because it was added after some archived evidence was produced. |
| `config` | object | The resolved run config (the YAML file, loaded), echoed verbatim. |
| `kpis` | object | Headline metrics computed over the measured portion of the run. See below. |
| `daily` | array of objects | One entry per simulated day (both warmup and measured days), in day order. |
| `collected` | array of objects | One entry per request actually collected during the run. |
| `depot` | `[lat, lon]` | The single depot location every route starts and ends at. |
| `arrivals` | array of objects | One entry per request that arrived during the horizon, whether or not it was ever collected. |
| `flagged` | array of objects, optional | Every request flagged for manual handling over the whole run (FR-04). See "Flagged and rejected requests" below. |
| `rejected` | array of objects, optional | Every submitted record rejected at intake (FR-04). See "Flagged and rejected requests" below. |
| `day_routes` | object | Route plans, keyed by day index as a string (`"0"`, `"1"`, ...). |

## `manifest`

Everything needed to reproduce or audit a run without re-reading git log
(NFR-02, FR-12 / ST-05).

| Key | Type | Meaning |
|---|---|---|
| `commit` | string | Short git SHA of the commit the run was executed at, or `"uncommitted"`. |
| `config_hash` | string | First 8 hex chars of the SHA-256 of the config file's bytes. |
| `deps_lock_hash` | string or null | First 8 hex chars of the SHA-256 of `requirements.lock`, or `null` if that file was absent. |
| `osrm_image` | string or null | The OSRM image reference from `docker-compose.yml`, or `null` if the compose file was absent. |
| `vroom_image` | string or null | The VROOM image reference from `docker-compose.yml`, or `null` if the compose file was absent. |
| `seed_used` | integer, optional | The seed actually used for this run's arrivals, after any `--seed` CLI override is applied. |
| `python_version` | string, optional | The interpreter version that ran the pipeline. |
| `dependencies` | object, optional | `requirements.lock` parsed into `{package_name: pinned_version}`. |
| `osrm_extract` | object, optional | `{"path": ..., "sha256": ...}` for the OSRM extract file the run was built against. `sha256` is the literal string `"missing"` if no extract file was found, rather than failing the run. |
| `config_path` | string, optional | Path to the config file passed on the command line. |
| `cmem_gradient` | object, optional | Only on an emissions-objective run with `emissions.model: cmem_gradient` (backlog B18, task 034). `{"cmem_config_sha256", "elevation_table_sha256", "osrm_probe_sha256"}`, the sha256 of `configs/cmem.yaml`, of `data/elevation/node_elevations.csv.gz` and of one fixed OSRM `/route` response. That arm's costs depend on them and none is in the config hash (NFR-02). Every other run's `solution.json` is unchanged. |

The five new optional keys (`seed_used` onward) were added alongside this
schema. They are optional in the schema, not just in practice, because some
archived evidence has a `manifest` with only the original five keys.

## `kpis`

Fixed-name keys, plus one pattern-named key:

- `pct_within_<N>_bdays` (number): the percentage of collected requests aged
  at or under `N` business days at collection, where `N` is the config's
  `service.report_target`. The key name itself carries the target, so it is
  matched by pattern (`pct_within_[0-9]+_bdays`) rather than a fixed name.

Fixed keys: `requests_served` (integer), `mean_age_bdays`, `median_age_bdays`,
`p90_age_bdays`, `max_age_bdays` (age at collection, business days),
`steady_state_backlog` (integer, backlog size at the end of the measured
window), `backlog_trend_per_day` (backlog change per day, can be negative),
`expected_wait_observed_bdays` (mean age over the most recent measured
collections), `expected_wait_queueing_bdays` (number or null; a
queueing-theory estimate, null when the recent collection rate is zero),
`distance_km_per_request`, `total_distance_km` (the two exceptions to the
metres/seconds rule above), `objective_cost_per_request` (VROOM objective
units, not a physical unit), `vehicle_days_used`, `vehicle_days_available`
(integers), `fleet_utilisation_pct`, `mean_solver_ms`.

Measured-emissions keys (PR #4): `total_emissions_kg_co2e` (kg CO2e over the
measured window), `emissions_kg_co2e_per_request`, `emissions_g_co2e_per_km`
and `distance_km_by_type` (object of vehicle type to km). They are computed
from routed distance per vehicle type times `config.emissions.factors_g_per_km`
whatever `solver.objective` was, so distance-objective and emissions-objective
runs are compared on the same metric. The current `kpi.py` always writes them.
They are optional in the schema only because some archived evidence predates
them.

Vehicle types. The keys of `distance_km_by_type` (and of `daily[].dist_m_by_type`)
are the `type` values from `config.fleet`. The schema does not enumerate them,
so a new type needs no schema change. The current configs use
`rear_loader_diesel` and `rear_loader_ev` (see `docs/FLEET.md`). Evidence from
before task 002 uses `rigid_8t` and `tipper_3t`. Only types that drove appear.
A `config.fleet` entry may also carry `max_distance_km`, the battery-electric
per-day range cap passed to VROOM.

## `daily[]`

One entry per simulated day.

| Field | Type | Meaning |
|---|---|---|
| `day` | integer | Zero-based day index within the simulation. |
| `backlog_end` | integer | Requests still uncollected at the end of this day. |
| `collected` | integer | Requests collected on this day. |
| `distance_m` | integer | Total distance driven this day, metres. |
| `cost` | integer | Total VROOM objective cost this day. |
| `vehicles_used` | integer | Vehicles that ran a route this day. In a multi-trip run it counts each truck once, however many trips it made (see "Multiple trips per day" below). |
| `solver_ms` | integer | Wall-clock time VROOM took to solve this day, milliseconds. |
| `measured` | boolean | False for warmup days, true for days counted in `kpis`. |
| `arrivals` | integer | Requests that arrived on this day. |
| `collected_free` / `collected_ramp` / `collected_escalated` | integer | Requests collected this day, split by priority tier at collection time. |
| `collected_ages` | array of integer | Age in business days of each request collected this day. |
| `backlog_ages` | array of integer | Age in business days of every request still in backlog at day end. |
| `planned_later` | integer | Requests seen by the solver but scheduled for a later day. |
| `unassigned` | integer | Requests VROOM could not fit into any route this day. Since task 022 this includes requests whose advised day is after the planning horizon, which may not be planned yet (FR-06, see below). |
| `suppressed_routes` | integer | Routes dropped by the min-dispatch guard (too few stops to justify a vehicle-day). |
| `dist_m_by_type` | object, optional | Executed routed distance this day per vehicle type, metres (integer values). Empty on days with no backlog. Written by the current `simulate.py` and optional only for older evidence. |
| `trips` | integer, optional | Routes run this day, each one trip. Written only in multi-trip runs (see "Multiple trips per day" below). |

## Flagged and rejected requests (FR-04)

Every record submitted to the pipeline ends in this file with exactly one outcome, so a platform can tell each customer what happened to their request (backlog B12, decided 2026-09-30, `docs/DECISIONS.md`). The outcome is one of these.

| Outcome | Where it appears |
|---|---|
| Collected | `arrivals[]` and `collected[]` |
| Outstanding at the end of the run | `arrivals[]` and the last day's `day_routes` `backlog_ids` |
| Flagged for manual handling | `arrivals[]` and `flagged[]` (also `daily[].flagged`) |
| Rejected at intake | `rejected[]` only |

A flagged request is lodged but should not be collected automatically, so it is held for manual handling, never dropped. It appears in `arrivals[]`, never in `collected[]`, `day_routes` or any `backlog_ids`. A rejected record cannot be placed or served at all, so it is not lodged and appears in `rejected[]` and nowhere else.

- `flagged` (top level, array, optional) lists every request flagged over the whole run, warmup included, in intake order, each as `{"id": integer, "day": integer, "reason": string}`. `day` is the request's `arrival_day`.
- `daily[].flagged` (array, optional) lists the same entries by the day they were flagged. The top-level list is their concatenation over days. Both are kept. The top-level list is what a platform reads, and the per-day list is what the per-day conservation balance uses. The duplication is small, since flagged requests are rare, and `scripts/check_run.py` fails a file whose two views disagree.
- A flagged `reason` is `OUTSIDE_LGA` (location not inside the Newcastle LGA) or `VOLUME_OVER_CAP` (volume above `config.demand.volume_m3_cap`). If both apply, `OUTSIDE_LGA` is given.
- `rejected` (top level, array, optional) lists every record rejected at intake, in intake order, each as `{"id": integer, "day": integer or null, "reason": string}`. `day` is the business-day index the record was submitted on (its `arrival_day`), and is null when the record had no timestamp.
- A rejected `reason` is `MISSING_COORDINATES` (latitude or longitude absent, non-numeric or NaN), `MISSING_TIMESTAMP` (no lodgement time) or `VOLUME_NON_POSITIVE` (volume absent, non-numeric, 0 or less). Checks run in that order and the first failure wins, so `MISSING_TIMESTAMP` always has `day` null, `VOLUME_NON_POSITIVE` always has a day, and `MISSING_COORDINATES` has a day only if the record carried a timestamp. The schema enforces the first two.
- `kpis.flagged` (integer, optional) is the total flagged over the whole horizon, warmup included. There is no rejected count in `kpis`, since `len(rejected)` gives it.
- `daily[].arrivals` counts flagged requests as well as routable ones, but not rejected records, which are not lodged.
- Conservation holds on every day d. Requests in `arrivals[]` with `arrival_day <= d` equal requests in `collected[]` with `collected_day <= d`, plus `daily[d].backlog_end`, plus flagged entries with `day <= d`. Rejected records are outside this balance because they never enter `arrivals[]`. `scripts/check_run.py` also follows every submitted id (`arrivals[]` plus `rejected[]`) to exactly one outcome, rejected records included.
- Records are identified by their integer `id`, as everywhere else in this file. The pipeline assumes every submitted record carries one (the AI Vision record id).
- All four fields are optional so files written before FR-04, or before task 025 added the two top-level lists, still validate. A reader of an older file takes the flagged list from `daily[].flagged` and has no record of rejected ones.

## Expected collection dates (FR-06)

When a request cannot be collected within `config.service.report_target` business days of lodgement, the run reports when it is expected to be collected. A request's cap day is `arrival_day + report_target`. Day numbers are business-day indices, as elsewhere in this file.

- `daily[].expected` (array, optional) is written after each day's re-plan. It lists every outstanding request that is planned on a day after its cap day or is left unassigned, each as `{"id": integer, "cap_day": integer, "expected_day": integer, "expected_date": "YYYY-MM-DD"}`. `expected_date` is present only when `config.horizon.calendar_start` is set. A request is late when `expected_day > cap_day`. An unassigned request can appear with an expected day that is not late.
- Rule for `expected_day`. A planned request gets its planned day from the solver. Unassigned requests (including those on a day-one route held back by `min_dispatch_stops`) are placed oldest first on the first day after the latest planned day whose planned volume plus the request's volume fits the whole fleet's capacity. A request whose advised day is later than that day starts the search at its advised day instead, because it may not be collected earlier (task 022). The rule checks volume only, not shift time. An expected day after Friday falls on the following Monday because weekends are not business days. `expected_day` is a business-day index, not a time within the shift, so two requests due on the same day are reported identically regardless of what time on that day either is actually collected. This is the intended granularity (backlog B13, closed 2026-09-30). The council tells a customer a collection day, not a time, and collects on that day, so a time within the shift would be a promise the service does not make.
- `collected[].advised_day` (integer, optional) and `collected[].advised_date` (string, optional) are the request's original advised day, the date the customer is given and the one its collection is judged against. It is the expected day from the first re-plan after lodgement, the re-plan on `arrival_day`. If that re-plan put the request on a later route it is the planned day, otherwise (unassigned, or on a held-back day-one route) it is the `expected_day` placement above. A job's window opens the business day after lodgement, so that re-plan never collects the request itself and every collected record carries `advised_day`. It is not the first late day. A request first planned inside its cap day that later slips keeps the on-time day it was first given. Rule decided by Jordan on 2026-09-30 (`docs/DECISIONS.md`, "FR-06 collection judged against the original advised date").
- Since task 022 the advised day is also a routing rule (Jordan, 2026-09-30, "collection never before the advised day, with a separate late penalty", backlog B27). The simulation keeps each request's advised day from its first re-plan, and at every later re-plan the request's time window opens at the start of its advised day, so neither the VROOM arms nor the nearest neighbour arm can collect it earlier. The independent feasibility checker reports an `EARLY` violation otherwise, which aborts the run (FR-07). A request may be collected any business day after its advised day. The hard cap (`config.service.hard_cap_bdays`) still bounds the window unless the advised day is after the cap day, in which case the advised day is the lower bound and the window runs to the horizon end. An advised day after the planning horizon leaves the request unassigned in that re-plan.
- `config.solver.late_penalty_per_bday` (number, optional in the echoed config) is the solver's price for each business day a request would be collected after its advised day, in objective units like `deferral_penalty`. It is separate from, and larger than, the age-weighted deferral cost, which stays as the cost of waiting. It is part of the `costs` matrix only and never reaches `daily[].cost` of an executed route, because offset 0 is never bumped. Configs from before task 022 do not have it, and a missing key means 0.
- `collected[].late_expected_day` (integer, optional) and `collected[].late_expected_date` (string, optional) are the first late expected day reported for that request. Absent if it was never reported late. Their presence marks the request as late.
- `kpis.late_count` (integer, optional) counts measured collected requests that carry `late_expected_day`, so a request counts as late if it was reported late at least once.
- `kpis.late_within_1_bday_pct` (number or null, optional) is the percentage of those collected on their `advised_day` or at most one business day after it. It is the ST-02 test measure, worded by the submitted Testing and Evaluation Plan as "within one business day of expected date", and it is not the on-time definition. Collection before the advised day is a miss, because the customer only puts items out the day before it. It is null (not applicable) when `late_count` is 0, because a percentage of no late requests has no value (backlog B31, Jordan, 2026-10-01, task 026). A campaign's `runs.csv` holds an empty cell there. Files written before task 026 hold 0.0 in that case, which a reader must read as not applicable whenever `late_count` is 0. `scripts/recompute_advised_kpis.py` re-scores them to null.
- `kpis.advised_on_time_pct` (number, optional) is the on-time measure. It is the percentage of every measured collected request, late or not, collected on its `advised_day` itself. There is no grace day (Jordan, 2026-09-30, task 023), matching the late penalty, which starts on the first business day after the advised day. Runs written before task 023 counted the day after the advised day as on time. `scripts/recompute_advised_kpis.py` re-scores such runs from their `collected` records (`docs/CAMPAIGN.md`). It is 0.0 when no measured record carries `advised_day`.
- `kpis.early_count` (integer, optional) counts measured collected requests, late or not, collected before their `advised_day`. Since task 022 it is 0 by construction, because the advised day is the lower bound of the request's time window and the feasibility checker aborts a run that collects early. Before task 022 the planner moved a request forward when a re-plan opened a slot, so archived evidence can show a positive count.
- Evidence archived before 2026-09-30 has no `advised_*` fields, `advised_on_time_pct` or `early_count`, and its `late_within_1_bday_pct` counts collections within one business day either side of the first late expected day, the rule before this date. `kpi.extract` falls back to `late_expected_day` for a late record without `advised_day`.
- All nine fields in this section are optional so files written before FR-06, or before the advised-date rule, still validate.
- Expected and advised days are business-day indices by design, not times within the shift (backlog B13, closed 2026-09-30). In Jordan's words, "in real life the council gives you a day and they will come on the day that they say".

## `collected[]`

One entry per request actually collected, across the whole run.

| Field | Type | Meaning |
|---|---|---|
| `id` | integer | Request id. |
| `arrival_day` | integer | Day the request arrived. |
| `lat`, `lon` | number | Original request location. |
| `volume_m3` | number | Request volume, cubic metres. |
| `service` | integer | Service time at this stop, seconds. |
| `slat`, `slon` | number | OSRM-snapped location actually routed to (may differ slightly from `lat`/`lon`). |
| `collected_day` | integer | Day the request was collected. |
| `age_bdays` | integer | `collected_day` minus `arrival_day` in business days. |

## `depot`

`[lat, lon]`. The single depot every route starts and ends at
(`-32.88856, 151.65254` per `CLAUDE.md`).

## `arrivals[]`

One entry per request that arrived during the horizon, whether or not
collected.

| Field | Type | Meaning |
|---|---|---|
| `id` | integer | Request id, matches `collected[].id` if the request was collected. |
| `lat`, `lon` | number | Original request location. |
| `arrival_day` | integer | Day the request arrived. |
| `volume_m3` | number | Request volume, cubic metres. |

## `day_routes`

An object keyed by day index as a string (`"0"`, `"1"`, ...), one entry per
day the pipeline actually executed a plan for.

Each entry has:

| Field | Type | Meaning |
|---|---|---|
| `routes` | array | The routes run that day. See below. |
| `points` | array of `[lat, lon]` | Every stop location considered that day (depot plus jobs), in the same `[lat, lon]` order as `depot`/`arrivals` (**not** the `[lon, lat]` order used inside `routes[].route.steps[].location`). |
| `backlog_ids` | array of integer | Request ids still in backlog after this day's plan. |
| `collected_ids` | array of integer | Request ids collected by this day's plan. |

### `routes[]`

Each entry is `{"fleet_id": <integer>, "route": {...}}`, where `fleet_id` is
the vehicle's id from the config's `fleet` list, and `route` is VROOM's own
route object for that vehicle, passed through with its native field names.
A multi-trip run adds `"trip": <integer>` to each entry (see "Multiple trips
per day" below).

| Field | Type | Meaning |
|---|---|---|
| `vehicle` | integer | VROOM's internal vehicle index (matches `fleet_id` in this pipeline). |
| `cost` | integer | VROOM objective cost for this route. |
| `delivery`, `amount`, `pickup` | array of integer | Per-capacity-dimension totals. This pipeline uses one dimension, volume in litres (`volume_m3 * 1000`, rounded to an integer because VROOM needs integral amounts), so an 11 m3 body is 11000. Jobs are VROOM deliveries, so `pickup` is always `[0]`. |
| `setup` | integer | Total setup time, seconds. |
| `service` | integer | Total service time, seconds. |
| `duration` | integer | Total route duration, seconds, from depot departure to depot return. |
| `waiting_time` | integer | Total waiting time, seconds (always 0 in this pipeline; no per-stop time windows). |
| `priority` | integer | Sum of the priority weights of jobs on this route (see `ageing.py`). |
| `distance` | integer | Total route distance, metres. |
| `violations` | array | VROOM constraint violations for this route; empty in every observed run. |
| `steps` | array | The ordered stops of this route. See below. |

### `route.steps[]`, in visiting order

Every step has `type` (`"start"`, `"job"` or `"end"`), `location` as
`[lon, lat]` (**reversed** from `depot`/`points`, see the warning above),
`location_index` (index into the day's OSRM matrix), `setup`, `service`,
`waiting_time` (seconds), `load` (litres still on board per dimension after
this stop, starting at the route's `delivery` total and falling to 0 at the
`"end"` step), `arrival` (model seconds from midnight of simulation day 0, so a
step on day d is d x 86400 plus the time of day), `duration` and `distance`
(cumulative for the route so far, seconds / metres), and `violations`.

A `"job"` step additionally has `id` and `job` (both equal to the collected
request's id -- `id` is this pipeline's field, `job` is VROOM's own). A route
always starts with exactly one `"start"` step and ends with exactly one
`"end"` step, both at the depot; every step in between is a `"job"` step, in
the order the vehicle actually visits them.

## Multiple trips per day (backlog B28, task 029)

A truck may empty its body at the depot and go out again on the same day when
`config.horizon.max_trips_per_day` is above 1. The key is absent from every
config written before task 029, and absent means 1, one trip per truck per day,
in which case none of the fields below is written and the file is exactly what
earlier versions wrote. The schema stays at version 1 because every field below
is optional.

- `config.horizon.max_trips_per_day` (integer) is the most trips a truck may
  make in a day, and `config.horizon.depot_turnaround_s` (integer, seconds) the
  time at the depot between one trip's return and the next trip's departure
  (driving into the yard, unloading, leaving).
- Each `day_routes.*.routes[]` entry is one trip, and carries `trip`, its
  number for that truck on that day, from 1. A truck can appear up to
  `max_trips_per_day` times on a day. Every trip starts and ends at the depot,
  has its own `"start"` and `"end"` steps, and carries at most one body of
  volume. A later trip departs at least `depot_turnaround_s` after the
  previous one returned. Order a truck's trips by `trip` or by the `arrival`
  of their `"start"` steps.
- `daily[].trips` is the number of trips run that day. `daily[].vehicles_used`
  counts distinct trucks, so it is never more than the fleet size.
- `kpis.trips_used` is the trips run over the measured window and
  `kpis.trips_per_vehicle_day` is `trips_used` over `vehicle_days_used`.
  `vehicle_days_used` counts truck-days, so `fleet_utilisation_pct` stays at
  or below 100.
- A reader that ignores `trip` still gets routes that can each be driven as
  given. A reader that assumed one route per `fleet_id` per day must group a
  day's routes by `fleet_id`.
- A battery-electric truck's `max_distance_km` is its range for the whole day,
  over all its trips, because the battery is not recharged in the turnaround.

## Assumptions

- `manifest` and `schema_version` are optional at the top level because some
  archived evidence predates them. A reader should not assume their absence
  means anything about the run itself.
- The five original `manifest` keys (`commit`, `config_hash`,
  `deps_lock_hash`, `osrm_image`, `vroom_image`) are required whenever
  `manifest` is present; the five new keys added alongside this schema
  (`seed_used`, `python_version`, `dependencies`, `osrm_extract`,
  `config_path`) are optional in the schema for the same backward-compatibility
  reason, even though the current `run.py` always writes all ten.
- `pct_within_<N>_bdays` is matched by pattern, not a fixed key name, because
  `N` comes from `service.report_target` in the config and is not fixed by
  this contract.
- `distance_km_by_type` and the `emissions_*` KPI fields are written by the
  current `kpi.py` but are not required, since some archived evidence predates
  them.
