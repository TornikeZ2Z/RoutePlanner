import "server-only";
import { sql } from "@db/client";
import { computeQuote, ENGINE_VERSION } from "@/lib/pricing/engine";
import { config } from "@/lib/config";
import { getCommissionRateBps, getMinimumDayFareMinor } from "@/lib/settings";
import type { Locale, MessageKey } from "@/lib/i18n";

/**
 * Curated tours.
 *
 * A tour is a route family with an itinerary and editorial copy attached. It
 * prices through the same engine as any other trip — there is no second
 * pricing path to keep in step — and it returns to its origin, so the whole
 * return leg is part of the loop rather than a deadhead recovery.
 */
export interface TourStop {
  name: string;
  dayIndex: number;
  position: number;
  legKm: number | null;
  notes: string | null;
}

export interface Tour {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  originSlug: string;
  originName: string;
  durationDays: number;
  distanceKm: number;
  driveMinutes: number;
  requires4x4: boolean;
  heroImageKey: string | null;
  heroImageAlt: string | null;
  stops: TourStop[];
}

const NAME_COLUMN: Record<Locale, string> = { en: "name_en", ka: "name_ka", ru: "name_ru" };

/**
 * The duration bands the catalogue is shown in — CR-2026-0011 item 18.
 *
 *   "The Tours page should not be just a list of tours. Split it:
 *    1 day / 2-3 days / 4-5 days / 7+ days"
 *
 * Written here rather than in the page because a set of values the page
 * partitions on is exactly the kind of literal that gets copied: the five tour
 * CATEGORIES are already written out three times in three files, and a second
 * ad-hoc axis would have been the fourth.
 *
 * The bands cover 1 to 10, which is what the tour_duration_sane CHECK allows.
 * Note the third one is 4-6, not the 4-5 the request names: the literal reading
 * leaves six days in no band at all, and a tour that belongs to nothing simply
 * would not appear on the page. One extra day in a label is the cheapest
 * possible fix for that, and it is flagged on the ticket rather than done
 * quietly.
 *
 * `example` is the founder's own illustration of each band, kept because it is
 * what makes a heading a promise about the catalogue rather than a divider.
 */
export interface TourBand {
  id: "day" | "short" | "week" | "grand";
  label: MessageKey;
  example: MessageKey;
  covers: (days: number) => boolean;
}

export const TOUR_BANDS: TourBand[] = [
  { id: "day",   label: "tours.band1", example: "tours.band1eg", covers: (d) => d === 1 },
  { id: "short", label: "tours.band2", example: "tours.band2eg", covers: (d) => d >= 2 && d <= 3 },
  { id: "week",  label: "tours.band3", example: "tours.band3eg", covers: (d) => d >= 4 && d <= 6 },
  { id: "grand", label: "tours.band4", example: "tours.band4eg", covers: (d) => d >= 7 },
];

/**
 * Split an already-ordered list of tours into its bands, dropping the empty ones.
 *
 * listTours orders by duration_days then distance_km, so this is a stable walk:
 * within a band the shorter trip still comes first. Empty bands are dropped
 * rather than shown with an invitation under them — the catalogue has no tour
 * longer than three days today, and a heading that says "4-6 days" over nothing
 * is the page promising a thing the marketplace cannot sell. When such a tour
 * is published its band appears by itself.
 */
export function groupByBand<T extends { durationDays: number }>(
  tours: T[],
): { band: TourBand; tours: T[] }[] {
  return TOUR_BANDS
    .map((band) => ({ band, tours: tours.filter((t) => band.covers(t.durationDays)) }))
    .filter((group) => group.tours.length > 0);
}

export async function listTours(locale: Locale = "en"): Promise<Tour[]> {
  const rows = await sql<TourRow[]>`
    SELECT t.id, t.slug, t.category, t.duration_days, t.distance_km, t.drive_minutes,
           t.requires_4x4, t.hero_image_key, t.hero_image_alt,
           o.slug AS origin_slug, coalesce(${sql.unsafe(`o.${NAME_COLUMN[locale]}`)}, o.name_en) AS origin_name,
           coalesce(tr.title, en.title) AS title,
           coalesce(tr.summary, en.summary) AS summary,
           coalesce(tr.body, en.body) AS body
    FROM tours t
    JOIN locations o ON o.id = t.origin_id
    LEFT JOIN tour_translations tr ON tr.tour_id = t.id AND tr.locale = ${locale}
    LEFT JOIN tour_translations en ON en.tour_id = t.id AND en.locale = 'en'
    WHERE t.active
    ORDER BY t.duration_days, t.distance_km`;
  return rows.map((r) => ({ ...map(r), stops: [] }));
}

