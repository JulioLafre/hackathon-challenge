# TASK-006 - Sessoes e motor de capacidade

Status: DONE
Depende de: TASK-004, TASK-005

## Objetivo

Implementar o nucleo do desafio: alocar estudantes e publicar somente sessoes
que respeitem simultaneamente elegibilidade, grade, supervisao e recursos.

## Ler antes

- `docs/specs/004-sessions-and-capacity.md`
- `docs/DOMAIN_RULES.md`
- `docs/DATA_MODEL.md`
- `docs/adr/0002-transactional-capacity.md`

## Entregaveis

- migrations de sessoes, alocacoes e slots;
- servico puro de compatibilidade e capacidade com explicacao por fator;
- criacao/edicao/publicacao/cancelamento de sessao;
- alocacao propria do estudante e suporte pelo Master;
- geracao idempotente de slots;
- recalculo por mudanca de documento, alocacao ou recurso;
- telas de sessao, alocacao e explicacao de capacidade;
- testes unitarios de cada gargalo e integracao dos bloqueios.

## Limites

- sessao e datada; sem gerador de recorrencia;
- nao duplicar a formula no frontend;
- nao criar agendamento publico nesta tarefa.

## Criterios de aceitacao

- [x] Todos os cenarios criticos da SPEC-004 passam.
- [x] Cada codigo de bloqueio deixa a transacao sem efeito parcial.
- [x] Publicacao inviavel explica todos os fatores e o gargalo.
- [x] Slots respeitam duracao e convencao `[inicio, fim)`.
- [x] Suspensao de alocacao recalcula capacidade futura.
- [x] Reducao abaixo do comprometido preserva o comprometido e impede nova publicacao.

## Validacao minima

Testes de integracao em PostgreSQL cobrem documento pendente, conflito academico,
limite de supervisao, gargalo de sala, publicacao idempotente, publicacao
inviavel e recalculo de slot apos rejeicao documental. A tela interna exibe os
fatores devolvidos pela API sem repetir a formula no frontend.

## Handoff

- Arquivos principais: `apps/api/app/db/models.py`, `apps/api/alembic/versions/0006_scheduling.py`,
  `apps/api/app/modules/scheduling/`, `apps/api/app/api/routes/scheduling.py`,
  `apps/api/tests/test_scheduling.py` e `apps/web/src/features/scheduling/`.
- Validacoes: `python -m pytest tests/test_scheduling.py -q` (6 passed);
  `python -m ruff check app tests/test_scheduling.py`; `python -m mypy app`;
  `npm test -- --run src/features/scheduling/scheduling.test.tsx` (3 passed);
  `npm run typecheck`; `npm run lint`.
- Pendencias reais: a reserva publica pertence a TASK-007; nao foi adicionada
  nesta tarefa.
