-- Migration number: 0001 	 2026-09-05
-- Modellen enligt CONTEXT.md (beslut 3, 22): ett hushåll, en tabell drink för vin och sprit.

CREATE TABLE household (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ett hushåll i dag, id från dag ett (beslut 22).
INSERT INTO household (id, name) VALUES (1, 'Patrik & Julia');

CREATE TABLE drink (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES household(id),
  kind TEXT NOT NULL CHECK (kind IN ('wine', 'spirit')),
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX drink_household ON drink (household_id);
