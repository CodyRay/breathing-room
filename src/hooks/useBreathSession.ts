"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BreathAudio, type BeatEvent, type SoundPackId } from "@/lib/audio";
import { cycleSeconds, type Pattern } from "@/lib/patterns";

/** How far ahead of the audio clock we schedule, in seconds. */
const LOOKAHEAD = 0.2;
/** How often the scheduler wakes up, in milliseconds. */
const SCHEDULER_TICK = 25;

export interface PhasePosition {
  index: number;
  /** 0..1 through the current phase. */
  u: number;
  /** Seconds left in the current phase, rounded up for display. */
  remaining: number;
}

export interface BreathSession extends PhasePosition {
  running: boolean;
  /** Start from the top, or stop and rewind there. */
  toggle: () => void;
}

function buildEvents(pattern: Pattern): BeatEvent[] {
  const events: BeatEvent[] = [];
  let at = 0;
  pattern.phases.forEach((phase, phaseIndex) => {
    const beatsInPhase = Math.max(0, Math.ceil(phase.seconds) - 1);
    const common = {
      kind: phase.kind,
      phaseIndex,
      seconds: phase.seconds,
      beatsInPhase,
    };
    events.push({ ...common, at, beat: 0 });
    for (let beat = 1; beat <= beatsInPhase; beat++) {
      events.push({ ...common, at: at + beat, beat });
    }
    at += phase.seconds;
  });
  return events;
}

function phaseAt(pattern: Pattern, cycleTime: number): PhasePosition {
  let start = 0;
  for (let i = 0; i < pattern.phases.length; i++) {
    const seconds = pattern.phases[i].seconds;
    if (cycleTime < start + seconds || i === pattern.phases.length - 1) {
      const into = Math.min(seconds, Math.max(0, cycleTime - start));
      return {
        index: i,
        u: into / seconds,
        remaining: Math.max(1, Math.ceil(seconds - into)),
      };
    }
    start += seconds;
  }
  return { index: 0, u: 0, remaining: pattern.phases[0].seconds };
}

/**
 * Drives one practice session.
 *
 * Stopping rewinds to the top of the cycle rather than banking a position, so
 * there is only ever one clock to reason about: while running, elapsed time is
 * read straight off the audio clock; while stopped, it is zero. Nothing has to
 * be resumed mid-phase.
 *
 * `pattern` is fixed for the lifetime of the hook — callers remount with a new
 * key to switch patterns, so there is no half-finished cycle to migrate onto a
 * beat grid that no longer fits it.
 */
export function useBreathSession(
  pattern: Pattern,
  pack: SoundPackId,
  volume: number,
): BreathSession {
  // Lazy state initialiser, not a ref: gives one stable instance per session
  // without touching a ref during render. The constructor is inert — no
  // AudioContext exists until the first user gesture calls resume().
  const [audio] = useState(() => new BreathAudio());

  const total = useMemo(() => cycleSeconds(pattern), [pattern]);
  const events = useMemo(() => buildEvents(pattern), [pattern]);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  /** Audio-clock time that `elapsed === 0` maps to while running. */
  const originRef = useRef(0);
  /** Elapsed value up to which audio has already been scheduled. */
  const cursorRef = useRef(-1e-6);

  useEffect(() => {
    audio.setVolume(volume);
  }, [audio, volume]);

  // Silence anything still queued when the session unmounts.
  useEffect(() => () => audio.stopAll(), [audio]);

  // Visual clock. Reads the same audio clock the scheduler uses, so the marker
  // can never drift away from the sound.
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      setElapsed(audio.currentTime - originRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audio, running]);

  // Audio scheduler. Queues every beat that falls inside the lookahead window
  // with a precise start time, which keeps timing steady even when the main
  // thread stalls.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const horizon = audio.currentTime - originRef.current + LOOKAHEAD;
      let cursor = cursorRef.current;
      for (let guard = 0; guard < 256; guard++) {
        const cycle = Math.floor(cursor / total);
        const withinCycle = cursor - cycle * total;
        let next = events.find((e) => e.at > withinCycle);
        let nextElapsed: number;
        if (next) {
          nextElapsed = cycle * total + next.at;
        } else {
          next = events[0];
          nextElapsed = (cycle + 1) * total + next.at;
        }
        if (nextElapsed > horizon) break;
        audio.play(
          pack,
          next,
          Math.max(audio.currentTime, originRef.current + nextElapsed),
        );
        cursor = nextElapsed + 1e-6;
      }
      cursorRef.current = cursor;
    }, SCHEDULER_TICK);
    return () => window.clearInterval(id);
  }, [audio, events, pack, running, total]);

  const toggle = useCallback(() => {
    if (running) {
      // Stop, don't pause: the position is thrown away, not banked.
      audio.stopAll();
      setRunning(false);
      setElapsed(0);
      return;
    }
    void audio.resume().then(async (ctx) => {
      // Voice packs read clips from disk; load them before the clock starts so
      // the first cue isn't missed while it downloads.
      await audio.prime(pack);
      originRef.current = ctx.currentTime;
      cursorRef.current = -1e-6;
      setElapsed(0);
      setRunning(true);
    });
  }, [audio, pack, running]);

  return {
    ...phaseAt(pattern, elapsed % total),
    running,
    toggle,
  };
}
