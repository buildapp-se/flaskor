import { afterEach, describe, expect, it, vi } from 'vitest'
import { FatalError } from '../shared/errors.ts'
import { findBarcode, looksLikeEan, shrink } from './scan.ts'

const dummyFile = () => new File(['foto'], 'flaska.jpg', { type: 'image/jpeg' })

function setupCanvas(width: number, height: number, hasContext = true) {
  const bitmap = { width, height, close: vi.fn() }
  const createImageBitmap = vi.fn(async (_file: Blob, options?: ImageBitmapOptions) => {
    if (options?.imageOrientation !== 'from-image') throw new Error('missing EXIF orientation')
    return bitmap
  })
  const drawImage = vi.fn()
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn((id: string) => (id === '2d' && hasContext ? { drawImage } : null)),
    toDataURL: vi.fn((type?: string, quality?: number) => (type === 'image/jpeg' && quality === 0.8 ? `data:image/jpeg;base64,${canvas.width}x${canvas.height}` : '')),
  }
  const createElement = vi.fn((tag: string) => (tag === 'canvas' ? canvas : null))
  vi.stubGlobal('createImageBitmap', createImageBitmap)
  vi.stubGlobal('document', { createElement })
  return { bitmap, createImageBitmap, canvas, drawImage }
}

describe('shrink', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('krymper en stor liggande bild så längsta sidan blir 1 280 px, roterar enligt EXIF och stänger bitmapen', async () => {
    const file = dummyFile()
    const { bitmap, createImageBitmap, canvas, drawImage } = setupCanvas(4000, 3000)

    const url = await shrink(file)

    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' })
    expect(canvas.width).toBe(1280)
    expect(canvas.height).toBe(960)
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1280, 960)
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8)
    expect(url).toBe('data:image/jpeg;base64,1280x960')
  })

  it('krymper en stor stående bild efter höjden och avrundar bredden', async () => {
    const { canvas } = setupCanvas(2000, 3000)

    const url = await shrink(dummyFile())

    expect(canvas.width).toBe(853)
    expect(canvas.height).toBe(1280)
    expect(url).toBe('data:image/jpeg;base64,853x1280')
  })

  it('förstorar inte en bild som redan är mindre än 1 280 px', async () => {
    const { bitmap, canvas, drawImage } = setupCanvas(800, 600)

    const url = await shrink(dummyFile())

    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 800, 600)
    expect(url).toBe('data:image/jpeg;base64,800x600')
  })

  it('kastar FatalError när 2d-kontext saknas', async () => {
    setupCanvas(800, 600, false)

    await expect(shrink(dummyFile())).rejects.toThrow(new FatalError('canvas unavailable'))
  })
})

describe('findBarcode', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('läser första streckkoden för EAN-13, EAN-8 och UPC-A och stänger bitmapen', async () => {
    const file = dummyFile()
    const bitmap = { close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
    let formats: string[] = []
    let receivedSource: unknown
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        constructor(options: { formats: string[] }) {
          formats = options.formats
        }
        async detect(source: ImageBitmapSource) {
          receivedSource = source
          if (!['ean_13', 'ean_8', 'upc_a'].every((f) => formats.includes(f))) return []
          return [{ rawValue: '7312040017034' }, { rawValue: '96385074' }]
        }
      },
    )

    expect(await findBarcode(file)).toBe('7312040017034')
    expect(formats).toEqual(['ean_13', 'ean_8', 'upc_a'])
    expect(receivedSource).toBe(bitmap)
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it('ger null och stänger bitmapen när ingen streckkod hittas i fotot', async () => {
    const bitmap = { close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        async detect() {
          return []
        }
      },
    )

    expect(await findBarcode(dummyFile())).toBeNull()
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it('ger null direkt utan att avkoda bilden när BarcodeDetector saknas i webbläsaren', async () => {
    const createImageBitmap = vi.fn()
    vi.stubGlobal('createImageBitmap', createImageBitmap)
    vi.stubGlobal('BarcodeDetector', undefined)

    expect(await findBarcode(dummyFile())).toBeNull()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('ger null i stället för att kasta när läsaren eller bildavkodningen misslyckas', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close: vi.fn() })))
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        async detect(): Promise<{ rawValue: string }[]> {
          throw new Error('BarcodeDetector trasig')
        }
      },
    )

    expect(await findBarcode(dummyFile())).toBeNull()
  })
})

describe('looksLikeEan', () => {
  it('godkänner 8, 12 och 13 siffror, även med mellanslag', () => {
    expect(looksLikeEan('96385074')).toBe(true)
    expect(looksLikeEan('012345678905')).toBe(true)
    expect(looksLikeEan('7312040017034')).toBe(true)
    expect(looksLikeEan(' 7312 0400 17034 \t\n')).toBe(true)
  })

  it('avvisar artikelnummer, andra längder och icke-siffror', () => {
    expect(looksLikeEan('')).toBe(false)
    expect(looksLikeEan('7')).toBe(false)
    expect(looksLikeEan('1101')).toBe(false)
    expect(looksLikeEan('7562401')).toBe(false)
    expect(looksLikeEan('123456789')).toBe(false)
    expect(looksLikeEan('12345678901')).toBe(false)
    expect(looksLikeEan('12345678901234')).toBe(false)
    expect(looksLikeEan('abcdefgh')).toBe(false)
    expect(looksLikeEan('abcdefghijkl')).toBe(false)
    expect(looksLikeEan('abcdefghijklm')).toBe(false)
    expect(looksLikeEan('a96385074')).toBe(false)
    expect(looksLikeEan('96385074a')).toBe(false)
    expect(looksLikeEan('a012345678905')).toBe(false)
    expect(looksLikeEan('7312040017034a')).toBe(false)
  })
})
