"use client";

import { useEffect } from "react";
import { BreathLoop } from "@/components/BreathLoop";
import { useBreathSession } from "@/hooks/useBreathSession";
import { useWakeLock } from "@/hooks/useWakeLock";
import type { SoundPackId } from "@/lib/audio";
import { PHASE_COLOR, PHASE_LABEL, type Pattern } from "@/lib/patterns";

/**
 * Everything that belongs to a single run of a pattern. Mounted with the
 * pattern id as its key, so choosing a different pattern starts a clean
 * session instead of dragging the old clock along.
 */
export function SessionPanel({
  pattern,
  pack,
  volume,
  keepAwake,
}: {
  pattern: Pattern;
  pack: SoundPackId;
  volume: number;
  keepAwake: boolean;
}) {
  const session = useBreathSession(pattern, pack, volume);
  useWakeLock(session.running && keepAwake);

  const { toggle } = session;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      // Let the space bar do its normal job inside controls.
      if (tag && ["INPUT", "SELECT", "BUTTON", "TEXTAREA", "A"].includes(tag)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const phase = pattern.phases[session.index];
  const color = PHASE_COLOR[phase.kind];

  return (
    <div className="flex flex-1 flex-col">
      {/* Loop and phase read-out ride together, centred in whatever space is
          left between the pickers above and the hint below. */}
      <div className="my-auto pt-9">
        <BreathLoop
          pattern={pattern}
          phaseIndex={session.index}
          u={session.u}
          running={session.running}
          onToggle={session.toggle}
        />

        <div className="mt-8 text-center">
          <div
            className="text-2xl font-light tracking-[0.24em] uppercase"
            style={{ color }}
          >
            {PHASE_LABEL[phase.kind]}
          </div>
          <div className="mt-1 text-sm text-slate-500 tabular-nums">
            {session.remaining}s
          </div>
        </div>
      </div>

      {/* Kept in the layout while running, just faded, so starting a session
          doesn't shift everything above it. */}
      <div
        className={`pt-8 text-center text-xs tracking-[0.16em] text-slate-600 uppercase transition-opacity ${
          session.running ? "opacity-0" : "opacity-100"
        }`}
      >
        Press play, then follow the dot
      </div>
    </div>
  );
}
