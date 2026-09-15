# Clinica Escola

MVP para gestao integrada das clinicas-escola de Odontologia, Fisioterapia,
Nutricao e Psicologia. O sistema coordena configuracao semestral, elegibilidade
de estudantes, supervisao, capacidade fisica e agendamentos da comunidade.

## Decisao de produto

O MVP deve provar uma regra central: um atendimento so pode ser ofertado quando
existirem, ao mesmo tempo, estudante elegivel, supervisor disponivel e
capacidade fisica. A reserva e feita de forma transacional para que duas pessoas
nao ocupem a ultima vaga.

Stack proposta:

- API: FastAPI + SQLAlchemy 2 + Alembic + Pydantic;
- web: React + TypeScript + Vite;
- banco: PostgreSQL;
- desenvolvimento: Docker Compose;
- autenticacao: senha com Argon2id e JWT curto, sem Redis no MVP.

## Leitura recomendada

1. [Visao do produto](docs/PRODUCT.md)
2. [Linguagem do dominio](CONTEXT.md)
3. [Requisitos e escopo](docs/REQUIREMENTS.md)
4. [Regras de dominio](docs/DOMAIN_RULES.md)
5. [Arquitetura](docs/ARCHITECTURE.md)
6. [Modelo de dados](docs/DATA_MODEL.md)
7. [Contrato da API](docs/API.md)
8. [Seguranca e LGPD](docs/SECURITY_AND_LGPD.md)
9. [Decisoes a validar](docs/DECISIONS_TO_VALIDATE.md)
10. [Plano de validacao](docs/VALIDATION.md)
11. [Fluxo SDD](docs/specs/README.md) e [ordem das tarefas](docs/tasks/README.md)
12. [Skills e agentes](docs/AGENT_WORKFLOW.md)

## Como executar o trabalho

Implemente uma tarefa de `docs/tasks/` por vez, na ordem indicada. Antes de
codificar, leia a especificacao ligada a ela; ao terminar, execute os testes da
tarefa e marque somente criterios que tenham evidencia. Decisoes que mudem
contratos ou regras devem atualizar primeiro a documentacao correspondente.

## Demonstracao alvo

1. Master ativa um semestre e configura uma clinica de Fisioterapia.
2. Um aluno tenta entrar numa sessao e e bloqueado por documento pendente.
3. O aluno envia o documento e um responsavel o aprova com trilha de auditoria.
4. O aluno passa a integrar uma sessao compativel com sua disciplina e horario.
5. A comunidade encontra um horario e agenda.
6. Uma segunda reserva no limite correto e aceita; a seguinte recebe `SLOT_FULL`.
7. O agendamento e confirmado e depois pode ser cancelado pelo codigo seguro.

O chatbot nao pertence ao caminho critico do MVP. Ele so deve ser iniciado
depois que essa demonstracao estiver estavel.

## Assistencia do Codex

As skills versionadas ficam em `.agents/skills/`, com origens e hashes em
`skills-lock.json`. Os agentes especializados ficam em `.codex/agents/`; use o
fluxo de `docs/AGENT_WORKFLOW.md` para delegar sem colocar dois escritores nos
mesmos arquivos.
