import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AuthenticatedProps } from '../academics/academics'
import { apiFetch } from '../../lib/api'

type Dashboard = {
  term_id: string | null
  counts: {
    pending_documents: number
    sessions_total: number
    published_sessions: number
    active_allocations: number
    active_appointments: number
    at_risk_appointments: number
  }
  upcoming_sessions: Array<{
    id: string
    starts_at: string
    ends_at: string
    status: string
    service_name: string
    clinic_name: string
    capacity_effective: number
    capacity_available: number
  }>
  alerts: string[]
}

type AuditEvent = {
  id: string
  actor_user_id: string | null
  action: string
  target_type: string
  target_id: string
  occurred_at: string
  metadata_json: Record<string, unknown>
}

type AuditResponse = {
  items: AuditEvent[]
  total: number
  page: number
  page_size: number
}

type AuditActor = {
  id: string
  email: string
  role: 'MASTER' | 'SUPERVISOR' | 'STUDENT'
  is_active: boolean
}

type AuditFilters = {
  actor_user_id: string
  action: string
  target_type: string
  from: string
  to: string
}

type RiskAppointment = {
  id: string
  starts_at: string
  ends_at: string
  service_name: string
  clinic_name: string
  risk_status: string
  cause: string
}

type RiskResponse = {
  items: RiskAppointment[]
  total: number
  page: number
  page_size: number
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

function formatDate(value: string) {
  return dateFormatter.format(new Date(value))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Nao foi possivel carregar o painel.'
}

const alertLabels: Record<string, string> = {
  DOCUMENTS_PENDING: 'Há documentos pendentes para revisão.',
  APPOINTMENTS_AT_RISK: 'Há reservas em risco que precisam de revisão.',
}

const riskCauseLabels: Record<string, string> = {
  DOCUMENTS_PENDING: 'Documentação pendente',
  DOCUMENT_REJECTED: 'Documento rejeitado',
  CAPACITY_CHANGED: 'Capacidade alterada',
}

function humanizeCode(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())
}

function formatAlert(value: string): string {
  return alertLabels[value] ?? 'Alerta operacional: ' + humanizeCode(value) + '.'
}

function formatRiskCause(value: string): string {
  return riskCauseLabels[value] ?? humanizeCode(value)
}

function apiDateTime(value: string): string {
  return value ? value + ':00-03:00' : ''
}

