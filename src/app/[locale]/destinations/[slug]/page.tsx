import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, getTranslator, LOCALES, type Locale, type MessageKey } from "@/lib/i18n";
import { config } from "@/lib/config";
import { DESTINATIONS, type MapCategory, type Season } from "@/lib/destinations";
import { CATEGORY_ICONS } from "@/lib/map-icons";
import { listRoutes } from "@/lib/routes-content";
import { listTours } from "@/lib/tours";
import { sitePhoto } from "@/lib/site-photos";
import { sql } from "@db/client";
import { formatDuration } from "@/lib/format";
import { PlaceImage } from "@/components/place-image";
import { Card } from "@/components/ui";

export const revalidate = 3600;

/** The theme labels the tours page and the homepage tiles already use, so a
    place is described with the same words wherever it appears. */
const THEME_LABEL: Record<MapCategory, MessageKey> = {
  sea: "tours.catSea",
  mountains: "tours.catMountains",
  winter: "tours.catWinter",
  wine: "tours.catWine",
  culture: "tours.catCulture",
  nature: "map.catNature",
};

const SEASON_LABEL: Record<Season, MessageKey> = {
  spring: "home.season1t",
  summer: "home.season2t",
  autumn: "home.season3t",
  winter: "home.season4t",
};

interface Props { params: Promise<{ locale: string; slug: string }> }

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => DESTINATIONS.map((d) => ({ locale, slug: d.slug })));
}

/** The display name comes from the locations table, which already carries a
    name per language; the curated table holds only the editorial layer. */
