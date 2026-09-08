import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { sql } from "@db/client";
import { currentWeather } from "@/lib/weather";
import { isLocale, LOCALES, getTranslator, type Locale } from "@/lib/i18n";
import { getTour, listTours, tourPriceFrom, tourDriverPool, listTourReviews } from "@/lib/tours";
import { formatMoney } from "@/lib/money";
import { formatDuration, formatDistance } from "@/lib/format";
import { getDisplayCurrency, getRate, convert, CANONICAL } from "@/lib/currency";
import { config } from "@/lib/config";
import { Badge, Card } from "@/components/ui";
import { PlaceImage } from "@/components/place-image";
import { sitePhoto } from "@/lib/site-photos";
import { SearchForm } from "@/components/search-form";

export const revalidate = 3600;

/**
 * Languages by their own name, not translated.
 *
 * offer-filters.tsx has a LANGUAGE_LABEL map, but it is English-only and lives
 * in a client component — "Georgian" is the wrong word to show a Georgian
 * reader. An endonym is right in every locale at once and needs no key in any
 * dictionary, which is also why airlines and passports use them.
 */
const LANGUAGE_ENDONYM: Record<string, string> = {
  en: "English", ka: "ქართული", ru: "Русский", tr: "Türkçe",
  de: "Deutsch", fr: "Français", ar: "العربية", he: "עברית",
};

interface Props { params: Promise<{ locale: string; slug: string }> }

