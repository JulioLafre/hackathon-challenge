import { useEffect, useState } from 'react'
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    apiFetch<AuditResponse>(token, '/audit-events?page_size=8')
      .then((result) => {
        if (active) setAudit(result)
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

      {isLoading && <p className='loading-message' role='status'>Carregando auditoria...</p>}
      {error && <p className='form-error' role='alert'>{error}</p>}
      {audit && (
        <article className='private-card audit-events-card'>
          <p className='field-help'>
            Mostrando {audit.items.length} de {audit.total} evento{audit.total === 1 ? '' : 's'} mais recente{audit.total === 1 ? '' : 's'}.
          </p>
          <AuditEventsList audit={audit} />
        </article>
      )}
    </section>
  )
}
