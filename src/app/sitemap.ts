import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { LOCALES } from "@/lib/i18n";
import { listRoutes } from "@/lib/routes-content";
import { listTours } from "@/lib/tours";
import { DESTINATIONS } from "@/lib/destinations";
import { sql } from "@db/client";

export const revalidate = 3600;

/**
 * Only publicly meaningful, indexable URLs. Search, checkout, driver and admin
 * surfaces are excluded here and additionally noindexed at the header level.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
   * Every dynamic section degrades on its own.
   *
   * This file is prerendered during `next build`, so an unreachable database
   * at that moment took the entire deploy down with it — the build fails, the
   * previous version keeps serving, and every unrelated fix waiting behind it
   * stops shipping. A sitemap missing its tour URLs for one revalidation cycle
   * costs a little crawl freshness; a failed deploy costs everything in the
   * queue. lib/settings.ts already takes this position for pricing ("a
   * settings table is not allowed to be a way to break the business") and the
   * same reasoning applies here.
   *
   * The static URLs below need no database at all, and they are the ones that
   * matter most for indexing.
   */
  const degrade = async <T>(what: string, run: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await run();
    } catch (error) {
      console.error(`sitemap: ${what} unavailable, omitted from this build`, error);
      return [];
    }
  };

  const [routes, tours, drivers] = await Promise.all([
    degrade("routes", () => listRoutes("en")),
    degrade("tours", () => listTours("en")),
    degrade("drivers", () => sql<{ handle: string; updated_at: Date }[]>`
      SELECT handle, updated_at FROM driver_profiles
      WHERE published AND status = 'APPROVED'`),
  ]);

  const alternates = (path: string) => ({
    languages: Object.fromEntries(LOCALES.map((l) => [l, `${config.appUrl}/${l}${path}`])),
  });

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    entries.push(
      { url: `${config.appUrl}/${locale}`, changeFrequency: "weekly", priority: 1, alternates: alternates("") },
      { url: `${config.appUrl}/${locale}/transfers`, changeFrequency: "weekly", priority: 0.9, alternates: alternates("/transfers") },
      { url: `${config.appUrl}/${locale}/tours`, changeFrequency: "weekly", priority: 0.9, alternates: alternates("/tours") },
      { url: `${config.appUrl}/${locale}/faq`, changeFrequency: "monthly", priority: 0.4, alternates: alternates("/faq") },
      { url: `${config.appUrl}/${locale}/about`, changeFrequency: "monthly", priority: 0.5, alternates: alternates("/about") },
      { url: `${config.appUrl}/${locale}/business`, changeFrequency: "monthly", priority: 0.5, alternates: alternates("/business") },
      { url: `${config.appUrl}/${locale}/schools`, changeFrequency: "monthly", priority: 0.5, alternates: alternates("/schools") },
      { url: `${config.appUrl}/${locale}/destinations`, changeFrequency: "weekly", priority: 0.8, alternates: alternates("/destinations") },
      { url: `${config.appUrl}/${locale}/contact`, changeFrequency: "monthly", priority: 0.5, alternates: alternates("/contact") },
      { url: `${config.appUrl}/${locale}/drive`, changeFrequency: "monthly", priority: 0.6, alternates: alternates("/drive") },
      { url: `${config.appUrl}/${locale}/legal/terms`, changeFrequency: "yearly", priority: 0.3, alternates: alternates("/legal/terms") },
      { url: `${config.appUrl}/${locale}/legal/privacy`, changeFrequency: "yearly", priority: 0.3, alternates: alternates("/legal/privacy") },
      { url: `${config.appUrl}/${locale}/legal/cancellation`, changeFrequency: "yearly", priority: 0.3, alternates: alternates("/legal/cancellation") },
    );

    // One page per curated destination. These come from a constant, not the
    // database, so unlike the sections above they cannot be lost to a blip.
    for (const dest of DESTINATIONS) {
      entries.push({
        url: `${config.appUrl}/${locale}/destinations/${dest.slug}`,
        changeFrequency: "monthly",
        priority: 0.7,
        alternates: alternates(`/destinations/${dest.slug}`),
      });
    }

    for (const tour of tours) {
      entries.push({
        url: `${config.appUrl}/${locale}/tours/${tour.slug}`,
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: alternates(`/tours/${tour.slug}`),
      });
    }

    for (const r of routes) {
      entries.push({
        url: `${config.appUrl}/${locale}/transfers/${r.slug}`,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: alternates(`/transfers/${r.slug}`),
      });
    }

    for (const d of drivers) {
      entries.push({
        url: `${config.appUrl}/${locale}/drivers/${d.handle}`,
        lastModified: d.updated_at,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
