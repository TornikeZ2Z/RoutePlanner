/**
 * The route builder's rule table.
 *
 * The failure this prevents is specific and has already happened once here:
 * "who is travelling" was asked on the plan page for a year, stored in state,
 * written into the shareable link — and never read by buildPlan or by any
 * booking link. Three questions were advertised and two were real.
 *
 * So the first block below is not a nicety. It holds every other answer fixed
 * and changes one, and asserts the result is different. A question that cannot
 * move the output is a bug, and this is where it fails.
 */
import { describe, it, expect } from "vitest";
import {
  buildPlan, startHour, TIER_LABEL,
  type PlanInput, type Interest, type Pace, type Budget, type Party,
} from "@/lib/plan";

const BASE: PlanInput = {
  origin: "tbilisi", days: "5", interests: ["nature"],
  pace: "balanced", budget: "middle", party: "couple",
};
const plan = (over: Partial<PlanInput> = {}) => buildPlan({ ...BASE, ...over });
/** The itinerary alone — what the traveller reads as their week. */
const shape = (p: ReturnType<typeof buildPlan>) =>
  JSON.stringify(p.days.map((d) => d.tourSlug ?? d.places.join(">")));
/** The car the CTA asks for. */
const car = (p: ReturnType<typeof buildPlan>) => JSON.stringify(p.booking);

