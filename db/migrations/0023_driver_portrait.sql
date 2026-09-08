-- A portrait for the driver, so a traveller can see who is coming.
--
-- CR-2026-0011 item 19 asks for the specific driver to be visible in the
-- booking flow: photo, name, rating, review count, languages, experience.
-- Everything on that list existed except the photo, and it was missing for a
-- concrete reason — driver_profiles had no column to hold one. The profile
-- page has been drawing the first letter of the name in a circle instead.
--
-- Two columns rather than a driver_media table. vehicle_media is the closest
-- existing thing and it is a table because a vehicle has many photographs in a
-- gallery; a person has one face. A table here would be a gallery nobody asked
-- for, and a second thing to moderate.
--
-- portrait_state reuses the review_state enum that already governs driver
-- documents and vehicle photographs, so this joins the moderation pipeline that
-- exists rather than inventing a parallel one. Both requestors independently
-- insisted on the same guarantee — "the photo must be checked, we cannot take
-- the driver's word for it" — and PENDING is the default, so nothing a driver
-- sends is public until somebody approves it.
--
-- The file itself goes in public-media, NOT restricted-kyc. A portrait is meant
-- to be seen; identity documents are not, and putting a public image in the
-- restricted bucket would either not render or force the restricted bucket open.
-- Those two buckets are separate precisely so that mistake is impossible.

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS portrait_key   TEXT,
  ADD COLUMN IF NOT EXISTS portrait_state review_state NOT NULL DEFAULT 'PENDING';

-- The lookup a public page makes: an approved portrait for a published driver.
-- Partial, because a pending or rejected portrait is never fetched by name.
CREATE INDEX IF NOT EXISTS driver_profiles_portrait_idx
  ON driver_profiles (id)
  WHERE portrait_key IS NOT NULL AND portrait_state = 'APPROVED';

COMMENT ON COLUMN driver_profiles.portrait_key IS
  'Storage key in public-media. Never restricted-kyc: this image is meant to be seen.';
COMMENT ON COLUMN driver_profiles.portrait_state IS
  'PENDING until operations approve it. Public pages must check this, not just the key.';
