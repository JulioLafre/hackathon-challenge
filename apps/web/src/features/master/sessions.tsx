import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import type { AuthenticatedProps } from '../academics/academics'

type Term = { id: string; name: string; status: 'DRAFT' | 'ACTIVE' | 'CLOSED' }
type Service = { id: string; name: string; discipline_id: string; duration_minutes: number; is_active: boolean }
type Clinic = { id: string; name: string; is_active: boolean }
type Environment = { id: string; clinic_id: string; name: string; is_active: boolean }
type Supervisor = { user_id: string; full_name: string; max_students_default: number }
type Student = { user_id: string; registration: string; full_name: string; phone: string | null }
type Allocation = { id: string; session_id: string; student_id: string; status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | string; suspended_reason: string | null }
type Session = {
  id: string
  term_id: string
  service_id: string
  clinic_id: string
  environment_id: string
  supervisor_id: string
  starts_at: string
  ends_at: string
  max_students_override: number | null
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED' | string
  capacity_explanation: Capacity | null
}
type Capacity = { effective: number; constraints: Record<string, number>; limiting_factors: string[] }
type RiskAppointment = { id: string; starts_at: string; service_name: string; clinic_name: string; cause: string }
type RiskResponse = { items: RiskAppointment[]; total: number }
type SessionForm = {
  term_id: string
  service_id: string
  clinic_id: string
  environment_id: string
  supervisor_id: string
  session_date: string
  starts_at: string
  ends_at: string
  max_students_override: string
}

const emptyForm: SessionForm = {
  term_id: '',
  service_id: '',
  clinic_id: '',
  environment_id: '',
  supervisor_id: '',
  session_date: '',
  starts_at: '',
  ends_at: '',
  max_students_override: '',
}

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

const factorLabels: Record<string, string> = {
  eligible_students: 'Estudantes elegíveis',
  supervision: 'Supervisão',
  rooms: 'Salas disponíveis',
  equipment: 'Equipamentos',
  clinic_appointments: 'Capacidade da clínica',
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase())
}

function localDateTime(date: string, time: string) {
  return date && time ? `${date}T${time}:00-03:00` : ''
}

function localPart(value: string, part: 'date' | 'time') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce<Record<string, string>>((result, item) => {
    result[item.type] = item.value
    return result
  }, {})
  return part === 'date' ? `${parts.year}-${parts.month}-${parts.day}` : `${parts.hour}:${parts.minute}`
}

function statusLabel(status: Session['status']) {
  return { DRAFT: 'Rascunho', PUBLISHED: 'Publicada', CANCELLED: 'Cancelada', COMPLETED: 'Concluída' }[status] ?? status
}

function statusClass(status: Session['status']) {
  if (status === 'DRAFT') return 'status-draft'
  if (status === 'PUBLISHED') return 'status-active'
  return 'status-closed'
}

