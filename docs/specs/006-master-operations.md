# SPEC-006 - Operacao Master e auditoria

Status: READY

## Objetivo

Dar ao responsavel uma visao simples das pendencias e ferramentas para manter a
configuracao, sem transformar o MVP em uma plataforma analitica.

## Dentro do escopo

- painel do semestre com contagens e alertas;
- gestao de usuarios e ativacao/desativacao;
- acesso aos cadastros da SPEC-002;
- fila de reservas `AT_RISK`;
- consulta paginada da auditoria.

## Fora do escopo

BI, relatorios customizados, exportacao massiva, impersonacao e edicao direta de
dados historicos.

## Regras

- toda mutacao administrativa sensivel gera auditoria;
- auditoria e append-only pela aplicacao;
- painel usa agregacoes e nao expoe documento ou contato desnecessario;
- desativacao exige confirmacao e nao apaga historico;
- reserva em risco mostra acao necessaria, nao e cancelada automaticamente.

## Cenarios

### Cenario: visao do semestre

Dado um semestre ativo com documentos pendentes, sessoes e reservas
Quando Master abre o painel
Entao ve contagens, proximas sessoes e alertas de capacidade/risco.

### Cenario: desativar usuario

Dado um supervisor com historico
Quando Master confirma a desativacao
Entao novos acessos sao bloqueados, historico permanece e a acao e auditada.

### Cenario: reserva em risco

Dado uma reserva marcada `AT_RISK`
Quando Master consulta o alerta
Entao ve sessao, horario e causa operacional, com opcoes futuras de substituir
alocacao ou cancelar; nenhum dado clinico e exibido.

### Cenario: acesso negado

Dado qualquer perfil diferente de Master
Quando acessa dashboard ou auditoria globais
Entao recebe `403 FORBIDDEN`.

## Contratos afetados

`GET /admin/dashboard`, gestao de cadastros, `audit_events` e interface interna.

## Criterios de aceitacao

- [ ] Painel responde para semestre selecionado e possui estado vazio.
- [ ] Numeros batem com consultas de integracao do seed.
- [ ] Mutacoes criticas aparecem na auditoria com ator, alvo, acao e instante.
- [ ] Auditoria nao contem PII, token ou conteudo de arquivo.
- [ ] Desativacao revoga acesso sem quebrar referencias.
- [ ] Reservas em risco ficam visiveis e acionaveis.

## Questoes em aberto

Substituicao de estudante pode ser manual no banco de demo inicialmente, mas nao
deve ser apresentada como fluxo completo ate existir endpoint/interface.
