-- Migration number: 0002 	 2026-09-06
-- Vivinos betyg per vin: snitt, antal röster, länk till vinets sida, när det hämtades.

ALTER TABLE drink ADD COLUMN vivino_rating REAL;
ALTER TABLE drink ADD COLUMN vivino_count INTEGER;
ALTER TABLE drink ADD COLUMN vivino_url TEXT;
ALTER TABLE drink ADD COLUMN vivino_checked_at TEXT;
