# Plano de execucao

Execute na ordem. Uma tarefa com dependencia nao comeca enquanto a anterior nao
possuir codigo e validacao. O status so muda com evidencia.

| Ordem | Tarefa | Depende de | Resultado demonstravel | Status |
| --- | --- | --- | --- | --- |
| 1 | [TASK-001](TASK-001-bootstrap.md) | - | Stack sobe e migrations/testes rodam | TODO |
| 2 | [TASK-002](TASK-002-auth.md) | 001 | Tres papeis entram e RBAC bloqueia | TODO |
| 3 | [TASK-003](TASK-003-academics.md) | 002 | Semestre e grade configuraveis | TODO |
| 4 | [TASK-004](TASK-004-clinics.md) | 003 | Clinica, recursos e servico configurados | TODO |
| 5 | [TASK-005](TASK-005-documents.md) | 003 | Upload, revisao e bloqueio funcionam | TODO |
| 6 | [TASK-006](TASK-006-scheduling.md) | 004, 005 | Sessao publica somente capacidade real | TODO |
| 7 | [TASK-007](TASK-007-booking.md) | 006 | Comunidade reserva sem exceder limite | TODO |
| 8 | [TASK-008](TASK-008-demo-hardening.md) | 007 | Painel, seed, seguranca e roteiro estaveis | TODO |
| 9 | [TASK-009](TASK-009-faq-assistant.md) | 008 | Diferencial opcional isolado | OPTIONAL |

## Regra de status

- `TODO`: nao iniciado;
- `DOING`: existe trabalho em curso;
- `BLOCKED`: impedimento concreto registrado no arquivo;
- `DONE`: todos os criterios e testes aplicaveis passaram;
- `OPTIONAL`: nao faz parte do MVP.

## Como passar uma tarefa ao Codex

Use uma instrucao curta:

```text
Implemente docs/tasks/TASK-NNN-nome.md de ponta a ponta. Siga AGENTS.md, leia a
spec e os contratos vinculados, execute os testes pedidos e atualize o status
somente com evidencia. Nao avance para a proxima tarefa.
```

Ao descobrir uma regra nova, atualize a spec primeiro. Ao mudar payload ou
tabela, atualize `docs/API.md` ou `docs/DATA_MODEL.md` na mesma entrega.
