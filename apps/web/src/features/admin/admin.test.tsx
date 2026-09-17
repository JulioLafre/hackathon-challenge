import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { AdminAuditPage, AdminDashboardPage } from './admin'

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}))

const apiFetchMock = vi.mocked(apiFetch)

describe('admin dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetchMock.mockImplementation(async (_token, path) => {
      if (path === '/admin/dashboard') {
        return {
          term_id: null,
          counts: {
            pending_documents: 1,
            sessions_total: 2,
            published_sessions: 1,
            active_allocations: 1,
            active_appointments: 1,
            at_risk_appointments: 1,
          },
          upcoming_sessions: [],
          alerts: ['APPOINTMENTS_AT_RISK'],
        }
      }
      if (path === '/audit-events?page_size=8') {
        return {
          items: [],
          total: 0,
          page: 1,
          page_size: 8,
        }
      }
      return {
        items: [
          {
            id: '00000000-0000-0000-0000-000000000001',
            starts_at: '2026-10-06T11:00:00Z',
            ends_at: '2026-10-06T12:00:00Z',
            service_name: 'Atendimento demo',
            clinic_name: 'Clinica demo',
            risk_status: 'AT_RISK',
            cause: 'DOCUMENT_REJECTED',
          },
        ],
        total: 1,
        page: 1,
        page_size: 8,
      }
    })
  })

  it('exibe indicadores e a causa operacional sem PII', async () => {
    render(
      <MemoryRouter>
        <AdminDashboardPage token='master-token' />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Visão geral.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Veja o que já está pronto e qual ação precisa ser feita no semestre ativo.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximas sessões' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reservas que precisam de ação' })).toBeInTheDocument()
    expect(screen.getByText('Há reservas em risco que precisam de revisão.')).toBeInTheDocument()
    expect(screen.getByText('Documento rejeitado')).toBeInTheDocument()
    expect(screen.getByText('Nenhum evento registrado.')).toBeInTheDocument()
    expect(screen.queryByText('pessoa.demo@example.com')).not.toBeInTheDocument()
  })

  it('apresenta a auditoria como uma tela própria', async () => {
    render(
      <MemoryRouter initialEntries={['/app/auditoria']}>
        <AdminAuditPage token='master-token' />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Auditoria.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Eventos recentes.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar para visão geral/i })).toHaveAttribute(
      'href',
      '/app/visao-geral',
    )
    expect(apiFetchMock).toHaveBeenCalledWith('master-token', '/audit-events?page_size=8')
    expect(apiFetchMock).not.toHaveBeenCalledWith('master-token', '/admin/dashboard')
  })
})
