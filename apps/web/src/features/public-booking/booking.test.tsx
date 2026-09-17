import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publicApiFetch } from '../../lib/api'
import { PublicBookingPage } from './booking'

vi.mock('../../lib/api', () => ({
  publicApiFetch: vi.fn(),
}))

const apiFetchMock = vi.mocked(publicApiFetch)
const service = {
  id: 'service-1',
  name: 'Avaliacao funcional',
  duration_minutes: 60,
}
const slot = {
  id: 'slot-1',
  service_id: service.id,
  service_name: service.name,
  clinic_id: 'clinic-1',
  clinic_name: 'Unidade Centro',
  starts_at: '2026-10-06T11:00:00Z',
  ends_at: '2026-10-06T12:00:00Z',
  capacity_available: 1,
}

describe('public booking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/public/services') return [service]
      if (path.startsWith('/public/slots?')) return [slot]
      return {
        ...slot,
        id: 'appointment-1',
        status: 'BOOKED',
        risk_status: 'NONE',
        management_code: 'demo-management-code',
      }
    })
  })

  it('busca um horario e envia uma reserva com chave idempotente', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <PublicBookingPage />
      </MemoryRouter>,
    )

    await user.selectOptions(
      await screen.findByLabelText('Servico'),
      service.id,
    )
    await user.type(screen.getByLabelText('Data'), '2026-10-06')
    await user.click(screen.getByRole('button', { name: 'Ver horarios' }))
    await user.click(await screen.findByRole('button', { name: 'Escolher' }))

    await user.type(screen.getByLabelText('Nome'), 'Pessoa Demo')
    await user.type(screen.getByLabelText('E-mail (opcional)'), 'demo@example.com')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Reservar horario' }))

    await waitFor(() => {
      const reservationCall = apiFetchMock.mock.calls.find(
        ([path, init]) =>
          path === '/public/appointments' && init?.method === 'POST',
      )
      expect(reservationCall).toBeDefined()
      expect(reservationCall?.[1]?.headers).toEqual(
        expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
      )
    })
    expect(await screen.findByText('demo-management-code')).toBeInTheDocument()
  })
})
