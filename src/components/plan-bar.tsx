import { Cell, CELL_BASE, TONE, BAR_SHELL, BAR_SUBMIT } from "@/components/search-form";
import { DAYS, INTERESTS, PACES, DAY_LABEL, INTEREST_LABEL, PACE_LABEL } from "@/lib/plan";
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
 * cell chrome as the transfer bar it shares a widget with.
 *
 * THE CONTAINMENT INVARIANT, which is what that sharing is actually for: this
 * panel must stay a strict subset of the transfer panel's box at every
 * breakpoint. All three panels occupy one grid cell from sm up
 * (search-tabs.tsx), so the moment this one is taller, the reserved row grows,
 * the hero grows with it one for one, the headline rises into the thin part of
 * the bottom-weighted scrim where the worst-case 5.17 contrast was measured,
 * and the transfer bar — the default tab, and the whole subject of
 * CR-2026-0032 — starts floating vertically centred in a cell it no longer
 * defines. One sentence and one row of cells is the budget. A second row is
 * not a tweak.
 *
 * There is no client state here and nothing to hydrate: a plain GET form whose
 * field names are the query string the planner reads, and three selects over
 * closed sets that start on legal values. It cannot submit an invalid URL, so
 * there is nothing for a submit handler to validate, and a handler whose only
 * job would be to re-derive the string the browser already composes is
 * ceremony. The transfer bar keeps its handler because it has real validation
 * to do; this one does not. Uncontrolled selects also survive a back
 * navigation with the reader's answers still in them, which controlled state
 * would reset.
 *
 * One interest, not the band's six chips. The wizard takes a list and this
 * sends a list of one — a multi-select does not belong on a bar, and the next
 * screen, where every answer is changeable, is one submit away. Nothing is lost
 * against what was deleted: all fifteen chips in that band were single-answer
 * links that pinned the other two answers, so none of them could carry a
 * reader's own days AND their own interest. This is the first control on the
 * site that sends three real answers at once.
 */
export function PlanBar({ locale }: { locale: string }) {
  const t = getTranslator(isLocale(locale) ? (locale as Locale) : "en");

  const control = `${CELL_BASE} ${TONE.glass.control} select-chevron-glass cursor-pointer`;
  /* The control is white text on a photograph; the native option list is not,
     and inherits it onto a white popup. The vehicle select on the transfer bar
     carries the same class for the same reason. */
  const option = "text-ink-900";

  return (
    <form action={`/${locale}/plan`} method="get" className="space-y-4">
      <p className="text-center text-sm leading-relaxed text-white/70">{t("home.planTabBody")}</p>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className={`${BAR_SHELL} ${TONE.glass.shell}`}>
          {/* The wizard's own defaults, so the bar opens on the plan it would
              build if asked nothing — and `d` is always sent, which is what
              makes /plan render an itinerary instead of its empty questions. */}
          <Cell icon={ICONS.days} label={t("plan.fieldDays")} htmlFor="plan-days" tone="glass"
                className="sm:basis-1/3 lg:basis-auto">
            <select id="plan-days" name="d" defaultValue="3" className={control}>
              {DAYS.map((d) => (
                <option key={d} value={d} className={option}>{t(DAY_LABEL[d])}</option>
              ))}
            </select>
          </Cell>

          <Cell icon={ICONS.interest} label={t("plan.fieldInterest")} htmlFor="plan-interest" tone="glass"
                className="sm:basis-1/3 lg:basis-auto">
            <select id="plan-interest" name="i" defaultValue="nature" className={control}>
              {INTERESTS.map((i) => (
                <option key={i} value={i} className={option}>{t(INTEREST_LABEL[i])}</option>
              ))}
            </select>
          </Cell>

          <Cell icon={ICONS.pace} label={t("plan.fieldPace")} htmlFor="plan-pace" tone="glass"
                className="sm:basis-1/3 lg:basis-auto">
            <select id="plan-pace" name="pace" defaultValue="balanced" className={control}>
              {PACES.map((p) => (
                <option key={p} value={p} className={option}>{t(PACE_LABEL[p])}</option>
              ))}
            </select>
          </Cell>
        </div>

        {/* plan.submit, not nav.plan: identical words in all three languages
            today, but one key naming both a navigation item and a button is how
            the two quietly drift apart the day one of them is reworded. */}
        <button type="submit" className={BAR_SUBMIT}>
          {t("plan.submit")}
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
