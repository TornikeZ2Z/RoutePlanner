import { getTranslator, type Locale } from "@/lib/i18n";
/**
 * Human durations and distances, in the reader's language.
 *
 * "about 0 h driving" appeared on every route under an hour — technically the
 * result of integer division, and immediately reads as broken. Sub-hour trips
 * are stated in minutes, and hours are only rounded once there are enough of
 * them for rounding to be honest.
 *
 * The units used to be hard-coded English. "150 km" and "about 3 h 20 min"
 * rendered exactly like that on every Georgian and Russian page — on route
 * cards, tour cards, destination pages and the results list — because these
 * helpers had no idea who was reading. The numbers are the same in every
 * language; only the unit and the word order change, so both live in the
 * dictionaries and the shape comes from the translated string rather than from
 * concatenation here.
 *
 * The locale defaults to English because the admin console calls these too,
 * and it has its own dictionary; there is no reader-language question there.
 */
export function formatDuration(minutes: number, locale: Locale = "en"): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const t = getTranslator(locale);
  if (minutes < 60) return t("unit.min", { n: String(Math.round(minutes / 5) * 5) });

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0 || rest < 8) return t("unit.hour", { n: String(hours) });
  if (rest > 52) return t("unit.hour", { n: String(hours + 1) });
  return t("unit.hourMin", { h: String(hours), m: String(Math.round(rest / 5) * 5) });
}

/** "about 2 h", "დაახლოებით 25 წთ" — for estimates that should not look precise. */
export const formatApproxDuration = (minutes: number, locale: Locale = "en"): string =>
  minutes <= 0 ? "—" : getTranslator(locale)("unit.about", { value: formatDuration(minutes, locale) });

export function formatDistance(km: number, locale: Locale = "en"): string {
  return getTranslator(locale)("unit.km", { n: String(Math.round(km)) });
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
