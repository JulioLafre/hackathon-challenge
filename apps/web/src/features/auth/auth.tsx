import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AcademicAdminPage, AvailabilityPage } from '../academics/academics'
import { ClinicAdminPage } from '../clinics/clinics'
import { StudentDocumentsPage, SupervisorDocumentsPage } from '../documents/documents'
import { SchedulingPage } from '../scheduling/scheduling'
import { AdminAuditPage, AdminDashboardPage } from '../admin/admin'
import { RoleJourney, RoleStartPage, StudentJourneyPage } from '../journey/journey'

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

type NavigationItem = {
  label: string
  path: string
}

const roleNavigation: Record<UserRole, readonly NavigationItem[]> = {
  MASTER: [
    { label: 'Visão geral', path: '/app/visao-geral' },
    { label: 'Semestres', path: '/app/semestres' },
    { label: 'Clínicas', path: '/app/clinicas' },
    { label: 'Auditoria', path: '/app/auditoria' },
  ],
  SUPERVISOR: [
    { label: 'Minha disponibilidade', path: '/app/minha-disponibilidade' },
    { label: 'Minhas sessões', path: '/app/sessoes' },
    { label: 'Documentos', path: '/app/documentos' },
  ],
  STUDENT: [
    { label: 'Documentos', path: '/app/documentos' },
    { label: 'Minha disponibilidade', path: '/app/minha-disponibilidade' },
    { label: 'Minha jornada', path: '/app/minha-jornada' },
  ],
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

function PrivateShell() {
  const { user, logout, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const navigation = roleNavigation[user.role]

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const customPage = token && user.role === 'MASTER' && location.pathname === '/app/semestres'
    ? <AcademicAdminPage token={token} />
    : token && user.role === 'MASTER' && location.pathname === '/app/clinicas'
      ? <ClinicAdminPage token={token} />
      : token && (user.role === 'STUDENT' || user.role === 'SUPERVISOR') && location.pathname === '/app/minha-disponibilidade'
      ? <AvailabilityPage token={token} />
      : token && user.role === 'STUDENT' && location.pathname === '/app/documentos'
        ? <StudentDocumentsPage token={token} />
      : token && user.role === 'SUPERVISOR' && location.pathname === '/app/documentos'
          ? <SupervisorDocumentsPage token={token} />
      : token && user.role === 'SUPERVISOR' && location.pathname === '/app/sessoes'
        ? <SchedulingPage token={token} />
      : token && user.role === 'STUDENT' && location.pathname === '/app/minha-jornada'
        ? <StudentJourneyPage />
      : token && user.role === 'MASTER' && location.pathname === '/app/auditoria'
        ? <AdminAuditPage token={token} />
      : token && user.role === 'MASTER' && location.pathname === '/app/visao-geral'
        ? <AdminDashboardPage token={token} />
      : null

  const mainTitleId = customPage
    ? location.pathname === '/app/semestres'
      ? 'academic-page-title'
      : location.pathname === '/app/clinicas'
        ? 'clinic-page-title'
        : location.pathname === '/app/sessoes'
          ? 'scheduling-page-title'
          : location.pathname === '/app/visao-geral'
            ? 'admin-page-title'
            : location.pathname === '/app/auditoria'
              ? 'audit-page-title'
              : location.pathname === '/app/minha-jornada'
                ? 'student-journey-page-title'
                : 'availability-page-title'
    : 'private-title'

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
        <div className="sidebar-label">Seu fluxo</div>
        <nav aria-label="Navegação da plataforma" className="private-nav">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'private-nav-link active' : 'private-nav-link')}
              end={item.path === '/app/visao-geral' || item.path === '/app/minha-jornada'}
              key={item.path}
              to={item.path}
            >
              <span aria-hidden="true" className="nav-marker" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="logout-button" type="button" onClick={handleLogout}>
          Sair <span aria-hidden="true">↗</span>
        </button>
      </aside>

      <main
        className="private-main"
        aria-labelledby={mainTitleId}
      >
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

        <RoleJourney role={user.role} />
        {customPage}
        {!customPage && <RoleStartPage role={user.role} />}
      </main>
    </div>
  )
}

export function ProtectedRoute() {
  return <PrivateShell />
}
