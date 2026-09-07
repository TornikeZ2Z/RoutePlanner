import { sql } from "@db/client";

/**
 * Decision rounds: the questions we need answered before work can continue.
 *
 * The mirror image of change-requests. That queue carries what the team wants
 * built; this carries what we need them to decide. Same shape deliberately —
 * an unguessable link, no login, self-reported names — because it is the same
 * people, and an account requirement is what keeps them quiet.
 */
export interface DecisionOption {
  v: string;
  label: string;
  why: string;
  /** Our suggestion, marked as such. It is never the decision. */
  rec?: boolean;
}

export interface DecisionQuestion {
  id: string;
  position: number;
  ticket: string;
  item: string;
  title: string;
  ask: string;
  stands: string[];
  refs: string[];
  need: string;
  options: DecisionOption[];
}

export interface DecisionRound {
  id: string;
  slug: string;
  title: string;
  lede: string;
  accepting: boolean;
  questions: DecisionQuestion[];
}

export interface DecisionAnswer {
  id: string;
  questionId: string;
  choice: string | null;
  notes: string | null;
  answeredBy: string;
  createdAt: string;
}

/** Options come back from JSONB as unknown; keep only well-formed entries
    rather than trusting a hand-written insert. */
function parseOptions(raw: unknown): DecisionOption[] {
  if (!Array.isArray(raw)) return [];
  const out: DecisionOption[] = [];
  for (const o of raw) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    if (typeof r.v !== "string" || typeof r.label !== "string") continue;
    out.push({
      v: r.v,
      label: r.label,
      why: typeof r.why === "string" ? r.why : "",
      ...(r.rec === true ? { rec: true as const } : {}),
    });
  }
  return out;
}

interface RoundRow {
  id: string; slug: string; title: string; lede: string; accepting: boolean;
}
interface QuestionRow {
  id: string; position: number; ticket: string; item: string; title: string;
  ask: string; stands: string[]; refs: string[]; need: string; options: unknown;
}

/** One round with its questions in order, or null when the slug is unknown. */
export async function getRound(slug: string): Promise<DecisionRound | null> {
  const [round] = await sql<RoundRow[]>`
    SELECT id, slug, title, lede, accepting FROM decision_rounds WHERE slug = ${slug}`;
  if (!round) return null;

  const rows = await sql<QuestionRow[]>`
    SELECT id, position, ticket, item, title, ask, stands, refs, need, options
    FROM decision_questions WHERE round_id = ${round.id}::uuid ORDER BY position`;

  return {
    ...round,
    questions: rows.map((q) => ({ ...q, options: parseOptions(q.options) })),
  };
}

/** The round a link with no slug should open: the newest one still accepting. */
export async function currentRoundSlug(): Promise<string | null> {
  const [row] = await sql<{ slug: string }[]>`
    SELECT slug FROM decision_rounds WHERE accepting
    ORDER BY created_at DESC LIMIT 1`;
  return row?.slug ?? null;
}

/**
 * Record a set of answers.
 *
 * One row per answered question, appended. Nothing is updated: somebody
 * answering a second time is a second answer, and the console shows both in
 * order rather than pretending the first never happened.
 *
 * Returns how many were stored, so the form can say something true.
 */
export async function recordAnswers(
  roundSlug: string,
  answeredBy: string,
  given: { questionId: string; choice?: string; notes?: string }[],
): Promise<number> {
  if (given.length === 0) return 0;

  const round = await getRound(roundSlug);
  if (!round || !round.accepting) return 0;

  // Only questions that belong to this round, and only choices the question
  // actually offers — the ids arrive from a form and are not to be trusted.
  const byId = new Map(round.questions.map((q) => [q.id, q]));
  const rows = given.flatMap((a) => {
    const q = byId.get(a.questionId);
    if (!q) return [];
    const choice = a.choice && q.options.some((o) => o.v === a.choice) ? a.choice : null;
    const notes = (a.notes ?? "").trim().slice(0, 4000) || null;
    if (!choice && !notes) return [];
    return [{ questionId: q.id, choice, notes }];
  });
  if (rows.length === 0) return 0;

  const who = answeredBy.trim().slice(0, 120);
  for (const r of rows) {
    await sql`
      INSERT INTO decision_answers (question_id, choice, notes, answered_by)
      VALUES (${r.questionId}::uuid, ${r.choice}, ${r.notes}, ${who})`;
  }
  return rows.length;
}

/** Every answer in a round, newest first within each question. */
export async function listAnswers(roundSlug: string): Promise<DecisionAnswer[]> {
  const rows = await sql<{
    id: string; question_id: string; choice: string | null;
    /* timestamptz arrives as a Date from some driver configurations and as a
       string from others; both reach here, so neither is assumed. */
    notes: string | null; answered_by: string; created_at: Date | string;
  }[]>`
    SELECT a.id, a.question_id, a.choice, a.notes, a.answered_by, a.created_at
    FROM decision_answers a
    JOIN decision_questions q ON q.id = a.question_id
    JOIN decision_rounds r ON r.id = q.round_id
    WHERE r.slug = ${roundSlug}
    ORDER BY q.position, a.created_at DESC`;
  return rows.map((r) => ({
    id: r.id,
    questionId: r.question_id,
    choice: r.choice,
    notes: r.notes,
    answeredBy: r.answered_by,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/** Rounds for the console, with how much of each has come back. */
export async function listRounds(): Promise<
  { slug: string; title: string; accepting: boolean; questions: number; answered: number }[]
> {
  return sql<{ slug: string; title: string; accepting: boolean; questions: number; answered: number }[]>`
    SELECT r.slug, r.title, r.accepting,
           count(DISTINCT q.id)::int AS questions,
           count(DISTINCT a.question_id)::int AS answered
    FROM decision_rounds r
    LEFT JOIN decision_questions q ON q.round_id = r.id
    LEFT JOIN decision_answers a ON a.question_id = q.id
    GROUP BY r.id, r.slug, r.title, r.accepting, r.created_at
    ORDER BY r.created_at DESC`;
}
