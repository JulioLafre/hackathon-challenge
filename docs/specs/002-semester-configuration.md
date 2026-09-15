# SPEC-002 - Configuracao por semestre

Status: READY

## Objetivo

Permitir que o Master modele um semestre sem alterar codigo, incluindo estrutura
academica, pessoas, servicos, clinicas e limites fisicos.

## Dentro do escopo

- semestre e ativacao exclusiva;
- curso, disciplina/estagio, turma e bloqueio academico;
- estudante, supervisor e seus vinculos/disponibilidades;
- clinica, ambiente, sala, equipamento e capacidade semestral;
- servico, duracao, disciplina e equipamentos exigidos;
- escopo de servico do supervisor.

## Fora do escopo

Importacao do sistema academico, grade otimizada automaticamente e recorrencia
complexa de calendario.

## Regras

- configuracao operacional sempre referencia um semestre;
- apenas um semestre fica `ACTIVE`;
- registro com historico e desativado, nao excluido;
- limites e quantidades sao inteiros positivos, exceto estoque que pode ser zero;
- intervalo semanal exige dia, inicio menor que fim e fuso institucional;
- reducao abaixo do uso comprometido retorna `CAPACITY_BELOW_COMMITTED`.

## Cenarios

### Cenario: ativar novo semestre

Dado um semestre ativo e outro em draft
Quando o Master ativa o novo
Entao o anterior e fechado na mesma transacao e seu historico permanece.

### Cenario: capacidade configuravel

Dado um ambiente com tres salas e cinco equipamentos
Quando o Master define maximo de dois atendimentos e quatro estudantes
Entao esses limites pertencem apenas ao semestre selecionado.

### Cenario: capacidade abaixo do comprometido

Dado um horario com duas reservas ativas
Quando o Master tenta configurar maximo um
Entao recebe `409 CAPACITY_BELOW_COMMITTED` e o valor anterior e preservado.

### Cenario: conflito academico declarado

Dado uma turma do quinto periodo
Quando o Master registra aula das 09:00 as 10:00
Entao esse intervalo passa a bloquear alocacoes sobrepostas de seus estudantes.

## Contratos afetados

Tabelas academicas, de pessoas, clinicas e servicos de `docs/DATA_MODEL.md` e
rotas administrativas de `docs/API.md`.

## Criterios de aceitacao

- [ ] Master consegue montar o cenario completo de demo pela API/interface.
- [ ] Outro perfil recebe `403` em toda mutacao administrativa.
- [ ] Novo semestre nao altera configuracao nem historico do anterior.
- [ ] Campos invalidos e duplicidades retornam erro acionavel.
- [ ] Desativacao preserva referencias existentes.

## Questoes em aberto

Nenhuma bloqueante. Feriados podem ser representados por ausencia/cancelamento
de sessoes no MVP.
