"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getTranslator, isLocale, type Locale, type MessageKey } from "@/lib/i18n";
import {
  buildPlan, startHour, TIER_LABEL,
  type DaysBucket, type Interest, type Origin, type Pace, type Budget, type Party,
} from "@/lib/plan";
import { RouteMap, type RoutePoint } from "@/components/route-map";
import { DESTINATIONS } from "@/lib/destinations";
import { toLocalInput } from "@/lib/format";

interface TourInfo { slug: string; title: string; durationDays: number }

const ORIGINS: Origin[] = ["tbilisi", "kutaisi", "batumi"];
const DAYS: DaysBucket[] = ["1", "3", "5", "7"];
const INTERESTS: Interest[] = ["nature", "culture", "wine", "sea", "adventure", "rest"];
const PACES: Pace[] = ["calm", "balanced", "active"];
const BUDGETS: Budget[] = ["economy", "middle", "comfort", "premium"];
const PARTIES: Party[] = ["solo", "couple", "family", "friends"];

const INTEREST_KEY: Record<Interest, MessageKey> = {
  nature: "plan.int1", culture: "plan.int2", wine: "plan.int3",
  adventure: "plan.int4", rest: "plan.int5", sea: "plan.int6",
};
const PACE_KEY: Record<Pace, MessageKey> = {
  calm: "plan.pace1", balanced: "plan.pace2", active: "plan.pace3",
};
const BUDGET_KEY: Record<Budget, MessageKey> = {
  economy: "plan.budget1", middle: "plan.budget2", comfort: "plan.budget3", premium: "plan.budget4",
};
const PARTY_KEY: Record<Party, MessageKey> = {
  solo: "plan.party1", couple: "plan.party2", family: "plan.party3", friends: "plan.party4",
};
const DAY_LABEL_KEY = { "1": "home.day1t", "3": "home.day2t", "5": "home.day3t", "7": "home.day4t" } as const;

/**
 * The five-question wizard. State lives in the URL (?o=&d=&i=&pace=&b=&p=), so
 * a plan is shareable and survives a reload without an account or a database
 * row. Links shared before the wizard grew keep working: an absent answer
 * falls back to the value the plan was built with when it only asked three.
 */
export interface PlanPlace { name: string; lat: number; lon: number }

