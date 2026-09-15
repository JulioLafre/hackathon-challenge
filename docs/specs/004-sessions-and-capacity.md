# SPEC-004 - Sessoes, alocacoes e capacidade

Status: READY

## Objetivo

Criar sessoes clinicas viaveis e impedir alocacoes que violem documentacao,
grade academica, supervisao ou capacidade fisica.

## Dentro do escopo

- sessao datada em draft, publicacao e cancelamento;
- alocacao/cancelamento de estudante;
- compatibilidade de disciplina e horario;
- formula explicavel de capacidade efetiva;
- geracao de horarios pela duracao do servico;
- recalculo quando uma dependencia muda.

## Fora do escopo

Escala sugerida por IA, recorrencia automatica entre semanas e troca automatica
de estudante em reserva de risco.

## Regras

- estudante deve estar elegivel e academicamente compativel;
- estudante e supervisor precisam cobrir o intervalo inteiro da sessao;
- alocacoes ativas nao ultrapassam limite de supervisao/estudantes;
- capacidade efetiva e o minimo dos cinco fatores de `BR-040`;
- recursos consumidos por sessoes sobrepostas reduzem a parcela fisica/global;
- somente sessao com capacidade positiva pode ser publicada;
- frontend mostra a explicacao retornada e nao recalcula valores;
- mudanca futura recalcula slots, preservando compromissos existentes.

## Cenarios

### Cenario: documento pendente

Dado estudante compativel no horario, mas inelegivel
Quando tenta entrar na sessao
Entao recebe `DOCUMENTS_PENDING` e nenhuma alocacao e criada.

### Cenario: conflito parcial

Dado estudante disponivel das 08:00 as 10:00 e aula das 09:00 as 10:00
Quando tenta sessao das 08:30 as 09:30
Entao recebe `ACADEMIC_CONFLICT`.

### Cenario: limite de supervisao

Dado supervisor com limite dois e duas alocacoes ativas simultaneas
Quando um terceiro estudante tenta entrar
Entao recebe `SUPERVISION_CAPACITY_REACHED`.

### Cenario: sala como gargalo

Dado tres alunos, supervisor com limite quatro, duas salas, equipamentos para
tres e clinica com limite quatro
Quando a capacidade e calculada
Entao o resultado e dois e `rooms` aparece como fator limitante.

### Cenario: geracao de slots

Dado sessao das 08:00 as 10:20 e servico de 60 minutos
Quando a sessao e publicada
Entao sao gerados 08:00-09:00 e 09:00-10:00; a sobra nao vira horario.

### Cenario: recurso compartilhado entre sessoes

Dado duas sessoes sobrepostas no mesmo ambiente e um unico equipamento exigido
Quando a primeira compromete esse equipamento
Entao a outra nao oferece nova vaga no intervalo sobreposto.

### Cenario: publicacao inviavel

Dado sessao sem estudante elegivel alocado
Quando o operador tenta publicar
Entao recebe `SESSION_NOT_PUBLISHABLE` com a parcela zerada.

## Contratos afetados

`clinical_sessions`, `session_allocations`, `appointment_slots`, servico unico de
capacidade e rotas `/sessions`.

## Criterios de aceitacao

- [ ] Todos os bloqueios retornam codigo estavel e nenhuma gravacao parcial.
- [ ] Calculo unitario testa cada fator como unico gargalo e empates.
- [ ] Publicacao gera slots corretos e idempotentes.
- [ ] Alteracao de dependencia recalcula horarios futuros.
- [ ] Explicacao da capacidade e legivel na interface interna.
- [ ] Semestre/curso/disciplina divergentes bloqueiam alocacao.

## Questoes em aberto

Nenhuma bloqueante para o MVP. Reservas de risco exigem decisao humana.
