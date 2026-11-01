# Seeing Reuse: Collection Routing Optimisation, demo

A static copy of the expo demonstration for the University of Newcastle honours capstone, shown at https://srcro.aandster.me/.

It shows distance-only planning beside emissions-aware planning on 90 pre-calculated scenarios (seeds 1 to 90, fleets of 0 to 4 electric trucks), replays them day by day, animates the trucks on their planned times, and lets visitors download the planner's input and output for every run. During the expo window a live re-plan runs the real planner on a new short scenario. All requests are synthetic. Every figure on the page is descriptive and is not a pre-registered result. The tested results are on the project poster.

Files: `index.html`, `app.js`, `style.css` (the page), `presenter.html` and `presenter.js` (presenter controls and the QR code), `layers.js` (map boundary and roads), `seeds/` (one file per scenario), `raw/` (each run's `solution.json`, gzipped), `contract/` (the output contract and its JSON Schema), `vendor/` (Leaflet 1.9.4, BSD-2-Clause, and qrcode-generator, MIT).

This repository holds only the published files and is overwritten from the project's private repository.
