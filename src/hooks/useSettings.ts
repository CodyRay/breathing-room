"use client";

import { useSyncExternalStore } from "react";
import { getPattern, type Pattern } from "@/lib/patterns";
import {
  getServerSnapshot,
  getSnapshot,
  setSetting,
  subscribe,
  type Settings,
} from "@/lib/settings";

export function useSettings(): Settings & {
  pattern: Pattern;
  set: typeof setSetting;
} {
  const settings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return {
    ...settings,
    pattern: getPattern(settings.patternId),
    set: setSetting,
  };
}
