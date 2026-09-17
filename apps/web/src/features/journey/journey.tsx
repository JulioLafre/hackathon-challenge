import { Link, useLocation } from 'react-router-dom'
import type { UserRole } from '../auth/auth'

export type JourneyStep = {
  id: string
  label: string
  description: string
  path: string
}

type RoleJourneyContent = {
  title: string
  description: string
  firstAction: string
  firstActionDescription: string
  firstActionHeading: string
  followingHeading: string
}

const roleJourneys: Record<UserRole, readonly JourneyStep[]> = {
  MASTER: [
    {
      id: 'term',
      label: '1. Semestre',
      description: 'Ative o semestre e cadastre a estrutura acadêmica usada nas clínicas.',
      path: '/app/semestres',
    },
    {
      id: 'clinic',
      label: '2. Clínica',
      description: 'Cadastre clínicas, ambientes, recursos, serviços e limites de atendimento.',
      path: '/app/clinicas',
    },
    {
      id: 'operation',
      label: '3. Operação',
      description: 'Confira sessões, reservas, pendências e capacidade do semestre ativo.',
      path: '/app/visao-geral',
    },
    {
      id: 'audit',
      label: '4. Auditoria',
      description: 'Veja quem alterou dados administrativos e quando.',
      path: '/app/auditoria',
    },
  ],
  SUPERVISOR: [
    {
      id: 'availability',
      label: '1. Disponibilidade',
      description: 'Informe quando pode supervisionar.',
      path: '/app/minha-disponibilidade',
    },
    {
      id: 'sessions',
      label: '2. Sessões',
      description: 'Crie horários e publique apenas sessões viáveis.',
      path: '/app/sessoes',
    },
    {
      id: 'documents',
      label: '3. Documentos',
      description: 'Revise as pendências do seu escopo.',
      path: '/app/documentos',
    },
  ],
  STUDENT: [
    {
      id: 'documents',
      label: '1. Documentos',
      description: 'Envie os comprovantes exigidos para ficar elegível.',
      path: '/app/documentos',
    },
    {
      id: 'availability',
      label: '2. Minha disponibilidade',
      description: 'Informe os horários em que pode participar.',
      path: '/app/minha-disponibilidade',
    },
    {
      id: 'journey',
      label: '3. Jornada',
      description: 'Acompanhe suas próximas oportunidades.',
      path: '/app/minha-jornada',
    },
  ],
}

const roleJourneyContent: Record<UserRole, RoleJourneyContent> = {
  MASTER: {
    title: 'Comece pelo semestre',
    description: 'Configure o semestre ativo antes de abrir clínicas, serviços e sessões.',
    firstAction: 'Abrir configuração do semestre',
    firstActionDescription: 'Crie o período, defina as datas e cadastre cursos, disciplinas e turmas.',
    firstActionHeading: 'Ative o semestre',
    followingHeading: 'Depois, configure clínicas e serviços',
  },
  SUPERVISOR: {
    title: 'Comece pela disponibilidade',
    description: 'Defina seus horários antes de criar uma sessão clínica.',
    firstAction: 'Informar minha disponibilidade',
    firstActionDescription: 'Registre os intervalos em que você consegue supervisionar.',
    firstActionHeading: 'Informe sua disponibilidade',
    followingHeading: 'Depois, crie sessões',
  },
  STUDENT: {
    title: 'Comece pelos documentos',
    description: 'Conclua os requisitos antes de participar de uma sessão.',
    firstAction: 'Abrir meus documentos',
    firstActionDescription: 'Envie os arquivos exigidos e acompanhe a revisão da sua elegibilidade.',
    firstActionHeading: 'Envie seus documentos',
    followingHeading: 'Depois, informe sua disponibilidade',
  },
}

function getRoleJourney(role: UserRole): readonly JourneyStep[] {
  return roleJourneys[role]
}

function isCurrentStep(role: UserRole, step: JourneyStep, pathname: string): boolean {
  if (pathname === step.path) return true
  return role === 'MASTER' && step.id === 'operation' && pathname === '/app/auditoria'
}

