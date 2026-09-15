# SPEC-005 - Agendamento da comunidade

Status: READY

## Objetivo

Permitir que qualquer pessoa encontre um horario realmente disponivel e gerencie
sua reserva com o minimo de dados pessoais e sem criar conta.

## Dentro do escopo

- catalogo publico de servicos;
- filtro por servico, clinica e intervalo de datas;
- criacao idempotente e transacional;
- confirmacao e cancelamento por codigo;
- estados de sucesso, vazio, lotacao e erro na interface responsiva.

## Fora do escopo

Escolha de estudante/supervisor, lista de espera, pagamento, prontuario e envio
real de notificacao.

## Regras

- consulta retorna somente slots publicados com vaga;
- reserva revalida a capacidade dentro da transacao;
- cada reserva ocupa alocacao e sala sem conflito no mesmo intervalo;
- `Idempotency-Key` evita duplicidade por repeticao/rede;
- codigo de gestao e exibido uma vez e apenas seu hash e persistido;
- nome e um contato sao suficientes; nao coletar dado clinico;
- cancelamento libera a vaga de forma atomica.
- confirmacao/cancelamento publico so ocorre antes do inicio do horario.

## Cenarios

### Cenario: consulta publica

Dado um servico com um slot cheio e outro com vaga
Quando a comunidade pesquisa a data
Entao somente o slot com vaga e retornado e nenhum nome interno aparece.

### Cenario: ultima vaga concorrente

Dado um slot com uma vaga
Quando duas reservas diferentes sao enviadas simultaneamente
Entao exatamente uma recebe `201` e a outra `409 SLOT_FULL`.

### Cenario: repeticao da requisicao

Dado uma reserva criada
Quando o mesmo payload e chave idempotente sao reenviados
Entao a API devolve a reserva original sem consumir outra vaga.

### Cenario: sessoes diferentes disputam recurso

Dado dois slots de sessoes diferentes que compartilham a ultima sala ou unidade
de equipamento no mesmo intervalo
Quando duas reservas sao enviadas simultaneamente
Entao apenas uma consome o recurso e a outra recebe `SLOT_FULL`.

### Cenario: confirmacao

Dado uma reserva `BOOKED` e codigo valido
Quando a pessoa confirma
Entao o estado vira `CONFIRMED` e a transicao e auditada sem guardar o codigo.

### Cenario: cancelamento

Dado uma reserva ativa e codigo valido
Quando a pessoa cancela
Entao o estado vira `CANCELLED`, a vaga reaparece e nova repeticao e idempotente.

### Cenario: codigo invalido

Dado um identificador existente e codigo incorreto
Quando ocorre tentativa de gestao
Entao retorna resposta generica `INVALID_MANAGEMENT_CODE` e aplica rate limit.

### Cenario: tentativa depois do inicio

Dado uma reserva cujo horario ja comecou
Quando a comunidade tenta confirmar ou cancelar por codigo
Entao recebe `INVALID_STATE_TRANSITION` e o estado e preservado.

## Contratos afetados

`appointment_slots`, `appointments`, locks no PostgreSQL, rotas `/public` e aviso
de privacidade.

## Criterios de aceitacao

- [ ] Fluxo cabe em ate quatro telas e funciona a 360 px.
- [ ] Slot cheio nao aparece e corrida pela ultima vaga nao excede capacidade.
- [ ] Repeticao idempotente nao duplica reserva.
- [ ] Cancelamento devolve capacidade.
- [ ] Confirmacao ou cancelamento apos o inicio e bloqueado.
- [ ] Codigo invalido nao revela dado pessoal ou existencia de outras reservas.
- [ ] Aceite da versao do aviso de privacidade e registrado.

## Questoes em aberto

Na demo o codigo sera exibido na tela. Envio por e-mail/SMS e uma integracao
posterior.
