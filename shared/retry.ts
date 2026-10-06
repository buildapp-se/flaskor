import { FatalError } from './errors.ts'

/**
 * Kör `fn` och försöker igen när den kastar något annat än FatalError (nätavbrott, TransientError), med längre
 * paus för varje försök. Sista felet kastas vidare. Bara för anrop som tål att göras om.
 * ponytail: fast antal och linjär paus, inget jitter; ett nattskript mot en egen Worker behöver inte mer.
 */
export async function retry<T>(fn: () => Promise<T>, attempts = 3, pauseMs = 3000): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof FatalError || attempt >= attempts) throw error
      console.warn(`försök ${attempt} av ${attempts} föll: ${error instanceof Error ? error.message : String(error)}`)
      await new Promise((resolve) => setTimeout(resolve, pauseMs * attempt))
    }
  }
}
