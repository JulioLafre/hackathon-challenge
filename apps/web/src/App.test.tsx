import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('bootstrap da Clínica Escola', () => {
  it('apresenta uma entrada institucional navegável e acessível', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#conteudo-principal',
    )
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: /cuidado que aproxima/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Apresentação' })).toHaveAttribute(
      'id',
      'conteudo-principal',
    )
    expect(screen.getByRole('link', { name: /conheça a clínica/i })).toHaveAttribute(
      'href',
      '#como-funciona',
    )
  })

  it('oferece retorno para a home quando a rota não existe', () => {
    render(
      <MemoryRouter initialEntries={['/rota-inexistente']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para a página inicial' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('autentica e mostra somente a navegacao do papel atual', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'token-only-in-memory',
          token_type: 'bearer',
          expires_in: 1800,
          user: {
            id: '9f7f8c1a-7822-4cc8-9e11-000000000001',
            email: 'student@example.com',
            role: 'STUDENT',
            is_active: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('E-mail'), 'student@example.com')
    await user.type(screen.getByLabelText('Senha'), 'StudentDemo!2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Minha jornada' })).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Documentos' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Semestres' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'student@example.com', password: 'StudentDemo!2026' }),
      }),
    )
    vi.unstubAllGlobals()
  })

  it('oferece configuracao academica para o Master', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'master-token',
            token_type: 'bearer',
            expires_in: 1800,
            user: {
              id: 'master-1',
              email: 'master@example.com',
              role: 'MASTER',
              is_active: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('E-mail'), 'master@example.com')
    await user.type(screen.getByLabelText('Senha'), 'MasterDemo!2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await user.click(await screen.findByRole('link', { name: 'Semestres' }))

    expect(
      await screen.findByRole('heading', { name: 'Configuracao academica' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nome do semestre')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/terms'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer master-token' },
      }),
    )
    vi.unstubAllGlobals()
  })

  it('oferece configuracao de clinicas para o Master', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'master-token',
            token_type: 'bearer',
            expires_in: 1800,
            user: {
              id: 'master-1',
              email: 'master@example.com',
              role: 'MASTER',
              is_active: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('E-mail'), 'master@example.com')
    await user.type(screen.getByLabelText('Senha'), 'MasterDemo!2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await user.click(await screen.findByRole('link', { name: 'Clinicas' }))

    expect(
      await screen.findByRole('heading', { name: 'Configuracao da clinica' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da clinica')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('carrega e salva a disponibilidade propria', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'student-token',
            token_type: 'bearer',
            expires_in: 1800,
            user: {
              id: 'student-1',
              email: 'student@example.com',
              role: 'STUDENT',
              is_active: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'term-1',
              name: '2026.2',
              starts_on: '2026-08-01',
              ends_on: '2026-12-20',
              status: 'ACTIVE',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            owner_type: 'STUDENT',
            term_id: 'term-1',
            time_zone: 'America/Sao_Paulo',
            intervals: [
              {
                weekday: 2,
                start_time: '08:00:00',
                end_time: '10:00:00',
                time_zone: 'America/Sao_Paulo',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            owner_type: 'STUDENT',
            term_id: 'term-1',
            time_zone: 'America/Sao_Paulo',
            intervals: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('E-mail'), 'student@example.com')
    await user.type(screen.getByLabelText('Senha'), 'StudentDemo!2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await user.click(
      await screen.findByRole('link', { name: 'Minha disponibilidade' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Minha disponibilidade' }),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar disponibilidade' }))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/me/availability'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer student-token',
        }),
      }),
    )
    vi.unstubAllGlobals()
  })
})
