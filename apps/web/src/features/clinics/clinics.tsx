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
type Quantity = { id: string; environment_id: string; equipment_type_id: string; quantity: number; is_active: boolean }

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
  const [quantities, setQuantities] = useState<Quantity[]>([])
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
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null)
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<string | null>(null)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null)
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null)
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null)
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [
        nextClinics, nextEnvironments, nextRooms, nextEquipment, nextQuantities, nextTerms,
        nextDisciplines, nextServices, nextSupervisors, nextConfigs,
        nextRequirements, nextScopes,
      ] = await Promise.all([
        apiFetch<Clinic[]>(token, '/clinics'),
        apiFetch<Environment[]>(token, '/environments'),
        apiFetch<Room[]>(token, '/rooms'),
        apiFetch<ActiveEntity[]>(token, '/equipment-types'),
        apiFetch<Quantity[]>(token, '/environment-equipments'),
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
      setQuantities(nextQuantities)
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

  async function createResource(path: string, body: object, message: string, reset: () => void, editingId: string | null = null, finish: () => void = () => undefined) {
    setError(null)
    setNotice(null)
    try {
      await apiFetch(token, editingId ? path + '/' + editingId : path, { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(body) })
      reset()
      finish()
      setNotice(editingId ? message.replace('criado', 'atualizado').replace('criada', 'atualizada') : message)
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
    editingId: string | null = null,
    finish: () => void = () => undefined,
  ) => {
    event.preventDefault()
    void createResource(path, body, message, reset, editingId, finish)
  }

  async function deactivateResource(path: string, id: string, label: string) {
    if (!window.confirm('Desativar ' + label + '? O historico sera preservado.')) return
    setError(null)
    setNotice(null)
    try {
      await apiFetch(token, path + '/' + id + '/deactivate', { method: 'POST' })
      setNotice(label + ' desativado.')
      await refresh()
    } catch (actionError) {
      setError(formError(actionError))
    }
  }

  function editClinic(item: Clinic) { setEditingClinicId(item.id); setClinicForm({ name: item.name, address_label: item.address_label }) }
  function editEnvironment(item: Environment) { setEditingEnvironmentId(item.id); setEnvironmentForm({ clinic_id: item.clinic_id, name: item.name }) }
  function editRoom(item: Room) { setEditingRoomId(item.id); setRoomForm({ environment_id: item.environment_id, name: item.name }) }
  function editEquipment(item: ActiveEntity) { setEditingEquipmentId(item.id); setEquipmentForm({ name: item.name }) }
  function editQuantity(item: { id: string; environment_id: string; equipment_type_id: string; quantity: number }) { setEditingQuantityId(item.id); setQuantityForm({ environment_id: item.environment_id, equipment_type_id: item.equipment_type_id, quantity: String(item.quantity) }) }
  function editConfig(item: Config) { setEditingConfigId(item.id); setConfigForm({ clinic_id: item.clinic_id, term_id: item.term_id, max_simultaneous_appointments: String(item.max_simultaneous_appointments), max_students: String(item.max_students) }) }
  function editService(item: Service) { setEditingServiceId(item.id); setServiceForm({ discipline_id: item.discipline_id, name: item.name, duration_minutes: String(item.duration_minutes) }) }
  function editRequirement(item: Requirement) { setEditingRequirementId(item.id); setRequirementForm({ service_id: item.service_id, equipment_type_id: item.equipment_type_id, units: String(item.units_per_appointment) }) }
  function editScope(item: Scope) { setEditingScopeId(item.id); setScopeForm({ supervisor_id: item.supervisor_id, term_id: item.term_id, service_id: item.service_id, environment_id: item.environment_id, override: item.max_students_override?.toString() ?? '', review: item.can_review_documents }) }

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
              <form className='compact-form' onSubmit={(event) => submit(event, '/clinics', clinicForm, 'Clinica criada.', () => setClinicForm(emptyClinic), editingClinicId, () => setEditingClinicId(null))}>
                <Field id='clinic-name' label='Nome da clinica'>
                  <input id='clinic-name' value={clinicForm.name} onChange={(event) => setClinicForm({ ...clinicForm, name: event.target.value })} required />
                </Field>
                <Field id='clinic-address' label='Localizacao'>
                  <input id='clinic-address' value={clinicForm.address_label} onChange={(event) => setClinicForm({ ...clinicForm, address_label: event.target.value })} required />
                </Field>
                <button className='button button-primary' type='submit'>{editingClinicId ? 'Salvar clinica' : 'Adicionar clinica'}</button>
                {editingClinicId && <button className='text-button' type='button' onClick={() => { setEditingClinicId(null); setClinicForm(emptyClinic) }}>Cancelar edicao</button>}
              </form>
              <ul className='resource-list'>
                {clinics.map((item) => (
                  <li key={item.id}>
                    <span><strong>{item.name}</strong><small>{item.address_label} - {item.is_active ? 'Ativa' : 'Desativada'}</small></span>
                    <span className='resource-actions'>
                      {item.is_active && <button className='text-button' type='button' onClick={() => editClinic(item)}>Editar</button>}
                      {item.is_active && <button className='text-button' type='button' onClick={() => void deactivateResource('/clinics', item.id, 'Clinica')}>Desativar</button>}
                    </span>
                  </li>
                ))}
              </ul>
              <form className='compact-form form-divider' onSubmit={(event) => submit(event, '/environments', editingEnvironmentId ? { name: environmentForm.name } : environmentForm, 'Ambiente criado.', () => setEnvironmentForm(emptyEnvironment), editingEnvironmentId, () => setEditingEnvironmentId(null))}>
                <Field id='environment-clinic' label='Clinica'>
                  <select id='environment-clinic' value={environmentForm.clinic_id} onChange={(event) => setEnvironmentForm({ ...environmentForm, clinic_id: event.target.value })} required><Options items={activeClinics} /></select>
                </Field>
                <Field id='environment-name' label='Nome do ambiente'>
                  <input id='environment-name' value={environmentForm.name} onChange={(event) => setEnvironmentForm({ ...environmentForm, name: event.target.value })} required />
                </Field>
                <button className='button button-secondary' type='submit'>{editingEnvironmentId ? 'Salvar ambiente' : 'Adicionar ambiente'}</button>
                {editingEnvironmentId && <button className='text-button' type='button' onClick={() => { setEditingEnvironmentId(null); setEnvironmentForm(emptyEnvironment) }}>Cancelar edicao</button>}
              </form>
              <ul className='resource-list'>{environments.map((item) => <li key={item.id}><span><strong>{item.name}</strong><small>{clinics.find((clinic) => clinic.id === item.clinic_id)?.name} - {item.is_active ? 'Ativo' : 'Desativado'}</small></span><span className='resource-actions'>{item.is_active && <button className='text-button' type='button' onClick={() => editEnvironment(item)}>Editar</button>}{item.is_active && <button className='text-button' type='button' onClick={() => void deactivateResource('/environments', item.id, 'Ambiente')}>Desativar</button>}</span></li>)}</ul>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>02 · Capacidade física</p><h2>Salas e equipamentos</h2></div>
                <span className='card-count'>{rooms.length + equipment.length}</span>
              </div>
              <p className='field-help'>Registre salas e equipamentos: eles determinam quantos atendimentos podem acontecer ao mesmo tempo.</p>
              <form className='compact-form' onSubmit={(event) => submit(event, '/rooms', editingRoomId ? { name: roomForm.name } : roomForm, 'Sala criada.', () => setRoomForm(emptyRoom), editingRoomId, () => setEditingRoomId(null))}>
                <Field id='room-environment' label='Ambiente'>
                  <select id='room-environment' value={roomForm.environment_id} onChange={(event) => setRoomForm({ ...roomForm, environment_id: event.target.value })} required><Options items={activeEnvironments} /></select>
                </Field>
                <Field id='room-name' label='Nome da sala'><input id='room-name' value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} required /></Field>
                <button className='button button-secondary' type='submit'>{editingRoomId ? 'Salvar sala' : 'Adicionar sala'}</button>
                {editingRoomId && <button className='text-button' type='button' onClick={() => { setEditingRoomId(null); setRoomForm(emptyRoom) }}>Cancelar edicao</button>}
              </form>
              <ul className='resource-list'>
                {rooms.map((item) => (
                  <li key={item.id}>
                    <span><strong>{item.name}</strong><small>{environments.find((environment) => environment.id === item.environment_id)?.name} - {item.is_active ? 'Ativa' : 'Desativada'}</small></span>
                    <span className='resource-actions'>{item.is_active && <button className='text-button' type='button' onClick={() => editRoom(item)}>Editar</button>}{item.is_active && <button className='text-button' type='button' onClick={() => void deactivateResource('/rooms', item.id, 'Sala')}>Desativar</button>}</span>
                  </li>
                ))}
              </ul>
              <form className='compact-form form-divider' onSubmit={(event) => submit(event, '/equipment-types', equipmentForm, 'Equipamento criado.', () => setEquipmentForm(emptyEquipment), editingEquipmentId, () => setEditingEquipmentId(null))}>
                <Field id='equipment-name' label='Tipo de equipamento'><input id='equipment-name' value={equipmentForm.name} onChange={(event) => setEquipmentForm({ name: event.target.value })} required /></Field>
                <button className='button button-secondary' type='submit'>{editingEquipmentId ? 'Salvar equipamento' : 'Adicionar equipamento'}</button>
                {editingEquipmentId && <button className='text-button' type='button' onClick={() => { setEditingEquipmentId(null); setEquipmentForm(emptyEquipment) }}>Cancelar edicao</button>}
              </form>
              <ul className='resource-list'>
                {equipment.map((item) => (
                  <li key={item.id}>
                    <span><strong>{item.name}</strong><small>{item.is_active ? 'Ativo' : 'Desativado'}</small></span>
                    <span className='resource-actions'>{item.is_active && <button className='text-button' type='button' onClick={() => editEquipment(item)}>Editar</button>}{item.is_active && <button className='text-button' type='button' onClick={() => void deactivateResource('/equipment-types', item.id, 'Equipamento')}>Desativar</button>}</span>
                  </li>
                ))}
              </ul>
              <form className='compact-form form-divider' onSubmit={(event) => submit(event, '/environment-equipments', editingQuantityId ? { quantity: Number(quantityForm.quantity) } : { ...quantityForm, quantity: Number(quantityForm.quantity) }, 'Quantidade vinculada ao ambiente.', () => setQuantityForm(emptyQuantity), editingQuantityId, () => setEditingQuantityId(null))}>
                <Field id='quantity-environment' label='Ambiente do equipamento'><select id='quantity-environment' value={quantityForm.environment_id} onChange={(event) => setQuantityForm({ ...quantityForm, environment_id: event.target.value })} required><Options items={activeEnvironments} /></select></Field>
                <Field id='quantity-equipment' label='Equipamento'><select id='quantity-equipment' value={quantityForm.equipment_type_id} onChange={(event) => setQuantityForm({ ...quantityForm, equipment_type_id: event.target.value })} required><Options items={activeEquipment} /></select></Field>
                <Field id='equipment-quantity' label='Quantidade'><input id='equipment-quantity' type='number' min='0' value={quantityForm.quantity} onChange={(event) => setQuantityForm({ ...quantityForm, quantity: event.target.value })} required /></Field>
                <button className='button button-secondary' type='submit'>{editingQuantityId ? 'Atualizar quantidade' : 'Salvar quantidade'}</button>
                {editingQuantityId && <button className='text-button' type='button' onClick={() => { setEditingQuantityId(null); setQuantityForm(emptyQuantity) }}>Cancelar edicao</button>}
              </form>
              <ul className='resource-list'>
                {quantities.map((item) => (
                  <li key={item.id}>
                    <span><strong>{equipment.find((equipmentItem) => equipmentItem.id === item.equipment_type_id)?.name ?? 'Equipamento'}</strong><small>{environments.find((environment) => environment.id === item.environment_id)?.name ?? 'Ambiente'} - {item.quantity} unidade{item.quantity === 1 ? '' : 's'} - {item.is_active ? 'Ativo' : 'Desativado'}</small></span>
                    <span className='resource-actions'>{item.is_active && <button className='text-button' type='button' onClick={() => editQuantity(item)}>Editar</button>}{item.is_active && <button className='text-button' type='button' onClick={() => void deactivateResource('/environment-equipments', item.id, 'Vinculo de equipamento')}>Desativar</button>}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <div className='academic-column'>
            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>03 · Limite do semestre</p><h2>Defina os limites da clínica</h2></div>
                <span className='card-count'>{configs.length}</span>
              </div>
              <p className='field-help'>Escolha a clínica e o semestre; esse limite controla atendimentos simultâneos e estudantes.</p>
              <form className='compact-form' onSubmit={(event) => submit(event, '/clinic-term-configs', { ...configForm, max_simultaneous_appointments: Number(configForm.max_simultaneous_appointments), max_students: Number(configForm.max_students) }, 'Limites do semestre configurados.', () => undefined, editingConfigId, () => setEditingConfigId(null))}>
                <Field id='config-clinic' label='Clinica'><select id='config-clinic' value={configForm.clinic_id} onChange={(event) => setConfigForm({ ...configForm, clinic_id: event.target.value })} required><Options items={activeClinics} /></select></Field>
                <Field id='config-term' label='Semestre'><select id='config-term' value={configForm.term_id} onChange={(event) => setConfigForm({ ...configForm, term_id: event.target.value })} required><Options items={activeTerms} /></select></Field>
                <div className='form-grid'>
                  <Field id='config-appointments' label='Atendimentos simultaneos'><input id='config-appointments' type='number' min='1' value={configForm.max_simultaneous_appointments} onChange={(event) => setConfigForm({ ...configForm, max_simultaneous_appointments: event.target.value })} required /></Field>
                  <Field id='config-students' label='Estudantes'><input id='config-students' type='number' min='1' value={configForm.max_students} onChange={(event) => setConfigForm({ ...configForm, max_students: event.target.value })} required /></Field>
                </div>
                <button className='button button-primary' type='submit'>{editingConfigId ? 'Atualizar limite do semestre' : 'Salvar limite do semestre'}</button>
                {editingConfigId && <button className='text-button' type='button' onClick={() => { setEditingConfigId(null); setConfigForm(emptyConfig) }}>Cancelar edicao</button>}
              </form>
              <ul className='resource-list'>
                {configs.map((item) => (
                  <li key={item.id}>
                    <span><strong>{clinics.find((clinic) => clinic.id === item.clinic_id)?.name ?? 'Clinica'}</strong><small>{terms.find((term) => term.id === item.term_id)?.name ?? 'Semestre'} - {item.max_simultaneous_appointments} atendimento{item.max_simultaneous_appointments === 1 ? '' : 's'} - {item.max_students} estudante{item.max_students === 1 ? '' : 's'}</small></span>
                    <button className='text-button' type='button' onClick={() => editConfig(item)}>Editar</button>
                  </li>
                ))}
              </ul>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>04 · Serviços</p><h2>Serviços e requisitos</h2></div>
                <span className='card-count'>{services.length + requirements.length}</span>
              </div>
              <p className='field-help'>Associe cada serviço a uma disciplina e informe os equipamentos necessários para realizá-lo.</p>
              <form className='compact-form' onSubmit={(event) => submit(event, '/services', editingServiceId ? { name: serviceForm.name, duration_minutes: Number(serviceForm.duration_minutes) } : { ...serviceForm, duration_minutes: Number(serviceForm.duration_minutes) }, 'Servico criado.', () => setServiceForm(emptyService), editingServiceId, () => setEditingServiceId(null))}>
                <Field id='service-discipline' label='Disciplina'><select id='service-discipline' value={serviceForm.discipline_id} onChange={(event) => setServiceForm({ ...serviceForm, discipline_id: event.target.value })} required><Options items={activeDisciplines} /></select></Field>
                <Field id='service-name' label='Nome do servico'><input id='service-name' value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} required /></Field>
                <Field id='service-duration' label='Duracao em minutos'><input id='service-duration' type='number' min='1' value={serviceForm.duration_minutes} onChange={(event) => setServiceForm({ ...serviceForm, duration_minutes: event.target.value })} required /></Field>
                <button className='button button-primary' type='submit'>{editingServiceId ? 'Salvar servico' : 'Adicionar servico'}</button>
                {editingServiceId && <button className='text-button' type='button' onClick={() => { setEditingServiceId(null); setServiceForm(emptyService) }}>Cancelar edicao</button>}
              </form>
              <ul className='resource-list'>
                {services.map((item) => (
                  <li key={item.id}>
                    <span><strong>{item.name}</strong><small>{disciplines.find((discipline) => discipline.id === item.discipline_id)?.name ?? 'Disciplina'} - {item.duration_minutes} min - {item.is_active ? 'Ativo' : 'Desativado'}</small></span>
                    <span className='resource-actions'>{item.is_active && <button className='text-button' type='button' onClick={() => editService(item)}>Editar</button>}{item.is_active && <button className='text-button' type='button' onClick={() => void deactivateResource('/services', item.id, 'Servico')}>Desativar</button>}</span>
                  </li>
                ))}
              </ul>
              <form className='compact-form form-divider' onSubmit={(event) => submit(event, '/service-equipment-requirements', editingRequirementId ? { units_per_appointment: Number(requirementForm.units) } : { ...requirementForm, units_per_appointment: Number(requirementForm.units) }, 'Requisito criado.', () => setRequirementForm(emptyRequirement), editingRequirementId, () => setEditingRequirementId(null))}>
                <Field id='requirement-service' label='Servico'><select id='requirement-service' value={requirementForm.service_id} onChange={(event) => setRequirementForm({ ...requirementForm, service_id: event.target.value })} required><Options items={activeServices} /></select></Field>
                <Field id='requirement-equipment' label='Equipamento requerido'><select id='requirement-equipment' value={requirementForm.equipment_type_id} onChange={(event) => setRequirementForm({ ...requirementForm, equipment_type_id: event.target.value })} required><Options items={activeEquipment} /></select></Field>
                <Field id='requirement-units' label='Unidades por atendimento'><input id='requirement-units' type='number' min='1' value={requirementForm.units} onChange={(event) => setRequirementForm({ ...requirementForm, units: event.target.value })} required /></Field>
                <button className='button button-secondary' type='submit'>{editingRequirementId ? 'Salvar requisito' : 'Adicionar requisito'}</button>
                {editingRequirementId && <button className='text-button' type='button' onClick={() => { setEditingRequirementId(null); setRequirementForm(emptyRequirement) }}>Cancelar edicao</button>}
              </form>
              <ul className='resource-list'>
                {requirements.map((item) => (
                  <li key={item.id}>
                    <span><strong>{services.find((service) => service.id === item.service_id)?.name ?? 'Servico'}</strong><small>{equipment.find((equipmentItem) => equipmentItem.id === item.equipment_type_id)?.name ?? 'Equipamento'} - {item.units_per_appointment} unidade{item.units_per_appointment === 1 ? '' : 's'} por atendimento</small></span>
                    <button className='text-button' type='button' onClick={() => editRequirement(item)}>Editar</button>
                  </li>
                ))}
              </ul>
            </article>

            <article className='private-card academic-card'>
              <div className='card-heading'>
                <div><p className='eyebrow'>05 · Supervisão</p><h2>Defina a supervisão por semestre</h2></div>
                <span className='card-count'>{scopes.length}</span>
              </div>
              <p className='field-help'>Associe supervisor, serviço e ambiente; habilite a revisão documental quando necessário.</p>
              <form className='compact-form' onSubmit={(event) => submit(event, '/supervisor-service-scopes', editingScopeId ? { can_review_documents: scopeForm.review, max_students_override: scopeForm.override ? Number(scopeForm.override) : null } : { supervisor_id: scopeForm.supervisor_id, term_id: scopeForm.term_id, service_id: scopeForm.service_id, environment_id: scopeForm.environment_id, can_review_documents: scopeForm.review, max_students_override: scopeForm.override ? Number(scopeForm.override) : null }, 'Escopo criado.', () => setScopeForm(emptyScope), editingScopeId, () => setEditingScopeId(null))}>
                <Field id='scope-supervisor' label='Supervisor'><select id='scope-supervisor' value={scopeForm.supervisor_id} onChange={(event) => setScopeForm({ ...scopeForm, supervisor_id: event.target.value })} required><option value=''>Selecione</option>{supervisors.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name} · padrao {item.max_students_default}</option>)}</select></Field>
                <Field id='scope-term' label='Semestre'><select id='scope-term' value={scopeForm.term_id} onChange={(event) => setScopeForm({ ...scopeForm, term_id: event.target.value })} required><Options items={activeTerms} /></select></Field>
                <Field id='scope-service' label='Servico'><select id='scope-service' value={scopeForm.service_id} onChange={(event) => setScopeForm({ ...scopeForm, service_id: event.target.value })} required><Options items={activeServices} /></select></Field>
                <Field id='scope-environment' label='Ambiente'><select id='scope-environment' value={scopeForm.environment_id} onChange={(event) => setScopeForm({ ...scopeForm, environment_id: event.target.value })} required><Options items={activeEnvironments} /></select></Field>
                <Field id='scope-override' label='Limite opcional do escopo'><input id='scope-override' type='number' min='1' value={scopeForm.override} onChange={(event) => setScopeForm({ ...scopeForm, override: event.target.value })} /></Field>
                <label><input type='checkbox' checked={scopeForm.review} onChange={(event) => setScopeForm({ ...scopeForm, review: event.target.checked })} /> Pode revisar documentos</label>
                <button className='button button-primary' type='submit'>{editingScopeId ? 'Atualizar escopo' : 'Salvar escopo'}</button>
                {editingScopeId && <button className='text-button' type='button' onClick={() => { setEditingScopeId(null); setScopeForm(emptyScope) }}>Cancelar edicao</button>}
              </form>
              <ul className='resource-list'>
                {scopes.map((item) => (
                  <li key={item.id}>
                    <span><strong>{supervisors.find((supervisor) => supervisor.user_id === item.supervisor_id)?.full_name ?? 'Supervisor'}</strong><small>{terms.find((term) => term.id === item.term_id)?.name ?? 'Semestre'} - {services.find((service) => service.id === item.service_id)?.name ?? 'Servico'} - {item.can_review_documents ? 'Revisa documentos' : 'Sem revisao'} - {item.is_active ? 'Ativo' : 'Desativado'}</small></span>
                    <span className='resource-actions'>{item.is_active && <button className='text-button' type='button' onClick={() => editScope(item)}>Editar</button>}{item.is_active && <button className='text-button' type='button' onClick={() => void deactivateResource('/supervisor-service-scopes', item.id, 'Escopo')}>Desativar</button>}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      )}
    </section>
  )
}
