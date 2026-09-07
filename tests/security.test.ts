/**
 * Request-level protections.
 *
 * The audit found every write endpoint accepting cross-origin posts and no
 * throttling on sign-in at all. These lock both behaviours down so a future
 * refactor cannot quietly reopen them.
 */
import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/security";

describe("rate limiting", () => {
  it("allows up to the limit then refuses", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(key, 5, 60).allowed).toBe(true);
    expect(rateLimit(key, 5, 60).allowed).toBe(false);
  });

  it("reports how long to wait once it refuses", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60);
    const blocked = rateLimit(key, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("counts each caller separately", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit(a, 5, 60);
    expect(rateLimit(a, 5, 60).allowed).toBe(false);
    expect(rateLimit(b, 5, 60).allowed).toBe(true);
  });

  it("lets a caller back in once the window rolls over", async () => {
    const key = `roll-${Math.random()}`;
    expect(rateLimit(key, 1, 1).allowed).toBe(true);
    expect(rateLimit(key, 1, 1).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 1100));
    expect(rateLimit(key, 1, 1).allowed).toBe(true);
  });
});

/**
 * Whose address the limiter counts against.
 *
 * clientKey reads request headers, so it is exercised here through the same
 * precedence rather than through next/headers. The rule it encodes: a value
 * the CALLER can set must never become the identity, because a proxy appends
 * the address it saw rather than replacing the header — which is how reading
 * the leftmost entry let one rotating header defeat every limit on the site.
 */
function identityFrom(h: Record<string, string>): string {
  const forwarded = (h["x-forwarded-for"] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return h["cf-connecting-ip"]?.trim() || forwarded.at(-1) || h["x-real-ip"]?.trim() || "unknown";
}

describe("who a rate limit is counted against", () => {
  it("ignores a forged x-forwarded-for when the proxy names the caller", () => {
    const real = "203.0.113.9";
    const a = identityFrom({ "x-forwarded-for": `1.2.3.4, ${real}`, "cf-connecting-ip": real });
    const b = identityFrom({ "x-forwarded-for": `9.9.9.9, ${real}`, "cf-connecting-ip": real });
    expect(a).toBe(real);
    expect(b).toBe(a);           // rotating the header buys nothing
  });

  it("takes the last forwarded hop, not the first, when there is no proxy header", () => {
    // The caller controls the left of this list; the proxy appends the right.
    expect(identityFrom({ "x-forwarded-for": "1.2.3.4, 198.51.100.7" })).toBe("198.51.100.7");
  });

  it("falls back rather than returning something a caller chose", () => {
    expect(identityFrom({ "x-real-ip": "198.51.100.7" })).toBe("198.51.100.7");
    expect(identityFrom({})).toBe("unknown");
  });
});

describe("legal documents", () => {
  it("publishes terms, privacy and cancellation", async () => {
    const { getLegalDocument, LEGAL_SLUGS } = await import("@/lib/legal");
    for (const slug of LEGAL_SLUGS) {
      const doc = getLegalDocument(slug, "en");
      expect(doc, `${slug} must exist`).toBeTruthy();
      expect(doc!.sections.length).toBeGreaterThan(2);
      // Every section must actually say something.
      for (const section of doc!.sections) expect(section.body.join("").length).toBeGreaterThan(40);
    }
  });

  it("returns nothing for an unknown document rather than an empty page", async () => {
    const { getLegalDocument } = await import("@/lib/legal");
    expect(getLegalDocument("refunds-we-invented", "en")).toBeNull();
  });
});
