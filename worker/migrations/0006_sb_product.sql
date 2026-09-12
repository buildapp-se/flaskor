-- Migration number: 0006 	 2026-09-12
-- Spegel av Systembolagets sortiment (beslut 23: "vid många användare byts sidläsning mot sortimentsdumpen").
-- Fylls varje natt ur tredjepartsdumpen susbolaget.emrik.org (27 035 rader 2026-09-12). Tjänar tre saker:
-- nattens prisuppdatering utan en produktsida per rad, reserv för söket när frontendnyckeln svarar 401/429,
-- och reserv för produktuppslaget när produktsidan svarar 5xx. Lagersaldo per butik finns inte här.
-- `json` är vår egen Product-form (worker/src/systembolaget.ts), så toPreview kan läsa den rakt av.
-- `search` är namn plus producent i gemener utan diakriter, för LIKE-sök.

CREATE TABLE sb_product (
  number TEXT PRIMARY KEY,
  search TEXT NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sb_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
