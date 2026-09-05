// Startdata (beslut 25): seed/vinlista.tsv (Excel-raderna) skrivs till D1 med wrangler.
//   npm run seed            lokal D1 (wrangler dev)
//   npm run seed -- --remote  molnets D1
// Körs om utan dubbletter: alla rader med source_kind = 'caviste' tas bort först och skrivs på nytt.
// Bilden hämtas från Caviste-sidans första wp-content/uploads/...CAV<nr>...jpg om den finns.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const remote = process.argv.includes('--remote')
const tsv = readFileSync('seed/vinlista.tsv', 'utf8').trim().split(/\r?\n/)
const header = tsv[0]!.split('\t')
const rows = tsv.slice(1).map((line) => Object.fromEntries(line.split('\t').map((v, i) => [header[i]!, v.trim()])) as Record<string, string>)

const CATEGORY: Record<string, string> = { 'Torrt vitt vin': 'Vitt vin', 'Rött vin': 'Rött vin', 'Vitt vin': 'Vitt vin', 'Mousserande vin': 'Mousserande vin', 'Rosévin': 'Rosévin' }

const imageCache = new Map<string, string | null>()
async function cavisteImage(url: string, cavNr: string): Promise<string | null> {
  if (imageCache.has(url)) return imageCache.get(url)!
  let image: string | null = null
  try {
    const html = await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })).text()
    const re = new RegExp(`https?://[^"'\\s]*wp-content/uploads/[^"'\\s]*CAV0*${cavNr}[^"'\\s]*\\.jpe?g`, 'i')
    // WordPress länkar tumnageln (-100x100.jpg); utan suffixet fås originalet.
    image = html.match(re)?.[0]?.replace(/-\d+x\d+(\.jpe?g)$/i, '$1') ?? null
  } catch (error) {
    console.error(`  bild misslyckades för ${url}: ${String(error)}`)
  }
  imageCache.set(url, image)
  return image
}

function sql(value: string | number | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  return `'${value.replace(/'/g, "''")}'`
}

const statements: string[] = ["DELETE FROM drink WHERE source_kind = 'caviste';"]
for (const r of rows) {
  const [from, to] = (r['drickes'] ?? '').split('-').map((y) => (y ? Number(y) : null))
  const image = await cavisteImage(r['lank']!, r['cav_nr']!)
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
