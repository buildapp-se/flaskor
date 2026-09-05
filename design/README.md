# Design

`Flaskor.dc.html` är Claude Designs leverans och facit: tokens, typskala, pillrens fem tillstånd, varje vys layout, ikon och regler. `artboards/Main.dc.html` är en äldre skiss, underordnad leveransen.

Ur leveransen, ordagrant: `src/tokens.css` (alla `--fl-*`), `public/icon.svg` (512, maskable-säker), `public/icon-maskable.svg`, `public/favicon.svg` (16), `public/wordmark.svg`.

## Fem gör inte

1. **Accent i piller, status i knapp.** Vinrött betyder "tryck här". Grönt, gult, rött och grått betyder "så här mår vinet". Blanda aldrig: ingen röd knapp, inget vinrött piller.
2. **Färg utan ord.** Pillret bär alltid prick och ord. Ingen ensam prick, ingen färgad rad, ingen tonad flaskbild som enda signal.
3. **Ruta för "Drack en".** Minus i listan minskar antalet direkt, plus ökar. Ingen bekräftelse, ingen betygsdialog, ingen fråga om vem som drack. Bara "Köpt" från önskelistan får en ruta, för att pris måste in.
4. **Samlarens fält.** Ingen källarplats, ingen värdeutveckling, inga poäng, ingen delning. Tomma sektioner för sådant får inte läggas till "för framtiden".
5. **Serif på fel ställe.** Instrument Serif bara för vinnamn och rubriker. Belopp, antal, etiketter, knappar och piller i Work Sans med tabular-nums, alltid "1 125 kr" och "12,5 %".
