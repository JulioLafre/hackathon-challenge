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

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [nextTerms, nextCourses, nextDisciplines, nextCohorts] =
        await Promise.all([
          apiFetch<Term[]>(token, '/terms'),
          apiFetch<Course[]>(token, '/courses'),
          apiFetch<Discipline[]>(token, '/disciplines'),
          apiFetch<Cohort[]>(token, '/cohorts'),
        ])
      setTerms(nextTerms)
      setCourses(nextCourses)
      setDisciplines(nextDisciplines)
      setCohorts(nextCohorts)
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
      await apiFetch<Term>(token, '/terms', {
        method: 'POST',
        body: JSON.stringify(termForm),
      })
      setTermForm({ name: '', starts_on: '', ends_on: '' })
      setNotice('Semestre criado como rascunho.')
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
      await apiFetch<Course>(token, '/courses', {
        method: 'POST',
        body: JSON.stringify(courseForm),
      })
      setCourseForm({ name: '', code: '' })
      setNotice('Curso criado.')
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
      await apiFetch<Discipline>(token, '/disciplines', {
        method: 'POST',
        body: JSON.stringify(disciplineForm),
      })
      setDisciplineForm((current) => ({
        ...current,
        name: '',
        code: '',
      }))
      setNotice('Disciplina criada.')
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
      await apiFetch<Cohort>(token, '/cohorts', {
        method: 'POST',
        body: JSON.stringify({
          ...cohortForm,
          period: Number(cohortForm.period),
        }),
      })
      setCohortForm((current) => ({ ...current, label: '' }))
      setNotice('Turma criada.')
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

  return (
    <section className='private-content academics-page' aria-labelledby='academic-page-title'>
      <p className='eyebrow'>Configuracao do semestre</p>
      <h1 id='academic-page-title'>Configuracao academica</h1>
      <p className='private-intro'>
        Monte a grade e os vinculos de um semestre sem alterar o codigo do sistema.
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
                  <p className='eyebrow'>01 · Calendario</p>
                  <h2>Semestres</h2>
                </div>
                <span className='card-count'>{terms.length}</span>
              </div>
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
                <button className='button button-primary' type='submit'>Criar semestre</button>
              </form>
              <ul className='resource-list'>
                {terms.map((term) => (
                  <li key={term.id}>
                    <span><strong>{term.name}</strong><small>{displayDate(term.starts_on)} a {displayDate(term.ends_on)}</small></span>
                    <span className='resource-actions'>
                      <span className={'status-pill status-' + term.status.toLowerCase()}>{statusLabel(term.status)}</span>
                      {term.status !== 'ACTIVE' && term.status !== 'CLOSED' && <button className='text-button' type='button' onClick={() => void activateTerm(term)}>Ativar</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>02 · Pessoas</p>
                  <h2>Grade academica</h2>
                </div>
                <span className='card-count'>{cohorts.length}</span>
              </div>
              <div className='form-stack'>
                <form autoComplete='off' className='compact-form' onSubmit={createCourse}>
                <label htmlFor='course-name'>Nome do curso</label>
                  <input autoComplete='off' id='course-name' name='name' required value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} />
                  <label htmlFor='course-code'>Codigo do curso</label>
                  <input autoComplete='off' id='course-code' name='code' required value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} />
                  <button className='button button-secondary' type='submit'>Criar curso</button>
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
                  <button className='button button-secondary' type='submit'>Criar disciplina</button>
                </form>
              </div>
            </article>
          </div>

          <div className='academic-column'>
            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div>
                  <p className='eyebrow'>03 · Turmas</p>
                  <h2>Vinculos e bloqueios</h2>
                </div>
                <span className='card-count'>{disciplines.length}</span>
              </div>
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
                <button className='button button-secondary' type='submit'>Criar turma</button>
              </form>
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
