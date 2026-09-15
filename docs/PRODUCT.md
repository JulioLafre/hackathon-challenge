# Visao do produto

## Problema

Planilhas e comunicacoes dispersas nao conseguem garantir, ao mesmo tempo, que
o estudante esteja apto, o supervisor possa acompanha-lo e a clinica tenha
espaco e equipamento. O efeito e agenda inviavel, conflito academico e risco de
atendimento sem documentacao ou supervisao adequada.

## Proposta

Uma aplicacao responsiva com tres jornadas conectadas:

- operacao academica configura o semestre, pessoas, recursos e sessoes;
- estudante informa disponibilidade, envia documentos e entra em sessoes;
- comunidade consulta somente horarios realmente viaveis e faz sua reserva.

## Usuarios

| Perfil | Objetivo principal |
| --- | --- |
| Master | Configurar semestre, cadastros, capacidades, permissoes e visao geral |
| Supervisor | Informar disponibilidade, revisar documentos permitidos e supervisionar sessoes |
| Estudante | Manter perfil, disponibilidade, documentos e alocacoes |
| Comunidade | Encontrar, confirmar e cancelar um atendimento sem precisar criar conta |

Professor e preceptor sao dois tipos do mesmo perfil de Supervisor. A permissao
de revisar documentos e controlada por escopo de curso/area.

## MVP obrigatorio

- login dos usuarios internos e controle por perfil;
- configuracao de semestre, cursos, disciplinas/estagios e vinculos;
- cadastro de clinicas, ambientes, salas, equipamentos e capacidades;
- cadastro e disponibilidade de estudantes e supervisores;
- envio, aprovacao e recusa de documentos com justificativa;
- sessao clinica e alocacao de estudante com verificacao de compatibilidade;
- horarios publicos derivados da capacidade efetiva;
- agendamento, confirmacao e cancelamento pela comunidade;
- painel Master basico e trilha de auditoria;
- seed totalmente ficticio para a demonstracao.

## Fora do MVP

- prontuario, anamnese, diagnostico ou evolucao clinica;
- pagamento, convenio, teleatendimento ou prescricao;
- integracao com sistema academico institucional;
- notificacao real por SMS/WhatsApp/e-mail;
- otimizacao automatica da grade;
- multiplas instituicoes na mesma instalacao;
- chatbot generativo. Um assistente de FAQ pode ser feito apenas como diferencial.

## Metricas de sucesso da demonstracao

- nenhum horario publicado sem os tres pilares de viabilidade;
- nenhuma reserva acima da capacidade efetiva, inclusive sob concorrencia;
- 100% das recusas documentais com motivo visivel ao estudante;
- configuracao de um novo semestre sem alterar codigo;
- jornada principal demonstravel em menos de cinco minutos.

## Premissas iniciais

- cada agendamento consome um estudante, uma unidade de sala/consultorio e os
  equipamentos exigidos pelo servico durante um horario;
- a comunidade nao escolhe estudante nem supervisor;
- dados clinicos nao serao coletados;
- o idioma e portugues do Brasil e os horarios usam `America/Sao_Paulo`.
