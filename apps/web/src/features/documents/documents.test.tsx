import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StudentDocumentsPage, SupervisorDocumentsPage } from './documents'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('documentos', () => {
  it('permite ao estudante enviar um arquivo do checklist', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([{ id: 'term-1', name: '2026.2', status: 'ACTIVE' }]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          term_id: 'term-1',
          eligible: false,
          pending_requirement_ids: ['requirement-1'],
          items: [
            {
              requirement_id: 'requirement-1',
              name: 'Comprovante ficticio',
              discipline_id: null,
              status: 'MISSING',
              review_note: null,
              expires_at: null,
              latest_submission_id: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'submission-1',
          requirement_id: 'requirement-1',
          status: 'PENDING_REVIEW',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          term_id: 'term-1',
          eligible: false,
          pending_requirement_ids: ['requirement-1'],
          items: [
            {
              requirement_id: 'requirement-1',
              name: 'Comprovante ficticio',
              discipline_id: null,
              status: 'PENDING_REVIEW',
              review_note: null,
              expires_at: null,
              latest_submission_id: 'submission-1',
            },
          ],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<StudentDocumentsPage token='student-token' />)

    expect(await screen.findByRole('heading', { name: 'Meus documentos' })).toBeInTheDocument()
    const file = new File(['%PDF-1.7 ficticio'], 'comprovante.pdf', {
      type: 'application/pdf',
    })
    await userEvent.upload(await screen.findByLabelText('Novo arquivo'), file)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para revisao' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    const uploadRequest = fetchMock.mock.calls[2][1] as RequestInit
    expect(uploadRequest.method).toBe('POST')
    expect(uploadRequest.headers).toEqual({ Authorization: 'Bearer student-token' })
    expect(uploadRequest.body).toBeInstanceOf(FormData)
    expect((uploadRequest.body as FormData).get('requirement_id')).toBe('requirement-1')
  })

  it('exige orientação antes de recusar uma submissão', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'submission-1',
            requirement_id: 'requirement-1',
            student_id: 'student-1',
            student_name: 'Estudante Ficticio',
            requirement_name: 'Comprovante ficticio',
            original_name: 'comprovante.pdf',
            mime_type: 'application/pdf',
            size_bytes: 20,
            status: 'PENDING_REVIEW',
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    render(<SupervisorDocumentsPage token='supervisor-token' />)

    expect(await screen.findByRole('heading', { name: 'Fila de documentos' })).toBeInTheDocument()
    await userEvent.type(
      screen.getByLabelText('Orientação em caso de recusa'),
      'Envie uma imagem legivel.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Recusar com orientação' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const rejectRequest = fetchMock.mock.calls[1][1] as RequestInit
    expect(rejectRequest.method).toBe('POST')
    expect(rejectRequest.body).toBe(
      JSON.stringify({ review_note: 'Envie uma imagem legivel.' }),
    )
  })
})
