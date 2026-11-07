// Expo questions and answers (generated 2026-11-01 from the chat Q&A list).
// Figures come from docs/CLAIMS.md, docs/LIMITATIONS.md, docs/DEMO.md, CLAUDE.md and the printed poster.
// The source field names where. Edit answers here, not in the page script.
window.SRCRO_QA = [
 {
  "id": "q001",
  "category": "Project and scope",
  "q": "What is the project in one sentence?",
  "a": "A planner for on-demand kerbside reuse collection in Newcastle that decides which day and which truck collects each request and routes the trucks to cut CO2-e, compared with distance-only planning on exactly the same requests and fleet.",
  "source": "Poster"
 },
 {
  "id": "q002",
  "category": "Project and scope",
  "q": "Who is the project for and who supervises it?",
  "a": "It is an Honours capstone (SENG4001) developed with the Heavy Matters sustainability initiative and the City of Newcastle. Supervisors are Dr Kyle Harrison, Masha Kondrasheva and Marcella Papini. The routing planner is one part of the wider Seeing Reuse platform, beside a companion AI Vision project run by another team.",
  "source": "Poster, project overview"
 },
 {
  "id": "q003",
  "category": "Project and scope",
  "q": "What does the planner decide every business day?",
  "a": "Which waiting requests to collect, on which day, on which truck and in what order. It re-plans the next 7 business days every day and only carries out the first day, then re-plans again the next morning with the new requests.",
  "source": "Poster, CLAUDE.md"
 },
 {
  "id": "q004",
  "category": "Project and scope",
  "q": "Why would planning for emissions give different routes from planning for distance?",
  "a": "Distance-only planning treats every kilometre alike. An electric kilometre emits nothing at the tailpipe, and a loaded uphill diesel kilometre burns more fuel than an empty downhill one. So the emissions-aware plan gives the longest work to the electric trucks and prices hills and load on the diesel ones.",
  "source": "Poster, The problem"
 },
 {
  "id": "q005",
  "category": "Project and scope",
  "q": "What does the project not cover?",
  "a": "Collection routing only. It does not model whether items are reused, where they go afterwards, how items are identified or assessed (that is the AI Vision project), or council service rules. So no result says how much waste is diverted or what a council would save.",
  "source": "LIMITATIONS B65, poster Limits"
 },
 {
  "id": "q006",
  "category": "Project and scope",
  "q": "Is this running on the real Newcastle service?",
  "a": "No. All results come from a synthetic scenario on a frozen copy of Newcastle's road network. No real operational or historical data exists for the project, so no figure is a measurement of the real service.",
  "source": "CLAIMS How to Read It, LIMITATIONS B65"
 },
 {
  "id": "q007",
  "category": "Project and scope",
  "q": "What problem class is it, formally?",
  "a": "A rolling-horizon, multi-period, heterogeneous fixed fleet vehicle routing problem whose daily routes minimise load-dependent CMEM fuel at fixed network speeds, solved by a two-stage decomposition. The daily routing stage is the Pollution-Routing Problem of Bektas and Laporte (2011) with speeds fixed and no time windows.",
  "source": "Poster, Problem class"
 },
 {
  "id": "q008",
  "category": "Project and scope",
  "q": "What is the Pollution-Routing Problem?",
  "a": "A vehicle routing problem from Bektas and Laporte (2011) that minimises fuel, emissions and driver cost, where fuel depends on the load carried and the speed on each arc, and the planner also chooses the speed. Here speed is not a decision, so the daily stage is the Pollution-Routing Problem with fixed network speeds.",
  "source": "Poster, LIMITATIONS network speeds"
 },
 {
  "id": "q009",
  "category": "Project and scope",
  "q": "Is it a green vehicle routing problem?",
  "a": "In the broad sense, yes, because it has an emissions objective and electric trucks. It is not the green vehicle routing problem of Erdogan and Miller-Hooks (2012), which is defined by recharging and refuelling stops. This model has no recharging stops and no mid-day charging.",
  "source": "LIMITATIONS B65"
 },
 {
  "id": "q010",
  "category": "Project and scope",
  "q": "What is the output of the planner?",
  "a": "A solution.json file per run, which is the integration contract for any future platform. Every submitted request appears in it exactly once, as collected, outstanding, flagged or rejected at intake. The maps are presentation only.",
  "source": "CLAUDE.md, SOLUTION_CONTRACT"
 },
 {
  "id": "q011",
  "category": "Research questions",
  "q": "What are the three research questions?",
  "a": "RQ1, how can on-demand reuse collection be framed as a tractable green vehicle routing problem with load-dependent emissions and service deadlines. RQ2, which solver family gives the best emissions and cost trade-off at Newcastle scale. RQ3, how much CO2-e does emissions-aware planning save against distance-only planning across demand levels and fleet mixes.",
  "source": "Poster"
 },
 {
  "id": "q012",
  "category": "Research questions",
  "q": "What is the answer to RQ1?",
  "a": "As a two-stage decomposition. Stage 1 (VROOM) chooses the day and truck for each request every day with gradient-aware fuel at one fixed mass. Stage 2 (adaptive large neighbourhood search) re-routes each day for fuel that depends on the load on board. Each stage alone is fast enough to re-plan daily.",
  "source": "Poster, The planner"
 },
 {
  "id": "q013",
  "category": "Research questions",
  "q": "What is the answer to RQ2?",
  "a": "Every solver tried kept the direction of the saving, and none clearly beat VROOM. Each was run at one untuned setting, so this does not show VROOM is the best solver, only that nothing tried was a better choice.",
  "source": "Poster, RQ2, CLAIMS C10, C14, C16, C17, C20"
 },
 {
  "id": "q014",
  "category": "Research questions",
  "q": "What is the answer to RQ3?",
  "a": "With one and two electric trucks of four, emissions-aware planning cut tailpipe CO2-e per request by 28.35 and 55.78 percent (0.725 and 0.863 kg), 100 seeds. With four diesel trucks there was no saving. If electric trucks charge on the NSW grid the saving falls to 1.48 to 10.75 percent (30 seeds).",
  "source": "Poster, CLAIMS C1, C3, C4"
 },
 {
  "id": "q015",
  "category": "Research questions",
  "q": "What are EQ1 to EQ5?",
  "a": "The evaluation questions from the Testing and Evaluation Plan. EQ1, does it cut CO2-e. EQ2, at what cost. EQ3, is service within 7 working days. EQ4, is the result sensitive to inputs. EQ5, is it viable against naive planning.",
  "source": "Poster"
 },
 {
  "id": "q016",
  "category": "Scenario and data",
  "q": "How many requests a day, and how big are they?",
  "a": "The headline uses 25 requests a day, each up to 2 m3, the City of Newcastle cap per address (configurable). Other campaigns use 15, 50, 75 and 100 a day. Volumes were run at three bracketing levels with means of 0.875, 1.25 and 1.625 m3.",
  "source": "Poster, CLAIMS C5"
 },
 {
  "id": "q017",
  "category": "Scenario and data",
  "q": "Where do the request locations come from?",
  "a": "They are sampled from nodes of the road graph inside the City of Newcastle boundary (OpenStreetMap relation R6189831, about 215 km2 including the estuary), so every request sits on a drivable road. The base is uniform, and a clustered pattern was also tested.",
  "source": "CLAUDE.md, CLAIMS C9"
 },
 {
  "id": "q018",
  "category": "Scenario and data",
  "q": "Why synthetic data?",
  "a": "No real operational, request or historical data is available to the project, and none will be. The stakeholders are not council waste services. So demand levels are bracketing values, not estimates, and results are reported as comparisons between plans.",
  "source": "LIMITATIONS B65, project overview"
 },
 {
  "id": "q019",
  "category": "Scenario and data",
  "q": "What is a seed?",
  "a": "The random number seed that generates one scenario, meaning the request locations, volumes and arrivals. Both plans run on the same seed, so they see identical requests, and the comparison is paired by seed.",
  "source": "Poster, How it was tested"
 },
 {
  "id": "q020",
  "category": "Scenario and data",
  "q": "How long is one run?",
  "a": "30 business days. The first 10 are warm-up and the last 20 are measured.",
  "source": "Poster"
 },
 {
  "id": "q021",
  "category": "Scenario and data",
  "q": "Why a warm-up period?",
  "a": "Each run starts with no backlog. The first 10 days let the backlog of waiting requests build to a steady level, so the 20 measured days reflect normal operation rather than a start-up with an empty queue.",
  "source": "Poster, How it was tested"
 },
 {
  "id": "q022",
  "category": "Scenario and data",
  "q": "Where is the depot, and what are the working hours?",
  "a": "One depot at -32.88856, 151.65254. Weekdays only, trucks leave at 05:00 and must be back by 15:00. There are no time windows at individual addresses.",
  "source": "CLAUDE.md"
 },
 {
  "id": "q023",
  "category": "Scenario and data",
  "q": "What is the advised day?",
  "a": "The collection day the resident is told when the request is first planned. A request is never collected before it. Each business day after it adds a late penalty of 2000 on top of the waiting cost, and a collection counts as on time only on the advised day.",
  "source": "CLAUDE.md, poster step 5"
 },
 {
  "id": "q024",
  "category": "Scenario and data",
  "q": "Is 7 business days a hard deadline?",
  "a": "No, it is a soft target and no request is ever refused. The planner pays an age-weighted waiting cost from day 0, plus the late penalty after the advised day, so it collects as soon as practical.",
  "source": "CLAUDE.md, technical decisions"
 },
 {
  "id": "q025",
  "category": "Scenario and data",
  "q": "Were random daily arrivals and clustered locations tested?",
  "a": "Yes. The saving held with clustered locations and with Poisson daily counts in 8 of 8 mixed-fleet cells. Clustering cut the distance-only plan's km per request by 21 to 24 percent. One sub-hypothesis failed, Poisson arrivals did not lower on-time collection by 1 point.",
  "source": "CLAIMS C9"
 },
 {
  "id": "q026",
  "category": "Road network and elevation",
  "q": "What is OSRM and what is it used for?",
  "a": "The Open Source Routing Machine. It computes road travel times and distances between every pair of stops on OpenStreetMap roads of Newcastle. It runs with Contraction Hierarchies, because only that mode returns distances from its table service.",
  "source": "Poster, CLAUDE.md"
 },
 {
  "id": "q027",
  "category": "Road network and elevation",
  "q": "Does the road network know it is a truck?",
  "a": "Yes. OSRM uses a truck profile that only routes on roads a rigid truck can physically and legally use, honouring height, width, length, weight and heavy-vehicle access tags, with lower speeds than the car profile.",
  "source": "SETUP 5.0"
 },
 {
  "id": "q028",
  "category": "Road network and elevation",
  "q": "Where do the road speeds come from? Are they speed limits?",
  "a": "They are the truck profile's free-flow speeds by road class, derived from OpenStreetMap road type and posted limits. Each road has one speed for the whole shift, so congestion, peak periods and signal delay are not modelled.",
  "source": "LIMITATIONS network speeds"
 },
 {
  "id": "q029",
  "category": "Road network and elevation",
  "q": "What does 'fixed network speeds' mean?",
  "a": "Speed is not a decision variable. In the full Pollution-Routing Problem the planner chooses how fast to drive each road. Here every road has a fixed speed, because an urban collection truck's speed is set by traffic and limits, not by a planner.",
  "source": "Poster, LIMITATIONS network speeds"
 },
 {
  "id": "q030",
  "category": "Road network and elevation",
  "q": "Where does elevation come from?",
  "a": "The NSW Spatial Services 1 m LiDAR digital elevation model, 171 tiles from three Newcastle surveys (2012 to 2014), averaged to 5 m cells. Heights at road nodes give the grade of each road segment for the fuel model.",
  "source": "Poster, changelog B22"
 },
 {
  "id": "q031",
  "category": "Road network and elevation",
  "q": "Why average the 1 m survey to 5 m?",
  "a": "A 5 m cell is the mean of the 25 one-metre cells under it, so a road node a few metres off the true centreline does not take its height from a kerb or a cutting batter. It also keeps memory near 250 MB instead of 5.5 GB.",
  "source": "changelog 2026-09-30 B22"
 },
 {
  "id": "q032",
  "category": "Road network and elevation",
  "q": "Why is the road graph frozen?",
  "a": "Requests are sampled from the graph's nodes in order, so a graph rebuilt on another date would change every seeded scenario. The graph is committed with a checksum and the code refuses to run on a changed file, which keeps every result reproducible.",
  "source": "CLAUDE.md, Geospatial"
 },
 {
  "id": "q033",
  "category": "How the planner works",
  "q": "What does stage 1 do?",
  "a": "VROOM (Vehicle Routing Open-source Optimization Machine) re-plans the next 7 business days every day and decides which day and which truck takes each request. Its arc cost is gradient-aware fuel from the CMEM model at one fixed truck mass, with electric arcs near zero.",
  "source": "Poster step 3"
 },
 {
  "id": "q034",
  "category": "How the planner works",
  "q": "What does stage 2 do?",
  "a": "Adaptive large neighbourhood search re-routes each executed day's own jobs on that day's own trucks, minimising fuel that depends on the real load on board. It cannot move a request to another day.",
  "source": "Poster step 4, CLAUDE.md Scope"
 },
 {
  "id": "q035",
  "category": "How the planner works",
  "q": "Why two stages instead of one solver?",
  "a": "VROOM takes a fixed cost per road, so it cannot price a road differently depending on how full the truck is at that point in the route. Load-dependent cost needs a search that evaluates whole routes, which stage 2 does within each day.",
  "source": "CLAUDE.md Scope, technical decisions"
 },
 {
  "id": "q036",
  "category": "How the planner works",
  "q": "Why is stage 2 only used for the three-trip figures on the poster?",
  "a": "The headline campaign ran before stage 2 was adopted on 18 October, and its 100-seed replication was pre-registered as an exact rerun of that campaign with stage 2 off, so seeds 1 to 30 could be checked against the original. Running stage 2 on both plans for the same 100 seeds gives -29.28 and -56.43 percent against stage 1's -28.35 and -55.78, about one point different.",
  "source": "Poster Reading the figures, CLAIMS X7"
 },
 {
  "id": "q037",
  "category": "How the planner works",
  "q": "What fixed mass does stage 1 use?",
  "a": "9,080 kg for every arc. That is why stage 1 sees hills but not the load, and stage 2 adds the real load within each day.",
  "source": "CLAIMS C4, C15"
 },
 {
  "id": "q038",
  "category": "How the planner works",
  "q": "Why do electric arcs cost 1 g per km in the solver and not 0?",
  "a": "At 0 the solver would be indifferent to how far an electric truck drives. A 1 g per km floor makes it still prefer shorter electric routes. 5 g per km was tested and made no difference. Reported CO2-e still counts electric trucks at 0.",
  "source": "CLAUDE.md VROOM"
 },
 {
  "id": "q039",
  "category": "How the planner works",
  "q": "Why put emissions in VROOM's cost matrix and not in travel times?",
  "a": "Travel times must stay physically accurate so the 15:00 shift end is checked correctly. Emissions go in a separate cost matrix, so the solver minimises emissions while times stay real.",
  "source": "CLAUDE.md VROOM"
 },
 {
  "id": "q040",
  "category": "How the planner works",
  "q": "Why VROOM?",
  "a": "It is open source, accepts custom cost matrices, per-truck capacity and per-truck range, and re-plans a day in a median 0.57 to 0.87 s. On the CVRPLIB benchmark it averaged 0.22 percent from the best known solutions on set A. No solver tried in the comparison clearly beat it.",
  "source": "CLAIMS EQ5 timing, C7, C10"
 },
 {
  "id": "q041",
  "category": "How the planner works",
  "q": "How do you know the plans are feasible?",
  "a": "An independent feasibility oracle re-derives capacity, shift end, weekdays, depot and electric range from each route's steps rather than trusting the solver. A conservation check confirms every request has exactly one outcome.",
  "source": "CLAUDE.md Layout"
 },
 {
  "id": "q042",
  "category": "How the planner works",
  "q": "Did you try making day choice load-aware too?",
  "a": "Yes. A load-aware day swap was built and tried. It moved 31 requests in 180,000 candidates, so the reported model keeps day choice at the fixed mass and states that as a limitation.",
  "source": "CLAIMS C13"
 },
 {
  "id": "q043",
  "category": "How the planner works",
  "q": "What happens on a 'check, then execute' step?",
  "a": "Before a day runs, the plan is checked against capacity 11 m3, shift 05:00 to 15:00, the 110 km electric planning distance, and never collecting before the advised day.",
  "source": "Poster step 5"
 },
 {
  "id": "q200",
  "category": "How the planner works",
  "q": "How is the system built?",
  "a": "A Python planning pipeline reads data kept in the repository (the road network, council boundary and elevations) and calls two routing services in containers, OSRM for road distances and VROOM as the default solver. Later campaigns ran on Amazon Web Services spot instances in Hyderabad (the early ones on the laptop), and the expo site runs from Amazon S3 and CloudFront with the live plan behind an HTTP API. The Architecture page draws it with the C4 model in UML notation: the system context, the containers, the planning pipeline's components and a sequence diagram of one planning day.",
  "source": "docs/DEMO.md, docker-compose.yml, Architecture page"
 },
 {
  "id": "q044",
  "category": "Emissions models",
  "q": "What is tier-1 CO2-e?",
  "a": "Kilometres times a per-vehicle factor, 1000 g per km for diesel and 0 for electric. It is simple, transparent and independent of the fuel model, and it is the primary reported figure.",
  "source": "Poster Reading the figures"
 },
 {
  "id": "q045",
  "category": "Emissions models",
  "q": "Is there a tier 2?",
  "a": "Not as a label on the poster. The second model is CMEM (Barth et al. 2005), a physics-based fuel model using speed, grade and mass. Short version: tier-1 is the accounting number, CMEM is the engineering number.",
  "source": "Poster, CLAUDE.md"
 },
 {
  "id": "q046",
  "category": "Emissions models",
  "q": "What is CMEM?",
  "a": "The Comprehensive Modal Emissions Model of Barth et al. (2005). It estimates fuel from vehicle power demand, which depends on speed, road grade and mass. Fuel converts to CO2-e at 2.716 kg per litre (NGA Factors 2026).",
  "source": "Poster, CLAUDE.md"
 },
 {
  "id": "q047",
  "category": "Emissions models",
  "q": "What does 'within-model' mean?",
  "a": "The planner optimises the same CMEM model that scores the result, so a CMEM saving is partly guaranteed by construction and is not an independent check. That is why km and tier-1 CO2-e are always reported beside it.",
  "source": "CLAIMS How to Read It, C6"
 },
 {
  "id": "q048",
  "category": "Emissions models",
  "q": "Where does 1000 g per km for diesel come from?",
  "a": "It is a provisional, unsourced assumption for this truck and duty. Australian all-use rigid trucks average about 777 g per km and refuse collection studies give 2,089 to 3,423 g per km. At the refuse study factors the saving stayed within 2 percentage points.",
  "source": "CLAIMS C8"
 },
 {
  "id": "q049",
  "category": "Emissions models",
  "q": "Why count electric trucks at 0 g per km?",
  "a": "Figures are tank to wheel, meaning tailpipe only, and the project assumes renewable charging in line with the City of Newcastle Climate Action Plan. The NSW grid case is tested separately and shown beside the headline.",
  "source": "Poster, CLAIMS C3, LIMITATIONS B33"
 },
 {
  "id": "q050",
  "category": "Emissions models",
  "q": "What happens if electric trucks charge on the NSW grid?",
  "a": "At 600 to 780 g per km the saving falls to 1.48 to 10.75 percent per request (0.052 to 0.313 kg), still significant in all six cases, 30 seeds.",
  "source": "Poster, CLAIMS C3"
 },
 {
  "id": "q051",
  "category": "Emissions models",
  "q": "What is the difference between tank to wheel and well to wheel?",
  "a": "Tank to wheel counts the tailpipe only. Well to wheel adds the emissions of producing and delivering the diesel, 0.668 kg CO2-e per litre (NGA Factors 2026), which raises every kilogram by 24.6 percent and leaves every percentage unchanged. In the grid cases well to wheel gives 1.92 to 12.78 percent.",
  "source": "Poster, CLAIMS Well to Wheel"
 },
 {
  "id": "q052",
  "category": "Emissions models",
  "q": "Is battery manufacture included?",
  "a": "No. It is outside both the tank to wheel and well to wheel boundaries.",
  "source": "Poster Limits, CLAIMS"
 },
 {
  "id": "q053",
  "category": "Emissions models",
  "q": "Is fuel burned while stopped at an address counted?",
  "a": "It is reported as a separate stationary block (idling at 1.67 L per hour, more with hydraulics) and is never added to tier-1, because the 1000 g per km figure may already include some stop-start fuel.",
  "source": "CLAUDE.md"
 },
 {
  "id": "q054",
  "category": "Emissions models",
  "q": "How sensitive is CMEM to its own parameters?",
  "a": "Changing the engine and drivetrain efficiency and the diesel heating value moved every CMEM figure by about plus or minus 12.7 percent and plus 4.17 percent, and the sign of the saving stayed the same in 77 of 77 cells.",
  "source": "CLAIMS CMEM parameters"
 },
 {
  "id": "q055",
  "category": "Fleet and electric trucks",
  "q": "What fleet is modelled?",
  "a": "Four identical 11 m3 medium-rigid rear-loader trucks, with 0, 1 or 2 of them battery-electric. Capacity is volume only.",
  "source": "CLAUDE.md"
 },
 {
  "id": "q056",
  "category": "Fleet and electric trucks",
  "q": "Why one and two electric trucks?",
  "a": "They reflect two battery-electric conversions sourced to the City of Newcastle Climate Action Plan 2030. Three and four electric trucks were also run in an exploratory fleet mix campaign.",
  "source": "LIMITATIONS B65, CLAIMS X1"
 },
 {
  "id": "q057",
  "category": "Fleet and electric trucks",
  "q": "What is the 110 km electric planning distance?",
  "a": "A per-day distance cap on each electric truck. It is an unsourced planning value, not a battery range. Energy feasibility was checked afterwards against a 138 kWh nominal battery at 80 or 90 percent usable.",
  "source": "Poster, LIMITATIONS B2"
 },
 {
  "id": "q058",
  "category": "Fleet and electric trucks",
  "q": "Did any electric route exceed usable battery energy?",
  "a": "Not in the fleet mix runs. The longest came within 0.4 km of the 80 percent limit (99.1 km against 99.5 km), so a lower usable fraction or higher energy use would bind first.",
  "source": "LIMITATIONS B2"
 },
 {
  "id": "q059",
  "category": "Fleet and electric trucks",
  "q": "Do the electric trucks charge during the day?",
  "a": "No mid-day charging. On multi-trip days the 110 km is shared across the day's trips.",
  "source": "CLAUDE.md, LIMITATIONS B65"
 },
 {
  "id": "q060",
  "category": "Fleet and electric trucks",
  "q": "Real trucks compact their load. Does the model?",
  "a": "No, the base model uses the nominal 11 m3 body because the real ratio is unknown. Bodies of 1.25, 1.5 and 2.0 times that size were tested and the saving held on one and two electric trucks at every level.",
  "source": "CLAIMS C15"
 },
 {
  "id": "q061",
  "category": "Fleet and electric trucks",
  "q": "Are the items reused or thrown away once on the truck?",
  "a": "Reuse items are taken before the truck arrives. The modelled truck collects the residual items, which are discarded, so compacting them is fine.",
  "source": "Technical decisions, project overview"
 },
 {
  "id": "q062",
  "category": "Method and statistics",
  "q": "How was the comparison set up?",
  "a": "Both plans, distance-only and emissions-aware, run on identical requests and the same fleet, paired by seed. The difference for each seed is emissions-aware minus distance-only, and the median of those differences is reported.",
  "source": "Poster, CLAIMS How to Read It"
 },
 {
  "id": "q063",
  "category": "Method and statistics",
  "q": "What is a paired Wilcoxon test?",
  "a": "The Wilcoxon signed-rank test. Each seed gives one pair of results. The test ranks the per-seed differences and asks whether their median is zero. It does not assume normal data, which suits skewed CO2-e figures.",
  "source": "Poster, src/srcro/stats.py"
 },
 {
  "id": "q064",
  "category": "Method and statistics",
  "q": "What is the Holm correction?",
  "a": "Many hypotheses are tested at once. Holm sorts the p-values and compares the smallest to 0.05 divided by the number of tests, the next to 0.05 divided by one fewer, and so on. It limits the chance of any false positive and is less conservative than Bonferroni.",
  "source": "Poster, src/srcro/stats.py"
 },
 {
  "id": "q065",
  "category": "Method and statistics",
  "q": "What is a bootstrap 95 percent interval?",
  "a": "Resample the seeds with replacement thousands of times, recompute the median difference each time, and take the 2.5th and 97.5th percentiles. An interval that excludes zero supports a real difference.",
  "source": "Poster"
 },
 {
  "id": "q066",
  "category": "Method and statistics",
  "q": "What is A12?",
  "a": "The Vargha-Delaney effect size, the probability that a random run from one plan scores higher than a random run from the other. 0.5 means no difference, 0 or 1 means complete separation.",
  "source": "src/srcro/stats.py, CLAIMS EQ5 naive"
 },
 {
  "id": "q067",
  "category": "Method and statistics",
  "q": "What does pre-registered mean here?",
  "a": "The hypotheses, cells, seeds and analysis were written and committed to git with a tag before the campaign ran, so the analysis could not be changed after seeing the results.",
  "source": "Poster, CLAIMS"
 },
 {
  "id": "q068",
  "category": "Method and statistics",
  "q": "Why medians and not means?",
  "a": "Per-seed CO2-e is skewed and some cells hit 0 kg, so the median is more robust, and it matches the Wilcoxon test on paired differences.",
  "source": "CLAIMS How to Read It"
 },
 {
  "id": "q069",
  "category": "Method and statistics",
  "q": "Why do the percent and kg figures not convert into each other?",
  "a": "Each is the median of its own per-seed differences. The seed at the median for kg is not the seed at the median for percent, so dividing 0.725 kg by a baseline will not reproduce 28.35 percent.",
  "source": "Poster Reading the figures, CLAIMS"
 },
 {
  "id": "q070",
  "category": "Method and statistics",
  "q": "Why 30 seeds and then 100?",
  "a": "The original campaigns used 30 seeds. The headline cells were replicated at 100 seeds in a pre-registered campaign. Seeds 1 to 30 reproduced the original results to the gram, and the 70 new seeds gave -28.15 and -55.88 percent.",
  "source": "CLAIMS C1"
 },
 {
  "id": "q071",
  "category": "Method and statistics",
  "q": "What are the confirmatory and exploratory tracks?",
  "a": "The confirmatory track is every pre-registered result as reported, untouched. The exploratory track may tune settings after seeing results, but only on seeds 1 to 30, and must quote validation on fresh seeds 31 to 90. Exploratory figures are labelled and never replace a confirmatory one.",
  "source": "CLAUDE.md, poster"
 },
 {
  "id": "q072",
  "category": "Method and statistics",
  "q": "Why validate on fresh seeds 31 to 90?",
  "a": "A setting tuned on the evaluation seeds can fit noise in those seeds. Testing it on seeds it never saw shows whether the gain is real.",
  "source": "CLAUDE.md"
 },
 {
  "id": "q073",
  "category": "Method and statistics",
  "q": "Where did the campaigns run?",
  "a": "Campaigns up to and including multi_trip_service_time (3 October 2026) ran on Jordan's laptop, among them the 30-seed first test of the headline. From then on every campaign and performance run went to Amazon Web Services spot instances in one region (Hyderabad), and since 30 October each campaign saves a checkpoint after every simulated day so a reclaimed instance resumes where it stopped. A paired comparison always runs both arms on the same machine, the same instance type, image, commit and region, because floating-point differences can flip a solver tie-break. Laptop and AWS runs are never mixed in one comparison.",
  "source": "CLAUDE.md Compute"
 },
 {
  "id": "q074",
  "category": "Method and statistics",
  "q": "How was the software tested?",
  "a": "Unit tests, an independent feasibility oracle, a conservation check on every run, metamorphic relations (for example, on four diesel trucks the two plans must be identical under tier-1), the CVRPLIB benchmark and a requirements traceability matrix.",
  "source": "CLAUDE.md Commands"
 },
 {
  "id": "q075",
  "category": "Method and statistics",
  "q": "What does 'the hypothesis holds' mean?",
  "a": "For each fleet, the emissions-aware plan's CO2-e per request is significantly below the distance-only plan's after Holm correction, with a confidence interval below zero. Both headline hypotheses held at 30 and at 100 seeds.",
  "source": "CLAIMS C1"
 },
 {
  "id": "q076",
  "category": "Headline result",
  "q": "What is the headline result?",
  "a": "Planning for emissions instead of distance cut tailpipe CO2-e per request by 28.35 percent (0.725 kg) with one electric truck of four and by 55.78 percent (0.863 kg) with two, on the same requests and fleet, 100 seeds, pre-registered.",
  "source": "Poster, CLAIMS C1"
 },
 {
  "id": "q077",
  "category": "Headline result",
  "q": "Less per request compared with what?",
  "a": "Compared with distance-only planning on identical requests and the identical fleet, paired by seed. 0.725 kg is the median per-seed difference in tier-1 CO2-e per collected request with one electric truck.",
  "source": "Poster, CLAIMS C1"
 },
 {
  "id": "q078",
  "category": "Headline result",
  "q": "Why do 28.57 and 55.38 percent appear beside the poster's 28.35 and 55.78?",
  "a": "The site leads with the 100-seed replication, 28.35 and 55.78 percent (0.725 and 0.863 kg), as the poster does, where they are printed as 28.4 and 55.8. That replication was pre-registered in git before it ran. The 28.57 and 55.38 percent (0.735 and 0.837 kg) are the first test over 30 seeds, run on 2 October 2026, before the first pre-registration on 4 October, so that one was a planned test, not a pre-registered one. Both hold. Quote each with its seed count.",
  "source": "CLAIMS C1 and P1, table17_gradient README"
 },
 {
  "id": "q079",
  "category": "Headline result",
  "q": "Why is the percent saving larger with two electric trucks when the kg saving is similar?",
  "a": "The percentage is relative to the distance-only plan's CO2-e, which is already much lower with two electric trucks. A similar kilogram saving is then a larger share.",
  "source": "CLAIMS C1, X1"
 },
 {
  "id": "q080",
  "category": "Headline result",
  "q": "Is the saving a real-world measurement?",
  "a": "No. Electric trucks count 0 g per km by definition, so most of the saving is the model putting kilometres on electric trucks. Absolute kilograms rest on an unsourced diesel factor and a volume-only body.",
  "source": "CLAIMS C1"
 },
 {
  "id": "q081",
  "category": "Headline result",
  "q": "What about four diesel trucks?",
  "a": "No saving. Under tier-1 the two plans are identical. Under the gradient objective the emissions-aware plan costs 0.66 to 0.92 percent more tier-1 CO2-e per request, in return for a small within-model CMEM gain. At 100 seeds the difference was +0.27 percent, not significant.",
  "source": "Poster EQ4, CLAIMS C4, C1"
 },
 {
  "id": "q082",
  "category": "Headline result",
  "q": "So does emissions-aware routing help diesel trucks?",
  "a": "Not on tier-1 in this scenario. The gain on mixed fleets is not evidence that routing saves emissions on diesel trucks. It does not prove route shape never matters on real hilly routes, only that no tier-1 gain appeared here.",
  "source": "CLAIMS C4"
 },
 {
  "id": "q083",
  "category": "Headline result",
  "q": "Why are some cells 100 percent?",
  "a": "At 15 requests a day with two electric trucks the emissions-aware plan drives no diesel kilometres at all, so its tailpipe CO2-e is 0. Read those cells in kilograms.",
  "source": "CLAIMS C1"
 },
 {
  "id": "q084",
  "category": "Headline result",
  "q": "Do the plans give minimal emissions?",
  "a": "No such claim is made. There is no bound or optimality gap for the emissions objective, VROOM is a heuristic, and day choice and routing are not jointly optimal. The claim is lower CO2-e than distance-only planning in this model.",
  "source": "CLAIMS C7"
 },
 {
  "id": "q085",
  "category": "Where the saving comes from",
  "q": "Where does the saving come from?",
  "a": "Mostly from which truck drives which route. Giving the longest routes to the electric trucks accounts for 55.1 to 73.7 percent of the saving across the six mixed cells. Emissions-aware routing adds a smaller saving on top, 0.197 to 0.327 kg per request, significant in every cell.",
  "source": "Poster, CLAIMS C2"
 },
 {
  "id": "q086",
  "category": "Where the saving comes from",
  "q": "How was the split between assignment and routing measured?",
  "a": "Post hoc, with no solver. On each measured day the distance-only plan's executed routes were relabelled across the four trucks, one route a truck, so that the electric trucks drove the longest routes they could within their range, and then rescored. The drop from that relabelling is the assignment part, the best that relabelling the distance plan's own routes can do. The rest of the full saving is the routing part.",
  "source": "CLAIMS C2, CAMPAIGN EQ1 split"
 },
 {
  "id": "q087",
  "category": "Where the saving comes from",
  "q": "Isn't it all routing?",
  "a": "In everyday language yes. Here 'assignment' means which truck gets which route, and 'routing' means everything else the emissions-aware plan changes, the day each request is collected, stop order and gradient-aware path choice.",
  "source": "CLAIMS C2"
 },
 {
  "id": "q088",
  "category": "Where the saving comes from",
  "q": "Why ratio of means for the split and not medians?",
  "a": "The two parts must add up to the whole. Medians of parts do not add to the median of the whole, ratios of means do.",
  "source": "CLAIMS C2"
 },
 {
  "id": "q089",
  "category": "Where the saving comes from",
  "q": "Couldn't a distance planner that knew the truck types get the assignment part?",
  "a": "Yes, some of it. The assignment part is the best relabelling of the distance plan's routes, not a bound on what a type-aware distance planner could reach. Such a planner could capture some of the routing part too.",
  "source": "CLAIMS C2"
 },
 {
  "id": "q090",
  "category": "Where the saving comes from",
  "q": "What does the 'Where the plans differ' view on the site show?",
  "a": "For seed 1 with one electric truck, 219 requests moved truck type between the plans. The electric truck drives 1371 of 2344 km (58 percent) in the emissions-aware plan against 671 of 1832 km (37 percent) in the distance-only plan. One scenario, descriptive.",
  "source": "Handover 2026-11-01"
 },
 {
  "id": "q091",
  "category": "Cost and service",
  "q": "What does the saving cost?",
  "a": "With one and two electric trucks the emissions-aware plan drove 18.16 and 15.99 percent more km, its mean wait was 0.79 and 0.96 business days longer, and it used 2 and 3 fewer truck-days of 80. 100 seeds.",
  "source": "Poster EQ2, CLAIMS EQ2 cost"
 },
 {
  "id": "q092",
  "category": "Cost and service",
  "q": "What is a truck-day?",
  "a": "One truck working one day. Four trucks over 20 measured days gives 80. Fewer truck-days with more km means fewer, longer routes. It is not a fleet sizing result.",
  "source": "CLAIMS EQ2 cost"
 },
 {
  "id": "q093",
  "category": "Cost and service",
  "q": "Are the extra kilometres extra emissions?",
  "a": "Mostly not. They are mostly electric kilometres, which count 0 g per km. The km figure is the cost side of the saving, not an emissions figure.",
  "source": "CLAIMS EQ2 cost"
 },
 {
  "id": "q094",
  "category": "Cost and service",
  "q": "How long do residents wait?",
  "a": "Median mean wait was 2.040 against 1.240 business days with one electric truck and 2.165 against 1.200 with two, emissions-aware against distance-only.",
  "source": "CLAIMS EQ2 cost"
 },
 {
  "id": "q095",
  "category": "Cost and service",
  "q": "Were requests collected within 7 working days?",
  "a": "Yes. In all 600 runs every request collected in the measured days was collected within 7 business days of arriving, and none after its advised day.",
  "source": "Poster EQ3, CLAIMS EQ3"
 },
 {
  "id": "q096",
  "category": "Cost and service",
  "q": "What does the 7-day figure not cover?",
  "a": "Requests still waiting at the end of a run. The median end backlog is 30 to 32 requests on distance-only and 51.5 and 54 on emissions-aware with one and two electric trucks. It also does not cover overloaded demand.",
  "source": "CLAIMS EQ3"
 },
 {
  "id": "q097",
  "category": "Cost and service",
  "q": "Is emissions-aware planning better or worse on time?",
  "a": "In the pick-up volume campaign its share collected on the advised day was higher in all six mixed cells (90.82 to 100 percent against 79.69 to 90.04), but its backlog and mean age were higher in five of six. No request was late in either plan.",
  "source": "CLAIMS C1"
 },
 {
  "id": "q098",
  "category": "Cost and service",
  "q": "What is the 36.66 percent in EQ5?",
  "a": "Distance-only planning with VROOM against a naive nearest-neighbour planner, on four diesel trucks at 25 a day, 30 seeds. VROOM gave 36.66 percent less CO2-e (2.205 kg). It shows VROOM is not trivial. It is not the emissions-aware plan and not an optimality claim.",
  "source": "Poster EQ5, CLAIMS EQ5 naive"
 },
 {
  "id": "q099",
  "category": "Cost and service",
  "q": "How fast does it re-plan?",
  "a": "A median 0.57 s for distance-only and 0.87 s for emissions-aware planning on a dedicated 4 vCPU machine, slowest 1.97 s of 5,400 re-plans, against a 120 s requirement.",
  "source": "Poster EQ5, CLAIMS EQ5 timing"
 },
 {
  "id": "q100",
  "category": "Cost and service",
  "q": "Why mention the machine in EQ5?",
  "a": "A timing figure means nothing without the hardware. It ran alone on one dedicated on-demand instance, never a shared or spot one, so the times are repeatable.",
  "source": "CLAIMS EQ5 timing, CLAUDE.md"
 },
 {
  "id": "q101",
  "category": "Cost and service",
  "q": "Why is EQ5 answered 'Partly'?",
  "a": "VROOM beats the naive planner and re-plans in about a second, but the energy used by the computing itself was not measured.",
  "source": "Poster EQ5"
 },
 {
  "id": "q102",
  "category": "Sensitivity and robustness",
  "q": "What does 'sensitive to inputs' mean?",
  "a": "EQ4, the sensitivity analysis. Each row of the 'Does it hold?' table changes one input and reruns both plans to see whether emissions-aware planning still beats distance-only.",
  "source": "Poster EQ4"
 },
 {
  "id": "q103",
  "category": "Sensitivity and robustness",
  "q": "What does 'direction held' mean?",
  "a": "On every fleet with electric trucks, emissions-aware planning still emitted less than distance-only in every case tested, even where the size of the saving changed. The four-diesel row is the exception, where there is no saving (next question).",
  "source": "Poster EQ4"
 },
 {
  "id": "q104",
  "category": "Sensitivity and robustness",
  "q": "Which row in 'Does it hold?' did not hold?",
  "a": "Four diesel trucks, +0.66 to +0.92 percent. That is expected, because with no electric trucks tier-1 cannot see the gradient, and the gradient-aware plan drives slightly more km. The NSW grid row holds but shrinks to 1.48 to 10.75 percent.",
  "source": "Poster EQ4, CLAIMS C3, C4"
 },
 {
  "id": "q105",
  "category": "Sensitivity and robustness",
  "q": "What about a higher diesel factor?",
  "a": "At refuse-truck factors of 2,089, 2,700 and 3,423 g per km the percentage saving stayed within 2 points of its value at 1000 (28.1 to 28.6 percent with one electric truck, 55.4 to 57.4 with two). Kilograms scale with the factor.",
  "source": "CLAIMS C8"
 },
 {
  "id": "q106",
  "category": "Sensitivity and robustness",
  "q": "What about pick-up volume?",
  "a": "The saving held at low, nominal and high volumes, 0.619 to 0.837 kg per request on the mixed fleets. The percentage falls as volume rises because the distance-only base grows.",
  "source": "Poster, CLAIMS C5"
 },
 {
  "id": "q107",
  "category": "Sensitivity and robustness",
  "q": "What about compaction?",
  "a": "With bodies 1.0 to 2.0 times 11 m3 the saving stayed significant on one and two electric trucks at every level, with no significant difference on four diesel trucks.",
  "source": "Poster, CLAIMS C15"
 },
 {
  "id": "q108",
  "category": "Sensitivity and robustness",
  "q": "What about driver behaviour, service time and speed?",
  "a": "On the earlier tier-1 objective, the saving kept its direction under driver behaviour of plus and minus 6.8 percent (Diaz-Ramirez et al. 2017), service time plus and minus 50 percent with up to three trips, and the MEET and ATAP speed curves.",
  "source": "Poster, CLAIMS Driver, service time and speed"
 },
 {
  "id": "q109",
  "category": "Sensitivity and robustness",
  "q": "Why does the speed row say 'earlier objectives'?",
  "a": "Those cases ran on the earlier tier-1 objective, before the gradient-aware objective was adopted, so they are not gradient results. They are planned EQ4 cases, not pre-registered.",
  "source": "CLAIMS Driver, service time and speed"
 },
 {
  "id": "q110",
  "category": "Multiple trips",
  "q": "What are the multi-trip rules?",
  "a": "Up to three trips a truck a day, a 1 hour depot turnaround between trips, no charging in the turnaround, and the electric 110 km split across the trips. The last unload may run past 15:00. These rules are unsourced.",
  "source": "CLAUDE.md, LIMITATIONS B28"
 },
 {
  "id": "q111",
  "category": "Multiple trips",
  "q": "What are the three-trip results?",
  "a": "Under the planner's own trip rules, with stage 2, CMEM CO2-e per request fell 82.29 percent (1.411 kg) with one electric truck at 25 a day and 44.42 percent (0.687 kg) at 50 a day, and 77.24 and 83.39 percent (0.920 and 0.903 kg) with two. 100 seeds, within-model. Tier-1 check, -79.86, -42.73, -74.62 and -81.30 percent.",
  "source": "Poster, CLAIMS C6"
 },
 {
  "id": "q112",
  "category": "Multiple trips",
  "q": "Why are the three-trip savings so much bigger?",
  "a": "An electric truck can return and go out again, so far more of the day's work moves onto electric trucks. The headline single-trip figure and the three-trip figure are different operating rules and are never combined.",
  "source": "CLAIMS C6, CLAUDE.md"
 },
 {
  "id": "q113",
  "category": "Multiple trips",
  "q": "Why is one electric truck at 50 a day only 44 percent?",
  "a": "Demand exceeds what one electric truck can carry within 110 km and three trips, so diesel trucks must do the rest.",
  "source": "CLAIMS C6"
 },
 {
  "id": "q201",
  "category": "Multiple trips",
  "q": "The Results page shows about 82 percent lower with one electric truck, but the headline is 28.35 percent. Why the jump?",
  "a": "They are different operating rules and different measures, so they are never compared as one result or combined. The 28.35 percent is one trip a truck a day, tier-1 CO2-e, 100 seeds (the pre-registered replication of claim C1). The 82.49 percent is up to three trips a truck a day, CMEM CO2-e with the load-aware routing stage, within-model, 25 requests a day, 30 seeds (claim C6), and its tier-1 check is 80.33 percent. With three trips an electric truck can come back and go out again, so far more of the day's work moves onto it. Both are technical figures, each against distance-only planning under its own trip rules. The jump from one to the other is a change of operating rules, not better routing. At 50 requests a day the same fleet saves only about 45 percent, because one electric truck cannot carry most of the day within 110 km. Over 100 seeds the three-trip figure is 82.29 percent.",
  "source": "CLAIMS C1 and C6, Results page"
 },
 {
  "id": "q114",
  "category": "Multiple trips",
  "q": "What is the difference between a technical and a rule-driven saving?",
  "a": "A technical saving comes from better planning under the same operating rules. A rule-driven saving comes from changing the rules, such as more trips, flexible trip timing or a shared electric range. They are always reported separately and never added.",
  "source": "CLAIMS How to Read It"
 },
 {
  "id": "q115",
  "category": "Multiple trips",
  "q": "What did looser trip rules add?",
  "a": "Letting stage 2 re-time trips back to back and share the 110 km across them saved a further 0.04 to 0.24 kg per request on two electric trucks, significant in three of four cells. That is a rule-driven figure, reported apart from the technical one.",
  "source": "CLAIMS C6"
 },
 {
  "id": "q116",
  "category": "Multiple trips",
  "q": "Was electric energy checked on multi-trip days?",
  "a": "No. Under the looser trip rules electric trucks drove up to about 100 km a day, and energy feasibility was not checked in either multi-trip campaign. At 1.3 kWh per km, 138 kWh at 80 percent usable would only cover about 85 km.",
  "source": "CLAIMS C6"
 },
 {
  "id": "q117",
  "category": "Solver comparison",
  "q": "Which solvers were compared with VROOM?",
  "a": "OR-Tools guided local search, tabu search and simulated annealing, two releases of PyVRP, a rank-based ant system (Bullnheimer et al. 1999), LKH-3 on static days, and three published learned solvers (RRNCO, Kool's attention model, POMO) on static days.",
  "source": "Poster RQ2, CLAIMS C10 to C20"
 },
 {
  "id": "q118",
  "category": "Solver comparison",
  "q": "In the solver table, does plus mean better or worse?",
  "a": "Plus means that solver's plan costs more than VROOM's by the shared objective, so worse. Minus means cheaper. The only minus is PyVRP at -0.49 percent, which is not distinguishable from zero.",
  "source": "Poster, CLAIMS PyVRP tie"
 },
 {
  "id": "q119",
  "category": "Solver comparison",
  "q": "How did OR-Tools do?",
  "a": "Guided local search kept the direction of the saving and kept service, but its plans cost 4.83 to 7.48 percent more and it took about 26 to 33 times as long per re-plan. Tabu search cost 5.74 to 20.99 percent more and simulated annealing 12.26 to 28.51 percent.",
  "source": "CLAIMS C10, C17"
 },
 {
  "id": "q120",
  "category": "Solver comparison",
  "q": "OR-Tools found a bigger emissions saving. Isn't it better?",
  "a": "No. Its larger saving comes partly from a distance-only plan that drives more (4.05 to 4.06 km per request against 3.83 to 3.88 for VROOM), which inflates the gap.",
  "source": "CLAIMS C10"
 },
 {
  "id": "q121",
  "category": "Solver comparison",
  "q": "How did PyVRP do?",
  "a": "Both releases kept the saving and service. Their plans cost more than VROOM's in 11 of 12 comparisons, from a tie at -0.49 to +9.40 percent, at a median 145 to 672 s a re-plan against VROOM's about 1 s. PyVRP was the strongest solver on the static CVRPLIB benchmark, so its search is not weak.",
  "source": "CLAIMS C14"
 },
 {
  "id": "q122",
  "category": "Solver comparison",
  "q": "How did the ant system do?",
  "a": "It kept the direction of the saving (-11 and -31 percent against VROOM's -29 and -55) but its plans cost 14 to 16 percent more on distance plans and 18 to 108 percent more on emissions plans, using nearly every truck-day and far less of the electric trucks.",
  "source": "CLAIMS C20"
 },
 {
  "id": "q123",
  "category": "Solver comparison",
  "q": "Why did the ant system need two competence gates?",
  "a": "The first implementation failed its pre-registered gate on CVRPLIB set A (17.80 percent against 3.5 allowed). Three implementation errors were found against the paper and fixed, and it then passed a second gate at 4.37 percent against 5.0.",
  "source": "CLAIMS C18, C19"
 },
 {
  "id": "q124",
  "category": "Solver comparison",
  "q": "How did LKH-3 compare?",
  "a": "LKH-3 cannot represent the daily re-plan, so it was compared on 5,220 executed days reduced to static problems. It matched VROOM's distance on 4,742 days, a mean gap of +0.01 percent, at about nine times the time.",
  "source": "CLAIMS C16"
 },
 {
  "id": "q125",
  "category": "Solver comparison",
  "q": "Did machine learning solvers help?",
  "a": "Three released learned solvers, run with no training, did not beat VROOM on static days or on CVRPLIB. The closest, RRNCO, was 5.58 percent longer on average. None handles the shift end, multiple trucks, electric range or the emissions objective.",
  "source": "CLAIMS C11"
 },
 {
  "id": "q126",
  "category": "Solver comparison",
  "q": "So is VROOM the best solver?",
  "a": "That is not shown. Each solver ran at one untuned setting, so the honest answer is that none of those tried clearly beat VROOM on this problem.",
  "source": "Poster RQ2, CLAIMS C10"
 },
 {
  "id": "q127",
  "category": "Exploratory results",
  "q": "What does the fleet mix chart show?",
  "a": "Tier-1 kg CO2-e per request for 0 to 4 electric trucks of four, distance-only against emissions-aware. 3.821 kg with all diesel, then 2.561 against 1.840, 1.550 against 0.672, and 0.514 against 0 at three electric trucks. Seeds 31 to 90, exploratory.",
  "source": "Poster Fleet mix, CLAIMS X1"
 },
 {
  "id": "q128",
  "category": "Exploratory results",
  "q": "Why are both bars the same at 0 electric trucks?",
  "a": "With four diesel trucks tier-1 is km times 1000 g for every truck, so there is no truck choice to exploit and both plans emit the same, 3.821 kg per request. At four electric trucks both are 0.",
  "source": "Poster Fleet mix, CLAIMS X1, C4"
 },
 {
  "id": "q129",
  "category": "Exploratory results",
  "q": "What do 'gaps' and 'steps' mean on the fleet mix chart?",
  "a": "The gap between the two bars at one fleet size is the planning saving. The drop from one fleet size to the next is what adding an electric truck buys, a fleet decision, not a planning saving.",
  "source": "Poster Fleet mix, CLAIMS X1"
 },
 {
  "id": "q130",
  "category": "Exploratory results",
  "q": "What does the trade-off chart show?",
  "a": "Each point is one weight w on emissions in a blended objective, from w = 0 (pure distance) to w = 1 (pure emissions). Moving right, km per request rise and CO2-e per request falls. Filled points are non-dominated, no other weight tried gives both fewer km and less CO2-e.",
  "source": "Poster Trade-off, CLAIMS X6"
 },
 {
  "id": "q131",
  "category": "Exploratory results",
  "q": "Why is the trade-off curve 'approximate'?",
  "a": "Only the listed weights were tried, and a weighted sum can only find the convex part of a trade-off front (Das and Dennis 1997).",
  "source": "CLAIMS X6"
 },
 {
  "id": "q132",
  "category": "Exploratory results",
  "q": "What is the main finding of the trade-off chart?",
  "a": "On both fleets a blend at w = 0.9 beats the pure emissions objective on both km and CO2-e. At w = 0.5, 1.928 and 0.731 kg per request at 3.788 and 3.820 km, against 2.561 and 1.556 kg at 3.819 and 3.853 km for distance-only.",
  "source": "CLAIMS X6"
 },
 {
  "id": "q133",
  "category": "Exploratory results",
  "q": "What does 'Where it pays off' show?",
  "a": "kg CO2-e saved per request by emissions-aware against distance-only planning in three demand settings, seeds 31 to 90. 0.839 and 0.532 kg at 15 a day, 2.178 and 1.384 kg at 25 a day with up to three trips, 0.493 and 0.507 kg at 50 a day overloaded, for one and two electric trucks.",
  "source": "Poster, CLAIMS X2"
 },
 {
  "id": "q134",
  "category": "Exploratory results",
  "q": "Why does two electric trucks save less than one at 15 a day?",
  "a": "At low demand two electric trucks can do almost everything, so the distance-only plan already lands most work on them and there is less left to win. The emissions-aware plan drives no diesel there at all.",
  "source": "CLAIMS X2"
 },
 {
  "id": "q135",
  "category": "Exploratory results",
  "q": "What did the scale grid find?",
  "a": "With 11, 23 and 30 m3 bodies, pick-ups up to 4 m3 and 25 to 100 requests a day, emissions-aware planning cut tier-1 CO2-e per request in every one of 24 cells, by 17 to 100 percent. The saving grew with body size and shrank as demand rose. Bigger bodies are modelled as volume only.",
  "source": "Poster, CLAIMS X5"
 },
 {
  "id": "q136",
  "category": "Exploratory results",
  "q": "Do service rules change the result?",
  "a": "Changing the waiting and late penalties moves the balance between wait and emissions, but the saving held at every level, -26.8 to -32.8 percent with one electric truck and -54.5 to -61.8 with two. No setting was adopted.",
  "source": "CLAIMS X3"
 },
 {
  "id": "q137",
  "category": "Exploratory results",
  "q": "Would more stage 2 search help?",
  "a": "No. Five times more iterations (50,000) changed CMEM CO2-e per request by about 0.1 g, so the pre-registered setting is not short of search at this scale.",
  "source": "CLAIMS X4"
 },
 {
  "id": "q138",
  "category": "Limitations",
  "q": "What are the main limitations?",
  "a": "Synthetic demand and locations. Unsourced diesel factor and 110 km electric distance. Volume-only 11 m3 body with no compaction. Fixed free-flow road speeds with no time-of-day traffic. Day choice at one fixed mass. Battery manufacture out of scope. No claim of minimal emissions. Fleet sizing not studied.",
  "source": "Poster Limits, LIMITATIONS"
 },
 {
  "id": "q139",
  "category": "Limitations",
  "q": "Is the lack of traffic a big limitation?",
  "a": "It is a real one. Every road has one free-flow speed for the whole shift, so congestion, peak periods and reliability are not modelled, and the planner never chooses speed. The direction of the saving held under the speed curve cases tested.",
  "source": "LIMITATIONS network speeds"
 },
 {
  "id": "q140",
  "category": "Limitations",
  "q": "Why not use real council data?",
  "a": "None was available to the project, and the stakeholders are not council waste services. Service rules such as the advised day and the shift were modelling choices, not council input.",
  "source": "LIMITATIONS B65"
 },
 {
  "id": "q141",
  "category": "Limitations",
  "q": "Was integration with the AI Vision project tested?",
  "a": "No. The output contract and a record adapter exist, but integration was never tested with that team.",
  "source": "LIMITATIONS B65"
 },
 {
  "id": "q142",
  "category": "Limitations",
  "q": "Was the emissions objective benchmarked against published problems?",
  "a": "No. It was never run on published Pollution-Routing Problem instances, so there is no external check that the emissions search reaches known-good solutions on its own objective. The CVRPLIB benchmark is distance only.",
  "source": "CLAIMS C7, LIMITATIONS B62"
 },
 {
  "id": "q143",
  "category": "Limitations",
  "q": "Is the fleet sizing answered?",
  "a": "No. Fewer truck-days in EQ2 and the fleet mix chart are not fleet sizing results.",
  "source": "Poster Limits, CLAIMS EQ2 cost"
 },
 {
  "id": "q204",
  "category": "Limitations",
  "q": "Why does the intake check accept a point in the harbour?",
  "a": "The intake check tests a point against the council boundary, OpenStreetMap relation R6189831, which takes in the estuary and harbour (about 215 km2 with the water, 187 km2 of land). A point in the water inside that line is admitted, and routing would then snap it to the nearest road, which can be hundreds of metres away. The scenarios never hit this, because their requests are sampled from road nodes. A real intake would also check the distance to the nearest road and flag a point that is too far.",
  "source": "LIMITATIONS Intake on water, CLAUDE.md Geospatial"
 },
 {
  "id": "q144",
  "category": "Next steps",
  "q": "What would you do next?",
  "a": "The limitations point the way. Real request data from the council, a sourced diesel factor and an electric truck datasheet, the real compaction ratio, time-dependent road speeds, load-aware day choice, a benchmark on published Pollution-Routing Problem instances, and integration testing with the AI Vision project.",
  "source": "LIMITATIONS, CLAIMS C7"
 },
 {
  "id": "q145",
  "category": "Next steps",
  "q": "Could a council use this?",
  "a": "The planner runs in about a second per re-plan and writes a documented output contract, so it could be piloted. Any saving would need real demand and truck data first, since every figure here is from a synthetic scenario.",
  "source": "CLAIMS EQ5 timing, LIMITATIONS B65"
 },
 {
  "id": "q146",
  "category": "Next steps",
  "q": "Does it only work for Newcastle?",
  "a": "The scale grid found the saving in every setting tried, with bigger trucks, bigger pick-ups and up to 100 requests a day. Other cities would need their own road network, boundary and elevation data. That is exploratory, not a tested claim about other cities.",
  "source": "CLAIMS X5"
 },
 {
  "id": "q147",
  "category": "Demo site",
  "q": "What is on the demo site?",
  "a": "Eight pages. Home, Explore Scenarios with 90 pre-calculated scenarios, Live Plan, Project Results with the pre-registered results and charts, Q&A, the Poster, Architecture with four diagrams of the system, and Credits with 94 references and 16 unsourced working assumptions.",
  "source": "DEMO Pages"
 },
 {
  "id": "q148",
  "category": "Demo site",
  "q": "What are the 90 pre-calculated scenarios?",
  "a": "Finished runs of the fleet mix campaigns, seeds 1 to 90, 0 to 4 electric trucks, both plans, 25 requests a day, single trip, 10 warm-up and 20 measured days. Every figure drawn from them is descriptive, not pre-registered.",
  "source": "DEMO 90 scenarios"
 },
 {
  "id": "q149",
  "category": "Demo site",
  "q": "Is the Live Plan a real run?",
  "a": "Yes, it runs the real pipeline on a synthetic scenario, but short (5 to 40 measured days), so the backlog is not at steady state. A run with settings outside the reported campaigns is a demonstration, never a result. The hosted live plan stays available after the expo, while the presenter switches it on.",
  "source": "LIMITATIONS Expo Demonstration, handover"
 },
 {
  "id": "q150",
  "category": "Demo site",
  "q": "Are the figures on the site the same as the poster?",
  "a": "Yes. Like the poster, the Home and Project Results pages lead with the pre-registered replication over 100 seeds (28.35 and 55.78 percent lower on one and two electric trucks, printed on the poster as 28.4 and 55.8), with the first 30-seed test (28.57 and 55.38 percent, run before pre-registration began) beside it. Figures computed from the 90 scenarios are descriptive and one scenario at a time. Spoken figures should come from the poster.",
  "source": "CLAIMS C1 and P1, LIMITATIONS Expo Demonstration"
 },
 {
  "id": "q202",
  "category": "Demo site",
  "q": "Why does Explore Scenarios show minus 100 percent with three electric trucks of four?",
  "a": "Because the emissions-aware plan stops using the diesel truck. In scenario 1 three electric trucks have room and range for the day's 25 requests, so the plan gives them every route, and electric trucks count as 0 g CO2-e per km (tank to wheel). Its CO2-e is then zero and the change is minus 100 percent. It drives more kilometres to do it, 435 km more over scenario 1's 20 days. Across the 90 scenarios the median is minus 100 percent and the plan is lower in all 90. With four electric trucks both plans emit nothing, so the page shows n/a. Charged at New South Wales grid factors the electric kilometres would not be zero (claim P3), so this is a tailpipe figure, not a whole-of-life one.",
  "source": "Explore Scenarios, scenario 1 and the 90 scenario table, CLAIMS P3"
 },
 {
  "id": "q203",
  "category": "Demo site",
  "q": "How long will the Live Plan stay available?",
  "a": "Until Thursday 31 December 2026 at 11:59 pm Sydney time, so markers can use it after the expo. The server is not always on. It sleeps 10 minutes after the last re-plan has finished and starts by itself when a visitor presses Re-plan now, which takes under a minute (the presenter can turn this off), and after the end of the window it refuses to start. When it has ended the page says so, and the 90 pre-calculated scenarios on Explore Scenarios are always available.",
  "source": "STATE, presenter page"
 },
 {
  "id": "q151",
  "category": "Abbreviations",
  "q": "What does SR:CRO or SRCRO stand for?",
  "a": "Seeing Reuse: Collection Routing Optimisation, the project's name.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q152",
  "category": "Abbreviations",
  "q": "What does RQ1 stand for?",
  "a": "Research question 1. How can on-demand reuse collection be framed as a tractable green vehicle routing problem with load-dependent emissions and service deadlines?",
  "source": "Poster"
 },
 {
  "id": "q153",
  "category": "Abbreviations",
  "q": "What does RQ2 stand for?",
  "a": "Research question 2. Which solver family gives the best emissions and cost trade-off at Newcastle scale?",
  "source": "Poster"
 },
 {
  "id": "q154",
  "category": "Abbreviations",
  "q": "What does RQ3 stand for?",
  "a": "Research question 3. How much CO2-e does emissions-aware planning save against distance-only planning, across demand levels and fleet mixes?",
  "source": "Poster"
 },
 {
  "id": "q155",
  "category": "Abbreviations",
  "q": "What does EQ1 stand for?",
  "a": "Evaluation question 1. Does emissions-aware planning cut CO2-e? Answer, yes, by 28.35 and 55.78 percent with one and two electric trucks of four.",
  "source": "Poster, Testing and Evaluation Plan"
 },
 {
  "id": "q156",
  "category": "Abbreviations",
  "q": "What does EQ2 stand for?",
  "a": "Evaluation question 2. At what cost? Answer, 18.16 and 15.99 percent more km, a mean wait 0.79 and 0.96 business days longer, 2 and 3 fewer truck-days of 80.",
  "source": "Poster"
 },
 {
  "id": "q157",
  "category": "Abbreviations",
  "q": "What does EQ3 stand for?",
  "a": "Evaluation question 3. Is every request collected within 7 working days? Answer, yes, in all 600 runs.",
  "source": "Poster"
 },
 {
  "id": "q158",
  "category": "Abbreviations",
  "q": "What does EQ4 stand for?",
  "a": "Evaluation question 4. Is the result sensitive to inputs? This is the sensitivity analysis. Answer, the direction held in every test.",
  "source": "Poster"
 },
 {
  "id": "q159",
  "category": "Abbreviations",
  "q": "What does EQ5 stand for?",
  "a": "Evaluation question 5. Is it viable against naive planning? Answer, partly. 36.66 percent below nearest neighbour and about a second per re-plan, but compute energy was not measured.",
  "source": "Poster"
 },
 {
  "id": "q160",
  "category": "Abbreviations",
  "q": "What does CO2-e stand for?",
  "a": "Carbon dioxide equivalent. Other greenhouse gases expressed as the amount of CO2 with the same warming effect.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q161",
  "category": "Abbreviations",
  "q": "What does CMEM stand for?",
  "a": "Comprehensive Modal Emissions Model (Barth et al. 2005), a physics-based fuel model using speed, road grade and vehicle mass.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q162",
  "category": "Abbreviations",
  "q": "What does Tier-1 stand for?",
  "a": "Not an abbreviation. Tier-1 CO2-e is km times a per-vehicle factor, 1000 g per km diesel and 0 electric, the primary reported figure.",
  "source": "Poster"
 },
 {
  "id": "q163",
  "category": "Abbreviations",
  "q": "What does VROOM stand for?",
  "a": "Vehicle Routing Open-source Optimization Machine, the stage 1 solver.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q164",
  "category": "Abbreviations",
  "q": "What does OSRM stand for?",
  "a": "Open Source Routing Machine, which gives road travel times and distances.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q165",
  "category": "Abbreviations",
  "q": "What does CH and MLD stand for?",
  "a": "Contraction Hierarchies and Multi-Level Dijkstra, two OSRM routing algorithms. The project must use CH, because only CH returns distances from OSRM's table service.",
  "source": "Testing and Evaluation Plan, Appendix B, CLAUDE.md"
 },
 {
  "id": "q166",
  "category": "Abbreviations",
  "q": "What does OSM stand for?",
  "a": "OpenStreetMap, the open map data the road network comes from.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q167",
  "category": "Abbreviations",
  "q": "What does ALNS stand for?",
  "a": "Adaptive large neighbourhood search, the stage 2 search that re-routes each day for load-dependent fuel.",
  "source": "Poster"
 },
 {
  "id": "q168",
  "category": "Abbreviations",
  "q": "What does PRP stand for?",
  "a": "Pollution-Routing Problem (Bektas and Laporte 2011), a vehicle routing problem minimising fuel, emissions and driver cost with load and speed dependent fuel.",
  "source": "Poster"
 },
 {
  "id": "q169",
  "category": "Abbreviations",
  "q": "What does VRP and CVRP stand for?",
  "a": "Vehicle routing problem, and capacitated vehicle routing problem, where each truck has a load limit.",
  "source": "CLAIMS C11, C16"
 },
 {
  "id": "q170",
  "category": "Abbreviations",
  "q": "What does GVRP stand for?",
  "a": "Green vehicle routing problem. In its formal definition (Erdogan and Miller-Hooks 2012) it includes recharging or refuelling stops, which this model does not have.",
  "source": "LIMITATIONS B65"
 },
 {
  "id": "q171",
  "category": "Abbreviations",
  "q": "What does CVRPLIB stand for?",
  "a": "The capacitated vehicle routing benchmark library, standard problems with best known solutions, used to check each solver's quality on distance.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q172",
  "category": "Abbreviations",
  "q": "What does BKS stand for?",
  "a": "Best known solution, the shortest published answer to a benchmark problem. A solver's gap is measured against it.",
  "source": "CLAIMS C7"
 },
 {
  "id": "q173",
  "category": "Abbreviations",
  "q": "What does PRPLIB stand for?",
  "a": "A library of published Pollution-Routing Problem instances. The emissions objective was never benchmarked on it, a stated limitation.",
  "source": "CLAIMS C7"
 },
 {
  "id": "q174",
  "category": "Abbreviations",
  "q": "What does LKH-3 stand for?",
  "a": "Lin-Kernighan-Helsgaun heuristic, version 3, a vehicle routing solver compared with VROOM on static days.",
  "source": "CLAIMS C16"
 },
 {
  "id": "q175",
  "category": "Abbreviations",
  "q": "What does OR-Tools stand for?",
  "a": "Google's open-source operations research toolkit. Its guided local search, tabu search and simulated annealing were compared with VROOM.",
  "source": "CLAIMS C10, C17"
 },
 {
  "id": "q176",
  "category": "Abbreviations",
  "q": "What does ACO stand for?",
  "a": "Ant colony optimisation. The project's version is the rank-based ant system of Bullnheimer, Hartl and Strauss (1999).",
  "source": "CLAIMS C18 to C20"
 },
 {
  "id": "q177",
  "category": "Abbreviations",
  "q": "What does RL stand for?",
  "a": "Reinforcement learning. Three published learned solvers (RRNCO, Kool's attention model and POMO) were run as released, with no training.",
  "source": "CLAIMS C11"
 },
 {
  "id": "q178",
  "category": "Abbreviations",
  "q": "What does POMO and RRNCO stand for?",
  "a": "Names of two published learned routing solvers. POMO is Kwon et al. (2020). RRNCO is Son et al. (2026), trained on real road routing matrices.",
  "source": "CLAIMS C11, research note 2026-10-18"
 },
 {
  "id": "q179",
  "category": "Abbreviations",
  "q": "What does EV, 0ev, 1ev, 2ev stand for?",
  "a": "EV is a battery-electric vehicle. 0ev, 1ev and 2ev are the repo's shorthand for a fleet of four with 0, 1 or 2 battery-electric trucks.",
  "source": "CLAIMS"
 },
 {
  "id": "q180",
  "category": "Abbreviations",
  "q": "What does NGA Factors stand for?",
  "a": "National Greenhouse Accounts Factors 2026, the Australian Government source for 2.716 kg CO2-e per litre of diesel and the upstream 0.668 kg per litre.",
  "source": "Poster, CLAIMS Well to Wheel"
 },
 {
  "id": "q181",
  "category": "Abbreviations",
  "q": "What does NSW stand for?",
  "a": "New South Wales. The NSW grid factor is 0.60 kg CO2-e per kWh, which gives the 600 to 780 g per km electric cases.",
  "source": "Poster, CLAIMS C3"
 },
 {
  "id": "q182",
  "category": "Abbreviations",
  "q": "What does NCC stand for?",
  "a": "Newcastle City Council, now the City of Newcastle.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q183",
  "category": "Abbreviations",
  "q": "What does LGA stand for?",
  "a": "Local Government Area, here the City of Newcastle boundary the requests are sampled inside.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q184",
  "category": "Abbreviations",
  "q": "What does DEM and LiDAR stand for?",
  "a": "Digital elevation model, a grid of ground heights. LiDAR is light detection and ranging, the airborne laser survey that produced the 1 m NSW model.",
  "source": "Poster, changelog B22"
 },
 {
  "id": "q185",
  "category": "Abbreviations",
  "q": "What does MEET and ATAP stand for?",
  "a": "Two published speed and emission curves used as EQ4 speed cases. MEET is the European methodology for transport emissions and energy (7.5 to 16 t trucks). ATAP is the Australian Transport Assessment and Planning guidelines (medium rigid, stop-start).",
  "source": "CLAIMS Driver, service time and speed"
 },
 {
  "id": "q186",
  "category": "Abbreviations",
  "q": "What does ABS SMVU stand for?",
  "a": "Australian Bureau of Statistics Survey of Motor Vehicle Use, the source of the 777 g per km average for rigid trucks.",
  "source": "CLAIMS C8"
 },
 {
  "id": "q187",
  "category": "Abbreviations",
  "q": "What does A12 stand for?",
  "a": "The Vargha-Delaney effect size. 0.5 means no difference between the two plans, 0 or 1 means every run of one is below every run of the other.",
  "source": "src/srcro/stats.py"
 },
 {
  "id": "q188",
  "category": "Abbreviations",
  "q": "What does KPI stand for?",
  "a": "Key performance indicator, for example tier-1 CO2-e per request.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q189",
  "category": "Abbreviations",
  "q": "What does FR and NFR stand for?",
  "a": "Functional and non-functional requirements of the Testing and Evaluation Plan, numbered FR-01 and NFR-01 and so on. For example NFR-01 is the 120 s re-plan limit.",
  "source": "Testing and Evaluation Plan, CLAIMS EQ5 timing"
 },
 {
  "id": "q190",
  "category": "Abbreviations",
  "q": "What does UT, IT, ST, NT, AT stand for?",
  "a": "Test case prefixes. Unit test, integration test, system test, non-functional test and acceptance test, for example NT-01 for re-plan timing.",
  "source": "Testing and Evaluation Plan, section 2.1"
 },
 {
  "id": "q191",
  "category": "Abbreviations",
  "q": "What does MR1 to MR4 stand for?",
  "a": "Metamorphic relations, tests that check how results must change between related runs when the true optimum is unknown. MR2 says that on four diesel trucks under tier-1 the two plans are identical.",
  "source": "Changelog 2026-09-29, CLAUDE.md"
 },
 {
  "id": "q192",
  "category": "Abbreviations",
  "q": "What does DEF stand for?",
  "a": "Defect record, a logged bug with its regression test, for example DEF-004.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q193",
  "category": "Abbreviations",
  "q": "What does RTM stand for?",
  "a": "Requirements Traceability Matrix, linking each requirement to its tests.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q194",
  "category": "Abbreviations",
  "q": "What does CI stand for?",
  "a": "Continuous integration, the automated test runs on GitHub. In statistics answers, CI can also mean confidence interval.",
  "source": "Testing and Evaluation Plan, Appendix B"
 },
 {
  "id": "q195",
  "category": "Abbreviations",
  "q": "What does B-numbers, for example B2 or B65 stand for?",
  "a": "Backlog items in the repo's docs/tasks/BACKLOG.md. Many limitations are named after the backlog item that closed them.",
  "source": "LIMITATIONS"
 },
 {
  "id": "q196",
  "category": "Abbreviations",
  "q": "What does A-numbers, for example A28 or A31 stand for?",
  "a": "Assumption IDs in the repo's parameter register, docs/ASSUMPTIONS.md, each with its value and source or the label unsourced.",
  "source": "ASSUMPTIONS"
 },
 {
  "id": "q197",
  "category": "Abbreviations",
  "q": "What does C, P and X numbers, for example C1, P2, X1 stand for?",
  "a": "IDs in the claims register, docs/CLAIMS.md. C is a confirmatory claim, P is a line on the poster, X is an exploratory result.",
  "source": "CLAIMS"
 },
 {
  "id": "q198",
  "category": "Abbreviations",
  "q": "What does H1, H-S2 and similar stand for?",
  "a": "Pre-registered hypotheses. Each campaign's hypotheses are numbered in its pre-registration file, for example H1 for the headline saving.",
  "source": "CLAIMS"
 },
 {
  "id": "q199",
  "category": "Abbreviations",
  "q": "What does AWS and vCPU stand for?",
  "a": "Amazon Web Services, where the campaigns ran, and virtual CPU, one processor thread of a cloud machine.",
  "source": "CLAUDE.md Compute"
 }
];
