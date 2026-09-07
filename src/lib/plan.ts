import type { MessageKey } from "@/lib/i18n";

/**
 * Build My Route: a rule table, not an oracle.
 *
 * The wizard asks five questions and assembles a day-by-day sketch from the
 * places and tours the marketplace actually serves — every suggestion is
 * bookable today. Rules are deliberately static and reviewable: this is the
 * founder's curated advice, not a black box.
 *
 * The rule that governs every table below: an answer that cannot change the
 * result is worse than a question we never asked, because it costs the reader
 * effort and teaches them the tool is theatre. "Who is travelling" was exactly
 * that — collected, stored, put in the shareable link, and never once read.
 * So every answer here either changes the itinerary or changes the car, and
 * where supply cannot honour an answer the plan says so out loud rather than
 * quietly returning something else.
 */
export type Origin = "tbilisi" | "kutaisi" | "batumi";
export type DaysBucket = "1" | "3" | "5" | "7";
export type Interest = "nature" | "culture" | "wine" | "sea" | "adventure" | "rest";
export type Pace = "calm" | "balanced" | "active";
export type Budget = "economy" | "middle" | "comfort" | "premium";
export type Party = "solo" | "couple" | "family" | "friends";
/** The three ids CLASS_TIERS actually defines — not the four budget bands. */
export type Tier = "economy" | "standard" | "premium";

export interface PlanInput {
  origin: Origin;
  days: DaysBucket;
  /** In the order they were ticked: the first one gets the first day. */
  interests: Interest[];
  pace: Pace;
  budget: Budget;
  party: Party;
}

/** The caveats a plan can carry. A closed set, so they stay reviewable. */
export type PlanNote =
  | "plan.noteNoTours"
  | "plan.noteSeaFar"
  | "plan.noteStretched"
  | "plan.noteTier4x4"
  | "plan.noteTierFleet";

export interface PlanDay {
  /** Location slugs visited this day, in order. */
  places: string[];
  /** Slug of a curated tour that covers this day, when one exists. */
  tourSlug?: string;
  /** Why this day looks like this, when pace or supply forced our hand. */
  noteKey?: PlanNote;
}

/** Everything the booking link needs that is not the route itself. */
export interface PlanBooking {
  passengers: number;
  luggage: number;
  childSeat: boolean;
  /** A CLASS_TIERS id, or null when filtering would empty the results. */
  tier: Tier | null;
  /** Set when the tier had to be raised or dropped, so the card can say why. */
  noteKey?: PlanNote;
}

export interface PlanResult {
  days: PlanDay[];
  /** The city the plan is anchored on — the `from` of the booking link. */
  hub: Origin;
  /** The single strongest booking action for this plan. */
  primary: { kind: "tour"; slug: string } | { kind: "transfer"; from: string; to: string; stops: string[] };
  booking: PlanBooking;
  notes: PlanNote[];
}

/*
 * The catalogue, with the three facts that decide anything: where it starts,
 * how long it is, and how hard the driving day is. Copied from db/seed.ts —
 * five rows is not worth a database round trip inside a pure function.
 */
interface TourFact { slug: string; origin: Origin; days: number; driveMinutes: number; requires4x4: boolean }
const TOURS: TourFact[] = [
  { slug: "mtskheta-jvari-day-trip",  origin: "tbilisi", days: 1, driveMinutes: 100, requires4x4: false },
  { slug: "kakheti-wine-day-trip",    origin: "tbilisi", days: 1, driveMinutes: 330, requires4x4: false },
  { slug: "kazbegi-gergeti-day-trip", origin: "tbilisi", days: 1, driveMinutes: 420, requires4x4: true  },
  { slug: "borjomi-vardzia-day-trip", origin: "tbilisi", days: 1, driveMinutes: 480, requires4x4: false },
  { slug: "svaneti-three-days",       origin: "kutaisi", days: 3, driveMinutes: 900, requires4x4: true  },
];
const TOUR_BY_SLUG = new Map(TOURS.map((t) => [t.slug, t]));

