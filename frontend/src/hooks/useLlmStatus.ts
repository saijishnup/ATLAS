import { useEffect, useState } from "react";
import { getLlmStatus } from "../api";
import type { LlmStatus } from "../types";

let cache: Promise<LlmStatus | "down"> | null = null; // one fetch per page load, shared by every component

/** null while loading, "down" if the server cannot be reached. */
export function useLlmStatus(): LlmStatus | "down" | null {
  const [s, setS] = useState<LlmStatus | "down" | null>(null);
  useEffect(() => {
    cache ??= getLlmStatus().catch(() => "down" as const);
    cache.then(setS);
  }, []);
  return s;
}

export const localHint = (s: LlmStatus | "down" | null) =>
  s && s !== "down" && s.mode === "local" ? "Local model: this can take a few minutes." : undefined;
