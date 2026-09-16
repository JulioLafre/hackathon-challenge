import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'

export type UserRole = 'MASTER' | 'SUPERVISOR' | 'STUDENT'

export type UserProfile = {
  id: string
  email: string
  role: UserRole
  is_active: boolean
}

type LoginResponse = {
  access_token: string
  token_type: string
  expires_in: number
  user: UserProfile
}

type ApiErrorResponse = {
  error?: {
    message?: string
  }
}

type AuthContextValue = {
  token: string | null
  user: UserProfile | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

type AuthProviderProps = {
  children: ReactNode
}

const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(
  /\/$/,
  '',
)

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const roleNavigation: Record<UserRole, readonly string[]> = {
  MASTER: ['Visão geral', 'Semestres', 'Usuários', 'Auditoria'],
  SUPERVISOR: ['Minhas sessões', 'Estudantes', 'Documentos'],
  STUDENT: ['Minha jornada', 'Documentos', 'Minhas alocações'],
}

const roleLabels: Record<UserRole, string> = {
  MASTER: 'Master',
  SUPERVISOR: 'Supervisor',
  STUDENT: 'Estudante',
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await response.json()) as LoginResponse | ApiErrorResponse

    if (!response.ok || !('access_token' in body) || !body.user) {
      const message = 'error' in body ? body.error?.message : undefined
      throw new Error(message ?? 'Não foi possível entrar agora.')
    }

    setToken(body.access_token)
    setUser(body.user)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ token, user, login, logout }),
    [login, logout, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa estar dentro de AuthProvider')
  }
  return context
}

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/app" replace />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/app')
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Não foi possível entrar agora.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page" aria-labelledby="login-title">
      <div className="login-panel">
        <Link className="brand login-brand" to="/" aria-label="Clínica Escola - início">
          <span className="brand-mark" aria-hidden="true">
            CE
          </span>
          <span className="brand-name">
            Clínica <strong>Escola</strong>
          </span>
        </Link>
        <p className="eyebrow">Acesso interno</p>
        <h1 id="login-title">Bem-vindo de volta.</h1>
        <p className="login-description">
          Entre para acompanhar sua jornada na Clínica Escola.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <Link className="back-link" to="/">
          ← Voltar para a apresentação
        </Link>
      </div>
    </main>
  )
}

function sectionPath(label: string) {
  return `/app/${label.toLowerCase().replaceAll(' ', '-')}`
}

function PrivateShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const navigation = roleNavigation[user.role]
  const activeItem =
    navigation.find((item) => location.pathname === sectionPath(item)) ?? navigation[0]

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="private-shell">
      <aside className="private-sidebar">
        <Link className="brand" to="/app" aria-label="Clínica Escola - área interna">
          <span className="brand-mark" aria-hidden="true">
            CE
          </span>
          <span className="brand-name">
            Clínica <strong>Escola</strong>
          </span>
        </Link>
        <div className="sidebar-label">Seu espaço</div>
        <nav aria-label="Navegação da plataforma" className="private-nav">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'private-nav-link active' : 'private-nav-link')}
              end={item === navigation[0]}
              key={item}
              to={sectionPath(item)}
            >
              <span aria-hidden="true" className="nav-marker" />
              {item}
            </NavLink>
          ))}
        </nav>
        <button className="logout-button" type="button" onClick={handleLogout}>
          Sair <span aria-hidden="true">↗</span>
        </button>
      </aside>

      <main className="private-main" aria-labelledby="private-title">
        <header className="private-header">
          <div>
            <p className="eyebrow">Área interna</p>
            <p className="private-role">{roleLabels[user.role]}</p>
          </div>
          <div className="profile-chip" aria-label={`Usuário ${user.email}`}>
            <span className="profile-avatar" aria-hidden="true">
              {user.email.charAt(0).toUpperCase()}
            </span>
            <span>{user.email}</span>
          </div>
        </header>

        <section className="private-content">
          <p className="eyebrow">Clínica Escola</p>
          <h1 id="private-title">{activeItem}</h1>
          <p className="private-intro">
            Um panorama simples para você acompanhar o próximo passo da sua jornada.
          </p>
          <div className="private-card-grid">
            <article className="private-card private-card-accent">
              <span className="card-number">01</span>
              <h2>Acesso seguro</h2>
              <p>Seu perfil mostra somente as funções disponíveis para o seu papel.</p>
            </article>
            <article className="private-card">
              <span className="card-number">02</span>
              <h2>Próximos passos</h2>
              <p>As informações da sua rotina aparecerão aqui conforme o semestre avançar.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}

export function ProtectedRoute() {
  return <PrivateShell />
}
