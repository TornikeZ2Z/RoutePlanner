-- The rest of CR-2026-0036, and the answers that came back on 8 September.
--
-- Eleven places the ticket named that had no location row: seven on the
-- Adjarian and Gurian coast, Khulo in the Adjarian highland, Gori, Tskaltubo
-- and Lagodekhi. Everything else on that list of about eighty is either
-- already here or is a sight inside somewhere that is — Svetitskhoveli belongs
-- to Mtskheta, Omalo to Tusheti — which is what the form asked and what both
-- requestors answered: "split, destinations separately, sights inside them".
--
-- in_service_area is TRUE for all eleven, and the four from 0021 are flipped to
-- match. That is the other answer: asked whether the new places should be
-- bookable or read-only, both said bookable, priced per driver. The form said
-- plainly what that costs — "where we have no price, search returns no driver
-- found" — and they chose it anyway, so the fields now offer these places and
-- an empty result is an honest empty result rather than a hidden one.
--
-- What this does NOT do is invent the minimum price one of them described
-- ("we set a minimum, and when the client presses, that is the price"). That is
-- a pricing mechanism, not a row, and it does not exist yet.
--
-- region is filled for every destination, by historic province rather than by
-- mkhare: the ticket asked for the list to be grouped "by region" and its own
-- example was Guria. 0021 wrote administrative names into four rows; those are
-- rewritten here so one scheme applies to all of them.

INSERT INTO locations (slug, type, name_en, name_ka, name_ru, region, lat, lon, timezone, in_service_area, seo_indexed)
VALUES
  ('kobuleti',      'TOWN',    'Kobuleti',      'ქობულეთი',      'Кобулети',      'Adjara',             41.8214,  41.7783, 'Asia/Tbilisi', true, true),
  ('chakvi',        'TOWN',    'Chakvi',        'ჩაქვი',         'Чакви',         'Adjara',             41.7369,  41.7231, 'Asia/Tbilisi', true, true),
  ('tsikhisdziri',  'RESORT',  'Tsikhisdziri',  'ციხისძირი',     'Цихисдзири',    'Adjara',             41.7628,  41.7419, 'Asia/Tbilisi', true, true),
  ('makhinjauri',   'RESORT',  'Makhinjauri',   'მახინჯაური',    'Махинджаури',   'Adjara',             41.6772,  41.6656, 'Asia/Tbilisi', true, true),
  ('kvariati',      'RESORT',  'Kvariati',      'კვარიათი',      'Квариати',      'Adjara',             41.5646,  41.5626, 'Asia/Tbilisi', true, true),
  ('sarpi',         'RESORT',  'Sarpi',         'სარფი',         'Сарпи',         'Adjara',             41.5228,  41.5486, 'Asia/Tbilisi', true, true),
  ('grigoleti',     'RESORT',  'Grigoleti',     'გრიგოლეთი',     'Григолети',     'Guria',              42.0403,  41.7594, 'Asia/Tbilisi', true, true),
  ('khulo',         'TOWN',    'Khulo',         'ხულო',          'Хуло',          'Adjara',             41.6403,  42.3092, 'Asia/Tbilisi', true, true),
  ('gori',          'CITY',    'Gori',          'გორი',          'Гори',          'Kartli',             41.9847,  44.1086, 'Asia/Tbilisi', true, true),
  ('tskaltubo',     'TOWN',    'Tskaltubo',     'წყალტუბო',      'Цхалтубо',      'Imereti',            42.3272,  42.6006, 'Asia/Tbilisi', true, true),
  ('lagodekhi',     'TOWN',    'Lagodekhi',     'ლაგოდეხი',      'Лагодехи',      'Kakheti',            41.8236,  46.2775, 'Asia/Tbilisi', true, true)
ON CONFLICT (slug) DO NOTHING;

-- CR-2026-0036, the booking answer.
UPDATE locations SET in_service_area = true, seo_indexed = true
  WHERE slug IN ('okatse', 'tusheti', 'khevsureti', 'goderdzi');

UPDATE locations SET region = 'Adjara'
  WHERE slug IN ('batumi', 'chakvi', 'goderdzi', 'khulo', 'kobuleti', 'kvariati', 'makhinjauri', 'sarpi', 'tsikhisdziri');

UPDATE locations SET region = 'Guria'
  WHERE slug IN ('bakhmaro', 'grigoleti', 'shekvetili', 'ureki');

UPDATE locations SET region = 'Imereti'
  WHERE slug IN ('kutaisi', 'okatse', 'tskaltubo');

UPDATE locations SET region = 'Kakheti'
  WHERE slug IN ('kvareli', 'lagodekhi', 'sighnaghi', 'telavi', 'tsinandali');

UPDATE locations SET region = 'Kartli'
  WHERE slug IN ('gori', 'mtskheta');

UPDATE locations SET region = 'Khevi and Mtiuleti'
  WHERE slug IN ('gudauri', 'kazbegi');

UPDATE locations SET region = 'Khevsureti'
  WHERE slug IN ('khevsureti');

UPDATE locations SET region = 'Racha'
  WHERE slug IN ('ambrolauri', 'oni');

UPDATE locations SET region = 'Samegrelo'
  WHERE slug IN ('martvili', 'zugdidi');

UPDATE locations SET region = 'Samtskhe-Javakheti'
  WHERE slug IN ('abastumani', 'akhaltsikhe', 'bakuriani', 'borjomi', 'vardzia');

UPDATE locations SET region = 'Svaneti'
  WHERE slug IN ('mestia');

UPDATE locations SET region = 'Tbilisi'
  WHERE slug IN ('tbilisi');

UPDATE locations SET region = 'Tusheti'
  WHERE slug IN ('tusheti');
