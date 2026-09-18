import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiDownload, apiFetch } from '../../lib/api'
import type { AuthenticatedProps } from '../academics/academics'

type Term = { id: string; name: string; status: 'DRAFT' | 'ACTIVE' | 'CLOSED' }
type Discipline = { id: string; name: string; is_active: boolean }
type Requirement = {
  id: string
  term_id: string
  discipline_id: string | null
  name: string
  expires_required: boolean
  is_active: boolean
}
type Review = {
  id: string
  requirement_id: string
  student_id: string
  student_name: string
  requirement_name: string
  original_name: string
  mime_type: string
  size_bytes: number
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
  expires_required: boolean
}

const emptyRequirement = {
  term_id: '',
  discipline_id: '',
  name: '',
  expires_required: false,
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}

function shortId(value: string) {
  return value.slice(0, 8) + '…'
}

function statusLabel(status: boolean) {
  return status ? 'Ativo' : 'Desativado'
}

export function MasterDocumentsPage({ token }: AuthenticatedProps) {
  const [terms, setTerms] = useState<Term[]>([])
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [requirementForm, setRequirementForm] = useState(emptyRequirement)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingExpires, setEditingExpires] = useState(false)
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [nextTerms, nextDisciplines, nextRequirements, nextReviews] = await Promise.all([
        apiFetch<Term[]>(token, '/terms'),
        apiFetch<Discipline[]>(token, '/disciplines'),
        apiFetch<Requirement[]>(token, '/document-requirements'),
        apiFetch<Review[]>(token, '/document-reviews?status=PENDING_REVIEW'),
      ])
      setTerms(nextTerms)
      setDisciplines(nextDisciplines)
      setRequirements(nextRequirements)
      setReviews(nextReviews)
      setRequirementForm((current) => ({
        ...current,
        term_id: current.term_id || nextTerms.find((term) => term.status !== 'CLOSED')?.id || '',
        discipline_id: current.discipline_id || nextDisciplines.find((discipline) => discipline.is_active)?.id || '',
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

  async function createRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await apiFetch<Requirement>(token, '/document-requirements', {
        method: 'POST',
        body: JSON.stringify({ ...requirementForm, discipline_id: requirementForm.discipline_id || null }),
      })
      setRequirementForm((current) => ({ ...current, name: '' }))
      setNotice('Requisito documental criado.')
      await refresh()
    } catch (submitError) {
      setError(errorMessage(submitError))
    }
  }

  function startEditing(requirement: Requirement) {
    setEditingId(requirement.id)
    setEditingName(requirement.name)
    setEditingExpires(requirement.expires_required)
    setNotice(null)
  }

  async function updateRequirement(event: FormEvent<HTMLFormElement>, requirementId: string) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await apiFetch<Requirement>(token, `/document-requirements/${requirementId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingName, expires_required: editingExpires }),
      })
      setEditingId(null)
      setNotice('Requisito documental atualizado.')
      await refresh()
    } catch (updateError) {
      setError(errorMessage(updateError))
    }
  }

  async function deactivateRequirement(requirement: Requirement) {
    if (!window.confirm(`Desativar o requisito ${requirement.name}?`)) return
    setError(null)
    setNotice(null)
    try {
      await apiFetch<void>(token, `/document-requirements/${requirement.id}/deactivate`, { method: 'POST' })
      setNotice('Requisito desativado. O histórico foi preservado.')
      await refresh()
    } catch (deactivateError) {
      setError(errorMessage(deactivateError))
    }
  }

  async function approve(reviewId: string) {
    setError(null)
    setNotice(null)
    const review = reviews.find((item) => item.id === reviewId)
    if (review?.expires_required && !expiryDates[reviewId]) {
      setError('Informe a data de validade antes de aprovar este requisito.')
      return
    }
    try {
      await apiFetch(token, `/document-submissions/${reviewId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          expires_at: expiryDates[reviewId] ? new Date(expiryDates[reviewId] + 'T23:59:59').toISOString() : null,
        }),
      })
      setNotice('Documento aprovado.')
      await refresh()
    } catch (approveError) {
      setError(errorMessage(approveError))
    }
  }

  async function reject(reviewId: string) {
    const reviewNote = notes[reviewId]?.trim() ?? ''
    if (!reviewNote) {
      setError('Informe como o estudante deve corrigir o documento.')
      return
    }
    setError(null)
    setNotice(null)
    try {
      await apiFetch(token, `/document-submissions/${reviewId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ review_note: reviewNote }),
      })
      setNotice('Documento recusado com orientação de correção.')
      await refresh()
    } catch (rejectError) {
      setError(errorMessage(rejectError))
    }
  }

  async function download(reviewId: string) {
    try {
      const blob = await apiDownload(token, `/document-submissions/${reviewId}/content`)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'documento'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(errorMessage(downloadError))
    }
  }

  function termName(id: string) {
    return terms.find((term) => term.id === id)?.name ?? shortId(id)
  }

  function disciplineName(id: string | null) {
    return id ? disciplines.find((discipline) => discipline.id === id)?.name ?? shortId(id) : 'Todos os vínculos'
  }

  return (
    <section className='private-content master-page master-documents-page' aria-labelledby='master-documents-title'>
      <p className='eyebrow'>Elegibilidade e revisão</p>
      <h1 id='master-documents-title'>Documentos.</h1>
      <p className='private-intro'>
        Defina o checklist por semestre, acompanhe as submissões e tome decisões com orientação clara para o estudante.
      </p>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status'>{notice}</p>}
      {isLoading && <p className='loading-message' role='status'>Carregando requisitos e revisões...</p>}

      {!isLoading && (
        <>
          <div className='academic-layout master-documents-layout'>
            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>01 · Configuração</p><h2>Novo requisito documental</h2></div>
                <span className='card-count'>{requirements.length}</span>
              </div>
              <p className='field-help'>Requisitos podem valer para todo o semestre ou somente para uma disciplina/estágio.</p>
              <form className='compact-form' onSubmit={createRequirement} autoComplete='off'>
                <label htmlFor='requirement-term'>Semestre</label>
                <select id='requirement-term' value={requirementForm.term_id} onChange={(event) => setRequirementForm({ ...requirementForm, term_id: event.target.value })} required>
                  <option value=''>Selecione</option>
                  {terms.filter((term) => term.status !== 'CLOSED').map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                </select>
                <label htmlFor='requirement-discipline'>Disciplina ou estágio</label>
                <select id='requirement-discipline' value={requirementForm.discipline_id} onChange={(event) => setRequirementForm({ ...requirementForm, discipline_id: event.target.value })}>
                  <option value=''>Todos os vínculos do semestre</option>
                  {disciplines.filter((discipline) => discipline.is_active).map((discipline) => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}
                </select>
                <label htmlFor='requirement-name'>Nome do requisito</label>
                <input id='requirement-name' value={requirementForm.name} onChange={(event) => setRequirementForm({ ...requirementForm, name: event.target.value })} required />
                <label className='checkbox-label'><input type='checkbox' checked={requirementForm.expires_required} onChange={(event) => setRequirementForm({ ...requirementForm, expires_required: event.target.checked })} /> Exigir data de validade na aprovação</label>
                <button className='button button-primary' type='submit'>Criar requisito</button>
              </form>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'><div><p className='eyebrow'>02 · Catálogo atual</p><h2>Requisitos configurados</h2></div></div>
              {requirements.length === 0 ? <p className='empty-state'>Nenhum requisito configurado.</p> : (
                <ul className='resource-list' aria-label='Requisitos documentais'>
                  {requirements.map((requirement) => (
                    <li key={requirement.id} className='resource-list-rich'>
                      {editingId === requirement.id ? (
                        <form className='inline-edit-form' onSubmit={(event) => void updateRequirement(event, requirement.id)}>
                          <label htmlFor={`edit-requirement-${requirement.id}`}>Nome</label>
                          <input id={`edit-requirement-${requirement.id}`} value={editingName} onChange={(event) => setEditingName(event.target.value)} required />
                          <label className='checkbox-label'><input type='checkbox' checked={editingExpires} onChange={(event) => setEditingExpires(event.target.checked)} /> Exige validade</label>
                          <span className='resource-actions'><button className='button button-secondary' type='submit'>Salvar</button><button className='text-button' type='button' onClick={() => setEditingId(null)}>Cancelar</button></span>
                        </form>
                      ) : (
                        <>
                          <span><strong>{requirement.name}</strong><small>{termName(requirement.term_id)} · {disciplineName(requirement.discipline_id)} · {statusLabel(requirement.is_active)}{requirement.expires_required ? ' · validade obrigatória' : ''}</small></span>
                          <span className='resource-actions'><button className='text-button' type='button' onClick={() => startEditing(requirement)}>Editar</button>{requirement.is_active && <button className='text-button' type='button' onClick={() => void deactivateRequirement(requirement)}>Desativar</button>}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link className='text-link master-card-link' to='/app/semestres'>Revisar configuração acadêmica <span aria-hidden='true'>→</span></Link>
            </article>
          </div>

          <section className='master-review-section' aria-labelledby='master-review-title'>
            <div className='master-section-heading'>
              <div><p className='eyebrow'>03 · Fila de trabalho</p><h2 id='master-review-title'>Submissões pendentes.</h2></div>
              <p>O Master pode revisar qualquer submissão. Aprovações com validade e recusas com orientação ficam registradas pela API.</p>
            </div>
            {reviews.length === 0 ? <p className='empty-state'>Nenhuma submissão pendente de revisão.</p> : (
              <div className='document-grid'>
                {reviews.map((review) => (
                  <article className='private-card document-card' key={review.id}>
                    <div className='card-heading'>
                      <div><p className='eyebrow'>Estudante</p><h2>{review.student_name}</h2></div>
                      <span className='status-pill document-status-pending_review'>Em revisão</span>
                    </div>
                    <p className='document-meta'><strong>{review.requirement_name}</strong> · {review.original_name} · {Math.ceil(review.size_bytes / 1024)} KB</p>
                    <div className='review-actions'>
                      <button className='text-button' type='button' onClick={() => void download(review.id)}>Baixar arquivo</button>
                      <label htmlFor={`master-expiry-${review.id}`}>Validade {review.expires_required ? 'obrigatoria' : 'opcional'}</label>
                      <input id={`master-expiry-${review.id}`} type='date' required={review.expires_required} value={expiryDates[review.id] ?? ''} onChange={(event) => setExpiryDates((current) => ({ ...current, [review.id]: event.target.value }))} />
                      <button className='button button-primary' type='button' onClick={() => void approve(review.id)}>Aprovar</button>
                    </div>
                    <label htmlFor={`master-note-${review.id}`}>Orientação em caso de recusa</label>
                    <textarea id={`master-note-${review.id}`} value={notes[review.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))} rows={3} />
                    <button className='text-button' type='button' onClick={() => void reject(review.id)}>Recusar com orientação</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
