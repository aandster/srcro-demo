# Seeing Reuse: Collection Routing Optimisation, demo site copy

A static copy of the demonstration site of the University of Newcastle honours capstone "Seeing Reuse: Collection Routing Optimisation" (2026), served by GitHub Pages at https://aandster.github.io/srcro-demo/.

It shows distance-only planning beside emissions-aware planning on 90 pre-calculated scenarios (seeds 1 to 90, fleets of 0 to 4 electric trucks), replays them day by day and lets visitors download the planner's input and output for every run. All requests are synthetic. Every figure on the site is descriptive and is not a pre-registered result. The tested results are on the poster.

The live planner of the original AWS site (https://srcro.aandster.me/, until 31 December 2026) is not part of this copy. To run the real planner, use the project repository's `scripts/handover/quickstart.sh`.

Files: the pages (`*.html`, `*.js`, `*.css`), `seeds/` (one file per scenario), `raw/` (each run's `solution.json`, gzipped), `contract/` (the output contract and its JSON Schema), `vendor/` (Leaflet 1.9.4, BSD-2-Clause, and qrcode-generator, MIT), `poster.pdf`.

This repository holds only published files. It is refreshed from the project repository with `scripts/handover/publish_pages_copy.sh`, page files from commit 8cc38dc.
