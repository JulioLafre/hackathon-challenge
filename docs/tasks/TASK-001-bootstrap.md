# TASK-001 - Fundacao executavel

Status: DONE

## Objetivo

Criar o monorepo executavel e o circuito de qualidade usado por todas as outras
tarefas.

## Ler antes

- `docs/ARCHITECTURE.md`
- `docs/VALIDATION.md`
- `docs/adr/0001-modular-monolith.md`

## Entregaveis

- `apps/api` com FastAPI, configuracao por ambiente, health endpoints e pytest;
- `apps/web` com React/TypeScript/Vite, roteamento e tela inicial responsiva;
- SQLAlchemy async, Alembic e primeira migration de infraestrutura;
- `infra/compose.yml` com `db`, `api`, `web`, healthchecks e volumes;
- `.env.example` sem segredo e `.gitignore` cobrindo `.env` e `storage`;
- scripts de lint, typecheck e testes com os nomes de `docs/VALIDATION.md`;
- README atualizado com comandos reais, somente depois de testa-los.

## Limites

- nao implementar dominio alem de um healthcheck;
- nao adicionar Redis, broker, Kubernetes ou pipeline complexo;
- imagens e dependencias devem ter versao fixada de forma razoavel.

## Criterios de aceitacao

- [x] `docker compose -f infra/compose.yml config` passa (validado pelo
  provider Docker Compose via `podman compose`, pois o binario `docker` nao esta
  instalado no ambiente).
- [x] Stack sobe do zero com um unico comando documentado.
- [x] `/api/v1/health/live` e `/ready` respondem corretamente.
- [x] Migration sobe em PostgreSQL vazio.
- [x] Testes, lint e typecheck de ambos os apps rodam.
- [x] Repositorio nao contem segredo nem arquivo de storage.

## Evidencia de validacao

- `podman compose -f infra/compose.yml config`: passou pelo provider Docker
  Compose disponivel no ambiente;
- `podman compose -f infra/compose.yml up -d --build`: passou; `db`, `api` e
  `web` subiram e ficaram `healthy`;
- `curl http://127.0.0.1:8000/api/v1/health/live`: `200` com `{"status":"ok"}`;
- `curl http://127.0.0.1:8000/api/v1/health/ready`: `200` com banco e storage
  `ok`;
- `podman compose -f infra/compose.yml exec -T api alembic upgrade head`:
  passou; PostgreSQL vazio criou `alembic_version` e `app_metadata`;
- `podman compose -f infra/compose.yml exec -T api pytest`: 5 passaram;
- `podman compose -f infra/compose.yml exec -T api ruff check .`: passou;
- `podman compose -f infra/compose.yml exec -T api mypy app`: passou;
- `npm --prefix apps/web run lint`: passou;
- `npm --prefix apps/web run typecheck`: passou;
- `npm --prefix apps/web test -- --run`: 2 passaram;
- `npm --prefix apps/web run build`: passou.

## Validacao minima

Execute todos os comandos propostos em `docs/VALIDATION.md`, ajustando o
documento se os nomes finais diferirem. Registre resultados no handoff.
