import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuthenticatedProps } from '../academics/academics'
import { apiFetch } from '../../lib/api'

type StudentSessionStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED' | string

export type StudentSession = {
  id: string
  term_id: string
  term_name: string
  service_id: string
  service_name: string
  clinic_id: string
  clinic_name: string
  environment_id: string
  environment_name: string
  supervisor_id: string
  supervisor_name: string
  starts_at: string
  ends_at: string
  status: StudentSessionStatus
  allocation_id: string | null
  allocation_status: string | null
  can_join: boolean
  blocked_code: string | null
  blocked_message: string | null
}

type PendingAction = { id: string; action: 'join' | 'cancel' } | null

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  timeZone: 'America/Sao_Paulo',
})
const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data inválida' : dateFormatter.format(date)
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Hora inválida' : timeFormatter.format(date)
}

function formatStatus(status: StudentSessionStatus): string {
  if (status === 'DRAFT') return 'Inscrições abertas'
  if (status === 'PUBLISHED') return 'Confirmada'
  if (status === 'COMPLETED') return 'Concluída'
  if (status === 'CANCELLED') return 'Cancelada'
  return status
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function StudentSessionCard({
  item,
  pendingAction,
  pendingCancel,
  onJoin,
  onRequestCancel,
  onConfirmCancel,
  onKeepAllocation,
}: {
  item: StudentSession
  pendingAction: PendingAction
  pendingCancel: boolean
  onJoin: (item: StudentSession) => void
  onRequestCancel: (item: StudentSession) => void
  onConfirmCancel: (item: StudentSession) => void
  onKeepAllocation: () => void
}) {
  const isAllocated = item.allocation_id !== null
  const isJoining = pendingAction?.id === item.id && pendingAction.action === 'join'
  const isCancelling = pendingAction?.id === item.id && pendingAction.action === 'cancel'

  return (
    <article className='private-card student-session-card' aria-labelledby={`student-session-${item.id}`}>
      <div className='card-heading'>
        <div>
          <p className='eyebrow'>{formatStatus(item.status)}</p>
          <h3 id={`student-session-${item.id}`}>{formatDate(item.starts_at)}</h3>
        </div>
        <span className={`status-pill ${isAllocated ? 'status-active' : item.can_join ? 'status-draft' : 'status-closed'}`}>
          {isAllocated ? (item.allocation_status === 'SUSPENDED' ? 'Suspensa' : 'Inscrito') : item.can_join ? 'Disponível' : 'Bloqueada'}
        </span>
      </div>
      <p className='student-session-time'>
        {formatTime(item.starts_at)} – {formatTime(item.ends_at)}
      </p>
      <dl className='student-session-details'>
        <div><dt>Serviço</dt><dd>{item.service_name}</dd></div>
        <div><dt>Local</dt><dd>{item.clinic_name} · {item.environment_name}</dd></div>
        <div><dt>Supervisor</dt><dd>{item.supervisor_name}</dd></div>
        <div><dt>Semestre</dt><dd>{item.term_name}</dd></div>
      </dl>

      {item.blocked_code && (
        <p className='session-blocked-message' role='status'>
          <strong>{item.blocked_code}</strong> · {item.blocked_message}
        </p>
      )}

      <div className='resource-actions'>
        {item.can_join && (
          <button
            className='button button-primary'
            type='button'
            disabled={pendingAction !== null}
            onClick={() => onJoin(item)}
          >
            {isJoining ? 'Entrando…' : 'Participar desta sessão'}
          </button>
        )}
        {!item.can_join && !isAllocated && (
          <button className='button button-secondary' type='button' disabled>
            Participar desta sessão
          </button>
        )}
        {isAllocated && !pendingCancel && item.status !== 'CANCELLED' && (
          <button
            className='text-button'
            type='button'
            disabled={pendingAction !== null}
            onClick={() => onRequestCancel(item)}
          >
            Sair da sessão
          </button>
        )}
        {pendingCancel && (
          <div className='resource-actions' role='group' aria-label='Confirmar saída da sessão'>
            <span className='field-help'>Remover sua participação?</span>
            <button
              className='button button-secondary'
              type='button'
              disabled={pendingAction !== null}
              onClick={() => onConfirmCancel(item)}
            >
              {isCancelling ? 'Saindo…' : 'Confirmar saída'}
            </button>
            <button className='text-button' type='button' disabled={pendingAction !== null} onClick={onKeepAllocation}>
              Manter participação
            </button>
          </div>
        )}
        {item.blocked_code === 'DOCUMENTS_PENDING' && (
          <Link className='text-link' to='/app/documentos'>
            Revisar documentos <span aria-hidden='true'>→</span>
          </Link>
        )}
      </div>
    </article>
  )
}

function StudentSessionsContent({ token }: AuthenticatedProps) {
  const [sessions, setSessions] = useState<StudentSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await apiFetch<StudentSession[]>(token, '/me/available-sessions')
      setSessions(result)
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const allocatedSessions = useMemo(
    () => sessions.filter((item) => item.allocation_id !== null),
    [sessions],
  )
  const availableSessions = useMemo(
    () => sessions.filter((item) => item.allocation_id === null),
    [sessions],
  )

  async function joinSession(item: StudentSession) {
    setPendingAction({ id: item.id, action: 'join' })
    setError(null)
    setNotice(null)
    try {
      await apiFetch(token, `/sessions/${item.id}/allocations`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setNotice('Inscrição realizada. A sessão agora aparece em Minhas sessões.')
      await refresh()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setPendingAction(null)
    }
  }

  async function cancelSession(item: StudentSession) {
    if (!item.allocation_id) return
    setPendingAction({ id: item.id, action: 'cancel' })
    setError(null)
    setNotice(null)
    try {
      await apiFetch(token, `/sessions/${item.id}/allocations/${item.allocation_id}`, {
        method: 'DELETE',
      })
      setPendingCancelId(null)
      setNotice('Participação removida.')
      await refresh()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setPendingAction(null)
    }
  }

  function requestCancel(item: StudentSession) {
    setPendingCancelId(item.id)
    setNotice(null)
    setError(null)
  }

  return (
    <section className='private-content student-sessions-page' aria-labelledby='student-sessions-page-title'>
      <p className='eyebrow'>Prática supervisionada</p>
      <h1 id='student-sessions-page-title'>Minhas sessões</h1>
      <p className='private-intro'>
        Acompanhe seus horários e escolha uma oportunidade compatível quando sua documentação e disponibilidade estiverem prontas.
      </p>

      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status' aria-live='polite'>{notice}</p>}

      <div className='student-session-toolbar'>
        <p className='field-help'>Os bloqueios são avaliados pelo servidor e vêm acompanhados do próximo passo.</p>
        <button className='button button-secondary' type='button' onClick={() => void refresh()} disabled={isLoading}>
          {isLoading ? 'Atualizando…' : 'Atualizar lista'}
        </button>
      </div>

      {isLoading && <p className='loading-message' role='status'>Carregando sessões…</p>}
      {!isLoading && !error && (
        <>
          <section className='student-session-section' aria-labelledby='my-sessions-heading'>
            <div className='card-heading'>
              <div>
                <p className='eyebrow'>Acompanhamento</p>
                <h2 id='my-sessions-heading'>Minhas sessões</h2>
              </div>
              <span className='card-count'>{allocatedSessions.length}</span>
            </div>
            {allocatedSessions.length === 0 ? (
              <p className='empty-state'>Você ainda não está inscrito em uma sessão futura.</p>
            ) : (
              <div className='student-session-grid'>
                {allocatedSessions.map((item) => (
                  <StudentSessionCard
                    item={item}
                    key={item.id}
                    pendingAction={pendingAction}
                    pendingCancel={pendingCancelId === item.id}
                    onJoin={joinSession}
                    onRequestCancel={requestCancel}
                    onConfirmCancel={cancelSession}
                    onKeepAllocation={() => setPendingCancelId(null)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className='student-session-section' aria-labelledby='available-sessions-heading'>
            <div className='card-heading'>
              <div>
                <p className='eyebrow'>Próximo passo</p>
                <h2 id='available-sessions-heading'>Oportunidades para participar</h2>
              </div>
              <span className='card-count'>{availableSessions.length}</span>
            </div>
            {availableSessions.length === 0 ? (
              <p className='empty-state'>Nenhuma sessão aberta foi encontrada para o seu semestre.</p>
            ) : (
              <div className='student-session-grid'>
                {availableSessions.map((item) => (
                  <StudentSessionCard
                    item={item}
                    key={item.id}
                    pendingAction={pendingAction}
                    pendingCancel={false}
                    onJoin={joinSession}
                    onRequestCancel={requestCancel}
                    onConfirmCancel={cancelSession}
                    onKeepAllocation={() => setPendingCancelId(null)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}

export function StudentSessionsPage({ token }: AuthenticatedProps) {
  return <StudentSessionsContent token={token} />
}
