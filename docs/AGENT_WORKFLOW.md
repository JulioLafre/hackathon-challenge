# Skills e agentes do projeto

Este arquivo define como o agente principal distribui trabalho sem perder a
fonte de verdade do SDD. As configuracoes seguem o formato de agentes locais do
Codex em `.codex/agents/`.

## Skills instaladas

As skills sao locais, copiadas para `.agents/skills/` e fixadas por hash em
`skills-lock.json`.

| Skill | Origem | Uso no projeto |
| --- | --- | --- |
| `fastapi` | [FastAPI oficial](https://skills.sh/fastapi/fastapi/fastapi) | Rotas, schemas, dependencias e respostas |
| `vercel-react-best-practices` | [Vercel](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) | Componentes, dados e desempenho React |
| `web-design-guidelines` | [Vercel](https://skills.sh/vercel-labs/agent-skills/web-design-guidelines) | Revisao de UX, responsividade e acessibilidade |
| `postgresql-table-design` | [wshobson](https://skills.sh/wshobson/agents/postgresql-table-design) | Constraints, indices, ranges e migrations |
| `auth-implementation-patterns` | [wshobson](https://skills.sh/wshobson/agents/auth-implementation-patterns) | JWT, Argon2id, RBAC e autorizacao por objeto |
| `e2e-testing-patterns` | [wshobson](https://skills.sh/wshobson/agents/e2e-testing-patterns) | Jornadas Playwright e testes nao frageis |
| `test-driven-development` | [obra](https://skills.sh/obra/superpowers/test-driven-development) | Ciclo teste falhando, implementacao e refatoracao |
| `systematic-debugging` | [obra](https://skills.sh/obra/superpowers/systematic-debugging) | Reproducao e causa raiz antes da correcao |

A skill de FastAPI sugere SQLModel em alguns casos; a decisao documentada deste
projeto por SQLAlchemy 2 prevalece. A skill de autenticacao teve um alerta do
scanner Socket nos exemplos de secrets por variavel de ambiente, mas foi
classificada como Safe/Low Risk e a auditoria local nao encontrou execucao ou
download automatico.

Nota de dependencia: o `AGENTS.md` compilado de `vercel-react-best-practices`
possui tres links relativos upstream que omitem a pasta `rules/` e alguns espacos
finais. O `SKILL.md` aponta corretamente para `rules/`; nao editar a copia local
apenas para lint, pois isso diverge do hash e sera sobrescrito por atualizacao.

Restaurar skills em outro clone:

```text
npx skills experimental_install
npx skills list --json
```

## Agentes disponiveis

| Agente | Escrita | Responsabilidade |
| --- | --- | --- |
| `backend_engineer` | Conforme permissao da sessao | FastAPI, dominio, PostgreSQL, migrations e transacoes |
| `frontend_engineer` | Conforme permissao da sessao | React, estados de tela, responsividade e acessibilidade |
| `quality_engineer` | Testes e fixtures | Pytest, integracao, Playwright e diagnostico |
| `domain_security_reviewer` | Nao, sandbox read-only | Auditoria de invariantes, contratos, concorrencia, RBAC e LGPD |

O agente principal continua sendo coordenador e integrador. Agente especializado
nao altera status de tarefa nem decide mudanca de contrato sozinho.

## Sequencia recomendada por tarefa

1. Agente principal escolhe uma tarefa desbloqueada e fixa contratos.
2. `quality_engineer` transforma criterios em testes que falham, quando puder
   trabalhar em arquivos diferentes do implementador.
3. `backend_engineer` implementa API/dados e `frontend_engineer` implementa a UI
   somente depois de o payload estar definido.
4. `quality_engineer` roda a matriz aplicavel no Compose real.
5. `domain_security_reviewer` revisa o diff e reporta achados por severidade.
6. Agente principal corrige/integrara, executa gates e atualiza o status.

Para TASK-001, crie primeiro a estrutura compartilhada antes de paralelizar. Em
TASK-006 e TASK-007, migrations e transacoes pertencem somente ao
`backend_engineer`; `quality_engineer` pode preparar testes concorrentes em
arquivos separados. TASK-008 deve terminar com revisao read-only.

## Prompts de delegacao

Backend:

```text
Use backend_engineer para implementar a parte de API e banco da TASK-NNN.
Restrinja-se a apps/api e migrations, siga a spec ligada e devolva testes e
comandos executados. Nao altere o status da tarefa.
```

Frontend:

```text
Use frontend_engineer para implementar as telas da TASK-NNN contra o contrato
ja definido. Restrinja-se a apps/web e devolva testes e verificacao responsiva.
```

Qualidade:

```text
Use quality_engineer para implementar e executar os testes da TASK-NNN. Nao
enfraqueca asserts nem altere producao; reporte a causa reproduzivel das falhas.
```

Gate final:

```text
Use domain_security_reviewer para revisar o diff da TASK-NNN contra spec,
regras, API, dados, seguranca e LGPD. Nao edite; retorne achados com arquivo,
linha, impacto e reproducao.
```

## Regras de paralelismo

- limite configurado: quatro threads concorrentes por sessao;
- um unico agente escreve cada arquivo por rodada;
- nao rodar migrations concorrentes;
- nao compartilhar servidor de teste mutavel sem bancos/schemas isolados;
- parar a paralelizacao quando um payload ou regra ainda estiver em disputa;
- revisar `git status` e `git diff` antes de integrar cada resultado.

## Atualizacao

```text
npx skills check
npx skills update -p
```

Atualizacao de skill e uma mudanca de dependencia: revisar o diff em
`.agents/skills/` e `skills-lock.json` antes de aceitar.

Referencia do formato: [Custom agents no Codex](https://developers.openai.com/codex/multi-agent/).
