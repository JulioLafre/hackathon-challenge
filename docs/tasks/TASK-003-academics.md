# TASK-003 - Configuracao academica e pessoas

Status: TODO
Depende de: TASK-002

## Objetivo

Permitir ao Master configurar semestre, grade e perfis necessarios para decidir
compatibilidade academica.

## Ler antes

- `docs/specs/002-semester-configuration.md`
- secoes Academico e Identidade de `docs/DATA_MODEL.md`
- matriz de acesso de `docs/REQUIREMENTS.md`

## Entregaveis

- migrations e CRUDs de semestre, curso, disciplina/estagio e turma;
- bloqueios academicos semanais;
- perfis de estudante e supervisor e vinculos academicos;
- disponibilidades semanais dos dois perfis;
- ativacao exclusiva do semestre e desativacao sem apagar historico;
- telas Master essenciais e telas de disponibilidade propria;
- validacao central de sobreposicao usando intervalo `[inicio, fim)`;
- seed academico ficticio para Fisioterapia.

## Limites

- sem integracao institucional;
- sem calendario recorrente complexo ou feriados;
- nao criar sessoes ou calcular capacidade nesta tarefa.

## Criterios de aceitacao

- [ ] Master monta e ativa um semestre completo.
- [ ] Apenas um semestre fica ativo na mesma transacao.
- [ ] Estudante fica vinculado a turma, periodo e disciplina/estagio.
- [ ] Estudante e supervisor editam apenas a propria disponibilidade.
- [ ] Intervalos invalidos ou sobrepostos recebem erro acionavel.
- [ ] Desativacao preserva relacionamentos historicos.

## Validacao minima

Testes de migration, constraints, RBAC, fuso horario e limites de intervalo;
testes de componente dos formularios e verificacao responsiva em 360 px.
