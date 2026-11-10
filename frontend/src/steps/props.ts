import type { Project } from "../types";

export interface StepProps {
  project: Project;
  run: (fn: () => Promise<Project>) => Promise<boolean>;
  busy: boolean;
}
