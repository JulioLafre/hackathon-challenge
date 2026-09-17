import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { apiFetch } from '../../lib/api'
import { type AuthenticatedProps } from '../academics/academics'

type ActiveEntity = { id: string; name: string; is_active: boolean }
type Clinic = ActiveEntity & { address_label: string }
type Environment = ActiveEntity & { clinic_id: string }
type Room = ActiveEntity & { environment_id: string }
type Term = { id: string; name: string; status: 'DRAFT' | 'ACTIVE' | 'CLOSED' }
type Discipline = { id: string; name: string; is_active: boolean }
type Service = ActiveEntity & { discipline_id: string; duration_minutes: number }
type Supervisor = { user_id: string; full_name: string; max_students_default: number }
type Config = { id: string; clinic_id: string; term_id: string; max_simultaneous_appointments: number; max_students: number }
type Requirement = { id: string; service_id: string; equipment_type_id: string; units_per_appointment: number }
type Scope = { id: string; supervisor_id: string; term_id: string; service_id: string; environment_id: string; can_review_documents: boolean; max_students_override: number | null; is_active: boolean }

const emptyClinic = { name: '', address_label: '' }
const emptyEnvironment = { clinic_id: '', name: '' }
const emptyRoom = { environment_id: '', name: '' }
const emptyEquipment = { name: '' }
const emptyQuantity = { environment_id: '', equipment_type_id: '', quantity: '0' }
const emptyConfig = { clinic_id: '', term_id: '', max_simultaneous_appointments: '1', max_students: '1' }
const emptyService = { discipline_id: '', name: '', duration_minutes: '60' }
const emptyRequirement = { service_id: '', equipment_type_id: '', units: '1' }
const emptyScope = { supervisor_id: '', term_id: '', service_id: '', environment_id: '', override: '', review: false }

function formError(error: unknown): string {
  return error instanceof Error ? error.message : 'Nao foi possivel concluir a operacao.'
}

function Field({ id, label, children }: { id?: string; label: string; children: ReactNode }) {
  return <div><label htmlFor={id}>{label}</label>{children}</div>
}

function Options({ items }: { items: Array<{ id: string; name: string }> }) {
  return <><option value=''>Selecione</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</>
}

