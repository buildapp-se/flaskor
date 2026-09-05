// Migreringarna och grindkoden skickas in som bindningar i testet, så env bär två fält mer än den deployade Env.
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
    GATE_CODE: string
  }
}
