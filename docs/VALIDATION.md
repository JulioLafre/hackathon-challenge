# Plano de validacao

## Estrategia

Validar por camadas, com maior cobertura nas regras que podem permitir um
atendimento inviavel. Testes unitarios cobrem calculo e estados; integracao com
PostgreSQL cobre constraints, locks e autorizacao; poucos testes de interface
cobrem as jornadas principais.

## Gates por entrega

Quando a estrutura existir, toda tarefa deve executar o subconjunto aplicavel:

```text
docker compose -f infra/compose.yml config
docker compose -f infra/compose.yml up -d --build
docker compose -f infra/compose.yml exec api alembic upgrade head
docker compose -f infra/compose.yml exec api python -m pytest
docker compose -f infra/compose.yml exec api ruff check .
docker compose -f infra/compose.yml exec api mypy app
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web test -- --run
```

Os tres comandos do frontend rodam no workspace, porque a imagem final do
servico `web` contem somente os arquivos compilados e o Nginx; o `npm run build`
correspondente ja e executado no estagio Node durante o `docker compose up`.

Os comandos abaixo sao o contrato consolidado pela `TASK-001` para os gates
locais e do Compose.

## Matriz de rastreabilidade

| Regra/requisito | Nivel | Caso obrigatorio |
| --- | --- | --- |
| RF-04, BR-010 | Unitario + integracao | Aprovar, recusar com motivo, expirar e reenviar |
| RF-05, BR-011 | Integracao | Documento pendente bloqueia alocacao |
| RF-07, BR-030 | Unitario + integracao | Supervisor no limite rejeita novo estudante |
| RF-08, BR-021 | Unitario | Sobreposicao academica parcial e total |
| TASK-003 | Integracao PostgreSQL | Exclusividade de semestre, RBAC, fuso institucional, intervalos adjacentes e conflito |
| TASK-004 | Integracao PostgreSQL + componente | Isolamento por semestre, constraints positivas, referencias inativas, RBAC Master, seed idempotente e formularios |
| RF-09, BR-040 | Unitario | Cada fator e isoladamente o gargalo |
| BR-042 | Unitario | Geracao com sobra menor que a duracao |
| RF-13, BR-050 | Integracao concorrente | Duas transacoes disputam ultima vaga |
| BR-051 | Integracao | Repetir idempotency key nao duplica |
| BR-012 | Integracao | Documento invalido suspende e marca risco |
| RF-14 | Integracao de seguranca | Cada perfil recebe 403/404 fora do escopo |
| RNF-02 | Componente/manual | 360 px, tablet e desktop sem overflow |
| RNF-05 | Componente/manual | Teclado, foco, labels e contraste |
| RNF-06 | Integracao | Rate limit, upload invalido e erro sanitizado |

Para a TASK-003, a validacao executada foi reduzida aos pontos criticos da
fatia: migration `0003_academics`, ativacao exclusiva e preservacao historica,
RBAC de estudante, compatibilidade de vinculo, conflito `[inicio, fim)`, fuso
fixo, disponibilidade propria, testes de componente, typecheck, lint e build.

Para a TASK-004, a validacao executada foi reduzida aos pontos criticos da
fatia: migration `0004_clinics` com downgrade/upgrade, testes PostgreSQL de
clinicas com regressao academica e auth, Ruff, mypy, teste de componente da
configuracao Master, typecheck, lint, build e duas execucoes do seed em banco
limpo. Nao foram executados testes de sessoes/capacidade efetiva porque esses
fluxos ainda nao fazem parte da tarefa.

Para a TASK-006, a validacao executada foi reduzida aos pontos criticos da
fatia: python -m pytest tests/test_scheduling.py -q (6 passed), Ruff, mypy,
teste de componente de sessoes (3 passed), typecheck, lint e build.

