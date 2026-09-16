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
})
