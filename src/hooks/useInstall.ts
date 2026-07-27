"use client";

import { useCallback, useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    /** Captured by the inline script in the root layout. */
    __installPrompt: InstallPromptEvent | null;
    __installed: boolean;
  }
}

export type InstallState =
  /** Already running from the home screen. */
  | "installed"
  /** Chromium has offered us a prompt to replay. */
  | "ready"
  /** iOS Safari can install, but only the user can start it. */
  | "manual"
  /** No install path here — desktop Firefox, or the prompt is spent. */
  | "unavailable";

/** Fired by the inline capture script whenever the install picture changes. */
function subscribe(onChange: () => void) {
  const display = window.matchMedia("(display-mode: standalone)");
  window.addEventListener("installstatechange", onChange);
  display.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("installstatechange", onChange);
    display.removeEventListener("change", onChange);
  };
}

/** Returns a primitive, so React can compare snapshots without allocating. */
function getSnapshot(): "installed" | "ready" | "none" {
  if (
    window.__installed ||
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return "installed";
  }
  return window.__installPrompt ? "ready" : "none";
}

function noSubscribe() {
  return () => {};
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const serverNone = () => "none" as const;
const serverFalse = () => false;

/**
 * Wraps the install flow, which is frustratingly uneven across browsers.
 *
 * Chromium fires `beforeinstallprompt`, which must be captured and can be
 * replayed later from a user gesture — that's what lets the button live in
 * Settings rather than appearing as an unbidden banner. The capture happens in
 * the root layout, early enough not to race hydration; this hook only reads it.
 *
 * iOS Safari fires nothing and exposes no API: adding to the home screen is
 * strictly a manual Share-sheet action, so all we can do there is say so.
 *
 * Everything is read through `useSyncExternalStore` because all of it is
 * browser-only state that the server must render as absent.
 */
export function useInstall(): {
  state: InstallState;
  install: () => Promise<void>;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, serverNone);
  const ios = useSyncExternalStore(noSubscribe, isIos, serverFalse);

  const install = useCallback(async () => {
    const prompt = window.__installPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event is single-use whatever the answer.
    window.__installPrompt = null;
    if (outcome === "accepted") window.__installed = true;
    window.dispatchEvent(new Event("installstatechange"));
  }, []);

  const state: InstallState =
    snapshot === "none" ? (ios ? "manual" : "unavailable") : snapshot;

  return { state, install };
}