export function PlanWizard({
  locale, tours, places, tourStops, initial,
}: {
  locale: string;
  tours: TourInfo[];
  places: Record<string, PlanPlace>;
  /** Ordered location slugs for each tour, so a tour day can be drawn. */
  tourStops: Record<string, string[]>;
  initial?: { o?: string; d?: string; i?: string; pace?: string; b?: string; p?: string };
}) {
  const t = getTranslator(isLocale(locale) ? (locale as Locale) : "en");

  const pick = <T extends string>(all: T[], raw: string | undefined, fallback: T): T =>
    all.includes(raw as T) ? (raw as T) : fallback;

  const [origin, setOrigin] = useState<Origin>(pick(ORIGINS, initial?.o, "tbilisi"));
  const [days, setDays] = useState<DaysBucket>(pick(DAYS, initial?.d, "3"));
  const [interests, setInterests] = useState<Interest[]>(
    initial?.i?.split(",").filter((x): x is Interest => INTERESTS.includes(x as Interest)) ?? ["nature"],
  );
  const [pace, setPace] = useState<Pace>(pick(PACES, initial?.pace, "balanced"));
  const [budget, setBudget] = useState<Budget>(pick(BUDGETS, initial?.b, "middle"));
  const [party, setParty] = useState<Party>(pick(PARTIES, initial?.p, "couple"));
  const [built, setBuilt] = useState(Boolean(initial?.d));
  const [copied, setCopied] = useState(false);

  const plan = useMemo(
    () => buildPlan({ origin, days, interests, pace, budget, party }),
    [origin, days, interests, pace, budget, party],
  );
  const tourBySlug = useMemo(() => new Map(tours.map((x) => [x.slug, x])), [tours]);
  const name = (slug: string) => places[slug]?.name ?? slug;

  const shareUrl = () =>
    `${location.origin}/${locale}/plan?o=${origin}&d=${days}&i=${interests.join(",")}` +
    `&pace=${pace}&b=${budget}&p=${party}`;

  const pill = (active: boolean) =>
    `rounded-lg border px-4 py-2.5 text-sm transition-colors ${
      active ? "border-ink-900 bg-ink-900 text-white dark:text-pine-900" : "border-ink-300 text-ink-900 hover:border-ink-500"
    }`;

  /* Local time, not UTC — the booking bar's own copy of this was four hours
     out until CR-2026-0019 and this one still was. The hour comes from the
     pace, so a calm plan does not propose a departure at eight. */
  const when = () => {
    const d = new Date(Date.now() + 48 * 3600_000);
    d.setHours(startHour(pace), 0, 0, 0);
    return toLocalInput(d);
  };

  /** Everything the search needs about the car, from the two answers that
      decide it. Omitted rather than sent empty when it would match nothing. */
  const carParams = () => {
    const p = new URLSearchParams();
    p.set("passengers", String(plan.booking.passengers));
    p.set("luggage", String(plan.booking.luggage));
    if (plan.booking.childSeat) p.set("childSeat", "1");
    if (plan.booking.tier) p.set("tier", plan.booking.tier);
    return p.toString();
  };

  const primaryHref =
    plan.primary.kind === "tour"
      ? `/${locale}/tours/${plan.primary.slug}`
      : `/${locale}/search?from=${plan.primary.from}&to=${plan.primary.to}` +
        `${plan.primary.stops.map((s) => `&stop=${s}`).join("")}&when=${when()}&${carParams()}`;

  /*
   * The plan flattened into an ordered list of points to draw. A tour day
   * contributes the tour's own stops, a places day contributes its places,
   * and anything without coordinates is dropped rather than guessed at.
   */
  const routePoints = useMemo<RoutePoint[]>(() => {
    const out: RoutePoint[] = [];
    plan.days.forEach((day, i) => {
      const slugs = day.tourSlug ? (tourStops[day.tourSlug] ?? []) : day.places;
      for (const slug of slugs) {
        const place = places[slug];
        if (place) {
          out.push({
            slug, name: place.name, lat: place.lat, lon: place.lon, day: i + 1,
            labelPos: DESTINATIONS.find((d) => d.slug === slug)?.labelPos,
          });
        }
      }
    });
    return out;
  }, [plan, places, tourStops]);

  const question = (title: string, body: React.ReactNode) => (
    <section>
      <h2 className="text-base font-bold tracking-[-0.02em] text-ink-900">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">{body}</div>
    </section>
  );

  return (
    <div className="space-y-10">
      {question(t("plan.qOrigin"), ORIGINS.map((o) => (
        <button key={o} type="button" onClick={() => setOrigin(o)} className={pill(origin === o)}>
          {name(o)}
        </button>
      )))}

      {question(t("plan.qDays"), DAYS.map((d) => (
        <button key={d} type="button" onClick={() => setDays(d)} className={pill(days === d)}>
          {t(DAY_LABEL_KEY[d])}
        </button>
      )))}

      {question(t("plan.qInterests"), INTERESTS.map((i) => (
        <button
          key={i} type="button"
          onClick={() => setInterests((cur) => cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i])}
          className={pill(interests.includes(i))}
          aria-pressed={interests.includes(i)}
        >
          {t(INTEREST_KEY[i])}
        </button>
      )))}

      {question(t("plan.qPace"), PACES.map((p) => (
        <button key={p} type="button" onClick={() => setPace(p)} className={pill(pace === p)}>
          {t(PACE_KEY[p])}
        </button>
      )))}

      {question(t("plan.qBudget"), BUDGETS.map((b) => (
        <button key={b} type="button" onClick={() => setBudget(b)} className={pill(budget === b)}>
          {t(BUDGET_KEY[b])}
        </button>
      )))}

      {!built && (
        <button
          type="button"
          onClick={() => setBuilt(true)}
          className="inline-flex min-h-12 items-center rounded-lg bg-brand-600 px-6 py-3 text-white shadow-[0_0_2px_0_rgba(0,0,0,.16)] transition-colors hover:bg-brand-700"
        >
          {t("plan.submit")}
        </button>
      )}

      {built && (
        <section className="rounded-lg border border-ink-300 bg-white p-6 sm:p-8">
          <h2 className="font-display text-3xl text-ink-900">{t("plan.resultsTitle")}</h2>
          <p className="mt-2 text-ink-500">{t("plan.resultsLead")}</p>

          <ol className="mt-6 space-y-4">
            {plan.days.map((day, i) => {
              const tour = day.tourSlug ? tourBySlug.get(day.tourSlug) : undefined;
              return (
                <li key={i} className="flex gap-4 border-t border-ink-200 pt-4 first:border-t-0 first:pt-0">
                  <span className="w-20 shrink-0 text-sm font-bold tracking-[-0.02em] text-ink-900">
                    {t("plan.day", { n: i + 1 })}
                  </span>
                  <div>
                    {tour ? (
                      <Link href={`/${locale}/tours/${tour.slug}`} className="font-bold tracking-[-0.02em] text-ink-900 underline underline-offset-4">
                        {tour.title}
                      </Link>
                    ) : (
                      <span className="text-ink-900">
                        {day.places.map(name).join(" → ") || t("plan.freeDay")}
                      </span>
                    )}
                    {day.noteKey && (
                      <p className="mt-1 text-sm text-ink-500">{t(day.noteKey)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {routePoints.length >= 2 && (
            <div className="mt-6">
              <RouteMap points={routePoints} label={t("plan.mapLabel")} />
            </div>
          )}

          {/*
            * What the supply could not do, said plainly. A plan that quietly
            * returns something other than what was asked for teaches the
            * reader that the questions are decoration.
            */}
          {plan.notes.length > 0 && (
            <ul className="mt-6 space-y-1.5 border-t border-ink-200 pt-4">
              {plan.notes.map((n) => (
                <li key={n} className="text-sm leading-relaxed text-ink-600">{t(n)}</li>
              ))}
            </ul>
          )}

          {/*
            * Who is travelling sits here rather than up with the questions,
            * because it changes the car and not the route — and because for a
            * year it sat up there changing nothing at all.
            */}
          <div className="mt-8 border-t border-ink-200 pt-6">
            <h3 className="text-base font-bold tracking-[-0.02em] text-ink-900">{t("plan.qParty")}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {PARTIES.map((p) => (
                <button key={p} type="button" onClick={() => setParty(p)} className={pill(party === p)}>
                  {t(PARTY_KEY[p])}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-500">
              {plan.booking.tier
                ? t("plan.carWith", { car: t(TIER_LABEL[plan.booking.tier]) })
                : t("plan.carAny")}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={primaryHref}
              className="inline-flex min-h-12 items-center rounded-lg bg-brand-600 px-6 py-3 text-white shadow-[0_0_2px_0_rgba(0,0,0,.16)] transition-colors hover:bg-brand-700"
            >
              {plan.primary.kind === "tour" ? t("plan.bookTour") : t("plan.bookTransfer")}
            </Link>
            <Link href={`/${locale}#book`} className="rounded-lg border border-ink-300 px-5 py-3 text-sm text-ink-900 hover:border-ink-500">
              {t("plan.adjust")}
            </Link>
            <button
              type="button"
              onClick={async () => { try { await navigator.clipboard.writeText(shareUrl()); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {} }}
              className="rounded-lg border border-ink-300 px-5 py-3 text-sm text-ink-900 hover:border-ink-500"
            >
              {copied ? t("plan.shared") : t("plan.share")}
            </button>
            <button type="button" onClick={() => setBuilt(false)} className="px-2 py-3 text-sm text-ink-500 hover:text-ink-900">
              {t("plan.startOver")}
            </button>
          </div>
          <p className="mt-4 text-xs text-ink-500">{t("plan.note")}</p>
        </section>
      )}
    </div>
  );
}
