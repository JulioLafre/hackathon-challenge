import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import type { AuthenticatedProps } from '../academics/academics'

type UserRole = 'MASTER' | 'SUPERVISOR' | 'STUDENT'
type UserProfile = { id: string; email: string; role: UserRole; is_active: boolean }
type Student = { user_id: string; registration: string; full_name: string; phone: string | null }
type Supervisor = {
  user_id: string
  kind: 'PROFESSOR' | 'PRECEPTOR'
  full_name: string
  professional_area: string
  max_students_default: number
}
type Term = { id: string; name: string; status: 'DRAFT' | 'ACTIVE' | 'CLOSED' }
type Course = { id: string; name: string; is_active: boolean }
type Discipline = { id: string; name: string; course_id: string; is_active: boolean }
type Cohort = { id: string; term_id: string; course_id: string; label: string; is_active: boolean }
type StudentLink = {
  id: string
  student_id: string
  term_id: string
  term_status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  cohort_id: string
  discipline_id: string
}

type SupervisorForm = {
  user_id: string
  kind: Supervisor['kind']
  full_name: string
  professional_area: string
  max_students_default: string
}

type PeoplePageProps = AuthenticatedProps & { currentUserId?: string }

const emptyStudent = { user_id: '', registration: '', full_name: '', phone: '' }
const emptySupervisor: SupervisorForm = {
  user_id: '',
  kind: 'PROFESSOR',
  full_name: '',
  professional_area: '',
  max_students_default: '1',
}
const emptyLink = { student_id: '', term_id: '', cohort_id: '', discipline_id: '' }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}

function shortId(value: string) {
  return value.slice(0, 8) + '…'
}

function roleLabel(role: UserRole) {
  return { MASTER: 'Master', SUPERVISOR: 'Supervisor', STUDENT: 'Estudante' }[role]
}

function kindLabel(kind: Supervisor['kind']) {
  return kind === 'PROFESSOR' ? 'Professor' : 'Preceptor'
}

