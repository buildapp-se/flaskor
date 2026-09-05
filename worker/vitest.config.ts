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
        bindings: { TEST_MIGRATIONS: migrations, GATE_CODE: 'test-kod' },
        // Inget test får nå internet. Systembolaget svarar ur fixturerna, allt annat är ett fel.
        async outboundService(request) {
          const url = new URL(request.url)
          if (url.hostname === 'www.systembolaget.se') {
            const number = url.pathname.match(/-(\d+)\/?$/)?.[1]
            try {
              const html = await readFile(`worker/test/fixtures/${number}.html`, 'utf8')
              return new Response(html, { headers: { 'content-type': 'text/html' } })
            } catch {
              return new Response('not found', { status: 404 })
            }
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
