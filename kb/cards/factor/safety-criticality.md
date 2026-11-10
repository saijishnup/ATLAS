+++
id = "factor-safety-criticality"
family = "factor"
title = "Safety criticality"
source = "General SE literature (summary)"
version = "n/a"
basis = "secondary-summary"
project_types = []
sdlc_relevance = ["v-model", "agile-v", "agile"]
last_verified = "2026-09-30"
+++
Safety criticality measures how severe the harm could be if the software fails. In automotive it is usually expressed through ASIL levels A to D, with QM meaning no safety requirement beyond normal quality management. Higher levels demand more rigorous processes: independent review, stronger verification, documented traceability, and formal safety cases. For SDLC choice, high criticality favours plan-driven, verification-heavy models such as the V-Model, while low criticality allows lighter agile approaches. When the level is unknown, treat it as unknown and ask, since it comes from a hazard analysis, not opinion. Effect on scoring: raises the fit of strong-verification models and lowers the fit of light-documentation models.
