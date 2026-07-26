import { useMemo } from "react";
import { buildLoop } from "@/lib/geometry";
import { PHASE_COLOR, type Pattern } from "@/lib/patterns";

/**
 * Miniature of the same loop the practice screen draws, used as each pattern's
 * icon. Every pattern gets a distinct silhouette for free.
 */
export function PatternGlyph({
  pattern,
  size = 44,
}: {
  pattern: Pattern;
  size?: number;
}) {
  const loop = useMemo(
    () => buildLoop(pattern.phases.map((p) => p.seconds), { padding: 18 }),
    [pattern],
  );

  return (
    <svg
      viewBox={loop.viewBox}
      width={size}
      height={size}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      {loop.edges.map((edge) => (
        <path
          key={edge.index}
          d={edge.d}
          fill="none"
          stroke={PHASE_COLOR[pattern.phases[edge.index].kind]}
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.9}
        />
      ))}
      {loop.vertices.map((v, i) => (
        <circle key={i} cx={v.x} cy={v.y} r={8} fill="#f8fafc" />
      ))}
    </svg>
  );
}
