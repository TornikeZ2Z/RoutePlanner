/**
 * The smsoffice sender name.
 *
 * These tests used to pin the opposite rule: that the gateway's alphabet has
 * no space, so "Route Plan" had to be sent as "RoutePlan". That was taken from
 * the published character list and it was wrong in the way that matters — the
 * name actually registered on the account is "Route Plan", and transmitting
 * the stripped form produced error 150, "sender name is not registered", on
 * every single send. The gateway is the authority on what it accepts.
 *
 * What survives is the part the sanitiser can still justify: characters that
 * would corrupt the request are removed, the name is trimmed, and eleven
 * characters is the cap. Whatever comes out must equal the registered name
 * exactly, which is the failure these tests exist to prevent.
 */
import { describe, it, expect } from "vitest";
import { normalizeSender, normalizeGeorgianMobile } from "@/lib/notifications";

describe("smsoffice sender names", () => {
  it("keeps a space, because the registered brand has one", () => {
    expect(normalizeSender("Route Plan")).toBe("Route Plan");
  });

  it("keeps the characters the gateway does allow", () => {
    expect(normalizeSender("Route-Plan")).toBe("Route-Plan");
    expect(normalizeSender("Route.Plan")).toBe("Route.Plan");
    expect(normalizeSender("RoutePlan24")).toBe("RoutePlan24");
  });

  it("drops everything outside the permitted alphabet", () => {
    expect(normalizeSender("Route_Plan!")).toBe("RoutePlan");
    expect(normalizeSender("Route Plan!")).toBe("Route Plan");
    // Georgian script is not accepted as a sender name.
    expect(normalizeSender("რაუტ")).toBe("");
  });

  it("trims, so a stray space cannot make the name unregistered", () => {
    expect(normalizeSender("  Route Plan  ")).toBe("Route Plan");
  });

  it("truncates at eleven characters", () => {
    expect(normalizeSender("RoutePlannerGeorgia")).toBe("RoutePlanne");
    expect(normalizeSender("RoutePlannerGeorgia").length).toBeLessThanOrEqual(11);
  });

  it("leaves an already-legal name untouched", () => {
    const legal = "RoutePlan";
    expect(normalizeSender(legal)).toBe(legal);
  });
});

describe("Georgian mobile numbers", () => {
  it("adds the country code to a local nine-digit mobile", () => {
    expect(normalizeGeorgianMobile("555123456")).toBe("995555123456");
    expect(normalizeGeorgianMobile("555 12 34 56")).toBe("995555123456");
  });

  it("leaves an already-international number alone", () => {
    expect(normalizeGeorgianMobile("995555123456")).toBe("995555123456");
    expect(normalizeGeorgianMobile("+995 555 123 456")).toBe("995555123456");
  });

  it("strips the punctuation people actually type", () => {
    expect(normalizeGeorgianMobile("(+995) 555-12-34-56")).toBe("995555123456");
  });
});
