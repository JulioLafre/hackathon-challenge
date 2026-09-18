import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../../lib/api'

export type AuthenticatedProps = {
  token: string
}

type Term = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
}

type Course = {
  id: string
  name: string
  code: string
  is_active: boolean
}

type Discipline = {
  id: string
  course_id: string
  name: string
  code: string
  kind: 'DISCIPLINE' | 'INTERNSHIP'
  is_active: boolean
}

type Cohort = {
  id: string
  term_id: string
  course_id: string
  period: number
  label: string
  is_active: boolean
}

type ClassBlock = {
  id: string
  cohort_id: string
  discipline_id: string | null
  weekday: number
  start_time: string
  end_time: string
  time_zone: string
  is_active: boolean
}

type Interval = {
  weekday: number
  start_time: string
  end_time: string
  time_zone: string
}

type Availability = {
  owner_type: 'STUDENT' | 'SUPERVISOR'
  term_id: string
  time_zone: string
  intervals: Interval[]
}

function formError(error: unknown): string {
  return error instanceof Error ? error.message : 'Nao foi possivel concluir a operacao.'
}

function statusLabel(status: Term['status']): string {
  return status === 'ACTIVE' ? 'Ativo' : status === 'CLOSED' ? 'Encerrado' : 'Rascunho'
}

