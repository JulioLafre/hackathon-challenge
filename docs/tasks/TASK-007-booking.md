# TASK-007 - Agendamento da comunidade

Status: DONE
Depende de: TASK-006

## Objetivo

Entregar a jornada publica e garantir que reservas concorrentes nunca excedam a
capacidade efetiva.

## Ler antes

- `docs/specs/005-community-booking.md`
- secao Jornada publica de `docs/API.md`
- teste de concorrencia em `docs/VALIDATION.md`

## Entregaveis

- migration de agendamentos e constraints de contagem/idempotencia;
- consulta publica agregada de servicos e slots;
- reserva com locks em ordem estavel, revalidacao e associacao de aluno, sala e
  quantidades de equipamento;
- codigo de gestao com hash, confirmacao e cancelamento;
- rate limit publico e aceite versionado de privacidade;
- interface responsiva em ate quatro telas;
- teste concorrente contra PostgreSQL e testes de idempotencia;
- dados ficticios integrados ao seed.

## Limites

- nao criar conta para comunidade;
- nao coletar CPF, endereco completo, dado clinico ou texto livre;
- nao enviar notificacao real; exibir o codigo uma vez na demo;
- nao permitir escolha de estudante ou supervisor.

## Criterios de aceitacao

- [x] Todos os cenarios criticos da SPEC-005 passam.
- [x] Teste concorrente produz exatamente um sucesso para a ultima vaga.
- [x] Idempotencia devolve a reserva original sem nova contagem.
- [x] Cancelamento libera aluno, sala e capacidade na mesma transacao.
- [x] Consulta publica nao revela identidade interna ou contato alheio.
- [x] Fluxo funciona por teclado e em 360 px.

## Validacao minima

Executados os testes criticos de PostgreSQL para catalogo publico, corrida pela
ultima vaga, idempotencia, confirmacao/cancelamento e bloqueio apos inicio.
O componente cobre a busca e a submissao com `Idempotency-Key`; os estados de
vazio, erro e sucesso sao representados na mesma jornada responsiva.

## Handoff

- Arquivos principais: `apps/api/app/db/models.py`, `apps/api/alembic/versions/0007_booking.py`,
  `apps/api/app/api/routes/booking.py`, `apps/api/app/modules/booking/`,
  `apps/api/tests/test_booking.py` e `apps/web/src/features/public-booking/`.
- Validacoes: `alembic upgrade head`; `python -m pytest tests/test_booking.py -q`
  (4 passed); `python -m ruff check app tests/test_booking.py tests/test_scheduling.py`;
  `python -m mypy app`; `npm test -- --run src/features/public-booking/booking.test.tsx`
  (1 passed); `npm run typecheck`; `npm run lint`.
- Pendencias reais: seed completo, dashboard Master e headers finais pertencem
  a TASK-008.
