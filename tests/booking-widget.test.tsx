/**
 * @vitest-environment jsdom
 */
/**
 * The booking widget, rendered.
 *
 * Every other test here is pure logic, which left the one component that
 * actually earns money — the thing on the homepage a visitor books through —
 * covered by nothing but `tsc` and `next build`. Neither of those can tell a
 * working tab strip from a broken one: a tab that lost its label, a panel that
 * stopped switching, or a dictionary key rendering as the literal string
 * "home.tabToursSub" all compile and build perfectly.
 *
 * So this asserts what a reader would notice within a second of looking:
 * three modes, each saying what it is, one open at a time, and the right
 * panel under each. It runs in all three locales, because the site ships in
 * three and a key missing from one is exactly what reaches production
 * otherwise.
 *
 * Expected strings come from getTranslator, not from the dictionaries
 * directly — ka and ru are deliberately Partial (English is the runtime
 * fallback), and reaching past the translator would both break under
 * noUncheckedIndexedAccess and test a path no visitor uses. Which dictionary
 * holds which key is tests/i18n.test.ts's job; this file's job is what
 * reaches the screen.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getTranslator, LOCALES } from "@/lib/i18n";

// The widget is a client component that would otherwise want a real Next
// router and app context. Neither is what is under test here. The push is
// hoisted rather than made per-call, because "did not navigate" is itself an
// assertion: a refused search must not reach the results page.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { SearchTabs } = await import("@/components/search-tabs");
const { VEHICLE_CATEGORIES } = await import("@/lib/vehicle-categories");
const { OfferFiltersPanel } = await import("@/components/offer-filters");

/** No filter applied — the state the panel is in when results first load. */
const EMPTY_FILTERS = {
  classes: [], tiers: [], language: "", fourWheelDrive: false, winterTyres: false,
  petsAllowed: false, childSeat: false, wifi: false, airConditioning: false,
  wheelchairAccess: false, sort: "",
};

const LOCATIONS = [
  { slug: "tbilisi-airport", name_en: "Tbilisi Airport", type: "airport" },
  { slug: "tbilisi", name_en: "Tbilisi", type: "city" },
  { slug: "kazbegi", name_en: "Kazbegi", type: "town" },
];

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe.each(LOCALES)("booking widget (%s)", (locale) => {
  const t = getTranslator(locale);

  /** Label and its explanatory line, in the order they appear on screen. */
  const TABS = [
    [t("home.tabTransfer"), t("home.tabTransferSub")],
    [t("home.tabTours"), t("home.tabToursSub")],
    [t("nav.plan"), t("home.tabPlanSub")],
  ] as const;

  it("offers exactly three modes, each saying what it is", () => {
    render(<SearchTabs locale={locale} locations={LOCATIONS} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);

    /*
     * CR-2026-0008 item 4 said the three names read as synonyms on their own,
     * so the line underneath was doing the work. CR-2026-0033's reference has
     * no such line and that reference won, so the line is now the tab's title
     * rather than visible text. It is still asserted: it is the only remaining
     * place the distinction is written down, and dropping it silently is how
     * the tabs go back to being three synonyms.
     */
    tabs.forEach((tab, i) => {
      const [label, sub] = TABS[i]!;
      expect(tab.textContent, `tab ${i} label`).toContain(label);
      expect(tab.getAttribute("title"), `tab ${i} explains itself`).toBe(sub);
    });
  });

  it("opens on Transfer, with the route fields ready", () => {
    render(<SearchTabs locale={locale} locations={LOCATIONS} />);
    const [transfer, tours, plan] = screen.getAllByRole("tab");
    expect(transfer).toHaveProperty("ariaSelected", "true");
    expect(tours).toHaveProperty("ariaSelected", "false");
    expect(plan).toHaveProperty("ariaSelected", "false");

    // The form is the panel's whole point; a tab strip over nothing is worse
    // than no tab strip.
    expect(screen.getByRole("button", { name: new RegExp(t("search.submit")) })).toBeDefined();
  });

  /*
   * Tabs are reached by position, not by their text. Finding them by label
   * would make this fail whenever the *labels* broke, which the test above
   * already owns — and two tests failing for one cause tells you less than
   * one test failing for each.
   */
  it("switches panels when another mode is chosen", async () => {
    const user = userEvent.setup();
    render(<SearchTabs locale={locale} locations={LOCATIONS} />);
    const tabAt = (i: number) => screen.getAllByRole("tab")[i]!;
    const submit = () => screen.queryByRole("button", { name: new RegExp(t("search.submit")) });

    /*
     * All three panels stay in the DOM so the widget keeps one height whichever
     * is open — it sits inside the hero now, and a shrinking panel moved the
     * whole page. So "is it there" no longer means "is it open": the closed
     * ones carry aria-hidden, which is exactly what byRole honours and getByText
     * does not. Read the open one through the role.
     */
    const open = () => screen.getByRole("tabpanel");

    await user.click(tabAt(1));
    expect(open().textContent).toContain(t("home.toursTabBody"));
    expect(submit()).toBeNull();

    await user.click(tabAt(2));
    expect(open().textContent).toContain(t("home.planTabBody"));
    expect(open().textContent).not.toContain(t("home.toursTabBody"));

    // Exactly one open at a time, whichever is chosen.
    expect(screen.getAllByRole("tab").filter((x) => x.ariaSelected === "true")).toHaveLength(1);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);

    await user.click(tabAt(0));
    expect(submit()).not.toBeNull();
  });

  it("renders no untranslated message keys", () => {
    const { container } = render(<SearchTabs locale={locale} locations={LOCATIONS} />);
    // translate() returns the key itself when it is unknown, which is how a
    // typo in a t() call reaches a visitor looking like "home.tabToursSub".
    expect(container.textContent).not.toMatch(/\b(home|search|nav|checkout)\.[a-zA-Z]/);
  });
});

