# SPEC-001 - Autenticacao e acesso

Status: IMPLEMENTED

## Objetivo

Permitir que usuarios internos acessem somente funcoes e objetos do seu papel,
com uma implementacao curta e segura para a demonstracao.

## Dentro do escopo

- login por e-mail/senha;
- JWT de 30 minutos;
- papeis `MASTER`, `SUPERVISOR` e `STUDENT`;
- usuario atual e protecao de rotas;
- desativacao de usuario;
- rate limit no login e auditoria de eventos relevantes.

## Fora do escopo

Cadastro publico, recuperacao de senha, MFA, SSO, refresh token e Redis.

## Regras

- senha usa Argon2id e nunca e retornada ou registrada;
- erro de credencial nao identifica qual campo falhou;
- JWT valida assinatura, expiracao, emissor e audiencia;
- papel no token nao dispensa consulta de usuario ativo;
- verificacao de propriedade/escopo acontece no backend.

## Cenarios

### Cenario: login valido

Dado um estudante ativo com senha valida
Quando ele autentica
Entao recebe token com validade de 30 minutos e `/me` retorna seu perfil.

### Cenario: credencial invalida

Dado e-mail inexistente ou senha incorreta
Quando ocorre login
Entao ambos retornam `401 INVALID_CREDENTIALS` com a mesma mensagem.

### Cenario: acesso por papel

Dado um estudante autenticado
Quando tenta criar um semestre
Entao recebe `403 FORBIDDEN` e nenhuma alteracao e persistida.

### Cenario: objeto de outra pessoa

Dado o estudante A autenticado
Quando consulta um documento do estudante B por UUID
Entao recebe `404` e nenhum metadado do documento e revelado.

### Cenario: usuario desativado

Dado um token ainda valido de usuario que foi desativado
Quando acessa rota protegida
Entao recebe `401` e a operacao e negada.

## Contratos afetados

`users`, `POST /auth/login`, `GET /me`, dependencia de RBAC, auditoria e politica
descrita em `docs/SECURITY_AND_LGPD.md`.

## Criterios de aceitacao

- [ ] Cada papel enxerga somente sua navegacao.
- [ ] A API nega funcao e objeto fora do escopo.
- [ ] Token expirado e usuario desativado sao rejeitados.
- [ ] Cinco falhas de login atingem rate limit configurado.
- [ ] Testes nao encontram senha/hash/token em resposta ou log.

## Questoes em aberto

Nenhuma para o MVP. Recuperacao de acesso sera operada pelo Master na demo.
