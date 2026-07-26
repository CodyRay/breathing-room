"use client";

import { useEffect } from "react";

interface Sentinel {
  released: boolean;
  release: () => Promise<void>;
}

/**
 * Holds a screen wake lock while a session is running, so a long practice
 * isn't cut short by the display going to sleep. Silently does nothing where
 * the API is unavailable.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const api = (
      navigator as unknown as {
        wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
      }
    ).wakeLock;
    if (!api) return;

    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await api.request("screen");
        if (cancelled) void next.release();
        else sentinel = next;
      } catch {
        // denied, or the tab isn't visible — not worth surfacing
      }
    };

    // The lock is dropped whenever the tab is hidden; take it back on return.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && sentinel?.released !== false) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
