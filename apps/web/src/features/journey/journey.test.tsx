import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RoleJourney, RoleStartPage, StudentJourneyPage } from './journey'

describe('jornada orientada por papel', () => {
  it('destaca o passo atual do estudante e mantém os próximos passos navegáveis', () => {
    render(
      <MemoryRouter initialEntries={['/app/documentos']}>
        <RoleJourney role='STUDENT' />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Seu roteiro' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Documentos/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.getByRole('link', { name: /Minha disponibilidade/i })).toHaveAttribute(
      'href',
      '/app/minha-disponibilidade',
    )
    expect(screen.getByText('Passo atual')).toBeInTheDocument()
  })

  it('oferece ao Master uma primeira ação explícita na entrada da plataforma', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <RoleStartPage role='MASTER' />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Comece pelo semestre' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir configuração do semestre' })).toHaveAttribute(
      'href',
      '/app/semestres',
    )
    expect(screen.getByText('Crie o período, defina as datas e cadastre cursos, disciplinas e turmas.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Depois, configure clínicas e serviços' })).toBeInTheDocument()
  })

  it('destaca Auditoria como passo atual quando o Master abre a auditoria', () => {
    render(
      <MemoryRouter initialEntries={['/app/auditoria']}>
        <RoleJourney role='MASTER' />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /Auditoria/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
  })

  it('apresenta a jornada do estudante como um resumo próprio', () => {
    render(
      <MemoryRouter initialEntries={['/app/minha-jornada']}>
        <StudentJourneyPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Minha jornada' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximas etapas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir documentos/i })).toHaveAttribute(
      'href',
      '/app/documentos',
    )
  })
})