describe("every question changes the answer", () => {
  it("origin changes the itinerary", () => {
    const seen = new Set(["tbilisi", "kutaisi", "batumi"].map((o) =>
      shape(plan({ origin: o as PlanInput["origin"] }))));
    expect(seen.size).toBe(3);
  });

  it("days changes the itinerary", () => {
    for (const d of ["1", "3", "5", "7"] as const) {
      expect(plan({ days: d }).days).toHaveLength(Number(d));
    }
  });

  it("interests change the itinerary", () => {
    const seen = new Set((["nature", "culture", "wine", "rest"] as Interest[])
      .map((i) => shape(plan({ interests: [i] }))));
    expect(seen.size).toBe(4);
  });

  /*
   * The one that nearly shipped inert. Pace can only reorder places, and a
   * plan made entirely of tour days has no places to reorder — so without the
   * stretch rule calm and active return identical itineraries. Asserted on a
   * tour-only answer precisely because that is the case that breaks.
   */
  it("pace changes the itinerary even for a tour-shaped answer", () => {
    const seen = new Set((["calm", "balanced", "active"] as Pace[])
      .map((p) => shape(plan({ pace: p, interests: ["nature"] }))));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("pace turns a drive too long for it into a stay", () => {
    // Kazbegi is 420 minutes at the wheel: inside "active", outside "calm".
    expect(plan({ pace: "active", interests: ["nature"] }).days[0]?.tourSlug)
      .toBe("kazbegi-gergeti-day-trip");
    const calm = plan({ pace: "calm", interests: ["nature"] });
    expect(calm.days[0]?.tourSlug).toBeUndefined();
    expect(calm.days[0]?.places).toContain("gudauri");
    expect(calm.notes).toContain("plan.noteStretched");
  });

  it("budget changes the car", () => {
    // On a non-4x4 answer, so the mountain override does not mask it.
    const seen = new Set((["economy", "middle", "premium"] as Budget[])
      .map((b) => car(plan({ budget: b, interests: ["culture"] }))));
    expect(seen.size).toBe(3);
  });

  it("party changes the car", () => {
    const seen = new Set((["solo", "couple", "family", "friends"] as Party[])
      .map((p) => car(plan({ party: p, interests: ["culture"] }))));
    expect(seen.size).toBe(4);
  });
});

describe("the plan is bookable", () => {
  it("never asks the search for a journey from a place to itself", () => {
    // offers.ts returns no_route when origin and destination resolve to the
    // same location, which would strand the traveller on an empty page.
    for (const origin of ["tbilisi", "kutaisi", "batumi"] as const) {
      for (const days of ["1", "3", "5", "7"] as const) {
        for (const i of ["nature", "culture", "wine", "sea", "adventure", "rest"] as Interest[]) {
          for (const pace of ["calm", "balanced", "active"] as Pace[]) {
            const p = plan({ origin, days, interests: [i], pace });
            if (p.primary.kind === "transfer") {
              expect(p.primary.from, `${origin}/${days}/${i}/${pace}`).not.toBe(p.primary.to);
            }
          }
        }
      }
    }
  });

  /*
   * Pace belongs in this loop. Svaneti is the only multi-day tour and it only
   * takes its tour form at an active pace, so a sweep that held pace at
   * "balanced" never built a three-day tour at all — and the second and third
   * days of one were blank.
   */
  it("fills exactly the days asked for, with no empty day", () => {
    for (const origin of ["tbilisi", "kutaisi", "batumi"] as const) {
      for (const days of ["1", "3", "5", "7"] as const) {
        for (const i of ["nature", "culture", "wine", "sea", "adventure", "rest"] as Interest[]) {
          for (const pace of ["calm", "balanced", "active"] as Pace[]) {
            const at = `${origin}/${days}/${i}/${pace}`;
            const p = plan({ origin, days, interests: [i], pace });
            expect(p.days, at).toHaveLength(Number(days));
            for (const d of p.days) {
              expect(d.tourSlug || d.places.length > 0, `${at} empty day`).toBeTruthy();
            }
          }
        }
      }
    }
  });

  it("never schedules the same tour twice", () => {
    /*
     * Nature and adventure point at the same tour from both eastern hubs, so
     * a week that ran out of chosen interests and fell through to the next
     * block booked Svaneti twice — six days listing one three-day tour.
     */
    for (const origin of ["tbilisi", "kutaisi", "batumi"] as const) {
      for (const days of ["1", "3", "5", "7"] as const) {
        for (const pace of ["calm", "balanced", "active"] as Pace[]) {
          const slugs = plan({ origin, days, pace, interests: ["nature"] })
            .days.map((d) => d.tourSlug).filter(Boolean);
          const distinct = new Set(slugs);
          // A multi-day tour legitimately spans days, so compare tour runs.
          let runs = 0;
          slugs.forEach((s, i) => { if (s !== slugs[i - 1]) runs++; });
          expect(runs, `${origin}/${days}/${pace}`).toBe(distinct.size);
        }
      }
    }
  });

  /*
   * The defect this pins down: a calm five-day plan once returned Gudauri and
   * then four days reading only "Tbilisi". A day at the base is a fair answer
   * when the ground really is used up — filling most of a week with it is not.
   */
  it("does not pad a plan out with the hub", () => {
    for (const origin of ["tbilisi", "kutaisi", "batumi"] as const) {
      for (const days of ["3", "5", "7"] as const) {
        for (const pace of ["calm", "balanced", "active"] as Pace[]) {
          const at = `${origin}/${days}/${pace}`;
          const p = plan({ origin, days, pace, interests: ["nature"] });

          // Nowhere but the base is ever visited twice.
          const away = p.days.flatMap((d) => d.places).filter((s) => s !== origin);
          const dupes = away.filter((s, i) => away.indexOf(s) !== i);
          expect(dupes, `${at} repeated: ${dupes.join(",")}`).toEqual([]);

          // And the base is never most of the trip.
          const filler = p.days.filter((d) => !d.tourSlug && d.places.every((s) => s === origin));
          expect(filler.length, `${at} filler days`).toBeLessThan(p.days.length / 2);
        }
      }
    }
  });

  it("never sends a tier that would match no car", () => {
    for (const budget of ["economy", "middle", "comfort", "premium"] as Budget[]) {
      for (const party of ["solo", "couple", "family", "friends"] as Party[]) {
        for (const i of ["nature", "culture", "rest"] as Interest[]) {
          const p = plan({ budget, party, interests: [i], pace: "active" });
          /*
           * The tier travels on one link, so it is the primary journey that
           * has to be satisfiable — not any day in the plan. Only SUV_4X4
           * carries four-wheel drive and it sits in the premium tier, so a
           * cheaper tier on the Kazbegi or Mestia road matches no car at all.
           */
          const needs4x4 = p.primary.kind === "tour"
            ? p.primary.slug === "kazbegi-gergeti-day-trip" || p.primary.slug === "svaneti-three-days"
            : [p.primary.to, ...p.primary.stops].some((s) => s === "kazbegi" || s === "mestia");
          if (needs4x4) expect(p.booking.tier, `${budget}/${party}/${i}`).toBe("premium");
          // ECONOMY tops out at 4 seats and 2 bags.
          if (p.booking.tier === "economy") {
            expect(p.booking.passengers).toBeLessThanOrEqual(4);
            expect(p.booking.luggage).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });

  it("asks for a day bag on a day tour and a case each when relocating", () => {
    const tour = plan({ interests: ["culture"], party: "family" });
    expect(tour.primary.kind).toBe("tour");
    expect(tour.booking.luggage).toBe(1);

    const move = plan({ origin: "batumi", interests: ["sea"], party: "family" });
    expect(move.primary.kind).toBe("transfer");
    expect(move.booking.luggage).toBe(4);
  });

  it("carries the child seat only for the family answer", () => {
    expect(plan({ party: "family" }).booking.childSeat).toBe(true);
    for (const p of ["solo", "couple", "friends"] as Party[]) {
      expect(plan({ party: p }).booking.childSeat).toBe(false);
    }
  });
});

describe("the plan is honest about what we do not have", () => {
  it("says so when no tour starts where the traveller does", () => {
    // Four of five tours leave Tbilisi; none leaves Batumi.
    expect(plan({ origin: "batumi", interests: ["sea"] }).notes).toContain("plan.noteNoTours");
    expect(plan({ origin: "tbilisi", interests: ["culture"] }).notes).not.toContain("plan.noteNoTours");
  });

  it("says the coast does not fit a short trip instead of ignoring the answer", () => {
    expect(plan({ origin: "tbilisi", days: "3", interests: ["sea"] }).notes)
      .toContain("plan.noteSeaFar");
    expect(plan({ origin: "tbilisi", days: "7", interests: ["sea"] }).notes)
      .not.toContain("plan.noteSeaFar");
    // From Batumi the sea is where you already are.
    expect(plan({ origin: "batumi", days: "1", interests: ["sea"] }).notes)
      .not.toContain("plan.noteSeaFar");
  });

  it("never offers the eight-hour drive as a restful day", () => {
    // rest used to map to borjomi-vardzia-day-trip: 520 km, 480 minutes.
    for (const origin of ["tbilisi", "kutaisi", "batumi"] as const) {
      for (const days of ["1", "3", "5", "7"] as const) {
        const p = plan({ origin, days, interests: ["rest"] });
        expect(p.days.map((d) => d.tourSlug), `${origin}/${days}`)
          .not.toContain("borjomi-vardzia-day-trip");
      }
    }
  });
});

describe("supporting tables", () => {
  it("gives a calm plan a later start than an active one", () => {
    expect(startHour("calm")).toBeGreaterThan(startHour("active"));
  });

  it("labels every tier through the filter panel's own keys", () => {
    expect(Object.keys(TIER_LABEL).sort()).toEqual(["economy", "premium", "standard"]);
  });
});
