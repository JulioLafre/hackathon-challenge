# TASK-001 - Fundacao executavel

Status: TODO

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

- [ ] `docker compose -f infra/compose.yml config` passa.
- [ ] Stack sobe do zero com um unico comando documentado.
- [ ] `/api/v1/health/live` e `/ready` respondem corretamente.
- [ ] Migration sobe em PostgreSQL vazio.
- [ ] Testes, lint e typecheck de ambos os apps rodam.
- [ ] Repositorio nao contem segredo nem arquivo de storage.

## Validacao minima

Execute todos os comandos propostos em `docs/VALIDATION.md`, ajustando o
documento se os nomes finais diferirem. Registre resultados no handoff.