export async function generateStaticParams() {
  const tours = await listTours("en");
  return LOCALES.flatMap((locale) => tours.map((t) => ({ locale, slug: t.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const tour = await getTour(slug, locale as Locale);
  if (!tour) return { title: "Tour not found" };
  const url = `${config.appUrl}/${locale}/tours/${slug}`;
  return {
    title: tour.title,
    description: tour.summary,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${config.appUrl}/${l}/tours/${slug}`])),
    },
    /*
       images is restated, not inherited. A page's openGraph REPLACES the root
       layout's rather than merging, so setting title and description here
       dropped the site image: every tour shared to WhatsApp or Facebook
       appeared as a bare grey link with no picture.
    */
    openGraph: {
      title: tour.title, description: tour.summary, url, type: "article",
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: tour.title }],
    },
  };
}

export default async function TourPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const tour = await getTour(slug, locale as Locale);
  if (!tour) notFound();

  // Weather at the tour's far point — decorative, hidden when unavailable.
  const [far] = await sql<{ lat: number; lon: number; name: string }[]>`
    SELECT l.lat, l.lon, l.name_en AS name FROM tour_stops ts
    JOIN locations l ON l.id = ts.location_id
    WHERE ts.tour_id = ${tour.id}::uuid ORDER BY ts.position DESC LIMIT 1`;
  const weather = far ? await currentWeather(Number(far.lat), Number(far.lon)) : null;
  const t = getTranslator(locale as Locale);

  const [price, locations, others, currency, pool, reviews] = await Promise.all([
    tourPriceFrom(slug),
    sql<{ slug: string; name_en: string; type: string }[]>`
      SELECT slug,
             coalesce(CASE WHEN ${locale} = 'ka' THEN name_ka
                           WHEN ${locale} = 'ru' THEN name_ru END, name_en) AS name_en,
             type::text AS type
      FROM locations WHERE in_service_area ORDER BY type, 2`,
    listTours(locale as Locale),
    getDisplayCurrency(),
    tourDriverPool(slug),
    listTourReviews(slug),
  ]);
  const rate = await getRate(currency);

  /*
     The gallery: one photograph per place the tour stops at, in road order.

     Shaped like the index card's route line — consecutive repeats collapse, and
     the closing return to the origin goes — so a round trip does not open and
     close on the same picture. Stops with no file on disk drop out, which is
     what makes this degrade to nothing rather than to a grid of placeholder
     illustrations pretending to be photographs.
  */
  const gallery = tour.stops
    .filter((stop, i) => stop.slug !== tour.stops[i - 1]?.slug)
    .filter((stop, i, kept) => !(i === kept.length - 1 && i > 1 && stop.slug === kept[0]?.slug))
    .flatMap((stop) => {
      const photo = sitePhoto(`destinations/${stop.slug}.jpg`);
      return photo ? [{ slug: stop.slug, name: stop.name, photo }] : [];
    });


  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.title,
    description: tour.summary,
    touristType: "Private transfer with driver",
    provider: { "@type": "Organization", name: "RoutePlanner", url: config.appUrl },
    itinerary: {
      "@type": "ItemList",
      itemListElement: tour.stops.map((s, i) => ({
        "@type": "ListItem", position: i + 1, name: s.name,
      })),
    },
    ...(price && {
      offers: {
        "@type": "Offer", priceCurrency: CANONICAL,
        price: (Number(price.fromMinor) / 100).toFixed(2),
      },
    }),
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href={`/${locale}`} className="hover:text-ink-800">{t("common.home")}</Link>
        <span className="mx-2" aria-hidden>/</span>
        <Link href={`/${locale}/tours`} className="hover:text-ink-800">{t("tours.eyebrow")}</Link>
        <span className="mx-2" aria-hidden>/</span>
        <span className="text-ink-700">{tour.title}</span>
      </nav>

      <PlaceImage
        imageKey={tour.heroImageKey}
        photoSrc={sitePhoto(`tours/${tour.slug}.jpg`)}
        alt={tour.heroImageAlt ?? tour.title}
        seedText={tour.slug}
        className="h-56 w-full sm:h-72"
        rounded="rounded-2xl"
        eager
      />

      <header className="max-w-3xl">
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{tour.durationDays === 1 ? t("tours.dayTrip") : t("tours.days", { count: tour.durationDays })}</Badge>
          {tour.requires4x4 && <Badge tone="warning">{t("tours.fourByFour")}</Badge>}
          <Badge tone="success">{t("tours.private")}</Badge>
        </div>
        <h1 className="font-display mt-4 text-4xl text-ink-900 sm:text-5xl">{tour.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-600">{tour.summary}</p>

        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink-200 pt-4 text-sm">
          {/* Price first, because his list reads Price / Duration and because
              it is what a reader scans this row for. The duration badge above
              still comes earlier on the page; prising the badge row apart to
              chase that would be reordering for its own sake. */}
          {price && (
            <div>
              <dt className="text-ink-500">{t("tours.priceFrom")}</dt>
              <dd className="font-medium text-ink-900">
                {formatMoney(price.fromMinor, CANONICAL, locale)}
                {rate.currency !== CANONICAL && (
                  <span className="font-normal text-ink-500"> (≈ {formatMoney(convert(price.fromMinor, rate), rate.currency, locale)})</span>
                )}
              </dd>
            </div>
          )}
          <div><dt className="text-ink-500">{t("tours.startsFrom")}</dt><dd className="font-medium text-ink-900">{tour.originName}</dd></div>
          <div><dt className="text-ink-500">{t("tours.distance")}</dt><dd className="font-medium text-ink-900">{t("tours.roundTrip", { km: formatDistance(tour.distanceKm, locale as Locale) })}</dd></div>
          <div><dt className="text-ink-500">{t("tours.drivingTime")}</dt><dd className="font-medium text-ink-900">{formatDuration(tour.driveMinutes, locale as Locale)}</dd></div>
          {/*
            Vehicle — the last item on CR-2026-0011 item 18's list, and the only
            one this page did not answer.

            It says what the marketplace actually enforces, which is NOT a class.
            Both pricing paths filter on the vehicle's four_wheel_drive
            capability (offers.ts, tourPriceFrom), never on class = SUV_4X4, and
            inferVehicleClass calls an eight-seat 4x4 a MINIBUS — so that car is
            eligible for Kazbegi while a card reading "SUV / 4x4" would have
            told its driver otherwise. Naming a class here would invent a
            restriction the system does not apply.
          */}
          <div>
            <dt className="text-ink-500">{t("tours.vehicle")}</dt>
            <dd className="font-medium text-ink-900">
              {tour.requires4x4 ? t("tours.vehicle4x4") : t("tours.vehicleAny")}
            </dd>
          </div>
        </dl>
        {weather && (
        <p className="mt-3 text-sm text-ink-500">
          {t("weather.label")}: {weather.temperatureC}°C · {t(("weather." + weather.bucket) as never)}
        </p>
      )}
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section className="max-w-2xl">
            <h2 className="font-display text-2xl text-ink-900">{t("tours.about")}</h2>
            <div className="mt-3 space-y-4 leading-relaxed text-ink-700">
              {tour.body.split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>)}
            </div>
          </section>

          {/*
            What the price covers, from CR-2026-0011 item 18 and CR-2026-0018.

            One list for every tour rather than per-tour fields, because both
            requestors described the same thing: "we provide the car, so only
            the route and its cost are included — we are not responsible for
            food, hotels or guiding". The tours table has nowhere to store an
            inclusions list, and inventing a column per tour to hold identical
            text would be storage pretending to be editorial.

            The day a tour genuinely differs — one that does include a boat, or
            a ticket — that tour needs its own field, and this becomes the
            default rather than the only answer.

            Two of the eight carry their own condition — waiting time and free
            cancellation — because that is how the list was written: "if the
            specific tour includes it", "if this tour's terms allow it". A
            shared list cannot promise either outright, and dropping them
            because they are awkward would be answering a different question
            than the one that was asked.
          */}
          <section>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="font-display text-2xl text-ink-900">{t("tours.inclTitle")}</h2>
                <ul className="mt-4 space-y-2">
                  {(["tours.incl1","tours.incl2","tours.incl3","tours.incl4","tours.incl5","tours.incl6","tours.incl7","tours.incl8"] as const).map((k) => (
                    <li key={k} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
                      <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-brand-600" fill="none"
                           stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                      {t(k)}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-2xl text-ink-900">{t("tours.exclTitle")}</h2>
                <ul className="mt-4 space-y-2">
                  {(["tours.excl1","tours.excl2","tours.excl3","tours.excl4","tours.excl5","tours.excl6"] as const).map((k) => (
                    <li key={k} className="flex gap-2.5 text-sm leading-relaxed text-ink-500">
                      <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-ink-400" fill="none"
                           stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                      {t(k)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-ink-500">{t("tours.inclNote")}</p>
          </section>

          {/*
            Slot 4 of CR-2026-0018's list: Driver. A POOL, never a person.

            Two reasons it can never name one here. This page is
            revalidate = 3600 and statically generated per locale, so a name
            would be up to an hour stale in three languages; and the
            marketplace does not attach a driver to a trip until a search
            produces a quote for a real date and party size, so naming one now
            would describe a booking that has not happened.

            No stars either. Every rating on the site is a seeded
            rating_sum/rating_count with an empty reviews table behind it, and
            carrying that onto another page would be repeating a number nobody
            earned.

            The count comes from searchOffers' own candidate predicate, so it
            is the number search would actually offer — including the
            four_wheel_drive rule, which is why a 4x4 tour shows a smaller pool
            than a paved one. Absent entirely when the pool is empty: a tour
            nobody can drive should say nothing rather than "0 drivers".
          */}
          {pool.drivers > 0 && (
            <section>
              <h2 className="font-display text-2xl text-ink-900">{t("tours.driverTitle")}</h2>
              <p className="font-display mt-3 text-2xl text-ink-900">
                {pool.drivers === 1
                  ? t("tours.driverOne")
                  : t("tours.driverPool", { count: pool.drivers })}
              </p>
              {pool.languages.length > 0 && (
                <p className="mt-2 text-sm text-ink-600">
                  {t("tours.driverLangs")}{" "}
                  {pool.languages.map((code) => LANGUAGE_ENDONYM[code] ?? code).join(" · ")}
                </p>
              )}
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">
                {t("tours.driverChoose")}
              </p>
            </section>
          )}

          <section>
            <h2 className="font-display text-2xl text-ink-900">{t("tours.route")}</h2>
            <ol className="mt-4 space-y-0">
              {tour.stops.map((stop, i) => {
                const last = i === tour.stops.length - 1;
                return (
                  <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                    {!last && <span aria-hidden className="absolute left-[11px] top-6 h-full w-px bg-ink-200" />}
                    <span
                      aria-hidden
                      className={`relative z-10 mt-1 size-6 shrink-0 rounded-full border-2 ${
                        i === 0 ? "border-ink-900 bg-ink-900"
                        : last ? "border-pine-600 bg-pine-600"
                        : "border-ink-300 bg-white"}`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">
                        {stop.name}
                        {stop.legKm !== null && stop.legKm > 0 && (
                          <span className="ml-2 text-sm font-normal text-ink-500">{stop.legKm} km</span>
                        )}
                        {tour.durationDays > 1 && (
                          <span className="ml-2 text-xs font-normal text-ink-400">{t("tours.day", { n: stop.dayIndex + 1 })}</span>
                        )}
                      </p>
                      {stop.notes && <p className="mt-1 text-sm leading-relaxed text-ink-600">{stop.notes}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/*
            What stood here said "What the price covers" for the second time on
            one page — tours.coversTitle is character-identical to
            tours.inclTitle thirty-five lines above it, and coversBody restated
            the eight inclusions and three exclusions in prose. CR-2026-0018
            part 4 asks for exactly this to go: "ერთნაირი ინფორმაციის
            გამეორება", the same information repeated. Repeating it on the SAME
            page is the strongest case of it on the site.

            One sentence survives, because it was the only thing here the lists
            do not say: on a trip of more than a day, the driver's own bed and
            meals are inside the quoted price rather than something the
            traveller is billed for later.
          */}

          {/*
            Slot 6: Photos. The places this tour actually stops at, using the
            photography the destination pages already serve.

            Nothing here is stock and nothing is generated: place-image.tsx and
            public/photos/README.txt both forbid a picture that stands in for a
            place it does not show, so a file filed under a location's slug, on
            a page for a tour that stops at that location, invents nothing. The
            note under it says so out loud, because a gallery on a tour page
            otherwise implies these are pictures OF the tour.

            Consecutive repeats and the closing return to the origin are
            dropped, the same shaping the index card's route line uses, so a
            round trip does not show its start twice.
          */}
          {gallery.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-ink-900">{t("tours.photosTitle")}</h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((stop) => (
                  <li key={stop.slug}>
                    <figure className="overflow-hidden rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={stop.photo}
                        alt={stop.name}
                        loading="lazy"
                        className="h-28 w-full object-cover sm:h-32"
                      />
                      <figcaption className="mt-1.5 text-xs text-ink-500">{stop.name}</figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-ink-500">{t("tours.photosNote")}</p>
            </section>
          )}

          {/*
            Slot 7: Reviews — and the reason this could not be built until now
            was not that none exist.

            Nothing in the schema recorded which TOUR a booking was for.
            reviews -> bookings -> quotes carried route_family_id and no tour,
            and for a tour booking even that was NULL, because a tour is priced
            instead of a route family. Migration 0026 adds quotes.tour_id and
            offers.ts writes it, so the question is now answerable.

            It will answer "none" for a while: no booking has completed. The
            section is absent until a real review exists, which is the choice
            already made for the homepage under CR-2026-0015 slot 8 — build it,
            never seed it, let it appear on the first one. A trip that did not
            happen cannot earn a review.
          */}
          {reviews.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-ink-900">{t("tours.reviewsTitle")}</h2>
              <ul className="mt-4 space-y-4">
                {reviews.map((review, i) => (
                  <li key={i} className="rounded-2xl border border-ink-200 bg-white p-5">
                    <p className="text-sm leading-relaxed text-ink-700">{review.body}</p>
                    <p className="mt-3 text-xs text-ink-500">
                      {review.author ?? ""}
                      {review.author ? " · " : ""}
                      <Link href={`/${locale}/drivers/${review.handle}`} className="underline underline-offset-4">
                        {review.driver}
                      </Link>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tour.durationDays > 1 && (
            <p className="text-sm leading-relaxed text-ink-500">{t("tours.coversOvernight")}</p>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <h2 className="font-semibold text-ink-900">{t("tours.checkTitle")}</h2>
            <p className="mt-1 text-sm text-ink-600">
              {t("tours.checkBody")}
            </p>
            <div className="mt-4">
              <SearchForm
                locale={locale}
                locations={locations}
                layout="compact"
                lockRoute
                tourSlug={tour.slug}
                initial={{ from: tour.originSlug, to: tour.originSlug }}
              />
            </div>
          </Card>
        </aside>
      </div>

      {others.length > 1 && (
        <section>
          <h2 className="font-display mb-4 text-2xl text-ink-900">{t("tours.others")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.filter((t2) => t2.slug !== slug).slice(0, 4).map((t2) => (
              <li key={t2.slug}>
                <Link href={`/${locale}/tours/${t2.slug}`}
                      className="block h-full rounded-xl border border-ink-200 bg-white p-4 hover:border-ink-500">
                  <p className="font-medium text-ink-900">{t2.title}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {t2.durationDays === 1 ? t("tours.dayTrip") : t("tours.days", { count: t2.durationDays })} · {formatDistance(t2.distanceKm, locale as Locale)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
