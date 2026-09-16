# SPEC-003 - Documentos e elegibilidade

Status: READY

## Objetivo

Coletar comprovantes digitais, oferecer revisao rastreavel e impedir que
estudantes com pendencia sejam alocados para atendimento.

## Dentro do escopo

- requisito por semestre e disciplina/estagio opcional;
- checklist individual;
- upload privado de PDF/JPEG/PNG;
- fila de revisao por escopo;
- aprovacao, recusa com motivo, validade e reenvio;
- calculo de elegibilidade e reacao a invalidacao futura.

## Fora do escopo

Assinatura digital, OCR, antivirus local na demo e integracao com GED.

## Regras

- upload valido inicia em `PENDING_REVIEW`;
- recusa exige instrucao de correcao nao vazia;
- reenvio cria versao e nao sobrescreve a anterior;
- estudante so e elegivel com todos os requisitos aplicaveis aprovados e validos;
- arquivo nao possui URL publica;
- supervisor revisa apenas quando seu escopo permite;
- invalidacao suspende alocacoes futuras e sinaliza reservas afetadas.

## Cenarios

### Cenario: pendencia bloqueia

Dado um estudante sem um documento obrigatorio aprovado
Quando solicita alocacao
Entao recebe `409 DOCUMENTS_PENDING` com os IDs dos requisitos pendentes.

### Cenario: recusa orientada

Dado uma submissao pendente no escopo do revisor
Quando ele recusa sem motivo
Entao a API retorna `422` e mantem o estado pendente.

### Cenario: reenvio aprovado

Dado uma submissao rejeitada
Quando o estudante envia novo arquivo e o revisor aprova
Entao a versao rejeitada permanece no historico e o requisito fica atendido.

### Cenario: acesso indevido

Dado um supervisor fora do escopo
Quando tenta baixar ou revisar a submissao
Entao recebe `404` e nenhum metadado e exposto.

### Cenario: documento expira depois da reserva

Dado um estudante alocado com agendamento futuro
Quando sua aprovacao expira
Entao a alocacao vira `SUSPENDED`, a capacidade e recalculada e a reserva vira
`AT_RISK`, sem cancelamento silencioso.

## Contratos afetados

`document_requirements`, `document_submissions`, storage privado, rotas de
documentos e eventos de auditoria.

## Criterios de aceitacao

- [ ] Checklist distingue ausente, pendente, aprovado, recusado e expirado.
- [ ] Upload invalido e rejeitado antes de persistir metadado ativo.
- [ ] Motivo da recusa aparece para o estudante.
- [ ] Download valida dono ou escopo de revisao.
- [ ] Elegibilidade muda de forma consistente com o historico.
- [ ] Suspensao posterior sinaliza, mas nao perde, reservas existentes.

## Questoes em aberto

Prazo real de retencao e tipos documentais serao configurados pela instituicao;
o seed usa exemplos ficticios.

## Decisao de integracao entre tarefas

A TASK-005 entrega a consulta StudentEligibility e os estados necessarios
para que o motor de sessoes consuma a elegibilidade sem duplicar regra. A
suspensao de alocacoes e a sinalizacao de reservas serao implementadas nas
TASK-006/TASK-007, pois essas entidades ainda nao existem no modelo atual.
Enquanto essas tarefas nao forem concluidas, nao ha alocacao ou reserva que
possa ser suspensa por expiracao.
