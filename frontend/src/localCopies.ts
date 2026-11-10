import type { Status } from "./types";

// Browser copy of each project's export JSON, so a reset server can be refilled via POST /api/projects/import.
const KEY = "atlas.copies.v1";
const MAX = 10; // localStorage is ~5 MB per origin; an export is tens of KB

export interface Copy {
  id: string;
  name: string;
  status: Status;
  savedAt: string;
  file: string;
}

export function listCopies(): Copy[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(list: Copy[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // blocked or full: copies are a convenience, never an error
  }
}

export function saveCopy(c: Copy) {
  let list = [c, ...listCopies().filter((x) => x.id !== c.id)].slice(0, MAX);
  while (!write(list) && list.length > 1) list = list.slice(0, -1); // quota: drop the oldest
}

export function dropCopy(id: string) {
  write(listCopies().filter((c) => c.id !== id));
}
