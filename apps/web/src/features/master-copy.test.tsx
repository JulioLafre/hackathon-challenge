import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../lib/api'
import { AcademicAdminPage } from './academics/academics'
import { ClinicAdminPage } from './clinics/clinics'

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

const apiFetchMock = vi.mocked(apiFetch)

describe('linguagem operacional do Master', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetchMock.mockImplementation(async () => [])
  })

  it('explica a ordem da configuração acadêmica', async () => {
    render(<AcademicAdminPage token='master-token' />)

    expect(await screen.findByText('Crie o período acadêmico e cadastre a estrutura que será usada nas clínicas.')).toBeInTheDocument()
    expect(screen.getByText('Comece por aqui: o semestre ativo define o período das ofertas e dos vínculos acadêmicos.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cursos e disciplinas' })).toBeInTheDocument()
  })

  it('explica a ordem da configuração operacional', async () => {
    render(<ClinicAdminPage token='master-token' />)

    expect(await screen.findByText('Cadastre a clínica e seus recursos antes de definir limites, serviços e supervisão.')).toBeInTheDocument()
    expect(screen.getByText('Registre salas e equipamentos: eles determinam quantos atendimentos podem acontecer ao mesmo tempo.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Serviços e requisitos' })).toBeInTheDocument()
  })
})
