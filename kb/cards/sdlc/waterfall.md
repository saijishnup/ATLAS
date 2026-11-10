+++
id = "sdlc-waterfall"
family = "sdlc"
title = "Waterfall model"
source = "General SE literature (summary)"
version = "n/a"
basis = "secondary-summary"
project_types = []
sdlc_relevance = ["waterfall"]
last_verified = "2026-09-30"
+++
Waterfall runs phases in strict sequence: requirements, design, implementation, verification, maintenance. Each phase ends with a sign-off before the next begins. It fits work where requirements are stable and well understood, approvals are heavy, and documentation must be complete, for example a fixed-scope ECU component under a supplier contract. It fails when requirements change often, because late changes force rework of finished phases, and defects found in testing are costly to trace back. Typical roles: business analyst, architect, developers, test team, project manager. In automotive it often appears as the contractual outer shell of a supplier delivery with a frozen specification.