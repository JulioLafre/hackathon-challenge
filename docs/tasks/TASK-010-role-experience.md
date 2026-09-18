# TASK-010 - Experiencia dos papeis e horarios publicos

Status: DONE

## Objetivo

Finalizar a fatia de interface dos papeis Supervisor, Estudante e Comunidade,
substituindo identificadores tecnicos por selecoes legiveis e exibindo horarios
publicos como cards selecionaveis.

## Escopo

- supervisor cria e edita sessoes em rascunho escolhendo a configuracao por
  nomes de semestre, servico, clinica e ambiente;
- estudante visualiza suas sessoes e oportunidades compativeis, com motivos
  de bloqueio devolvidos pela API, e pode entrar/sair quando permitido;
- comunidade recebe os proximos horarios com vaga e filtra a lista sem uma
  busca manual por horario;
- contratos, testes e documentacao permanecem alinhados;
- nao ha alteracao de modelo ou migration nesta tarefa.

## Criterios de aceitacao

- [x] Supervisor nao precisa digitar UUID para criar ou editar rascunho.
- [x] Contexto de sessoes internas aparece com nomes legiveis.
- [x] Estudante tem uma tela propria para sessoes e alocacao.
- [x] Bloqueios de estudante mostram codigo/mensagem estaveis da API.
- [x] Comunidade ve horarios em cards e consegue selecionar um diretamente.
- [x] Filtros publicos nao escondem estados de carregamento, vazio ou erro.
- [x] Testes aplicaveis e typecheck/lint/build executados com resultado registrado.

## Contratos afetados

- `GET /me/session-options`;
- `GET /me/available-sessions`;
- `GET /public/slots` com `service_id` opcional.

## Handoff

Arquivos principais alterados:

- `apps/api/app/api/routes/scheduling.py` e
  `apps/api/app/modules/scheduling/schemas.py`: opcoes legiveis do supervisor e
  sessoes/oportunidades do estudante;
- `apps/api/app/api/routes/booking.py`: consulta publica sem `service_id`
  obrigatorio;
- `apps/web/src/features/scheduling/`,
  `apps/web/src/features/public-booking/`, `apps/web/src/features/auth/`,
  `apps/web/src/features/journey/` e `apps/web/src/styles.css`: seletores,
  cards, estados e navegacao;
- `apps/api/tests/`, `apps/web/src/**/*.test.tsx` e `docs/`: contratos,
  testes e decisoes de interface.

Validacoes executadas:

- `npm --prefix apps/web test -- --run`: 9 arquivos, 26 testes passaram;
- `npm --prefix apps/web run typecheck`, `npm --prefix apps/web run lint` e
  `npm --prefix apps/web run build`: passaram;
- `docker compose -f infra/compose.yml exec -T api python -m pytest -q`:
  38 testes passaram;
- `docker compose -f infra/compose.yml exec -T api ruff check` nos arquivos
  alterados: passou;
- `docker compose -f infra/compose.yml exec -T api mypy app`: passou;
- `docker compose -f infra/compose.yml config`: passou; API, banco e web
  ficaram saudaveis no Compose.

Pendencia real: `ruff check .` ainda aponta problemas preexistentes de
organizacao de imports e linhas longas nas migrations `0003` a `0007`; os
arquivos desta tarefa passaram no Ruff. Nenhuma migration foi necessaria nesta
fatia.