function StepLink({
  step,
  isCurrent,
  index,
}: {
  step: JourneyStep
  isCurrent: boolean
  index: number
}) {
  return (
    <li className={isCurrent ? 'journey-step current' : 'journey-step'}>
      <Link
        className='journey-step-link'
        to={step.path}
        aria-current={isCurrent ? 'step' : undefined}
      >
        <span className='journey-step-number' aria-hidden='true'>
          {index + 1}
        </span>
        <span className='journey-step-copy'>
          <strong>{step.label.replace(/^\d+\.\s/, '')}</strong>
          <small>{isCurrent ? 'Passo atual' : step.description}</small>
        </span>
        <span className='journey-step-arrow' aria-hidden='true'>
          →
        </span>
      </Link>
    </li>
  )
}

export function RoleJourney({ role }: { role: UserRole }) {
  const location = useLocation()
  const steps = getRoleJourney(role)

  return (
    <section className='journey-panel' aria-labelledby='journey-title'>
      <div className='journey-panel-heading'>
        <div>
          <p className='eyebrow'>Fluxo recomendado</p>
          <h2 id='journey-title'>Seu roteiro</h2>
        </div>
        <p className='journey-panel-description'>
          Siga os passos na ordem. Você pode voltar a qualquer etapa para revisar ou atualizar dados.
        </p>
      </div>
      <ol className='journey-steps'>
        {steps.map((step, index) => (
          <StepLink
            index={index}
            isCurrent={isCurrentStep(role, step, location.pathname)}
            key={step.id}
            step={step}
          />
        ))}
      </ol>
    </section>
  )
}

export function RoleStartPage({ role }: { role: UserRole }) {
  const content = roleJourneyContent[role]
  const steps = getRoleJourney(role)
  const nextStep = steps[0]
  const followingStep = steps[1]
  const title = role === 'STUDENT' ? 'Minha jornada' : content.title

  return (
    <section className='private-content role-start-page' aria-labelledby='private-title'>
      <p className='eyebrow'>Primeiro passo</p>
      <h1 id='private-title'>{title}</h1>
      <p className='private-intro'>{content.description}</p>

      <div className='next-action'>
        <div>
          <p className='eyebrow'>Agora</p>
          <h2>{content.firstActionHeading}</h2>
          <p>{content.firstActionDescription}</p>
        </div>
        <Link className='button button-primary' to={nextStep.path}>
          {content.firstAction}
          <span aria-hidden='true'>→</span>
        </Link>
      </div>

      <div className='role-start-follow-up'>
        <p className='eyebrow'>Depois</p>
        <h2>{content.followingHeading}</h2>
        <p>{followingStep.description}</p>
        <Link className='text-link' to={followingStep.path}>
          Abrir próximo passo <span aria-hidden='true'>→</span>
        </Link>
      </div>
    </section>
  )
}

export function StudentJourneyPage() {
  const steps = roleJourneys.STUDENT

  return (
    <section className='private-content role-start-page student-journey-page' aria-labelledby='student-journey-page-title'>
      <p className='eyebrow'>Acompanhe o processo</p>
      <h1 id='student-journey-page-title'>Minha jornada</h1>
      <p className='private-intro'>
        Veja o que já pode fazer e abra cada etapa na ordem recomendada para participar das atividades.
      </p>

      <div className='journey-detail-heading'>
        <div>
          <p className='eyebrow'>Passo a passo</p>
          <h2>Próximas etapas</h2>
        </div>
        <p>Comece pelos documentos e avance quando cada informação estiver pronta.</p>
      </div>

      <ol className='journey-detail-list'>
        {steps.map((step, index) => (
          <li className='journey-detail-item' key={step.id}>
            <span className='journey-detail-number' aria-hidden='true'>
              {index + 1}
            </span>
            <div className='journey-detail-copy'>
              <p className='eyebrow'>Passo {index + 1}</p>
              <h3>{step.label.replace(/^\d+\.\s/, '')}</h3>
              <p>{step.description}</p>
            </div>
            {index < steps.length - 1 ? (
              <Link className='text-link' to={step.path}>
                {index === 0 ? 'Abrir documentos' : 'Informar disponibilidade'}
                <span aria-hidden='true'>→</span>
              </Link>
            ) : (
              <span className='journey-detail-current'>Você está nesta visão</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
