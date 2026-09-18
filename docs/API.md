# Contrato inicial da API

Base: `/api/v1`. O OpenAPI gerado pelo FastAPI passa a ser a referencia
executavel quando a API existir; este documento define o recorte inicial.

## Convencoes

- JSON em `snake_case`, datas ISO 8601 com offset e IDs UUID;
- listas privadas paginadas por `page` e `page_size` (maximo 100);
- `201` para criacao, `204` para operacao sem corpo;
- `409` para conflito de estado/capacidade e `422` para entrada invalida;
- endpoints protegidos recebem `Authorization: Bearer <token>`;
- `Idempotency-Key` e obrigatoria ao criar agendamento publico.

Erros usam o objeto `error` com `code`, `message`, `details` e `request_id`.
Codigos de dominio iniciais: `INVALID_CREDENTIALS`, `FORBIDDEN`,
`INVALID_TOKEN`, `USER_INACTIVE`, `LOGIN_RATE_LIMITED`, `NOT_FOUND`,
`VALIDATION_ERROR`,
`DOCUMENTS_PENDING`, `ACADEMIC_CONFLICT`, `SUPERVISION_CAPACITY_REACHED`,
`PHYSICAL_CAPACITY_REACHED`, `SUPERVISOR_SCHEDULE_CONFLICT`,
`CAPACITY_BELOW_COMMITTED`, `SESSION_NOT_PUBLISHABLE`,
`SLOT_FULL`, `INVALID_MANAGEMENT_CODE`, `INVALID_STATE_TRANSITION`,
`DUPLICATE_RESOURCE`, `PROFILE_REQUIRED`, `ACADEMIC_INTERVAL_CONFLICT`,
`INVALID_DOCUMENT_FILE`, `DOCUMENT_TOO_LARGE`, `REVIEW_NOTE_REQUIRED`,
`DOCUMENT_EXPIRY_REQUIRED`, `DOCUMENT_EXPIRY_INVALID`.
`PUBLIC_RATE_LIMITED`, `PRIVACY_NOTICE_VERSION_REQUIRED`.
Configuracoes que apontam para recurso desativado retornam `422 RESOURCE_INACTIVE`.

Codigo de erro administrativo: SELF_DEACTIVATION_FORBIDDEN.

## Autenticacao e identidade

| Metodo | Rota | Acesso | Finalidade |
| --- | --- | --- | --- |
| POST | `/auth/login` | Publico limitado | Emitir JWT curto |
| GET | `/me` | Interno | Perfil e permissoes atuais |
| GET | `/me/academic-terms` | Estudante/Supervisor | Listar semestres editaveis |
| GET/PUT | `/me/availability` | Estudante/Supervisor | Gerir disponibilidade do semestre |

`POST /auth/login` recebe `email` e `password`. Falha usa mensagem unica, sem
revelar se o e-mail existe.

Payload de sucesso do login:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "email": "student.demo@demo.clinicaescola.dev",
    "role": "STUDENT",
    "is_active": true
  }
}
```

O token aparece somente na resposta bem-sucedida de login e deve permanecer em
memoria no cliente. `GET /me` retorna somente o perfil atual, sem senha, hash ou
token:

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "email": "student.demo@demo.clinicaescola.dev",
  "role": "STUDENT",
  "is_active": true
}
```

Credenciais invalidas retornam `401` com `INVALID_CREDENTIALS` e a mensagem
`E-mail ou senha inválidos.`. Token ausente, expirado ou invalido retorna
`401 INVALID_TOKEN`; usuario desativado retorna `401 USER_INACTIVE`. Depois de
cinco falhas por IP em quinze minutos, a proxima tentativa retorna `429
LOGIN_RATE_LIMITED` com o header `Retry-After`.

## Academico, pessoas e recursos

Rotas Master da configuracao academica:

