-- =========================================================================
-- 0020 — questions we need answered, and the answers
--
-- The change-request queue carries what the team wants built. This carries
-- the other direction: what we need decided before we can build it. An audit
-- of 97 requested items left eleven that no amount of engineering resolves —
-- they need a person to choose, or to supply something only they know. Those
-- eleven had been sitting in a chat message, which is where they were still
-- sitting a week later.
--
-- Modelled on change_requests deliberately, down to the unguessable link and
-- the absent login: the people who have to answer are the same people, and
-- requiring an account is the friction that keeps them quiet.
--
-- Questions live in the database rather than in code so a new round is an
-- insert, not a deploy. This will happen repeatedly — every audit produces a
-- fresh set — and a process that needs an engineer to start it is a process
-- that stops the first week nobody has time.
--
-- Answers are append-only, one row per submission. Two people may answer the
-- same question and disagree; that disagreement is information and must not
-- be silently resolved by whoever saved last. The console shows every answer
-- with who gave it and when, and a human decides.
-- =========================================================================

CREATE TABLE decision_rounds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Short, human, and part of the URL people are sent.
  slug       TEXT NOT NULL,
  title      TEXT NOT NULL,
  -- Shown above the questions: why this landed in their inbox.
  lede       TEXT NOT NULL DEFAULT '',
  -- Closed rounds stay readable in the console but stop accepting answers.
  accepting  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT decision_rounds_slug_uq UNIQUE (slug),
  CONSTRAINT decision_rounds_slug_ck CHECK (slug ~ '^[a-z0-9-]{3,60}$')
);

CREATE TABLE decision_questions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id  UUID NOT NULL REFERENCES decision_rounds(id) ON DELETE CASCADE,
  -- Display order. Sparse on purpose, so a question can be inserted between
  -- two others without renumbering the round.
  position  INTEGER NOT NULL,

  -- Where it came from, so the reader can tell it is their own request being
  -- quoted back at them and not a new demand.
  ticket    TEXT NOT NULL DEFAULT '',
  item      TEXT NOT NULL DEFAULT '',

  title     TEXT NOT NULL,
  -- The original request, quoted.
  ask       TEXT NOT NULL DEFAULT '',
  -- What exists today, one paragraph per element, with the files it was
  -- checked against — so a claim about the code can be verified rather than
  -- taken on trust.
  stands    TEXT[] NOT NULL DEFAULT '{}',
  refs      TEXT[] NOT NULL DEFAULT '{}',
  -- The actual question.
  need      TEXT NOT NULL,
  /*
   * [{ "v": "keep4", "label": "…", "why": "…", "rec": true }]
   *
   * JSON rather than a table: options are only ever read as a whole set with
   * their question, never queried across questions, and a four-row join for
   * something that is edited as one unit buys nothing.
   */
  options   JSONB NOT NULL DEFAULT '[]',

  CONSTRAINT decision_questions_pos_uq UNIQUE (round_id, position),
  CONSTRAINT decision_questions_options_ck CHECK (jsonb_typeof(options) = 'array')
);

CREATE INDEX decision_questions_round_idx ON decision_questions (round_id, position);

CREATE TABLE decision_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES decision_questions(id) ON DELETE CASCADE,

  -- The option they picked, or NULL when they only wrote prose. One of the
  -- two must be present; a row with neither is not an answer.
  choice      TEXT,
  notes       TEXT,
  -- Self-reported, like the change-request form. Whoever shared the link
  -- knows who they sent it to.
  answered_by TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT decision_answers_something_ck
    CHECK (choice IS NOT NULL OR length(btrim(coalesce(notes, ''))) > 0)
);

CREATE INDEX decision_answers_question_idx ON decision_answers (question_id, created_at DESC);

/*
 * An answer is never edited. It is a thing somebody said at a moment, and
 * rewriting it loses the fact that they said it — if they change their mind
 * they answer again and the console shows both, in order.
 *
 * UPDATE only, not DELETE: decision_questions cascades on delete, so blocking
 * DELETE here would make removing a question from a round impossible. Losing
 * the answers along with the question they answered is coherent; silently
 * rewriting one is not.
 */
CREATE OR REPLACE FUNCTION decision_answers_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'decision_answers is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decision_answers_no_update
  BEFORE UPDATE ON decision_answers
  FOR EACH ROW EXECUTE FUNCTION decision_answers_append_only();
