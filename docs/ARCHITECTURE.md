# Arquitetura

## Escolha

Monolito modular com API REST e um unico PostgreSQL. E a forma mais curta de
manter transacoes fortes entre agenda, supervisao e recursos sem introduzir
mensageria ou consistencia eventual durante a hackathon.

```text
Navegador React
    |
    | HTTPS / JSON / multipart
    v
FastAPI /api/v1
    |-- auth e autorizacao
    |-- academico e pessoas
    |-- documentos
    |-- clinicas e recursos
    |-- sessoes e capacidade
    |-- agendamentos
    |-- administracao e auditoria
    |
    +--> PostgreSQL (dados, locks e metadados de arquivos)
    +--> Storage local privado (arquivos no desenvolvimento)
```

Em producao, o storage local deve ser trocado por objeto privado compativel com
S3 por meio de um adaptador. O banco nao armazena o conteudo binario.

## Estrutura alvo do repositorio

```text
apps/
  api/
    app/
      modules/{auth,academics,people,documents,clinics,scheduling,appointments,admin}/
      shared/
      main.py
    alembic/
    tests/
  web/
    src/{app,features,components,lib}/
infra/
  compose.yml
storage/              # ignorado pelo Git; apenas desenvolvimento
docs/
```

Cada modulo da API separa `router`, esquemas de entrada/saida, servico de
aplicacao e repositorio. Os servicos concentram regras e abrem a transacao; os
routers nao calculam capacidade.

## Componentes

| Componente | Responsabilidade |
| --- | --- |
| Auth | Credenciais, token curto, usuario atual e RBAC |
| Academics | Semestre, curso, disciplina, vinculo e bloqueio academico |
| People | Perfis e disponibilidades de estudante/supervisor |
| Documents | Requisitos, upload privado, revisao e elegibilidade |
| Clinics | Clinica, ambiente, sala, equipamento e configuracao semestral |
| Scheduling | Servico, sessao, alocacao, geracao de horarios e capacidade |
| Appointments | Consulta publica, reserva transacional e gestao por codigo |
| Admin | Visao geral, ativacao/desativacao e auditoria |

## Fluxo de capacidade

1. Master configura semestre, servico, clinica e recursos.
2. Master ou supervisor cria uma sessao datada.
3. Estudante solicita alocacao; o backend valida documentos e horarios.
4. Ao publicar, o backend calcula a capacidade efetiva e gera os horarios.
5. A consulta publica mostra apenas horarios com capacidade disponivel.
6. Ao reservar, uma transacao bloqueia o horario e recursos compartilhados em
   ordem estavel, revalida conflitos inclusive em outras sessoes sobrepostas,
   escolhe os recursos e cria o agendamento.

O calculo deve ser uma funcao de dominio unica, reutilizada em publicacao,
consulta e reserva. Duplicar a formula no frontend criaria divergencia.

## Stack e convencoes

- Python 3.12, FastAPI, SQLAlchemy 2 async, Alembic e psycopg;
- PostgreSQL 16, UUIDs e constraints no banco;
- React 19, TypeScript, Vite, React Router e TanStack Query;
- formulários com React Hook Form e validacao de contrato;
- pytest para API; Vitest e Testing Library para web;
- Ruff e mypy no backend; ESLint e TypeScript no frontend;
- prefixo de API `/api/v1` e JSON em `snake_case`;
- OpenAPI gerado pelo FastAPI como contrato executavel.

## Autenticacao sem Redis

Usuarios internos fazem login por e-mail e senha. A API emite JWT assinado com
duracao de 30 minutos; a SPA o mantem apenas em memoria. No MVP nao ha refresh
token: expirar significa autenticar novamente. Isso reduz estado e evita guardar
token em `localStorage`.

Rate limit em memoria e aceitavel somente para a demonstracao com uma instancia
da API. Redis passa a ser necessario quando houver multiplas instancias ou
controle distribuido de abuso. A integridade de agenda continua no PostgreSQL,
nao no Redis.

## Arquivos de documentos

- metadados e estado no PostgreSQL;
- bytes em diretorio privado montado como volume no desenvolvimento;
- download sempre mediado por endpoint autenticado e autorizado;
- nome fisico gerado por UUID; nome original e apenas metadado;
- interface `DocumentStorage` para troca futura por storage de objetos.

## Operacao inicial

O Compose deve subir `db`, `api` e `web`, com healthchecks. Um comando de seed
idempotente cria o cenario ficticio da demonstracao. Secrets ficam em `.env`
ignorado e um `.env.example` contem somente nomes e exemplos nao sensiveis.

Logs estruturados incluem `request_id`, usuario quando autenticado, acao e
codigo de erro, mas nunca PII ou conteudo de documentos.
