+++
id = "sdlc-formal-methods"
family = "sdlc"
title = "Formal methods / Cleanroom"
source = "General SE literature (summary)"
version = "n/a"
basis = "secondary-summary"
project_types = []
sdlc_relevance = ["formal-methods"]
last_verified = "2026-10-01"
+++
Formal methods use mathematical specification and proof, or statistically driven inspection in the Cleanroom variant, to show software is correct before it runs. It fits small, safety-critical components where a defect is unacceptable and the specification is stable, such as a brake-arbitration kernel or a bootloader integrity check. It fails on large, fast-changing, or loosely specified systems because specification and proof effort grows quickly and few engineers have the skill. Typical roles: formal-methods engineer, safety manager, verification engineers, architect. Deliverables: formal specification, proofs or inspection records, and certification evidence. In automotive it is rare as a whole-project model and is usually applied to selected critical modules inside a V-shaped process.
