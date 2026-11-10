// Single source of wording: used by <Info id="..."/> popovers and by the guided tour.
export interface Help {
  title: string;
  body: string;
}

export const help: Record<string, Help> = {
  name: { title: "Project name", body: "A short label to find this project later. It is only used inside ATLAS and in the export." },
  type: {
    title: "Project type",
    body: "The kind of automotive software you are planning. It steers which knowledge cards are searched and which follow-up questions come first. Pick Other if nothing fits.",
  },
  description: {
    title: "Description",
    body: "Three to five sentences: what the software does, which vehicle systems it talks to, who uses it and any rules it must meet. Requirements are quoted from this text, so concrete detail helps. Minimum 40 characters.",
  },
  traits: {
    title: "Project traits",
    body: "Eight quick facts about the project. They feed the SDLC score directly. Choose Not sure when you do not know: the factor then counts as neutral and is shown as not stated.",
  },
  sample: {
    title: "Sample projects",
    body: "Load a ready-made automotive project into the form. You can edit every field before saving.",
  },
  trait_safety_level: {
    title: "Safety criticality",
    body: "How bad is a software failure? Low means no safety function (QM). Medium maps to ASIL A-B, High to ASIL C-D under ISO 26262. Higher levels favour plan-driven, verification-heavy lifecycles.",
  },
  trait_requirement_stability: {
    title: "Requirement stability",
    body: "How likely the requirements are to change. High means frozen or rarely changing. Low means frequent or large changes. Changing requirements favour iterative lifecycles.",
  },
  trait_hardware_dependency: {
    title: "Hardware dependency",
    body: "How tightly the software is tied to specific ECUs, sensors or silicon. High dependency slows iteration because hardware samples gate progress.",
  },
  trait_regulatory_audit: {
    title: "Regulatory audit burden",
    body: "How much formal evidence assessors or type approval will demand, for example UNECE R155 and R156. High burden favours lifecycles with documented gates.",
  },
  trait_ota_frequency: {
    title: "OTA update frequency",
    body: "How often you expect to ship software to vehicles in the field. Frequent updates favour continuous delivery and DevSecOps style pipelines.",
  },
  trait_connectivity: {
    title: "Cyber exposure",
    body: "How exposed the software is to external networks (offline, occasionally connected, always connected). More exposure means more cybersecurity work. Cybersecurity requirements you accept can raise this factor later, and the change is shown, never silent.",
  },
  trait_team_size: {
    title: "Team size",
    body: "Low is a handful of people, High is many teams or organisations. Larger teams need more coordination structure.",
  },
  trait_timeline_pressure: {
    title: "Timeline pressure",
    body: "How tight the schedule is. High pressure favours short feedback loops and incremental delivery over long up-front planning.",
  },
  q_why: {
    title: "Why we ask",
    body: "Each question comes from a gap in your form or description. The line under it says what the answer will change.",
  },
  q_skip: {
    title: "Skipping a question",
    body: "Skip when you do not know. A skipped question is treated as Not sure and is not asked again.",
  },
  req_list: {
    title: "Requirement list",
    body: "Drafted requirements in the order they were produced. Select one to see its detail. Status shows whether you have accepted, edited or rejected it.",
  },
  req_flags: {
    title: "Quality flags",
    body: "Automatic checks: vague wording, acceptance criteria with nothing measurable, duplicates, conflicts, a missing source quote, or a safety, cyber or regulatory requirement without a knowledge citation. Flags are advice; you decide.",
  },
  req_citations: {
    title: "Citations",
    body: "Knowledge cards that support the requirement. Cards marked summary are own-words summaries of paid standards: verify against the standard itself. No citation means nothing in the knowledge base backed it up.",
  },
  req_confidence: {
    title: "Confidence",
    body: "A heuristic, not the model's own opinion: 0.5 x best card similarity + 0.3 x citations found (max 3) + 0.2 if the source quote was found in your text. High is 0.7 or more, Low is under 0.4.",
  },
  req_actions: {
    title: "Accept, edit, reject",
    body: "Only accepted and edited requirements feed the SDLC analysis. Editing keeps the original text on record. You can change your mind later: SDLC results are then marked stale.",
  },
  sdlc_top: {
    title: "Recommendation",
    body: "The score comes from a fixed fit matrix and your factors, so the same input always gives the same ranking. The language model only explains it and cannot change the order.",
  },
  sdlc_factors: {
    title: "Factors",
    body: "User-stated means you chose it. Inferred means ATLAS raised it from your accepted requirements. Not sure counts as neutral. A conflict badge suggests a different value but never changes yours.",
  },
  sdlc_compare: {
    title: "Compare models",
    body: "Tick two models in the ranking to see how each fits every factor, side by side.",
  },
  tie_rule: {
    title: "Tie rule",
    body: "Models whose scores are within 2 points of each other are treated as tied. Ties are ordered by lifecycle family (plan-driven first when safety is ASIL C or higher, agile first otherwise), then alphabetically. So a slightly lower score can rank higher.",
  },
  matrix_note: {
    title: "About the fit matrix",
    body: "The fit values were written by the project author from SDLC knowledge cards. They are expert judgement, not an empirical benchmark. Treat the ranking as a structured starting point for discussion.",
  },
  export_download: {
    title: "Download",
    body: "JSON is the project file: it keeps everything and can be reopened later from the project list. Markdown is a readable report. Save as PDF prints the report through your browser. All include requirements, citations, flags, the SDLC result, the model used and the knowledge base version.",
  },
};
