// Startdata (beslut 25): seed/vinlista.tsv (Excel-raderna) skrivs till D1 med wrangler.
//   npm run seed            lokal D1 (wrangler dev)
//   npm run seed -- --remote  molnets D1
// Körs om utan dubbletter: alla rader med source_kind = 'caviste' tas bort först och skrivs på nytt.
// Bilden väljs ur Caviste-sidan med pickCavisteImage (flaskan, inte bannern eller gruppbilden).
// OBS: skriptet raderar alla caviste-rader först. Mot molnet krävs --force, se nedan.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { pickCavisteImage } from './caviste.ts'

const remote = process.argv.includes('--remote')
// Seeden är destruktiv: den raderar alla caviste-rader och skriver om dem, så antal, kommentarer och
// rättade betyg på de raderna går förlorade. Mot molnet, där Patriks riktiga källare ligger, krävs --force.
if (remote && !process.argv.includes('--force')) {
  console.error('seed --remote raderar och skriver om alla caviste-rader i molnet. Lägg till --force om det är meningen.')
  process.exit(1)
}
const tsv = readFileSync('seed/vinlista.tsv', 'utf8').trim().split(/\r?\n/)
const header = tsv[0]!.split('\t')
const rows = tsv.slice(1).map((line) => Object.fromEntries(line.split('\t').map((v, i) => [header[i]!, v.trim()])) as Record<string, string>)

const CATEGORY: Record<string, string> = { 'Torrt vitt vin': 'Vitt vin', 'Rött vin': 'Rött vin', 'Vitt vin': 'Vitt vin', 'Mousserande vin': 'Mousserande vin', 'Rosévin': 'Rosévin' }

const htmlCache = new Map<string, string>()
async function cavisteImage(url: string, cavNr: string, name: string): Promise<string | null> {
  try {
    let html = htmlCache.get(url)
    if (html === undefined) {
      html = await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })).text()
      htmlCache.set(url, html)
    }
    return pickCavisteImage(html, cavNr, name)
  } catch (error) {
    console.error(`  bild misslyckades för ${url}: ${String(error)}`)
    return null
  }
}

function sql(value: string | number | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  return `'${value.replace(/'/g, "''")}'`
}

const statements: string[] = ["DELETE FROM drink WHERE source_kind = 'caviste';"]
for (const r of rows) {
  const [from, to] = (r['drickes'] ?? '').split('-').map((y) => (y ? Number(y) : null))
  const image = await cavisteImage(r['lank']!, r['cav_nr']!, r['namn']!)
  const decant = Number(r['karaff_h'])
  const values: Record<string, string | number | null> = {
    household_id: 1,
    kind: 'wine',
    owned: 1,
    name: r['namn']!,
    vintage: r['argang'] ? Number(r['argang']) : null,
    country: r['land'] || null,
    category: CATEGORY[r['typ']!] ?? r['typ']!,
    source_kind: 'caviste',
    source_id: r['cav_nr']!,
    source_url: r['lank'] || null,
    image_url: image,
    price_paid: r['pris'] ? Number(r['pris']) : null,
    count: Number(r['antal_kvar']),
    drink_from: from ?? null,
    drink_to: to ?? null,
    serve_temp: r['temp'] || null,
    decant_hours: decant > 0 ? decant : null,
    food: r['mat'] || null,
  }
  const cols = Object.keys(values)
  statements.push(`INSERT INTO drink (${cols.join(', ')}) VALUES (${cols.map((c) => sql(values[c]!)).join(', ')});`)
  console.log(`${r['namn']} ${r['argang']}: ${values['count']} kvar, bild ${image ? 'ja' : 'nej'}`)
}

writeFileSync('seed/seed.sql', statements.join('\n') + '\n')
console.log(`\n${rows.length} rader i seed/seed.sql, kör mot ${remote ? 'molnet' : 'lokal D1'} ...`)
execSync(`npx wrangler d1 execute flaskor ${remote ? '--remote' : '--local'} --file seed/seed.sql`, { stdio: 'inherit' })
