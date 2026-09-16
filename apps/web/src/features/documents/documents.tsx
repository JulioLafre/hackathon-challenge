import { useEffect, useState, type FormEvent } from 'react'
import { apiDownload, apiFetch } from '../../lib/api'
import type { AuthenticatedProps } from '../academics/academics'

type Term = {
  id: string
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
}

type ChecklistItem = {
  requirement_id: string
  name: string
  discipline_id: string | null
  status: 'MISSING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
  review_note: string | null
  expires_at: string | null
  latest_submission_id: string | null
}

type Checklist = {
  term_id: string
  eligible: boolean
  pending_requirement_ids: string[]
  items: ChecklistItem[]
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
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nao foi possivel concluir a operacao.'
}

function statusLabel(status: ChecklistItem['status']): string {
  return {
    MISSING: 'Ausente',
    PENDING_REVIEW: 'Em revisao',
    APPROVED: 'Aprovado',
    REJECTED: 'Recusado',
    EXPIRED: 'Expirado',
  }[status]
}

function statusClass(status: ChecklistItem['status']): string {
  return 'status-pill document-status-' + status.toLowerCase()
}

export function StudentDocumentsPage({ token }: AuthenticatedProps) {
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState('')
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    apiFetch<Term[]>(token, '/me/academic-terms')
      .then((response) => {
        if (cancelled) return
        setTerms(response)
        setTermId(response.find((term) => term.status === 'ACTIVE')?.id ?? response[0]?.id ?? '')
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!termId) return
    let cancelled = false
    setError(null)
    apiFetch<Checklist>(token, '/me/document-requirements?term_id=' + termId)
      .then((response) => {
        if (!cancelled) setChecklist(response)
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError))
      })
    return () => {
      cancelled = true
    }
  }, [termId, token])

  async function refreshChecklist() {
    if (!termId) return
    const response = await apiFetch<Checklist>(
      token,
      '/me/document-requirements?term_id=' + termId,
    )
    setChecklist(response)
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>, requirementId: string) {
    event.preventDefault()
    const file = selectedFiles[requirementId]
    if (!file) {
      setError('Escolha um arquivo PDF, JPEG ou PNG antes de enviar.')
      return
    }
    setError(null)
    setNotice(null)
    const formData = new FormData()
    formData.append('requirement_id', requirementId)
    formData.append('file', file)
    try {
      await apiFetch(token, '/me/document-submissions', {
        method: 'POST',
        body: formData,
      })
      setNotice('Documento enviado para revisao.')
      setSelectedFiles((current) => {
        const next = { ...current }
        delete next[requirementId]
        return next
      })
      await refreshChecklist()
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  return (
    <section className='private-content documents-page' aria-labelledby='availability-page-title'>
      <p className='eyebrow'>Elegibilidade</p>
      <h1 id='availability-page-title'>Meus documentos</h1>
      <p className='private-intro'>
        Mantenha seu checklist atualizado para participar das sessoes compativeis.
      </p>
      <div className='document-toolbar'>
        <label htmlFor='document-term'>Semestre</label>
        <select id='document-term' value={termId} onChange={(event) => setTermId(event.target.value)}>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>{term.name}</option>
          ))}
        </select>
        {checklist && (
          <span className={checklist.eligible ? 'status-pill document-status-approved' : 'status-pill document-status-pending_review'}>
            {checklist.eligible ? 'Elegivel' : checklist.pending_requirement_ids.length + ' pendencia(s)'}
          </span>
        )}
      </div>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status'>{notice}</p>}
      {isLoading && <p className='loading-message'>Carregando checklist...</p>}
      {!isLoading && checklist && (
        <div className='document-grid'>
          {checklist.items.map((item) => (
            <article className='private-card document-card' key={item.requirement_id}>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>Requisito</p>
                  <h2>{item.name}</h2>
                </div>
                <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
              </div>
              {item.review_note && <p className='document-note'><strong>Como corrigir:</strong> {item.review_note}</p>}
              {(item.status === 'MISSING' || item.status === 'REJECTED' || item.status === 'EXPIRED') && (
                <form className='compact-form' onSubmit={(event) => void submitDocument(event, item.requirement_id)}>
                  <label htmlFor={'document-file-' + item.requirement_id}>Novo arquivo</label>
                  <input
                    id={'document-file-' + item.requirement_id}
                    type='file'
                    accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) setSelectedFiles((current) => ({ ...current, [item.requirement_id]: file }))
                    }}
                  />
                  <button className='button button-primary' type='submit'>Enviar para revisao</button>
                </form>
              )}
              {item.status === 'PENDING_REVIEW' && <p className='field-help'>Seu arquivo esta na fila de revisao.</p>}
              {item.status === 'APPROVED' && item.expires_at && (
                <p className='field-help'>Valido ate {new Date(item.expires_at).toLocaleDateString('pt-BR')}.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function SupervisorDocumentsPage({ token }: AuthenticatedProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function refreshReviews() {
    const response = await apiFetch<Review[]>(token, '/document-reviews?status=PENDING_REVIEW')
    setReviews(response)
  }

  useEffect(() => {
    refreshReviews()
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setIsLoading(false))
  }, [token])

  async function approve(reviewId: string) {
    setError(null)
    setNotice(null)
    try {
      await apiFetch(token, '/document-submissions/' + reviewId + '/approve', {
        method: 'POST',
        body: JSON.stringify({
          expires_at: expiryDates[reviewId] ? new Date(expiryDates[reviewId] + 'T23:59:59').toISOString() : null,
        }),
      })
      setNotice('Documento aprovado.')
      await refreshReviews()
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  async function reject(reviewId: string) {
    setError(null)
    setNotice(null)
    const reviewNote = notes[reviewId]?.trim() ?? ''
    if (!reviewNote) {
      setError('Informe como o estudante deve corrigir o documento.')
      return
    }
    try {
      await apiFetch(token, '/document-submissions/' + reviewId + '/reject', {
        method: 'POST',
        body: JSON.stringify({ review_note: reviewNote }),
      })
      setNotice('Documento recusado com orientação de correção.')
      await refreshReviews()
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  async function download(reviewId: string) {
    try {
      const blob = await apiDownload(token, '/document-submissions/' + reviewId + '/content')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'documento'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  return (
    <section className='private-content documents-page' aria-labelledby='availability-page-title'>
      <p className='eyebrow'>Revisao documental</p>
      <h1 id='availability-page-title'>Fila de documentos</h1>
      <p className='private-intro'>
        Revise somente documentos dos estudantes dentro do seu escopo ativo.
      </p>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status'>{notice}</p>}
      {isLoading && <p className='loading-message'>Carregando fila...</p>}
      {!isLoading && reviews.length === 0 && <p className='field-help'>Nenhum documento pendente no seu escopo.</p>}
      <div className='document-grid'>
        {reviews.map((review) => (
          <article className='private-card document-card' key={review.id}>
            <div className='card-heading'>
              <div>
                <p className='eyebrow'>Estudante</p>
                <h2>{review.student_name}</h2>
              </div>
              <span className='status-pill document-status-pending_review'>Em revisao</span>
            </div>
            <p className='document-meta'><strong>{review.requirement_name}</strong> · {review.original_name} · {Math.ceil(review.size_bytes / 1024)} KB</p>
            <div className='review-actions'>
              <button className='text-button' type='button' onClick={() => void download(review.id)}>Baixar arquivo</button>
              <label htmlFor={'expiry-' + review.id}>Validade opcional</label>
              <input
                id={'expiry-' + review.id}
                type='date'
                value={expiryDates[review.id] ?? ''}
                onChange={(event) => setExpiryDates((current) => ({ ...current, [review.id]: event.target.value }))}
              />
              <button className='button button-primary' type='button' onClick={() => void approve(review.id)}>Aprovar</button>
            </div>
            <label htmlFor={'note-' + review.id}>Orientação em caso de recusa</label>
            <textarea
              id={'note-' + review.id}
              value={notes[review.id] ?? ''}
              onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))}
              rows={3}
            />
            <button className='text-button' type='button' onClick={() => void reject(review.id)}>Recusar com orientação</button>
          </article>
        ))}
      </div>
    </section>
  )
}
