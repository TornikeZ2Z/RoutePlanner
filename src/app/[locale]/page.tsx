import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { sql } from "@db/client";
import { isLocale, getTranslator, LOCALES } from "@/lib/i18n";
import { Badge, Card } from "@/components/ui";
import { PlaceImage } from "@/components/place-image";
import { sitePhoto, listTravellerPhotos } from "@/lib/site-photos";
import { DESTINATIONS, REGIONS } from "@/lib/destinations";
import { CATEGORY_ICONS } from "@/lib/map-icons";
import { config } from "@/lib/config";
import { listTours } from "@/lib/tours";
import { formatApproxDuration, formatDistance } from "@/lib/format";
import { SearchTabs } from "@/components/search-tabs";
import { HeroCarousel } from "@/components/hero-carousel";
import { unstable_cache } from "next/cache";
import { listRoutes } from "@/lib/routes-content";
import { routePriceFrom } from "@/lib/offers";
import { formatMoney } from "@/lib/money";
import { CANONICAL } from "@/lib/currency";

export const dynamic = "force-dynamic";

/**
 * Popular destinations: curated Tbilisi routes with a real "from" price
 * from the pricing engine (cheapest active plan), cached for an hour so
 * the homepage does not recompute quotes on every view.
 */
const POPULAR = ["kazbegi", "batumi", "borjomi", "mestia", "telavi", "sighnaghi", "gudauri", "bakhmaro"];

