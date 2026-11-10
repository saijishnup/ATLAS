import type { Category, Intake, LlmStatus, Meta, Priority, Project, ProjectRow, Sample } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

// Dev and single-process demo: same origin, so "". Split deploy (Vercel + Render): set VITE_API_BASE.
const BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? "").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Cannot reach the ATLAS server. If it runs on a free host it may be waking up: retry in a minute.", true);
  }
  if (!res.ok) {
    let err = { code: `http_${res.status}`, message: res.statusText || "Request failed", retryable: false };
    try {
      err = { ...err, ...(await res.json()).error };
    } catch {
      /* non-JSON error body: keep the default */
    }
    throw new ApiError(res.status, err.code, err.message, err.retryable);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const getMeta = () => request<Meta>("/meta");
export const getLlmStatus = () => request<LlmStatus>("/llm/status");
export const getSamples = () => request<Sample[]>("/samples");
export const listProjects = () => request<ProjectRow[]>("/projects");
export const getProject = (id: string) => request<Project>(`/projects/${id}`);
export const createProject = (i: Intake) => post<Project>("/projects", i);
export const clarify = (id: string) => post<Project>(`/projects/${id}/clarify`);
export const draft = (id: string) => post<Project>(`/projects/${id}/draft`);
export const runSdlc = (id: string) => post<Project>(`/projects/${id}/sdlc`);
export const answer = (id: string, answers: { id: number; answer: string | null }[], more: boolean) =>
  post<Project>(`/projects/${id}/answers`, { answers, more });

export interface ReqPatch {
  action: "accept" | "reject" | "edit";
  statement?: string;
  priority?: Priority;
  acceptance_criteria?: string;
  categories?: Category[];
}
// seq is the integer sequence number, NOT the "REQ-001" display id
export const patchRequirement = (id: string, seq: number, body: ReqPatch) =>
  request<Project>(`/projects/${id}/requirements/${seq}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteProject = (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" });
export const exportUrl = (id: string, format: "json" | "md") => `${BASE}/api/projects/${id}/export?format=${format}`;

export const importProject = (text: string) =>
  request<Project & { import_notes?: string[] }>("/projects/import", { method: "POST", body: text });

/** The JSON export is also the project file: used for the browser copy. */
export async function fetchProjectFile(id: string): Promise<string> {
  const res = await fetch(exportUrl(id, "json"));
  if (!res.ok) throw new Error(`export ${res.status}`);
  return res.text();
}

export async function pingHealth(): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    return (await fetch(`${BASE}/api/health`, { signal: ctl.signal })).ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
