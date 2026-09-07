import { MAP_W, MAP_H, GEORGIA_PATH, project } from "@/lib/georgia-outline";

export interface RoutePoint {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  /** 1-based day this point belongs to, for the label under the pin. */
  day: number;
  /** Where the name sits relative to the dot, from the curated table. */
  labelPos?: "top" | "bottom" | "left" | "right";
}

/**
 * The plan, drawn on the country.
 *
 * A list of place names tells you the order; it does not tell you that
 * Kutaisi and Mestia are a mountain range apart, or that a Kakheti day
 * doubles back east. Seeing the shape is most of the value of an itinerary,
 * which is why CR-2026-0011 item 17 asked for it.
 *
 * Deliberately plain. The last map on this site drew relief as contour lines
 * and read as a rendering fault rather than terrain, so this is an outline, a
 * line through the stops, and numbered dots — nothing that has to be decoded.
 * The country outline and its projection were written for that map and have
 * been sitting in lib/georgia-outline.ts unused ever since.
 *
 * No dependency and no tiles: it is one path from a constant, so it costs
 * nothing to load and works with images blocked.
 */
export function RouteMap({ points, label }: { points: RoutePoint[]; label: string }) {
  /*
   * The line follows every leg; the dots are drawn once per place.
   *
   * A week-long plan sleeps in Tbilisi after most day trips, so the sequence
   * returns there four times. Drawing a dot per visit stacked four identical
   * circles and four labels on the same coordinate — legible as a smudge and
   * nothing else. Collapsing only consecutive repeats did not help, because
   * the repeats are not consecutive.
   *
   * So the polyline keeps the full order, which is what shows the out-and-back
   * shape of a real itinerary, and each place gets one numbered dot at the
   * first day it appears.
   */
  const path = points.map((p) => {
    const [x, y] = project(p.lon, p.lat);
    return { ...p, x, y };
  });
  const seen = new Set<string>();
  const xy = path.filter((p) => !seen.has(p.slug) && seen.add(p.slug));
  if (xy.length < 2) return null;

  const line = path.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <figure className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="block w-full"
        role="img"
        aria-label={label}
      >
        <path d={GEORGIA_PATH} className="fill-ink-100 stroke-ink-200" strokeWidth={1.5} />

        {/* Drawn under the dots so the line never crosses a number. */}
        <polyline
          points={line}
          fill="none"
          className="stroke-brand-600"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1 7"
        />

        {xy.map((p, i) => {
          /*
           * Where the name goes. Sixteen of the twenty-three destinations
           * carry a labelPos in lib/destinations.ts, written for the old map
           * because everything worth visiting near Tbilisi crowds into the
           * same corner of the country — Tbilisi right, Mtskheta left,
           * Gudauri below. Alternating above and below was not enough: on a
           * seven-day plan the eastern names overlapped each other.
           *
           * Anything without a hint falls back to alternating, which is fine
           * for the western half where the stops are far apart.
           */
          const pos = p.labelPos ?? (i % 2 === 0 ? "top" : "bottom");
          const label =
            pos === "left" ? { x: p.x - 16, y: p.y + 5, anchor: "end" as const }
            : pos === "right" ? { x: p.x + 16, y: p.y + 5, anchor: "start" as const }
            : pos === "bottom" ? { x: p.x, y: p.y + 30, anchor: "middle" as const }
            : { x: p.x, y: p.y - 18, anchor: "middle" as const };
          return (
            <g key={`${p.slug}-${i}`}>
              <circle cx={p.x} cy={p.y} r={11} className="fill-brand-600" />
              <text
                x={p.x} y={p.y + 4}
                textAnchor="middle"
                className="fill-white text-[13px] font-semibold"
              >
                {i + 1}
              </text>
              <text
                x={label.x} y={label.y}
                textAnchor={label.anchor}
                className="fill-ink-900 text-[15px] font-semibold"
                // A white halo rather than a backdrop rectangle: the label
                // stays legible over the outline without boxing every name.
                stroke="white" strokeWidth={4} paintOrder="stroke"
              >
                {p.name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {xy.map((p) => `${p.day}. ${p.name}`).join(", ")}
      </figcaption>
    </figure>
  );
}
