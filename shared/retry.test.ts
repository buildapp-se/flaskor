import { describe, expect, it, vi } from 'vitest'
import { FatalError, TransientError } from './errors.ts'
import { retry } from './retry.ts'

const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('retry', () => {
  it('försöker igen efter ett nätavbrott och ger svaret', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValue('ok')
    expect(await retry(fn, 3, 0)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('ger upp efter sista försöket och kastar felet', async () => {
    const fn = vi.fn().mockRejectedValue(new TransientError('503'))
    await expect(retry(fn, 3, 0)).rejects.toThrow('503')
    expect(fn).toHaveBeenCalledTimes(3)
  })
  it('försöker inte om ett FatalError', async () => {
    const fn = vi.fn().mockRejectedValue(new FatalError('401', 401))
    await expect(retry(fn, 3, 0)).rejects.toThrow('401')
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('pausen växer linjärt med försöket och varje fall loggas', async () => {
    vi.useFakeTimers()
    try {
      warn.mockClear()
      const fn = vi.fn().mockRejectedValueOnce(new TransientError('503')).mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValue('ok')
      const result = retry(fn, 3, 1000)
      await vi.advanceTimersByTimeAsync(999)
      expect(fn).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fn).toHaveBeenCalledTimes(2)
      // Andra pausen är dubbelt så lång: 2 000 ms.
      await vi.advanceTimersByTimeAsync(1999)
      expect(fn).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(await result).toBe('ok')
      expect(warn.mock.calls.map((c) => c[0])).toEqual(['försök 1 av 3 föll: 503', 'försök 2 av 3 föll: fetch failed'])
    } finally {
      vi.useRealTimers()
    }
  })
})
