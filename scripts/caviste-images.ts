// Rättar flaskbilden på de caviste-rader som redan finns (BACKLOG P2). Seeden 2026-09-05 tog sidans första
// CAV-bild, vilket ofta blev den liggande bannern eller gruppbilden på hela paketet.
//   npm run fix:caviste                          torrkörning mot molnet: visar vad som skulle ändras
//   npm run fix:caviste -- --write               skriver ändringarna
//   npm run fix:caviste -- --write http://localhost:8787   mot wrangler dev
// Går via API:t med grindkoden ur .dev.vars och rör bara image_url. Ingen rad raderas, till skillnad från seeden.
import { readFileSync } from 'node:fs'
import { pickCavisteImage } from './caviste.ts'

const write = process.argv.includes('--write')
const api = process.argv.find((a) => a.startsWith('http')) ?? 'https://flaskor-api.buildapp.se'
const code = readFileSync('.dev.vars', 'utf8').match(/^GATE_CODE\s*=\s*"?([^"\r\n]+)"?/m)?.[1]
if (!code) throw new Error('GATE_CODE saknas i .dev.vars')
const headers = { authorization: `Bearer ${code}`, 'content-type': 'application/json' }

type Row = { id: number; name: string; source_kind: string; source_id: string | null; source_url: string | null; image_url: string | null }
const { drinks } = (await (await fetch(`${api}/api/drinks`, { headers })).json()) as { drinks: Row[] }
const rows = drinks.filter((d) => d.source_kind === 'caviste' && d.source_url && d.source_id)

let changed = 0
for (const d of rows) {
  const html = await (await fetch(d.source_url!, { headers: { 'user-agent': 'Mozilla/5.0' } })).text()
  const image = pickCavisteImage(html, d.source_id!, d.name)
  if (image === d.image_url) {
    console.log(`oförändrad: ${d.name}`)
    continue
  }
  changed++
  console.log(`${write ? 'skriver' : 'skulle ändra'}: ${d.name}\n  från ${d.image_url ?? 'ingen bild'}\n  till ${image ?? 'ingen bild'}`)
  if (!write) continue
  const res = await fetch(`${api}/api/drinks/${d.id}`, { method: 'PATCH', headers, body: JSON.stringify({ image_url: image }) })
  if (!res.ok) throw new Error(`${d.name}: ${res.status} ${await res.text()}`)
}
console.log(`\n${changed} av ${rows.length} caviste-rader ${write ? 'ändrade' : 'skulle ändras'}, mot ${api}`)
if (!write && changed > 0) console.log('Kör om med --write för att spara.')