export async function getTour(slug: string, locale: Locale = "en"): Promise<Tour | null> {
  const [row] = await sql<TourRow[]>`
    SELECT t.id, t.slug, t.category, t.duration_days, t.distance_km, t.drive_minutes,
           t.requires_4x4, t.hero_image_key, t.hero_image_alt,
           o.slug AS origin_slug, coalesce(${sql.unsafe(`o.${NAME_COLUMN[locale]}`)}, o.name_en) AS origin_name,
           coalesce(tr.title, en.title) AS title,
           coalesce(tr.summary, en.summary) AS summary,
           coalesce(tr.body, en.body) AS body
    FROM tours t
    JOIN locations o ON o.id = t.origin_id
    LEFT JOIN tour_translations tr ON tr.tour_id = t.id AND tr.locale = ${locale}
    LEFT JOIN tour_translations en ON en.tour_id = t.id AND en.locale = 'en'
    WHERE t.slug = ${slug} AND t.active`;
  if (!row) return null;

  const stops = await sql<StopRow[]>`
    SELECT coalesce(${sql.unsafe(`l.${NAME_COLUMN[locale]}`)}, l.name_en) AS name,
           s.day_index, s.position, s.leg_km, s.notes
    FROM tour_stops s JOIN locations l ON l.id = s.location_id
    WHERE s.tour_id = ${row.id}::uuid ORDER BY s.position`;

  return {
    ...map(row),
    stops: stops.map((s) => ({
      name: s.name, dayIndex: s.day_index, position: s.position,
      legKm: s.leg_km === null ? null : Number(s.leg_km), notes: s.notes,
    })),
  };
}

/**
 * Every active tour's stops at once, keyed by tour slug and in road order.
 *
 * listTours deliberately returns stops: [] — six callers, and four of them
 * (the sitemap, the homepage, the destination pages, the "other tours" strip)
 * want title, duration and price only, so loading a join they never read would
 * make every one of them pay for the tours index.
 *
 * So this is a sibling rather than a flag: one grouped query for the whole
 * catalogue, folded in JS. CR-2026-0011 item 18 asks for the route on each card
 * of that index, which is the first caller to need it.
 *
 * Names are resolved to the reader's language in SQL, the same way the tour's
 * own title and origin are — and names, not slugs, is the whole difference from
 * the near-identical query in the plan page. That one feeds a map and needs
 * slugs to look coordinates up; this one is read by a human. Merging them would
 * mean returning both and giving each caller half of something.
 */
export async function listTourStops(locale: Locale = "en"): Promise<Record<string, string[]>> {
  const rows = await sql<{ tour: string; name: string }[]>`
    SELECT t.slug AS tour,
           coalesce(${sql.unsafe(`l.${NAME_COLUMN[locale]}`)}, l.name_en) AS name
    FROM tour_stops s
    JOIN tours t ON t.id = s.tour_id
    JOIN locations l ON l.id = s.location_id
    WHERE t.active
    ORDER BY t.slug, s.day_index, s.position`;

  const byTour: Record<string, string[]> = {};
  for (const row of rows) (byTour[row.tour] ??= []).push(row.name);
  return byTour;
}

