import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
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
})
