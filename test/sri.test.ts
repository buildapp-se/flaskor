import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// SRI på Firebase-SDK:n (OWASP 2026-10-16): import-mappen i index.html måste ha en hash för varje modul src/auth.ts laddar.
// Byts versionen bara i auth.ts finns ingen hash för de nya adresserna, och skyddet är tyst borta.
describe('SRI för Firebase-SDK:n', () => {
  it('index.html har en sha384 för varje SDK-modul i src/auth.ts', () => {
    const sdk = readFileSync('src/auth.ts', 'utf8').match(/const SDK = '([^']+)'/)?.[1]
    const modules = [...readFileSync('src/auth.ts', 'utf8').matchAll(/\$\{SDK\}\/([\w-]+\.js)/g)].map((m) => `${sdk}/${m[1]}`)
    const map = readFileSync('index.html', 'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1]
    const integrity = (JSON.parse(map ?? '{}') as { integrity?: Record<string, string> }).integrity ?? {}
    expect(modules).toHaveLength(2)
    for (const url of modules) expect(integrity[url], url).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/)
  })
})
