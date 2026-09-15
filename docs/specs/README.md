# Fluxo SDD

Specification-Driven Development aqui significa: definir o comportamento
observavel, implementar a menor fatia que o satisfaz e validar contra os mesmos
cenarios. Os documentos nao substituem testes; eles dizem quais testes precisam
existir.

## Ciclo por tarefa

1. Escolher a proxima tarefa desbloqueada em `docs/tasks/README.md`.
2. Ler a especificacao e os contratos relacionados.
3. Se houver ambiguidade que mude comportamento, resolver na especificacao.
4. Escrever ou ajustar testes dos cenarios.
5. Implementar a fatia vertical minima.
6. Rodar os gates indicados na tarefa.
7. Atualizar status e registrar evidencia, sem marcar o que nao foi executado.

## Estados de uma especificacao

- `DRAFT`: ainda possui decisao bloqueante;
- `READY`: suficiente para implementar;
- `IMPLEMENTED`: criterios automatizados e manuais aplicaveis foram validados;
- `CHANGED`: comportamento precisa de nova implementacao/validacao.

## Indice

| Spec | Objetivo | Status inicial |
| --- | --- | --- |
| [SPEC-001](001-auth-and-access.md) | Autenticacao e papeis | READY |
| [SPEC-002](002-semester-configuration.md) | Configuracao por semestre | READY |
| [SPEC-003](003-document-eligibility.md) | Documentos e elegibilidade | READY |
| [SPEC-004](004-sessions-and-capacity.md) | Sessoes, alocacao e capacidade | READY |
| [SPEC-005](005-community-booking.md) | Agenda da comunidade | READY |
| [SPEC-006](006-master-operations.md) | Operacao Master e auditoria | READY |
| [SPEC-007](007-faq-assistant.md) | Assistente opcional | DRAFT/OPTIONAL |

## Modelo para nova especificacao

```md
# SPEC-NNN - Nome

Status: DRAFT

## Objetivo
## Dentro do escopo
## Fora do escopo
## Regras
## Cenarios
### Cenario: resultado observavel
Dado ...
Quando ...
Entao ...
## Contratos afetados
## Criterios de aceitacao
## Questoes em aberto
```

Uma spec descreve comportamento, nao lista arquivos a editar. Essa lista fica
na tarefa, permitindo alterar a implementacao sem reescrever a necessidade.
