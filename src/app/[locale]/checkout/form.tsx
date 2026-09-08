"use client";

import { useState } from "react";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/form-state";
import { getTranslator, type Locale } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { CANONICAL } from "@/lib/currency-constants";

export function CheckoutForm({
  quoteId, locale, defaults, cashAvailable, isAirport, error, childSeatFeeLabel,
  grossMinor, childSeatFeeMinor,
}: {
  quoteId: string;
  locale: Locale;
  defaults: { passengers: number; luggage: number; pickupAddress?: string; dropoffAddress?: string };
  cashAvailable: boolean;
  isAirport: boolean;
  error?: string;
  childSeatFeeLabel: string;
  /** The quote, in tetri. What the traveller was shown before this page. */
  grossMinor: string;
  /** Per seat, in tetri. config.policy.childSeatFeeMinor. */
  childSeatFeeMinor: number;
}) {
  const [payment, setPayment] = useState<"CASH" | "CARD">(cashAvailable ? "CASH" : "CARD");
  const [submitting, setSubmitting] = useState(false);
  const [childSeats, setChildSeats] = useState(0);
  /* Formatted here rather than passed in: a function cannot cross the
     server/client boundary, and formatMoney is a pure module with no
     server-only import. */
  const money = (minor: bigint) => formatMoney(minor, CANONICAL, locale);

  /**
   * Explicit submission. React 19 intercepts client-component form posts and
   * silently swallows the server's redirect — the booking succeeds and the
   * traveller sees nothing happen. We post ourselves, follow the redirect
   * chain, and land the browser where the server said to go. If JavaScript
   * never runs, the native form still posts the old way.
   */
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", { method: "POST", body: new FormData(form) });
      window.location.assign(res.url || `/${locale}`);
    } catch {
      setSubmitting(false);
    }
  }
  const t = getTranslator(locale);

  return (
    <form action="/api/bookings" method="post" onSubmit={submit} className="space-y-6">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="locale" value={locale} />

      <Card className="p-4 sm:p-6">
        <h2 className="mb-4 font-semibold text-ink-900">{t("checkout.whoT")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("checkout.leadName")} htmlFor="customerName" required>
            <Input id="customerName" name="customerName" autoComplete="name" required />
          </Field>
          <Field label={t("checkout.email")} htmlFor="customerEmail" hint={t("checkout.emailHint")} required>
            <Input id="customerEmail" name="customerEmail" type="email" autoComplete="email" required />
          </Field>
          <Field label={t("checkout.phone")} htmlFor="customerPhone" hint={t("checkout.phoneHint")} required>
            <Input id="customerPhone" name="customerPhone" type="tel" autoComplete="tel" placeholder="+995 …" required />
          </Field>
          <Field label={t("checkout.passengers")} htmlFor="passengers" required>
            <Input id="passengers" name="passengers" type="number" min={1} max={20} defaultValue={defaults.passengers} required />
          </Field>
          <Field label={t("checkout.children")} htmlFor="children">
            <Input id="children" name="children" type="number" min={0} max={20} defaultValue={0} />
          </Field>
          <Field label={t("checkout.bags")} htmlFor="luggage">
            <Input id="luggage" name="luggage" type="number" min={0} max={30} defaultValue={defaults.luggage} />
          </Field>
          <Field label={t("checkout.childSeats")} htmlFor="childSeats" hint={`${t("checkout.childSeatsHint")} ${t("checkout.childSeatFee", { amount: childSeatFeeLabel })}`}>
            <Input id="childSeats" name="childSeats" type="number" min={0} max={6} value={childSeats}
                   onChange={(e) => setChildSeats(Math.max(0, Math.min(6, Number(e.target.value) || 0)))} />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2 text-sm text-ink-700">
              <input type="checkbox" name="pets" className="size-4 rounded" /> {t("checkout.pet")}
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="mb-1 font-semibold text-ink-900">{t("checkout.whereT")}</h2>
        <p className="mb-4 text-sm text-ink-600">
          {t("checkout.whereB")}
        </p>
        <div className="space-y-4">
          <Field label={t("checkout.pickup")} htmlFor="pickupAddress" required>
            <Input
              id="pickupAddress" name="pickupAddress" required maxLength={300}
              defaultValue={defaults.pickupAddress || undefined}
              placeholder={t("checkout.pickupPh")}
            />
          </Field>
          <Field label={t("checkout.dropoff")} htmlFor="dropoffAddress" required>
            <Input
              id="dropoffAddress" name="dropoffAddress" required maxLength={300}
              defaultValue={defaults.dropoffAddress || undefined}
              placeholder={t("checkout.dropoffPh")}
            />
          </Field>

          {isAirport && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("checkout.flight")} htmlFor="flightNumber"
                hint={t("checkout.flightHint")}
              >
                <Input id="flightNumber" name="flightNumber" placeholder="e.g. A9 601" />
              </Field>
              <Field label={t("checkout.signName")} htmlFor="pickupSignName">
                <Input id="pickupSignName" name="pickupSignName" />
              </Field>
            </div>
          )}

          <Field label={t("checkout.notes")} htmlFor="notes" hint={t("checkout.notesHint")}>
            <Textarea id="notes" name="notes" rows={3} />
          </Field>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="mb-4 font-semibold text-ink-900">{t("checkout.payT")}</h2>
        <fieldset className="space-y-3">
          <legend className="sr-only">How would you like to pay?</legend>

          <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${payment === "CASH" ? "border-ink-900 bg-ink-50" : "border-ink-300"} ${!cashAvailable ? "opacity-50" : ""}`}>
            <input
              type="radio" name="paymentMode" value="CASH" className="mt-1 size-4"
              checked={payment === "CASH"} disabled={!cashAvailable}
              onChange={() => setPayment("CASH")}
            />
            <span>
              <span className="block font-medium text-ink-900">{t("checkout.cashT")}</span>
              <span className="block text-sm text-ink-600">
                {t("checkout.cashB")}
              </span>
            </span>
          </label>

          <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${payment === "CARD" ? "border-ink-900 bg-ink-50" : "border-ink-300"}`}>
            <input
              type="radio" name="paymentMode" value="CARD" className="mt-1 size-4"
              checked={payment === "CARD"} onChange={() => setPayment("CARD")}
            />
            <span>
              <span className="block font-medium text-ink-900">{t("checkout.cardT")}</span>
              <span className="block text-sm text-ink-600">
                {t("checkout.cardB")}
              </span>
            </span>
          </label>
        </fieldset>

        <label className="mt-5 flex items-start gap-2 text-sm text-ink-700">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 rounded" required />
          <span>
            {t("checkout.terms")}
          </span>
        </label>
      </Card>

      {error && <Alert tone="danger" title={t("checkout.errorT")}>{error}</Alert>}

      {/*
        What the traveller is actually about to pay, beside the button that
        commits them to it.

        CR-2026-0014 item 39 asks that "no hidden fees" be true rather than
        merely claimed, and it named this exact shape: the trip, the child
        seats, the total. It was not true here. The sidebar's "Total" is the
        QUOTE, and booking.ts adds childSeats x 20 GEL to it afterwards — up to
        120 GEL that appeared nowhere before the traveller committed. The unit
        price was on the field's hint, which tells you the rate and never the
        bill.

        The server still computes the real figure; this only stops the page
        showing a number it knows is about to change.
      */}
      <div className="rounded-2xl border border-ink-200 bg-white p-5">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">{t("checkout.tripPrice")}</dt>
            <dd className="text-ink-900">{money(BigInt(grossMinor))}</dd>
          </div>
          {childSeats > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">{t("checkout.childSeatLine", { n: childSeats })}</dt>
              <dd className="text-ink-900">
                {money(BigInt(childSeats) * BigInt(childSeatFeeMinor))}
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-ink-100 pt-2">
            <dt className="font-medium text-ink-900">{t("checkout.payNow")}</dt>
            <dd className="font-display text-2xl text-ink-900">
              {money(BigInt(grossMinor) + BigInt(childSeats) * BigInt(childSeatFeeMinor))}
            </dd>
          </div>
        </dl>
      </div>

      <SubmitButton>
        {payment === "CARD" ? t("checkout.submitCard") : t("checkout.submitCash")}
      </SubmitButton>
    </form>
  );
}
