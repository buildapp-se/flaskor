-- Migration number: 0008 	 2026-09-15
-- Firebase-inloggning (beslut 2): ett hushåll per konto, fler konton i samma hushåll via inbjudningskod.
-- Bara tillägg: inga tabeller byggs om, inga rader flyttas. Hushåll 1 (Patrik & Julia) behåller allt.

ALTER TABLE household ADD COLUMN invite_code TEXT;
UPDATE household SET invite_code = lower(hex(randomblob(5))) WHERE invite_code IS NULL;
CREATE UNIQUE INDEX household_invite ON household (invite_code);

-- Firebase-uid, inte e-post, är nyckeln: adressen kan bytas, uid:t inte.
CREATE TABLE member (
  uid TEXT PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES household(id),
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX member_household ON member (household_id);
