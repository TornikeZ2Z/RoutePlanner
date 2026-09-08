-- Close the decision rounds that have nothing left to ask.
--
-- Four rounds have gone out since 5 September and every one of them is still
-- accepting, so four form links are live at once. The people answering have no
-- way to tell which is current, and the console's "form link" line offers a
-- different URL on each card. Round four is the current one; the rest are done.
--
-- The predicate does the deciding rather than a list of slugs. A round closes
-- only when every question in it has at least one answer — an unanswered
-- question means somebody still owes us something, and closing that round would
-- shut the only door they have. Round four is named as the exception because it
-- IS fully answered and still needs to stay reachable while the work its
-- answers unblocked is finishing.
--
-- Closed is not deleted: accepting = false keeps the round and its answers
-- readable in /admin/decisions and only stops /d/<slug> taking new ones.
-- Reopening is the same UPDATE with true.

UPDATE decision_rounds r
   SET accepting = false
 WHERE r.accepting
   AND r.slug <> 'close-out-2026-09'
   AND EXISTS (SELECT 1 FROM decision_questions q WHERE q.round_id = r.id)
   AND NOT EXISTS (
         SELECT 1
           FROM decision_questions q
          WHERE q.round_id = r.id
            AND NOT EXISTS (
                  SELECT 1 FROM decision_answers a WHERE a.question_id = q.id));
