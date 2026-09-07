"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { getTranslator, isLocale, type Locale } from "@/lib/i18n";
import { VEHICLE_CATEGORIES } from "@/lib/vehicle-categories";
import { toLocalInput } from "@/lib/format";

interface LocationOption { slug: string; name_en: string; type: string }

/**
 * The booking bar.
 *
 * Wide layout is a single segmented bar — icon, small caps label, value —
 * with hairline dividers and the CTA riding alongside, per the brand mock.
 * Compact layout stays a plain stacked form for sidebars. Both are native
 * GET forms with named fields: the search works even if not one byte of
 * JavaScript runs; the client handler only adds validation and stops.
 */
const ICONS = {
  from: "M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  to: "M6 21V4m0 1h11.5L15 9l2.5 4H6",
  date: "M7 3v3m10-3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  ret: "M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5",
  pax: "M12 11a3.4 3.4 0 1 0 0-6.8A3.4 3.4 0 0 0 12 11Zm-7 9a7 7 0 0 1 14 0",
  bag: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 0h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z",
} as const;

const CELL_CONTROL =
  "w-full border-0 bg-transparent p-0 text-sm font-semibold text-ink-900 " +
  "focus:outline-none focus:ring-0";

const CELL_INPUT = CELL_CONTROL + " truncate placeholder:font-normal placeholder:text-ink-400";

