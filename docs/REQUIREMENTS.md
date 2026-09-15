# Requisitos e escopo

## Requisitos funcionais

| ID | Requisito | Prioridade | Evidencia esperada |
| --- | --- | --- | --- |
| RF-01 | Cadastrar estudante, contato, matricula, curso, periodo e disciplina/estagio | Must | Perfil e vinculo persistidos |
| RF-02 | Registrar disponibilidade semanal do estudante | Must | Intervalos consultaveis e editaveis |
| RF-03 | Configurar requisitos e receber documentos digitais | Must | Upload privado com status inicial |
| RF-04 | Aprovar ou recusar documento com motivo | Must | Estado, revisor, data e observacao auditados |
| RF-05 | Bloquear alocacao de estudante inelegivel | Must | Erro `DOCUMENTS_PENDING` |
| RF-06 | Cadastrar professor/preceptor, area, ambiente, disponibilidade e limite | Must | Perfil de supervisor configuravel |
| RF-07 | Bloquear alocacao acima do limite de supervisao | Must | Erro `SUPERVISION_CAPACITY_REACHED` |
| RF-08 | Bloquear conflito com horario academico | Must | Erro `ACADEMIC_CONFLICT` |
| RF-09 | Exigir simultaneidade de aluno, supervisor e clinica | Must | Sessao so pode ser publicada se viavel |
| RF-10 | Configurar clinicas, ambientes, salas, equipamentos e limites | Must | Recursos ativos por semestre |
| RF-11 | Isolar configuracoes por semestre | Must | Novo semestre nao muda historico |
| RF-12 | Exibir horarios viaveis para a comunidade | Must | Consulta publica sem nomes internos |
| RF-13 | Agendar, confirmar e cancelar atendimento | Must | Fluxo por codigo seguro de gestao |
| RF-14 | Permitir ao Master gerir usuarios, catalogos e configuracoes | Must | Acoes autorizadas e auditadas |
| RF-15 | Exibir resumo operacional | Should | Indicadores de pendencias, sessoes e agenda |
| RF-16 | Orientar a comunidade por FAQ/chatbot | Could | Respostas sem acessar dados sensiveis |

## Requisitos nao funcionais

| ID | Requisito | Criterio inicial |
| --- | --- | --- |
| RNF-01 | Usabilidade | Jornada publica concluida em ate 4 telas, com mensagens acionaveis |
| RNF-02 | Responsividade | Sem rolagem horizontal em 360 px, tablet e desktop |
| RNF-03 | Integridade | Nenhuma nova reserva e aceita sem capacidade disponivel no instante da transacao |
| RNF-04 | Desempenho | p95 abaixo de 500 ms na consulta de horarios com dados de demo |
| RNF-05 | Acessibilidade | Teclado, foco visivel, labels e contraste WCAG AA nas telas essenciais |
| RNF-06 | Seguranca | RBAC no servidor, validacao de entrada, segredo fora do repositorio e rate limit publico |
| RNF-07 | Privacidade | Minimizacao, acesso restrito a documentos e nenhum dado real na demo |
| RNF-08 | Auditabilidade | Registrar ator, acao, alvo e data para revisoes e alteracoes administrativas |
| RNF-09 | Configurabilidade | Capacidade e grade sem mudanca de codigo entre semestres |

## Matriz de acesso

| Acao | Master | Supervisor | Estudante | Comunidade |
| --- | :---: | :---: | :---: | :---: |
| Configurar cadastros e semestre | Sim | Nao | Nao | Nao |
| Consultar visao geral | Sim | Escopo proprio | Proprio | Nao |
| Revisar documento | Sim | Se autorizado no escopo | Nao | Nao |
| Enviar documento | Como suporte | Nao | Proprio | Nao |
| Gerir disponibilidade | Sim | Propria | Propria | Nao |
| Criar/publicar sessao | Sim | Escopo proprio | Nao | Nao |
| Entrar em sessao | Como suporte | Nao | Proprio | Nao |
| Ver horarios publicos | Sim | Sim | Sim | Sim |
| Criar/confirmar/cancelar agendamento | Como suporte | Escopo proprio | Nao | Por codigo |

`Remover usuario` significa desativar. Registros ligados a auditoria ou
agendamentos nao sao apagados fisicamente.

## Restricoes de escopo

- A API e a autoridade final; esconder botao nao substitui autorizacao.
- Capacidade e elegibilidade sao verificadas novamente no momento da gravacao.
- Alteracao de configuracao nao pode invalidar silenciosamente reservas existentes.
- Horarios publicos nao revelam identidade de estudante ou supervisor.
