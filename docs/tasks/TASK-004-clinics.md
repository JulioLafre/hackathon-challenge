# TASK-004 - Clinicas, servicos e recursos

Status: TODO
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

- [ ] Configuracao fica isolada por semestre.
- [ ] Servico declara duracao e requisitos de equipamento validos.
- [ ] Supervisor possui limite default e override opcional no escopo.
- [ ] Recursos desativados nao podem entrar em nova configuracao.
- [ ] Perfis fora de Master nao alteram recursos.

## Validacao minima

Testes de constraints, desativacao, RBAC e formularios. Rodar seed duas vezes e
confirmar que quantidades e relacionamentos nao duplicam.