export function AcademicAdminPage({ token }: AuthenticatedProps) {
  const [terms, setTerms] = useState<Term[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [blocks, setBlocks] = useState<ClassBlock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [termForm, setTermForm] = useState({
    name: '',
    starts_on: '',
    ends_on: '',
  })
  const [courseForm, setCourseForm] = useState({ name: '', code: '' })
  const [disciplineForm, setDisciplineForm] = useState({
    course_id: '',
    name: '',
    code: '',
    kind: 'DISCIPLINE',
  })
  const [cohortForm, setCohortForm] = useState({
    term_id: '',
    course_id: '',
    period: '1',
    label: '',
  })
  const [blockForm, setBlockForm] = useState({
    cohort_id: '',
    discipline_id: '',
    weekday: '1',
    start_time: '',
    end_time: '',
  })
  const [editingTermId, setEditingTermId] = useState<string | null>(null)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [editingDisciplineId, setEditingDisciplineId] = useState<string | null>(null)
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [nextTerms, nextCourses, nextDisciplines, nextCohorts, nextBlocks] =
        await Promise.all([
          apiFetch<Term[]>(token, '/terms'),
          apiFetch<Course[]>(token, '/courses'),
          apiFetch<Discipline[]>(token, '/disciplines'),
          apiFetch<Cohort[]>(token, '/cohorts'),
          apiFetch<ClassBlock[]>(token, '/class-blocks'),
        ])
      setTerms(nextTerms)
      setCourses(nextCourses)
      setDisciplines(nextDisciplines)
      setCohorts(nextCohorts)
      setBlocks(nextBlocks)
      setCohortForm((current) => ({
        ...current,
        term_id: current.term_id || nextTerms[0]?.id || '',
        course_id: current.course_id || nextCourses[0]?.id || '',
      }))
      setDisciplineForm((current) => ({
        ...current,
        course_id: current.course_id || nextCourses[0]?.id || '',
      }))
      setBlockForm((current) => ({
        ...current,
        cohort_id: current.cohort_id || nextCohorts[0]?.id || '',
        discipline_id: current.discipline_id || nextDisciplines[0]?.id || '',
      }))
    } catch (loadError) {
      setError(formError(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function createTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const isEditing = editingTermId !== null
      await apiFetch<Term>(token, isEditing ? '/terms/' + editingTermId : '/terms', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(termForm),
      })
      setTermForm({ name: '', starts_on: '', ends_on: '' })
      setEditingTermId(null)
      setNotice(isEditing ? 'Semestre atualizado.' : 'Semestre criado como rascunho.')
      await refresh()
    } catch (submitError) {
      setError(formError(submitError))
    }
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const isEditing = editingCourseId !== null
      await apiFetch<Course>(token, isEditing ? '/courses/' + editingCourseId : '/courses', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(courseForm),
      })
      setCourseForm({ name: '', code: '' })
      setEditingCourseId(null)
      setNotice(isEditing ? 'Curso atualizado.' : 'Curso criado.')
      await refresh()
    } catch (submitError) {
      setError(formError(submitError))
    }
  }

  async function createDiscipline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const isEditing = editingDisciplineId !== null
      await apiFetch<Discipline>(token, isEditing ? '/disciplines/' + editingDisciplineId : '/disciplines', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(disciplineForm),
      })
      setDisciplineForm((current) => ({
        ...current,
        name: '',
        code: '',
      }))
      setEditingDisciplineId(null)
      setNotice(isEditing ? 'Disciplina atualizada.' : 'Disciplina criada.')
      await refresh()
    } catch (submitError) {
      setError(formError(submitError))
    }
  }

  async function createCohort(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const isEditing = editingCohortId !== null
      await apiFetch<Cohort>(token, isEditing ? '/cohorts/' + editingCohortId : '/cohorts', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...cohortForm,
          period: Number(cohortForm.period),
        }),
      })
      setCohortForm((current) => ({ ...current, label: '' }))
      setEditingCohortId(null)
      setNotice(isEditing ? 'Turma atualizada.' : 'Turma criada.')
      await refresh()
    } catch (submitError) {
      setError(formError(submitError))
    }
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await apiFetch(token, '/class-blocks', {
        method: 'POST',
        body: JSON.stringify({
          ...blockForm,
          weekday: Number(blockForm.weekday),
          discipline_id: blockForm.discipline_id || null,
        }),
      })
      setBlockForm((current) => ({ ...current, start_time: '', end_time: '' }))
      setNotice('Bloqueio academico adicionado.')
      await refresh()
    } catch (submitError) {
      setError(formError(submitError))
    }
  }

  async function activateTerm(term: Term) {
    setError(null)
    setNotice(null)
    try {
      await apiFetch<Term>(token, '/terms/' + term.id + '/activate', { method: 'POST' })
      setNotice('Semestre ativado. O anterior foi encerrado.')
      await refresh()
    } catch (submitError) {
      setError(formError(submitError))
    }
  }

  async function deactivateAcademic(path: string, id: string, label: string) {
    if (!window.confirm('Encerrar ou desativar ' + label + '? O historico sera preservado.')) return
    setError(null)
    setNotice(null)
    try {
      await apiFetch(token, path + '/' + id + '/deactivate', { method: 'POST' })
      setNotice(label + ' encerrado.')
      await refresh()
    } catch (actionError) {
      setError(formError(actionError))
    }
  }

  function editTerm(term: Term) {
    if (term.status === 'CLOSED') return
    setEditingTermId(term.id)
    setTermForm({ name: term.name, starts_on: term.starts_on, ends_on: term.ends_on })
  }

  function editCourse(course: Course) {
    setEditingCourseId(course.id)
    setCourseForm({ name: course.name, code: course.code })
  }

  function editDiscipline(discipline: Discipline) {
    setEditingDisciplineId(discipline.id)
    setDisciplineForm({ course_id: discipline.course_id, name: discipline.name, code: discipline.code, kind: discipline.kind })
  }

  function editCohort(cohort: Cohort) {
    setEditingCohortId(cohort.id)
    setCohortForm({ term_id: cohort.term_id, course_id: cohort.course_id, period: String(cohort.period), label: cohort.label })
  }

  return (
    <section className='private-content academics-page' aria-labelledby='academic-page-title'>
      <p className='eyebrow'>Configuração do semestre</p>
      <h1 id='academic-page-title'>Configuração acadêmica</h1>
      <p className='private-intro'>
        Crie o período acadêmico e cadastre a estrutura que será usada nas clínicas.
      </p>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status'>{notice}</p>}
      {isLoading ? (
        <p className='loading-message' role='status'>Carregando configuracao&hellip;</p>
      ) : (
        <div className='academic-layout'>
          <div className='academic-column'>
            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>01 · Período acadêmico</p>
                  <h2>Crie e ative o semestre</h2>
                </div>
                <span className='card-count'>{terms.length}</span>
              </div>
              <p className='field-help'>
                Comece por aqui: o semestre ativo define o período das ofertas e dos vínculos acadêmicos.
              </p>
              <form autoComplete='off' className='compact-form' onSubmit={createTerm}>
                <label htmlFor='term-name'>Nome do semestre</label>
                <input autoComplete='off' id='term-name' name='name' required value={termForm.name} onChange={(event) => setTermForm({ ...termForm, name: event.target.value })} />
                <div className='form-grid'>
                  <div>
                    <label htmlFor='term-start'>Inicio</label>
                    <input autoComplete='off' id='term-start' name='starts_on' type='date' required value={termForm.starts_on} onChange={(event) => setTermForm({ ...termForm, starts_on: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor='term-end'>Fim</label>
                    <input autoComplete='off' id='term-end' name='ends_on' type='date' required value={termForm.ends_on} onChange={(event) => setTermForm({ ...termForm, ends_on: event.target.value })} />
                  </div>
                </div>
                <button className='button button-primary' type='submit'>{editingTermId ? 'Salvar semestre' : 'Criar semestre'}</button>
                {editingTermId && <button className='text-button' type='button' onClick={() => { setEditingTermId(null); setTermForm({ name: '', starts_on: '', ends_on: '' }) }}>Cancelar edição</button>}
              </form>
              <ul className='resource-list'>
                {terms.map((term) => (
                  <li key={term.id}>
                    <span><strong>{term.name}</strong><small>{displayDate(term.starts_on)} a {displayDate(term.ends_on)}</small></span>
                    <span className='resource-actions'>
                      <span className={'status-pill status-' + term.status.toLowerCase()}>{statusLabel(term.status)}</span>
                      {term.status !== 'CLOSED' && <button className='text-button' type='button' onClick={() => editTerm(term)}>Editar</button>}
                      {term.status === 'DRAFT' && <button className='text-button' type='button' onClick={() => void activateTerm(term)}>Ativar</button>}
                      {term.status === 'ACTIVE' && <button className='text-button' type='button' onClick={() => void deactivateAcademic('/terms', term.id, 'Semestre')}>Encerrar</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>02 · Estrutura acadêmica</p>
                  <h2>Cursos e disciplinas</h2>
                </div>
                <span className='card-count'>{courses.length + disciplines.length}</span>
              </div>
              <p className='field-help'>
                Cadastre o curso primeiro; depois associe cada disciplina ao curso correspondente.
              </p>
              <div className='form-stack'>
                <form autoComplete='off' className='compact-form' onSubmit={createCourse}>
                <label htmlFor='course-name'>Nome do curso</label>
                  <input autoComplete='off' id='course-name' name='name' required value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} />
                  <label htmlFor='course-code'>Codigo do curso</label>
                  <input autoComplete='off' id='course-code' name='code' required value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} />
                  <button className='button button-secondary' type='submit'>{editingCourseId ? 'Salvar curso' : 'Criar curso'}</button>
                  {editingCourseId && <button className='text-button' type='button' onClick={() => { setEditingCourseId(null); setCourseForm({ name: '', code: '' }) }}>Cancelar edição</button>}
                </form>
                <form autoComplete='off' className='compact-form' onSubmit={createDiscipline}>
                  <label htmlFor='discipline-course'>Curso da disciplina</label>
                  <select id='discipline-course' name='course_id' required value={disciplineForm.course_id} onChange={(event) => setDisciplineForm({ ...disciplineForm, course_id: event.target.value })}>
                    <option value=''>Selecione</option>
                    {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                  </select>
                  <label htmlFor='discipline-name'>Nome da disciplina</label>
                  <input autoComplete='off' id='discipline-name' name='name' required value={disciplineForm.name} onChange={(event) => setDisciplineForm({ ...disciplineForm, name: event.target.value })} />
                  <div className='form-grid'>
                    <div>
                      <label htmlFor='discipline-code'>Codigo</label>
                      <input autoComplete='off' id='discipline-code' name='code' required value={disciplineForm.code} onChange={(event) => setDisciplineForm({ ...disciplineForm, code: event.target.value })} />
                    </div>
                    <div>
                      <label htmlFor='discipline-kind'>Tipo</label>
                      <select id='discipline-kind' name='kind' value={disciplineForm.kind} onChange={(event) => setDisciplineForm({ ...disciplineForm, kind: event.target.value })}>
                        <option value='DISCIPLINE'>Disciplina</option>
                        <option value='INTERNSHIP'>Estagio</option>
                      </select>
                    </div>
                  </div>
                  <button className='button button-secondary' type='submit'>{editingDisciplineId ? 'Salvar disciplina' : 'Criar disciplina'}</button>
                  {editingDisciplineId && <button className='text-button' type='button' onClick={() => { setEditingDisciplineId(null); setDisciplineForm({ course_id: courses[0]?.id ?? '', name: '', code: '', kind: 'DISCIPLINE' }) }}>Cancelar edição</button>}
                </form>
              </div>
              <ul className='resource-list'>
                {courses.map((course) => (
                  <li key={course.id}>
                    <span><strong>{course.name}</strong><small>{course.code} · {course.is_active ? 'Ativo' : 'Desativado'}</small></span>
                    <span className='resource-actions'>
                      {course.is_active && <button className='text-button' type='button' onClick={() => editCourse(course)}>Editar</button>}
                      {course.is_active && <button className='text-button' type='button' onClick={() => void deactivateAcademic('/courses', course.id, 'Curso')}>Desativar</button>}
                    </span>
                  </li>
                ))}
                {disciplines.map((discipline) => (
                  <li key={discipline.id}>
                    <span><strong>{discipline.name}</strong><small>{discipline.code} · {discipline.kind === 'INTERNSHIP' ? 'Estagio' : 'Disciplina'} · {courses.find((course) => course.id === discipline.course_id)?.name ?? 'Curso'} · {discipline.is_active ? 'Ativa' : 'Desativada'}</small></span>
                    <span className='resource-actions'>
                      {discipline.is_active && <button className='text-button' type='button' onClick={() => editDiscipline(discipline)}>Editar</button>}
                      {discipline.is_active && <button className='text-button' type='button' onClick={() => void deactivateAcademic('/disciplines', discipline.id, 'Disciplina')}>Desativar</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <div className='academic-column'>
            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>03 · Turmas e bloqueios</p>
                  <h2>Organize as turmas</h2>
                </div>
                <span className='card-count'>{cohorts.length}</span>
              </div>
              <p className='field-help'>
                Crie as turmas do semestre e registre os horários em que elas não podem atuar na clínica.
              </p>
              <form autoComplete='off' className='compact-form' onSubmit={createCohort}>
                <label htmlFor='cohort-term'>Semestre da turma</label>
                <select id='cohort-term' name='term_id' required value={cohortForm.term_id} onChange={(event) => setCohortForm({ ...cohortForm, term_id: event.target.value })}>
                  <option value=''>Selecione</option>
                  {terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                </select>
                <label htmlFor='cohort-course'>Curso da turma</label>
                <select id='cohort-course' name='course_id' required value={cohortForm.course_id} onChange={(event) => setCohortForm({ ...cohortForm, course_id: event.target.value })}>
                  <option value=''>Selecione</option>
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                </select>
                <div className='form-grid'>
                  <div>
                    <label htmlFor='cohort-period'>Periodo</label>
                    <input autoComplete='off' id='cohort-period' min='1' name='period' type='number' required value={cohortForm.period} onChange={(event) => setCohortForm({ ...cohortForm, period: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor='cohort-label'>Identificador da turma</label>
                    <input autoComplete='off' id='cohort-label' name='label' required value={cohortForm.label} onChange={(event) => setCohortForm({ ...cohortForm, label: event.target.value })} />
                  </div>
                </div>
                <button className='button button-secondary' type='submit'>{editingCohortId ? 'Salvar turma' : 'Criar turma'}</button>
                {editingCohortId && <button className='text-button' type='button' onClick={() => { setEditingCohortId(null); setCohortForm({ term_id: terms[0]?.id ?? '', course_id: courses[0]?.id ?? '', period: '1', label: '' }) }}>Cancelar edição</button>}
              </form>
              <ul className='resource-list'>
                {cohorts.map((cohort) => (
                  <li key={cohort.id}>
                    <span><strong>{cohort.label}</strong><small>{courses.find((course) => course.id === cohort.course_id)?.name ?? 'Curso'} · periodo {cohort.period} · {cohort.is_active ? 'Ativa' : 'Desativada'}</small></span>
                    <span className='resource-actions'>
                      {cohort.is_active && <button className='text-button' type='button' onClick={() => editCohort(cohort)}>Editar</button>}
                      {cohort.is_active && <button className='text-button' type='button' onClick={() => void deactivateAcademic('/cohorts', cohort.id, 'Turma')}>Desativar</button>}
                    </span>
                  </li>
                ))}
              </ul>
              <form autoComplete='off' className='compact-form form-divider' onSubmit={createBlock}>
                <label htmlFor='block-cohort'>Turma do bloqueio</label>
                <select id='block-cohort' name='cohort_id' required value={blockForm.cohort_id} onChange={(event) => setBlockForm({ ...blockForm, cohort_id: event.target.value })}>
                  <option value=''>Selecione</option>
                  {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.label}</option>)}
                </select>
                <label htmlFor='block-discipline'>Disciplina ou estagio</label>
                <select id='block-discipline' name='discipline_id' value={blockForm.discipline_id} onChange={(event) => setBlockForm({ ...blockForm, discipline_id: event.target.value })}>
                  <option value=''>Todos os vinculos da turma</option>
                  {disciplines.map((discipline) => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}
                </select>
                <div className='form-grid'>
                  <div>
                    <label htmlFor='block-weekday'>Dia da semana</label>
                    <select id='block-weekday' name='weekday' value={blockForm.weekday} onChange={(event) => setBlockForm({ ...blockForm, weekday: event.target.value })}>
                      <option value='0'>Domingo</option><option value='1'>Segunda</option><option value='2'>Terca</option><option value='3'>Quarta</option><option value='4'>Quinta</option><option value='5'>Sexta</option><option value='6'>Sabado</option>
                    </select>
                  </div>
                  <div />
                </div>
                <div className='form-grid'>
                  <div>
                    <label htmlFor='block-start'>Inicio do bloqueio</label>
                    <input autoComplete='off' id='block-start' name='start_time' type='time' required value={blockForm.start_time} onChange={(event) => setBlockForm({ ...blockForm, start_time: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor='block-end'>Fim do bloqueio</label>
                    <input autoComplete='off' id='block-end' name='end_time' type='time' required value={blockForm.end_time} onChange={(event) => setBlockForm({ ...blockForm, end_time: event.target.value })} />
                  </div>
                </div>
                <p className='field-help'>Fuso institucional: America/Sao_Paulo. Intervalos usam [inicio, fim).</p>
                <button className='button button-secondary' type='submit'>Adicionar bloqueio</button>
              </form>
              <ul className='resource-list'>
                {blocks.map((block) => (
                  <li key={block.id}>
                    <span><strong>{cohorts.find((cohort) => cohort.id === block.cohort_id)?.label ?? 'Turma'}</strong><small>{block.discipline_id ? disciplines.find((discipline) => discipline.id === block.discipline_id)?.name : 'Todos os vinculos'} · {weekdayLabels[block.weekday]} · {displayTime(block.start_time)}-{displayTime(block.end_time)}</small></span>
                    <span className='status-pill status-active'>Ativo</span>
                  </li>
                ))}
                {blocks.length === 0 && <li><span className='field-help'>Nenhum bloqueio academico cadastrado.</span></li>}
              </ul>
            </article>
          </div>
        </div>
      )}
    </section>
  )
}

const weekdayLabels = [
  'Domingo',
  'Segunda',
  'Terca',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sabado',
]

function displayTime(value: string): string {
  return value.slice(0, 5)
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

function displayDate(value: string): string {
  return dateFormatter.format(new Date(value + 'T00:00:00Z'))
}

export function AvailabilityPage({ token }: AuthenticatedProps) {
  const [terms, setTerms] = useState<Term[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [intervals, setIntervals] = useState<Interval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadAvailability = useCallback(
    async (termId: string) => {
      if (!termId) {
        setIntervals([])
        return
      }
      const response = await apiFetch<Availability>(
        token,
        '/me/availability?term_id=' + encodeURIComponent(termId),
      )
      setIntervals(
        response.intervals.map((interval) => ({
          ...interval,
          start_time: displayTime(interval.start_time),
          end_time: displayTime(interval.end_time),
        })),
      )
    },
    [token],
  )

  const loadTerms = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const nextTerms = await apiFetch<Term[]>(token, '/me/academic-terms')
      const nextSelectedTermId = nextTerms[0]?.id ?? ''
      setTerms(nextTerms)
      setSelectedTermId(nextSelectedTermId)
      await loadAvailability(nextSelectedTermId)
    } catch (loadError) {
      setError(formError(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [loadAvailability, token])

  useEffect(() => {
    void loadTerms()
  }, [loadTerms])

  async function handleTermChange(termId: string) {
    setSelectedTermId(termId)
    setError(null)
    setNotice(null)
    try {
      await loadAvailability(termId)
    } catch (loadError) {
      setError(formError(loadError))
    }
  }

  function updateInterval(index: number, changes: Partial<Interval>) {
    setIntervals((current) =>
      current.map((interval, intervalIndex) =>
        intervalIndex === index ? { ...interval, ...changes } : interval,
      ),
    )
  }

  function addInterval() {
    setIntervals((current) => [
      ...current,
      {
        weekday: 1,
        start_time: '08:00',
        end_time: '10:00',
        time_zone: 'America/Sao_Paulo',
      },
    ])
  }

  function removeInterval(index: number) {
    setIntervals((current) => current.filter((_, intervalIndex) => intervalIndex !== index))
  }

  async function saveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTermId) {
      setError('Nenhum semestre editavel esta disponivel.')
      return
    }
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await apiFetch<Availability>(token, '/me/availability', {
        method: 'PUT',
        body: JSON.stringify({
          term_id: selectedTermId,
          intervals: intervals.map((interval) => ({
            ...interval,
            time_zone: 'America/Sao_Paulo',
          })),
        }),
      })
      setIntervals(
        response.intervals.map((interval) => ({
          ...interval,
          start_time: displayTime(interval.start_time),
          end_time: displayTime(interval.end_time),
        })),
      )
      setNotice('Disponibilidade salva.')
    } catch (saveError) {
      setError(formError(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className='private-content availability-page' aria-labelledby='availability-page-title'>
      <p className='eyebrow'>Agenda semanal</p>
      <h1 id='availability-page-title'>Minha disponibilidade</h1>
      <p className='private-intro'>Informe os horarios em que voce pode participar das atividades do semestre.</p>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status'>{notice}</p>}
      {isLoading ? (
        <p className='loading-message' role='status'>Carregando disponibilidade&hellip;</p>
      ) : terms.length === 0 ? (
        <article className='private-card academic-card'>
          <h2>Nenhum semestre editavel</h2>
          <p>O Master precisa abrir um semestre antes do preenchimento da disponibilidade.</p>
        </article>
      ) : (
        <form autoComplete='off' className='private-card availability-form' onSubmit={saveAvailability}>
          <label htmlFor='availability-term'>Semestre</label>
          <select
            id='availability-term'
            name='term_id'
            value={selectedTermId}
            onChange={(event) => void handleTermChange(event.target.value)}
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>{term.name} · {statusLabel(term.status)}</option>
            ))}
          </select>
          <p className='field-help'>Use o fuso institucional America/Sao_Paulo. Intervalos podem encostar, mas nao podem se sobrepor.</p>
          <div className='availability-list'>
            {intervals.map((interval, index) => (
              <div className='availability-row' key={`${index}-${interval.weekday}`}>
                <div>
                  <label htmlFor={`availability-day-${index}`}>Dia</label>
                  <select
                    id={`availability-day-${index}`}
                    name={`intervals.${index}.weekday`}
                    value={interval.weekday}
                    onChange={(event) => updateInterval(index, { weekday: Number(event.target.value) })}
                  >
                    {weekdayLabels.map((label, weekday) => (
                      <option key={label} value={weekday}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`availability-start-${index}`}>Inicio</label>
                  <input
                    id={`availability-start-${index}`}
                    name={`intervals.${index}.start_time`}
                    autoComplete='off'
                    type='time'
                    value={interval.start_time}
                    onChange={(event) => updateInterval(index, { start_time: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor={`availability-end-${index}`}>Fim</label>
                  <input
                    id={`availability-end-${index}`}
                    name={`intervals.${index}.end_time`}
                    autoComplete='off'
                    type='time'
                    value={interval.end_time}
                    onChange={(event) => updateInterval(index, { end_time: event.target.value })}
                    required
                  />
                </div>
                <button className='text-button' type='button' onClick={() => removeInterval(index)}>
                  Remover
                </button>
              </div>
            ))}
          </div>
          <div className='availability-actions'>
            <button className='button button-secondary' type='button' onClick={addInterval}>Adicionar intervalo</button>
            <button className='button button-primary' type='submit' disabled={isSaving}>
              {isSaving ? 'Salvando\u2026' : 'Salvar disponibilidade'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

type ManagedStudent = { user_id: string; registration: string; full_name: string }
type ManagedSupervisor = { user_id: string; full_name: string; professional_area: string; max_students_default: number }

export function MasterAvailabilityPage({ token }: AuthenticatedProps) {
  const [terms, setTerms] = useState<Term[]>([])
  const [students, setStudents] = useState<ManagedStudent[]>([])
  const [supervisors, setSupervisors] = useState<ManagedSupervisor[]>([])
  const [ownerType, setOwnerType] = useState<'STUDENT' | 'SUPERVISOR'>('STUDENT')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedTermId, setSelectedTermId] = useState('')
  const [intervals, setIntervals] = useState<Interval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadAvailability = useCallback(async (nextOwnerType: 'STUDENT' | 'SUPERVISOR', nextUserId: string, nextTermId: string) => {
    if (!nextUserId || !nextTermId) {
      setIntervals([])
      return
    }
    const response = await apiFetch<Availability>(token, `/managed-availability?user_id=${encodeURIComponent(nextUserId)}&owner_type=${nextOwnerType}&term_id=${encodeURIComponent(nextTermId)}`)
    setIntervals(response.intervals.map((interval) => ({ ...interval, start_time: displayTime(interval.start_time), end_time: displayTime(interval.end_time) })))
  }, [token])

  const loadPage = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [nextTerms, nextStudents, nextSupervisors] = await Promise.all([
        apiFetch<Term[]>(token, '/terms'),
        apiFetch<ManagedStudent[]>(token, '/students'),
        apiFetch<ManagedSupervisor[]>(token, '/supervisors'),
      ])
      const editableTerms = nextTerms.filter((term) => term.status !== 'CLOSED')
      const nextUserId = nextStudents[0]?.user_id ?? nextSupervisors[0]?.user_id ?? ''
      const nextOwnerType = nextStudents.length > 0 ? 'STUDENT' : 'SUPERVISOR'
      const nextTermId = editableTerms[0]?.id ?? ''
      setTerms(editableTerms)
      setStudents(nextStudents)
      setSupervisors(nextSupervisors)
      setOwnerType(nextOwnerType)
      setSelectedUserId(nextUserId)
      setSelectedTermId(nextTermId)
      await loadAvailability(nextOwnerType, nextUserId, nextTermId)
    } catch (loadError) {
      setError(formError(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [loadAvailability, token])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  async function selectTarget(nextOwnerType: 'STUDENT' | 'SUPERVISOR', nextUserId: string) {
    setOwnerType(nextOwnerType)
    setSelectedUserId(nextUserId)
    setError(null)
    setNotice(null)
    try {
      await loadAvailability(nextOwnerType, nextUserId, selectedTermId)
    } catch (loadError) {
      setError(formError(loadError))
    }
  }

  async function selectTerm(nextTermId: string) {
    setSelectedTermId(nextTermId)
    setError(null)
    setNotice(null)
    try {
      await loadAvailability(ownerType, selectedUserId, nextTermId)
    } catch (loadError) {
      setError(formError(loadError))
    }
  }

  function updateInterval(index: number, changes: Partial<Interval>) {
    setIntervals((current) => current.map((interval, intervalIndex) => intervalIndex === index ? { ...interval, ...changes } : interval))
  }

  function addInterval() {
    setIntervals((current) => [...current, { weekday: 1, start_time: '08:00', end_time: '10:00', time_zone: 'America/Sao_Paulo' }])
  }

  function removeInterval(index: number) {
    setIntervals((current) => current.filter((_, intervalIndex) => intervalIndex !== index))
  }

  async function saveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedUserId || !selectedTermId) {
      setError('Escolha o perfil e o semestre antes de salvar.')
      return
    }
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await apiFetch<Availability>(token, '/managed-availability', {
        method: 'PUT',
        body: JSON.stringify({
          user_id: selectedUserId,
          owner_type: ownerType,
          term_id: selectedTermId,
          intervals: intervals.map((interval) => ({ ...interval, time_zone: 'America/Sao_Paulo' })),
        }),
      })
      setIntervals(response.intervals.map((interval) => ({ ...interval, start_time: displayTime(interval.start_time), end_time: displayTime(interval.end_time) })))
      setNotice('Disponibilidade do perfil atualizada.')
    } catch (saveError) {
      setError(formError(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const targetOptions = ownerType === 'STUDENT' ? students : supervisors

  return (
    <section className='private-content availability-page' aria-labelledby='master-availability-page-title'>
      <p className='eyebrow'>Gestao administrativa</p>
      <h1 id='master-availability-page-title'>Disponibilidade de pessoas</h1>
      <p className='private-intro'>Selecione um estudante ou supervisor para manter a disponibilidade semanal do semestre.</p>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status'>{notice}</p>}
      {isLoading ? <p className='loading-message' role='status'>Carregando disponibilidades...</p> : terms.length === 0 ? (
        <article className='private-card academic-card'><h2>Nenhum semestre editavel</h2><p>Crie ou ative um semestre antes de gerenciar disponibilidades.</p></article>
      ) : (
        <form autoComplete='off' className='private-card availability-form' onSubmit={saveAvailability}>
          <div className='form-grid'>
            <div>
              <label htmlFor='master-availability-owner-type'>Perfil</label>
              <select id='master-availability-owner-type' value={ownerType} onChange={(event) => { const nextType = event.target.value as 'STUDENT' | 'SUPERVISOR'; const nextUser = nextType === 'STUDENT' ? students[0]?.user_id ?? '' : supervisors[0]?.user_id ?? ''; void selectTarget(nextType, nextUser) }}>
                <option value='STUDENT'>Estudante</option>
                <option value='SUPERVISOR'>Supervisor</option>
              </select>
            </div>
            <div>
              <label htmlFor='master-availability-user'>Pessoa</label>
              <select id='master-availability-user' value={selectedUserId} onChange={(event) => void selectTarget(ownerType, event.target.value)}>
                <option value=''>Selecione</option>
                {targetOptions.map((person) => <option key={person.user_id} value={person.user_id}>{person.full_name}{'registration' in person ? ' - ' + person.registration : ''}</option>)}
              </select>
            </div>
          </div>
          <label htmlFor='master-availability-term'>Semestre</label>
          <select id='master-availability-term' value={selectedTermId} onChange={(event) => void selectTerm(event.target.value)}>
            {terms.map((term) => <option key={term.id} value={term.id}>{term.name} - {statusLabel(term.status)}</option>)}
          </select>
          <p className='field-help'>Use America/Sao_Paulo. Intervalos adjacentes sao permitidos; sobreposicoes sao rejeitadas pela API.</p>
          <div className='availability-list'>
            {intervals.map((interval, index) => (
              <div className='availability-row' key={`${index}-${interval.weekday}`}>
                <div><label htmlFor={`master-availability-day-${index}`}>Dia</label><select id={`master-availability-day-${index}`} value={interval.weekday} onChange={(event) => updateInterval(index, { weekday: Number(event.target.value) })}>{weekdayLabels.map((label, weekday) => <option key={label} value={weekday}>{label}</option>)}</select></div>
                <div><label htmlFor={`master-availability-start-${index}`}>Inicio</label><input id={`master-availability-start-${index}`} type='time' value={interval.start_time} onChange={(event) => updateInterval(index, { start_time: event.target.value })} required /></div>
                <div><label htmlFor={`master-availability-end-${index}`}>Fim</label><input id={`master-availability-end-${index}`} type='time' value={interval.end_time} onChange={(event) => updateInterval(index, { end_time: event.target.value })} required /></div>
                <button className='text-button' type='button' onClick={() => removeInterval(index)}>Remover</button>
              </div>
            ))}
          </div>
          <div className='availability-actions'><button className='button button-secondary' type='button' onClick={addInterval}>Adicionar intervalo</button><button className='button button-primary' type='submit' disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar disponibilidade'}</button></div>
        </form>
      )}
    </section>
  )
}
