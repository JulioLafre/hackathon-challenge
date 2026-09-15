# Gestao de Clinicas-Escola

Linguagem comum do sistema que coordena ensino supervisionado e atendimento da
comunidade nas clinicas-escola.

## Calendario academico

**Semestre**:
Periodo configuravel que delimita ofertas, vinculos, requisitos e capacidades.
_Evitar_: ciclo, temporada

**Vinculo academico**:
Associacao de um estudante a curso, periodo e disciplina ou estagio em um semestre.
_Evitar_: matricula, quando significar apenas o numero institucional

**Bloqueio academico**:
Intervalo em que a turma do estudante possui atividade obrigatoria e ele nao pode atuar na clinica.
_Evitar_: indisponibilidade, conflito generico

## Pessoas e elegibilidade

**Estudante elegivel**:
Estudante com vinculo compativel e todos os documentos obrigatorios aprovados e validos.
_Evitar_: aluno liberado, aluno ativo

**Supervisor**:
Professor ou preceptor responsavel por estudantes durante uma sessao clinica.
_Evitar_: medico, atendente, responsavel generico

**Limite de supervisao**:
Numero maximo de estudantes que um supervisor pode acompanhar simultaneamente.
_Evitar_: capacidade da sala

**Requisito documental**:
Tipo de documento exigido de um estudante para atuar em determinado semestre e contexto academico.
_Evitar_: documento, quando significar a exigencia e nao o arquivo enviado

**Submissao documental**:
Arquivo enviado por um estudante para satisfazer um requisito documental.
_Evitar_: requisito, anexo

## Operacao clinica

**Clinica**:
Unidade operacional que agrupa ambientes e define limites globais de funcionamento.
_Evitar_: sala, consultorio

**Ambiente**:
Area de uma clinica que agrupa salas ou consultorios usados por um tipo de atendimento.
_Evitar_: clinica, recurso

**Recurso fisico**:
Sala, consultorio ou equipamento cuja disponibilidade limita atendimentos simultaneos.
_Evitar_: vaga, capacidade

**Servico**:
Tipo de atendimento oferecido a comunidade e associado a uma disciplina ou estagio.
_Evitar_: consulta, especialidade

**Sessao clinica**:
Bloco datado de supervisao no qual um servico pode ser prestado em uma clinica.
_Evitar_: agendamento, turno, horario

**Alocacao de estudante**:
Reserva da participacao de um estudante elegivel em uma sessao clinica.
_Evitar_: agendamento do paciente, inscricao generica

**Horario ofertado**:
Intervalo reservavel pela comunidade dentro de uma sessao clinica publicada.
_Evitar_: sessao, disponibilidade generica

**Agendamento**:
Reserva de um horario ofertado por uma pessoa da comunidade para um servico.
_Evitar_: alocacao, inscricao de estudante

**Capacidade efetiva**:
Menor limite simultaneo entre estudantes elegiveis alocados, supervisao, salas,
equipamentos e capacidade configurada da clinica.
_Evitar_: numero de salas, vagas teoricas
