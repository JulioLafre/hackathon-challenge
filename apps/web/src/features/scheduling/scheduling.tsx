import { useState, type FormEvent } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { AuthenticatedProps } from '../academics/academics'
import { apiFetch } from '../../lib/api'

type SessionStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED' | string

type CapacityFactor =
  | 'eligible_students'
  | 'supervision'
  | 'rooms'
  | 'equipment'
  | 'clinic_appointments'

type CapacityExplanation = {
  effective: number
  constraints: Record<string, number>
  limiting_factors: string[]
}

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
  status: SessionStatus
  capacity_explanation: CapacityExplanation | null
}

type SessionCreatePayload = {
  term_id: string
  service_id: string
  clinic_id: string
  environment_id: string
  supervisor_id: string
  starts_at: string
  ends_at: string
  max_students_override: number | null
}

type SessionForm = {
  term_id: string
  service_id: string
  clinic_id: string
  environment_id: string
  supervisor_id: string
  starts_at: string
  ends_at: string
  max_students_override: string
}

type SessionAction = 'publish' | 'cancel'

type ActionVariables = {
  sessionId: string
  action: SessionAction
}

const initialForm: SessionForm = {
  term_id: '',
  service_id: '',
  clinic_id: '',
  environment_id: '',
  supervisor_id: '',
  starts_at: '',
  ends_at: '',
  max_students_override: '',
}

const capacityFactors: readonly CapacityFactor[] = [
  'eligible_students',
  'supervision',
  'rooms',
  'equipment',
  'clinic_appointments',
]

const capacityFactorLabels: Record<CapacityFactor, string> = {
  eligible_students: 'Estudantes elegíveis alocados',
  supervision: 'Limite de supervisão',
  rooms: 'Salas disponíveis',
  equipment: 'Equipamentos disponíveis',
  clinic_appointments: 'Capacidade da clínica',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Concluída',
}

const numberFormatter = new Intl.NumberFormat('pt-BR')
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data inválida' : dateTimeFormatter.format(date)
}

function formatStatus(status: SessionStatus): string {
  return statusLabels[status] ?? status
}

function statusClass(status: SessionStatus): string {
  if (status === 'DRAFT') return 'status-draft'
  if (status === 'PUBLISHED') return 'status-active'
  return 'status-closed'
}

function localDateTimeWithOffset(value: string): string {
  if (!value || value.includes('+') || /Z$/i.test(value)) return value
  return value.length === 16 ? `${value}:00-03:00` : value
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const candidate = error as {
    code?: unknown
    error?: { code?: unknown }
  }
  if (typeof candidate.code === 'string') return candidate.code
  return typeof candidate.error?.code === 'string' ? candidate.error.code : null
}

function errorMessage(error: unknown, fallback: string): string {
  const code = errorCode(error)
  if (code === 'INVALID_TOKEN') {
    return 'Sua sessão expirou. Entre novamente para continuar.'
  }
  const message = error instanceof Error ? error.message : ''
  if (code && message) return `${code}: ${message}`
  return message || fallback
}

function CapacityExplanationView({
  capacity,
  sessionId,
}: {
  capacity: CapacityExplanation
  sessionId: string
}) {
  return (
    <div aria-labelledby={`capacity-title-${sessionId}`}>
      <div className='card-heading'>
        <div>
          <p className='eyebrow'>Capacidade efetiva</p>
          <h3 id={`capacity-title-${sessionId}`}>
            {formatNumber(capacity.effective)} atendimento{capacity.effective === 1 ? '' : 's'} simultâneo{capacity.effective === 1 ? '' : 's'}
          </h3>
        </div>
        {capacity.effective > 0 && (
          <span className='status-pill status-active'>Viável</span>
        )}
      </div>
      <p className='field-help'>
        O servidor calcula a capacidade pelo menor limite retornado para esta sessão.
      </p>
      <ul className='resource-list' aria-label='Limites de capacidade'>
        {capacityFactors.map((factor) => {
          const isLimiting = capacity.limiting_factors.includes(factor)
          const value = capacity.constraints[factor]
          return (
            <li key={factor}>
              <span>
                <strong>{capacityFactorLabels[factor]}</strong>
                {isLimiting && <small>Fator limitante</small>}
              </span>
              <strong>{typeof value === 'number' ? formatNumber(value) : '—'}</strong>
            </li>
          )
        })}
      </ul>
      <p className='field-help'>
        {capacity.limiting_factors.length > 0
          ? `Fatores limitantes: ${capacity.limiting_factors
              .map((factor) => capacityFactorLabels[factor as CapacityFactor] ?? factor)
              .join(', ')}.`
          : 'Nenhum fator limitante foi informado pela API.'}
      </p>
    </div>
  )
}

