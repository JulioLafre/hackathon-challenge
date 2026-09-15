# TASK-007 - Agendamento da comunidade

Status: TODO
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

- [ ] Todos os cenarios da SPEC-005 passam.
- [ ] Teste concorrente produz exatamente um sucesso para a ultima vaga.
- [ ] Idempotencia devolve a reserva original sem nova contagem.
- [ ] Cancelamento libera aluno, sala e capacidade na mesma transacao.
- [ ] Consulta publica nao revela identidade interna ou contato alheio.
- [ ] Fluxo funciona por teclado e em 360 px.

## Validacao minima

Executar matriz de concorrencia, seguranca e jornada manual de
`docs/VALIDATION.md`. Inspecionar banco ao final para confirmar contagem e
ausencia de codigo em texto puro.
