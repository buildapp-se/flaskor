// Butikslistan (BACKLOG P3, lager i vald butik). Systembolagets sök-API har ingen butiksslutpunkt som vår
// frontendnyckel kommer åt (alla /site-vägar svarar 401 eller 404, verifierat 2026-09-09), men deras sitemap
// listar varje butik med id i sökvägen:
//   /butiker-ombud/butik/vasterbottens-lan/umea/radhusesplanaden-6-e-2401/
// Sista fyrsiffriga gruppen är butiksnumret. Slugen har tappat å, ä och ö ("umea"), så namnen hämtas ur varje
// butikssidas seo.title ("Rådhusesplanaden 6 E,  Umeå | Systembolaget") i stället.
//   npm run stores    skriver src/stores.json
// 455 sidhämtningar, åtta i taget, ett par minuter. Listan ändras några gånger om året, så den ligger i bundeln
// i stället för att hämtas vid körning: appen är en PWA och ska fungera utan nät.
import { writeFileSync } from 'node:fs'

const SITEMAP = 'https://www.systembolaget.se/sitemap-butiker.xml'
const PARALLEL = 8

export interface Store {
  id: string
  city: string
  address: string
}

/** Butiksnumret ur en sitemap-URL: sista fyrsiffriga gruppen i sista sökvägsdelen. Null när det inte finns. */
export function storeId(loc: string): string | null {
  return loc.replace(/\/$/, '').split('/').pop()?.match(/-(\d{4})$/)?.[1] ?? null
}

/** Ort och adress ur butikssidans titel, "Rådhusesplanaden 6 E,  Umeå | Systembolaget". Kastar när den inte går att läsa. */
export function parseTitle(title: string): { city: string; address: string } {
  const [address, city] = title.replace(/\s*\|.*$/, '').split(',')
  if (!address?.trim() || !city?.trim()) throw new Error(`oläsbar butikstitel: ${title}`)
  return { city: city.trim(), address: address.trim() }
}

async function fetchStore(loc: string, id: string): Promise<Store> {
  const html = await (await fetch(loc, { headers: { 'user-agent': 'Mozilla/5.0' } })).text()
  const json = html.match(/__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)?.[1]
  if (!json) throw new Error(`ingen __NEXT_DATA__ på ${loc}`)
  const title = (JSON.parse(json) as { props?: { pageProps?: { seo?: { title?: string } } } }).props?.pageProps?.seo?.title
  if (!title) throw new Error(`ingen titel på ${loc}`)
  return { id, ...parseTitle(title) }
}

if (process.argv[1]?.endsWith('stores.ts')) {
  const xml = await (await fetch(SITEMAP, { headers: { 'user-agent': 'Mozilla/5.0' } })).text()
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]!)
  const wanted = locs.map((loc) => ({ loc, id: storeId(loc) })).filter((x): x is { loc: string; id: string } => x.id !== null)
  if (wanted.length < 300) throw new Error(`bara ${wanted.length} butiker i sitemapen, den ser fel ut`)

  const stores: Store[] = []
  const failed: string[] = []
  for (let i = 0; i < wanted.length; i += PARALLEL) {
    const batch = await Promise.allSettled(wanted.slice(i, i + PARALLEL).map((w) => fetchStore(w.loc, w.id)))
    for (const r of batch) r.status === 'fulfilled' ? stores.push(r.value) : failed.push(String(r.reason))
    process.stdout.write(`\r${stores.length} av ${wanted.length} hämtade`)
  }
  console.log()
  for (const f of failed.slice(0, 10)) console.error(f)
  if (failed.length > 0) throw new Error(`${failed.length} butiker gick inte att läsa, listan skrivs inte halv`)

  stores.sort((a, b) => a.city.localeCompare(b.city, 'sv') || a.address.localeCompare(b.address, 'sv'))
  writeFileSync('src/stores.json', JSON.stringify(stores) + '\n')
  console.log(`${stores.length} butiker i src/stores.json`)
}
