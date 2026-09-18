import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicApiFetch } from './api'

describe('publicApiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('faz uma requisicao publica sem enviar token e le o JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'service-1' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(publicApiFetch<Array<{ id: string }>>('/public/services')).resolves.toEqual([
      { id: 'service-1' },
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/public/services',
      { headers: {} },
    )
  })
})
