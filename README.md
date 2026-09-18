# Clinica Escola

MVP para gestao integrada das clinicas-escola de Odontologia, Fisioterapia,
Nutricao e Psicologia. O sistema coordena configuracao semestral, elegibilidade
de estudantes, supervisao, capacidade fisica e agendamentos da comunidade.

## Decisao de produto

O MVP deve provar uma regra central: um atendimento so pode ser ofertado quando
existirem, ao mesmo tempo, estudante elegivel, supervisor disponivel e
capacidade fisica. A reserva e feita de forma transacional para que duas pessoas
nao ocupem a ultima vaga.

Stack proposta:

- API: FastAPI + SQLAlchemy 2 + Alembic + Pydantic;
- web: React + TypeScript + Vite;
- banco: PostgreSQL;
- desenvolvimento: Docker Compose;
- autenticacao: senha com Argon2id e JWT curto, sem Redis no MVP.

## Leitura recomendada

1. [Visao do produto](docs/PRODUCT.md)
2. [Linguagem do dominio](CONTEXT.md)
3. [Requisitos e escopo](docs/REQUIREMENTS.md)
4. [Regras de dominio](docs/DOMAIN_RULES.md)
5. [Arquitetura](docs/ARCHITECTURE.md)
6. [Modelo de dados](docs/DATA_MODEL.md)
7. [Contrato da API](docs/API.md)
8. [Seguranca e LGPD](docs/SECURITY_AND_LGPD.md)
9. [Decisoes a validar](docs/DECISIONS_TO_VALIDATE.md)
10. [Plano de validacao](docs/VALIDATION.md)
11. [Fluxo SDD](docs/specs/README.md) e [ordem das tarefas](docs/tasks/README.md)
12. [Skills e agentes](docs/AGENT_WORKFLOW.md)

## Como executar o trabalho

Implemente uma tarefa de `docs/tasks/` por vez, na ordem indicada. Antes de
codificar, leia a especificacao ligada a ela; ao terminar, execute os testes da
tarefa e marque somente criterios que tenham evidencia. Decisoes que mudem
contratos ou regras devem atualizar primeiro a documentacao correspondente.

## Demonstracao alvo

1. Master ativa um semestre e configura uma clinica de Fisioterapia.
2. Um aluno tenta entrar numa sessao e e bloqueado por documento pendente.
3. O aluno envia o documento e um responsavel o aprova com trilha de auditoria.
4. O aluno passa a integrar uma sessao compativel com sua disciplina e horario.
5. A comunidade encontra um horario e agenda.
6. Uma segunda reserva no limite correto e aceita; a seguinte recebe `SLOT_FULL`.
7. O agendamento e confirmado e depois pode ser cancelado pelo codigo seguro.

O chatbot nao pertence ao caminho critico do MVP. Ele so deve ser iniciado
depois que essa demonstracao estiver estavel.

## Executar a fundacao

Com Docker Compose instalado, a stack completa sobe com um unico comando:

```bash
cp .env.example .env
docker compose -f infra/compose.yml up -d --build
```

O comando inicia PostgreSQL, aplica a migration inicial antes de iniciar a API
e serve o frontend compilado pelo Nginx. Os healthchecks dos tres servicos
podem ser conferidos com:

```bash
docker compose -f infra/compose.yml ps
curl http://localhost:8000/api/v1/health/live
curl http://localhost:8000/api/v1/health/ready
```

Para criar ou atualizar os tres usuarios ficticios da demonstracao, execute o
seed idempotente depois que a API estiver saudavel:

```bash
docker compose -f infra/compose.yml exec api seed-demo
```

As credenciais demo ficam nas variaveis `DEMO_*` do ambiente local. Elas sao
apenas para a demonstracao e devem ser substituidas antes de qualquer uso real.
O login fica em <http://localhost:5173/login>.
O agendamento publico fica em <http://localhost:5173/agendar>; o seed cria uma
sessao, uma alocacao aprovada e horarios ficticios para essa demonstracao.

Os gates da API rodam no container; os gates do frontend rodam no workspace,
porque a imagem final do frontend contem somente o build estatico:

```bash
docker compose -f infra/compose.yml exec api alembic upgrade head
docker compose -f infra/compose.yml exec api python -m pytest
docker compose -f infra/compose.yml exec api ruff check .
docker compose -f infra/compose.yml exec api mypy app
npm --prefix apps/web ci
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web test -- --run
npm --prefix apps/web run build
```

## Publicar a demo na VPS

O repositório também contém uma stack Swarm para Portainer em
[`infra/stack.production.yml`](infra/stack.production.yml) e um workflow que
publica as imagens no GHCR em
`.github/workflows/publish-images.yml`. O build do frontend recebe a URL da API
durante a compilação; portanto, `VITE_API_URL` não deve ser configurada apenas
como `environment` no serviço já compilado.

O padrão usado para esta apresentação é:

- frontend: `clinicaescola.forlium.com`;
- API: `apiclinicaescola.forlium.com`.

Se preferir outro endereço para a API, altere `VITE_API_URL` no workflow e
`API_HOST` na stack antes de publicar a imagem novamente.

1. No Cloudflare, crie registros `A` para os dois hosts apontando para o IP da
   VPS, com proxy habilitado, e confirme que a rede Docker `traefik_public` e a
   rede externa `app_network` já existem.
2. Faça push na branch `main`. O workflow publica
   `ghcr.io/SEU_OWNER/clinica-escola-api` e
   `ghcr.io/SEU_OWNER/clinica-escola-web` com as tags `latest` e `sha-*`.
3. No Portainer, crie uma Stack usando `infra/stack.production.yml` e preencha
   as variáveis do arquivo
   [`infra/stack.production.env.example`](infra/stack.production.env.example).
   `DATABASE_URL` deve usar `db` como host; `JWT_SECRET_KEY` e
   `POSTGRES_PASSWORD` não devem usar os valores de exemplo.
4. Se os pacotes do GHCR forem privados, cadastre `ghcr.io` no Portainer com
   uma credencial que tenha somente leitura de pacotes. Se forem públicos, esse
   passo não é necessário.
5. Depois que a API estiver saudável, abra o console do container `api` no
   Portainer e execute `seed-demo` uma vez. O seed é fictício e idempotente.

Valide o deploy com:

```bash
curl https://apiclinicaescola.forlium.com/api/v1/health/live
curl https://apiclinicaescola.forlium.com/api/v1/health/ready
```

Em uma atualização que reutilize `latest`, force a atualização da stack para o
Swarm consultar a imagem novamente; para maior previsibilidade, use uma tag
`sha-*` no campo `IMAGE_TAG`.

## Assistencia do Codex

As skills versionadas ficam em `.agents/skills/`, com origens e hashes em
`skills-lock.json`. Os agentes especializados ficam em `.codex/agents/`; use o
fluxo de `docs/AGENT_WORKFLOW.md` para delegar sem colocar dois escritores nos
mesmos arquivos.