Para a TASK-007, foram executados os testes PostgreSQL de catalogo publico,
concorrencia pela ultima vaga, idempotencia, confirmacao/cancelamento e bloqueio
apos inicio: python -m pytest tests/test_booking.py -q (4 passed), migration
0007_booking com downgrade/upgrade, teste de componente publico (1 passed),
Ruff, mypy, typecheck, lint e build.

Para a TASK-008, foram executados os testes PostgreSQL do dashboard, RBAC,
desativacao, auditoria e fila AT_RISK: python -m pytest tests/test_admin.py -q
(3 passed), mais a regressao de rejeicao documental em test_scheduling.py. O
seed foi executado duas vezes e manteve os totais do banco local; a suíte web
ficou em 5 arquivos e 13 testes, com typecheck, lint e build aprovados. O
preflight CORS respondeu 200 com Idempotency-Key, e API/frontend responderam
200 com headers de seguranca.

Para a revisao de jornada da interface, foram validados os roteiros por papel,
a tela propria de Auditoria do Master, o resumo da jornada do estudante e a
linguagem operacional das telas Master: a suíte web ficou em 7 arquivos e 20
testes, com typecheck, lint e build aprovados.
Nenhum contrato da API foi alterado.

## Teste de concorrencia critico

Preparar horario com `capacity_total = 1`. Disparar dois POSTs de reserva com
chaves idempotentes diferentes, sincronizados por barreira. Resultado aceito:

- exatamente um `201`;
- exatamente um `409 SLOT_FULL`;
- `reserved_count = 1`;
- exatamente um agendamento ativo;
- nenhum recurso duplamente associado.

Repetir o teste com dois slots de sessoes diferentes que compartilham a ultima
sala, unidade de equipamento ou limite global da clinica. Bloquear apenas a linha
de um slot nao e evidencia suficiente para esse caso.

SQLite nao valida esse teste; ele deve rodar em PostgreSQL real do Compose.

## Testes de seguranca minimos

- login com e-mail inexistente e senha errada retorna a mesma mensagem;
- estudante A nao le documento ou alocacao do estudante B;
- supervisor sem escopo nao revisa documento nem altera sessao;
- comunidade nao acessa rotas internas;
- token expirado/desativado e rejeitado;
- tentativa de alterar `role`, `status` ou `reviewed_by` por mass assignment falha;
- upload disfarçado, acima do limite ou com caminho malicioso falha;
- respostas e logs nao revelam hash, stack trace ou PII;
- limite de login e agendamento produz `429`.

## Roteiro de aceite manual

1. Rodar migrations e seed duas vezes; a segunda execucao nao duplica dados.
2. Entrar como estudante demo e ver requisito pendente.
3. Tentar alocacao e observar mensagem de documento pendente.
4. Enviar PDF ficticio; entrar como supervisor e recusar com instrucao.
5. Reenviar e aprovar; retornar ao estudante e concluir alocacao compativel.
6. Publicar sessao e explicar o fator limitante de capacidade.
7. Em janela anonima, filtrar servico/data e reservar.
8. Confirmar a reserva com o codigo retornado.
9. Esgotar o horario e verificar que ele desaparece da consulta publica.
10. Cancelar uma reserva e verificar que a vaga reaparece.
11. Entrar como Master e conferir auditoria e indicadores.

## Evidencia para a banca

Guardar capturas ou video curto de tres provas, usando apenas dados ficticios:

- bloqueio por documentacao com mensagem de correcao;
- painel de capacidade mostrando qual recurso limita a sessao;
- concorrencia ou tentativa acima do limite retornando `SLOT_FULL`.

## Definition of Done global

- migration sobe em banco vazio e faz downgrade quando aplicavel;
- OpenAPI reflete o comportamento implementado;
- testes das regras afetadas passam no PostgreSQL do Compose;
- interface trata loading, vazio, erro e sucesso;
- autorizacao negativa esta coberta;
- nenhuma fixture contem dado pessoal real;
- documentacao e criterios da tarefa foram atualizados.
