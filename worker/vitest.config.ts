import { readFile } from 'node:fs/promises'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// Testerna kör i riktig workerd mot en lokal D1 med samma migreringar som i molnet.
const migrations = await readD1Migrations('./worker/migrations')

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        d1Databases: ['DB'],
        bindings: { TEST_MIGRATIONS: migrations, GATE_CODE: 'test-kod', GEMINI_API_KEY: 'test-gemini', SB_API_KEY: 'test-sb' },
        // Inget test får nå internet. Systembolaget svarar ur fixturerna, allt annat är ett fel.
        async outboundService(request) {
          const url = new URL(request.url)
          if (url.hostname === 'www.systembolaget.se') {
            const number = url.pathname.match(/-(\d+)\/?$/)?.[1]
            // 141201 (Norrlands Guld) finns bara i dumpfixturen: produktsidan "ligger nere", så spegeln får svara.
            if (number === '141201') return new Response('bad gateway', { status: 503 })
            try {
              const html = await readFile(`worker/test/fixtures/${number}.html`, 'utf8')
              return new Response(html, { headers: { 'content-type': 'text/html' } })
            } catch {
              return new Response('not found', { status: 404 })
            }
          }
          // Caviste (beslut 6): produktsidan för CAV0143 ur fixtur, andra CAV-nummer finns inte.
          if (url.hostname === 'www.caviste.se' || url.hostname === 'caviste.se') {
            const nr = url.pathname.match(/\/cav0*(\d+)/i)?.[1]
            try {
              return new Response(await readFile(`worker/test/fixtures/caviste-cav0${nr}.html`, 'utf8'), { headers: { 'content-type': 'text/html' } })
            } catch {
              return new Response('not found', { status: 404 })
            }
          }
          // Vivino svarar alltid med Le Grappin-fixturen; rimlighetskontrollen avgör om betyget tas.
          if (url.hostname === 'www.vivino.com') {
            // Vinsidor: bara 2379181 finns som fixtur, andra id:n ger 404. Söksidan svarar alltid Le Grappin.
            const wine = url.pathname.match(/\/w\/(\d+)/)?.[1]
            if (wine) {
              try {
                return new Response(await readFile(`worker/test/fixtures/vivino-w-${wine}.html`, 'utf8'), { headers: { 'content-type': 'text/html' } })
              } catch {
                return new Response('not found', { status: 404 })
              }
            }
            return new Response(await readFile('worker/test/fixtures/vivino-le-grappin.html', 'utf8'), { headers: { 'content-type': 'text/html' } })
          }
          // Skanningen (BACKLOG 37): Open Food Facts ur fixtur per streckkod, Systembolagets sök svarar alltid Absolut,
          // Gemini läser alltid "Absolut Vodka". Båda API:erna kräver att testnyckeln följer med.
          if (url.hostname === 'world.openfoodfacts.org') {
            const ean = url.pathname.match(/\/product\/(\d+)\.json$/)?.[1]
            try {
              return new Response(await readFile(`worker/test/fixtures/off-${ean}.json`, 'utf8'), { headers: { 'content-type': 'application/json' } })
            } catch {
              return Response.json({ status: 0, status_verbose: 'product not found' }, { status: 404 })
            }
          }
          if (url.hostname === 'api-extern.systembolaget.se') {
            if (request.headers.get('ocp-apim-subscription-key') !== 'test-sb') return new Response('no key', { status: 401 })
            // Två ord i frågan tvingar fram felen spegeln ska täcka: "ratelimit" ger 429, "nyckelfel" ger 401.
            const q = url.searchParams.get('textQuery') ?? ''
            if (q.includes('ratelimit')) return new Response('too many', { status: 429 })
            if (q.includes('nyckelfel')) return new Response('key revoked', { status: 401 })
            // Lagersaldo (BACKLOG P3): produkt-id 21955733 är fixturens Vanliga Vodka och finns i butik 2401,
            // allt annat är slut. Butik 9999 för inte varan alls och svarar 404 som Systembolaget gör.
            const stock = url.pathname.match(/\/stockbalance\/store\/(\d+)\/(\d+)/)
            if (stock) {
              const [, store, product] = stock
              if (store === '9999') return new Response('not found', { status: 404 })
              const carried = product === '21955733' && store === '2401'
              return Response.json({ productId: product, storeId: store, shelf: carried ? '14-04-03' : null, stock: carried ? 48 : 0, isInStoreAssortment: carried })
            }
            return new Response(await readFile('worker/test/fixtures/sb-search-absolut.json', 'utf8'), { headers: { 'content-type': 'application/json' } })
          }
          if (url.hostname === 'generativelanguage.googleapis.com') {
            if (request.headers.get('x-goog-api-key') !== 'test-gemini') return new Response('no key', { status: 403 })
            const text = JSON.stringify({ kind: 'spirit', producer: 'Absolut', name: 'Absolut Vodka', category: 'Vodka', vintage: null, volume_ml: 700, alcohol: 40, ean: null })
            return Response.json({ candidates: [{ content: { parts: [{ text }] } }] })
          }
          return new Response(`Unexpected outbound request in tests: ${request.url}`, { status: 503 })
        },
      },
    }),
  ],
  test: {
    include: ['worker/test/**/*.test.ts'],
    setupFiles: ['./worker/test/apply-migrations.ts'],
  },
})
