import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALES, getTranslator, type Locale, type MessageKey } from "@/lib/i18n";
import { config } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { CANONICAL } from "@/lib/currency";

export const revalidate = 3600;

interface Props { params: Promise<{ locale: string }> }

/**
 * The questions live in the dictionary, so every locale carries its own text
 * and the parity test guarantees none can go missing. The earlier version
 * hard-coded English here, which is exactly how a "fully translated" site
 * still showed English FAQs to Georgian visitors.
 */
const QA: [MessageKey, MessageKey][] = [
  ["faq.q1", "faq.a1"], ["faq.q2", "faq.a2"], ["faq.q3", "faq.a3"],
  ["faq.q4", "faq.a4"], ["faq.q5", "faq.a5"], ["faq.q6", "faq.a6"],
  ["faq.q7", "faq.a7"], ["faq.q8", "faq.a8"], ["faq.q9", "faq.a9"],
  /* Five added from CR-2026-0012 item 27, answered by the requestor: what the
     price covers, whether anything is hidden, the child-seat charge, and
     whether a traveller can pick or change their driver. */
  ["faq.q10", "faq.a10"], ["faq.q11", "faq.a11"], ["faq.q12", "faq.a12"],
  ["faq.q13", "faq.a13"], ["faq.q14", "faq.a14"],
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale as Locale);
  const url = `${config.appUrl}/${locale}/faq`;
  return {
    title: t("faq.title"),
    description: t("faq.a1"),
    alternates: {
      canonical: url,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${config.appUrl}/${l}/faq`])),
    },
  };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getTranslator(locale as Locale);

  /*
   * The waiting answer quotes the allowance the driver agreement caps against,
   * read from the same setting the contract renders. The FAQ used to say stops
   * were "not time-limited" while the agreement said nothing about waiting at
   * all — a promise to travellers that no driver had agreed to honour.
   */
  const { waiting_included_minutes: waitMinutes } = await getSettings();
  /* Two answers quote a real number rather than a hard-coded one: the free
     waiting allowance, and the child-seat fee the requestor confirmed as
     +20 GEL. Both come from settings and config, so a change to either does
     not leave the FAQ stating an old price. */
  const answer = (key: MessageKey) =>
    key === "faq.a3" ? t(key, { minutes: waitMinutes })
      : key === "faq.a12"
        ? t(key, { price: formatMoney(BigInt(config.policy.childSeatFeeMinor), CANONICAL, locale) })
        : t(key);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: QA.map(([q, a]) => ({
      "@type": "Question",
      name: t(q),
      acceptedAnswer: { "@type": "Answer", text: answer(a) },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header>
        <p className="eyebrow">{t("nav.faq")}</p>
        <h1 className="font-display mt-3 text-4xl text-ink-900 sm:text-5xl">{t("faq.title")}</h1>
      </header>

      <ul className="space-y-3">
        {QA.map(([q, a]) => (
          <li key={q}>
            <Card className="p-4">
              <details>
                <summary className="cursor-pointer font-medium text-ink-900">{t(q)}</summary>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{answer(a)}</p>
              </details>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
