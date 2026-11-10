import { useEffect, useState } from "react";
import { pingHealth } from "../api";

/** Polls /api/health until it answers. `slow` turns on after 1.2 s so a fast server never flashes the wake screen. */
export function useBackendReady() {
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let stop = false;
    let retry: number | undefined;
    const t0 = Date.now();
    const slowTimer = window.setTimeout(() => setSlow(true), 1200);
    const tick = window.setInterval(() => setSeconds(Math.floor((Date.now() - t0) / 1000)), 1000);
    const attempt = async () => {
      if (await pingHealth()) {
        if (!stop) setReady(true);
      } else if (!stop) {
        retry = window.setTimeout(attempt, 3000);
      }
    };
    void attempt();
    return () => {
      stop = true;
      clearTimeout(slowTimer);
      clearTimeout(retry);
      clearInterval(tick);
    };
  }, []);

  return { ready, slow, seconds };
}
