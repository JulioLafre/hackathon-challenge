# TASK-003 - Configuracao academica e pessoas

Status: DONE
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

- [x] Master monta e ativa um semestre completo.
- [x] Apenas um semestre fica ativo na mesma transacao.
- [x] Estudante fica vinculado a turma, periodo e disciplina/estagio.
- [x] Estudante e supervisor editam apenas a propria disponibilidade.
- [x] Intervalos invalidos ou sobrepostos recebem erro acionavel.
- [x] Desativacao preserva relacionamentos historicos.

## Validacao minima

Testes de migration, constraints, RBAC, fuso horario e limites de intervalo;
testes de componente dos formularios e verificacao responsiva em 360 px.

## Evidencia de validacao executada

Foi executado o subconjunto critico da tarefa, sem ampliar a rodada para
cenarios ainda fora desta fatia:

- `docker compose -f infra/compose.yml run --rm api alembic upgrade head`;
- downgrade `0003_academics -> 0002_users` e upgrade de volta para `head`;
- testes PostgreSQL de academics e auth: `11 passed`;
- `ruff check app tests`;
- `mypy app`: `Success: no issues found`;
- `npm --prefix apps/web test -- --run src/App.test.tsx`: `5 passed`;
- `npm --prefix apps/web run typecheck`;
- `npm --prefix apps/web run lint`;
- `npm --prefix apps/web run build`.

A tela de configuracao Master e a tela de disponibilidade tratam loading,
vazio, erro e sucesso; os estilos colapsam os formularios para uma coluna em
viewport estreito, incluindo 360 px.
