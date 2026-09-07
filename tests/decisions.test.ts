/**
 * Decision rounds, against a real Postgres.
 *
 * The form takes question ids from a page anyone with the link can open, so
 * the interesting cases are all the ones where the browser lies: a choice the
 * question never offered, a question belonging to a different round, an id
 * that is not in any round at all. None of those may reach the table.
 *
 * Skips cleanly when no database is reachable, like the other integration
 * tests here.
 */
import { describe, it, expect, afterAll } from "vitest";
import postgres from "postgres";
import { recordAnswers, getRound, listAnswers, latestAnswersBy } from "@/lib/decisions";

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {}, connect_timeout: 3 });

const SLUG = "test-round-decisions";
const OTHER = "test-round-decisions-other";

let reachable = false;
let qA = "", qB = "", qOther = "";

try {
  await sql`DELETE FROM decision_rounds WHERE slug IN (${SLUG}, ${OTHER})`;

  const [round] = await sql<{ id: string }[]>`
    INSERT INTO decision_rounds (slug, title) VALUES (${SLUG}, 'Test round') RETURNING id`;
  const [other] = await sql<{ id: string }[]>`
    INSERT INTO decision_rounds (slug, title) VALUES (${OTHER}, 'Other round') RETURNING id`;

  const opts = JSON.stringify([
    { v: "yes", label: "Yes", why: "", rec: true },
    { v: "no", label: "No", why: "" },
  ]);
  const [a] = await sql<{ id: string }[]>`
    INSERT INTO decision_questions (round_id, position, title, need, options)
    VALUES (${round!.id}::uuid, 10, 'A', 'Pick one', ${opts}::text::jsonb) RETURNING id`;
  const [b] = await sql<{ id: string }[]>`
    INSERT INTO decision_questions (round_id, position, title, need, options)
    VALUES (${round!.id}::uuid, 20, 'B', 'Pick one', ${opts}::text::jsonb) RETURNING id`;
  const [o] = await sql<{ id: string }[]>`
    INSERT INTO decision_questions (round_id, position, title, need, options)
    VALUES (${other!.id}::uuid, 10, 'Elsewhere', 'Pick one', ${opts}::text::jsonb) RETURNING id`;

  qA = a!.id; qB = b!.id; qOther = o!.id;
  reachable = true;
} catch {
  console.warn("[decisions.test] No database reachable — skipping.");
}

afterAll(async () => {
  if (reachable) await sql`DELETE FROM decision_rounds WHERE slug IN (${SLUG}, ${OTHER})`;
  await sql.end({ timeout: 1 });
});

describe.skipIf(!reachable)("recording answers", () => {
  it("stores a choice and a note, and reads them back", async () => {
    const n = await recordAnswers(SLUG, "  Nikusha  ", [
      { questionId: qA, choice: "yes" },
      { questionId: qB, notes: "  needs a conversation  " },
    ]);
    expect(n).toBe(2);

    const answers = await listAnswers(SLUG);
    const forA = answers.find((x) => x.questionId === qA);
    const forB = answers.find((x) => x.questionId === qB);

    expect(forA?.choice).toBe("yes");
    expect(forA?.answeredBy).toBe("Nikusha");   // trimmed
    expect(forB?.notes).toBe("needs a conversation");
    expect(forB?.choice).toBeNull();
  });

  it("refuses a choice the question does not offer", async () => {
    // The value comes from a form; nothing stops somebody sending anything.
    const n = await recordAnswers(SLUG, "someone", [{ questionId: qA, choice: "maybe" }]);
    expect(n).toBe(0);
  });

  it("keeps the note when the choice is bogus", async () => {
    const n = await recordAnswers(SLUG, "someone", [
      { questionId: qA, choice: "maybe", notes: "but here is what I think" },
    ]);
    expect(n).toBe(1);
    const kept = (await listAnswers(SLUG)).find((x) => x.notes === "but here is what I think");
    expect(kept?.choice).toBeNull();
  });

  it("ignores a question from another round", async () => {
    const n = await recordAnswers(SLUG, "someone", [{ questionId: qOther, choice: "yes" }]);
    expect(n).toBe(0);
    expect((await listAnswers(OTHER))).toHaveLength(0);
  });

  it("ignores an id that is not a question at all", async () => {
    const n = await recordAnswers(SLUG, "someone", [
      { questionId: "00000000-0000-0000-0000-000000000000", choice: "yes" },
    ]);
    expect(n).toBe(0);
  });

  it("skips entries with neither a choice nor a note", async () => {
    const n = await recordAnswers(SLUG, "someone", [
      { questionId: qA, notes: "   " },
      { questionId: qB },
    ]);
    expect(n).toBe(0);
  });

  it("takes nothing once the round is closed", async () => {
    await sql`UPDATE decision_rounds SET accepting = false WHERE slug = ${SLUG}`;
    const n = await recordAnswers(SLUG, "late", [{ questionId: qA, choice: "no" }]);
    expect(n).toBe(0);
    await sql`UPDATE decision_rounds SET accepting = true WHERE slug = ${SLUG}`;
  });

  it("keeps both answers when two people disagree", async () => {
    // The whole reason answers are appended: a later answer must not erase an
    // earlier one, because the disagreement is the thing worth seeing.
    await recordAnswers(SLUG, "first", [{ questionId: qB, choice: "yes" }]);
    await recordAnswers(SLUG, "second", [{ questionId: qB, choice: "no" }]);
    const forB = (await listAnswers(SLUG)).filter((x) => x.questionId === qB);
    expect(forB.filter((x) => x.choice === "yes").length).toBeGreaterThan(0);
    expect(forB.filter((x) => x.choice === "no").length).toBeGreaterThan(0);
  });
});

