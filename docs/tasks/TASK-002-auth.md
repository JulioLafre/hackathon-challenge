# TASK-002 - Autenticacao e papeis

Status: DONE
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

- [x] Cenarios aplicaveis da SPEC-001 passam; o endpoint de documentos sera
  exercitado na tarefa de documentos.
- [x] Senha/hash nao aparece em respostas ou logs; o token aparece somente no
  retorno explicito e esperado do login.
- [x] Cada papel ve somente sua navegacao.
- [x] API rejeita papel inadequado por dependencia reutilizavel de RBAC.
- [x] Seed repetido nao duplica usuarios.

## Evidencia de validacao

- `podman compose -f infra/compose.yml up -d --build`: stack subiu com a
  migration `0002_users` aplicada;
- `podman compose -f infra/compose.yml exec -T api pytest -q`: 12 testes
  criticos passaram, cobrindo credencial invalida uniforme, login e `/me`,
  expiracao, desativacao, rate limit, RBAC, escopo de objeto e seed;
- `podman compose -f infra/compose.yml exec -T api ruff check .`: passou;
- `podman compose -f infra/compose.yml exec -T api mypy app`: passou;
- `npm --prefix apps/web run lint`: passou;
- `npm --prefix apps/web run typecheck`: passou;
- `npm --prefix apps/web test -- --run`: 3 testes passaram;
- `npm --prefix apps/web run build`: passou;
- `podman compose -f infra/compose.yml exec -T api seed-demo` executado duas
  vezes; consulta PostgreSQL confirmou um usuario por papel (`MASTER`,
  `SUPERVISOR`, `STUDENT`);
- validacao manual do login retornou `200`; credencial invalida retornou `401
  INVALID_CREDENTIALS`; o teste de integracao da dependencia de Master retornou
  `403 FORBIDDEN`;
- logs nao contem senha, hash ou JWT; o JWT aparece somente no retorno explicito
  e esperado do login, nunca em `/me` ou nos logs.

## Handoff

Arquivos principais alterados: configuracao e migration de usuarios, seguranca
Argon2id/JWT, dependencias de sessao/RBAC, seed demo, rotas `/auth/login` e
`/me`, tela de login e shell privado, contratos e configuracao de ambiente.

Pendencia real: a verificacao de propriedade foi entregue como autorizador
reutilizavel e teste negativo; os endpoints de documentos que o exercitam
serao implementados na TASK-005.

## Validacao minima

Testes da API com PostgreSQL, lint/typecheck e teste de componente do login.
Inspecionar manualmente uma resposta 401, uma 403 e o log correspondente.
