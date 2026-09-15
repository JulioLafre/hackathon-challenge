# TASK-002 - Autenticacao e papeis

Status: TODO
Depende de: TASK-001

## Objetivo

Implementar o acesso interno minimo e provar autorizacao positiva e negativa.

## Ler antes

- `docs/specs/001-auth-and-access.md`
- `docs/API.md`
- `docs/SECURITY_AND_LGPD.md`

## Entregaveis

- migration de `users` e enum/constraint de papeis;
- hash Argon2id, login JWT curto e dependencia de usuario atual;
- autorizadores reutilizaveis por papel e por propriedade/escopo;
- endpoints `/auth/login` e `/me`;
- paginas de login e shell privado com navegacao por perfil;
- rate limit do login para uma instancia;
- seed idempotente com Master, Supervisor e Estudante ficticios;
- testes de autenticacao, expiracao, desativacao, RBAC e BOLA.

## Limites

- token em memoria, sem localStorage ou refresh token;
- credenciais demo podem vir de variaveis de ambiente ou comando de seed e nao
  devem ser valores de producao;
- nao criar cadastro publico nem recuperacao de senha.

## Criterios de aceitacao

- [ ] Cenarios da SPEC-001 passam.
- [ ] Senha/hash/token nao aparece em resposta ou log.
- [ ] Cada papel ve somente sua navegacao.
- [ ] API rejeita papel inadequado mesmo com chamada direta.
- [ ] Seed repetido nao duplica usuarios.

## Validacao minima

Testes da API com PostgreSQL, lint/typecheck e teste de componente do login.
Inspecionar manualmente uma resposta 401, uma 403 e o log correspondente.
