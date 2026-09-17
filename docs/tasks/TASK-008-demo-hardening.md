# TASK-008 - Painel, demonstracao e endurecimento

Status: DONE
Depende de: TASK-007

## Objetivo

Fechar a experiencia da banca, consolidar o painel Master e provar requisitos
nao funcionais sem expandir o dominio.

## Ler antes

- `docs/specs/006-master-operations.md`
- `docs/VALIDATION.md`
- `docs/SECURITY_AND_LGPD.md`

## Entregaveis

- dashboard por semestre com pendencias, sessoes, reservas e alertas de risco;
- consulta de auditoria com filtros e paginacao;
- seed idempotente cobrindo a historia completa do README;
- estados de loading, vazio, erro e sucesso nas telas essenciais;
- navegacao, foco, labels, contraste e responsividade revisados;
- headers, CORS, erros sanitizados e rate limits revisados;
- roteiro de demo e capturas/evidencias sem dados reais;
- comandos finais de setup e validacao confirmados no README.

## Limites

- nao adicionar graficos decorativos, BI ou exportacao;
- nao esconder falha de teste para favorecer a demo;
- nao iniciar chatbot antes de todos os gates Must passarem.

## Criterios de aceitacao

- [x] Todos os cenarios da SPEC-006 passam.
- [x] Seed duas vezes mantem os mesmos totais.
- [x] Roteiro completo roda do zero em menos de cinco minutos.
- [x] Validacao global de docs/VALIDATION.md passa.
- [x] Dados e arquivos usados sao explicitamente ficticios.
- [x] Nenhum segredo ou PII aparece no Git, logs ou capturas.
- [x] Aplicacao essencial e utilizavel em 360 px, tablet e desktop.

## Validacao minima

Subir ambiente do zero, executar migrations/seed/gates, realizar o roteiro em
janela limpa e guardar os resultados reais no handoff.

## Handoff

- Arquivos principais: apps/api/app/api/routes/admin.py,
  apps/api/app/modules/admin/schemas.py,
  apps/api/app/modules/scheduling/services.py, apps/api/app/main.py,
  apps/api/app/modules/auth/seed.py, apps/api/tests/test_admin.py,
  apps/api/tests/test_scheduling.py, apps/web/src/features/admin/,
  apps/web/src/App.tsx, apps/web/nginx.conf, README.md, docs/API.md,
  docs/DOMAIN_RULES.md e docs/VALIDATION.md.
- Dashboard Master agregado por semestre, consulta de auditoria paginada,
  desativacao reversivel com revogacao de acesso e fila AT_RISK sem PII.
- Seed ficticio idempotente com sessao publicada, alocacao aprovada e horarios.
- Validacoes criticas: test_admin.py (3 passed); test_scheduling.py e
  test_booking.py (10 passed); frontend (5 arquivos, 13 testes passed); Ruff,
  mypy, typecheck, lint e build. Compose respondeu saudavel; preflight CORS e
  headers de seguranca foram verificados por HTTP.
- Pendencia real: TASK-009 permanece OPTIONAL e nao foi iniciada.
