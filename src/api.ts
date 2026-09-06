import { FatalError, NotFoundError, TransientError, UnauthorizedError } from '../shared/errors.ts'
import type { Drink, DrinkInput, DrinkPatch, Preview } from '../shared/types.ts'

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
const GATE_KEY = 'flaskor.gate'

// Grindkoden (beslut 2) skrivs in en gång och sparas i localStorage. Servern avgör om den är rätt.
export function findGate(): string | null {
  return localStorage.getItem(GATE_KEY)
}
export function setGate(code: string): void {
  localStorage.setItem(GATE_KEY, code)
}
export function clearGate(): void {
  localStorage.removeItem(GATE_KEY)
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(API_URL + path, {
      method,
      headers: { authorization: `Bearer ${findGate() ?? ''}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw new TransientError(`network: ${String(error)}`)
  }
  if (response.status === 204) return undefined as T
  if (response.ok) return response.json() as Promise<T>
  const message = await response.text().then((t) => t.slice(0, 200)).catch(() => '')
  if (response.status === 401) throw new UnauthorizedError()
  if (response.status === 404) throw new NotFoundError(message)
  if (response.status >= 500) throw new TransientError(message)
  throw new FatalError(message, response.status)
}

export const api = {
  ping: () => call<void>('GET', '/api/ping'),
  listDrinks: () => call<{ drinks: Drink[] }>('GET', '/api/drinks').then((r) => r.drinks),
  createDrink: (input: DrinkInput) => call<Drink>('POST', '/api/drinks', input),
  patchDrink: (id: number, patch: DrinkPatch) => call<Drink>('PATCH', `/api/drinks/${id}`, patch),
  refreshDrink: (id: number) => call<Drink>('POST', `/api/drinks/${id}/refresh`),
  deleteDrink: (id: number) => call<void>('DELETE', `/api/drinks/${id}`),
  preview: (q: string) => call<Preview>('GET', `/api/systembolaget?q=${encodeURIComponent(q)}`),
  previewVivino: (url: string) => call<Preview>('GET', `/api/vivino?q=${encodeURIComponent(url)}`),
}
