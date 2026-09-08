import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALES, getTranslator, type Locale } from "@/lib/i18n";
import { listTours, listTourStops, tourPriceFrom, groupByBand } from "@/lib/tours";
import { formatMoney } from "@/lib/money";
import { formatDuration, formatDistance } from "@/lib/format";
import { getDisplayCurrency, getRate, convert, CANONICAL } from "@/lib/currency";
import { config } from "@/lib/config";
import { Badge, EmptyState } from "@/components/ui";
import { PlaceImage } from "@/components/place-image";
import { sitePhoto } from "@/lib/site-photos";

export const revalidate = 3600;

interface Props { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  /*
     Both of these were English on every locale.

     A Georgian visitor's search result and shared link read "Day trips and
     multi-day tours in Georgia" — the same defect the route pages had, fixed
     there and missed here, because the two pages were written months apart and
     only one of them was in the ticket. The keys existed the whole time: the
     page's own <h1> has rendered tours.title in three languages since it was
     built.
  */
  const t = getTranslator(locale as Locale);
  const url = `${config.appUrl}/${locale}/tours`;
  const title = t("tours.title");
  const description = t("tours.metaDesc");
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${config.appUrl}/${l}/tours`])),
    },
    /*
       images is restated, not inherited: a page's openGraph REPLACES the root
       layout's rather than merging into it, so declaring title and description
       here without it would drop the site image and make every shared link a
       bare grey box. Same reasoning, same fix, as the tour and route pages.
    */
    openGraph: {
      title, description, url, type: "website",
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function ToursIndex({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getTranslator(locale as Locale);
  const [tours, stopsByTour, currency] = await Promise.all([
    listTours(locale as Locale),
    listTourStops(locale as Locale),
    getDisplayCurrency(),
  ]);
  const rate = await getRate(currency);
  const sp = await searchParams;
  const rawCat = Array.isArray(sp.cat) ? sp.cat[0] : sp.cat;
  const CATS = ["sea", "mountains", "winter", "culture", "wine"] as const;
  const activeCat = CATS.includes(rawCat as (typeof CATS)[number]) ? rawCat : undefined;
  const shown = activeCat ? tours.filter((x) => x.category === activeCat) : tours;
  /*
     Keyed by slug, not positional.

     This was `prices[index]` read against `shown.map((tour, index) => …)`, which
     held only because the two arrays were the same list in the same order. The
     page is partitioned into duration bands now, so the card's index is its
     index WITHIN ITS BAND and no longer addresses this array at all — a bug
     that type-checks, renders, and quietly prints the wrong price under the
     wrong tour.
  */
  const priced = await Promise.all(
    shown.map(async (x) => [x.slug, await tourPriceFrom(x.slug)] as const),
  );
  const prices = new Map(priced);
  const bands = groupByBand(shown);
  const CAT_KEY: Record<string, string> = {
    sea: "tours.catSea", mountains: "tours.catMountains", winter: "tours.catWinter",
    culture: "tours.catCulture", wine: "tours.catWine",
  };

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="eyebrow">{t("tours.eyebrow")}</p>
        <h1 className="font-display mt-3 text-4xl text-ink-900 sm:text-5xl">
          {t("tours.title")}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-600">
          {t("tours.intro")}
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Tour categories">
        {[undefined, ...CATS].map((cat) => (
          <Link
            key={cat ?? "all"}
            href={cat ? `/${locale}/tours?cat=${cat}` : `/${locale}/tours`}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              activeCat === cat || (!activeCat && !cat)
                ? "border-ink-900 bg-ink-900 text-white dark:text-pine-900"
                : "border-ink-300 text-ink-900 hover:border-ink-500"
            }`}
          >
            {cat ? t(CAT_KEY[cat] as never) : t("tours.catAll")}
          </Link>
        ))}
      </nav>

      {/*
        Split by how long the trip takes — CR-2026-0011 item 18, "the Tours page
        should not be just a list of tours".

        Duration is the heading and category stays the filter, because the
        request says "let us split it" and then names an example route for each
        band: all four have to be visible at once or the page is still a list
        with one more chip row above it. Choosing a category re-splits that
        category across the bands rather than escaping the grouping.

        All four bands are drawn, including the two with no tours in them. The
        first version of this dropped the empty ones, reasoning that a heading
        over nothing advertises what we cannot sell — which turned out to be
        false: /plan?d=7 builds a real seven-day itinerary from the same drivers
        and routes, with a price, and that was checked before this changed. So
        an empty band hands over to the planner instead of disappearing. Hiding
        them would have hidden the expensive end of the catalogue, which is the
        opposite of what a request to show four bands was asking for.
      */}
      {shown.length === 0 ? (
        <EmptyState title={t("tours.empty")} />
      ) : (
        bands.map(({ band, tours: inBand }) => (
        <section key={band.id} className="space-y-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink-200 pb-3">
            <h2 className="font-display text-2xl text-ink-900">{t(band.label)}</h2>
            <p className="text-sm text-ink-500">{t(band.example)}</p>
          </div>
        {inBand.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-ink-300 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-relaxed text-ink-600">{t("tours.bandEmpty")}</p>
            <Link
              href={`/${locale}/plan?d=${band.planDays}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-ink-900 px-5 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-900 hover:text-white dark:hover:text-pine-900"
            >
              {t("tours.bandEmptyCta", { days: band.planDays })}
            </Link>
          </div>
        ) : (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {inBand.map((tour) => {
            const price = prices.get(tour.slug);
            const route = collapse(stopsByTour[tour.slug] ?? []);
            return (
              <li key={tour.slug}>
                <Link
                  href={`/${locale}/tours/${tour.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white transition-colors hover:border-ink-500"
                >
                  {/* An abstract route illustration rather than stock photography
                      of a place the traveller has not yet chosen. */}
                  <div className="relative">
                    <PlaceImage
                      imageKey={tour.heroImageKey}
                      photoSrc={sitePhoto(`tours/${tour.slug}.jpg`)}
                      alt={tour.heroImageAlt ?? tour.title}
                      seedText={tour.slug}
                      className="h-44 w-full"
                    />
                    <div className="absolute left-4 top-4 flex gap-2">
                      <Badge tone="neutral">
                        {tour.durationDays === 1 ? t("tours.dayTrip") : t("tours.days", { count: tour.durationDays })}
                      </Badge>
                      {tour.requires4x4 && <Badge tone="warning">4x4</Badge>}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-xl text-ink-900">{tour.title}</h3>
                    {/*
                      The route, which is the other half of item 18 and the one
                      thing a card could never say before. It sits ABOVE the
                      summary on purpose: the summary carries flex-1 and is the
                      spring that pushes the price row to the bottom of every
                      card, so anything placed after it competes for that space
                      and the cards stop lining up.

                      tour_stops already holds this and already includes the
                      origin at both ends, so the chain reads Tbilisi → Borjomi
                      → Vardzia → Tbilisi without anything being prepended.
                    */}
                    {route.length > 1 && (
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
                        {route.join(" → ")}
                      </p>
                    )}
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{tour.summary}</p>

                    <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-3">
                      <p className="text-xs text-ink-500">
                        {t("tours.fromPlace", { place: tour.originName })}
                        <span className="mt-0.5 block">
                          {formatDistance(tour.distanceKm, locale as Locale)} · {formatDuration(tour.driveMinutes, locale as Locale)} {t("tours.driving")}
                        </span>
                      </p>
                      {price && (
                        <p className="text-right">
                          <span className="block text-xs text-ink-500">{t("tours.from")}</span>
                          <span className="font-display text-2xl text-ink-900">
                            {formatMoney(price.fromMinor, CANONICAL, locale)}
                          </span>
                          {rate.currency !== CANONICAL && (
                            <span className="block text-xs text-ink-500">
                              ≈ {formatMoney(convert(price.fromMinor, rate), rate.currency, locale)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        )}
        </section>
        ))
      )}
    </div>
  );
}

/**
 * Consecutive repeats out of a stop chain.
 *
 * A three-day Svaneti tour records Mestia on day one and day two, so its stops
 * read Kutaisi, Mestia, Mestia, Kutaisi — correct as an itinerary, and noise on
 * one line. Only ADJACENT repeats go: a tour that returns to Tbilisi in the
 * middle and again at the end is telling the truth about its shape both times.
 */
function collapse(names: string[]): string[] {
  return names.filter((name, i) => name !== names[i - 1]);
}
