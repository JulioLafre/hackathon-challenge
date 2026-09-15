# Guia para agentes

## Fonte de verdade

Antes de implementar, leia `README.md`, `CONTEXT.md`, a especificacao relevante
em `docs/specs/` e a tarefa atual em `docs/tasks/`. Para conflitos:

1. criterios de aceitacao da especificacao;
2. regras de `docs/DOMAIN_RULES.md`;
3. contratos de `docs/API.md` e `docs/DATA_MODEL.md`;
4. detalhes da tarefa.

Nao invente uma regra silenciosamente. Registre a decisao na especificacao
antes de alterar o comportamento.

## Forma de entrega

- Trabalhe em uma unica tarefa por vez.
- Entregue uma fatia vertical quando a tarefa envolver API e interface.
- Mantenha regras de negocio no backend; o frontend apenas as representa.
- Toda regra de bloqueio precisa de teste automatizado e codigo de erro estavel.
- Use migrations; nunca dependa de criacao implicita de tabelas.
- Use dados ficticios no seed e nos exemplos.
- Nao registre senhas, tokens, documentos, telefone ou e-mail em logs.
- Nao adicione Redis ate existir necessidade de mais de uma instancia da API ou
  rate limiting distribuido.
- Nao implemente prontuario, diagnostico, pagamento ou teleatendimento: estao
  fora do escopo.

## Skills locais

Skills versionadas vivem em `.agents/skills/`. Use somente as que forem
pertinentes a tarefa e leia o `SKILL.md` inteiro antes de agir. Os contratos
deste repositorio prevalecem sobre recomendacoes genericas; em particular, o
backend usa SQLAlchemy 2 mesmo que uma skill sugira SQLModel.

Mapeamento principal:

- FastAPI: `fastapi`;
- schema e migrations: `postgresql-table-design`;
- autenticacao/RBAC: `auth-implementation-patterns`;
- React: `vercel-react-best-practices`;
- UX/acessibilidade: `web-design-guidelines`;
- implementacao: `test-driven-development`;
- E2E: `e2e-testing-patterns`;
- falhas: `systematic-debugging`.

## Coordenacao de agentes

Os agentes do projeto vivem em `.codex/agents/`. O agente principal possui a
tarefa e integra resultados; somente ele altera status em `docs/tasks/`.
Delegue subtarefas pequenas e independentes conforme `docs/AGENT_WORKFLOW.md`.

- Nunca coloque dois agentes escritores no mesmo arquivo ao mesmo tempo.
- Migrations e contratos possuem um unico dono por rodada.
- Backend e frontend so trabalham em paralelo depois de o payload estar fixado.
- O revisor de dominio/seguranca e somente leitura.
- Antes do handoff, verifique mudancas concorrentes com `git status` e `git diff`.

## Conclusao de uma tarefa

Uma tarefa so esta concluida quando codigo, migration, testes e documentacao
afetada concordam. Registre no handoff:

- arquivos alterados;
- comandos executados e resultados;
- criterios atendidos;
- riscos ou pendencias reais.

Nao declare validacao que nao foi executada.
