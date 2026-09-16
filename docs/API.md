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
`DOCUMENTS_PENDING`, `ACADEMIC_CONFLICT`, `SUPERVISION_CAPACITY_REACHED`,
`PHYSICAL_CAPACITY_REACHED`, `CAPACITY_BELOW_COMMITTED`, `SESSION_NOT_PUBLISHABLE`,
`SLOT_FULL`, `INVALID_MANAGEMENT_CODE`, `INVALID_STATE_TRANSITION`.

## Autenticacao e identidade

| Metodo | Rota | Acesso | Finalidade |
| --- | --- | --- | --- |
| POST | `/auth/login` | Publico limitado | Emitir JWT curto |
| GET | `/me` | Interno | Perfil e permissoes atuais |
| GET/PUT | `/me/availability` | Estudante/Supervisor | Gerir disponibilidade do semestre |

`POST /auth/login` recebe `email` e `password`. Falha usa mensagem unica, sem
revelar se o e-mail existe.

## Academico, pessoas e recursos

Rotas Master:

- CRUD `/terms`, `/courses`, `/disciplines`, `/cohorts` e `/class-blocks`;
- CRUD `/users`, `/students`, `/supervisors` e `/student-academic-links`;
- CRUD `/clinics`, `/environments`, `/rooms`, `/equipment-types`;
- CRUD `/clinic-term-configs`, `/services`, `/service-equipment-requirements`;
- CRUD `/supervisor-service-scopes`.

Delete de usuario ou recurso com historico e substituido por
`POST /{resource}/{id}/deactivate`.

## Documentos

| Metodo | Rota | Acesso | Finalidade |
| --- | --- | --- | --- |
| GET | `/me/document-requirements?term_id=` | Estudante | Ver checklist e estado |
| POST | `/me/document-submissions` | Estudante | Upload multipart privado |
| GET | `/document-reviews?status=PENDING_REVIEW` | Revisor/Master | Fila dentro do escopo |
| GET | `/document-submissions/{id}/content` | Dono/Revisor/Master | Download autorizado |
| POST | `/document-submissions/{id}/approve` | Revisor/Master | Aprovar com validade opcional |
| POST | `/document-submissions/{id}/reject` | Revisor/Master | Recusar com `review_note` obrigatoria |

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

A explicacao de capacidade retorna `effective`, o mapa `constraints` com
`eligible_students`, `supervision`, `rooms`, `equipment` e
`clinic_appointments`, e a lista `limiting_factors`.

## Jornada publica

| Metodo | Rota | Finalidade |
| --- | --- | --- |
| GET | `/public/services` | Servicos ativos sem dados internos |
| GET | `/public/slots?service_id=&from=&to=&clinic_id=` | Horarios com vaga |
| POST | `/public/appointments` | Reservar com `Idempotency-Key` |
| POST | `/public/appointments/confirm` | Confirmar por codigo |
| POST | `/public/appointments/cancel` | Cancelar por codigo |

A criacao recebe `slot_id`, `name`, `email`, `phone` e
`privacy_notice_version`. A resposta retorna identificador, estado, servico,
clinica, horario e o codigo de gestao uma unica vez. Nunca retorna estudante,
supervisor, hash ou dados de outras reservas.

## Administracao

- `GET /admin/dashboard?term_id=`: contagens de pendencias, sessoes e agenda;
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