function Cell({
  icon, label, htmlFor, children, className = "",
}: { icon: string; label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-3 ${className}`}>
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-gold-600" fill="none" stroke="currentColor"
           strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={icon} />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block truncate whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">{label}</span>
        {children}
      </span>
    </label>
  );
}

export function SearchForm({
  locale, locations, initial, layout = "wide", tourSlug, lockRoute = false, roundTrip = false,
}: {
  locale: string;
  locations: LocationOption[];
  initial?: { from?: string; to?: string };
  layout?: "wide" | "compact";
  tourSlug?: string;
  lockRoute?: boolean;
  roundTrip?: boolean;
}) {
  const compact = layout === "compact";
  const t = getTranslator(isLocale(locale) ? (locale as Locale) : "en");
  const router = useRouter();
  const has = (slug: string) => locations.some((l) => l.slug === slug);
  /* The visible value is the place's name in the reader's language. The search
     page resolves a name or a slug, so a link built with slugs still opens. */
  const nameOf = (slug: string) => locations.find((l) => l.slug === slug)?.name_en ?? slug;
  const [from, setFrom] = useState(nameOf(initial?.from ?? (has("tbilisi-airport") ? "tbilisi-airport" : locations[0]?.slug ?? "")));
  const [to, setTo] = useState(nameOf(initial?.to ?? (has("tbilisi") ? "tbilisi" : locations[1]?.slug ?? "")));
  const [stops, setStops] = useState<string[]>([]);
  const [earliest] = useState(earliestWhen);
  const [when, setWhen] = useState(defaultWhen());
  const [returnWhen, setReturnWhen] = useState(defaultReturnWhen());
  const [passengers, setPassengers] = useState(2);
  const [luggage, setLuggage] = useState(2);
  // "" is any vehicle, and stays the default: a traveller who does not care
  // which body they get should not have to say so before seeing a price.
  const [vehicle, setVehicle] = useState("");
  // Free text, carried untouched to checkout: "Rooms Hotel, 14 Kostava St".
  // The chosen locations still decide the route and the price; these decide
  // where the driver actually stops the car.
  const [pickupDetail, setPickupDetail] = useState("");
  const [dropDetail, setDropDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return setError(t("search.errBoth"));
    if (!tourSlug && from === to) return setError(t("search.errSame"));
    if (stops.some((s) => !s)) return setError(t("search.errStopEmpty"));
    // A tour legitimately starts and ends in the same city, so the adjacency
    // rule only applies between consecutive *stops* on a tour route.
    const sequence = [from, ...stops, to];
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i] !== sequence[i - 1]) continue;
      const isTourEndpoints = tourSlug && stops.length === 0;
      if (!isTourEndpoints) return setError(t("search.errAdjacent"));
    }
    if (new Date(when).getTime() < Date.now()) return setError(t("search.errPast"));
    // Caught here rather than on the results page, where it would read as
    // "no drivers on this route" — which would be a lie about the route.
    const category = VEHICLE_CATEGORIES.find((c) => c.id === vehicle);
    if (category && passengers > category.maxPassengers) {
      return setError(t("search.errVehiclePax", { count: passengers }));
    }
    if (roundTrip && new Date(returnWhen).getTime() <= new Date(when).getTime()) {
      return setError(t("search.errReturn"));
    }
    setError(null);
    const q = new URLSearchParams({
      from, to, when, passengers: String(passengers), luggage: String(luggage),
    });
    if (vehicle) q.set("vehicle", vehicle);
    if (pickupDetail.trim()) q.set("pd", pickupDetail.trim().slice(0, 300));
    if (dropDetail.trim()) q.set("dd", dropDetail.trim().slice(0, 300));
    if (roundTrip) q.set("return", returnWhen);
    if (tourSlug) q.set("tour", tourSlug);
    for (const s of stops) q.append("stop", s);
    router.push(`/${locale}/search?${q}`);
  }

  /*
     A datalist rather than a select: CR-2026-0006 asked not to corral people
     into a fixed list. Typing filters natively, in every browser, with no
     geocoder and no key — and because we still price against places we serve,
     the suggestions remain the truthful set. The input is not readonly, so an
     unknown place submits and the search says plainly that it has no route
     there, instead of the field silently refusing the keystroke.
  */
  const LIST_ID = "rp-places";
  const placeList = (
    <datalist id={LIST_ID}>
      {locations.map((l) => <option key={l.slug} value={l.name_en} />)}
    </datalist>
  );

  const stopsEditor = !lockRoute && stops.length > 0 && (
    <ul className="space-y-2">
      {stops.map((stop, i) => (
        <li key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label={t("search.stop", { n: i + 1 })} htmlFor={`stop-${i}`}>
              <Input
                id={`stop-${i}`} name="stop" value={stop} list={LIST_ID} autoComplete="off"
                placeholder={t("search.choosePlace")}
                onChange={(e) => setStops(stops.map((s, j) => (j === i ? e.target.value : s)))}
              />
            </Field>
          </div>
          <Button type="button" variant="secondary"
                  onClick={() => setStops(stops.filter((_, j) => j !== i))}
                  aria-label={t("search.stop", { n: i + 1 })}>
            {t("search.removeStop")}
          </Button>
        </li>
      ))}
    </ul>
  );

  /*
     The body type, chosen before the search rather than after it.

     Real radio inputs behind their labels, not buttons with a click handler:
     the bar is a native GET form, and a visitor with scripting off has to be
     able to submit a category along with the rest of the trip. "Any" is the
     default and is a real option, so the choice can be taken back.

     The seat range is inside each label. Without it the four names ask a
     visitor to know a minivan from a minibus before they have picked a car —
     the objection CLASS_TIERS in offer-filters.tsx exists to answer.
  */
  const vehiclePicker = (
    <fieldset className="rounded-2xl border border-ink-200 bg-white px-4 py-3">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
        {t("search.vehicle")}
      </legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {[{ id: "", label: "search.vehAny" as const }, ...VEHICLE_CATEGORIES].map((c) => {
          const chosen = vehicle === c.id;
          return (
            <label
              key={c.id || "any"}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-brand-600 focus-within:ring-offset-1 ${
                chosen
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-ink-200 text-ink-600 hover:border-ink-300 hover:text-ink-900"
              }`}
            >
              <input
                type="radio" name="vehicle" value={c.id} checked={chosen}
                onChange={() => setVehicle(c.id)} className="sr-only"
              />
              {t(c.label)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  if (compact) {
    return (
      <form onSubmit={submit} action={`/${locale}/search`} method="get" className="space-y-4">
        {placeList}
        {tourSlug && <input type="hidden" name="tour" value={tourSlug} />}
        {lockRoute && (
          <>
            <input type="hidden" name="from" value={from} readOnly />
            <input type="hidden" name="to" value={to} readOnly />
          </>
        )}
        {!lockRoute && (
          <>
            <Field label={t("search.from")} htmlFor="from" required>
              <Input id="from" name="from" value={from} list={LIST_ID} autoComplete="off"
                     onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t("search.to")} htmlFor="to" required>
              <Input id="to" name="to" value={to} list={LIST_ID} autoComplete="off"
                     onChange={(e) => setTo(e.target.value)} />
            </Field>
          </>
        )}
        <Field label={t("search.date")} htmlFor="when" hint={t("search.dateHint")} required>
          <Input id="when" name="when" type="datetime-local" min={earliest} value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        {roundTrip && (
          <Field label={t("search.return")} htmlFor="return-when" required>
            <Input id="return-when" name="return" type="datetime-local" min={when || earliest} value={returnWhen}
                   onChange={(e) => setReturnWhen(e.target.value)} />
          </Field>
        )}
        {stopsEditor}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("search.passengers")} htmlFor="pax">
            <Input id="pax" name="passengers" type="number" min={1} max={20} value={passengers}
                   onChange={(e) => setPassengers(Number(e.target.value))} />
          </Field>
          <Field label={t("search.luggage")} htmlFor="bags">
            <Input id="bags" name="luggage" type="number" min={0} max={20} value={luggage}
                   onChange={(e) => setLuggage(Number(e.target.value))} />
          </Field>
        </div>
        {vehiclePicker}
        {!lockRoute && (
          <Button type="button" variant="secondary" className="w-full"
                  onClick={() => setStops([...stops, ""])} disabled={stops.length >= 6}>
            {t("search.addStop")}
          </Button>
        )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pickup-detail-0" className="mb-1 block text-xs font-medium text-ink-500">
            {t("search.exactFromL")}
          </label>
          <input
            id="pickup-detail-0" type="text" maxLength={300} value={pickupDetail}
            onChange={(e) => setPickupDetail(e.target.value)}
            placeholder={t("checkout.pickupPh")}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 hover:border-ink-300 focus:border-ink-900"
          />
        </div>
        <div>
          <label htmlFor="drop-detail-0" className="mb-1 block text-xs font-medium text-ink-500">
            {t("search.exactToL")}
          </label>
          <input
            id="drop-detail-0" type="text" maxLength={300} value={dropDetail}
            onChange={(e) => setDropDetail(e.target.value)}
            placeholder={t("checkout.dropoffPh")}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 hover:border-ink-300 focus:border-ink-900"
          />
        </div>
      </div>
        <Button type="submit" className="w-full">{t("search.submit")}</Button>
        <p className="text-xs text-ink-500">{t("search.stopsNote")}</p>
        {error && <p className="text-sm text-[--color-danger]" role="alert">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={submit} action={`/${locale}/search`} method="get" className="space-y-4">
      {placeList}
      {tourSlug && <input type="hidden" name="tour" value={tourSlug} />}
      {lockRoute && (
        <>
          <input type="hidden" name="from" value={from} readOnly />
          <input type="hidden" name="to" value={to} readOnly />
        </>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="flex flex-1 flex-col rounded-2xl border border-ink-200 bg-white sm:flex-row sm:flex-wrap lg:flex-nowrap lg:divide-x lg:divide-ink-200 [&>*+*]:border-t [&>*+*]:border-ink-100 sm:[&>*+*]:border-t-0 lg:[&>*+*]:border-t-0">
          {!lockRoute && (
            <Cell icon={ICONS.from} label={t("search.from")} htmlFor="from" className="sm:basis-1/2 lg:basis-auto">
              <input id="from" name="from" value={from} list={LIST_ID} autoComplete="off"
                     onChange={(e) => setFrom(e.target.value)} className={CELL_INPUT} />
            </Cell>
          )}
          {!lockRoute && (
            <Cell icon={ICONS.to} label={t("search.to")} htmlFor="to" className="sm:basis-1/2 lg:basis-auto">
              <input id="to" name="to" value={to} list={LIST_ID} autoComplete="off"
                     onChange={(e) => setTo(e.target.value)} className={CELL_INPUT} />
            </Cell>
          )}
          <Cell icon={ICONS.date} label={t("search.date")} htmlFor="when" className="sm:basis-1/2 lg:basis-auto">
            <input id="when" name="when" type="datetime-local" min={earliest} value={when}
                   onChange={(e) => setWhen(e.target.value)} className={CELL_CONTROL} />
          </Cell>
          {roundTrip && (
            <Cell icon={ICONS.ret} label={t("search.return")} htmlFor="return-when" className="sm:basis-1/2 lg:basis-auto">
              <input id="return-when" name="return" type="datetime-local" min={when || earliest} value={returnWhen}
                     onChange={(e) => setReturnWhen(e.target.value)} className={CELL_CONTROL} />
            </Cell>
          )}
          <Cell icon={ICONS.pax} label={t("search.passengers")} htmlFor="pax" className="sm:basis-1/4 lg:max-w-36 lg:basis-auto">
            <input id="pax" name="passengers" type="number" min={1} max={20} value={passengers}
                   onChange={(e) => setPassengers(Number(e.target.value))} className={CELL_CONTROL} />
          </Cell>
          <Cell icon={ICONS.bag} label={t("search.luggage")} htmlFor="bags" className="sm:basis-1/4 lg:max-w-36 lg:basis-auto">
            <input id="bags" name="luggage" type="number" min={0} max={20} value={luggage}
                   onChange={(e) => setLuggage(Number(e.target.value))} className={CELL_CONTROL} />
          </Cell>
        </div>

        <button
          type="submit"
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-8 text-base font-bold tracking-[-0.01em] text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-700"
        >
          {t("search.submit")}
          <span aria-hidden>→</span>
        </button>
      </div>

      {stopsEditor}

      {vehiclePicker}

      <details open className="rounded-2xl border border-ink-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-700">
          {t("search.exactFromL")} / {t("search.exactToL")}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="text" maxLength={300} value={pickupDetail}
            onChange={(e) => setPickupDetail(e.target.value)}
            placeholder={t("checkout.pickupPh")}
            aria-label={t("search.exactFromL")}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-900"
          />
          <input
            type="text" maxLength={300} value={dropDetail}
            onChange={(e) => setDropDetail(e.target.value)}
            placeholder={t("checkout.dropoffPh")}
            aria-label={t("search.exactToL")}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-900"
          />
        </div>
        <p className="mt-2 text-xs text-ink-500">{t("search.exactHint")}</p>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!lockRoute ? (
          <button
            type="button"
            onClick={() => setStops([...stops, ""])}
            disabled={stops.length >= 6}
            className="text-sm font-semibold text-gold-600 hover:text-gold-700 disabled:opacity-40"
          >
            {t("search.addStop")}
          </button>
        ) : <span />}
        <p className="text-xs text-ink-500">{t("search.stopsNote")}</p>
      </div>

      {roundTrip && <p className="text-xs text-ink-500">{t("search.roundTripNote")}</p>}
      {error && <p className="text-sm text-[--color-danger]" role="alert">{error}</p>}
    </form>
  );
}

/** The earliest a journey can be booked: now. CR-2026-0019 — the field had no
    lower bound at all, so last Tuesday was selectable. */
function earliestWhen() {
  return toLocalInput(new Date());
}

function defaultWhen() {
  const d = new Date(Date.now() + 26 * 3600_000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}

function defaultReturnWhen() {
  const d = new Date(Date.now() + 34 * 3600_000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}