/*
 * Pace, and the one rule that makes it visible.
 *
 * `maxDriveMinutes` is the longest day at the wheel this pace tolerates. A
 * tour over the limit is NOT dropped — it is stretched into a stay at the same
 * place, on the same priced roads. Kazbegi at "active" is a seven-hour round
 * trip; at "calm" it is Gudauri, a night under the mountain, and back. Same
 * interest, same supply, a visibly different week.
 *
 * Without this rule pace could only reorder places, and a plan made of tour
 * days has no places to reorder — calm and active would return identical
 * itineraries and we would have shipped a second decorative question.
 */
const PACE: Record<Pace, { placesPerDay: number; maxDriveMinutes: number; startHour: number }> = {
  calm:     { placesPerDay: 1, maxDriveMinutes: 240, startHour: 10 },
  balanced: { placesPerDay: 2, maxDriveMinutes: 430, startHour: 9 },
  active:   { placesPerDay: 3, maxDriveMinutes: 900, startHour: 8 },
};

/** What a tour becomes when the pace will not carry it in one day. Every slug
    here sits on a priced route from that tour's own origin. */
const STAY_FOR_TOUR: Record<string, string[]> = {
  "mtskheta-jvari-day-trip":  ["mtskheta"],
  "kakheti-wine-day-trip":    ["sighnaghi", "telavi"],
  "kazbegi-gergeti-day-trip": ["gudauri", "kazbegi"],
  "borjomi-vardzia-day-trip": ["borjomi", "vardzia"],
  "svaneti-three-days":       ["mestia"],
};

interface Block { tour?: string; places: string[] }

/*
 * What each city can offer each interest.
 *
 * This is where the origin question earns its place, and where the supply is
 * least flattering: four of the five tours leave from Tbilisi and none leaves
 * from Batumi. The western columns are therefore built from curated places on
 * real roads rather than from tours — a thinner answer, so a plan with no tour
 * in it carries plan.noteNoTours and says why.
 *
 * `rest` deliberately has no tour anywhere. It used to map to
 * borjomi-vardzia-day-trip, which is 520 km and eight hours at the wheel: the
 * longest driving day in the catalogue, offered to the one person who asked
 * for a quiet holiday. That tour's own description ends by telling you not to
 * add anything else to the day.
 */
const POOL: Record<Origin, Partial<Record<Interest, Block>>> = {
  tbilisi: {
    nature:    { tour: "kazbegi-gergeti-day-trip", places: ["gudauri", "kazbegi"] },
    adventure: { tour: "kazbegi-gergeti-day-trip", places: ["gudauri", "kazbegi"] },
    culture:   { tour: "mtskheta-jvari-day-trip",  places: ["mtskheta", "vardzia"] },
    wine:      { tour: "kakheti-wine-day-trip",    places: ["sighnaghi", "telavi", "kvareli", "tsinandali"] },
    rest:      { places: ["borjomi", "abastumani"] },
    sea:       { places: ["batumi", "ureki"] },
  },
  kutaisi: {
    nature:    { tour: "svaneti-three-days", places: ["martvili", "mestia"] },
    adventure: { tour: "svaneti-three-days", places: ["mestia"] },
    culture:   { places: ["kutaisi", "zugdidi"] },
    wine:      { places: ["ambrolauri", "oni"] },
    rest:      { places: ["ureki", "martvili"] },
    sea:       { places: ["ureki", "shekvetili", "batumi"] },
  },
  batumi: {
    sea:       { places: ["batumi", "ureki", "shekvetili"] },
    nature:    { places: ["martvili", "bakhmaro"] },
    adventure: { places: ["bakhmaro"] },
    culture:   { places: ["batumi", "zugdidi"] },
    wine:      { places: ["ambrolauri"] },
    rest:      { places: ["ureki"] },
  },
};

