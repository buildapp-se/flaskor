-- Migration number: 0003 	 2026-09-07
-- Öl som tredje kind (kräver ombyggd tabell, SQLite kan inte ändra en CHECK), plus eget betygsfält
-- för sprit och öl: Vivino täcker bara vin.

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
  price_paid REAL,
  price_current REAL,
  price_checked_at TEXT,
  availability TEXT NOT NULL DEFAULT 'unknown' CHECK (availability IN ('in_stock', 'temporarily_out', 'discontinued', 'unknown')),
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
  volume_ml, alcohol, source_kind, source_id, source_url, image_url, price_paid, price_current,
  price_checked_at, availability, count, open_level, drink_from, drink_to, serve_temp, decant_hours,
  food, note, taste, vivino_rating, vivino_count, vivino_url, vivino_checked_at, created_at, updated_at
)
SELECT
  id, household_id, kind, owned, name, producer, vintage, country, region, category, style, grapes,
  volume_ml, alcohol, source_kind, source_id, source_url, image_url, price_paid, price_current,
  price_checked_at, availability, count, open_level, drink_from, drink_to, serve_temp, decant_hours,
  food, note, taste, vivino_rating, vivino_count, vivino_url, vivino_checked_at, created_at, updated_at
FROM drink_old;

DROP TABLE drink_old;

CREATE INDEX drink_household ON drink (household_id);
