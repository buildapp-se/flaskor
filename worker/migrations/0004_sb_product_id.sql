-- Systembolagets interna produkt-id (inte artikelnumret). Lagersaldot per butik slås upp på det:
-- stockbalance/store/{butik}/{productId}. Artikelnumret ger 0 på allt (verifierat 2026-09-09).
-- Nullbart och tomt från start; fylls i vid import och vid första lagerförfrågan på en gammal rad.
ALTER TABLE drink ADD COLUMN sb_product_id TEXT;
