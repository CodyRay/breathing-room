import { SOUND_PACKS, VOICE_PACKS, type SoundPackId } from "./audio";
import { DEFAULT_PATTERN_ID } from "./patterns";

export interface Settings {
  patternId: string;
  pack: SoundPackId;
  volume: number;
  keepAwake: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  patternId: DEFAULT_PATTERN_ID,
  pack: "bells",
  volume: 0.7,
  keepAwake: true,
};

const STORAGE_KEY = "breathing-room:settings";

/**
 * Preferences live in a tiny external store rather than React state so the
 * component tree can read them through `useSyncExternalStore`. That keeps the
 * server render on the defaults and lets the client swap in whatever is in
 * localStorage without a hydration mismatch or a setState-in-effect.
 */
let snapshot: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored: Settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      // A pack that has since been removed would leave the picker showing
      // nothing and the session silent, so fall back rather than trust it.
      // Voice packs count as known here even when their clips are absent —
      // whether they are *offered* is decided at build time, and the picker
      // handles the mismatch.
      const known = [...SOUND_PACKS, ...VOICE_PACKS];
      return known.some((p) => p.id === stored.pack)
        ? stored
        : { ...stored, pack: DEFAULT_SETTINGS.pack };
    }
  } catch {
    // unavailable or corrupt storage — defaults are fine
  }
  return DEFAULT_SETTINGS;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Must return a cached value: React compares snapshots by identity. */
export function getSnapshot(): Settings {
  if (snapshot === null) snapshot = read();
  return snapshot;
}

export function getServerSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}

export function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
) {
  const next = { ...getSnapshot(), [key]: value };
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked — the in-memory value still applies
  }
  for (const listener of listeners) listener();
}
