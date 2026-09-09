-- Migration number: 0005 	 2026-09-09
-- Drucken-logg per rad (beslut 16, backlog P3): datum, betyg 1 till 5, kommentar. En rad kan drickas många
-- gånger, så det är en egen tabell och inte fler kolumner på drink. "Drack en" rör den inte: beslut 16 säger
-- uttryckligen ingen ruta och inget betyg vid nedräkningen, loggen skrivs för hand i detaljvyn.

CREATE TABLE tasting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drink_id INTEGER NOT NULL REFERENCES drink(id) ON DELETE CASCADE,
  drunk_on TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX tasting_drink ON tasting (drink_id, drunk_on DESC);
