import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../../lib/api'
import { StudentSessionsPage } from './student-sessions'

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}))

const apiFetchMock = vi.mocked(apiFetch)
const token = 'student-token'

const sessions = [
  {
    id: 'session-1',
    term_id: 'term-1',
    term_name: '2026.2',
    service_id: 'service-1',
    service_name: 'Avaliação funcional',
    clinic_id: 'clinic-1',
    clinic_name: 'Unidade Centro',
    environment_id: 'environment-1',
    environment_name: 'Sala de atendimento',
    supervisor_id: 'supervisor-1',
    supervisor_name: 'Supervisora Demo',
    starts_at: '2026-10-06T11:00:00Z',
    ends_at: '2026-10-06T12:00:00Z',
    status: 'PUBLISHED',
    allocation_id: 'allocation-1',
    allocation_status: 'ACTIVE',
    can_join: false,
    blocked_code: null,
    blocked_message: null,
  },
  {
    id: 'session-2',
    term_id: 'term-1',
    term_name: '2026.2',
    service_id: 'service-1',
    service_name: 'Avaliação funcional',
    clinic_id: 'clinic-1',
    clinic_name: 'Unidade Centro',
    environment_id: 'environment-1',
    environment_name: 'Sala de atendimento',
    supervisor_id: 'supervisor-1',
    supervisor_name: 'Supervisora Demo',
    starts_at: '2026-10-07T11:00:00Z',
    ends_at: '2026-10-07T12:00:00Z',
    status: 'DRAFT',
    allocation_id: null,
    allocation_status: null,
    can_join: true,
    blocked_code: null,
    blocked_message: null,
  },
]

describe('sessoes do estudante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetchMock.mockImplementation(async (_requestToken, path, init) => {
      if (path === '/me/available-sessions') return sessions
      if (path === '/sessions/session-2/allocations' && init?.method === 'POST') {
        return { id: 'allocation-2' }
      }
      throw new Error(`Rota de teste inesperada: ${path}`)
    })
  })

  it('mostra a sessao propria e permite entrar em uma oportunidade compativel', async () => {
    render(
      <MemoryRouter>
        <StudentSessionsPage token={token} />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Minhas sessões' })).toBeInTheDocument()
    expect(screen.getAllByText('Avaliação funcional')).toHaveLength(2)
    expect(screen.getAllByText('Unidade Centro · Sala de atendimento')).toHaveLength(2)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /participar desta sessão/i }))

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        token,
        '/sessions/session-2/allocations',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/inscrição realizada/i)
  })

  it('explica quando uma oportunidade esta bloqueada por documento', async () => {
    apiFetchMock.mockResolvedValueOnce([
      { ...sessions[1], can_join: false, blocked_code: 'DOCUMENTS_PENDING', blocked_message: 'Envie os documentos pendentes antes de participar.' },
    ])

    render(
      <MemoryRouter>
        <StudentSessionsPage token={token} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('DOCUMENTS_PENDING')).toBeInTheDocument()
    expect(screen.getByText(/Envie os documentos pendentes antes de participar/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /participar desta sessão/i })).toBeDisabled()
  })
})
