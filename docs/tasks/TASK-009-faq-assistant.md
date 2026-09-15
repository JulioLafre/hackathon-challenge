# TASK-009 - Assistente de FAQ opcional

Status: OPTIONAL
Depende de: TASK-008

## Objetivo

Adicionar um diferencial conversacional isolado sem colocar agenda ou privacidade
em risco.

## Ler antes

- `docs/specs/007-faq-assistant.md`
- `docs/SECURITY_AND_LGPD.md`

## Entregaveis

- base de FAQ ficticia/curada e versionada;
- interface de chat acessivel por feature flag;
- busca deterministica e links para servicos/slots da API publica;
- limites explicitos para diagnostico, emergencia e dados pessoais;
- testes das respostas conhecidas, fallback e indisponibilidade;
- se houver LLM, adaptador isolado, timeout e resposta baseada apenas no
  conteudo recuperado.

## Limites

- nao enviar PII, documento ou dados internos a modelo externo;
- nao permitir que o modelo execute mutacoes ou consulte o banco diretamente;
- nao chamar a feature de IA se for somente FAQ por regras;
- falha do assistente nao pode afetar consulta ou reserva.

## Criterios de aceitacao

- [ ] Criterios para iniciar da SPEC-007 foram atendidos.
- [ ] Feature flag desliga o recurso sem alterar o fluxo principal.
- [ ] Respostas de horario usam a API e nao sao inventadas.
- [ ] Dados pessoais nao sao persistidos nem registrados.
- [ ] Tema clinico recebe limite e encaminhamento seguro.

## Validacao minima

Testes de conteudo, privacidade, timeout/fallback e regressao do fluxo publico
com a feature ligada e desligada.
