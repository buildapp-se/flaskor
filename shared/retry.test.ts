import { describe, expect, it, vi } from 'vitest'
import { FatalError, TransientError } from './errors.ts'
import { retry } from './retry.ts'

vi.spyOn(console, 'warn').mockImplementation(() => {})

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
})
