"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which is what makes the app installable and
 * lets a session run with no connection at all.
 *
 * Production only: a worker caching assets in front of the dev server makes
 * for very confusing hot reloads.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Unsupported or blocked — the app works fine without it.
      });
    };
    // Registration competes with the first paint for bandwidth otherwise.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
