+++
id = "iso24089-02"
family = "standard"
title = "ISO 24089 safe update execution and recovery"
source = "ISO 24089 (own-words summary, verify against standard)"
clause = "Project level"
version = "ISO 24089:2023"
basis = "secondary-summary"
project_types = []
sdlc_relevance = ["v-model", "devsecops"]
last_verified = "2026-10-01"
+++
At project level the standard asks that an update be planned so that vehicle safety is not reduced during or after execution. This includes preconditions on vehicle state, handling of interruption or failure, and verification that the vehicle works after the update. Where updates change safety-relevant software, the usual functional-safety impact analysis applies, and the update itself must be part of the safety argument. Requirements for an OTA client should state conditions to start, behaviour on power loss, and the recovery outcome. Summary only: verify against the standard.
