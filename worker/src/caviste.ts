// Caviste-import via produktlänk (beslut 6, backlog P2). En CAV-låda innehåller flera viner, och sidan bär
// hela raden för vart och ett i en tabell längst ner: bild, antal, årgång, namn, pris, typ, ursprung, druvor,
// alkohol, drickfönster, serveringstemperatur, karaffering och smaknot. Alltså samma fält som Excel-raderna
// hade, utan att någon skriver av dem.
//
// Sidan är WordPress utan API, så den läses som HTML. Formatet har sett likadant ut sedan 2013 enligt sidfoten,
// men det är ingen garanti: parsern kastar hellre än gissar när tabellen inte finns.
import { FatalError, NotFoundError, TransientError } from '../../shared/errors.ts'
import type { Preview } from '../../shared/types.ts'

const USER_AGENT = 'Mozilla/5.0 (compatible; flaskor/1.0; +https://buildapp.se/flaskor)'

/** CAV-numret ur en Caviste-länk, utan inledande nollor. Kastar på allt som inte är en caviste.se-produktlänk. */
export function parseCavisteUrl(input: string): { number: string; url: string } {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new FatalError('not a caviste link')
  }
  if (!/(^|\.)caviste\.se$/i.test(url.hostname)) throw new FatalError('not a caviste link')
  const nr = url.pathname.match(/\/cav0*(\d+)/i)?.[1]
  if (!nr) throw new FatalError('no cav number in caviste link')
  return { number: nr, url: url.toString() }
}