| Metodo | Rota | Finalidade |
| --- | --- | --- |
| GET/POST/PATCH | `/terms`, `/terms/{id}` | Listar, criar e editar semestre em `DRAFT` |
| POST | `/terms/{id}/activate` | Ativar semestre e encerrar o ativo anterior na mesma transacao |
| POST | `/terms/{id}/deactivate` | Encerrar semestre sem apagar historico |
| GET/POST/PATCH | `/courses`, `/courses/{id}` | Configurar cursos; desativacao usa `/deactivate` |
| GET/POST/PATCH | `/disciplines`, `/disciplines/{id}` | Configurar disciplinas e estagios |
| GET/POST/PATCH | `/cohorts`, `/cohorts/{id}` | Configurar turma por curso, periodo e semestre |
| GET/POST | `/class-blocks` | Criar bloqueios semanais da grade |
| GET/POST/PATCH | `/students`, `/students/{user_id}` | Criar e editar perfil academico do estudante |
| GET/POST/PATCH | `/supervisors`, `/supervisors/{user_id}` | Criar e editar perfil do supervisor |
| GET/POST | `/student-academic-links` | Vincular estudante a turma e disciplina/estagio |

`/terms/{id}/activate` aceita somente `DRAFT` e usa a unicidade parcial do
PostgreSQL para garantir no maximo um semestre `ACTIVE`. `/terms/{id}/deactivate`
transiciona `ACTIVE` para `CLOSED`; os vinculos historicos continuam consultaveis.

Os intervalos semanais recebem `weekday` de `0` a `6`, `start_time`, `end_time`
e `time_zone` fixo em `America/Sao_Paulo`. O fim deve ser maior que o inicio;
intervalos adjacentes sao validos pela convencao `[inicio, fim)`. Sobreposicoes
retornam `409 ACADEMIC_INTERVAL_CONFLICT` com mensagem acionavel. O mesmo
contrato vale para bloqueios de grade e para `PUT /me/availability`.

O payload de disponibilidade e:

```json
{
  term_id: 00000000-0000-0000-0000-000000000010,
  intervals: [
    {
      weekday: 2,
      start_time: 08:00:00,
      end_time: 10:00:00,
      time_zone: America/Sao_Paulo
    }
  ]
}
```

Cada usuario so pode alterar o proprio perfil de disponibilidade. Sem perfil
academico criado pelo Master, a API retorna `409 PROFILE_REQUIRED`.

Rotas Master adicionais:

- CRUD `/users`;
- configuracao de clinicas e recursos conforme a tabela abaixo.

| Metodo | Rota | Finalidade |
| --- | --- | --- |
| GET/POST/PATCH | `/clinics`, `/clinics/{id}` | Cadastrar clinica e rotulo de localizacao |
| POST | `/clinics/{id}/deactivate` | Desativar clinica sem apagar historico |
| GET/POST/PATCH | `/environments`, `/environments/{id}` | Cadastrar ambiente por clinica |
| POST | `/environments/{id}/deactivate` | Desativar ambiente |
| GET/POST/PATCH | `/rooms`, `/rooms/{id}` | Cadastrar sala por ambiente |
| POST | `/rooms/{id}/deactivate` | Desativar sala |
| GET/POST/PATCH | `/equipment-types`, `/equipment-types/{id}` | Cadastrar tipo de equipamento |
| POST | `/equipment-types/{id}/deactivate` | Desativar tipo de equipamento |
| GET/POST/PATCH | `/environment-equipments`, `/environment-equipments/{id}` | Configurar quantidade por ambiente |
| POST | `/environment-equipments/{id}/deactivate` | Desativar relacao de equipamento |
| GET/POST/PATCH | `/clinic-term-configs`, `/clinic-term-configs/{id}` | Configurar limites positivos por semestre |
| GET/POST/PATCH | `/services`, `/services/{id}` | Cadastrar servico com disciplina e duracao positiva |
| POST | `/services/{id}/deactivate` | Desativar servico |
| GET/POST/PATCH | `/service-equipment-requirements`, `/service-equipment-requirements/{id}` | Informar unidades por atendimento |
| GET/POST/PATCH | `/supervisor-service-scopes`, `/supervisor-service-scopes/{id}` | Configurar escopo, limite default/override e revisao |
| POST | `/supervisor-service-scopes/{id}/deactivate` | Desativar escopo |

