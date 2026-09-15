-- Migration number: 0009 	 2026-09-15
-- FTS5-index över spegelns söktext (BACKLOG §Spegeln P2). LIKE läste alla 27 035 rader per fråga, så 185 reservsökningar
-- tömde kontots läskvot på 5 miljoner rader per dygn. Indexet läser bara träffarna.
--
-- Så litet som möjligt, eftersom D1 räknar skrivna rader: contentless (content=''), inga längder per rad (columnsize=0)
-- och inga positioner (detail=none). Mätt lokalt mot 27 035 rader: cirka 220 rader i skuggtabellerna, mot 27 000 med
-- standardinställningarna. Kostnaden: inga frasfrågor och ingen bm25-rankning, vilket söket inte använder.
-- **Fyllningen nedan kostar en skriven rad per produkt i D1:s kvot, cirka 27 000 en gång** (mätt 2026-09-15 med
-- meta.rows_written: 1 000 dokument gav 1 000). Kör den inte samma dygn som en full spegelkörning. Efteråt kostar
-- indexet bara ändrade namn, nya och utgångna produkter.
--
-- rowid är artikelnumret som heltal, inte sb_product:s dolda rowid (som en VACUUM får numrera om). Alla nummer är
-- rena siffror utan inledande nolla (kollat 2026-09-15), så omvandlingen tappar inget.
--
-- OBS: `wrangler d1 export` vägrar databaser med virtuella tabeller. Säkerhetskopia före en senare migrering tas med
-- Time Travel (`wrangler d1 time-travel info flaskor`, bokmärket återställs med `time-travel restore`). Släpp inte
-- indexet för att exportera: triggerna nedan pekar på det, och varje skrivning till sb_product skulle ge fel.

CREATE VIRTUAL TABLE sb_product_fts USING fts5(search, content='', columnsize=0, detail=none);

INSERT INTO sb_product_fts (rowid, search) SELECT CAST(number AS INTEGER), search FROM sb_product;

-- Ett contentless-index tar bort en rad med kommandot 'delete' och radens gamla text.
CREATE TRIGGER sb_product_fts_insert AFTER INSERT ON sb_product BEGIN
  INSERT INTO sb_product_fts (rowid, search) VALUES (CAST(new.number AS INTEGER), new.search);
END;
CREATE TRIGGER sb_product_fts_delete AFTER DELETE ON sb_product BEGIN
  INSERT INTO sb_product_fts (sb_product_fts, rowid, search) VALUES ('delete', CAST(old.number AS INTEGER), old.search);
END;
-- Spegelns upsert skriver search varje gång json ändrats (oftast priset); indexet rörs bara när texten faktiskt ändrats.
CREATE TRIGGER sb_product_fts_update AFTER UPDATE OF search ON sb_product WHEN old.search <> new.search BEGIN
  INSERT INTO sb_product_fts (sb_product_fts, rowid, search) VALUES ('delete', CAST(old.number AS INTEGER), old.search);
  INSERT INTO sb_product_fts (rowid, search) VALUES (CAST(new.number AS INTEGER), new.search);
END;