export function ClinicAdminPage({ token }: AuthenticatedProps) {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [equipment, setEquipment] = useState<ActiveEntity[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [scopes, setScopes] = useState<Scope[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [clinicForm, setClinicForm] = useState(emptyClinic)
  const [environmentForm, setEnvironmentForm] = useState(emptyEnvironment)
  const [roomForm, setRoomForm] = useState(emptyRoom)
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipment)
  const [quantityForm, setQuantityForm] = useState(emptyQuantity)
  const [configForm, setConfigForm] = useState(emptyConfig)
  const [serviceForm, setServiceForm] = useState(emptyService)
  const [requirementForm, setRequirementForm] = useState(emptyRequirement)
  const [scopeForm, setScopeForm] = useState(emptyScope)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [
        nextClinics, nextEnvironments, nextRooms, nextEquipment, nextTerms,
        nextDisciplines, nextServices, nextSupervisors, nextConfigs,
        nextRequirements, nextScopes,
      ] = await Promise.all([
        apiFetch<Clinic[]>(token, '/clinics'),
        apiFetch<Environment[]>(token, '/environments'),
        apiFetch<Room[]>(token, '/rooms'),
        apiFetch<ActiveEntity[]>(token, '/equipment-types'),
        apiFetch<Term[]>(token, '/terms'),
        apiFetch<Discipline[]>(token, '/disciplines'),
        apiFetch<Service[]>(token, '/services'),
        apiFetch<Supervisor[]>(token, '/supervisors'),
        apiFetch<Config[]>(token, '/clinic-term-configs'),
        apiFetch<Requirement[]>(token, '/service-equipment-requirements'),
        apiFetch<Scope[]>(token, '/supervisor-service-scopes'),
      ])
      setClinics(nextClinics)
      setEnvironments(nextEnvironments)
      setRooms(nextRooms)
      setEquipment(nextEquipment)
      setTerms(nextTerms)
      setDisciplines(nextDisciplines)
      setServices(nextServices)
      setSupervisors(nextSupervisors)
      setConfigs(nextConfigs)
      setRequirements(nextRequirements)
      setScopes(nextScopes)
      setEnvironmentForm((current) => ({
        ...current,
        clinic_id: current.clinic_id || nextClinics.find((item) => item.is_active)?.id || '',
      }))
      setRoomForm((current) => ({
        ...current,
        environment_id: current.environment_id || nextEnvironments.find((item) => item.is_active)?.id || '',
      }))
      setQuantityForm((current) => ({
        ...current,
        environment_id: current.environment_id || nextEnvironments.find((item) => item.is_active)?.id || '',
        equipment_type_id: current.equipment_type_id || nextEquipment.find((item) => item.is_active)?.id || '',
      }))
      setConfigForm((current) => ({
        ...current,
        clinic_id: current.clinic_id || nextClinics.find((item) => item.is_active)?.id || '',
        term_id: current.term_id || nextTerms.find((item) => item.status !== 'CLOSED')?.id || '',
      }))
      setServiceForm((current) => ({
        ...current,
        discipline_id: current.discipline_id || nextDisciplines.find((item) => item.is_active)?.id || '',
      }))
      setRequirementForm((current) => ({
        ...current,
        service_id: current.service_id || nextServices.find((item) => item.is_active)?.id || '',
        equipment_type_id: current.equipment_type_id || nextEquipment.find((item) => item.is_active)?.id || '',
      }))
      setScopeForm((current) => ({
        ...current,
        supervisor_id: current.supervisor_id || nextSupervisors[0]?.user_id || '',
        term_id: current.term_id || nextTerms.find((item) => item.status !== 'CLOSED')?.id || '',
        service_id: current.service_id || nextServices.find((item) => item.is_active)?.id || '',
        environment_id: current.environment_id || nextEnvironments.find((item) => item.is_active)?.id || '',
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

  async function createResource(path: string, body: object, message: string, reset: () => void) {
    setError(null)
    setNotice(null)
    try {
      await apiFetch(token, path, { method: 'POST', body: JSON.stringify(body) })
      reset()
      setNotice(message)
      await refresh()
    } catch (submitError) {
      setError(formError(submitError))
    }
  }

  const submit = (
    event: FormEvent<HTMLFormElement>,
    path: string,
    body: object,
    message: string,
    reset: () => void,
  ) => {
    event.preventDefault()
    void createResource(path, body, message, reset)
  }

  const activeClinics = clinics.filter((item) => item.is_active)
  const activeEnvironments = environments.filter((item) => item.is_active)
  const activeEquipment = equipment.filter((item) => item.is_active)
  const activeTerms = terms.filter((item) => item.status !== 'CLOSED')
  const activeDisciplines = disciplines.filter((item) => item.is_active)
  const activeServices = services.filter((item) => item.is_active)

  return (
    <section className='private-content academics-page' aria-labelledby='clinic-page-title'>
      <p className='eyebrow'>Configuração da operação</p>
      <h1 id='clinic-page-title'>Configuração da clínica</h1>
      <p className='private-intro'>Cadastre a clínica e seus recursos antes de definir limites, serviços e supervisão.</p>
      {error && <p className='form-error' role='alert'>{error}</p>}
      {notice && <p className='form-notice' role='status'>{notice}</p>}
      {isLoading ? <p className='loading-message'>Carregando configuracao...</p> : (
        <div className='academic-layout clinic-page'>
          <div className='academic-column'>
            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>01 · Unidade e ambientes</p><h2>Comece pela clínica</h2></div>
                <span className='card-count'>{clinics.length}</span>
              </div>
              <p className='field-help'>Crie a unidade e depois associe os ambientes que serão usados nos atendimentos.</p>
              <form className='compact-form' onSubmit={(event) => submit(event, '/clinics', clinicForm, 'Clinica criada.', () => setClinicForm(emptyClinic))}>
                <Field id='clinic-name' label='Nome da clinica'>
                  <input id='clinic-name' value={clinicForm.name} onChange={(event) => setClinicForm({ ...clinicForm, name: event.target.value })} required />
                </Field>
                <Field id='clinic-address' label='Localizacao'>
                  <input id='clinic-address' value={clinicForm.address_label} onChange={(event) => setClinicForm({ ...clinicForm, address_label: event.target.value })} required />
                </Field>
                <button className='button button-primary' type='submit'>Adicionar clinica</button>
              </form>
              <form className='compact-form form-divider' onSubmit={(event) => submit(event, '/environments', environmentForm, 'Ambiente criado.', () => setEnvironmentForm({ ...environmentForm, name: '' }))}>
                <Field id='environment-clinic' label='Clinica'>
                  <select id='environment-clinic' value={environmentForm.clinic_id} onChange={(event) => setEnvironmentForm({ ...environmentForm, clinic_id: event.target.value })} required><Options items={activeClinics} /></select>
                </Field>
                <Field id='environment-name' label='Nome do ambiente'>
                  <input id='environment-name' value={environmentForm.name} onChange={(event) => setEnvironmentForm({ ...environmentForm, name: event.target.value })} required />
                </Field>
                <button className='button button-secondary' type='submit'>Adicionar ambiente</button>
              </form>
              <ul className='resource-list'>{environments.map((item) => <li key={item.id}><span>{item.name}<small>{item.is_active ? 'Ativo' : 'Desativado'}</small></span><small>{clinics.find((clinic) => clinic.id === item.clinic_id)?.name}</small></li>)}</ul>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>02 · Capacidade física</p><h2>Salas e equipamentos</h2></div>
                <span className='card-count'>{rooms.length + equipment.length}</span>
              </div>
              <p className='field-help'>Registre salas e equipamentos: eles determinam quantos atendimentos podem acontecer ao mesmo tempo.</p>
              <form className='compact-form' onSubmit={(event) => submit(event, '/rooms', roomForm, 'Sala criada.', () => setRoomForm({ ...roomForm, name: '' }))}>
                <Field id='room-environment' label='Ambiente'>
                  <select id='room-environment' value={roomForm.environment_id} onChange={(event) => setRoomForm({ ...roomForm, environment_id: event.target.value })} required><Options items={activeEnvironments} /></select>
                </Field>
                <Field id='room-name' label='Nome da sala'><input id='room-name' value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} required /></Field>
                <button className='button button-secondary' type='submit'>Adicionar sala</button>
              </form>
              <form className='compact-form form-divider' onSubmit={(event) => submit(event, '/equipment-types', equipmentForm, 'Equipamento criado.', () => setEquipmentForm(emptyEquipment))}>
                <Field id='equipment-name' label='Tipo de equipamento'><input id='equipment-name' value={equipmentForm.name} onChange={(event) => setEquipmentForm({ name: event.target.value })} required /></Field>
                <button className='button button-secondary' type='submit'>Adicionar equipamento</button>
              </form>
              <form className='compact-form form-divider' onSubmit={(event) => submit(event, '/environment-equipments', { ...quantityForm, quantity: Number(quantityForm.quantity) }, 'Quantidade vinculada ao ambiente.', () => setQuantityForm({ ...quantityForm, quantity: '0' }))}>
                <Field id='quantity-environment' label='Ambiente do equipamento'><select id='quantity-environment' value={quantityForm.environment_id} onChange={(event) => setQuantityForm({ ...quantityForm, environment_id: event.target.value })} required><Options items={activeEnvironments} /></select></Field>
                <Field id='quantity-equipment' label='Equipamento'><select id='quantity-equipment' value={quantityForm.equipment_type_id} onChange={(event) => setQuantityForm({ ...quantityForm, equipment_type_id: event.target.value })} required><Options items={activeEquipment} /></select></Field>
                <Field id='equipment-quantity' label='Quantidade'><input id='equipment-quantity' type='number' min='0' value={quantityForm.quantity} onChange={(event) => setQuantityForm({ ...quantityForm, quantity: event.target.value })} required /></Field>
                <button className='button button-secondary' type='submit'>Salvar quantidade</button>
              </form>
            </article>
          </div>

          <div className='academic-column'>
            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>03 · Limite do semestre</p><h2>Defina os limites da clínica</h2></div>
                <span className='card-count'>{configs.length}</span>
              </div>
              <p className='field-help'>Escolha a clínica e o semestre; esse limite controla atendimentos simultâneos e estudantes.</p>
              <form className='compact-form' onSubmit={(event) => submit(event, '/clinic-term-configs', { ...configForm, max_simultaneous_appointments: Number(configForm.max_simultaneous_appointments), max_students: Number(configForm.max_students) }, 'Limites do semestre configurados.', () => undefined)}>
                <Field id='config-clinic' label='Clinica'><select id='config-clinic' value={configForm.clinic_id} onChange={(event) => setConfigForm({ ...configForm, clinic_id: event.target.value })} required><Options items={activeClinics} /></select></Field>
                <Field id='config-term' label='Semestre'><select id='config-term' value={configForm.term_id} onChange={(event) => setConfigForm({ ...configForm, term_id: event.target.value })} required><Options items={activeTerms} /></select></Field>
                <div className='form-grid'>
                  <Field id='config-appointments' label='Atendimentos simultaneos'><input id='config-appointments' type='number' min='1' value={configForm.max_simultaneous_appointments} onChange={(event) => setConfigForm({ ...configForm, max_simultaneous_appointments: event.target.value })} required /></Field>
                  <Field id='config-students' label='Estudantes'><input id='config-students' type='number' min='1' value={configForm.max_students} onChange={(event) => setConfigForm({ ...configForm, max_students: event.target.value })} required /></Field>
                </div>
                <button className='button button-primary' type='submit'>Salvar limite do semestre</button>
              </form>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>04 · Serviços</p><h2>Serviços e requisitos</h2></div>
                <span className='card-count'>{services.length + requirements.length}</span>
              </div>
              <p className='field-help'>Associe cada serviço a uma disciplina e informe os equipamentos necessários para realizá-lo.</p>
              <form className='compact-form' onSubmit={(event) => submit(event, '/services', { ...serviceForm, duration_minutes: Number(serviceForm.duration_minutes) }, 'Servico criado.', () => setServiceForm({ ...serviceForm, name: '' }))}>
                <Field id='service-discipline' label='Disciplina'><select id='service-discipline' value={serviceForm.discipline_id} onChange={(event) => setServiceForm({ ...serviceForm, discipline_id: event.target.value })} required><Options items={activeDisciplines} /></select></Field>
                <Field id='service-name' label='Nome do servico'><input id='service-name' value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} required /></Field>
                <Field id='service-duration' label='Duracao em minutos'><input id='service-duration' type='number' min='1' value={serviceForm.duration_minutes} onChange={(event) => setServiceForm({ ...serviceForm, duration_minutes: event.target.value })} required /></Field>
                <button className='button button-primary' type='submit'>Adicionar servico</button>
              </form>
              <form className='compact-form form-divider' onSubmit={(event) => submit(event, '/service-equipment-requirements', { ...requirementForm, units_per_appointment: Number(requirementForm.units) }, 'Requisito criado.', () => undefined)}>
                <Field id='requirement-service' label='Servico'><select id='requirement-service' value={requirementForm.service_id} onChange={(event) => setRequirementForm({ ...requirementForm, service_id: event.target.value })} required><Options items={activeServices} /></select></Field>
                <Field id='requirement-equipment' label='Equipamento requerido'><select id='requirement-equipment' value={requirementForm.equipment_type_id} onChange={(event) => setRequirementForm({ ...requirementForm, equipment_type_id: event.target.value })} required><Options items={activeEquipment} /></select></Field>
                <Field id='requirement-units' label='Unidades por atendimento'><input id='requirement-units' type='number' min='1' value={requirementForm.units} onChange={(event) => setRequirementForm({ ...requirementForm, units: event.target.value })} required /></Field>
                <button className='button button-secondary' type='submit'>Adicionar requisito</button>
              </form>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>05 · Supervisão</p><h2>Defina a supervisão por semestre</h2></div>
                <span className='card-count'>{scopes.length}</span>
              </div>
              <p className='field-help'>Associe supervisor, serviço e ambiente; habilite a revisão documental quando necessário.</p>
              <form className='compact-form' onSubmit={(event) => submit(event, '/supervisor-service-scopes', { supervisor_id: scopeForm.supervisor_id, term_id: scopeForm.term_id, service_id: scopeForm.service_id, environment_id: scopeForm.environment_id, can_review_documents: scopeForm.review, max_students_override: scopeForm.override ? Number(scopeForm.override) : null }, 'Escopo criado.', () => undefined)}>
                <Field id='scope-supervisor' label='Supervisor'><select id='scope-supervisor' value={scopeForm.supervisor_id} onChange={(event) => setScopeForm({ ...scopeForm, supervisor_id: event.target.value })} required><option value=''>Selecione</option>{supervisors.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name} · padrao {item.max_students_default}</option>)}</select></Field>
                <Field id='scope-term' label='Semestre'><select id='scope-term' value={scopeForm.term_id} onChange={(event) => setScopeForm({ ...scopeForm, term_id: event.target.value })} required><Options items={activeTerms} /></select></Field>
                <Field id='scope-service' label='Servico'><select id='scope-service' value={scopeForm.service_id} onChange={(event) => setScopeForm({ ...scopeForm, service_id: event.target.value })} required><Options items={activeServices} /></select></Field>
                <Field id='scope-environment' label='Ambiente'><select id='scope-environment' value={scopeForm.environment_id} onChange={(event) => setScopeForm({ ...scopeForm, environment_id: event.target.value })} required><Options items={activeEnvironments} /></select></Field>
                <Field id='scope-override' label='Limite opcional do escopo'><input id='scope-override' type='number' min='1' value={scopeForm.override} onChange={(event) => setScopeForm({ ...scopeForm, override: event.target.value })} /></Field>
                <label><input type='checkbox' checked={scopeForm.review} onChange={(event) => setScopeForm({ ...scopeForm, review: event.target.checked })} /> Pode revisar documentos</label>
                <button className='button button-primary' type='submit'>Salvar escopo</button>
              </form>
            </article>
          </div>
        </div>
      )}
    </section>
  )
}