function SchedulingContent({ token }: AuthenticatedProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SessionForm>(initialForm)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const sessionsQuery = useQuery({
    queryKey: ['sessions', token],
    queryFn: () => apiFetch<Session[]>(token, '/sessions'),
    retry: false,
  })

  const sessions = sessionsQuery.data ?? []
  const capacityQueries = useQueries({
    queries: sessions.map((session) => ({
      queryKey: ['session-capacity', token, session.id],
      queryFn: () =>
        apiFetch<CapacityExplanation>(token, `/sessions/${session.id}/capacity`),
      retry: false,
    })),
  })

  const createMutation = useMutation({
    mutationFn: (payload: SessionCreatePayload) =>
      apiFetch<Session>(token, '/sessions', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setForm(initialForm)
      setNotice('Sessão criada como rascunho.')
      setOperationError(null)
      await queryClient.invalidateQueries({ queryKey: ['sessions', token] })
    },
  })

  const actionMutation = useMutation({
    mutationFn: ({ sessionId, action }: ActionVariables) =>
      apiFetch<Session>(token, `/sessions/${sessionId}/${action}`, {
        method: 'POST',
      }),
    onSuccess: async (session, variables) => {
      setPendingCancelId(null)
      setNotice(
        variables.action === 'publish'
          ? 'Sessão publicada e horários gerados pela API.'
          : 'Sessão cancelada.',
      )
      setOperationError(null)
      await queryClient.invalidateQueries({ queryKey: ['sessions', token] })
      await queryClient.invalidateQueries({
        queryKey: ['session-capacity', token, session.id],
      })
    },
  })

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOperationError(null)
    setNotice(null)
    createMutation.mutate({
      term_id: form.term_id.trim(),
      service_id: form.service_id.trim(),
      clinic_id: form.clinic_id.trim(),
      environment_id: form.environment_id.trim(),
      supervisor_id: form.supervisor_id.trim(),
      starts_at: localDateTimeWithOffset(form.starts_at),
      ends_at: localDateTimeWithOffset(form.ends_at),
      max_students_override: form.max_students_override
        ? Number(form.max_students_override)
        : null,
    })
  }

  function handleAction(sessionId: string, action: SessionAction) {
    setOperationError(null)
    setNotice(null)
    actionMutation.mutate({ sessionId, action })
  }

  const queryError = sessionsQuery.error
  const mutationError = createMutation.error ?? actionMutation.error
  const pageError = queryError ?? mutationError ?? operationError

  return (
    <section className='private-content scheduling-page' aria-labelledby='scheduling-page-title'>
      <p className='eyebrow'>Operação clínica</p>
      <h1 id='scheduling-page-title'>Sessões clínicas</h1>
      <p className='private-intro'>
        Crie sessões datadas, acompanhe os limites retornados pelo servidor e publique somente quando houver capacidade real.
      </p>

      {pageError && (
        <p className='form-error' role='alert'>
          {typeof pageError === 'string'
            ? pageError
            : errorMessage(pageError, 'Não foi possível concluir a operação. Verifique seu acesso e tente novamente.')}
        </p>
      )}
      {notice && <p className='form-notice' role='status' aria-live='polite'>{notice}</p>}

      <div className='academic-layout'>
        <div className='academic-column'>
          <article className='private-card academic-card'>
            <div className='card-heading'>
              <div>
                <p className='eyebrow'>01 · Nova sessão</p>
                <h2>Dados do atendimento</h2>
              </div>
            </div>
            <p className='field-help'>
              Informe os identificadores UUID da configuração existente. A API valida escopo, recursos e disponibilidade.
            </p>
            <form className='compact-form' onSubmit={handleFormSubmit} autoComplete='off'>
              <label htmlFor='session-term-id'>ID do semestre</label>
              <input
                id='session-term-id'
                name='term_id'
                required
                value={form.term_id}
                onChange={(event) => setForm({ ...form, term_id: event.target.value })}
                aria-describedby='session-ids-help'
              />

              <label htmlFor='session-service-id'>ID do serviço</label>
              <input
                id='session-service-id'
                name='service_id'
                required
                value={form.service_id}
                onChange={(event) => setForm({ ...form, service_id: event.target.value })}
                aria-describedby='session-ids-help'
              />

              <label htmlFor='session-clinic-id'>ID da clínica</label>
              <input
                id='session-clinic-id'
                name='clinic_id'
                required
                value={form.clinic_id}
                onChange={(event) => setForm({ ...form, clinic_id: event.target.value })}
                aria-describedby='session-ids-help'
              />

              <label htmlFor='session-environment-id'>ID do ambiente</label>
              <input
                id='session-environment-id'
                name='environment_id'
                required
                value={form.environment_id}
                onChange={(event) => setForm({ ...form, environment_id: event.target.value })}
                aria-describedby='session-ids-help'
              />

              <label htmlFor='session-supervisor-id'>ID do supervisor</label>
              <input
                id='session-supervisor-id'
                name='supervisor_id'
                required
                value={form.supervisor_id}
                onChange={(event) => setForm({ ...form, supervisor_id: event.target.value })}
                aria-describedby='session-ids-help'
              />
              <p id='session-ids-help' className='field-help'>
                IDs são aceitos exatamente como definidos no contrato da API.
              </p>

              <div className='form-grid'>
                <div>
                  <label htmlFor='session-starts-at'>Início</label>
                  <input
                    id='session-starts-at'
                    name='starts_at'
                    type='datetime-local'
                    step='60'
                    required
                    value={form.starts_at}
                    onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor='session-ends-at'>Fim</label>
                  <input
                    id='session-ends-at'
                    name='ends_at'
                    type='datetime-local'
                    step='60'
                    required
                    value={form.ends_at}
                    onChange={(event) => setForm({ ...form, ends_at: event.target.value })}
                  />
                </div>
              </div>
              <p className='field-help'>
                Horários são enviados com o offset institucional de America/Sao_Paulo.
              </p>

              <label htmlFor='session-max-students'>Limite opcional de estudantes</label>
              <input
                id='session-max-students'
                name='max_students_override'
                type='number'
                min='1'
                max='10000'
                inputMode='numeric'
                value={form.max_students_override}
                onChange={(event) => setForm({ ...form, max_students_override: event.target.value })}
              />
              <p className='field-help'>Deixe vazio para usar o limite configurado no escopo do supervisor.</p>

              <button className='button button-primary' type='submit' disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando…' : 'Criar sessão'}
              </button>
            </form>
          </article>
        </div>

        <div className='academic-column'>
          <article className='private-card academic-card'>
            <div className='card-heading'>
              <div>
                <p className='eyebrow'>02 · Acompanhamento</p>
                <h2 id='sessions-heading'>Sessões cadastradas</h2>
              </div>
              {!sessionsQuery.isPending && <span className='card-count'>{sessions.length}</span>}
            </div>

            {sessionsQuery.isPending && (
              <p className='loading-message' role='status'>Carregando sessões…</p>
            )}
            {!sessionsQuery.isPending && !sessionsQuery.isError && sessions.length === 0 && (
              <p className='field-help'>Nenhuma sessão foi criada ainda.</p>
            )}
            {!sessionsQuery.isPending && !sessionsQuery.isError && sessions.length > 0 && (
              <ul className='resource-list' aria-labelledby='sessions-heading'>
                {sessions.map((session, index) => {
                  const capacityQuery = capacityQueries[index]
                  const capacity = capacityQuery.data ?? session.capacity_explanation
                  const isPublishing =
                    actionMutation.isPending &&
                    actionMutation.variables?.sessionId === session.id &&
                    actionMutation.variables.action === 'publish'
                  const isCancelling =
                    actionMutation.isPending &&
                    actionMutation.variables?.sessionId === session.id &&
                    actionMutation.variables.action === 'cancel'

                  return (
                    <li key={session.id}>
                      <article className='private-card academic-card' aria-labelledby={`session-title-${session.id}`}>
                        <div className='card-heading'>
                          <div>
                            <p className='eyebrow'>Sessão {index + 1}</p>
                            <h3 id={`session-title-${session.id}`}>{formatDateTime(session.starts_at)}</h3>
                          </div>
                          <span className={`status-pill ${statusClass(session.status)}`}>
                            {formatStatus(session.status)}
                          </span>
                        </div>
                        <p className='field-help'>
                          Até {formatDateTime(session.ends_at)} · ID <code>{session.id}</code>
                        </p>
                        <dl className='field-help'>
                          <div><dt>Semestre</dt><dd><code>{session.term_id}</code></dd></div>
                          <div><dt>Serviço</dt><dd><code>{session.service_id}</code></dd></div>
                          <div><dt>Clínica</dt><dd><code>{session.clinic_id}</code></dd></div>
                          <div><dt>Ambiente</dt><dd><code>{session.environment_id}</code></dd></div>
                          <div><dt>Supervisor</dt><dd><code>{session.supervisor_id}</code></dd></div>
                        </dl>

                        <div className='form-divider'>
                          {capacityQuery?.isPending && (
                            <p className='loading-message' role='status'>Carregando capacidade…</p>
                          )}
                          {capacityQuery?.isError && !capacity && (
                            <p className='form-error' role='alert'>
                              {errorMessage(capacityQuery.error, 'Não foi possível consultar a capacidade. Tente novamente.')}
                            </p>
                          )}
                          {capacity && <CapacityExplanationView capacity={capacity} sessionId={session.id} />}
                          {!capacityQuery?.isPending && !capacityQuery?.isError && !capacity && (
                            <p className='field-help'>A API ainda não retornou uma explicação de capacidade.</p>
                          )}
                        </div>

                        <div className='resource-actions' aria-label={`Ações da sessão ${index + 1}`}>
                          {session.status === 'DRAFT' && (
                            <button
                              className='button button-primary'
                              type='button'
                              disabled={actionMutation.isPending}
                              onClick={() => handleAction(session.id, 'publish')}
                            >
                              {isPublishing ? 'Publicando…' : 'Publicar sessão'}
                            </button>
                          )}
                          {session.status !== 'CANCELLED' && session.status !== 'COMPLETED' && pendingCancelId !== session.id && (
                            <button
                              className='text-button'
                              type='button'
                              disabled={actionMutation.isPending}
                              onClick={() => {
                                setNotice(null)
                                setOperationError(null)
                                setPendingCancelId(session.id)
                              }}
                            >
                              Cancelar sessão
                            </button>
                          )}
                          {pendingCancelId === session.id && (
                            <div className='resource-actions' role='group' aria-label='Confirmar cancelamento'>
                              <span className='field-help'>Essa ação encerra a sessão. Confirmar?</span>
                              <button
                                className='button button-secondary'
                                type='button'
                                disabled={actionMutation.isPending}
                                onClick={() => handleAction(session.id, 'cancel')}
                              >
                                {isCancelling ? 'Cancelando…' : 'Confirmar cancelamento'}
                              </button>
                              <button
                                className='text-button'
                                type='button'
                                disabled={actionMutation.isPending}
                                onClick={() => setPendingCancelId(null)}
                              >
                                Manter sessão
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}

export function SchedulingPage({ token }: AuthenticatedProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SchedulingContent token={token} />
    </QueryClientProvider>
  )
}

export const SessionAdminPage = SchedulingPage
