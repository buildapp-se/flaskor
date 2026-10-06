-- Migration number: 0010 	 2026-10-06
-- Valfri koppling till Sipdeck (ADR 0001). Bara tillägg: inga tabeller byggs om, inga rader flyttas.

-- Engångskod som en inloggad medlem skapar under Konto. Bara hashen sparas; koden gäller tio minuter och
-- förbrukas av första inlösen (raden raderas i samma fråga som läser den).
CREATE TABLE sipdeck_code (
  code_hash TEXT PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES household(id),
  uid TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Ett Sipdeck-konto (uid i Firebase-projektet sipdeck) kopplat till ett hushåll. sipdeck_uid är unik: högst ett
-- hushåll per Sipdeck-konto. uid är medlemmen som gav kopplingen; den gäller bara så länge den medlemmen finns
-- kvar i hushållet (kontrolleras vid varje läsning, worker/src/sipdeck.ts).
CREATE TABLE sipdeck_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sipdeck_uid TEXT NOT NULL UNIQUE,
  household_id INTEGER NOT NULL REFERENCES household(id),
  uid TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sipdeck_link_household ON sipdeck_link (household_id);
