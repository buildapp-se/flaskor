// Migreringarna och nycklarna skickas in som bindningar i testet, så env bär fyra fält mer än den deployade Env.
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
    SERVICE_TOKEN: string
    GEMINI_API_KEY: string
    SB_API_KEY: string
    FIREBASE_TEST_KEY: JsonWebKey
  }
}
