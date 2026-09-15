# SPEC-007 - Assistente de orientacao

Status: DRAFT/OPTIONAL

## Objetivo

Orientar a comunidade sobre servicos, preparo administrativo e horarios sem
acessar dados privados nem comprometer a entrega principal.

## Abordagem recomendada

Comecar com FAQ curada e busca por palavras-chave, chamando as mesmas rotas
publicas de servicos e horarios. Essa versao parece um chat, e previsivel na
demonstracao e nao exige provedor externo. Se sobrar tempo, um modelo de linguagem
pode apenas reformular respostas recuperadas, nunca inventar regra ou acessar
banco diretamente.

## Dentro do escopo opcional

- perguntas sobre servicos oferecidos, local, funcionamento e como agendar;
- consulta de horarios publicos por servico/data;
- links para iniciar o agendamento;
- resposta de fallback e encaminhamento para contato institucional.

## Fora do escopo

Triagem clinica, diagnostico, emergencia, recomendacao de tratamento, consulta
de reserva pessoal e acesso a documento.

## Regras

- conteudo vem de base curada e versionada;
- nenhuma conversa solicita ou persiste dado pessoal;
- horarios vem da API publica, nao de texto gerado;
- temas clinicos recebem limite claro e orientacao para canal apropriado;
- recurso pode ser desligado por feature flag sem afetar agenda.

## Cenarios

### Cenario: servico conhecido

Dado FAQ publicada sobre Nutricao
Quando a pessoa pergunta quais servicos existem
Entao o assistente responde com conteudo curado e link para horarios.

### Cenario: dado pessoal

Dado que a pessoa envia CPF ou informacao de saude
Quando o assistente recebe a mensagem
Entao nao persiste o conteudo e orienta a nao compartilhar dado sensivel.

### Cenario: pergunta fora do limite

Dado uma solicitacao de diagnostico
Quando o assistente responde
Entao informa que nao realiza orientacao clinica e indica canal institucional ou
servico de emergencia quando aplicavel.

## Criterios para iniciar

- [ ] Todas as tarefas Must estao estaveis.
- [ ] Roteiro principal passa sem o assistente.
- [ ] Base de FAQ foi aprovada por responsavel do projeto.
- [ ] Feature flag e limites de privacidade existem.

## Questoes em aberto

Definir se a banca valoriza IA dentro do produto. Se sim, escolher provedor,
custo e politica de dados antes de enviar qualquer conteudo externo.