function AuditEventsList({ audit }: { audit: AuditResponse | null }) {
  if (!audit || audit.items.length === 0) {
    return <p className='field-help'>Nenhum evento registrado.</p>
  }

  return (
    <ul className='resource-list' aria-label='Eventos recentes de auditoria'>
      {audit.items.map((event) => (
        <li key={event.id}>
          <span>
            <strong>{event.action}</strong>
            <small>{event.target_type} · {formatDate(event.occurred_at)}</small>
          </span>
          <code>{event.target_id.slice(0, 8)}...</code>
        </li>
      ))}
    </ul>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className='private-card admin-stat'>
      <span className='eyebrow'>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

export function AdminDashboardPage({ token }: AuthenticatedProps) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [audit, setAudit] = useState<AuditResponse | null>(null)
  const [risk, setRisk] = useState<RiskResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      apiFetch<Dashboard>(token, '/admin/dashboard'),
      apiFetch<AuditResponse>(token, '/audit-events?page_size=8'),
      apiFetch<RiskResponse>(token, '/admin/appointments/at-risk?page_size=8'),
    ])
      .then(([dashboardResult, auditResult, riskResult]) => {
        if (!active) return
        setDashboard(dashboardResult)
        setAudit(auditResult)
        setRisk(riskResult)
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  return (
    <section className='private-content admin-page' aria-labelledby='admin-page-title'>
      <p className='eyebrow'>Operação do semestre</p>
      <h1 id='admin-page-title'>Visão geral.</h1>
      <p className='private-intro'>
        Veja o que já está pronto e qual ação precisa ser feita no semestre ativo.
      </p>

      {isLoading && <p className='loading-message' role='status'>Carregando painel...</p>}
      {error && <p className='form-error' role='alert'>{error}</p>}
      {dashboard && (
        <>
          <div className='admin-stat-grid' aria-label='Indicadores do semestre'>
            <Stat label='Documentos para revisar' value={dashboard.counts.pending_documents} />
            <Stat label='Sessões publicadas' value={dashboard.counts.published_sessions} />
            <Stat label='Estudantes alocados' value={dashboard.counts.active_allocations} />
            <Stat label='Reservas ativas' value={dashboard.counts.active_appointments} />
            <Stat label='Reservas em risco' value={dashboard.counts.at_risk_appointments} />
          </div>

          <div className='admin-content-grid'>
            <article className='private-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>Agenda</p>
                  <h2>Próximas sessões</h2>
                </div>
              </div>
              {dashboard.alerts.length > 0 && (
                <ul className='admin-alert-list' aria-label='Alertas operacionais'>
                  {dashboard.alerts.map((alert) => <li key={alert}>{formatAlert(alert)}</li>)}
                </ul>
              )}
              {dashboard.upcoming_sessions.length === 0 ? (
                <p className='field-help'>Nenhuma sessão publicada nos próximos horários.</p>
              ) : (
                <ul className='resource-list' aria-label='Proximas sessoes'>
                  {dashboard.upcoming_sessions.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.service_name}</strong>
                        <small>{item.clinic_name} · {formatDate(item.starts_at)}</small>
                      </span>
                      <strong>{item.capacity_available} vaga{item.capacity_available === 1 ? '' : 's'}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className='private-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>Últimas alterações</p>
                  <h2>Auditoria recente.</h2>
                </div>
                <Link className='text-link' to='/app/auditoria'>
                  Ver histórico <span aria-hidden='true'>→</span>
                </Link>
              </div>
              <AuditEventsList audit={audit} />
            </article>

            <article className='private-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>Ação necessária</p>
                  <h2>Reservas que precisam de ação</h2>
                </div>
              </div>
              {!risk || risk.items.length === 0 ? (
                <p className='field-help'>Nenhuma reserva precisa de intervenção.</p>
              ) : (
                <ul className='resource-list' aria-label='Reservas em risco'>
                  {risk.items.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.service_name}</strong>
                        <small>{item.clinic_name} Â· {formatDate(item.starts_at)}</small>
                      </span>
                      <code>{formatRiskCause(item.cause)}</code>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  )
}

export function AdminAuditPage({ token }: AuthenticatedProps) {
  const [audit, setAudit] = useState<AuditResponse | null>(null)
  const [actors, setActors] = useState<AuditActor[]>([])
  const [filters, setFilters] = useState<AuditFilters>({ actor_user_id: '', action: '', target_type: '', from: '', to: '' })
  const [pageSize, setPageSize] = useState(8)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      apiFetch<AuditActor[]>(token, '/users'),
      apiFetch<AuditResponse>(token, '/audit-events?page=1&page_size=8'),
    ])
      .then(([actorResult, auditResult]) => {
        if (!active) return
        setActors(actorResult)
        setAudit(auditResult)
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  async function loadAudit(nextPage: number, currentFilters = filters, currentPageSize = pageSize) {
    setIsLoading(true)
    setError(null)
    const query = new URLSearchParams({ page: String(nextPage), page_size: String(currentPageSize) })
    if (currentFilters.actor_user_id) query.set('actor_user_id', currentFilters.actor_user_id)
    if (currentFilters.action.trim()) query.set('action', currentFilters.action.trim())
    if (currentFilters.target_type.trim()) query.set('target_type', currentFilters.target_type.trim())
    if (currentFilters.from) query.set('from', apiDateTime(currentFilters.from))
    if (currentFilters.to) query.set('to', apiDateTime(currentFilters.to))
    try {
      setAudit(await apiFetch<AuditResponse>(token, '/audit-events?' + query.toString()))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadAudit(1)
  }

  return (
    <section className='private-content admin-page audit-page' aria-labelledby='audit-page-title'>
      <p className='eyebrow'>Registro administrativo</p>
      <h1 id='audit-page-title'>Auditoria.</h1>
      <p className='private-intro'>
        Consulte as alterações recentes do sistema para entender o que foi feito e por quem, sem expor dados pessoais.
      </p>

      <div className='audit-page-heading'>
        <div>
          <p className='eyebrow'>Rastreamento</p>
          <h2>Eventos recentes.</h2>
        </div>
        <Link className='text-link' to='/app/visao-geral'>
          Voltar para visão geral <span aria-hidden='true'>→</span>
        </Link>
      </div>

      <form className='private-card audit-filters' onSubmit={submitFilters}>
        <div className='card-heading'><div><p className='eyebrow'>Consulta</p><h2>Filtrar eventos</h2></div></div>
        <div className='form-grid'>
          <div>
            <label htmlFor='audit-actor'>Ator</label>
            <select id='audit-actor' value={filters.actor_user_id} onChange={(event) => setFilters({ ...filters, actor_user_id: event.target.value })}>
              <option value=''>Todos os atores</option>
              {actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.email} - {actor.role}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor='audit-action'>Acao</label>
            <input id='audit-action' value={filters.action} placeholder='Ex.: USER_DEACTIVATED' onChange={(event) => setFilters({ ...filters, action: event.target.value })} />
          </div>
          <div>
            <label htmlFor='audit-target'>Alvo</label>
            <input id='audit-target' value={filters.target_type} placeholder='Ex.: user' onChange={(event) => setFilters({ ...filters, target_type: event.target.value })} />
          </div>
          <div>
            <label htmlFor='audit-from'>De</label>
            <input id='audit-from' type='datetime-local' value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          </div>
          <div>
            <label htmlFor='audit-to'>Ate</label>
            <input id='audit-to' type='datetime-local' value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          </div>
          <div>
            <label htmlFor='audit-page-size'>Eventos por pagina</label>
            <select id='audit-page-size' value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value='8'>8</option><option value='25'>25</option><option value='50'>50</option><option value='100'>100</option>
            </select>
          </div>
        </div>
        <button className='button button-primary' type='submit'>Aplicar filtros</button>
      </form>

      {isLoading && <p className='loading-message' role='status'>Carregando auditoria...</p>}
      {error && <p className='form-error' role='alert'>{error}</p>}
      {audit && (
        <article className='private-card audit-events-card'>
          <p className='field-help'>
            Mostrando {audit.items.length} de {audit.total} evento{audit.total === 1 ? '' : 's'} mais recente{audit.total === 1 ? '' : 's'}.
          </p>
          <AuditEventsList audit={audit} />
          <div className='resource-actions audit-pagination'>
            <button className='text-button' type='button' disabled={audit.page <= 1 || isLoading} onClick={() => void loadAudit(audit.page - 1)}>Anterior</button>
            <span className='field-help'>Pagina {audit.page} - {audit.total} evento{audit.total === 1 ? '' : 's'}</span>
            <button className='text-button' type='button' disabled={audit.page * audit.page_size >= audit.total || isLoading} onClick={() => void loadAudit(audit.page + 1)}>Proxima</button>
          </div>
        </article>
      )}
    </section>
  )
}