export function MasterPeoplePage({ token, currentUserId }: PeoplePageProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [links, setLinks] = useState<StudentLink[]>([])
  const [studentForm, setStudentForm] = useState(emptyStudent)
  const [supervisorForm, setSupervisorForm] = useState<SupervisorForm>(emptySupervisor)
  const [linkForm, setLinkForm] = useState(emptyLink)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [editingSupervisorId, setEditingSupervisorId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [nextUsers, nextStudents, nextSupervisors, nextTerms, nextCourses, nextDisciplines, nextCohorts, nextLinks] = await Promise.all([
        apiFetch<UserProfile[]>(token, '/users'),
        apiFetch<Student[]>(token, '/students'),
        apiFetch<Supervisor[]>(token, '/supervisors'),
        apiFetch<Term[]>(token, '/terms'),
        apiFetch<Course[]>(token, '/courses'),
        apiFetch<Discipline[]>(token, '/disciplines'),
        apiFetch<Cohort[]>(token, '/cohorts'),
        apiFetch<StudentLink[]>(token, '/student-academic-links'),
      ])
      setUsers(nextUsers)
      setStudents(nextStudents)
      setSupervisors(nextSupervisors)
      setTerms(nextTerms)
      setCourses(nextCourses)
      setDisciplines(nextDisciplines)
      setCohorts(nextCohorts)
      setLinks(nextLinks)
      setLinkForm((current) => ({
        ...current,
        student_id: current.student_id || nextStudents[0]?.user_id || '',
        term_id: current.term_id || nextTerms.find((term) => term.status !== 'CLOSED')?.id || '',
        cohort_id: current.cohort_id || nextCohorts[0]?.id || '',
        discipline_id: current.discipline_id || nextDisciplines[0]?.id || '',
      }))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function submitStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const path = editingStudentId ? `/students/${editingStudentId}` : '/students'
      await apiFetch<Student>(token, path, {
        method: editingStudentId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...studentForm, phone: studentForm.phone || null }),
      })
      setStudentForm(emptyStudent)
      setEditingStudentId(null)
      setNotice(editingStudentId ? 'Perfil de estudante atualizado.' : 'Perfil de estudante criado.')
      await refresh()
    } catch (submitError) {
      setError(errorMessage(submitError))
    }
  }

  async function submitSupervisor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const path = editingSupervisorId ? `/supervisors/${editingSupervisorId}` : '/supervisors'
      await apiFetch<Supervisor>(token, path, {
        method: editingSupervisorId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...supervisorForm, max_students_default: Number(supervisorForm.max_students_default) }),
      })
      setSupervisorForm(emptySupervisor)
      setEditingSupervisorId(null)
      setNotice(editingSupervisorId ? 'Perfil de supervisor atualizado.' : 'Perfil de supervisor criado.')
      await refresh()
    } catch (submitError) {
      setError(errorMessage(submitError))
    }
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await apiFetch<StudentLink>(token, '/student-academic-links', {
        method: 'POST',
        body: JSON.stringify(linkForm),
      })
      setNotice('Vínculo acadêmico criado.')
      await refresh()
    } catch (submitError) {
      setError(errorMessage(submitError))
    }
  }

  async function toggleUser(user: UserProfile) {
    if (user.is_active && user.id === currentUserId) {
      setError('O Master atual não pode desativar o próprio acesso.')
      return
    }
    if (user.is_active && !window.confirm(`Desativar o acesso de ${user.email}?`)) return
    setError(null)
    setNotice(null)
    try {
      await apiFetch<UserProfile>(token, `/users/${user.id}/${user.is_active ? 'deactivate' : 'activate'}`, { method: 'POST' })
      setNotice(user.is_active ? 'Usuário desativado. O histórico foi preservado.' : 'Usuário reativado.')
      await refresh()
    } catch (toggleError) {
      setError(errorMessage(toggleError))
    }
  }

  const activeTerms = terms.filter((term) => term.status !== 'CLOSED')
  const activeCohorts = cohorts.filter((cohort) => cohort.is_active)
  const activeDisciplines = disciplines.filter((discipline) => discipline.is_active)
  const studentUsers = users.filter((user) => user.role === 'STUDENT')
  const supervisorUsers = users.filter((user) => user.role === 'SUPERVISOR')

  function editStudent(student: Student) {
    setEditingStudentId(student.user_id)
    setStudentForm({ ...student, phone: student.phone ?? '' })
    setNotice(null)
  }

  function editSupervisor(supervisor: Supervisor) {
    setEditingSupervisorId(supervisor.user_id)
    setSupervisorForm({ ...supervisor, max_students_default: String(supervisor.max_students_default) })
    setNotice(null)
  }

  function termName(id: string) {
    return terms.find((term) => term.id === id)?.name ?? shortId(id)
  }

  function cohortName(id: string) {
    const cohort = cohorts.find((item) => item.id === id)
    const course = cohort ? courses.find((item) => item.id === cohort.course_id)?.name : null
    return cohort ? `${cohort.label}${course ? ` · ${course}` : ''}` : shortId(id)
  }

  function disciplineName(id: string) {
    return disciplines.find((discipline) => discipline.id === id)?.name ?? shortId(id)
  }

  return (
    <section className='private-content master-page' aria-labelledby='master-people-title'>
      <p className='eyebrow'>Cadastros e acesso</p>
      <h1 id='master-people-title'>Pessoas e vínculos.</h1>
      <p className='private-intro'>
        Mantenha os acessos e os perfis acadêmicos prontos para que a elegibilidade, a supervisão e a agenda funcionem juntas.
      </p>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status'>{notice}</p>}
      {isLoading && <p className='loading-message' role='status'>Carregando cadastros...</p>}

      {!isLoading && (
        <>
          <article className='private-card master-users-card'>
            <div className='card-heading'>
              <div>
                <p className='eyebrow'>01 · Usuários</p>
                <h2>Controle de acesso.</h2>
              </div>
              <span className='card-count'>{users.length}</span>
            </div>
            <p className='field-help'>
              Desative acessos sem apagar histórico. A reativação fica disponível quando o usuário volta a operar.
            </p>
            {users.length === 0 ? <p className='empty-state'>Nenhum usuário cadastrado.</p> : (
              <ul className='resource-list' aria-label='Usuários do sistema'>
                {users.map((user) => (
                  <li key={user.id}>
                    <span>
                      <strong>{user.email}</strong>
                      <small>{roleLabel(user.role)} · ID {shortId(user.id)}</small>
                    </span>
                    <span className='resource-actions'>
                      <span className={user.is_active ? 'status-pill status-active' : 'status-pill status-closed'}>
                        {user.is_active ? 'Ativo' : 'Desativado'}
                      </span>
                      <button className='text-button' type='button' onClick={() => void toggleUser(user)}>
                        {user.is_active ? user.id === currentUserId ? 'Sessão atual' : 'Desativar' : 'Reativar'}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <div className='academic-layout master-people-layout'>
            <div className='academic-column'>
              <article className='private-card academic-card'>
                <div className='card-heading'>
                  <div><p className='eyebrow'>02 · Estudantes</p><h2>{editingStudentId ? 'Editar perfil' : 'Criar perfil de estudante'}</h2></div>
                  <span className='card-count'>{students.length}</span>
                </div>
                <p className='field-help'>Associe o perfil ao usuário interno e mantenha matrícula, contato e nome atualizados.</p>
                <form className='compact-form' onSubmit={submitStudent} autoComplete='off'>
                  <label htmlFor='master-student-user'>Usuário de acesso</label>
                  <select id='master-student-user' value={studentForm.user_id} onChange={(event) => setStudentForm({ ...studentForm, user_id: event.target.value })} required disabled={Boolean(editingStudentId)}>
                    <option value=''>Selecione um usuário estudante</option>
                    {studentUsers.map((user) => <option key={user.id} value={user.id}>{user.email}{students.some((student) => student.user_id === user.id) ? ' · perfil já criado' : ''}</option>)}
                  </select>
                  <label htmlFor='master-student-name'>Nome completo</label>
                  <input id='master-student-name' value={studentForm.full_name} onChange={(event) => setStudentForm({ ...studentForm, full_name: event.target.value })} required />
                  <div className='form-grid'>
                    <div><label htmlFor='master-student-registration'>Matrícula</label><input id='master-student-registration' value={studentForm.registration} onChange={(event) => setStudentForm({ ...studentForm, registration: event.target.value })} required /></div>
                    <div><label htmlFor='master-student-phone'>Telefone</label><input id='master-student-phone' value={studentForm.phone} onChange={(event) => setStudentForm({ ...studentForm, phone: event.target.value })} /></div>
                  </div>
                  <button className='button button-primary' type='submit'>{editingStudentId ? 'Salvar estudante' : 'Criar estudante'}</button>
                  {editingStudentId && <button className='text-button' type='button' onClick={() => { setEditingStudentId(null); setStudentForm(emptyStudent) }}>Cancelar edição</button>}
                </form>
                <ul className='resource-list' aria-label='Perfis de estudantes'>
                  {students.map((student) => (
                    <li key={student.user_id}>
                      <span><strong>{student.full_name}</strong><small>{student.registration} · {student.phone || 'Sem telefone'}</small></span>
                      <button className='text-button' type='button' onClick={() => editStudent(student)}>Editar</button>
                    </li>
                  ))}
                </ul>
                {studentUsers.length > students.length && <p className='field-help'>Há usuários estudantes sem perfil acadêmico. Selecione um deles acima para criar o perfil.</p>}
              </article>

              <article className='private-card academic-card'>
                <div className='card-heading'>
                  <div><p className='eyebrow'>04 · Vínculos</p><h2>Vincular estudante</h2></div>
                  <span className='card-count'>{links.length}</span>
                </div>
                <p className='field-help'>O vínculo conecta estudante, turma, disciplina e semestre para validar oportunidades compatíveis.</p>
                <form className='compact-form' onSubmit={createLink}>
                  <label htmlFor='link-student'>Estudante</label>
                  <select id='link-student' value={linkForm.student_id} onChange={(event) => setLinkForm({ ...linkForm, student_id: event.target.value })} required>
                    <option value=''>Selecione</option>
                    {students.map((student) => <option key={student.user_id} value={student.user_id}>{student.full_name} · {student.registration}</option>)}
                  </select>
                  <label htmlFor='link-term'>Semestre</label>
                  <select id='link-term' value={linkForm.term_id} onChange={(event) => setLinkForm({ ...linkForm, term_id: event.target.value })} required>
                    <option value=''>Selecione</option>
                    {activeTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                  </select>
                  <label htmlFor='link-cohort'>Turma</label>
                  <select id='link-cohort' value={linkForm.cohort_id} onChange={(event) => setLinkForm({ ...linkForm, cohort_id: event.target.value })} required>
                    <option value=''>Selecione</option>
                    {activeCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.label}</option>)}
                  </select>
                  <label htmlFor='link-discipline'>Disciplina ou estágio</label>
                  <select id='link-discipline' value={linkForm.discipline_id} onChange={(event) => setLinkForm({ ...linkForm, discipline_id: event.target.value })} required>
                    <option value=''>Selecione</option>
                    {activeDisciplines.map((discipline) => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}
                  </select>
                  <button className='button button-secondary' type='submit' disabled={students.length === 0}>Criar vínculo acadêmico</button>
                </form>
                <ul className='resource-list' aria-label='Vínculos acadêmicos'>
                  {links.map((link) => (
                    <li key={link.id}><span><strong>{students.find((student) => student.user_id === link.student_id)?.full_name ?? shortId(link.student_id)}</strong><small>{termName(link.term_id)} · {cohortName(link.cohort_id)} · {disciplineName(link.discipline_id)}</small></span><span className='status-pill status-active'>{link.term_status === 'ACTIVE' ? 'Ativo' : link.term_status === 'DRAFT' ? 'Rascunho' : 'Encerrado'}</span></li>
                  ))}
                </ul>
              </article>
            </div>

            <div className='academic-column'>
              <article className='private-card academic-card'>
                <div className='card-heading'>
                  <div><p className='eyebrow'>03 · Supervisores</p><h2>{editingSupervisorId ? 'Editar perfil' : 'Criar perfil de supervisor'}</h2></div>
                  <span className='card-count'>{supervisors.length}</span>
                </div>
                <p className='field-help'>Cadastre professor ou preceptor, área de atuação e limite padrão de supervisão.</p>
                <form className='compact-form' onSubmit={submitSupervisor} autoComplete='off'>
                  <label htmlFor='master-supervisor-user'>Usuário de acesso</label>
                  <select id='master-supervisor-user' value={supervisorForm.user_id} onChange={(event) => setSupervisorForm({ ...supervisorForm, user_id: event.target.value })} required disabled={Boolean(editingSupervisorId)}>
                    <option value=''>Selecione um usuário supervisor</option>
                    {supervisorUsers.map((user) => <option key={user.id} value={user.id}>{user.email}{supervisors.some((supervisor) => supervisor.user_id === user.id) ? ' · perfil já criado' : ''}</option>)}
                  </select>
                  <label htmlFor='master-supervisor-name'>Nome completo</label>
                  <input id='master-supervisor-name' value={supervisorForm.full_name} onChange={(event) => setSupervisorForm({ ...supervisorForm, full_name: event.target.value })} required />
                  <label htmlFor='master-supervisor-area'>Área profissional</label>
                  <input id='master-supervisor-area' value={supervisorForm.professional_area} onChange={(event) => setSupervisorForm({ ...supervisorForm, professional_area: event.target.value })} required />
                  <div className='form-grid'>
                    <div><label htmlFor='master-supervisor-kind'>Tipo</label><select id='master-supervisor-kind' value={supervisorForm.kind} onChange={(event) => setSupervisorForm({ ...supervisorForm, kind: event.target.value as Supervisor['kind'] })}><option value='PROFESSOR'>Professor</option><option value='PRECEPTOR'>Preceptor</option></select></div>
                    <div><label htmlFor='master-supervisor-limit'>Limite padrão</label><input id='master-supervisor-limit' type='number' min='1' max='100' value={supervisorForm.max_students_default} onChange={(event) => setSupervisorForm({ ...supervisorForm, max_students_default: event.target.value })} required /></div>
                  </div>
                  <button className='button button-primary' type='submit'>{editingSupervisorId ? 'Salvar supervisor' : 'Criar supervisor'}</button>
                  {editingSupervisorId && <button className='text-button' type='button' onClick={() => { setEditingSupervisorId(null); setSupervisorForm(emptySupervisor) }}>Cancelar edição</button>}
                </form>
                <ul className='resource-list' aria-label='Perfis de supervisores'>
                  {supervisors.map((supervisor) => (
                    <li key={supervisor.user_id}><span><strong>{supervisor.full_name}</strong><small>{kindLabel(supervisor.kind)} · {supervisor.professional_area} · até {supervisor.max_students_default} estudantes</small></span><button className='text-button' type='button' onClick={() => editSupervisor(supervisor)}>Editar</button></li>
                  ))}
                </ul>
                {supervisorUsers.length > supervisors.length && <p className='field-help'>Há usuários supervisores sem perfil acadêmico. Selecione um deles acima para criar o perfil.</p>}
              </article>

              <article className='private-card academic-card'>
                <div className='card-heading'><div><p className='eyebrow'>05 · Próximo passo</p><h2>Disponibilidade e escopos</h2></div></div>
                <p className='field-help'>Depois de criar os perfis, abra a configuração da clínica para definir serviços, ambientes, limites e permissões de revisão documental.</p>
                <Link className='button button-secondary' to='/app/clinicas'>Configurar escopos de supervisão <span aria-hidden='true'>→</span></Link>
              </article>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
