+++
id = "factor-hardware-dependency"
family = "factor"
title = "Hardware dependency"
source = "General SE literature (summary)"
version = "n/a"
basis = "secondary-summary"
project_types = []
sdlc_relevance = ["v-model", "mbse-v", "agile"]
last_verified = "2026-10-01"
+++
Hardware dependency is how tightly the software is bound to a specific ECU, sensor, or board. Software-only work can change freely and ship often. Tightly coupled work faces long hardware lead times, scarce test benches, and late integration, so changes after hardware freeze are costly. Hardware-in-the-loop testing and simulation matter more as dependency grows. High dependency favours V-shaped or model-based models with early interface definition, while low dependency allows agile and continuous delivery. Ask whether prototypes of the hardware exist and how often the interface changes. Effect on scoring: raises the fit of plan-driven and V-shaped models as dependency increases.
