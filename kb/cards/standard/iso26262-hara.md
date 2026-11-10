+++
id = "iso26262-03"
family = "standard"
title = "ISO 26262 hazard analysis and risk assessment"
source = "ISO 26262 (own-words summary, verify against standard)"
clause = "Parts 3 and 9"
version = "ISO 26262:2018"
basis = "secondary-summary"
project_types = []
sdlc_relevance = ["v-model", "mbse-v"]
last_verified = "2026-10-01"
+++
At concept level the item is analysed for hazardous events. Each event is rated for severity, exposure, and controllability, which together give an ASIL from A to D, or QM when no safety measures beyond normal quality management are needed. For each hazardous event a safety goal is set, inheriting the ASIL. Safety goals lead to functional safety requirements, which can be allocated and, under defined rules, decomposed across independent elements. Early requirement work should therefore ask which functions can cause harm if they fail or misbehave, and mark the resulting requirements with the safety level. Summary only: verify against the standard.