describe("booking widget, round trip", () => {
  const t = getTranslator("en");

  it("asks for a return time only when round trip is chosen", async () => {
    const user = userEvent.setup();
    const { container } = render(<SearchTabs locale="en" locations={LOCATIONS} />);
    const whenFields = () => container.querySelectorAll('input[type="datetime-local"]');

    expect(whenFields()).toHaveLength(1);
    await user.click(screen.getByRole("radio", { name: t("home.tabRoundTrip") }));

    // The return leg is a second date field plus its own label, and the note
    // explaining that both legs are one booking.
    expect(whenFields()).toHaveLength(2);
    expect(screen.getByText(t("search.roundTripNote"))).toBeDefined();

    await user.click(screen.getByRole("radio", { name: t("home.tabOneWay") }));
    expect(whenFields()).toHaveLength(1);
  });
});

/*
 * The body type has moved twice: onto the bar (CR-2026-0008 item 5), off it and
 * onto the results panel (CR-2026-0027), and back onto the bar as well
 * (CR-2026-0033's reference layout). It now lives in BOTH places, so both are
 * asserted — a change like this fails silently in the middle, with the choice
 * removed from one place and never arriving in the other — and so is the one
 * thing they share, the `vehicle` query parameter.
 */
describe("vehicle category, on the bar and on the results panel", () => {
  const t = getTranslator("en");

  it("is asked on the booking bar, any vehicle by default", () => {
    const { container } = render(<SearchTabs locale="en" locations={LOCATIONS} />);

    const select = container.querySelector<HTMLSelectElement>("#vehicle")!;
    expect(select, "the bar carries a vehicle control").not.toBeNull();
    expect(select.name).toBe("vehicle");
    expect(select.value).toBe("");
    for (const category of VEHICLE_CATEGORIES) {
      expect(
        [...select.options].some((o) => o.value === category.id && o.text === t(category.label)),
        `${category.id} is offered on the bar`,
      ).toBe(true);
    }
  });

  it("carries the chosen category into the search it runs", async () => {
    const user = userEvent.setup();
    const { container } = render(<SearchTabs locale="en" locations={LOCATIONS} />);

    await user.selectOptions(container.querySelector<HTMLSelectElement>("#vehicle")!, "minivan");
    await user.click(screen.getByRole("button", { name: new RegExp(t("search.submit")) }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(String(push.mock.calls[0]![0])).toContain("vehicle=minivan");
  });

  it("refuses a category that cannot seat the passengers, without searching", async () => {
    const user = userEvent.setup();
    const { container } = render(<SearchTabs locale="en" locations={LOCATIONS} />);

    const passengers = container.querySelector<HTMLInputElement>("#pax")!;
    await user.clear(passengers);
    await user.type(passengers, "5");
    await user.selectOptions(container.querySelector<HTMLSelectElement>("#vehicle")!, "sedan");
    await user.click(screen.getByRole("button", { name: new RegExp(t("search.submit")) }));

    expect(screen.getByRole("alert").textContent).toBe(t("search.errVehiclePax", { count: 5 }));
    expect(push).not.toHaveBeenCalled();
  });

  it("is offered by the results filter, with its seat range, any by default", () => {
    render(
      <OfferFiltersPanel
        locale="en" hidden={[["from", "Tbilisi"], ["to", "Kazbegi"]]}
        state={EMPTY_FILTERS} facets={{ classes: [], languages: [] }}
        vehicle="" resultCount={0}
      />,
    );

    const select = screen.getByLabelText(t("search.vehicle")) as HTMLSelectElement;
    expect(select.name).toBe("vehicle");
    expect(select.value).toBe("");

    // The range is the label's whole point — a name on its own asks the
    // reader to know a minivan from a minibus before they have picked a car.
    for (const category of VEHICLE_CATEGORIES) {
      const label = t(category.label);
      expect(label, `${category.id} label carries its seat range`).toMatch(/\d/);
      const option = screen.getByRole("option", { name: label }) as HTMLOptionElement;
      expect(option.value).toBe(category.id);
    }
  });

  it("shows the filter already set when the search carried a category", () => {
    render(
      <OfferFiltersPanel
        locale="en" hidden={[]} state={EMPTY_FILTERS}
        facets={{ classes: [], languages: [] }} vehicle="minivan" resultCount={3}
      />,
    );

    expect((screen.getByLabelText(t("search.vehicle")) as HTMLSelectElement).value).toBe("minivan");
  });
});

/*
 * CR-2026-0027 again: "the stop should move up above the price view, without
 * the extra text". Both clauses, because dropping the note is the easy half.
 */
describe("adding a stop", () => {
  const t = getTranslator("en");

  it("sits above the submit button, with no note beside it", () => {
    const { container } = render(<SearchTabs locale="en" locations={LOCATIONS} />);

    const controls = Array.from(container.querySelectorAll("button"));
    const addStop = controls.findIndex((b) => b.textContent === t("search.addStop"));
    const submit = controls.findIndex((b) => b.getAttribute("type") === "submit");

    expect(addStop, "add a stop is on the bar").toBeGreaterThan(-1);
    expect(addStop, "add a stop comes before the price button").toBeLessThan(submit);
    expect(screen.queryByText(t("search.stopsNote"))).toBeNull();
  });
});
