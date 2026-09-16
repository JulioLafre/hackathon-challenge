import { Link, Route, Routes } from 'react-router-dom'
import { AuthProvider, LoginPage, ProtectedRoute } from './features/auth/auth'
import './styles.css'

const highlights = [
  {
    number: '01',
    title: 'Ensino supervisionado',
    description: 'Estudantes desenvolvem prática com orientação e segurança.',
  },
  {
    number: '02',
    title: 'Cuidado acessível',
    description: 'A comunidade encontra atendimento alinhado às suas necessidades.',
  },
  {
    number: '03',
    title: 'Gestão integrada',
    description: 'Cada horário considera pessoas, supervisão e espaço disponível.',
  },
]

function HomePage() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#conteudo-principal">
        Pular para o conteúdo
      </a>

      <header className="site-header" role="banner">
        <Link className="brand" to="/" aria-label="Clínica Escola - início">
          <span className="brand-mark" aria-hidden="true">
            CE
          </span>
          <span className="brand-name">
            Clínica <strong>Escola</strong>
          </span>
        </Link>

        <nav className="primary-nav" aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#acesso">Acesso</a>
        </nav>

        <Link className="header-action" to="/login">
          Entrar na plataforma <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <main id="conteudo-principal" aria-label="Apresentação">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              Ensino, cuidado e comunidade
            </p>
            <h1 id="hero-title">
              Cuidado que <em>aproxima.</em>
            </h1>
            <p className="hero-description">
              A Clínica Escola conecta estudantes, supervisores e comunidade para
              transformar aprendizado em cuidado de verdade.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#como-funciona">
                Conheça a clínica <span aria-hidden="true">↗</span>
              </a>
              <Link className="text-link" to="/login">
                Já faço parte <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="hero-art" aria-label="Ilustração abstrata de conexão" role="img">
            <div className="art-orbit art-orbit-one" />
            <div className="art-orbit art-orbit-two" />
            <div className="art-center">
              <span className="art-line art-line-one" />
              <span className="art-line art-line-two" />
              <span className="art-dot art-dot-one" />
              <span className="art-dot art-dot-two" />
              <span className="art-dot art-dot-three" />
              <span className="art-dot art-dot-four" />
              <span className="art-core" />
            </div>
            <p className="art-caption">conexões que<br />geram impacto</p>
          </div>
        </section>

        <section className="highlights-section" id="como-funciona" aria-labelledby="highlights-title">
          <div className="section-heading">
            <p className="eyebrow">Uma rede que cuida</p>
            <h2 id="highlights-title">Feito para funcionar junto.</h2>
          </div>
          <div className="highlight-grid">
            {highlights.map((highlight) => (
              <article className="highlight-card" key={highlight.number}>
                <span className="card-number">{highlight.number}</span>
                <h3>{highlight.title}</h3>
                <p>{highlight.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="access-section" id="acesso" aria-labelledby="access-title">
          <div>
            <p className="eyebrow">Primeiro passo</p>
            <h2 id="access-title">Vamos começar?</h2>
          </div>
          <p>Entre na plataforma para acompanhar sua jornada na Clínica Escola.</p>
          <Link className="button button-light" to="/login">
            Entrar na plataforma <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>

      <footer className="site-footer">
        <span>Clínica Escola</span>
        <span>Um espaço para aprender cuidando.</span>
      </footer>
    </div>
  )
}

function NotFoundPage() {
  return (
    <main className="not-found" aria-labelledby="not-found-title">
      <p className="eyebrow">Clínica Escola</p>
      <h1 id="not-found-title">Página não encontrada</h1>
      <p>O endereço que você acessou não está disponível.</p>
      <Link className="button button-primary" to="/">
        Voltar para a página inicial
      </Link>
    </main>
  )
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app/*" element={<ProtectedRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}
