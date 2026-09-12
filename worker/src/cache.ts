// Cache API för svar från Systembolaget (2026-09-12). Alla användare delar en frontendnyckel, så tio som söker
// "rioja" samma halvtimme ska kosta ett anrop, inte tio. Cachen är per datacenter och bäst-ansträngning:
// en miss kostar bara ett anrop till, aldrig ett fel svar.

const PREFIX = 'https://flaskor-api.buildapp.se/_cache/'

/** Hämtar `key` ur cachen eller kör `load` och lägger svaret där i `ttlSeconds`. Kastar det `load` kastar. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const request = new Request(PREFIX + encodeURIComponent(key))
  const hit = await caches.default.match(request)
  if (hit) return hit.json<T>()
  const value = await load()
  await caches.default.put(request, Response.json(value, { headers: { 'cache-control': `public, max-age=${ttlSeconds}` } }))
  return value
}
