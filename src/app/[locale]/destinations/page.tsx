import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, getTranslator, LOCALES, type Locale, type MessageKey } from "@/lib/i18n";
import { config } from "@/lib/config";
import { DESTINATIONS } from "@/lib/destinations";
import { sitePhoto } from "@/lib/site-photos";
import { sql } from "@db/client";
import { PlaceImage } from "@/components/place-image";

export const revalidate = 3600;

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale as Locale);
  return {
    title: t("dest.indexTitle"),
    description: t("dest.indexLead"),
    alternates: {
      canonical: `${config.appUrl}/${locale}/destinations`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `${config.appUrl}/${l}/destinations`]),
      ),
    },
  };
}

/**
 * Every curated destination, in one place.
 *
 * The homepage shows them a handful at a time, grouped by theme or season.
 * This is the flat list — the page a search engine can crawl to reach all
 * twenty-three, and the page a traveller lands on when they want to see what
 * there is rather than be asked what they like.
 */
export default async function DestinationsIndex({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getTranslator(locale as Locale);

  // One query for every name, rather than one per tile.
  const col = locale === "ka" ? "name_ka" : locale === "ru" ? "name_ru" : "name_en";
  const rows = await sql<{ slug: string; name: string }[]>`
    SELECT slug, coalesce(${sql.unsafe(col)}, name_en) AS name
    FROM locations WHERE slug = ANY(${DESTINATIONS.map((d) => d.slug)})`;
  const names = new Map(rows.map((r) => [r.slug, r.name]));

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">{t("dest.eyebrow")}</p>
        <h1 className="font-display mt-2 text-4xl text-ink-900 sm:text-5xl">{t("dest.indexTitle")}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">{t("dest.indexLead")}</p>
      </header>

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {DESTINATIONS.map((d) => {
          const name = names.get(d.slug);
          if (!name) return null;
          const photo = sitePhoto(`destinations/${d.slug}.jpg`);
          return (
            <li key={d.slug}>
              <Link
                href={`/${locale}/destinations/${d.slug}`}
                className="group relative block h-44 overflow-hidden rounded-2xl shadow-[0_1px_3px_rgba(11,29,51,.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" loading="lazy"
                       className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <PlaceImage imageKey={null} alt="" seedText={d.slug} className="absolute inset-0 size-full" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-pine-900/90 via-pine-900/30 to-pine-900/5" />
                <span className="absolute inset-x-0 bottom-0 p-4">
                  <span className="font-display block text-lg text-white">{name}</span>
                  <span className="mt-0.5 block text-xs text-pine-100">
                    {t(`map.d.${d.slug}` as MessageKey).slice(0, 58)}…
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
