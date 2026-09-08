-- Record which tour a quote was for.
--
-- CR-2026-0018 asks for Reviews on every tour page. That section could not be
-- written, and not for the reason everybody assumed: it is not that no review
-- exists yet, it is that the schema cannot express the question. Follow the
-- chain — reviews.booking_id -> bookings.quote_id -> quotes — and there is no
-- tour anywhere on it. quotes carries route_family_id and nothing else about
-- what was sold.
--
-- Worse, route_family_id is NULL for exactly the bookings this is about:
-- searchOffers resolves a tour and then prices it INSTEAD of a route family
-- (src/lib/offers.ts:150 — the family lookup is skipped when a tour is set), so
-- a tour booking today records neither. The product is priced, sold, driven and
-- paid for without a single row saying which product it was.
--
-- That is a reporting hole before it is a reviews hole. "How did the Kazbegi
-- day trip sell this month" has no answer in this database, and neither does
-- "show me what travellers said about it".
--
-- Nullable, because most quotes are not tours: a transfer from A to B has a
-- route family and no tour, and this column stays NULL for it. ON DELETE SET
-- NULL rather than CASCADE — retiring a tour must not delete the money.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS tour_id UUID REFERENCES tours(id) ON DELETE SET NULL;

-- The lookup a tour page makes: published reviews for one tour. Partial,
-- because a quote with no tour is never asked this question.
CREATE INDEX IF NOT EXISTS quotes_tour_idx ON quotes (tour_id) WHERE tour_id IS NOT NULL;

COMMENT ON COLUMN quotes.tour_id IS
  'The curated tour this quote priced, when it priced one. NULL for point-to-point transfers, which carry route_family_id instead.';
