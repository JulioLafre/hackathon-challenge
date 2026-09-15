# Seguranca e LGPD

O objetivo e um minimo seguro e demonstravel, proporcional ao MVP. Este sistema
lida com identificacao, contato e documentos, mas deliberadamente nao coleta
dados de prontuario ou diagnostico.

## Autenticacao

- apenas usuarios internos possuem conta;
- senha com no minimo 10 caracteres, hash Argon2id e nunca reversivel;
- JWT assinado por segredo de ambiente com `sub`, `role`, `iat`, `exp`, `iss` e
  `aud`, validade de 30 minutos e nenhum dado pessoal;
- token mantido em memoria no React, nunca em `localStorage`;
- sem refresh token no MVP; expiracao exige novo login;
- resposta de login invalido e identica para e-mail inexistente e senha errada;
- usuario desativado e negado mesmo se o token ainda for valido.

Segredos ficam em variaveis de ambiente. `.env.example` nao contem segredo real.
HTTPS e obrigatorio fora do ambiente local.

## Autorizacao

- RBAC e verificado em dependencia do FastAPI e novamente no escopo do objeto;
- Master possui administracao total, mas suas acoes sensiveis sao auditadas;
- Supervisor acessa somente sessoes, estudantes e documentos do seu escopo;
- Estudante acessa apenas perfil, disponibilidade, documentos e alocacoes proprios;
- comunidade acessa somente catalogo agregado e sua reserva por codigo;
- campos gravaveis sao definidos por schema por perfil, impedindo mass assignment.

Testes negativos de BOLA sao obrigatorios: trocar um UUID na URL nao pode
permitir acesso ao objeto de outra pessoa.

## Entrada e arquivos

- Pydantic valida tipo, tamanho, enum, formato e limites;
- ORM/queries parametrizadas; nenhuma concatenacao de SQL;
- texto livre e limitado e renderizado como texto, nunca HTML;
- upload aceita apenas PDF, JPEG e PNG, ate 10 MB;
- validar extensao, MIME declarado e assinatura real do arquivo;
- nome de armazenamento e UUID e nao deriva do nome enviado;
- arquivo fica fora da raiz publica e download usa autorizacao;
- em producao, incluir varredura antimalware antes de liberar revisao.

## Protecao contra abuso

Na demonstracao, uma unica instancia pode usar rate limit em memoria:

| Operacao | Limite inicial |
| --- | --- |
| Login | 5 tentativas por IP a cada 15 minutos |
| Consulta publica | 60 requisicoes por IP por minuto |
| Criar agendamento | 10 requisicoes por IP por hora |
| Confirmar/cancelar por codigo | 10 tentativas por IP por 15 minutos |
| Upload | 20 arquivos por usuario por hora |

Responder `429` com `Retry-After`. Esses limites devem ser configuraveis. Redis
so entra quando houver mais de uma instancia, pois o contador em memoria nao e
distribuido.

## API e navegador

- CORS por allowlist de origens, metodos e headers;
- headers `Content-Security-Policy`, `X-Content-Type-Options`,
  `Referrer-Policy` e protecao contra framing;
- erros publicos nao incluem stack trace, SQL ou caminhos locais;
- `request_id` correlaciona erro e log;
- POST publico de reserva exige idempotencia;
- codigo de gestao possui ao menos 128 bits aleatorios, e armazenado com hash e
  comparado em tempo constante.

## Privacidade por desenho

| Dado | Finalidade | Acesso | Retencao inicial |
| --- | --- | --- | --- |
| Cadastro academico | Elegibilidade e supervisao | Master e escopo academico | Semestre + prazo institucional |
| Documento enviado | Comprovar elegibilidade | Dono, revisor no escopo e Master | Ate fim do prazo institucional |
| Nome e contato da comunidade | Gerir e comunicar reserva | Operacao autorizada | 180 dias apos atendimento/cancelamento |
| Log de auditoria | Responsabilizacao e seguranca | Master autorizado | 12 meses no MVP |

Os prazos sao hipoteses de produto e devem ser confirmados com a instituicao
antes de producao. Implementar rotina de expiracao/anonimizacao como tarefa
posterior, sem apagar evidencias exigidas por obrigacao institucional.

Principios aplicados:

- necessidade: nao pedir CPF, endereco completo, diagnostico ou motivo clinico;
- transparencia: aviso curto antes da reserva, com versao aceita registrada;
- livre acesso/correcao: canal institucional indicado no aviso;
- seguranca: arquivos privados, menor privilegio e auditoria;
- prevencao: dados ficticios e anonimizados na hackathon;
- nao discriminacao: dados nao sao usados para ordenar ou negar atendimento.

## Logs e auditoria

Auditar login bloqueado, revisao documental, mudanca de papel, configuracao de
capacidade, publicacao/cancelamento de sessao e mudanca de agendamento. Registrar
identificador do ator, acao, tipo/ID do alvo, instante e campos alterados
permitidos. Nao registrar senha, JWT, codigo de gestao, documento, nome, e-mail,
telefone ou corpo integral da requisicao.

## Checklist de entrega

- [ ] secrets ausentes do Git e rotacionaveis;
- [ ] autorizacao por funcao e por objeto testada;
- [ ] upload privado validado por tamanho e conteudo;
- [ ] rate limits ativos nas rotas publicas;
- [ ] logs sem dados pessoais;
- [ ] HTTPS e CORS restrito no perfil de producao;
- [ ] aviso de privacidade e dados de demo identificados;
- [ ] dependencias verificadas por auditoria automatica.