export function MasterSessionsPage({ token }: AuthenticatedProps) {
  const [terms, setTerms] = useState<Term[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [allocations, setAllocations] = useState<Record<string, Allocation[]>>({})
  const [allocationStudent, setAllocationStudent] = useState<Record<string, string>>({})
  const [allocationsLoading, setAllocationsLoading] = useState(false)
  const [risk, setRisk] = useState<RiskResponse | null>(null)
  const [capacities, setCapacities] = useState<Record<string, Capacity>>({})
  const [form, setForm] = useState<SessionForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [nextTerms, nextServices, nextClinics, nextEnvironments, nextSupervisors, nextStudents, nextSessions, nextRisk] = await Promise.all([
        apiFetch<Term[]>(token, '/terms'),
        apiFetch<Service[]>(token, '/services'),
        apiFetch<Clinic[]>(token, '/clinics'),
        apiFetch<Environment[]>(token, '/environments'),
        apiFetch<Supervisor[]>(token, '/supervisors'),
        apiFetch<Student[]>(token, '/students'),
        apiFetch<Session[]>(token, '/sessions'),
        apiFetch<RiskResponse>(token, '/admin/appointments/at-risk?page_size=50'),
      ])
      setTerms(nextTerms)
      setServices(nextServices)
      setClinics(nextClinics)
      setEnvironments(nextEnvironments)
      setSupervisors(nextSupervisors)
      setStudents(nextStudents)
      setSessions(nextSessions)
      setRisk(nextRisk)
      setForm((current) => ({
        ...current,
        term_id: current.term_id || nextTerms.find((term) => term.status !== 'CLOSED')?.id || '',
        service_id: current.service_id || nextServices.find((service) => service.is_active)?.id || '',
        clinic_id: current.clinic_id || nextClinics.find((clinic) => clinic.is_active)?.id || '',
        environment_id: current.environment_id || nextEnvironments.find((environment) => environment.is_active)?.id || '',
        supervisor_id: current.supervisor_id || nextSupervisors[0]?.user_id || '',
      }))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let active = true
    if (sessions.length === 0) {
      setCapacities({})
      return () => { active = false }
    }
    void Promise.all(sessions.map(async (session) => {
      try {
        return [session.id, await apiFetch<Capacity>(token, `/sessions/${session.id}/capacity`)] as const
      } catch {
        return null
      }
    })).then((entries) => {
      if (!active) return
      setCapacities(Object.fromEntries(entries.filter((entry): entry is [string, Capacity] => entry !== null)))
    })
    return () => { active = false }
  }, [sessions, token])

  useEffect(() => {
    let active = true
    if (sessions.length === 0) {
      setAllocations({})
      setAllocationsLoading(false)
      return () => { active = false }
    }
    setAllocationsLoading(true)
    void Promise.all(sessions.map(async (session) => {
      try {
        return [session.id, await apiFetch<Allocation[]>(token, `/sessions/${session.id}/allocations`)] as const
      } catch {
        return [session.id, []] as const
      }
    })).then((entries) => {
      if (!active) return
      setAllocations(Object.fromEntries(entries))
    }).finally(() => {
      if (active) setAllocationsLoading(false)
    })
    return () => { active = false }
  }, [sessions, token])

  function updateForm(changes: Partial<SessionForm>) {
    setForm((current) => ({ ...current, ...changes }))
  }

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (!form.term_id || !form.service_id || !form.clinic_id || !form.environment_id || !form.supervisor_id) {
      setError('Escolha semestre, serviço, clínica, ambiente e supervisor.')
      return
    }
    const startsAt = localDateTime(form.session_date, form.starts_at)
    const endsAt = localDateTime(form.session_date, form.ends_at)
    if (!startsAt || !endsAt) {
      setError('Informe a data, o início e o fim da sessão.')
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        term_id: form.term_id,
        service_id: form.service_id,
        clinic_id: form.clinic_id,
        environment_id: form.environment_id,
        supervisor_id: form.supervisor_id,
        starts_at: startsAt,
        ends_at: endsAt,
        max_students_override: form.max_students_override.trim() ? Number(form.max_students_override) : null,
      }
      await apiFetch<Session>(token, editingId ? `/sessions/${editingId}` : '/sessions', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      setForm(emptyForm)
      setEditingId(null)
      setNotice(editingId ? 'Rascunho atualizado.' : 'Sessão criada como rascunho.')
      await refresh()
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function editSession(session: Session) {
    if (session.status !== 'DRAFT') return
    setEditingId(session.id)
    setForm({
      term_id: session.term_id,
      service_id: session.service_id,
      clinic_id: session.clinic_id,
      environment_id: session.environment_id,
      supervisor_id: session.supervisor_id,
      session_date: localPart(session.starts_at, 'date'),
      starts_at: localPart(session.starts_at, 'time'),
      ends_at: localPart(session.ends_at, 'time'),
      max_students_override: session.max_students_override?.toString() ?? '',
    })
    setNotice(null)
    setError(null)
  }

  async function sessionAction(sessionId: string, action: 'publish' | 'cancel') {
    if (action === 'cancel' && !window.confirm('Cancelar esta sessão? Reservas existentes seguem as regras da API.')) return
    setError(null)
    setNotice(null)
    try {
      await apiFetch<Session>(token, `/sessions/${sessionId}/${action}`, { method: 'POST' })
      setNotice(action === 'publish' ? 'Sessão publicada e horários gerados.' : 'Sessão cancelada.')
      await refresh()
    } catch (actionError) {
      setError(errorMessage(actionError))
    }
  }

  function allocationStatusLabel(status: Allocation['status']) {
    return status === 'ACTIVE' ? 'Ativa' : status === 'SUSPENDED' ? 'Suspensa' : status === 'CANCELLED' ? 'Cancelada' : status
  }

  async function refreshCapacity(sessionId: string) {
    try {
      const capacity = await apiFetch<Capacity>(token, `/sessions/${sessionId}/capacity`)
      setCapacities((current) => ({ ...current, [sessionId]: capacity }))
    } catch {
      // A capacidade permanece com a ultima explicacao conhecida se a consulta falhar.
    }
  }

  async function allocateStudent(sessionId: string) {
    const studentId = allocationStudent[sessionId]
    if (!studentId) {
      setError('Escolha um estudante antes de alocar.')
      return
    }
    setError(null)
    setNotice(null)
    try {
      const allocation = await apiFetch<Allocation>(token, `/sessions/${sessionId}/allocations`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId }),
      })
      setAllocations((current) => ({ ...current, [sessionId]: [...(current[sessionId] ?? []), allocation] }))
      setAllocationStudent((current) => ({ ...current, [sessionId]: '' }))
      await refreshCapacity(sessionId)
      setNotice('Estudante alocado na sessao.')
    } catch (allocationError) {
      setError(errorMessage(allocationError))
    }
  }

  async function removeAllocation(sessionId: string, allocation: Allocation) {
    if (!window.confirm('Remover este estudante da sessao?')) return
    setError(null)
    setNotice(null)
    try {
      await apiFetch<Allocation>(token, `/sessions/${sessionId}/allocations/${allocation.id}`, { method: 'DELETE' })
      setAllocations((current) => ({ ...current, [sessionId]: (current[sessionId] ?? []).filter((item) => item.id !== allocation.id) }))
      await refreshCapacity(sessionId)
      setNotice('Alocacao removida.')
    } catch (allocationError) {
      setError(errorMessage(allocationError))
    }
  }

  function serviceName(id: string) { return services.find((service) => service.id === id)?.name ?? id.slice(0, 8) + '…' }
  function clinicName(id: string) { return clinics.find((clinic) => clinic.id === id)?.name ?? id.slice(0, 8) + '…' }
  function environmentName(id: string) { return environments.find((environment) => environment.id === id)?.name ?? id.slice(0, 8) + '…' }
  function supervisorName(id: string) { return supervisors.find((supervisor) => supervisor.user_id === id)?.full_name ?? id.slice(0, 8) + '…' }

  const visibleEnvironments = environments.filter((environment) => environment.is_active && (!form.clinic_id || environment.clinic_id === form.clinic_id))
  const activeTerms = terms.filter((term) => term.status !== 'CLOSED')
  const activeServices = services.filter((service) => service.is_active)
  const activeClinics = clinics.filter((clinic) => clinic.is_active)

  return (
    <section className='private-content master-page master-sessions-page' aria-labelledby='master-sessions-title'>
      <p className='eyebrow'>Operação clínica</p>
      <h1 id='master-sessions-title'>Sessões e agenda.</h1>
      <p className='private-intro'>
        Crie e edite rascunhos, acompanhe cada fator de capacidade e publique somente quando a API confirmar a operação.
      </p>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status'>{notice}</p>}
      {isLoading && <p className='loading-message' role='status'>Carregando agenda e configurações...</p>}

      {!isLoading && (
        <>
          <div className='academic-layout master-sessions-layout'>
            <article className='private-card academic-card'>
              <div className='card-heading'><div><p className='eyebrow'>01 · Nova sessão</p><h2>{editingId ? 'Editar rascunho' : 'Criar sessão clínica'}</h2></div></div>
              <p className='field-help'>O Master escolhe o contexto; disponibilidade, compatibilidade e capacidade continuam sendo verificadas no servidor.</p>
              <form className='compact-form' onSubmit={submitSession} autoComplete='off'>
                <label htmlFor='master-session-term'>Semestre</label>
                <select id='master-session-term' value={form.term_id} onChange={(event) => updateForm({ term_id: event.target.value })} required><option value=''>Selecione</option>{activeTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select>
                <label htmlFor='master-session-service'>Serviço</label>
                <select id='master-session-service' value={form.service_id} onChange={(event) => updateForm({ service_id: event.target.value })} required><option value=''>Selecione</option>{activeServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>)}</select>
                <div className='form-grid'>
                  <div><label htmlFor='master-session-clinic'>Clínica</label><select id='master-session-clinic' value={form.clinic_id} onChange={(event) => updateForm({ clinic_id: event.target.value, environment_id: '' })} required><option value=''>Selecione</option>{activeClinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></div>
                  <div><label htmlFor='master-session-environment'>Ambiente</label><select id='master-session-environment' value={form.environment_id} onChange={(event) => updateForm({ environment_id: event.target.value })} required><option value=''>Selecione</option>{visibleEnvironments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}</select></div>
                </div>
                <label htmlFor='master-session-supervisor'>Supervisor</label>
                <select id='master-session-supervisor' value={form.supervisor_id} onChange={(event) => updateForm({ supervisor_id: event.target.value })} required><option value=''>Selecione</option>{supervisors.map((supervisor) => <option key={supervisor.user_id} value={supervisor.user_id}>{supervisor.full_name} · até {supervisor.max_students_default}</option>)}</select>
                <div className='form-grid'>
                  <div><label htmlFor='master-session-date'>Data</label><input id='master-session-date' type='date' value={form.session_date} onChange={(event) => updateForm({ session_date: event.target.value })} required /></div>
                  <div><label htmlFor='master-session-start'>Início</label><select id='master-session-start' value={form.starts_at} onChange={(event) => updateForm({ starts_at: event.target.value, ends_at: form.ends_at > event.target.value ? form.ends_at : '' })} required><option value=''>Selecione</option>{timeOptions.slice(0, -1).map((time) => <option key={time} value={time}>{time}</option>)}</select></div>
                </div>
                <label htmlFor='master-session-end'>Fim</label>
                <select id='master-session-end' value={form.ends_at} onChange={(event) => updateForm({ ends_at: event.target.value })} disabled={!form.starts_at} required><option value=''>{form.starts_at ? 'Selecione' : 'Escolha o início primeiro'}</option>{timeOptions.filter((time) => time > form.starts_at).map((time) => <option key={time} value={time}>{time}</option>)}</select>
                <label htmlFor='master-session-limit'>Limite opcional de estudantes</label>
                <input id='master-session-limit' type='number' min='1' value={form.max_students_override} onChange={(event) => updateForm({ max_students_override: event.target.value })} />
                <p className='field-help'>Horários usam America/Sao_Paulo. Deixe o limite vazio para usar o escopo do supervisor.</p>
                <button className='button button-primary' type='submit' disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : editingId ? 'Salvar rascunho' : 'Criar rascunho'}</button>
                {editingId && <button className='text-button' type='button' onClick={() => { setEditingId(null); setForm(emptyForm) }}>Cancelar edição</button>}
              </form>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'><div><p className='eyebrow'>02 · Reservas em risco</p><h2>Fila operacional</h2></div><span className='card-count'>{risk?.total ?? 0}</span></div>
              <p className='field-help'>A causa fica visível para orientar substituição ou cancelamento manual. Nenhum agendamento é removido automaticamente.</p>
              {!risk || risk.items.length === 0 ? <p className='empty-state'>Nenhuma reserva em risco.</p> : (
                <ul className='resource-list' id='riscos' aria-label='Fila de reservas em risco'>
                  {risk.items.map((item) => <li key={item.id}><span><strong>{item.service_name}</strong><small>{item.clinic_name} · {formatDateTime(item.starts_at)}</small></span><code>{humanize(item.cause)}</code></li>)}
                </ul>
              )}
              <Link className='text-link master-card-link' to='/app/visao-geral'>Abrir visão operacional <span aria-hidden='true'>→</span></Link>
            </article>
          </div>

          <section className='master-session-list-section' aria-labelledby='master-session-list-title'>
            <div className='master-section-heading'><div><p className='eyebrow'>03 · Acompanhamento</p><h2 id='master-session-list-title'>Sessões cadastradas.</h2></div><p>Publique rascunhos viáveis e mantenha a capacidade explicada para a operação.</p></div>
            {sessions.length === 0 ? <p className='empty-state'>Nenhuma sessão foi criada ainda.</p> : (
              <div className='master-session-list'>
                {sessions.map((session) => {
                  const capacity = capacities[session.id] ?? session.capacity_explanation
                  return <article className='private-card master-session-card' key={session.id}>
                    <div className='card-heading'><div><p className='eyebrow'>{serviceName(session.service_id)}</p><h2>{formatDateTime(session.starts_at)}</h2></div><span className={`status-pill ${statusClass(session.status)}`}>{statusLabel(session.status)}</span></div>
                    <p className='field-help'>Até {formatDateTime(session.ends_at)} · {clinicName(session.clinic_id)} · {environmentName(session.environment_id)}</p>
                    <dl className='master-session-context'><div><dt>Semestre</dt><dd>{terms.find((term) => term.id === session.term_id)?.name ?? '—'}</dd></div><div><dt>Supervisor</dt><dd>{supervisorName(session.supervisor_id)}</dd></div><div><dt>Limite manual</dt><dd>{session.max_students_override ?? 'Padrão do escopo'}</dd></div></dl>
                    {capacity && <div className='master-capacity-box'><div className='card-heading'><div><p className='eyebrow'>Capacidade efetiva</p><strong>{capacity.effective} atendimento{capacity.effective === 1 ? '' : 's'} simultâneo{capacity.effective === 1 ? '' : 's'}</strong></div><span className={capacity.effective > 0 ? 'status-pill status-active' : 'status-pill document-status-rejected'}>{capacity.effective > 0 ? 'Viável' : 'Sem capacidade'}</span></div><ul className='resource-list'>{Object.entries(capacity.constraints).map(([factor, value]) => <li key={factor}><span><strong>{factorLabels[factor] ?? humanize(factor)}</strong>{capacity.limiting_factors.includes(factor) && <small>Fator limitante</small>}</span><strong>{value}</strong></li>)}</ul></div>}
                    <div className='master-session-allocation'>
                      <div className='card-heading'><div><p className='eyebrow'>Alocação</p><h3>Estudantes na sessão</h3></div><span className='card-count'>{(allocations[session.id] ?? []).length}</span></div>
                      <form className='compact-form' onSubmit={(event) => { event.preventDefault(); void allocateStudent(session.id) }}>
                        <label htmlFor={'allocation-student-' + session.id}>Estudante</label>
                        <select id={'allocation-student-' + session.id} value={allocationStudent[session.id] ?? ''} onChange={(event) => setAllocationStudent((current) => ({ ...current, [session.id]: event.target.value }))}>
                          <option value=''>Selecione um estudante</option>
                          {students.filter((student) => !(allocations[session.id] ?? []).some((allocation) => allocation.student_id === student.user_id && allocation.status !== 'CANCELLED')).map((student) => <option key={student.user_id} value={student.user_id}>{student.full_name} · {student.registration}</option>)}
                        </select>
                        <button className='button button-secondary' type='submit'>Alocar estudante</button>
                      </form>
                      {allocationsLoading && <p className='field-help' role='status'>Carregando alocações...</p>}
                      {!allocationsLoading && (allocations[session.id] ?? []).length === 0 && <p className='field-help'>Nenhum estudante alocado.</p>}
                      <ul className='resource-list'>
                        {(allocations[session.id] ?? []).map((allocation) => {
                          const student = students.find((item) => item.user_id === allocation.student_id)
                          return <li key={allocation.id}><span><strong>{student?.full_name ?? allocation.student_id.slice(0, 8) + '⬦'}</strong><small>{student?.registration ?? 'Matricula indisponivel'}{allocation.suspended_reason ? ' · ' + humanize(allocation.suspended_reason) : ''}</small></span><span className='resource-actions'><span className={'status-pill ' + (allocation.status === 'ACTIVE' ? 'status-active' : 'document-status-rejected')}>{allocationStatusLabel(allocation.status)}</span>{allocation.status !== 'CANCELLED' && <button className='text-button' type='button' onClick={() => void removeAllocation(session.id, allocation)}>Remover</button>}</span></li>
                        })}
                      </ul>
                    </div>
                    <div className='resource-actions master-session-actions'>{session.status === 'DRAFT' && <button className='button button-secondary' type='button' onClick={() => editSession(session)}>Editar rascunho</button>}{session.status === 'DRAFT' && <button className='button button-primary' type='button' onClick={() => void sessionAction(session.id, 'publish')}>Publicar sessão</button>}{session.status !== 'CANCELLED' && session.status !== 'COMPLETED' && <button className='text-button' type='button' onClick={() => void sessionAction(session.id, 'cancel')}>Cancelar sessão</button>}</div>
                  </article>
                })}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
