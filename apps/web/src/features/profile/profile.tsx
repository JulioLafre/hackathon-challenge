import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../../lib/api'
import type { AuthenticatedProps } from '../academics/academics'

type StudentProfile = {
  user_id: string
  registration: string
  full_name: string
  phone: string | null
}

type ProfileForm = {
  registration: string
  full_name: string
  phone: string
}

const emptyForm: ProfileForm = {
  registration: '',
  full_name: '',
  phone: '',
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Nao foi possivel concluir a operacao.'
}

export function StudentProfilePage({ token }: AuthenticatedProps) {
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    apiFetch<StudentProfile>(token, '/me/student')
      .then((profile) => {
        if (cancelled) return
        setForm({
          registration: profile.registration,
          full_name: profile.full_name,
          phone: profile.phone ?? '',
        })
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setIsSaving(true)
    try {
      const profile = await apiFetch<StudentProfile>(token, '/me/student', {
        method: 'PATCH',
        body: JSON.stringify({
          registration: form.registration.trim(),
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
        }),
      })
      setForm({
        registration: profile.registration,
        full_name: profile.full_name,
        phone: profile.phone ?? '',
      })
      setNotice('Perfil atualizado.')
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className='private-content profile-page' aria-labelledby='student-profile-page-title'>
      <p className='eyebrow'>Meu cadastro</p>
      <h1 id='student-profile-page-title'>Meu perfil.</h1>
      <p className='private-intro'>
        Mantenha seus dados acadêmicos e seu contato atualizados para a equipe.
      </p>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status' aria-live='polite'>{notice}</p>}
      {isLoading && <p className='loading-message' role='status' aria-live='polite'>Carregando perfil...</p>}
      {!isLoading && (
        <article className='private-card profile-card'>
          <div className='card-heading'>
            <div>
              <p className='eyebrow'>Dados pessoais</p>
              <h2>Informacoes para sua jornada</h2>
            </div>
          </div>
          <form className='compact-form' onSubmit={saveProfile} autoComplete='off'>
            <label htmlFor='student-profile-name'>Nome completo</label>
            <input
              id='student-profile-name'
              value={form.full_name}
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              required
              minLength={1}
              maxLength={180}
              autoComplete='name'
            />
            <label htmlFor='student-profile-registration'>Matricula</label>
            <input
              id='student-profile-registration'
              value={form.registration}
              onChange={(event) => setForm((current) => ({ ...current, registration: event.target.value }))}
              required
              minLength={1}
              maxLength={80}
            />
            <label htmlFor='student-profile-phone'>Telefone (opcional)</label>
            <input
              id='student-profile-phone'
              type='tel'
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              maxLength={30}
              autoComplete='tel'
            />
            <p className='field-help'>
              O e-mail e o papel de acesso continuam sob administracao do Master.
            </p>
            <button className='button button-primary' type='submit' disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </form>
        </article>
      )}
    </section>
  )
}
