import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, getTranslator, LOCALES } from "@/lib/i18n";
import { config } from "@/lib/config";
import { Card } from "@/components/ui";
import { InquiryForm } from "@/components/inquiry-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return {
    title: t("schools.title"),
    description: t("schools.lead"),
    alternates: {
      canonical: `${config.appUrl}/${locale}/schools`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${config.appUrl}/${l}/schools`])),
    },
  };
}

/* Regular scheduled routes were withdrawn (CR-2026-0022) — the offer is
   excursions and day trips, and advertising a service we do not run is worse
   than a shorter list. schools.p3t/p3b stay in the dictionaries; a key costs
   nothing and the parity test wants all three locales to agree. */
const POINTS = [
  ["schools.p1t", "schools.p1b"],
  ["schools.p2t", "schools.p2b"],
] as const;

/**
 * The three packages, in the order they build on each other. Each includes
 * everything in the one before it, so they are rendered as a progression
 * rather than as alternatives a reader has to compare feature by feature.
 */
const PACKAGES = [
  ["schools.pkgStandardT", "schools.pkgStandardB"],
  ["schools.pkgPlusT", "schools.pkgPlusB"],
  ["schools.pkgPremiumT", "schools.pkgPremiumB"],
] as const;

const COMMITMENTS = [
  "schools.safety1", "schools.safety2", "schools.safety3", "schools.safety4",
] as const;

const STEPS = [
  ["schools.how1t", "schools.how1b"],
  ["schools.how2t", "schools.how2b"],
  ["schools.how3t", "schools.how3b"],
  ["schools.how4t", "schools.how4b"],
] as const;

export default async function SchoolsPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const t = getTranslator(locale);

  return (
    <div className="mx-auto max-w-4xl space-y-16">
      <header>
        <p className="eyebrow">{t("nav.schools")}</p>
        <h1 className="font-display mt-2 text-4xl text-ink-900 sm:text-5xl">{t("schools.title")}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">{t("schools.lead")}</p>
      </header>

      <section>
        <h2 className="font-display text-2xl text-ink-900">{t("schools.pkgSectionT")}</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-600">{t("schools.pkgSectionB")}</p>

        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {PACKAGES.map(([name, body], i) => (
            <li
              key={name}
              className={
                i === 1
                  ? "rounded-lg border-2 border-pine-800 bg-white p-6"
                  : "rounded-lg border border-ink-300 bg-white p-6"
              }
            >
              <p className="font-display text-lg tracking-wide text-ink-900">{t(name)}</p>
              <div className="rule-fade mt-2" />
              <p className="mt-3 text-sm leading-relaxed text-ink-600">{t(body)}</p>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-sm leading-relaxed text-ink-500">{t("schools.pkgNote")}</p>
      </section>

      <Card className="p-6 sm:p-8">
        <h2 className="font-display mb-6 text-2xl text-ink-900">{t("business.formTitle")}</h2>
        <InquiryForm
          locale={locale} kind="school" withCompany withPackages
          sent={sp.sent === "1"} error={sp.error === "1"}
        />
      </Card>

      <ul className="grid gap-4 sm:grid-cols-2">
        {POINTS.map(([title, body]) => (
          <li key={title} className="rounded-lg border border-ink-300 bg-white p-6">
            <p className="font-semibold text-ink-900">{t(title)}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{t(body)}</p>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="font-display text-2xl text-ink-900">{t("schools.scT")}</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-600">{t("schools.scB")}</p>
        {/*
          The limit is stated as plainly as the offer. A school reading this
          has to know exactly where our responsibility stops, and finding
          that out from Article 6.3 after something has gone wrong would be
          far too late.
        */}
        <p className="mt-4 max-w-2xl rounded-lg border-l-2 border-ink-300 bg-ink-50 p-4 text-sm leading-relaxed text-ink-700">
          {t("schools.scNot")}
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink-900">{t("schools.safetyT")}</h2>
        <ul className="mt-5 space-y-3">
          {COMMITMENTS.map((key) => (
            <li key={key} className="flex gap-3 leading-relaxed text-ink-700">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-pine-800" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink-900">{t("schools.howT")}</h2>
        <ol className="mt-6 space-y-5">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="font-display mt-0.5 w-6 shrink-0 text-lg text-ink-400 tabular-nums">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-ink-900">{t(title)}</p>
                <p className="mt-1 leading-relaxed text-ink-600">{t(body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

    </div>
  );
}
