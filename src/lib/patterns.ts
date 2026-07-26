export type PhaseKind = "inhale" | "hold" | "exhale" | "hold-out";

export interface Phase {
  kind: PhaseKind;
  seconds: number;
}

export interface Pattern {
  id: string;
  name: string;
  /** One-line description of what the pattern is good for. */
  blurb: string;
  phases: Phase[];
}

export const PHASE_LABEL: Record<PhaseKind, string> = {
  inhale: "Inhale",
  hold: "Hold",
  exhale: "Exhale",
  "hold-out": "Hold",
};

/**
 * Per-phase colour. Inhale reads cool and bright, exhale warm and settling,
 * holds sit between them so the loop always alternates cool/warm/cool.
 */
export const PHASE_COLOR: Record<PhaseKind, string> = {
  inhale: "#5eead4",
  hold: "#a5b4fc",
  exhale: "#fbbf6f",
  "hold-out": "#8b93c7",
};

export const PATTERNS: Pattern[] = [
  {
    id: "5-5",
    name: "5-5 Breathing",
    blurb: "Even in, even out. A steady baseline — start here.",
    phases: [
      { kind: "inhale", seconds: 5 },
      { kind: "exhale", seconds: 5 },
    ],
  },
  {
    id: "square",
    name: "Square Breathing",
    blurb: "Four equal sides. Steadies the nerves before something hard.",
    phases: [
      { kind: "inhale", seconds: 4 },
      { kind: "hold", seconds: 4 },
      { kind: "exhale", seconds: 4 },
      { kind: "hold-out", seconds: 4 },
    ],
  },
  {
    id: "4-7-8",
    name: "4-7-8 Breathing",
    blurb: "A long hold and a longer exhale. Built for winding down.",
    phases: [
      { kind: "inhale", seconds: 4 },
      { kind: "hold", seconds: 7 },
      { kind: "exhale", seconds: 8 },
    ],
  },
  {
    id: "6-3",
    name: "6-3 Breathing",
    blurb: "Slow fill, quick release. Keeps you alert and unhurried.",
    phases: [
      { kind: "inhale", seconds: 6 },
      { kind: "exhale", seconds: 3 },
    ],
  },
  {
    id: "4-4-8",
    name: "4-4-8 Breathing",
    blurb: "Double-length exhale. The quickest route to calm.",
    phases: [
      { kind: "inhale", seconds: 4 },
      { kind: "hold", seconds: 4 },
      { kind: "exhale", seconds: 8 },
    ],
  },
];

export const DEFAULT_PATTERN_ID = "square";

export function getPattern(id: string): Pattern {
  return (
    PATTERNS.find((p) => p.id === id) ??
    PATTERNS.find((p) => p.id === DEFAULT_PATTERN_ID)!
  );
}

export function cycleSeconds(pattern: Pattern): number {
  return pattern.phases.reduce((sum, p) => sum + p.seconds, 0);
}
