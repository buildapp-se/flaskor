// Barskåpet från Sipdecks skafferi (GRILL-STATUS 36): seed/barskap.tsv är Patriks skafferi 2026-09-06
// (spirits, liqueurs och bitters ur Sipdecks users.state.pantry), en rad per sort, antal 1 oöppnad, utan pris och bild.
//   npm run seed:bar                     mot molnet (flaskor-api.buildapp.se)
//   npm run seed:bar -- http://localhost:8787   mot wrangler dev
// Går via API:t med grindkoden ur .dev.vars, inte via wrangler. Körs om utan dubbletter: en sprit som redan finns
// med samma namn hoppas över.
import { readFileSync } from 'node:fs'

const api = process.argv[2] ?? 'https://flaskor-api.buildapp.se'
const code = readFileSync('.dev.vars', 'utf8').match(/^GATE_CODE\s*=\s*"?([^"\r\n]+)"?/m)?.[1]
if (!code) throw new Error('GATE_CODE saknas i .dev.vars')
const headers = { authorization: `Bearer ${code}`, 'content-type': 'application/json' }

const [header, ...lines] = readFileSync('seed/barskap.tsv', 'utf8').trim().split(/\r?\n/)
const cols = header!.split('\t')
const rows = lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i]!, v.trim()])) as Record<string, string>)

const existing = (await (await fetch(`${api}/api/drinks`, { headers })).json()) as { drinks: Array<{ kind: string; name: string }> }
const have = new Set(existing.drinks.filter((d) => d.kind === 'spirit').map((d) => d.name.toLowerCase()))

let added = 0
for (const r of rows) {
  if (have.has(r['namn']!.toLowerCase())) {
    console.log(`finns redan: ${r['namn']}`)
    continue
  }
  const res = await fetch(`${api}/api/drinks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind: 'spirit', owned: true, count: 1, name: r['namn'], category: r['kategori'], source_kind: 'manual', note: `Från Sipdecks skafferi (${r['sipdeck_id']})` }),
  })
  if (!res.ok) throw new Error(`${r['namn']}: ${res.status} ${await res.text()}`)
  added++
  console.log(`lagd: ${r['namn']}`)
}
console.log(`\n${added} nya, ${rows.length - added} fanns redan, mot ${api}`)
