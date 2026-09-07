import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { sql } from "@db/client";
import { isLocale, getTranslator, LOCALES } from "@/lib/i18n";
import { config } from "@/lib/config";
import { PlanWizard } from "@/components/plan-wizard";
import { listTours } from "@/lib/tours";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return {
    title: t("plan.title"),
    description: t("plan.lead"),
    alternates: {
      canonical: `${config.appUrl}/${locale}/plan`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${config.appUrl}/${l}/plan`])),
    },
  };
}

export default async function PlanPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const t = getTranslator(locale);

  const [tours, places, stopRows] = await Promise.all([
    listTours(locale),
    sql<{ slug: string; name: string; lat: number; lon: number }[]>`
      SELECT slug,
             coalesce(CASE WHEN ${locale} = 'ka' THEN name_ka
                           WHEN ${locale} = 'ru' THEN name_ru END, name_en) AS name,
             lat, lon
      FROM locations WHERE in_service_area`,
    /*
     * Which places each tour actually passes through, in order.
     *
     * Most days in a plan are a tour rather than a list of places — a
     * five-day plan names two places and three tours — so a map drawn from
     * the plan's own places alone would be nearly empty. listTours() returns
     * stops: [] and TourStop carries a name but no slug, so this asks the
     * question directly rather than widening a type used in four other places.
     */
    sql<{ tour: string; slug: string }[]>`
      SELECT t.slug AS tour, l.slug
      FROM tour_stops ts
      JOIN tours t ON t.id = ts.tour_id
      JOIN locations l ON l.id = ts.location_id
      WHERE t.active
      ORDER BY t.slug, ts.day_index, ts.position`,
  ]);

  const tourStops: Record<string, string[]> = {};
  for (const row of stopRows) (tourStops[row.tour] ??= []).push(row.slug);

  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <p className="eyebrow">{t("home.planTeaserEyebrow")}</p>
        <h1 className="font-display mt-2 text-4xl text-ink-900 sm:text-5xl">{t("plan.title")}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-500">{t("plan.lead")}</p>
      </header>
      <PlanWizard
        locale={locale}
        tours={tours.map((x) => ({ slug: x.slug, title: x.title, durationDays: x.durationDays }))}
        places={Object.fromEntries(places.map((p) => [p.slug, {
          name: p.name, lat: Number(p.lat), lon: Number(p.lon),
        }]))}
        tourStops={tourStops}
        initial={{
          o: str(sp.o), d: str(sp.d), i: str(sp.i),
          pace: str(sp.pace), b: str(sp.b), p: str(sp.p),
        }}
      />
    </div>
  );
}
