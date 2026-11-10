import { useEffect, useState } from "react";
import { ApiError, getMeta } from "../api";
import type { Meta } from "../types";

let cache: Promise<Meta> | null = null; // meta never changes while the server runs

export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    cache ??= getMeta();
    cache.then(setMeta).catch((e) => {
      cache = null;
      setError(e as ApiError);
    });
  }, [nonce]);
  return { meta, error, retry: () => { setError(null); setNonce((n) => n + 1); } };
}
