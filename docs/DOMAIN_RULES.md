# Regras de dominio

Este documento e a referencia normativa das regras. O glossario dos termos esta
em `CONTEXT.md`.

## Estados

### Semestre

`DRAFT -> ACTIVE -> CLOSED`

- somente um semestre pode estar ativo;
- semestre fechado e somente leitura, exceto anotacao administrativa;
- sessoes e configuracoes sempre pertencem a um semestre.

### Submissao documental

`PENDING_REVIEW -> APPROVED | REJECTED`

- um novo envio para requisito rejeitado cria nova submissao e preserva o historico;
- `APPROVED` pode se tornar `EXPIRED` ao ultrapassar `expires_at`;
- recusa exige `review_note`; aprovacao registra revisor e instante.

### Sessao clinica

`DRAFT -> PUBLISHED -> CANCELLED | COMPLETED`

- somente `DRAFT` pode ser editada livremente;
- publicacao exige capacidade efetiva maior que zero;
- sessao com agendamento nao pode ser apagada.

### Agendamento

`BOOKED -> CONFIRMED -> COMPLETED | NO_SHOW`

`BOOKED | CONFIRMED -> CANCELLED`

- `CANCELLED`, `COMPLETED` e `NO_SHOW` sao finais;
- cancelamento libera capacidade e registra ator, data e motivo opcional.

## Regras normativas

### Configuracao e tempo

**BR-001** Toda entidade operacional deve pertencer explicitamente a um semestre.

**BR-002** Datas sao armazenadas em UTC. Regras semanais e exibicao usam o fuso
`America/Sao_Paulo`.

**BR-003** Intervalos seguem a convencao `[inicio, fim)`: dois intervalos que se
tocam no limite nao conflitam.

**BR-004** Reduzir uma capacidade abaixo do consumo ja comprometido deve ser
rejeitado com `CAPACITY_BELOW_COMMITTED`. O operador precisa antes realocar ou
cancelar os compromissos.

### Elegibilidade documental

**BR-010** Um estudante e documentalmente elegivel somente se existir uma
submissao `APPROVED` e nao expirada para cada requisito aplicavel ao seu vinculo.

**BR-011** Pendencia documental impede nova alocacao de estudante, nao apenas a
visualizacao do horario.

**BR-012** Se um documento de estudante ja alocado for recusado ou expirar, sua
alocacao futura vira `SUSPENDED` e a capacidade e recalculada. Agendamentos
afetados sao marcados `AT_RISK` para substituicao ou cancelamento manual; nunca
somem silenciosamente.

### Compatibilidade academica

**BR-020** Uma alocacao e compativel quando semestre, curso, periodo e
disciplina/estagio do vinculo satisfazem o servico da sessao.

**BR-021** O intervalo inteiro da sessao deve estar contido na disponibilidade
do estudante e nao pode sobrepor bloqueio academico ou outra alocacao ativa.

**BR-022** O intervalo inteiro da sessao deve estar contido na disponibilidade
do supervisor e nao pode sobrepor sessao incompatível do mesmo supervisor.

### Supervisao e espaco

**BR-030** O numero de alocacoes ativas na sessao nao pode exceder o menor valor
entre o limite do supervisor, o limite opcional da sessao e o limite de
estudantes da clinica naquele semestre.

**BR-031** Uma sala/consultorio inativo ou ja reservado no intervalo nao compoe
a capacidade. Equipamentos sao contados por quantidade disponivel no ambiente.

**BR-032** Cada servico declara duracao e quantidade de cada tipo de equipamento
necessaria por atendimento. Servico sem requisito de equipamento nao e limitado
por equipamento.

**BR-033** Sala, equipamento e limite global da clinica sao compartilhados por
todas as sessoes sobrepostas. O calculo considera o consumo ja comprometido em
outros horarios/sessoes no mesmo intervalo.

### Capacidade efetiva

**BR-040** Para cada horario ofertado:

```text
capacidade_efetiva = min(
  estudantes_elegiveis_alocados,
  limite_de_supervisao,
  salas_compativeis_livres,
  capacidade_livre_por_equipamentos,
  capacidade_restante_da_clinica
)
```

**BR-041** A capacidade disponivel e
`max(0, capacidade_efetiva - reservas_ativas)`. Somente horarios com resultado
maior que zero sao exibidos ao publico. Se uma mudanca posterior fizer reservas
ativas superarem a capacidade atual, elas ficam em risco e novas reservas sao
bloqueadas.

**BR-042** A publicacao gera horarios de acordo com a duracao do servico. Uma
sobra menor que a duracao no final da sessao nao gera horario.

**BR-043** Mudancas em documento, alocacao, supervisor ou recurso disparam
recalculo de horarios futuros da sessao.

### Agendamento

**BR-050** A criacao do agendamento bloqueia a linha do horario e, em ordem
estavel, as linhas compartilhadas da clinica, salas e estoques de equipamento no
PostgreSQL. A disponibilidade global e recalculada dentro da transacao e so
entao e reservada. Se nao houver capacidade, retorna `SLOT_FULL` sem efeito
parcial.

**BR-051** Uma `Idempotency-Key` repetida pelo mesmo solicitante devolve o mesmo
resultado, sem criar outro agendamento.

**BR-052** O sistema escolhe estudante e recurso; a comunidade escolhe apenas
servico, clinica e horario.

**BR-053** A comunidade gerencia a reserva com codigo aleatorio de alta entropia.
Somente o hash do codigo e armazenado e ele nunca aparece em listagens.

**BR-054** Horarios publicos nao expõem nomes, matriculas ou dados de supervisor.

**BR-055** No MVP, a comunidade pode confirmar ou cancelar com codigo valido
enquanto o inicio do horario nao passou. Depois disso, somente operador interno
pode registrar o desfecho permitido.

## Cenarios que devem virar testes

1. Duas reservas concorrentes disputam a ultima vaga: uma vence, outra recebe
   `SLOT_FULL`.
2. Sala para dois atendimentos, supervisor para quatro e um aluno elegivel:
   capacidade efetiva igual a um.
3. Aluno disponivel das 08:00 as 10:00, mas aula das 09:00 as 10:00: nao pode
   ser alocado em sessao das 08:30 as 09:30.
4. Documento recusado depois de existir reserva: alocacao suspensa e reserva
   `AT_RISK`, preservada para tratamento operacional.
5. Master tenta reduzir a capacidade de dois para um com duas reservas ativas:
   alteracao rejeitada.
6. Cancelamento seguido de nova consulta: vaga volta a aparecer.
7. Repeticao do POST com a mesma chave idempotente: um unico agendamento.
