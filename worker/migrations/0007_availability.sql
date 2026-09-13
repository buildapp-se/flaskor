-- Migration number: 0007 	 2026-09-13
-- Två nya lägen i availability (slutsåld, slut hos leverantören) och Systembolagets sortimentskod på raden,
-- så Önskelistan kan säga "Ordervara · Slut hos leverantören" i stället för "Tillfälligt slut". SQLite kan inte
-- vidga en CHECK, därför byggs tabellen om som i 0003.
--
-- Fällan sedan 0005: namnbytet drink -> drink_old skriver om tasting's REFERENCES drink(id) till drink_old, och
-- DROP drink_old hade då raderat hela drucken-loggen via ON DELETE CASCADE (PRAGMA legacy_alter_table hjälper
-- inte i D1, prövat lokalt 2026-09-13). Därför byggs tasting om mot den nya drink innan drink_old släpps.

ALTER TABLE drink RENAME TO drink_old;

CREATE TABLE drink (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES household(id),
  kind TEXT NOT NULL CHECK (kind IN ('wine', 'spirit', 'beer')),
  owned INTEGER NOT NULL DEFAULT 0 CHECK (owned IN (0, 1)),
  name TEXT NOT NULL,
  producer TEXT,
  vintage INTEGER,
  country TEXT,
  region TEXT,
  category TEXT,
  style TEXT,
  grapes TEXT,
  volume_ml INTEGER,
  alcohol REAL,
  source_kind TEXT NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('systembolaget', 'caviste', 'manual')),
  source_id TEXT,
  source_url TEXT,
  image_url TEXT,
  sb_product_id TEXT,
  sb_assortment TEXT,
  price_paid REAL,
  price_current REAL,
  price_checked_at TEXT,
  availability TEXT NOT NULL DEFAULT 'unknown' CHECK (availability IN ('in_stock', 'temporarily_out', 'supplier_out', 'sold_out', 'discontinued', 'unknown')),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  open_level INTEGER CHECK (open_level IN (1, 2, 3, 4)),
  drink_from INTEGER,
  drink_to INTEGER,
  serve_temp TEXT,
  decant_hours REAL,
  food TEXT,
  note TEXT,
  taste TEXT,
  vivino_rating REAL,
  vivino_count INTEGER,
  vivino_url TEXT,
  vivino_checked_at TEXT,
  rating REAL,
  rating_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO drink (
  id, household_id, kind, owned, name, producer, vintage, country, region, category, style, grapes,
  volume_ml, alcohol, source_kind, source_id, source_url, image_url, sb_product_id, price_paid, price_current,
  price_checked_at, availability, count, open_level, drink_from, drink_to, serve_temp, decant_hours,
  food, note, taste, vivino_rating, vivino_count, vivino_url, vivino_checked_at, rating, rating_url, created_at, updated_at
)
SELECT
  id, household_id, kind, owned, name, producer, vintage, country, region, category, style, grapes,
  volume_ml, alcohol, source_kind, source_id, source_url, image_url, sb_product_id, price_paid, price_current,
  price_checked_at, availability, count, open_level, drink_from, drink_to, serve_temp, decant_hours,
  food, note, taste, vivino_rating, vivino_count, vivino_url, vivino_checked_at, rating, rating_url, created_at, updated_at
FROM drink_old;

CREATE TABLE tasting_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drink_id INTEGER NOT NULL REFERENCES drink(id) ON DELETE CASCADE,
  drunk_on TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO tasting_new (id, drink_id, drunk_on, rating, note, created_at)
SELECT id, drink_id, drunk_on, rating, note, created_at FROM tasting;

DROP TABLE tasting;
DROP TABLE drink_old;

ALTER TABLE tasting_new RENAME TO tasting;

CREATE INDEX drink_household ON drink (household_id);
CREATE INDEX tasting_drink ON tasting (drink_id, drunk_on DESC);
