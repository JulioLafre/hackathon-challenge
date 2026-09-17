import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../../lib/api'
import { SchedulingPage } from './scheduling'

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}))

const apiFetchMock = vi.mocked(apiFetch)
const token = 'supervisor-token'
const sessionId = '00000000-0000-0000-0000-000000000006'

const capacity = {
  effective: 2,
  constraints: {
    eligible_students: 3,
    supervision: 4,
    rooms: 2,
    equipment: 3,
    clinic_appointments: 4,
  },
  limiting_factors: ['rooms'],
}

const session = {
  id: sessionId,
  term_id: '00000000-0000-0000-0000-000000000001',
  service_id: '00000000-0000-0000-0000-000000000002',
  clinic_id: '00000000-0000-0000-0000-000000000003',
  environment_id: '00000000-0000-0000-0000-000000000004',
  supervisor_id: '00000000-0000-0000-0000-000000000005',
  starts_at: '2026-10-06T11:00:00Z',
  ends_at: '2026-10-06T13:20:00Z',
  max_students_override: null,
  status: 'DRAFT',
  capacity_explanation: capacity,
}

const publishedSession = {
  ...session,
  status: 'PUBLISHED',
  capacity_explanation: capacity,
  slots_created: 2,
}

function mockSchedulingApi(publishError?: Error) {
  apiFetchMock.mockImplementation(
    (async (requestToken: string, path: string) => {
      if (requestToken !== token) {
        throw new Error('Token de teste inesperado.')
      }
      if (path === '/sessions') return [session]
      if (path === `/sessions/${sessionId}/capacity`) return capacity
      if (path === `/sessions/${sessionId}/publish`) {
        if (publishError) throw publishError
        return publishedSession
      }
      throw new Error(`Rota de teste inesperada: ${path}`)
    }) as typeof apiFetch,
  )
}

describe('scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exibe a explicacao de capacidade retornada para a sessao', async () => {
    mockSchedulingApi()

    render(<SchedulingPage token={token} />)

    expect(
      await screen.findByRole('heading', {
        name: /2 atendimentos simultâneos/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Salas disponíveis')).toBeInTheDocument()
    expect(screen.getByText(/gargalo|fator limitante/i)).toBeInTheDocument()
  })

  it('publica a sessao ao acionar o botao e mostra o novo estado', async () => {
    mockSchedulingApi()

    render(<SchedulingPage token={token} />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /publicar/i }))

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        token,
        `/sessions/${sessionId}/publish`,
        { method: 'POST' },
      )
    })
    expect(await screen.findByText(/publicad/i)).toBeInTheDocument()
  })

  it('mostra o erro devolvido quando a publicacao e rejeitada', async () => {
    mockSchedulingApi(new Error('A sessao nao possui capacidade efetiva positiva.'))

    render(<SchedulingPage token={token} />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /publicar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A sessao nao possui capacidade efetiva positiva.',
    )
  })
})
