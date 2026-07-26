/**
 * Turns a breathing pattern into a closed loop whose silhouette *is* the
 * pattern: one vertex per phase boundary, and each phase owns a share of the
 * loop proportional to its duration.
 *
 * Construction: vertices are placed on a circle at angles proportional to
 * cumulative duration, then consecutive vertices are joined by a circular arc
 * that bulges outward. The arc's own central angle is
 * a fraction of the angle it spans on the circumcircle — at fraction 1 the arc
 * *is* the circumcircle and the shape is a plain circle with no visible
 * corners; below 1 the tangents break at each vertex and a corner appears.
 *
 * That fraction is chosen per edge so every vertex bends by roughly the same
 * visible amount, whatever the pattern. Square breathing lands on a rounded
 * square, 4-7-8 on a skewed triangle, 5-5 on a near-circle with two soft
 * points, and 6-3 on a teardrop — the 6s arc swinging wide, the 3s arc cutting
 * back across.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface LoopEdge {
  /** Index of the phase this edge represents. */
  index: number;
  /** Standalone SVG path data for just this edge. */
  d: string;
  from: Pt;
  to: Pt;
  /** Null for a degenerate edge rendered as a straight chord. */
  arc: { center: Pt; radius: number; theta1: number; dTheta: number } | null;
  /** Arc length in user units — used for dash-based progress strokes. */
  length: number;
}

export interface Loop {
  /** Closed path data for the whole loop. */
  path: string;
  edges: LoopEdge[];
  vertices: Pt[];
  viewBox: string;
  /** Centre of the view box — where the play button and breath glow sit. */
  center: Pt;
}

/**
 * Target half-bend at each vertex, in radians. Larger values make corners
 * sharper across the board; this is the single knob controlling how polygonal
 * the shapes read.
 */
const HALF_BEND = (21 * Math.PI) / 180;

const TAU = Math.PI * 2;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Node and the browser can disagree on the last bit of `Math.sin`/`Math.cos`,
 * which is enough to trip a hydration mismatch on a server-rendered SVG.
 * Rounding every emitted coordinate keeps both sides byte-identical, at a
 * resolution far below one screen pixel.
 */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function buildLoop(
  durations: number[],
  options: { radius?: number; padding?: number } = {},
): Loop {
  const R = options.radius ?? 100;
  const padding = options.padding ?? 14;
  const total = durations.reduce((a, b) => a + b, 0);

  // Vertices on the circumcircle, advancing clockwise on screen so the loop is
  // travelled the way we read a clock. The whole thing is rotated so the first
  // phase is *centred* on top rather than starting there — that lands square
  // breathing on a square sitting flat, and 5-5 on a shape with its two points
  // out to the sides, instead of both balancing on a corner.
  const start = -Math.PI / 2 - (TAU * (durations[0] / total)) / 2;
  const vertices: Pt[] = [];
  let acc = 0;
  for (const seconds of durations) {
    const angle = start + TAU * (acc / total);
    vertices.push({
      x: round(R * Math.cos(angle)),
      y: round(R * Math.sin(angle)),
    });
    acc += seconds;
  }

  const tails: string[] = [];
  const edges: LoopEdge[] = durations.map((seconds, i) => {
    const from = vertices[i];
    const to = vertices[(i + 1) % vertices.length];
    const delta = TAU * (seconds / total);

    // Shrink the arc away from the circumcircle just enough to open a corner
    // of ~HALF_BEND at each end of this edge.
    const k = clamp(1 - (2 * HALF_BEND) / delta, 0, 1);
    const psi = k * delta;

    const chord = Math.hypot(to.x - from.x, to.y - from.y);
    const moveTo = `M ${fmt(from.x)} ${fmt(from.y)} `;

    if (psi < 1e-3 || chord < 1e-6) {
      const tail = `L ${fmt(to.x)} ${fmt(to.y)}`;
      tails.push(tail);
      return {
        index: i,
        d: moveTo + tail,
        from,
        to,
        arc: null,
        length: round(chord),
      };
    }

    const radius = chord / 2 / Math.sin(psi / 2);
    const largeArc = psi > Math.PI ? 1 : 0;
    const sweep = 1; // outward bulge, travelling clockwise
    const arc = arcCenter(from, to, radius, largeArc, sweep);
    const tail =
      `A ${fmt(radius)} ${fmt(radius)} 0 ${largeArc} ${sweep} ` +
      `${fmt(to.x)} ${fmt(to.y)}`;
    tails.push(tail);

    return {
      index: i,
      d: moveTo + tail,
      from,
      to,
      arc,
      length: round(radius * Math.abs(arc.dTheta)),
    };
  });

  const path = `M ${fmt(vertices[0].x)} ${fmt(vertices[0].y)} ${tails.join(" ")} Z`;

  return { path, edges, vertices, ...bbox(edges, padding) };
}

/**
 * SVG endpoint-to-centre parametrisation, specialised to circular arcs
 * (rx === ry, no rotation). Gives us the centre and angular sweep so we can
 * evaluate points along the arc without touching the DOM.
 */
function arcCenter(
  from: Pt,
  to: Pt,
  r: number,
  largeArc: number,
  sweep: number,
) {
  const x1p = (from.x - to.x) / 2;
  const y1p = (from.y - to.y) / 2;
  const den = x1p * x1p + y1p * y1p;
  let factor = Math.sqrt(Math.max(0, (r * r - den) / den));
  if (largeArc === sweep) factor = -factor;

  const center = {
    x: factor * y1p + (from.x + to.x) / 2,
    y: -factor * x1p + (from.y + to.y) / 2,
  };

  const theta1 = Math.atan2(from.y - center.y, from.x - center.x);
  const theta2 = Math.atan2(to.y - center.y, to.x - center.x);
  let dTheta = theta2 - theta1;
  if (sweep === 1 && dTheta < 0) dTheta += TAU;
  if (sweep === 0 && dTheta > 0) dTheta -= TAU;

  return { center, radius: r, theta1, dTheta };
}

/** Point a fraction `u` of the way along an edge, at constant speed. */
export function pointOnEdge(edge: LoopEdge, u: number): Pt {
  if (!edge.arc) {
    return {
      x: round(edge.from.x + (edge.to.x - edge.from.x) * u),
      y: round(edge.from.y + (edge.to.y - edge.from.y) * u),
    };
  }
  const { center, radius, theta1, dTheta } = edge.arc;
  const angle = theta1 + dTheta * u;
  return {
    x: round(center.x + radius * Math.cos(angle)),
    y: round(center.y + radius * Math.sin(angle)),
  };
}

export function pointOnLoop(loop: Loop, phaseIndex: number, u: number): Pt {
  return pointOnEdge(loop.edges[phaseIndex], clamp(u, 0, 1));
}

function bbox(
  edges: LoopEdge[],
  padding: number,
): { viewBox: string; center: Pt } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const edge of edges) {
    for (let i = 0; i <= 32; i++) {
      const { x, y } = pointOnEdge(edge, i / 32);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  // Keep the loop centred in a square box so every pattern renders at the same
  // scale and the play button stays put between patterns.
  const half =
    Math.max(maxX - minX, maxY - minY) / 2 + padding;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    viewBox: `${fmt(cx - half)} ${fmt(cy - half)} ${fmt(half * 2)} ${fmt(half * 2)}`,
    center: { x: cx, y: cy },
  };
}

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}