/** Cheapest published price for a tour, for the "from" label. */
export async function tourPriceFrom(slug: string): Promise<{ fromMinor: bigint; vehicles: number } | null> {
  const tourCommissionBps = await getCommissionRateBps();
  const tourDayFloorMinor = await getMinimumDayFareMinor();
  const [tour] = await sql<{
    distance_km: string; drive_minutes: number; return_km: string;
    deadhead_recovery_bps: number; risk_factor_bps: number; min_fare_minor: bigint;
    requires_4x4: boolean; duration_days: number;
  }[]>`
    SELECT distance_km, drive_minutes, return_km, deadhead_recovery_bps,
           risk_factor_bps, min_fare_minor, requires_4x4, duration_days
    FROM tours WHERE slug = ${slug} AND active`;
  if (!tour) return null;

  const plans = await sql<PlanRow[]>`
    SELECT p.rate_per_km_minor, p.rate_per_minute_minor, p.per_stop_fee_minor,
           p.overnight_fee_minor, p.minimum_fare_minor, p.season_factor_bps, p.currency,
           b.min_fare_floor_minor, b.max_fare_ceiling_minor
    FROM driver_profiles d
    JOIN vehicles v    ON v.driver_id = d.id AND v.published AND v.status = 'APPROVED'
    JOIN price_plans p ON p.vehicle_id = v.id AND p.status = 'ACTIVE'
    JOIN price_bands b ON b.class = v.class AND b.active
    WHERE d.published AND d.status = 'APPROVED'
      AND (${tour.requires_4x4} = false OR (v.capabilities->>'four_wheel_drive')::boolean IS TRUE)`;
  if (plans.length === 0) return null;

  let cheapest: bigint | null = null;
  for (const p of plans) {
    const { grossMinor } = computeQuote({
      engineVersion: ENGINE_VERSION,
      currency: p.currency,
      distanceKm100: Math.round(Number(tour.distance_km) * 100),
      driveMinutes: tour.drive_minutes,
      returnKm100: Math.round(Number(tour.return_km) * 100),
      deadheadRecoveryBps: tour.deadhead_recovery_bps,
      riskFactorBps: tour.risk_factor_bps,
      routeMinFareMinor: (tour.min_fare_minor ?? 0n).toString(),
      extraStops: 0,
      nights: Math.max(0, tour.duration_days - 1),
      plan: {
        ratePerKmMinor: p.rate_per_km_minor.toString(),
        ratePerMinuteMinor: p.rate_per_minute_minor.toString(),
        perStopFeeMinor: p.per_stop_fee_minor.toString(),
        overnightFeeMinor: p.overnight_fee_minor.toString(),
        minimumFareMinor: p.minimum_fare_minor.toString(),
        seasonFactorBps: p.season_factor_bps,
      },
      band: {
        minFareFloorMinor: p.min_fare_floor_minor.toString(),
        maxFareCeilingMinor: p.max_fare_ceiling_minor.toString(),
      },
      commissionRateBps: tourCommissionBps,
      roundingStepMinor: config.policy.roundingStepMinor,
      // A tour is day-based work: duration_days of the driver's time, floored
      // per day regardless of how far the itinerary actually drives.
      days: Math.max(1, tour.duration_days),
      minimumDayFareMinor: String(tourDayFloorMinor),
    });
    const value = BigInt(grossMinor);
    if (cheapest === null || value < cheapest) cheapest = value;
  }
  return { fromMinor: cheapest!, vehicles: plans.length };
}

interface TourRow {
  id: string; slug: string; category: string; duration_days: number; distance_km: string; drive_minutes: number;
  requires_4x4: boolean; hero_image_key: string | null; hero_image_alt: string | null;
  origin_slug: string; origin_name: string; title: string; summary: string; body: string;
}
interface StopRow { name: string; day_index: number; position: number; leg_km: string | null; notes: string | null }
interface PlanRow {
  rate_per_km_minor: bigint; rate_per_minute_minor: bigint; per_stop_fee_minor: bigint;
  overnight_fee_minor: bigint; minimum_fare_minor: bigint; season_factor_bps: number;
  currency: string; min_fare_floor_minor: bigint; max_fare_ceiling_minor: bigint;
}

const map = (r: TourRow) => ({
  id: r.id, slug: r.slug, category: r.category, title: r.title, summary: r.summary, body: r.body,
  originSlug: r.origin_slug, originName: r.origin_name,
  durationDays: r.duration_days, distanceKm: Number(r.distance_km),
  driveMinutes: r.drive_minutes, requires4x4: r.requires_4x4,
  heroImageKey: r.hero_image_key, heroImageAlt: r.hero_image_alt,
});