describe.skipIf(!reachable)("showing somebody their own answers back", () => {
  it("returns the latest answer per question for that person", async () => {
    await recordAnswers(SLUG, "Ana", [{ questionId: qA, choice: "yes" }]);
    await recordAnswers(SLUG, "Ana", [{ questionId: qA, choice: "no", notes: "changed my mind" }]);

    const mine = await latestAnswersBy(SLUG, "Ana");
    expect(mine.get(qA)?.choice).toBe("no");
    expect(mine.get(qA)?.notes).toBe("changed my mind");
  });

  it("does not show one person another person's answers", async () => {
    await recordAnswers(SLUG, "Beso", [{ questionId: qB, choice: "yes" }]);
    expect((await latestAnswersBy(SLUG, "Ana")).has(qB)).toBe(false);
  });

  it("matches the name regardless of case or padding", async () => {
    // The name is typed by hand every time; "Ana" and " ana " are one person.
    expect((await latestAnswersBy(SLUG, "  ANA  ")).get(qA)?.choice).toBe("no");
  });

  it("is empty for a name nobody used, and for no name at all", async () => {
    expect((await latestAnswersBy(SLUG, "Nobody")).size).toBe(0);
    expect((await latestAnswersBy(SLUG, "   ")).size).toBe(0);
  });
});

describe.skipIf(!reachable)("the database enforces it too", () => {
  it("refuses to rewrite an answer", async () => {
    await recordAnswers(SLUG, "someone", [{ questionId: qA, choice: "yes" }]);
    const [row] = await sql<{ id: string }[]>`
      SELECT a.id FROM decision_answers a
      JOIN decision_questions q ON q.id = a.question_id
      WHERE q.id = ${qA}::uuid LIMIT 1`;
    await expect(
      sql`UPDATE decision_answers SET choice = 'no' WHERE id = ${row!.id}::uuid`,
    ).rejects.toThrow(/append-only/);
  });

  it("refuses an answer that says nothing", async () => {
    await expect(
      sql`INSERT INTO decision_answers (question_id, choice, notes)
          VALUES (${qA}::uuid, NULL, '   ')`,
    ).rejects.toThrow();
  });
});

describe.skipIf(!reachable)("reading a round", () => {
  it("returns questions in position order with parsed options", async () => {
    const round = await getRound(SLUG);
    expect(round?.questions.map((q) => q.title)).toEqual(["A", "B"]);
    expect(round?.questions[0]?.options.map((o) => o.v)).toEqual(["yes", "no"]);
    expect(round?.questions[0]?.options[0]?.rec).toBe(true);
  });

  it("is null for a slug nobody has", async () => {
    expect(await getRound("no-such-round")).toBeNull();
  });
});
