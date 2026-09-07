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
    title: t("business.title"),
    description: t("business.lead"),
    alternates: {
      canonical: `${config.appUrl}/${locale}/business`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${config.appUrl}/${l}/business`])),
    },
  };
}

/* Named services, from CR-2026-0011 item 24 — employee runs, guest transport
   and hourly hire are things the platform already does and were simply not
   listed where a company goes looking.
   "One agreement, simple invoicing" was removed for CR-2026-0025: neither the
   agreement nor the invoicing exists, so it was the one panel on this page
   promising something nobody could deliver.
   Hourly hire (business.p6t/p6b) went the same way for CR-2026-0028, which
   marked it in yellow to delete. It is the third time the same answer has
   come back: "a car with a driver for four, six, eight or ten hours" is a
   price list we do not have, and the requestor's answers on CR-2026-0011
   item 23 twice said to take it down until we do. The /hourly enquiry page
   is untouched — the two requestors still disagree about what should replace
   the packages, and that question is open. */
const POINTS = [
  ["business.p1t", "business.p1b"],
  ["business.p2t", "business.p2b"],
  ["business.p4t", "business.p4b"],
  ["business.p5t", "business.p5b"],
] as const;

export default async function BusinessPage({
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
    <div className="mx-auto max-w-4xl space-y-12">
      <header>
        <p className="eyebrow">{t("nav.business")}</p>
        <h1 className="font-display mt-2 text-4xl text-ink-900 sm:text-5xl">{t("business.title")}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">{t("business.lead")}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-3">
        {POINTS.map(([title, body]) => (
          <li key={title} className="rounded-lg border border-ink-300 bg-white p-6">
            <p className="font-semibold text-ink-900">{t(title)}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{t(body)}</p>
          </li>
        ))}
      </ul>

      <Card className="p-6 sm:p-8">
        <h2 className="font-display mb-6 text-2xl text-ink-900">{t("business.formTitle")}</h2>
        <InquiryForm
          locale={locale} kind="business" withCompany withVehicleTypes
          sent={sp.sent === "1"} error={sp.error === "1"}
        />
      </Card>
    </div>
  );
}