/** HTML-entiteter och taggar bort, blanktecken normaliserade. Cavistes text är full av &#8211; och &nbsp;. */
export function text(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "3 flaskor 2020 Colombera & Garella Coste della Sesia – 155 kr/st [.pdf]" */
export function parseHeading(heading: string): { count: number; vintage: number | null; name: string; price: number | null } {
  const s = text(heading).replace(/\[\.pdf\]\s*$/i, '').trim()
  const m = s.match(/^(\d+)\s*(?:flaskor|flaska|fl)\b\.?\s+(?:(\d{4})\s+)?(.+?)\s*[–—-]\s*([\d\s]+)\s*kr/i)
  if (!m) throw new FatalError(`caviste heading not understood: ${s.slice(0, 120)}`)
  return {
    count: Number(m[1]),
    vintage: m[2] ? Number(m[2]) : null,
    name: m[3]!.trim(),
    price: Number(m[4]!.replace(/\s/g, '')) || null,
  }
}

/**
 * Druvorna ur "70% nebbiolo, 15% vespolina & 15% croatina." Andelarna kastas, namnen behålls i ordning.
 * Samma text bär "12,5% alkohol" längre ner, så orden som aldrig är druvor räknas bort.
 */
const NOT_GRAPES = new Set(['alkohol', 'alcohol', 'volym', 'nya', 'ny', 'ek'])

export function parseGrapes(s: string): string | null {
  const found = [...s.matchAll(/\d+(?:[,.]\d+)?\s*%\s*([a-zåäöéèü][a-zåäöéèü\s-]*?)(?=[,.&]|\s+och\s|\s+från\s|$)/gi)]
    .map((m) => m[1]!.trim().toLowerCase())
    .filter((g) => g !== '' && !NOT_GRAPES.has(g.split(/\s+/)[0]!))
  const unique = found.filter((g, i) => found.indexOf(g) === i)
  return unique.length > 0 ? unique.join(', ') : null
}

/** "Karafferas: 1 tim." blir 1, "Karafferas: Nej." blir null. */
export function parseDecant(s: string): number | null {
  const m = s.match(/Karafferas:\s*([^.]*)/i)
  if (!m?.[1] || /nej/i.test(m[1])) return null
  const hours = m[1].match(/(\d+(?:[,.]\d+)?)/)
  return hours?.[1] ? Number(hours[1].replace(',', '.')) : null
}

/**
 * Vinerna i en CAV-låda, i sidans ordning. Kastar NotFoundError när innehållstabellen inte finns:
 * sidan kan vara en artikel eller ett annat sidformat, och en tom lista hade sett ut som "lådan är tom".
 */
export function parseCavistePage(html: string, cavNr: string, url: string, now = new Date()): Preview[] {
  const at = html.search(new RegExp(`CAV0*${cavNr}\\s+inneh[åa]ller\\s+\\d+\\s+flaskor`, 'i'))
  if (at === -1) throw new NotFoundError(`no bottle table for CAV${cavNr}`)
  const table = html.slice(html.indexOf('<table', at), html.indexOf('</table>', at))
  const rows = [...table.matchAll(/<tr>(.*?)<\/tr>/gis)].map((m) => m[1]!)
  if (rows.length === 0) throw new NotFoundError(`empty bottle table for CAV${cavNr}`)

  return rows.map((row) => {
    const { count, vintage, name, price } = parseHeading(row.match(/<h4[^>]*>(.*?)<\/h4>/is)?.[1] ?? '')
    // Cellen ser ut så här: <h4>rubrik</h4><p><em>typ, ursprung, druvor, lagring, alkohol, drickfönster,
    // temperatur, karaffering</em><br />smaknot</p>. Vissa sidor har en extra <em> runt de tre första
    // meningarna (CAV0143 har det, CAV0179 inte), så allt fram till den sista </em> läses som en spec och
    // fälten plockas ur den texten. Det som står efter är smaknoten.
    const lastEm = row.lastIndexOf('</em>')
    const body = row.replace(/<h4[^>]*>.*?<\/h4>/is, '')
    const spec = lastEm === -1 ? text(body) : text(row.slice(row.indexOf('</h4>') + 5, lastEm))
    const taste = (lastEm === -1 ? null : text(row.slice(lastEm + 5))) || null
    // Radens egen flaskbild: en länk när sidan har en, annars första bildadressen i cellen (WordPress srcset).
    // Storlekssuffixet tas bort så originalet sparas.
    const image = (row.match(/href="(https?:[^"]*wp-content\/uploads\/[^"]*\.jpe?g)"/i)?.[1] ?? row.match(/(https?:[^"'\s]*wp-content\/uploads\/[^"'\s]*\.jpe?g)/i)?.[1] ?? null)?.replace(/-\d+x\d+(\.jpe?g)$/i, '$1') ?? null

    // "Rött vin. DOC Coste della Sesia. 70% nebbiolo, ..." Första meningen är typen, andra ursprunget.
    const [category, region] = spec.split('.').map((p) => p.trim())
    const window = spec.match(/Drick:\s*(\d{4})\s*[-–]\s*(\d{4})/i)
    const alcohol = spec.match(/(\d+(?:[,.]\d+)?)\s*%\s*alkohol/i)?.[1]
    const temp = spec.match(/Serveringstemp:\s*([\d\s-]+)\s*°?\s*C/i)?.[1]

    return {
      kind: 'wine',
      owned: false,
      name,
      producer: null,
      vintage,
      country: null,
      region: region && /^(DOC|DOCG|AOC|AOP|IGT|IGP|VDP|DO)\b/i.test(region) ? region : null,
      category: category && /vin$/i.test(category) ? category : null,
      style: null,
      grapes: parseGrapes(spec),
      volume_ml: null,
      alcohol: alcohol ? Number(alcohol.replace(',', '.')) : null,
      source_kind: 'caviste',
      source_id: cavNr,
      source_url: url,
      image_url: image,
      sb_product_id: null,
      price_paid: null,
      price_current: price,
      price_checked_at: now.toISOString(),
      availability: 'unknown',
      count,
      open_level: null,
      drink_from: window?.[1] ? Number(window[1]) : null,
      drink_to: window?.[2] ? Number(window[2]) : null,
      serve_temp: temp ? temp.replace(/\s/g, '') : null,
      decant_hours: parseDecant(spec),
      // Cavistes smaknot slutar med ett matförslag: "Servera ... till färsk Tagliatelle med salvia och smör."
      food: taste?.match(/\btill\s+([^.]+)\.?\s*$/i)?.[1]?.trim() ?? null,
      note: null,
      taste,
      vivino_rating: null,
      vivino_count: null,
      vivino_url: null,
      vivino_checked_at: null,
      rating: null,
      rating_url: null,
    }
  })
}

export async function fetchCaviste(url: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html' } })
  } catch (error) {
    throw new TransientError(`caviste unreachable: ${String(error)}`)
  }
  if (response.status === 404) throw new NotFoundError(`caviste page ${url} not found`)
  if (!response.ok) throw new TransientError(`caviste answered ${response.status}`)
  return response.text()
}
