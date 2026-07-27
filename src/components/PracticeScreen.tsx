"use client";

import Link from "next/link";
import { useState } from "react";
import { SessionPanel } from "@/components/SessionPanel";
import { Sheet } from "@/components/Sheet";
import { useInstall } from "@/hooks/useInstall";
import { useSettings } from "@/hooks/useSettings";
import { SOUND_PACKS, type SoundPack, type SoundPackId } from "@/lib/audio";

export function PracticeScreen({ voicePacks }: { voicePacks: SoundPack[] }) {
  const { pattern, pack, volume, keepAwake, set } = useSettings();
  const [panel, setPanel] = useState<"info" | "settings" | null>(null);
  const install = useInstall();

  const packs = [...SOUND_PACKS, ...voicePacks];
  // A stored pack whose clips have since gone would leave the picker blank and
  // the session silent, so fall back to the first that exists.
  const current = packs.some((p) => p.id === pack) ? pack : packs[0].id;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-4 pb-8">
      <header className="flex items-center justify-between">
        <IconButton label="About" onClick={() => setPanel("info")}>
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
          <path
            d="M12 10.6v6M12 7.4v.9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </IconButton>
        <IconButton label="Settings" onClick={() => setPanel("settings")}>
          <circle
            cx="12"
            cy="12"
            r="3.2"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
          <path
            d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.65 5.35l-1.84 1.84M7.19 16.81l-1.84 1.84M18.65 18.65l-1.84-1.84M7.19 7.19L5.35 5.35"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </IconButton>
      </header>

      <div className="mt-6 space-y-3">
        <label className="block">
          <span className="sr-only">Audio signal</span>
          <div className="relative">
            <select
              value={current}
              onChange={(e) => set("pack", e.target.value as SoundPackId)}
              className="w-full appearance-none rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-base text-slate-100 transition hover:border-white/25 focus:border-white/40 focus:outline-none"
            >
              {packs.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900">
                  {p.name}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <path d="M7 10l5 5 5-5z" fill="currentColor" />
            </svg>
          </div>
        </label>

        <Link
          href="/patterns"
          className="flex w-full items-center justify-between rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-base text-slate-100 transition hover:border-white/25"
        >
          {pattern.name}
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-slate-400"
            aria-hidden
          >
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      </div>

      <SessionPanel
        key={pattern.id}
        pattern={pattern}
        pack={current}
        volume={volume}
        keepAwake={keepAwake}
      />

      <Sheet
        open={panel === "info"}
        title="Breathing Room"
        onClose={() => setPanel(null)}
      >
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <p>
            Each pattern is drawn as a closed loop. Every side is one phase of
            the breath, and its length is proportional to how long that phase
            lasts — so square breathing comes out square, and 4-7-8 leans hard
            into its long exhale.
          </p>
          <p>
            The dot travels the loop in real time. Breathe with it: in along the
            first side, hold where the loop turns, out along the next.
          </p>
          <p className="text-slate-400">
            <span className="text-slate-200">Bells</span> strikes once at every
            corner, a different voice for each phase — a bright bell to breathe
            in, a short tap to hold, a low gong to breathe out.{" "}
            <span className="text-slate-200">MIDI</span> adds a beat for each
            second inside a phase, walking up the scale as you breathe in and
            back down as you breathe out.
          </p>
          <p className="text-slate-400">
            <span className="text-slate-200">Trek</span> holds one note of a
            rising fanfare wide across each phase.{" "}
            <span className="text-slate-200">Crescendo</span> swells as you
            breathe in, sits level while you hold and subsides as you breathe
            out — the volume never jumps at a corner, so listen for the chord
            moving underneath instead.
          </p>
          <p className="text-slate-400">
            <span className="text-slate-200">Ocean</span> is surf on the same
            contour: it rolls in and brightens as you breathe in, and draws
            back as you go out. The <span className="text-slate-200">Voice</span>{" "}
            packs simply say it: in, hold, out.
          </p>
          <p className="text-slate-500">
            Space starts and stops. Stopping rewinds to the top of the cycle.
          </p>
        </div>
      </Sheet>

      <Sheet
        open={panel === "settings"}
        title="Settings"
        onClose={() => setPanel(null)}
      >
        <div className="space-y-6">
          <label className="block">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-slate-200">Volume</span>
              <span className="text-slate-500 tabular-nums">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => set("volume", Number(e.target.value))}
              className="w-full accent-teal-300"
            />
          </label>

          <label className="flex items-start justify-between gap-4">
            <span className="text-sm">
              <span className="block text-slate-200">Keep screen awake</span>
              <span className="block text-slate-500">
                Hold the display on while a session runs.
              </span>
            </span>
            <input
              type="checkbox"
              checked={keepAwake}
              onChange={(e) => set("keepAwake", e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-teal-300"
            />
          </label>

          {install.state !== "unavailable" && (
            <div className="border-t border-white/10 pt-5">
              <div className="mb-2 text-sm text-slate-200">Add to home screen</div>
              {install.state === "ready" && (
                <>
                  <p className="mb-3 text-sm text-slate-500">
                    Install it and it opens full screen, with no browser bar —
                    and works with no connection at all.
                  </p>
                  <button
                    type="button"
                    onClick={() => void install.install()}
                    className="w-full rounded-xl border border-teal-300/30 bg-teal-300/10 px-4 py-2.5 text-sm text-teal-200 transition hover:bg-teal-300/20"
                  >
                    Install Breathing Room
                  </button>
                </>
              )}
              {install.state === "manual" && (
                <p className="text-sm text-slate-500">
                  Tap the <span className="text-slate-300">Share</span> button
                  below, then{" "}
                  <span className="text-slate-300">Add to Home Screen</span>.
                  Safari has no way for an app to open that for you.
                </p>
              )}
              {install.state === "installed" && (
                <p className="text-sm text-slate-500">
                  Installed — you&rsquo;re running it from the home screen.
                </p>
              )}
            </div>
          )}

          <p className="border-t border-white/10 pt-4 text-xs text-slate-500">
            {packs.find((p) => p.id === current)?.blurb}
          </p>
        </div>
      </Sheet>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full p-2 text-slate-400 transition hover:bg-white/8 hover:text-slate-100"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
