"use client";

import { useState } from "react";
import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { getTranslator, isLocale, type Locale } from "@/lib/i18n";

interface LocationOption { slug: string; name_en: string; type: string }

/**
 * The booking widget's mode switcher: Transfer, Tours, Build my route.
 *
 * Transfer carries a one-way / round-trip toggle inside the panel, with a
 * quiet link to hourly hire (no online pricing yet, so it routes to an
 * inquiry rather than pretending). Tours points at the curated catalogue;
 * Build my route hands over to the three-question planner.
 *
 * Pills, and no explaining line under the label.
 *
 * That line existed for a reason: CR-2026-0008 item 4 said the three names read
 * as near-synonyms to someone who has not used the site, and a visitor who
 * cannot tell them apart picks the first one. It has been removed anyway, on
 * the reference layout attached to CR-2026-0033 and an explicit instruction to
 * follow that reference where it conflicts with an earlier decision.
 *
 * What is left carrying that job is the icon and the pill shape, which is
 * thinner cover than a sentence. If people start booking transfers when they
 * wanted tours, this is the first place to look, and the keys — home.tabTransferSub,
 * home.tabToursSub, home.tabPlanSub — are still in all three dictionaries.
 */
const PANELS = ["transfer", "tours", "plan"] as const;

export function SearchTabs({ locale, locations }: { locale: string; locations: LocationOption[] }) {
  const t = getTranslator(isLocale(locale) ? (locale as Locale) : "en");
  const [tab, setTab] = useState<(typeof PANELS)[number]>("transfer");
  const [roundTrip, setRoundTrip] = useState(false);

  const tabs = [
    { id: "transfer" as const, label: t("home.tabTransfer"), sub: t("home.tabTransferSub"), icon: "M3 15h18M5 15V9a2 2 0 0 1 2-2h7l4 4h1a2 2 0 0 1 2 2v2M7.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" },
    { id: "tours" as const, label: t("home.tabTours"), sub: t("home.tabToursSub"), icon: "M9 20l-5-2V5l5 2m0 13 6-2m-6 2V7m6 11 5 2V7l-5-2m0 13V5M9 7l6-2" },
    { id: "plan" as const, label: t("nav.plan"), sub: t("home.tabPlanSub"), icon: "M9 6h11M9 12h11M9 18h11M4.5 7.5 6 6v4.5M4 13.5h3L4 17h3" },
  ];

  return (
    <div>
      <div role="tablist" aria-label={t("home.planTitle")} className="mx-auto flex w-fit flex-wrap justify-center gap-1 rounded-full border border-white/25 bg-white/10 p-1 backdrop-blur-md">
        {tabs.map(({ id, label, sub, icon }) => (
          <button
            key={id} role="tab" type="button"
            aria-selected={tab === id}
            title={sub}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 transition-colors sm:px-4 ${
              tab === id ? "bg-white text-ink-900" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={icon} />
            </svg>
            <span className="text-xs font-semibold leading-tight sm:text-[13px]">{label}</span>
          </button>
        ))}
      </div>

      {/*
        All three panels occupy one grid cell from sm up, so the widget is as
        tall as its tallest panel whichever one is open.

        This exists because the card moved inside the hero (CR-2026-0030). The
        hero's height is now its content's height, so a short panel made the
        photograph and everything under it jump up by the difference every time
        someone tried Tours — about 85px on a laptop. Reserving the space costs
        some white inside the two teaser panels, which is why their content
        centres in it; a page that moves under the reader costs more.

        Below sm the inactive panels are display:none instead. There the
        transfer form stacks into a column four times the height of a teaser,
        and reserving THAT would leave half a screen of nothing.

        Presence is therefore no longer the same as being open: data-active
        says which one is, for anything that needs to ask.
      */}
      <div className="grid pt-5">
        {PANELS.map((id) => {
          const open = tab === id;
          return (
            <div
              key={id}
              role="tabpanel"
              data-active={open}
              aria-hidden={!open}
              inert={!open}
              className={`col-start-1 row-start-1 flex-col justify-center ${
                open ? "flex" : "hidden sm:flex sm:invisible"
              }`}
            >
              {id === "transfer" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div role="radiogroup" aria-label={t("home.tabTransfer")}
                         className="inline-flex rounded-full border border-white/25 bg-white/10 p-0.5 text-xs font-semibold backdrop-blur-md">
                      {([false, true] as const).map((rt) => (
                        <button
                          key={String(rt)} type="button" role="radio" aria-checked={roundTrip === rt}
                          onClick={() => setRoundTrip(rt)}
                          className={`rounded-full px-3.5 py-1.5 transition-colors ${
                            roundTrip === rt ? "bg-white text-ink-900" : "text-white/70 hover:text-white"
                          }`}
                        >
                          {rt ? t("home.tabRoundTrip") : t("home.tabOneWay")}
                        </button>
                      ))}
                    </div>
                    <Link href={`/${locale}/hourly`}
                          className="text-xs font-medium text-white/70 underline-offset-2 hover:text-white hover:underline">
                      {t("home.tabHourly")} →
                    </Link>
                  </div>
                  {roundTrip
                    ? <SearchForm key="rt" locale={locale} locations={locations} tone="glass" roundTrip />
                    : <SearchForm key="ow" locale={locale} locations={locations} tone="glass" />}
                </div>
              )}
              {id === "tours" && (
                <TeaserPanel body={t("home.toursTabBody")} cta={t("home.toursTabCta")} href={`/${locale}/tours`} />
              )}
              {id === "plan" && (
                <TeaserPanel body={t("home.planTabBody")} cta={t("nav.plan")} href={`/${locale}/plan`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeaserPanel({ body, cta, href }: { body: string; cta: string; href: string }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-xl text-sm leading-relaxed text-white/80">{body}</p>
      <Link
        href={href}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_2px_0_rgba(0,0,0,.16)] transition-colors hover:bg-brand-700"
      >
        {cta}
      </Link>
    </div>
  );
}
