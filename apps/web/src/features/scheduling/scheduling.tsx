import { useMemo, useState, type FormEvent } from 'react'
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

type SupervisorSessionOption = {
  id: string
  supervisor_id: string
  term_id: string
  term_name: string
  term_status: string
  term_starts_on: string
  term_ends_on: string
  service_id: string
  service_name: string
  duration_minutes: number
  clinic_id: string
  clinic_name: string
  environment_id: string
  environment_name: string
  max_students_default: number
  max_students_override: number | null
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
  option_id: string
  session_date: string
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
  option_id: '',
  session_date: '',
  starts_at: '',
  ends_at: '',
  max_students_override: '',
}

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
})
const startTimeOptions = timeOptions.slice(0, -1)

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

function localDateTimeWithOffset(date: string, time: string): string {
  if (!date || !time) return ''
  return `${date}T${time}:00-03:00`
}

function localInputPart(value: string, part: 'date' | 'time'): string {
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
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, item) => {
      result[item.type] = item.value
      return result
    }, {})
  if (part === 'date') return `${parts.year}-${parts.month}-${parts.day}`
  return `${parts.hour}:${parts.minute}`
}

function optionLimit(option: SupervisorSessionOption): number {
  return Math.min(
    option.max_students_default,
    option.max_students_override ?? option.max_students_default,
  )
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
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const optionsQuery = useQuery({
    queryKey: ['session-options', token],
    queryFn: () => apiFetch<SupervisorSessionOption[]>(token, '/me/session-options'),
    retry: false,
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions', token],
    queryFn: () => apiFetch<Session[]>(token, '/sessions'),
    retry: false,
  })

  const options = optionsQuery.data ?? []
  const sessions = sessionsQuery.data ?? []
  const selectedOption = useMemo(
    () => options.find((option) => option.id === form.option_id) ?? null,
    [form.option_id, options],
  )
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

  const updateMutation = useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: string; payload: SessionCreatePayload }) =>
      apiFetch<Session>(token, `/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setForm(initialForm)
      setEditingSessionId(null)
      setNotice('Rascunho atualizado.')
      setOperationError(null)
      await queryClient.invalidateQueries({ queryKey: ['sessions', token] })
      await queryClient.invalidateQueries({ queryKey: ['session-capacity', token] })
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

  function updateForm(changes: Partial<SessionForm>) {
    setForm((current) => ({ ...current, ...changes }))
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOperationError(null)
    setNotice(null)
    if (!selectedOption) {
      setOperationError('Selecione uma configuração autorizada.')
      return
    }
    const payload: SessionCreatePayload = {
      term_id: selectedOption.term_id,
      service_id: selectedOption.service_id,
      clinic_id: selectedOption.clinic_id,
      environment_id: selectedOption.environment_id,
      supervisor_id: selectedOption.supervisor_id,
      starts_at: localDateTimeWithOffset(form.session_date, form.starts_at),
      ends_at: localDateTimeWithOffset(form.session_date, form.ends_at),
      max_students_override: form.max_students_override.trim()
        ? Number(form.max_students_override)
        : null,
    }
    if (!payload.starts_at || !payload.ends_at) {
      setOperationError('Informe a data, o início e o fim da sessão.')
      return
    }
    if (editingSessionId) {
      updateMutation.mutate({ sessionId: editingSessionId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function startEditing(session: Session) {
    const matchingOption = options.find(
      (option) =>
        option.term_id === session.term_id &&
        option.service_id === session.service_id &&
        option.clinic_id === session.clinic_id &&
        option.environment_id === session.environment_id &&
        option.supervisor_id === session.supervisor_id,
    )
    if (!matchingOption) {
      setOperationError('A configuração desta sessão não está mais disponível para edição.')
      return
    }
    setEditingSessionId(session.id)
    setForm({
      option_id: matchingOption.id,
      session_date: localInputPart(session.starts_at, 'date'),
      starts_at: localInputPart(session.starts_at, 'time'),
      ends_at: localInputPart(session.ends_at, 'time'),
      max_students_override: session.max_students_override?.toString() ?? '',
    })
    setNotice(null)
    setOperationError(null)
  }

  function cancelEditing() {
    setEditingSessionId(null)
    setForm(initialForm)
    setNotice(null)
    setOperationError(null)
  }

  function handleAction(sessionId: string, action: SessionAction) {
    setOperationError(null)
    setNotice(null)
    actionMutation.mutate({ sessionId, action })
  }

  const queryError = optionsQuery.error ?? sessionsQuery.error
  const mutationError = createMutation.error ?? updateMutation.error ?? actionMutation.error
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
              Escolha uma configuração já autorizada. O servidor valida recursos,
              disponibilidade e capacidade antes de salvar.
            </p>
            <form className='compact-form' onSubmit={handleFormSubmit} autoComplete='off'>
              <label htmlFor='session-option'>Configuração autorizada</label>
              <select
                id='session-option'
                name='option_id'
                required
                value={form.option_id}
                onChange={(event) => updateForm({ option_id: event.target.value })}
                disabled={optionsQuery.isPending || options.length === 0}
                aria-describedby='session-options-help'
              >
                <option value=''>
                  {optionsQuery.isPending
                    ? 'Carregando configurações…'
                    : 'Selecione serviço, clínica e semestre'}
                </option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.service_name} · {option.clinic_name} · {option.environment_name} · {option.term_name}
                  </option>
                ))}
              </select>
              <p id='session-options-help' className='field-help'>
                Os nomes vêm do seu escopo de supervisão; nenhum UUID é necessário.
              </p>
              {selectedOption && (
                <p className='selection-summary'>
                  {selectedOption.service_name} dura {selectedOption.duration_minutes} min · limite de até {optionLimit(selectedOption)} estudante{optionLimit(selectedOption) === 1 ? '' : 's'}.
                </p>
              )}

              <div className='form-grid'>
                <div>
                  <label htmlFor='session-date'>Data da sessão</label>
                  <input
                    id='session-date'
                    name='session_date'
                    type='date'
                    required
                    value={form.session_date}
                    onChange={(event) => updateForm({ session_date: event.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor='session-starts-at'>Início</label>
                  <select
                    id='session-starts-at'
                    name='starts_at'
                    required
                    value={form.starts_at}
                    onChange={(event) => {
                      const startsAt = event.target.value
                      updateForm({
                        starts_at: startsAt,
                        ends_at: form.ends_at && form.ends_at > startsAt ? form.ends_at : '',
                      })
                    }}
                  >
                    <option value=''>Selecione o início</option>
                    {startTimeOptions.map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor='session-ends-at'>Fim</label>
                  <select
                    id='session-ends-at'
                    name='ends_at'
                    required
                    value={form.ends_at}
                    disabled={!form.starts_at}
                    onChange={(event) => updateForm({ ends_at: event.target.value })}
                  >
                    <option value=''>
                      {form.starts_at ? 'Selecione o fim' : 'Selecione o início primeiro'}
                    </option>
                    {timeOptions
                      .filter((time) => time > form.starts_at)
                      .map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
              </div>
              <p className='field-help'>
                Escolha um intervalo que cubra sua disponibilidade. Horários usam o fuso America/Sao_Paulo.
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
                onChange={(event) => updateForm({ max_students_override: event.target.value })}
              />
              <p className='field-help'>Deixe vazio para usar o limite configurado no escopo do supervisor.</p>

              <button
                className='button button-primary'
                type='submit'
                disabled={createMutation.isPending || updateMutation.isPending || options.length === 0}
              >
                {createMutation.isPending ? 'Criando…' : updateMutation.isPending ? 'Salvando…' : editingSessionId ? 'Salvar alterações' : 'Criar sessão'}
              </button>
              {editingSessionId && (
                <button className='text-button' type='button' onClick={cancelEditing}>
                  Cancelar edição
                </button>
              )}
            </form>
            {!optionsQuery.isPending && !optionsQuery.isError && options.length === 0 && (
              <p className='empty-state'>Nenhuma configuração disponível. Peça ao Master para liberar um escopo de supervisão.</p>
            )}
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
                  const context = options.find(
                    (option) =>
                      option.term_id === session.term_id &&
                      option.service_id === session.service_id &&
                      option.clinic_id === session.clinic_id &&
                      option.environment_id === session.environment_id &&
                      option.supervisor_id === session.supervisor_id,
                  )
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
                          Até {formatDateTime(session.ends_at)}
                        </p>
                        <dl className='field-help'>
                          <div><dt>Semestre</dt><dd>{context?.term_name ?? 'Configuração anterior'}</dd></div>
                          <div><dt>Serviço</dt><dd>{context?.service_name ?? 'Serviço não disponível'}</dd></div>
                          <div><dt>Local</dt><dd>{context ? `${context.clinic_name} · ${context.environment_name}` : 'Local não disponível'}</dd></div>
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
                              className='button button-secondary'
                              type='button'
                              disabled={updateMutation.isPending || actionMutation.isPending}
                              onClick={() => startEditing(session)}
                            >
                              Editar rascunho
                            </button>
                          )}
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
