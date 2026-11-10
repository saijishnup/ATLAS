import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getProject } from "../api";
import type { Project } from "../types";

/** Holds the latest project view. Every mutation returns a full view, so `run` just replaces it. */
export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);
  const lastFn = useRef<(() => Promise<Project>) | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProject(id)
      .then((p) => !cancelled && setProject(p))
      .catch((e) => !cancelled && setError(e as ApiError))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, nonce]);

  const run = useCallback(
    async (fn: () => Promise<Project>): Promise<boolean> => {
      if (inFlight.current) return false; // blocks double clicks (Review Focus 5)
      inFlight.current = true;
      lastFn.current = fn;
      setBusy(true);
      setError(null);
      try {
        setProject(await fn());
        return true;
      } catch (e) {
        const err = e as ApiError;
        setError(err);
        if (err.status === 409) getProject(id).then(setProject).catch(() => undefined); // resync to server status
        return false;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [id],
  );

  const retry = () => (lastFn.current ? void run(lastFn.current) : setNonce((n) => n + 1));

  return { project, loading, busy, error, run, retry, reload: () => setNonce((n) => n + 1), clearError: () => setError(null) };
}
