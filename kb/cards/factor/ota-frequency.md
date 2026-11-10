+++
id = "factor-ota-frequency"
family = "factor"
title = "OTA update frequency"
source = "General SE literature (summary)"
version = "n/a"
basis = "secondary-summary"
project_types = ["ota", "telematics", "infotainment"]
sdlc_relevance = ["devsecops", "v-model"]
last_verified = "2026-09-30"
+++
OTA update frequency is how often software will be delivered to vehicles already on the road. Rare updates, such as one annual release, fit planned release cycles. Frequent updates, monthly or faster, need automated build, test, signing, and rollout pipelines, plus rollback and staged deployment. Each update also brings regulatory and cybersecurity duties, so verification evidence must be produced repeatedly, not once. High frequency favours DevOps and DevSecOps practices, while low frequency allows V-Model or Waterfall release gates. Ask how often updates ship and whether they touch safety-relevant functions. Effect on scoring: raises the fit of continuous-delivery models when frequency is high.