/*
 * Where the road itself demands four-wheel drive, from the route_families that
 * carry requires_4x4: tbilisi->kazbegi and kutaisi->mestia. Only SUV_4X4 cars
 * have it and they sit in the premium tier, so a cheaper tier on these roads
 * matches no car at all.
 */
const FOUR_BY_FOUR_ROADS = new Set(["kazbegi", "mestia"]);

/** The coast is most of a day each way from the eastern hubs; it needs enough
    days to be worth the drive rather than a token appearance on a short trip. */
const SEA_MIN_DAYS = 5;

/*
 * Four bands were asked for and three exist. "middle" and "comfort" both land
 * on standard rather than inventing a fourth tier the search cannot expand —
 * sending `tier=comfort` would match nothing in CLASS_TIERS and the answer
 * would silently do nothing, which is the failure this whole file is against.
 */
const TIER_FOR_BUDGET: Record<Budget, Tier> = {
  economy: "economy",
  middle: "standard",
  comfort: "standard",
  premium: "premium",
};

const PARTY_SIZE: Record<Party, { passengers: number; childSeat: boolean }> = {
  solo:    { passengers: 1, childSeat: false },
  couple:  { passengers: 2, childSeat: false },
  family:  { passengers: 4, childSeat: true },
  friends: { passengers: 4, childSeat: false },
};

/**
 * The plan, from the five answers.
 *
 * Reads top to bottom: take a block per interest, decide whether the pace can
 * carry it as a tour, spend the days, pad what is left. No weights, no scores,
 * nothing that cannot be predicted by reading the tables above.
 */