Todos esses endpoints exigem `MASTER`. A configuracao de clinica e limites
referencia `term_id`; semestre fechado fica somente leitura. A API aceita
quantidade de inventario igual a zero, mas exige valores positivos para limites,
duracao, unidades por atendimento e override. Clinica, ambiente, disciplina,
curso, equipamento, servico e supervisor precisam estar ativos ao entrarem em
uma nova configuracao.

Delete de usuario ou recurso com historico e substituido por
`POST /{resource}/{id}/deactivate`.

## Documentos

| Metodo | Rota | Acesso | Finalidade |
| --- | --- | --- | --- |
| GET/POST | `/document-requirements` | Master | Configurar requisitos por semestre e disciplina opcional |
| PATCH | `/document-requirements/{id}` | Master | Alterar nome/validade do requisito aberto |
| POST | `/document-requirements/{id}/deactivate` | Master | Encerrar requisito sem apagar historico |
| GET | `/me/document-requirements?term_id=` | Estudante | Ver checklist e estado |
| POST | `/me/document-submissions` | Estudante | Upload multipart privado |
| GET | `/document-reviews?status=PENDING_REVIEW` | Revisor/Master | Fila dentro do escopo |
| GET | `/document-submissions/{id}/content` | Dono/Revisor/Master | Download autorizado |
| POST | `/document-submissions/{id}/approve` | Revisor/Master | Aprovar com validade opcional |
| POST | `/document-submissions/{id}/reject` | Revisor/Master | Recusar com `review_note` obrigatoria |

`POST /document-requirements` recebe `term_id`, `discipline_id` opcional,
`name` e `expires_required`. O checklist retorna `eligible`,
`pending_requirement_ids` em ordem deterministica e itens com estado
`MISSING`, `PENDING_REVIEW`, `APPROVED`, `REJECTED` ou `EXPIRED`.

`POST /me/document-submissions` e multipart com os campos `requirement_id` e
`file`. O arquivo deve ser PDF, JPEG ou PNG, ter assinatura correspondente ao
MIME declarado e no maximo 10 MiB. A resposta `201` retorna somente metadados
operacionais, nunca `storage_key` ou URL publica, e inicia em
`PENDING_REVIEW`.

`POST /document-submissions/{id}/approve` recebe `expires_at` opcional; quando
o requisito exige validade, o campo e obrigatorio. `POST .../reject` exige
`review_note` nao vazia. Uma submissao fora da propriedade do estudante ou do
escopo ativo do revisor responde `404 NOT_FOUND`, sem confirmar metadados.

## Sessoes e alocacoes

| Metodo | Rota | Acesso | Finalidade |
| --- | --- | --- | --- |
| GET/POST | `/sessions` | Supervisor/Master | Listar/criar sessao |
| GET/PATCH | `/sessions/{id}` | Supervisor no escopo/Master | Consultar/editar draft |
| POST | `/sessions/{id}/publish` | Supervisor no escopo/Master | Validar e gerar horarios |
| POST | `/sessions/{id}/cancel` | Supervisor no escopo/Master | Cancelar com tratamento de reservas |
| GET | `/sessions/{id}/capacity` | Interno | Explicar cada parcela da capacidade |
| POST | `/sessions/{id}/allocations` | Estudante proprio/Master | Alocar estudante |
| DELETE | `/sessions/{id}/allocations/{allocation_id}` | Estudante proprio/Master | Cancelar alocacao |
| GET | `/me/session-options` | Supervisor | Listar configuracoes autorizadas com nomes para criar sessoes |
| GET | `/me/available-sessions` | Estudante | Listar sessoes proprias e oportunidades com motivo de bloqueio |

A explicacao de capacidade retorna `effective`, o mapa `constraints` com
`eligible_students`, `supervision`, `rooms`, `equipment` e
`clinic_appointments`, e a lista `limiting_factors`.

POST /sessions recebe term_id, service_id, clinic_id, environment_id,
supervisor_id, starts_at, ends_at e max_students_override opcional. Datas
precisam conter offset e sao normalizadas para UTC. A sessao nasce DRAFT; o
operador deve alocar estudantes antes de publicar.

