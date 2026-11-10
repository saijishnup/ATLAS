+++
id = "factor-cyber-exposure"
family = "factor"
title = "Cyber exposure"
source = "General SE literature (summary)"
version = "n/a"
basis = "secondary-summary"
project_types = []
sdlc_relevance = ["devsecops", "agile-v", "v-model"]
last_verified = "2026-10-01"
+++
Cyber exposure is how reachable the system is by an attacker. An isolated unit with no external interface has low exposure. A diagnostic port or short-range radio gives medium exposure. An internet-connected unit, or one that accepts remote commands or updates, has high exposure. Higher exposure needs threat analysis, security testing, vulnerability monitoring, and the ability to patch quickly. Security activities should be built into every release, which favours DevSecOps and V-shaped models with security gates. Effect on scoring: raises the fit of DevSecOps and security-gated models as exposure rises.
