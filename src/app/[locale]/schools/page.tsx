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

/*
 * The page ends at the form.
 *
 * Everything that used to follow it — the two feature cards, what the safety
 * coordinator does and does not do, the four commitments, and the four steps
 * of setting a school route up — was removed for CR-2026-0029: "delete all
 * the text below entirely; the contract is part of that too, and you go
 * through it with the school in person". A yellow arrow in the attached
 * screenshot marked the cut, immediately under the enquiry form.
 *
 * That is a deliberate change of who says the difficult part. The scope limit
 * (schools.scNot) was written to be read before anything went wrong rather
 * than found in a clause afterwards; it is now said in the meeting instead of
 * on the page. Every key stays in the three dictionaries — a key costs nothing
 * and the parity test wants all three locales to agree — so putting any of it
 * back is a matter of rendering it again.
 */

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
    </div>
  );
}
