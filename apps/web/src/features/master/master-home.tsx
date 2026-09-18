import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import type { AuthenticatedProps } from '../academics/academics'

type Term = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
}

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

type User = {
  id: string
  email: string
  role: 'MASTER' | 'SUPERVISOR' | 'STUDENT'
  is_active: boolean
}

type NamedResource = { id: string; name: string; is_active: boolean }
type DocumentRequirement = { id: string; is_active: boolean }
type Session = { id: string; status: string }
type RiskAppointment = {
  id: string
  starts_at: string
  service_name: string
  clinic_name: string
  cause: string
}
type RiskResponse = { items: RiskAppointment[]; total: number }
type AuditEvent = {
  id: string
  action: string
  target_type: string
  target_id: string
  occurred_at: string
}
type AuditResponse = { items: AuditEvent[]; total: number }

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
    new Date(value),
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível carregar a central master.'
}

function humanizeCode(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className='private-card admin-stat'>
      <span className='eyebrow'>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function ActionCard({
  eyebrow,
  title,
  description,
  count,
  countLabel,
  path,
}: {
  eyebrow: string
  title: string
  description: string
  count: number | string
  countLabel: string
  path: string
}) {
  return (
    <article className='private-card master-action-card'>
      <div className='master-action-card-top'>
        <p className='eyebrow'>{eyebrow}</p>
        <span className='card-count' aria-label={`${count} ${countLabel}`}>
          {count}
        </span>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className='text-link' to={path}>
        Abrir módulo <span aria-hidden='true'>→</span>
      </Link>
    </article>
  )
}

export function MasterHomePage({ token }: AuthenticatedProps) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [terms, setTerms] = useState<Term[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [courses, setCourses] = useState<NamedResource[]>([])
  const [disciplines, setDisciplines] = useState<NamedResource[]>([])
  const [clinics, setClinics] = useState<NamedResource[]>([])
  const [environments, setEnvironments] = useState<NamedResource[]>([])
  const [rooms, setRooms] = useState<NamedResource[]>([])
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [risk, setRisk] = useState<RiskResponse | null>(null)
  const [audit, setAudit] = useState<AuditResponse | null>(null)
  const [selectedTermId, setSelectedTermId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isChangingTerm, setIsChangingTerm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [
        nextDashboard,
        nextTerms,
        nextUsers,
        nextCourses,
        nextDisciplines,
        nextClinics,
        nextEnvironments,
        nextRooms,
        nextRequirements,
        nextSessions,
        nextRisk,
        nextAudit,
      ] = await Promise.all([
        apiFetch<Dashboard>(token, '/admin/dashboard'),
        apiFetch<Term[]>(token, '/terms'),
        apiFetch<User[]>(token, '/users'),
        apiFetch<NamedResource[]>(token, '/courses'),
        apiFetch<NamedResource[]>(token, '/disciplines'),
        apiFetch<NamedResource[]>(token, '/clinics'),
        apiFetch<NamedResource[]>(token, '/environments'),
        apiFetch<NamedResource[]>(token, '/rooms'),
        apiFetch<DocumentRequirement[]>(token, '/document-requirements'),
        apiFetch<Session[]>(token, '/sessions'),
        apiFetch<RiskResponse>(token, '/admin/appointments/at-risk?page_size=6'),
        apiFetch<AuditResponse>(token, '/audit-events?page_size=6'),
      ])
      setDashboard(nextDashboard)
      setTerms(nextTerms)
      setUsers(nextUsers)
      setCourses(nextCourses)
      setDisciplines(nextDisciplines)
      setClinics(nextClinics)
      setEnvironments(nextEnvironments)
      setRooms(nextRooms)
      setRequirements(nextRequirements)
      setSessions(nextSessions)
      setRisk(nextRisk)
      setAudit(nextAudit)
      setSelectedTermId((current) =>
        current ||
        nextDashboard.term_id ||
        nextTerms.find((term) => term.status === 'ACTIVE')?.id ||
        nextTerms[0]?.id ||
        '',
      )
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  async function changeTerm(termId: string) {
    setSelectedTermId(termId)
    if (!termId) return
    setIsChangingTerm(true)
    setError(null)
    try {
      const nextDashboard = await apiFetch<Dashboard>(
        token,
        '/admin/dashboard?term_id=' + encodeURIComponent(termId),
      )
      setDashboard(nextDashboard)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setIsChangingTerm(false)
    }
  }

  const activeTerm = terms.find((term) => term.id === selectedTermId)
  const activeUsers = users.filter((user) => user.is_active).length
  const activeClinics = clinics.filter((clinic) => clinic.is_active).length
  const activeEnvironments = environments.filter((environment) => environment.is_active).length
  const activeSessions = sessions.filter((session) => session.status === 'PUBLISHED').length

  return (
    <section className='private-content master-home-page' aria-labelledby='master-home-title'>
      <div className='master-home-heading'>
        <div>
          <p className='eyebrow'>Centro de comando</p>
          <h1 id='master-home-title'>Operação Master.</h1>
          <p className='private-intro'>
            Configure pessoas, ensino, clínicas e agenda em um só lugar. Cada módulo mantém suas ações completas e os dados do semestre selecionado.
          </p>
        </div>
        <div className='master-term-control'>
          <label htmlFor='master-term'>Semestre em foco</label>
          <select
            id='master-term'
            value={selectedTermId}
            onChange={(event) => void changeTerm(event.target.value)}
            disabled={isLoading || terms.length === 0 || isChangingTerm}
          >
            <option value=''>Nenhum semestre disponível</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name} · {term.status === 'ACTIVE' ? 'Ativo' : term.status === 'DRAFT' ? 'Rascunho' : 'Encerrado'}
              </option>
            ))}
          </select>
          {activeTerm && (
            <small>{formatDate(activeTerm.starts_on)} a {formatDate(activeTerm.ends_on)}</small>
          )}
        </div>
      </div>

      {error && <p className='form-error' role='alert'>{error}</p>}
      {isLoading && <p className='loading-message' role='status'>Carregando visão completa do Master...</p>}

      {dashboard && (
        <>
          {dashboard.alerts.length > 0 && (
            <div className='master-alert-banner' role='status'>
              <strong>Ações pendentes</strong>
              <span>{dashboard.alerts.map(humanizeCode).join(' · ')}</span>
              {dashboard.alerts.includes('DOCUMENTS_PENDING') && <Link className='text-link' to='/app/documentos'>Revisar documentos <span aria-hidden='true'>→</span></Link>}
              {dashboard.alerts.includes('APPOINTMENTS_AT_RISK') && <Link className='text-link' to='/app/sessoes-master'>Tratar reservas <span aria-hidden='true'>→</span></Link>}
            </div>
          )}

          <div className='admin-stat-grid master-stat-grid' aria-label='Indicadores do semestre'>
            <Stat label='Documentos pendentes' value={dashboard.counts.pending_documents} />
            <Stat label='Sessões cadastradas' value={dashboard.counts.sessions_total} />
            <Stat label='Sessões publicadas' value={dashboard.counts.published_sessions} />
            <Stat label='Estudantes alocados' value={dashboard.counts.active_allocations} />
            <Stat label='Reservas ativas' value={dashboard.counts.active_appointments} />
            <Stat label='Reservas em risco' value={dashboard.counts.at_risk_appointments} />
          </div>

          <div className='master-section-heading'>
            <div>
              <p className='eyebrow'>Todos os módulos</p>
              <h2>Ferramentas de gestão.</h2>
            </div>
            <p>Escolha uma área para abrir seus cadastros, formulários, ações e histórico.</p>
          </div>

          <div className='master-action-grid' aria-label='Módulos do perfil Master'>
            <ActionCard
              eyebrow='01 · Ensino'
              title='Semestres e estrutura acadêmica'
              description='Crie e ative períodos, cursos, disciplinas, turmas e bloqueios acadêmicos.'
              count={terms.length + courses.length + disciplines.length}
              countLabel='cadastros acadêmicos'
              path='/app/semestres'
            />
            <ActionCard
              eyebrow='02 · Pessoas'
              title='Usuários, perfis e vínculos'
              description='Gerencie acessos, perfis de estudantes e supervisores e os vínculos acadêmicos.'
              count={activeUsers}
              countLabel='usuários ativos'
              path='/app/pessoas'
            />
            <ActionCard
              eyebrow='03 · Infraestrutura'
              title='Clínicas e capacidade'
              description='Cadastre unidades, ambientes, salas, equipamentos, limites, serviços e escopos.'
              count={activeClinics}
              countLabel='clínicas ativas'
              path='/app/clinicas'
            />
            <ActionCard
              eyebrow='04 · Elegibilidade'
              title='Documentos e revisão'
              description='Defina requisitos por semestre, revise submissões e mantenha a elegibilidade operacional.'
              count={requirements.length}
              countLabel='requisitos documentais'
              path='/app/documentos'
            />
            <ActionCard
              eyebrow='05 · Agenda'
              title='Sessões e capacidade real'
              description='Crie rascunhos, acompanhe os limites calculados, publique ou cancele sessões clínicas.'
              count={activeSessions}
              countLabel='sessões publicadas'
              path='/app/sessoes-master'
            />
            <ActionCard
              eyebrow='06 · Controle'
              title='Auditoria administrativa'
              description='Consulte ator, alvo, ação e instante de cada alteração sensível do sistema.'
              count={audit?.total ?? 0}
              countLabel='eventos registrados'
              path='/app/auditoria'
            />
          </div>

          <div className='master-overview-grid'>
            <article className='private-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>Agenda próxima</p>
                  <h2>Próximas sessões.</h2>
                </div>
                <Link className='text-link' to='/app/sessoes-master'>Abrir agenda <span aria-hidden='true'>→</span></Link>
              </div>
              {dashboard.upcoming_sessions.length === 0 ? (
                <p className='field-help'>Nenhuma sessão publicada nos próximos horários.</p>
              ) : (
                <ul className='resource-list' aria-label='Próximas sessões'>
                  {dashboard.upcoming_sessions.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.service_name}</strong>
                        <small>{item.clinic_name} · {formatDateTime(item.starts_at)}</small>
                      </span>
                      <strong>{item.capacity_available} vaga{item.capacity_available === 1 ? '' : 's'}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className='private-card master-risk-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>Ação necessária</p>
                  <h2>Reservas em risco.</h2>
                </div>
                <span className='card-count'>{risk?.total ?? 0}</span>
              </div>
              {!risk || risk.items.length === 0 ? (
                <p className='field-help'>Nenhuma reserva precisa de intervenção.</p>
              ) : (
                <ul className='resource-list' aria-label='Reservas em risco'>
                  {risk.items.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.service_name}</strong>
                        <small>{item.clinic_name} · {formatDateTime(item.starts_at)}</small>
                      </span>
                      <code>{humanizeCode(item.cause)}</code>
                    </li>
                  ))}
                </ul>
              )}
              {risk && risk.total > risk.items.length && (
                <Link className='text-link master-card-link' to='/app/visao-geral'>Ver fila completa <span aria-hidden='true'>→</span></Link>
              )}
            </article>

            <article className='private-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>Inventário operacional</p>
                  <h2>O que está configurado.</h2>
                </div>
              </div>
              <dl className='master-inventory-list'>
                <div><dt>Clínicas ativas</dt><dd>{activeClinics}</dd></div>
                <div><dt>Ambientes ativos</dt><dd>{activeEnvironments}</dd></div>
                <div><dt>Salas cadastradas</dt><dd>{rooms.length}</dd></div>
                <div><dt>Cursos e disciplinas</dt><dd>{courses.length + disciplines.length}</dd></div>
                <div><dt>Requisitos documentais</dt><dd>{requirements.length}</dd></div>
              </dl>
            </article>

            <article className='private-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>Rastro recente</p>
                  <h2>Últimas alterações.</h2>
                </div>
                <Link className='text-link' to='/app/auditoria'>Ver auditoria <span aria-hidden='true'>→</span></Link>
              </div>
              {!audit || audit.items.length === 0 ? (
                <p className='field-help'>Nenhum evento registrado.</p>
              ) : (
                <ul className='resource-list' aria-label='Últimos eventos de auditoria'>
                  {audit.items.slice(0, 5).map((event) => (
                    <li key={event.id}>
                      <span>
                        <strong>{event.action}</strong>
                        <small>{event.target_type} · {formatDateTime(event.occurred_at)}</small>
                      </span>
                      <code>{event.target_id.slice(0, 8)}...</code>
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