async function placeName(slug: string, locale: Locale): Promise<string | null> {
  const col = locale === "ka" ? "name_ka" : locale === "ru" ? "name_ru" : "name_en";
  const [row] = await sql<{ name: string }[]>`
    SELECT coalesce(${sql.unsafe(col)}, name_en) AS name FROM locations WHERE slug = ${slug}`;
  return row?.name ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const dest = DESTINATIONS.find((d) => d.slug === slug);
  if (!dest) return {};
  const t = getTranslator(locale as Locale);
  const name = (await placeName(slug, locale as Locale)) ?? slug;
  return {
    title: t("dest.metaTitle", { place: name }),
    description: t(dest.descKey as MessageKey),
    alternates: {
      canonical: `${config.appUrl}/${locale}/destinations/${slug}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `${config.appUrl}/${l}/destinations/${slug}`]),
      ),
    },
  };
}

/**
 * One page per destination.
 *
 * Built entirely from what the system already knows. The curated table has
 * carried a one-sentence description, the seasons a place is worth visiting
 * and its themes since the map was written, and none of it has been rendered
 * anywhere since the map came out — the homepage tiles link straight to a
 * search query, so a traveller who wants to know what Kazbegi *is* has
 * nowhere to go.
 *
 * Nothing here is invented. Distance and drive time appear only for the eight
 * destinations that have a priced route from Tbilisi; for the rest the block
 * is absent rather than estimated, because a wrong drive time on a mountain
 * road is not a cosmetic error.
 */
export default async function DestinationPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dest = DESTINATIONS.find((d) => d.slug === slug);
  if (!dest) notFound();

  const t = getTranslator(locale as Locale);
  const [name, routes, tours] = await Promise.all([
    placeName(slug, locale as Locale),
    listRoutes(locale as Locale),
    listTours(locale as Locale),
  ]);
  if (!name) notFound();

  const fromTbilisi = routes.find((r) => r.originSlug === "tbilisi" && r.destinationSlug === slug);
  const relatedRoutes = routes.filter((r) => r.destinationSlug === slug || r.originSlug === slug);
  const relatedTours = tours.filter((tour) => dest.categories.includes(tour.category as MapCategory));
  // Places that share a theme, so the page leads somewhere rather than ending.
  const nearby = DESTINATIONS
    .filter((d) => d.slug !== slug && d.categories.some((c) => dest.categories.includes(c)))
    .slice(0, 6);
  const photo = sitePhoto(`destinations/${slug}.jpg`);

  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <header>
        <div className="relative h-64 overflow-hidden rounded-2xl sm:h-80">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <PlaceImage imageKey={null} alt="" seedText={slug} className="absolute inset-0 size-full" />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-pine-900/90 via-pine-900/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <p className="eyebrow text-gold-300">{t("dest.eyebrow")}</p>
            <h1 className="font-display mt-1 text-4xl sm:text-5xl">{name}</h1>
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-600">
          {t(dest.descKey as MessageKey)}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-400">{t("dest.whenT")}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {dest.seasons.map((s) => (
              <li key={s} className="rounded-xl border border-ink-200 px-2.5 py-1 text-sm text-ink-700">
                {t(SEASON_LABEL[s])}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-400">{t("dest.themesT")}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {dest.categories.map((c) => (
              <li key={c} className="flex items-center gap-1.5 rounded-xl border border-ink-200 px-2.5 py-1 text-sm text-ink-700">
                <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-gold-600" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={CATEGORY_ICONS[c]} />
                </svg>
                {t(THEME_LABEL[c])}
              </li>
            ))}
          </ul>
        </Card>

        {/* Only where a priced route exists. Fifteen of the twenty-three have
            no route family yet, and a guessed drive time on a mountain road
            is the kind of wrong that strands somebody. */}
        {fromTbilisi && (
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-400">{t("dest.fromTbilisiT")}</p>
            <p className="font-display mt-2 text-2xl text-ink-900">
              {formatDuration(fromTbilisi.driveMinutes)}
            </p>
            <p className="text-sm text-ink-500">
              {t("dest.km", { km: Math.round(fromTbilisi.distanceKm) })}
              {fromTbilisi.requires4x4 ? ` · ${t("dest.needs4x4")}` : ""}
            </p>
          </Card>
        )}
      </section>

      <section>
        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-2xl text-ink-900">{t("dest.bookT")}</h2>
          <p className="mt-2 max-w-xl leading-relaxed text-ink-600">{t("dest.bookB", { place: name })}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/search?from=tbilisi&to=${slug}&passengers=2&luggage=2`}
              className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 py-2.5 font-bold tracking-[-0.02em] text-white shadow-[0_0_2px_0_rgba(0,0,0,.16)] transition-colors hover:bg-brand-700"
            >
              {t("dest.bookCta")}
            </Link>
            <Link
              href={`/${locale}/plan`}
              className="inline-flex min-h-11 items-center rounded-xl border border-ink-300 px-5 py-2.5 font-semibold text-ink-900 transition-colors hover:border-ink-500"
            >
              {t("dest.planCta")}
            </Link>
          </div>
        </Card>
      </section>

      {relatedRoutes.length > 0 && (
        <section>
          <h2 className="font-display text-2xl text-ink-900">{t("dest.routesT")}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {relatedRoutes.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/${locale}/transfers/${r.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-4 transition-colors hover:border-ink-400"
                >
                  <span className="min-w-0 text-sm font-medium text-ink-900">
                    {r.originName} → {r.destinationName}
                  </span>
                  <span className="shrink-0 text-sm text-ink-500">{formatDuration(r.driveMinutes)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {relatedTours.length > 0 && (
        <section>
          <h2 className="font-display text-2xl text-ink-900">{t("dest.toursT")}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {relatedTours.slice(0, 4).map((tour) => (
              <li key={tour.slug}>
                <Link
                  href={`/${locale}/tours/${tour.slug}`}
                  className="block rounded-xl border border-ink-200 bg-white p-4 transition-colors hover:border-ink-400"
                >
                  <p className="font-medium text-ink-900">{tour.title}</p>
                  <p className="mt-1 text-sm text-ink-500">
                    {t("dest.days", { count: tour.durationDays })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nearby.length > 0 && (
        <section>
          <h2 className="font-display text-2xl text-ink-900">{t("dest.nearbyT")}</h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {nearby.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/${locale}/destinations/${d.slug}`}
                  className="group relative block h-28 overflow-hidden rounded-xl"
                >
                  {sitePhoto(`destinations/${d.slug}.jpg`) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sitePhoto(`destinations/${d.slug}.jpg`)!} alt="" loading="lazy"
                         className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <PlaceImage imageKey={null} alt="" seedText={d.slug} className="absolute inset-0 size-full" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-pine-900/85 to-pine-900/10" />
                  <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-medium text-white">
                    <DestinationName slug={d.slug} locale={locale as Locale} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** One name lookup per tile. Small and cached by the page's own revalidation;
    the alternative is threading a name map through every caller. */
async function DestinationName({ slug, locale }: { slug: string; locale: Locale }) {
  return <>{(await placeName(slug, locale)) ?? slug}</>;
}
