"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cell, CELL_BASE, TONE, BAR_SHELL, BAR_SUBMIT } from "@/components/search-form";
import {
  DAYS, INTERESTS, PACES, DAY_LABEL, INTEREST_LABEL, PACE_LABEL,
  type DaysBucket, type Interest, type Pace,
} from "@/lib/plan";
import { getTranslator, isLocale, type Locale } from "@/lib/i18n";

/**
 * The planner's first three questions, asked on the booking bar itself.
 *
 * CR-2026-0039: "surface the build-my-route field HERE, the way we had it
 * before — and the big one down below, delete it altogether." The screenshot
 * marks the hero. What stood in this tab was an advertisement for the planner —
 * a sentence and a button that navigated away — while the questions themselves
 * sat in a large tinted band far down the page, which is the one being deleted.
 * So the questions move up into the tab that is named after them.
 *
 * Three cells and a button, in the same pill, the same glass tone and the same
 * cell chrome as the transfer bar it shares a widget with. That is not
 * decoration: all three panels occupy one grid cell so the hero keeps one
 * height whichever tab is open (search-tabs.tsx), and two bars of approximately
 * the same shape read as a mistake where two identical ones read as a system.
 *
 * One interest, not the band's six checkboxes. The wizard accepts a list and
 * this sends a list of one, because a multi-select does not belong on a bar and
 * because the next screen — where every answer is changeable — is one click
 * away. The bar's job is to get somebody into a built plan, not to finish it.
 *
 * A native GET form with named fields, like the transfer bar beside it: the
 * three names ARE the query string the planner reads, so this works with not
 * one byte of JavaScript. That is not theoretical here — the hero carousel
 * carries a comment about sessions where the streamed page never hydrated, and
 * a booking widget that only works after React wakes up is a booking widget
 * that sometimes does not. router.push only spares the full navigation.
 */
export function PlanBar({ locale }: { locale: string }) {
  const t = getTranslator(isLocale(locale) ? (locale as Locale) : "en");
  const router = useRouter();

  /* The wizard's own defaults, so the bar opens on the plan it would build. */
  const [days, setDays] = useState<DaysBucket>("3");
  const [interest, setInterest] = useState<Interest>("nature");
  const [pace, setPace] = useState<Pace>("balanced");

  const control = `${CELL_BASE} ${TONE.glass.control} cursor-pointer`;
  /* The control is white text on the photograph; the native option list is
     not, and inherits it. The vehicle select on the transfer bar carries the
     same class for the same reason. */
  const OPTION = "text-ink-900";

  return (
    <form
      action={`/${locale}/plan`}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        /* `d` present is what makes the wizard render a built plan rather than
           its empty questions, so this lands on an itinerary, not a form. The
           URL is the one the form would have submitted by itself. */
        router.push(`/${locale}/plan?d=${days}&i=${interest}&pace=${pace}`);
      }}
      className="space-y-4"
    >
      <p className="text-center text-sm leading-relaxed text-white/70">{t("home.planTabBody")}</p>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className={`${BAR_SHELL} ${TONE.glass.shell}`}>
          <Cell icon={ICONS.days} label={t("plan.fieldDays")} htmlFor="plan-days" tone="glass"
                className="sm:basis-1/3 lg:basis-auto">
            <select id="plan-days" name="d" value={days} className={control}
                    onChange={(e) => setDays(e.target.value as DaysBucket)}>
              {DAYS.map((d) => (
                <option key={d} value={d} className={OPTION}>{t(DAY_LABEL[d])}</option>
              ))}
            </select>
          </Cell>

          <Cell icon={ICONS.interest} label={t("plan.fieldInterest")} htmlFor="plan-interest" tone="glass"
                className="sm:basis-1/3 lg:basis-auto">
            <select id="plan-interest" name="i" value={interest} className={control}
                    onChange={(e) => setInterest(e.target.value as Interest)}>
              {INTERESTS.map((i) => (
                <option key={i} value={i} className={OPTION}>{t(INTEREST_LABEL[i])}</option>
              ))}
            </select>
          </Cell>

          <Cell icon={ICONS.pace} label={t("plan.fieldPace")} htmlFor="plan-pace" tone="glass"
                className="sm:basis-1/3 lg:basis-auto">
            <select id="plan-pace" name="pace" value={pace} className={control}
                    onChange={(e) => setPace(e.target.value as Pace)}>
              {PACES.map((p) => (
                <option key={p} value={p} className={OPTION}>{t(PACE_LABEL[p])}</option>
              ))}
            </select>
          </Cell>
        </div>

        <button type="submit" className={BAR_SUBMIT}>
          {t("nav.plan")}
          <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}

/** Same weight and stroke as the transfer bar's icons, so the two rows of
    cells read as one family rather than two icon sets. */
const ICONS = {
  days: "M7 3v3m10-3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  interest: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.4-12.4-2.1 5.3-5.3 2.1 2.1-5.3 5.3-2.1Z",
  pace: "M12 14a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm1.3-3.3L17 7M4.5 18a9 9 0 1 1 15 0",
} as const;