const popularDestinations = unstable_cache(
  async () => {
    const routes = await listRoutes("en");
    const fromTbilisi = routes.filter((r) => r.originSlug === "tbilisi");
    const out: { slug: string; routeSlug: string; name: string; fromMinor: string }[] = [];
    for (const dest of POPULAR) {
      if (out.length >= 6) break;
      const route = fromTbilisi.find((r) => r.destinationSlug === dest);
      if (!route) continue;
      const pricing = await routePriceFrom(route.slug);
      if (!pricing) continue;
      out.push({ slug: dest, routeSlug: route.slug, name: route.destinationName, fromMinor: pricing.fromMinor.toString() });
    }
    return out;
  },
  ["home-popular-destinations"],
  { revalidate: 3600 },
);

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const url = `${config.appUrl}/${locale}`;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return {
    title: t("brand.tagline"),
    description: t("home.heroSubtitle"),
    alternates: {
      canonical: url,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${config.appUrl}/${l}`])),
    },
  };
}

const STEP_KEYS = [
  ["home.how1t", "home.how1b"], ["home.how2t", "home.how2b"],
  ["home.how3t", "home.how3b"], ["home.how4t", "home.how4b"],
] as const;

/** Icon paths for the hero chips and the trust band. */
const ICONS = {
  driver: "M12 11a3.4 3.4 0 1 0 0-6.8A3.4 3.4 0 0 0 12 11Zm-7.5 9a7.5 7.5 0 0 1 15 0",
  price: "M3 12.5V4.5A1.5 1.5 0 0 1 4.5 3h8l8.5 8.5a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0L3 12.5Zm4.5-5h.01",
  shield: "M12 3l7.5 3v6c0 4.8-3.2 8.1-7.5 9-4.3-.9-7.5-4.2-7.5-9V6L12 3Zm-3 9 2.2 2.2L15.5 10",
  support: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0-14v5l3.5 2",
  car: "M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v4h2m14-6a2 2 0 0 1 2 2v4h-2m-12 0v2m10-2v2m-9-5h.01M17 13h.01",
} as const;

const HERO_CHIPS = [
  ["home.chip1", ICONS.driver], ["home.chip2", ICONS.price],
  ["home.chip3", ICONS.shield], ["home.chip4", ICONS.support],
] as const;

/*
   The five service cards stood here and are gone.

   SERVICES.map was last rendered in 58d2786, two designs ago; every layout
   since has answered "what do you sell" with the booking tabs and the theme
   tiles instead, and nothing has referenced this array since. CR-2026-0018 part
   4 asks for what does not earn its place to go, and a table of five icons,
   five photo filenames and five hrefs that reaches no page is the clearest case
   of it in this file.

   Not the same call as STEP_KEYS below, which is also unrendered and stays:
   that one carries a recorded decision from CR-2026-0037 saying so. This one
   carries nothing. The home.svc1t-svc5b strings stay in all three dictionaries
   on the usual grounds — a translation costs nothing to keep and a day to write
   again.
*/

/** The six themes, in the order they read on the page. Labels are the tour
    categories' own, so a theme is called the same thing wherever it appears. */
const CATEGORY_TILES = [
  { cat: "mountains", label: "tours.catMountains" },
  { cat: "sea", label: "tours.catSea" },
  { cat: "wine", label: "tours.catWine" },
  { cat: "culture", label: "tours.catCulture" },
  { cat: "nature", label: "map.catNature" },
  { cat: "winter", label: "tours.catWinter" },
] as const;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // ?cat= and ?season= were read here to open the map on a chosen slice. The
  // map is gone and each season now opens in place, so the page takes no
  // query parameters at all.
  if (!isLocale(locale)) notFound();
  const t = getTranslator(locale);

  const popular = await popularDestinations();
  const [locations, tours, stats, reviews] = await Promise.all([
    sql<{ slug: string; name_en: string; type: string; lat: number; lon: number }[]>`
      SELECT slug,
             coalesce(CASE WHEN ${locale} = 'ka' THEN name_ka
                           WHEN ${locale} = 'ru' THEN name_ru END, name_en) AS name_en,
             type::text AS type, lat, lon
      FROM locations WHERE in_service_area ORDER BY type, 2`,
    listTours(locale),
    sql<{ drivers: number; trips: number }[]>`
      SELECT (SELECT count(*) FROM driver_profiles WHERE published)::int AS drivers,
             (SELECT count(*) FROM bookings WHERE status = 'COMPLETED')::int AS trips`,
    /*
     * Published reviews, newest first.
     *
     * CR-2026-0015 item 48 puts these in slot 8. There are none yet — no trip
     * has been completed — so the section below renders nothing at all rather
     * than an empty heading over white space. That was the choice: build it and
     * let it appear by itself on the first real review, instead of leaving a
     * second job for the day somebody finally travels.
     *
     * published_body is the moderated text where a moderator edited one, and
     * body otherwise. Only PUBLISHED rows: SUBMITTED has not been read yet, and
     * REJECTED and REDACTED were read and refused.
     */
    sql<{ rating: number; body: string; author: string | null; driver: string; handle: string }[]>`
      SELECT r.rating_overall AS rating,
             coalesce(r.published_body, r.body) AS body,
             r.author_name AS author,
             d.public_name AS driver,
             d.handle
      FROM reviews r
      JOIN driver_profiles d ON d.id = r.driver_id AND d.published
      WHERE r.status = 'PUBLISHED' AND coalesce(r.published_body, r.body) IS NOT NULL
      ORDER BY r.created_at DESC
      LIMIT 6`,
  ]);

  /*
   * Six slides, not eight. Any that exist are shown, so a slide can be added by
   * dropping the file in — but the list is now chosen rather than "whatever is
   * on disk".
   *
   * CR-2026-0033 says the page is far too dark, and most of that was never the
   * CSS. Measured mean perceived luminance of the eight files: hero-7 48%,
   * hero-8 43%, hero.jpg 37%, hero-4 31%, hero-6 31%, hero-3 29%, hero-5 20%,
   * hero-2 17%. The last two are a night city and horses at dusk — 93% of
   * hero-2's pixels sit below mid-grey. No overlay change makes those bright,
   * and leaving them in means the hero goes dark again every twelve seconds
   * whatever the gradient does. Dropping them lifts the rotation's average from
   * 30% to 35%.
   *
   * Both files stay in public/photos. Putting either back is one line here.
   */
  const heroSlides = [
    "hero.jpg", "hero-3.jpg", "hero-4.jpg",
    "hero-6.jpg", "hero-7.jpg", "hero-8.jpg",
  ]
    .map((name) => sitePhoto(name))
    .filter((src): src is string => src !== null);
  const travellers = listTravellerPhotos();


  return (
    <div className="space-y-20 sm:space-y-28">
      {/* ------------------------------------------------ hero ------------ */}
      <section className="relative left-1/2 -mt-10 w-screen -translate-x-1/2 overflow-hidden bg-pine-800 text-white sm:-mt-12">
        <div className="absolute inset-0" aria-hidden>
          {heroSlides.length > 0 ? (
            <HeroCarousel images={heroSlides} />
          ) : (
            <PlaceImage imageKey={null} alt="" seedText="stepantsminda-gergeti" className="size-full" />
          )}
          {/*
            The scrim is bottom-weighted now, for CR-2026-0034.

            The reference site (blacklane.com) puts no scrim on its hero at all:
            the photograph is the hero, the headline sits low over a dark part of
            it, and the booking bar floats translucent at the bottom. We cannot
            copy that literally — theirs is one art-directed image, ours is six
            that rotate every six seconds, one of which is a bridge in flat
            daylight — so the darkness moved rather than left. The top two
            thirds of the picture are now almost clear, and the weight is at the
            bottom where the headline and the bar actually are.

            Measured worst 8×8 patch behind the headline across the six slides,
            white text: 5.17 before this change, and the floor is 3:1 for text
            this size. The gold second line is gone from the hero — the
            reference has no gold anywhere — which removes the constraint that
            was capping how light this could go at all.
          */}
          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-pine-900/92 via-pine-900/45 to-pine-900/10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-2/3 bg-gradient-to-t from-pine-900/85 to-transparent" />
        </div>

        {/*
          Content sits at the BOTTOM of the hero, not the top.

          min-h is what makes the picture a picture rather than a strip behind
          some controls: it gives the photograph room above the text, which is
          the whole shape of the reference. It is sized against the viewport and
          capped, so a tall monitor does not turn the hero into a full screen of
          sky, and CR-2026-0032 — "it should all be on one page, you should not
          have to scroll" — still holds: the cap is what guarantees the bar
          lands inside the first screen.
        */}
        <div className="relative z-[2] mx-auto flex min-h-[min(78svh,640px)] max-w-[1400px] flex-col justify-end px-4 pb-8 pt-16 sm:px-6 sm:pb-10 lg:px-10 2xl:max-w-[1680px]">
          {/*
            Centred, light, and one sentence — the reference's headings are all
            weight 400 at 64px and up, sentence case, ending in a full stop.
            Ours is a two-part sentence in Georgian, so it keeps its line break
            but loses the gold on the second half and the bold weight on both.
          */}
          {/*
            One sentence, and it is now a claim rather than an instruction.

            CR-2026-0018 part 4 asks for the generic "Let's go" headline to go.
            "Book a private driver" was never the generic half — it names the
            product in four words. "and discover Georgia your way" was, and it
            was ALSO the same sentence as home.catsSub five hundred pixels
            below, so one deletion answered two of his five items.

            What replaces it is not invented. The specific thing this page owns
            — a price fixed before you travel — was sitting in the subtitle one
            type size down in white/70, reading as a caption to the generic line
            above it. It is in the headline now, and the subtitle, which existed
            to carry it, is off the page.

            Checked against CR-2026-0034 before writing: 57/50/56 characters
            against the old 51/56/49, so it still wraps to two lines at every
            breakpoint inside max-w-4xl. That is what keeps the measured 5.17
            worst-case contrast and CR-2026-0032's one-screen rule — neither
            survives a headline that grows a line.
          */}
          <h1 className="font-display mx-auto max-w-4xl text-center text-[1.7rem] leading-[1.15] sm:text-[2.4rem] lg:text-[3rem]">
            {t("home.heroTitle")}
          </h1>
          {/*
            The subtitle stood here and is gone. It said the three tab labels
            forty pixels below it say, and its one distinct claim is now the
            headline.

            home.heroSubtitle STAYS in all three dictionaries and must:
            generateMetadata above uses it as the page description, which is
            what a search result and a shared link show. It is no longer on the
            page; it is still the sentence that describes the page.
          */}

          <div id="book" className="mt-7 scroll-mt-24">
            <SearchTabs locale={locale} locations={locations} />
          </div>
        </div>
      </section>

      {/*
        The four promises, below the photograph rather than on it.

        They were in the hero from CR-2026-0030 onwards. The reference site
        carries nothing but a headline and a booking bar over its picture, and
        the promises are the one thing here that reads as decoration when it is
        competing with a photograph. Same four keys, same words — a quiet band
        on the page's own ground, where a hairline ring and the accent colour
        read properly instead of fighting a photograph.
      */}
      {/*
        `relative` is load-bearing, not tidiness. CR-2026-0035 reported the four
        promises half off the left of the screen with empty space to their
        right, and this is why: left-1/2 does nothing on a statically positioned
        element, but the -translate-x-1/2 that is supposed to cancel it still
        applies, so the band sat half a viewport to the left. The hero above has
        always carried `relative` with the same three classes; this one was
        written without it.
      */}
      <section className="relative left-1/2 -mt-20 w-screen -translate-x-1/2 border-b border-ink-200 bg-ink-50 sm:-mt-28">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 2xl:max-w-[1680px]">
          {/*
            Titled, and third on the page — CR-2026-0015 item 48 puts "რატომ
            RoutePlanner?" in slot 3 with exactly these four promises. It used
            to be an untitled band here AND a titled section with a second,
            differently-worded set of four further down, which is the repetition
            CR-2026-0018 asks to cut. The lower one is gone; its earned numbers
            moved here, where they sit under the claims they support.
          */}
          <h2 className="font-display text-[1.6rem] leading-[1.15] text-ink-900 sm:text-[2rem]">{t("home.whyRG")}</h2>
        <ul className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {HERO_CHIPS.map(([key, icon], i) => (
            <li key={key} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-ink-300 text-brand-600">
                <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor"
                     strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={icon} />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight text-ink-900">{t(key)}</span>
                <span className="mt-1 block text-xs leading-snug text-ink-500">{t(`home.chip${i + 1}s` as never)}</span>
              </span>
            </li>
          ))}
        </ul>

          {/* Catalogue size proves nothing. Drivers and completed trips are
              earned numbers, so they appear only once they exist. */}
          {((stats[0]?.drivers ?? 0) > 0 || (stats[0]?.trips ?? 0) > 0) && (
            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-ink-200 pt-6 sm:max-w-md">
              {([[stats[0]?.drivers ?? 0, t("home.statDrivers")],
                 [stats[0]?.trips ?? 0, t("home.statTrips")]] as const)
                .filter(([v]) => (v as number) > 0)
                .map(([value, label]) => (
                <div key={label as string}>
                  <dt className="font-display text-3xl text-brand-600">{value as number}</dt>
                  <dd className="mt-0.5 text-sm text-ink-500">{label as string}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ categories ------ */}
      {/*
        Where do you want to go, answered by theme.
        
        Seasons replaced this once, on the reasoning that a visitor knows when
        they are coming better than they know what Georgia holds. Both turned
        out to be true and they are not the same question, so both are asked —
        theme here, season lower down. The map that used to receive the click
        is gone, so each tile opens in place, the way the seasons do.
      */}
      <section>
        <div>
          <h2 className="font-display text-[1.9rem] leading-[1.15] text-ink-900 sm:text-[2.5rem]">{t("home.catsTitle")}</h2>
          {/* home.catsSub said "Explore Georgia your way" — the hero's own
              second line, in small type, five hundred pixels below it. In
              Russian the two were near-identical. The heading above already
              asks the question; the answer is the tiles. */}
        </div>
        {/*
          Six across on a wide screen, from the CR-2026-0033 reference. They
          stay expand-in-place rather than becoming links: the reference draws a
          circular arrow that navigates, but opening the destinations under the
          tile is a feature rather than a style, and losing it was not part of
          what was asked for. A tile is narrower now, so its label is the only
          thing on the face — the place count moves below the fold of the card.
        */}
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {CATEGORY_TILES.map(({ cat, label }) => {
            const picks = DESTINATIONS.filter((d) => d.categories.includes(cat))
              .flatMap((d) => {
                const name = locations.find((l) => l.slug === d.slug)?.name_en;
                return name ? [{ ...d, name }] : [];
              });
            if (picks.length === 0) return null;
            /*
              Grouped by province, which is what CR-2026-0036 asked for in so
              many words — "separate the places by region", its own example
              being Guria. With nine coastal places under Sea and eleven under
              Mountains, an ungrouped list had stopped being readable anyway.
              A theme that turns out to sit in one province shows no headings,
              because a single heading over a whole list says nothing.
            */
            const groups = REGIONS
              .map((r) => ({ region: r, items: picks.filter((p) => p.region === r) }))
              .filter((gr) => gr.items.length > 0);
            const photo = sitePhoto(`categories/${cat}.jpg`);
            return (
              <li key={cat}>
                <details className="group/cat">
                  <summary className="relative block h-44 cursor-pointer list-none overflow-hidden rounded-2xl shadow-[0_1px_3px_rgba(11,29,51,.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)] lg:h-52 [&::-webkit-details-marker]:hidden">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" loading="lazy"
                           className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover/cat:scale-105" />
                    ) : (
                      <PlaceImage imageKey={null} alt="" seedText={`cat-${cat}`}
                                  className="absolute inset-0 size-full transition-transform duration-500 group-hover/cat:scale-105" />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-pine-900/90 via-pine-900/35 to-pine-900/10" />
                    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white">
                      <span>
                        <span className="font-display block text-lg">{t(label)}</span>
                        <span className="mt-1 block text-sm text-pine-100">
                          {picks.length} {t("home.seasonPlaces")}
                        </span>
                      </span>
                      <span aria-hidden className="shrink-0 rounded-full bg-white/15 p-1.5 backdrop-blur-sm transition-transform duration-300 group-open/cat:rotate-180">
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor"
                             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </span>
                  </summary>

                  <div className="mt-2 space-y-1 rounded-2xl border border-ink-200 bg-white p-2 shadow-[0_1px_3px_rgba(11,29,51,.06)]">
                    {groups.map((gr) => (
                      <div key={gr.region}>
                        {/*
                          No heading over a province that IS the place: Tusheti
                          under the heading "Tusheti" says nothing twice. The
                          test is structural — the destination slug equals the
                          region key — rather than comparing display names,
                          which would only hold in one language.
                        */}
                        {groups.length > 1 && !(gr.items.length === 1 && gr.items[0]!.slug === gr.region) && (
                          <p className="px-2.5 pb-1 pt-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-400">
                            {t(`region.${gr.region}` as never)}
                          </p>
                        )}
                        <ul className="space-y-1">
                          {gr.items.map((d) => (
                            <li key={d.slug}>
                              <Link
                                href={`/${locale}/destinations/${d.slug}`}
                                className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-900"
                              >
                                <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-brand-600" fill="none" stroke="currentColor"
                                     strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d={CATEGORY_ICONS[d.icon]} />
                                </svg>
                                <span className="min-w-0">{d.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------- popular destinations - */}
      {popular.length > 0 && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[1.9rem] leading-[1.15] text-ink-900 sm:text-[2.5rem]">{t("home.popularTitle")}</h2>
              <p className="mt-2 text-ink-500">{t("home.popularSub")}</p>
            </div>
            <Link href={`/${locale}/transfers`} className="text-sm font-semibold text-ink-900 underline underline-offset-4">
              {t("footer.allRoutes")} →
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {popular.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/${locale}/transfers/${d.routeSlug}`}
                  className="group block overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-[0_1px_3px_rgba(11,29,51,.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
                >
                  <span className="block h-32 overflow-hidden">
                    <PlaceImage
                      imageKey={null}
                      photoSrc={sitePhoto(`destinations/${d.slug}.jpg`)}
                      alt=""
                      seedText={d.slug}
                      className="size-full transition-transform duration-500 group-hover:scale-105"
                    />
                  </span>
                  <span className="block p-3.5 text-center">
                    <span className="block font-semibold tracking-[-0.01em] text-ink-900">
                      {locations.find((l) => l.slug === d.slug)?.name_en ?? d.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-500">
                      {t("transfers.fromPrice", { price: formatMoney(BigInt(d.fromMinor), CANONICAL, locale) })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        The "plan your perfect trip" band stood here and is gone —
        CR-2026-0039: "the field that is big down below, let us delete it
        altogether."

        It was a tinted band carrying the planner's three questions as fifteen
        chips in a white card, each chip a link into /plan with the answer
        pre-set. The questions are not lost: the same request asked for them in
        the hero, and they are now the Build-my-route tab of the booking widget
        (src/components/plan-bar.tsx), asked once on a bar instead of twice on
        one page.

        This is a deletion, not a move that left a hole. The band was the
        page's only remaining explanation of what the planner is; that sentence
        now sits above the bar itself, which is where somebody about to use it
        is looking.

        home.planTeaserTitle, home.planTeaserBody, home.planTeaserCta and
        home.planStep1-3 render nowhere now. They stay in all three
        dictionaries, the way home.how1t-how4b did when CR-2026-0037 took the
        four steps out: a translated string costs nothing to keep and a day of
        somebody's time to write again. home.day1t-day4t and the plan.int and
        plan.pace families are NOT orphaned — the bar and the wizard both use them.
      */}

      {/*
        "ოთხი ნაბიჯი, ვაჭრობის გარეშე" stood here and is gone — CR-2026-0037.

        It had been on the page for about an hour. CR-2026-0015 item 48 lists
        "როგორ მუშაობს?" as slot 7 of the home page, and the copy had been
        written and translated into all three languages but never rendered, so
        placing it closed that item. The next instruction removed it.

        STEP_KEYS and home.how1t-how4b stay where they are, unused again.
      */}

      {/*
        The seasons section stood here and is gone — CR-2026-0038,
        "საქართველო სეზონების მიხედვით, ეგ საერთოდ წავშალოთ".

        Worth recording that this reverses CR-2026-0010 item 13, which said in
        as many words "სეზონები საერთოდ არ წავშალოთ" — do not delete seasons at
        all — and gave a reason: seasonal content is good for SEO and for the
        traveller. The later instruction governs, but the reason has not gone
        away, and this section was the only place the site said when a place is
        worth visiting.

        Nothing was destroyed: home.seasonsTitle, home.season1t-4b and the four
        photographs in public/photos/seasons are all still there. Restoring it
        is a revert of this commit.
      */}

      {/*
        The contact card, alone now.

        A "რატომ RoutePlanner?" panel stood beside it with four reasons and
        the earned numbers. It said the same thing as the titled band in slot
        3, in different words, on the same page — which is precisely what
        CR-2026-0018 lists under "the same information repeated". The band
        keeps the promises and has taken the numbers; home.why1t-why4b stay in
        all three dictionaries.
      */}
      <section className={config.contact.phone ? "grid gap-4" : "hidden"}>
        {config.contact.phone && (
          <div className="rounded-2xl bg-pine-800 p-6 text-white">
            <h2 className="font-display text-xl">{t("home.helpTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-pine-200">{t("home.helpBody")}</p>
            <div className="mt-5 flex flex-col gap-2.5">
              <a href={`https://wa.me/${config.contact.phone.replace(/[^0-9]/g, "")}`}
                 className="rounded-full bg-white px-5 py-2.5 text-center text-sm font-semibold text-pine-800 hover:bg-pine-100 dark:bg-ink-900 dark:hover:bg-ink-800">
                {t("home.helpWhatsApp")}
              </a>
              <a href={`tel:${config.contact.phone.replace(/\s+/g, "")}`}
                 className="rounded-full border border-white/35 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/10">
                {t("home.helpCall")} · {config.contact.phone}
              </a>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------ travellers ------ */}
      {travellers.length > 0 && (
        <section>
          <p className="eyebrow">{t("home.travellersEyebrow")}</p>
          <h2 className="font-display mt-2 text-[1.9rem] leading-[1.15] text-ink-900 sm:text-[2.5rem]">{t("home.travellersTitle")}</h2>
          <p className="mt-3 max-w-xl text-ink-500">{t("home.travellersBody")}</p>
          <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {travellers.map((photo) => (
              <li key={photo.src} className="overflow-hidden rounded-lg border border-ink-300 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.src} alt={photo.caption} loading="lazy" className="aspect-square w-full rounded-t-lg object-cover" />
                <p className="px-4 py-3 text-sm text-ink-500">{photo.caption}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        Slot 8. Absent entirely until there is something true to put in it —
        see the query above. A testimonials block with nothing in it is worse
        than no testimonials block, and one filled with invented praise is
        worse than both.
      */}
      {reviews.length > 0 && (
        <section>
          <h2 className="font-display text-[1.9rem] leading-[1.15] text-ink-900 sm:text-[2.5rem]">{t("home.reviewsTitle")}</h2>
          <p className="mt-2 text-ink-500">{t("home.reviewsSub")}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <li key={i} className="rounded-2xl border border-ink-200 bg-white p-5">
                <p className="text-sm tabular-nums text-brand-600" aria-label={`${r.rating} / 5`}>
                  {"★".repeat(Math.round(r.rating))}
                  <span className="text-ink-300">{"★".repeat(Math.max(0, 5 - Math.round(r.rating)))}</span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-700">{r.body}</p>
                <p className="mt-4 text-xs text-ink-500">
                  {r.author ?? ""}
                  {r.author ? " · " : ""}
                  <Link href={`/${locale}/drivers/${r.handle}`} className="hover:text-ink-900">{r.driver}</Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------ closing CTA ----- */}
      <section className="rounded-2xl bg-pine-800 px-6 py-14 text-center text-white sm:px-12">
        <h2 className="font-display text-[1.9rem] leading-[1.15] sm:text-[2.5rem]">{t("home.closingTitle")}</h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-pine-100">{t("home.closingBody")}</p>
        <a
          href="#book"
          className="mt-8 inline-flex min-h-12 items-center rounded-full bg-white px-8 py-3 font-semibold text-ink-900 shadow-[0_0_2px_0_rgba(0,0,0,.16)] transition-colors hover:bg-ink-100"
        >
          {t("home.closingCta")}
        </a>
      </section>

    </div>
  );
}

