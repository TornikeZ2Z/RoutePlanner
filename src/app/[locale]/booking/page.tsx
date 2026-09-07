import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, getTranslator, LOCALES, type Locale } from "@/lib/i18n";
import { config } from "@/lib/config";
import { issueManageTokenFor } from "@/lib/booking";
import { rateLimit, clientKey, assertSameOrigin } from "@/lib/security";
import { Card, Field, Input, Button, Alert } from "@/components/ui";
import { BookingSteps } from "@/components/booking-steps";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale as Locale);
  return {
    title: t("lookup.title"),
    description: t("lookup.lead"),
    // Nothing here is worth indexing and the form is only useful to someone
    // who already holds a booking code.
    robots: { index: false },
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${config.appUrl}/${l}/booking`])),
    },
  };
}

/**
 * Find my booking.
 *
 * A guest books without an account, and the only way back to the booking is
 * the manage link emailed at the time. Its token is stored hashed, so a lost
 * email is unrecoverable — and outbound email does not work from here yet,
 * which means today a customer who books has no route back to their own
 * booking at all. This is that route.
 *
 * A native POST rather than a client form: it is two fields and a redirect,
 * and the page it leads to works without JavaScript too.
 */
export default async function FindBooking({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const t = getTranslator(locale as Locale);
  const failed = sp.error === "1";
  const throttled = sp.error === "throttled";

  async function find(formData: FormData) {
    "use server";
    await assertSameOrigin();

    const code = String(formData.get("code") ?? "");
    const email = String(formData.get("email") ?? "");

    /*
     * Ten a minute. Generous for somebody mistyping a code off a phone
     * screen, useless for grinding codes against a known email address —
     * which is the only attack the code's own entropy does not already
     * defeat on its own.
     */
    const limit = rateLimit(await clientKey("booking-lookup"), 10, 60);
    if (!limit.allowed) redirect(`/${locale}/booking?error=throttled`);

    const token = code && email ? await issueManageTokenFor(code, email) : null;
    // One message for a wrong code, a wrong email and a booking that does not
    // exist. Saying which was wrong would turn this form into a way of asking
    // whether a given person has booked with us.
    if (!token) redirect(`/${locale}/booking?error=1`);
    redirect(`/${locale}/booking/${encodeURIComponent(code.trim().toUpperCase())}?t=${token}`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <BookingSteps locale={locale} current={4} />

      <h1 className="font-display text-3xl text-ink-900">{t("lookup.title")}</h1>
      <p className="mt-2 leading-relaxed text-ink-600">{t("lookup.lead")}</p>

      {failed && (
        <div className="mt-5">
          <Alert tone="danger" title={t("lookup.failedT")}>{t("lookup.failedB")}</Alert>
        </div>
      )}
      {throttled && (
        <div className="mt-5">
          <Alert tone="warning" title={t("lookup.throttledT")}>{t("lookup.throttledB")}</Alert>
        </div>
      )}

      <Card className="mt-6 p-6">
        <form action={find} className="space-y-4">
          <Field label={t("lookup.code")} htmlFor="code" hint={t("lookup.codeHint")} required>
            <Input
              id="code" name="code" required maxLength={20} autoComplete="off"
              placeholder="ABCD-EFGH" className="font-mono uppercase"
            />
          </Field>
          <Field label={t("lookup.email")} htmlFor="email" hint={t("lookup.emailHint")} required>
            <Input id="email" name="email" type="email" required maxLength={200} autoComplete="email" />
          </Field>
          <Button type="submit">{t("lookup.submit")}</Button>
        </form>
      </Card>

      <p className="mt-4 text-sm leading-relaxed text-ink-500">{t("lookup.help")}</p>
    </div>
  );
}
