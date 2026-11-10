+++
id = "sdlc-v-model"
family = "sdlc"
title = "V-Model"
source = "General SE literature (summary)"
version = "n/a"
basis = "secondary-summary"
project_types = []
sdlc_relevance = ["v-model"]
last_verified = "2026-09-30"
+++
The V-Model pairs every development phase on the left with a test phase on the right: requirements with acceptance testing, system design with system testing, software design with integration testing, and code with unit testing. Verification and validation are planned early, alongside each design level. It fits safety-critical and regulated work where traceability from requirement to test evidence is mandatory, which is why functional-safety processes in automotive are commonly drawn as a V. It struggles when requirements shift often, since every change ripples through the paired artefacts. Typical roles: system engineer, software architect, developers, verification engineers, safety manager, assessor. Deliverables include test specifications linked to each requirement level.