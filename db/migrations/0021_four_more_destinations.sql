-- Four destinations named in CR-2026-0018 that the site did not have.
--
-- The ticket lists nineteen places the site should cover. Fifteen existed;
-- Okatse Canyon, Tusheti, Khevsureti and Goderdzi did not — no location row, no
-- curated entry, no page. /ka/destinations/okatse answered 404.
--
-- in_service_area is FALSE for all four, which is the point of this migration
-- rather than an oversight.
--
-- The destination page reads its name straight from this table and does not
-- filter on the flag, so the page works. The booking search DOES filter on it
-- (src/app/[locale]/page.tsx queries `FROM locations WHERE in_service_area`),
-- so these places stay out of the from/to fields. That is deliberate: three of
-- the four are reachable only by 4x4 on unpaved mountain road, two of them for
-- roughly four months of the year, and none has a route_families row, so there
-- is no price to quote. Listing them as bookable would offer a journey we
-- cannot cost, to a road we have not checked, in a car the traveller may not
-- have chosen.
--
-- Flipping any of them to true is a one-line UPDATE the day a driver, a price
-- and a road report exist for it.
--
-- location_type has no REGION member (AIRPORT/CITY/TOWN/ATTRACTION/RESORT/
-- BORDER/ADDRESS), so Tusheti and Khevsureti are ATTRACTION, matching how
-- Martvili Canyon was typed in 0008. Adding an enum member for two rows would
-- change a type every location in the system is validated against.
--
-- Coordinates are the settlements travellers actually mean: Omalo for Tusheti,
-- Shatili for Khevsureti, the pass itself for Goderdzi, and the canyon mouth at
-- Gordi for Okatse.

INSERT INTO locations (slug, type, name_en, name_ka, name_ru, region, lat, lon, timezone, in_service_area, seo_indexed)
VALUES
  ('okatse',      'ATTRACTION', 'Okatse Canyon', 'ოკაცეს კანიონი', 'Каньон Окаце', 'Imereti',   42.474, 42.529, 'Asia/Tbilisi', false, false),
  ('tusheti',     'ATTRACTION', 'Tusheti',       'თუშეთი',         'Тушети',       'Kakheti',   42.365, 45.640, 'Asia/Tbilisi', false, false),
  ('khevsureti',  'ATTRACTION', 'Khevsureti',    'ხევსურეთი',      'Хевсурети',    'Mtskheta',  42.659, 45.160, 'Asia/Tbilisi', false, false),
  ('goderdzi',    'RESORT',   'Goderdzi',      'გოდერძი',        'Годердзи',     'Adjara',    41.634, 42.489, 'Asia/Tbilisi', false, false)
ON CONFLICT (slug) DO NOTHING;
