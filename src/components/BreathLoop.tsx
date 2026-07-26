"use client";

import { useId, useMemo } from "react";
import { buildLoop, pointOnLoop } from "@/lib/geometry";
import { PHASE_COLOR, PHASE_LABEL, type Pattern, type PhaseKind } from "@/lib/patterns";

/** How full the lungs are, 0..1, part-way through a phase. */
function fullness(kind: PhaseKind, u: number): number {
  switch (kind) {
    case "inhale":
      return u;
    case "exhale":
      return 1 - u;
    case "hold":
      return 1;
    case "hold-out":
      return 0;
  }
}

export function BreathLoop({
  pattern,
  phaseIndex,
  u,
  running,
  onToggle,
}: {
  pattern: Pattern;
  phaseIndex: number;
  u: number;
  running: boolean;
  onToggle: () => void;
}) {
  const uid = useId();
  const loop = useMemo(
    () => buildLoop(pattern.phases.map((p) => p.seconds)),
    [pattern],
  );

  const marker = pointOnLoop(loop, phaseIndex, u);
  const kind = pattern.phases[phaseIndex].kind;
  const color = PHASE_COLOR[kind];
  const breath = fullness(kind, u);

  return (
    <div className="relative isolate mx-auto aspect-square w-full max-w-[19rem]">
      <svg viewBox={loop.viewBox} className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id={`${uid}-breath`}>
            <stop offset="0%" stopColor={color} stopOpacity={0.34} />
            <stop offset="65%" stopColor={color} stopOpacity={0.08} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </radialGradient>
          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Lung fullness, as a glow that swells and subsides under the loop. */}
        <circle
          cx={loop.center.x}
          cy={loop.center.y}
          r={46 + breath * 62}
          fill={`url(#${uid}-breath)`}
        />

        {/* The loop itself: dim ahead of the marker, lit behind it. */}
        {loop.edges.map((edge) => {
          const phase = pattern.phases[edge.index];
          const done = edge.index < phaseIndex;
          return (
            <path
              key={`base-${edge.index}`}
              d={edge.d}
              fill="none"
              stroke={PHASE_COLOR[phase.kind]}
              strokeWidth={5}
              strokeLinecap="round"
              opacity={done ? 0.55 : 0.16}
            />
          );
        })}

        {/* The travelling stroke: the active edge drawn in as it is breathed. */}
        <path
          d={loop.edges[phaseIndex].d}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={loop.edges[phaseIndex].length}
          strokeDashoffset={loop.edges[phaseIndex].length * (1 - u)}
          filter={`url(#${uid}-glow)`}
        />

        {loop.vertices.map((v, i) => (
          <circle
            key={`vertex-${i}`}
            cx={v.x}
            cy={v.y}
            r={i === phaseIndex ? 7 : 5.5}
            fill={i <= phaseIndex ? PHASE_COLOR[pattern.phases[i].kind] : "#475569"}
          >
            {/* One interpolated string, not several children: adjacent text
                nodes get comment separators that don't survive the SVG parse
                and show up as a hydration mismatch. */}
            <title>{`${PHASE_LABEL[pattern.phases[i].kind]} · ${pattern.phases[i].seconds}s`}</title>
          </circle>
        ))}

        <circle
          cx={marker.x}
          cy={marker.y}
          r={9}
          fill="#f8fafc"
          filter={`url(#${uid}-glow)`}
        />
      </svg>

      <button
        type="button"
        onClick={onToggle}
        aria-label={running ? "Stop" : "Start"}
        className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-slate-950/70 text-slate-100 backdrop-blur-sm transition hover:border-white/35 hover:bg-slate-900/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current active:scale-95"
        style={{ color }}
      >
        {running ? (
          <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
            <rect x="5.5" y="5.5" width="13" height="13" rx="2.4" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" aria-hidden>
            <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}