export function buildPlan(input: PlanInput): PlanResult {
  const { origin, pace, budget, party } = input;
  const tuning = PACE[pace];
  const total = Number(input.days);
  const interests = input.interests.length ? input.interests : (["nature"] as Interest[]);
  const pool = POOL[origin];

  const days: PlanDay[] = [];
  const notes = new Set<PlanNote>();
  const seen = new Set<string>();
  const scheduled = new Set<string>();
  let usedTour: string | undefined;

  /*
   * A stay, spread over as many days as the pace needs.
   *
   * `placesPerDay` is what it says: how much ground one day covers. The same
   * two places are one day at an active pace and two days at a calm one, which
   * is what makes calm actually slower rather than merely shorter — an earlier
   * cut truncated the list to the first place instead, so a calm week asked for
   * mountains and returned Gudauri and four days of sitting in Tbilisi.
   */
  const emitStay = (source: string[], noteKey?: PlanNote): boolean => {
    /*
     * A day that goes nowhere is not a day we can sell. The western pools name
     * their own hub — Batumi appears under both "sea" and "culture" for a
     * traveller already in Batumi — and that produced a day reading only
     * "Batumi" and a link from Batumi to Batumi, which offers.ts answers with
     * no_route.
     */
    const away = source.filter((p) => p !== origin);
    const list = (away.length ? away : source).filter((p) => !seen.has(p));
    if (list.length === 0) return false;
    const per = Math.max(1, tuning.placesPerDay);
    let emitted = false;
    for (let i = 0; i < list.length && days.length < total; i += per) {
      const chunk = list.slice(i, i + per);
      chunk.forEach((p) => seen.add(p));
      // The note explains the block, so it belongs on its first day only.
      days.push({ places: chunk, ...(noteKey && !emitted ? { noteKey } : {}) });
      emitted = true;
    }
    return emitted;
  };

  const emitBlock = (block: Block): void => {
    /*
     * A tour is scheduled at most once. Nature and adventure both point at the
     * same tour from both hubs, so a seven-day plan that ran out of chosen
     * interests and fell through to the neighbouring block booked Svaneti
     * twice — six days of the same three-day tour, listed one after another.
     */
    const already = block.tour ? scheduled.has(block.tour) : false;
    const tour = block.tour && !already ? TOUR_BY_SLUG.get(block.tour) : undefined;
    const fitsPace = tour ? tour.driveMinutes <= tuning.maxDriveMinutes : false;
    const fitsDays = tour ? days.length + tour.days <= total : false;

    if (tour && fitsPace && fitsDays) {
      scheduled.add(tour.slug);
      // The places the tour already covers, so a later block does not offer
      // Mestia as a day out from a week that has just spent three days there.
      (STAY_FOR_TOUR[tour.slug] ?? []).forEach((p) => seen.add(p));
      // Every day of a multi-day tour carries the slug: Svaneti is three days
      // and the second and third are not blank pages.
      for (let i = 0; i < tour.days; i++) days.push({ tourSlug: tour.slug, places: [] });
      usedTour ??= tour.slug;
      return;
    }

    // Too long for this pace, or too long for the days left: the same place,
    // reached slowly.
    const source = tour ? (STAY_FOR_TOUR[tour.slug] ?? block.places) : block.places;
    const stretched = Boolean(tour) && !fitsPace;
    if (emitStay(source, stretched ? "plan.noteStretched" : undefined) && stretched) {
      notes.add("plan.noteStretched");
    }
  };

  for (const interest of interests) {
    if (days.length >= total) break;
    const block = pool[interest];
    if (!block) continue;

    // The coast from an eastern hub is most of a day each way. Say so, rather
    // than dropping the answer or pretending a day trip exists.
    if (interest === "sea" && origin !== "batumi" && total < SEA_MIN_DAYS) {
      notes.add("plan.noteSeaFar");
      continue;
    }
    emitBlock(block);
  }

  /*
   * The days outran the interests. Reach for what else this hub is good for
   * before falling back to sitting still: a week that asked for wine should
   * not be one Kakheti day and six days of the word "Tbilisi".
   */
  for (const [interest, block] of Object.entries(pool) as [Interest, Block][]) {
    if (days.length >= total) break;
    if (interests.includes(interest)) continue;
    if (interest === "sea" && origin !== "batumi" && total < SEA_MIN_DAYS) continue;
    emitBlock(block);
  }

  /*
   * Still short: sweep anything this hub can reach that no block above used.
   * A tour covers only two of Kakheti's four wine towns, so a long week has
   * real places left over — better a day in Kvareli than another day of the
   * word "Tbilisi".
   */
  if (days.length < total) {
    /*
     * Block by block, never flattened. Two places share a day only if the same
     * curated block named them, which is what keeps them within a day's drive
     * of each other: a flattened sweep put Vardzia and Kvareli — opposite ends
     * of the country — in one afternoon.
     */
    for (const block of Object.values(pool)) {
      if (days.length >= total) break;
      if (block) emitStay(block.places);
    }
  }

  // Genuinely out of ground. A free day at the base is an honest answer.
  while (days.length < total) days.push({ places: [origin] });
  if (days.length > total) days.length = total;

  // "No ready-made tour starts here" is a fact about the city, not about how
  // this particular plan came out: Tbilisi has four tours even on a calm week
  // that stretched every one of them into a stay.
  if (!TOURS.some((t) => t.origin === origin)) notes.add("plan.noteNoTours");

  const primary = choosePrimary(days, origin, usedTour);
  const booking = buildBooking(primary, budget, party, notes);

  return { days, hub: origin, primary, booking, notes: [...notes] };
}

/**
 * The one button. A tour if the plan contains one, otherwise the furthest hop
 * the plan actually makes.
 *
 * The two-distinct-places rule is not cosmetic: offers.ts returns no_route
 * when origin and destination resolve to the same location, so a transfer CTA
 * built from a single-place day would land the traveller on an empty results
 * page having answered five questions.
 */
