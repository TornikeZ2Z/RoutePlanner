/**
 * Human durations.
 *
 * "about 0 h driving" appeared on every route under an hour — technically the
 * result of integer division, and immediately reads as broken. Sub-hour
 * trips are stated in minutes, and hours are only rounded once there are
 * enough of them for rounding to be honest.
 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes / 5) * 5} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} h`;
  if (rest < 8) return `${hours} h`;
  if (rest > 52) return `${hours + 1} h`;
  return `${hours} h ${Math.round(rest / 5) * 5} min`;
}

/** "about 2 h", "about 25 min" — for estimates that should not look precise. */
export const formatApproxDuration = (minutes: number): string =>
  minutes <= 0 ? "—" : `about ${formatDuration(minutes)}`;

export function formatDistance(km: number): string {
  return `${Math.round(km)} km`;
}

/**
 * Format a moment for a `datetime-local` input, which reads LOCAL time.
 *
 * `toISOString()` returns UTC, so using it directly shifted every default by
 * the reader's offset — four hours in Georgia, which is how a 10:00 pickup
 * came out as 06:00. The booking bar was fixed for CR-2026-0019; the plan
 * wizard had its own copy of the same line and kept the bug.
 */
export function toLocalInput(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
