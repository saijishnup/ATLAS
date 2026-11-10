import type { ProjectType, Status } from "./types";

export const statusLabel: Record<Status, string> = {
  intake: "Described",
  clarifying: "Clarifying",
  drafting: "Ready to draft",
  review: "In review",
  done: "Analysed",
};

export const typeLabel: Record<ProjectType, string> = {
  adas: "ADAS",
  infotainment: "Infotainment",
  ota: "OTA updater",
  bms: "Battery management",
  telematics: "Telematics",
  diagnostics: "Diagnostics",
  other: "Other",
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export const pct = (n: number) => `${Math.round(n * 100)}%`;