function choosePrimary(
  days: PlanDay[], origin: Origin, usedTour: string | undefined,
): PlanResult["primary"] {
  if (usedTour) return { kind: "tour", slug: usedTour };

  const visited: string[] = [];
  for (const day of days) for (const p of day.places) if (visited.at(-1) !== p) visited.push(p);
  const away = visited.filter((p) => p !== origin);
  const to = away.at(-1);

  if (!to) {
    // Everything happens at the hub, so the plan itself contains no journey.
    // A tour from here if there is one; otherwise the nearest thing this hub
    // is good for, which is never the hub itself.
    const fromHere = TOURS.find((t) => t.origin === origin);
    if (fromHere) return { kind: "tour", slug: fromHere.slug };
    const nearby = Object.values(POOL[origin])
      .flatMap((b) => b?.places ?? [])
      .find((p) => p !== origin);
    // Every western pool names somewhere that is not its own hub; Tbilisi is
    // the backstop only so the type is total, and only Tbilisi has tours.
    return { kind: "transfer", from: origin, to: nearby ?? "tbilisi", stops: [] };
  }

  const stops = away.slice(0, -1).filter((s, i, a) => a.indexOf(s) === i).slice(0, 2);
  return { kind: "transfer", from: origin, to, stops };
}

/**
 * Budget and party, turned into the parameters /search already honours.
 *
 * Neither answer changes the itinerary, because the roads do not change with
 * the size of your wallet or your family. What changes is the car — and the
 * wizard used to hardcode `passengers=2&luggage=2` for everyone, so a solo
 * traveller was quoted a car for two and a family of four one too small.
 *
 * The tier is dropped rather than sent when it would return nothing. A filter
 * that empties the results page is worse than no filter, and both ways to
 * empty it are reachable from ordinary answers:
 *   - a 4x4 day, because only SUV_4X4 cars carry four-wheel drive and they sit
 *     in the premium tier, so economy on the Kazbegi road matches no car at all;
 *   - a full car, because the ECONOMY class tops out at four seats and two
 *     pieces of luggage.
 */
function buildBooking(
  primary: PlanResult["primary"],
  budget: Budget, party: Party, notes: Set<PlanNote>,
): PlanBooking {
  const { passengers, childSeat } = PARTY_SIZE[party];

  /*
   * Luggage belongs to the day, not to the party. A day tour comes back to the
   * same hotel and needs a day bag; a plan that moves you across the country
   * needs a case each. Asking for four cases on a day trip would rule out
   * every car that could comfortably do it.
   */
  const luggage = primary.kind === "transfer" ? passengers : 1;

  /*
   * Only the journey this button books. An earlier cut asked whether ANY day
   * in the plan needed four-wheel drive, which forced premium onto a Mtskheta
   * link because some later day happened to be Kazbegi — and with that, budget
   * stopped changing anything on most Tbilisi plans.
   */
  const needs4x4 = primary.kind === "tour"
    ? Boolean(TOUR_BY_SLUG.get(primary.slug)?.requires4x4)
    : [primary.to, ...primary.stops].some((s) => FOUR_BY_FOUR_ROADS.has(s));
  if (needs4x4) {
    const tier: Tier = "premium";
    if (TIER_FOR_BUDGET[budget] !== tier) {
      notes.add("plan.noteTier4x4");
      return { passengers, luggage, childSeat, tier, noteKey: "plan.noteTier4x4" };
    }
    return { passengers, luggage, childSeat, tier };
  }

  const tier = TIER_FOR_BUDGET[budget];
  if (tier === "economy" && (passengers > 4 || luggage > 2)) {
    notes.add("plan.noteTierFleet");
    return { passengers, luggage, childSeat, tier: null, noteKey: "plan.noteTierFleet" };
  }

  return { passengers, luggage, childSeat, tier };
}

/** The hour a day starts, so a calm plan does not depart at eight. */
export function startHour(pace: Pace): number {
  return PACE[pace].startHour;
}

/** Label keys for the tier actually applied, reusing the filter panel's own
    words so the result card and the search page agree. */
export const TIER_LABEL: Record<Tier, MessageKey> = {
  economy: "filters.tierEconomy",
  standard: "filters.tierStandard",
  premium: "filters.tierPremium",
};