POST /sessions/{id}/allocations recebe student_id somente quando o ator e
Master; o estudante usa o proprio ID. A API valida documentos, semestre,
curso/disciplina, disponibilidade, bloqueios academicos e limites antes do
commit. Falhas retornam codigo estavel sem criar alocacao parcial.

`GET /me/session-options` retorna as configuracoes ativas do escopo do
supervisor, com nomes de semestre, servico, clinica e ambiente, duracao do
servico e limite efetivo configurado. O cliente envia os UUIDs dessa opcao ao
criar ou editar uma sessao; a pessoa nao precisa digita-los.

`GET /me/available-sessions` retorna sessoes futuras `DRAFT` compativeis para
entrada do estudante e sessoes futuras `DRAFT`/`PUBLISHED` em que ele ja esta
alocado. Cada item traz os nomes legiveis do contexto e `can_join`,
`allocation_id`, `allocation_status`, `blocked_code` e `blocked_message`.
Elegibilidade e compatibilidade sao avaliadas no servidor.

POST /sessions/{id}/publish calcula a capacidade no servidor e gera slots com
a duracao do servico. Sobra menor que a duracao nao vira slot; repetir a
publicacao devolve a mesma quantidade materializada. GET /sessions/{id}/capacity
nao delega calculo ao frontend e informa todos os fatores e os gargalos.

## Jornada publica

| Metodo | Rota | Finalidade |
| --- | --- | --- |
| GET | `/public/services` | Servicos ativos sem dados internos |
| GET | `/public/slots?service_id=&from=&to=&clinic_id=` | Horarios com vaga; `service_id` e opcional |
| POST | `/public/appointments` | Reservar com `Idempotency-Key` |
| POST | `/public/appointments/confirm` | Confirmar por codigo |
| POST | `/public/appointments/cancel` | Cancelar por codigo |

A criacao recebe `slot_id`, `name`, `email`, `phone` e
`privacy_notice_version`. A resposta retorna identificador, estado, servico,
clinica, horario e o codigo de gestao uma unica vez. Nunca retorna estudante,
supervisor, hash ou dados de outras reservas.

Quando `service_id` nao e informado, `/public/slots` busca todos os servicos
ativos dentro do intervalo. O campo `service_id` de cada item identifica o
servico daquele horario; os filtros de servico, unidade e data podem ser
aplicados pela interface publica.

Nome e pelo menos um contato sao obrigatorios. A versao do aviso deve coincidir
com a configuracao vigente. Repetir a mesma `Idempotency-Key` devolve a reserva
original com `200`, sem novo consumo e sem repetir o codigo. Consulta, criacao e
gestao por codigo possuem limites em memoria e respondem `429 PUBLIC_RATE_LIMITED`
com `Retry-After`.

## Administracao

- `GET /admin/dashboard?term_id=`: contagens de pendencias, sessoes e agenda;
- `POST /users/{user_id}/deactivate`: desativacao reversivel por Master, com
  auditoria e sem permitir auto-desativacao;
- `GET /admin/appointments/at-risk`: fila paginada de reservas em risco com
  sessao, horario, causa operacional e sem contato da comunidade;
- `GET /audit-events`: consulta paginada por ator, acao, alvo e periodo;
- `GET /health/live`: processo vivo;
- `GET /health/ready`: banco e storage disponiveis.

Os health endpoints sao publicos e retornam payloads pequenos, sem detalhes de
infraestrutura ou credenciais:

- `GET /health/live` retorna `200` e `{"status":"ok"}` quando o processo esta
  respondendo;
- `GET /health/ready` retorna `200` com `{"status":"ok","checks":{"database":"ok",
  "storage":"ok"}}` quando banco e storage estao disponiveis;
- `GET /health/ready` retorna `503` com o mesmo formato, usando
  `"status":"error"` e `"error"` no check indisponivel, quando a aplicacao nao
  esta pronta para receber trafego.

## Regras de autorizacao de objeto

Toda rota que recebe ID carrega o objeto e verifica propriedade/escopo antes da
acao. Um estudante nao acessa documento de outro; um supervisor so revisa no
escopo autorizado; resposta `404` pode substituir `403` quando necessario para
nao confirmar a existencia de dado privado.
