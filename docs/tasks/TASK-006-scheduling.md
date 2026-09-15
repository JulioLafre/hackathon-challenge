# TASK-006 - Sessoes e motor de capacidade

Status: TODO
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

- [ ] Todos os cenarios da SPEC-004 passam.
- [ ] Cada codigo de bloqueio deixa a transacao sem efeito parcial.
- [ ] Publicacao inviavel explica todos os fatores e o gargalo.
- [ ] Slots respeitam duracao e convencao `[inicio, fim)`.
- [ ] Suspensao de alocacao recalcula capacidade futura.
- [ ] Reducao abaixo do comprometido e rejeitada.

## Validacao minima

Testes unitarios parametrizados da formula e testes de integracao em PostgreSQL
para alocacao, publicacao, recalculo e RBAC. Validar visualmente o painel de
explicacao com o seed.
