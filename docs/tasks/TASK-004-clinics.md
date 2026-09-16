# TASK-004 - Clinicas, servicos e recursos

Status: DONE
Depende de: TASK-003

## Objetivo

Representar limites fisicos e de supervisao que participarao da capacidade.

## Ler antes

- `docs/specs/002-semester-configuration.md`
- secoes Clinicas de `docs/DATA_MODEL.md`
- `BR-030` a `BR-032` em `docs/DOMAIN_RULES.md`

## Entregaveis

- migrations e CRUDs de clinica, ambiente, sala e equipamento;
- configuracao da clinica por semestre;
- servicos com duracao, disciplina e equipamentos exigidos;
- escopos de supervisor por semestre, ambiente e servico;
- validacao de limites positivos e referencias ativas;
- telas Master compactas para manter esses cadastros;
- seed com ambiente, duas salas, equipamento, servico e supervisor.

## Limites

- quantidade de equipamento, nao rastreamento de patrimonio individual;
- endereco e apenas rotulo de localizacao, sem geolocalizacao;
- ainda nao gerar sessoes nem horarios.

## Criterios de aceitacao

- [x] Configuracao fica isolada por semestre.
- [x] Servico declara duracao e requisitos de equipamento validos.
- [x] Supervisor possui limite default e override opcional no escopo.
- [x] Recursos desativados nao podem entrar em nova configuracao.
- [x] Perfis fora de Master nao alteram recursos.

## Validacao minima

Testes de constraints, desativacao, RBAC e formularios. Rodar seed duas vezes e
confirmar que quantidades e relacionamentos nao duplicam.

## Evidencia de validacao executada

- migration `0004_clinics` aplicada, revertida para `0003_academics` e aplicada
  novamente no PostgreSQL isolado;
- `pytest tests/test_clinics.py tests/test_academics.py tests/test_auth.py -q`
  concluido com exit code 0;
- `ruff check app tests` e `mypy app` concluidos sem erros;
- teste de componente `npm test -- --run src/App.test.tsx`: 6 testes passaram;
- `npm run typecheck`, `npm run lint` e `npm run build` do frontend concluidos
  sem erros ou warnings;
- seed executado duas vezes em banco limpo: 1 clinica, 1 ambiente, 2 salas,
  1 tipo de equipamento, 1 relacao de quantidade, 1 limite por semestre,
  1 servico, 1 requisito e 1 escopo.

Os testes cobriram somente os pontos criticos da fatia: isolamento por semestre,
limites positivos, RBAC Master, referencias inativas, duracao/requisito de
equipamento e override do supervisor. Sessoes, horarios e capacidade efetiva
continuam fora do escopo desta tarefa.
