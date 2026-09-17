import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { publicApiFetch } from '../../lib/api'

type Service = {
  id: string
  name: string
  duration_minutes: number
}

type Slot = {
  id: string
  service_id: string
  service_name: string
  clinic_id: string
  clinic_name: string
  starts_at: string
  ends_at: string
  capacity_available: number
}

type Booking = Slot & {
  status: string
  risk_status: string
  management_code: string | null
}

const privacyVersion = '2026-01'
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

function formatSlot(slot: Slot): string {
  return dateFormatter.format(new Date(slot.starts_at))
}

function dateRange(date: string): { from: string; to: string } {
  const start = new Date(date + 'T00:00:00-03:00')
  const end = new Date(date + 'T23:59:59-03:00')
  return { from: start.toISOString(), to: end.toISOString() }
}

function idempotencyKey(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'booking-' + Date.now().toString(36)
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Nao foi possivel concluir a operacao.'
}

export function PublicBookingPage() {
  const [services, setServices] = useState<Service[]>([])
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    publicApiFetch<Service[]>('/public/services')
      .then((result) => {
        if (active) setServices(result)
      })
      .catch((requestError) => {
        if (active) setError(errorText(requestError))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const clinics = useMemo(() => {
    const unique = new Map<string, string>()
    for (const slot of slots) unique.set(slot.clinic_id, slot.clinic_name)
    return Array.from(unique, ([id, name]) => ({ id, name }))
  }, [slots])

  async function searchSlots(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSelectedSlot(null)
    if (!serviceId || !date) {
      setError('Selecione um servico e uma data.')
      return
    }
    setIsLoading(true)
    try {
      const range = dateRange(date)
      const params = new URLSearchParams({
        service_id: serviceId,
        from: range.from,
        to: range.to,
      })
      if (clinicId) params.set('clinic_id', clinicId)
      const result = await publicApiFetch<Slot[]>(
        '/public/slots?' + params.toString(),
      )
      setSlots(result)
    } catch (requestError) {
      setError(errorText(requestError))
      setSlots([])
    } finally {
      setIsLoading(false)
    }
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!selectedSlot || !consent || (!email.trim() && !phone.trim())) {
      setError('Informe um contato e aceite o aviso de privacidade.')
      return
    }
    setIsSubmitting(true)
    try {
      const result = await publicApiFetch<Booking>('/public/appointments', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey() },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          privacy_notice_version: privacyVersion,
        }),
      })
      setBooking(result)
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function manage(action: 'confirm' | 'cancel') {
    if (!booking?.management_code) return
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await publicApiFetch<Booking>(
        '/public/appointments/' + action,
        {
          method: 'POST',
          body: JSON.stringify({
            appointment_id: booking.id,
            management_code: booking.management_code,
          }),
        },
      )
      setBooking({ ...booking, ...result, management_code: booking.management_code })
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className='public-booking-shell'>
      <header className='public-booking-header'>
        <Link className='brand' to='/' aria-label='Clinica Escola - inicio'>
          <span className='brand-mark' aria-hidden='true'>CE</span>
          <span className='brand-name'>Clinica <strong>Escola</strong></span>
        </Link>
        <Link className='text-link' to='/login'>Acesso interno</Link>
      </header>

      <main className='public-booking-page' aria-labelledby='booking-title'>
        <p className='eyebrow'>Atendimento para a comunidade</p>
        <h1 id='booking-title'>Encontre um horario.</h1>
        <p className='public-booking-intro'>
          Escolha um servico e uma data. A reserva e confirmada somente quando
          houver vaga real na clinica.
        </p>

        {error && <p className='form-error' role='alert'>{error}</p>}
        {booking ? (
          <section className='booking-result' aria-labelledby='booking-result-title'>
            <p className='eyebrow'>Reserva criada</p>
            <h2 id='booking-result-title'>Seu horario esta separado.</h2>
            <p className='booking-summary'>
              {booking.service_name} · {booking.clinic_name}<br />
              {formatSlot(booking)}
            </p>
            <p className='field-help'>
              Guarde este codigo. Ele aparece uma vez e permite confirmar ou
              cancelar a reserva: <strong>{booking.management_code}</strong>
            </p>
            <div className='resource-actions'>
              {booking.status === 'BOOKED' && (
                <button
                  className='button button-primary'
                  type='button'
                  disabled={isSubmitting}
                  onClick={() => manage('confirm')}
                >
                  Confirmar horario
                </button>
              )}
              {['BOOKED', 'CONFIRMED'].includes(booking.status) && (
                <button
                  className='button button-secondary'
                  type='button'
                  disabled={isSubmitting}
                  onClick={() => manage('cancel')}
                >
                  Cancelar reserva
                </button>
              )}
            </div>
            <p className='form-notice' role='status' aria-live='polite'>
              Estado atual: {booking.status === 'CONFIRMED' ? 'confirmada' : booking.status === 'CANCELLED' ? 'cancelada' : 'aguardando confirmacao'}.
            </p>
            <button
              className='text-button'
              type='button'
              onClick={() => {
                setBooking(null)
                setSelectedSlot(null)
              }}
            >
              Procurar outro horario
            </button>
          </section>
        ) : selectedSlot ? (
          <section className='booking-form-panel' aria-labelledby='booking-form-title'>
            <button className='back-link' type='button' onClick={() => setSelectedSlot(null)}>
              ← Voltar aos horarios
            </button>
            <p className='eyebrow'>02 · Seus dados</p>
            <h2 id='booking-form-title'>Finalize sua reserva.</h2>
            <p className='booking-summary'>
              {selectedSlot.service_name} · {selectedSlot.clinic_name}<br />
              {formatSlot(selectedSlot)}
            </p>
            <form className='compact-form' onSubmit={submitBooking}>
              <label htmlFor='booking-name'>Nome</label>
              <input id='booking-name' value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={160} />
              <label htmlFor='booking-email'>E-mail (opcional)</label>
              <input id='booking-email' type='email' value={email} onChange={(event) => setEmail(event.target.value)} />
              <label htmlFor='booking-phone'>Telefone (opcional)</label>
              <input id='booking-phone' type='tel' value={phone} onChange={(event) => setPhone(event.target.value)} />
              <label className='booking-consent'>
                <input type='checkbox' checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                <span>
                  Li o aviso de privacidade v{privacyVersion} e concordo com o uso
                  destes dados para gerir a reserva.
                </span>
              </label>
              <p className='field-help'>Nome e um contato bastam. Nao pedimos CPF, endereco ou informacao clinica.</p>
              <button className='button button-primary' type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Reservando...' : 'Reservar horario'}
              </button>
            </form>
          </section>
        ) : (
          <section aria-labelledby='booking-search-title'>
            <p className='eyebrow'>01 · Buscar</p>
            <h2 id='booking-search-title'>Quando voce quer ser atendido?</h2>
            <form className='booking-search-form' onSubmit={searchSlots}>
              <label htmlFor='booking-service'>Servico</label>
              <select id='booking-service' value={serviceId} onChange={(event) => setServiceId(event.target.value)} required>
                <option value=''>{isLoading ? 'Carregando servicos...' : 'Selecione um servico'}</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.duration_minutes} min
                  </option>
                ))}
              </select>
              <label htmlFor='booking-date'>Data</label>
              <input id='booking-date' type='date' min={today} value={date} onChange={(event) => setDate(event.target.value)} required />
              {clinics.length > 0 && (
                <>
                  <label htmlFor='booking-clinic'>Unidade (opcional)</label>
                  <select id='booking-clinic' value={clinicId} onChange={(event) => setClinicId(event.target.value)}>
                    <option value=''>Todas as unidades</option>
                    {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
                  </select>
                </>
              )}
              <button className='button button-primary' type='submit' disabled={isLoading}>
                {isLoading ? 'Consultando...' : 'Ver horarios'}
              </button>
            </form>
            {slots.length > 0 && (
              <ul className='booking-slot-list' aria-label='Horarios disponiveis'>
                {slots.map((slot) => (
                  <li key={slot.id}>
                    <div>
                      <strong>{formatSlot(slot)}</strong>
                      <span>{slot.clinic_name} · {slot.capacity_available} vaga{slot.capacity_available === 1 ? '' : 's'}</span>
                    </div>
                    <button className='button button-secondary' type='button' onClick={() => setSelectedSlot(slot)}>
                      Escolher
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!isLoading && serviceId && date && slots.length === 0 && (
              <p className='field-help' role='status'>Nenhum horario com vaga nessa data. Tente outra combinacao.</p>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
