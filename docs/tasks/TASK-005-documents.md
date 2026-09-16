# TASK-005 - Documentos e elegibilidade

Status: DONE
Depende de: TASK-003

## Objetivo

Entregar upload, revisao e uma unica consulta confiavel de elegibilidade.

## Ler antes

- `docs/specs/003-document-eligibility.md`
- `docs/SECURITY_AND_LGPD.md`
- `BR-010` a `BR-012` em `docs/DOMAIN_RULES.md`

## Entregaveis

- migrations de requisitos e submissoes historicas;
- adaptador `DocumentStorage` e implementacao local privada;
- checklist e upload do estudante;
- fila, visualizacao autorizada, aprovacao e recusa pelo revisor;
- servico `StudentEligibility` reutilizavel por outras features;
- UI de documentos do estudante e fila do supervisor;
- auditoria das revisoes e testes de autorizacao de objeto;
- fixtures apenas com documentos ficticios.

## Limites

- PDF/JPEG/PNG de ate 10 MB, validado por assinatura;
- nao servir o diretorio de storage estaticamente;
- sem OCR ou antivirus na demo; registrar o gap para producao.

## Criterios de aceitacao

- [x] Todos os cenarios de documentos da SPEC-003 passam; a integracao com alocacoes/reservas fica para TASK-006/TASK-007, que criam essas entidades.
- [x] Recusa sem motivo falha e reenvio preserva versao anterior.
- [x] Download fora do escopo nao confirma existencia do arquivo.
- [x] Elegibilidade retorna requisitos pendentes de forma deterministica.
- [x] Nenhum dado ou conteudo do arquivo aparece no log.

## Handoff

Arquivos principais alterados:

- apps/api/alembic/versions/0005_documents.py;
- apps/api/app/db/models.py;
- apps/api/app/main.py;
- apps/api/app/api/routes/documents.py;
- apps/api/app/modules/documents/;
- apps/api/tests/test_documents.py;
- apps/api/app/modules/auth/seed.py e apps/api/pyproject.toml;
- apps/web/src/features/documents/;
- apps/web/src/features/auth/auth.tsx;
- apps/web/src/lib/api.ts;
- apps/web/src/styles.css;
- docs/API.md e docs/DATA_MODEL.md.

Validacao executada:

- pytest tests/test_documents.py -vv: 4 passed no PostgreSQL isolado do Compose;
- python -m ruff check app tests/test_documents.py: passou;
- python -m mypy app: passou;
- npm test -- --run: 8 passed;
- npm run typecheck, npm run lint e npm run build: passaram;
- seed executado duas vezes no banco de teste sem duplicacao;
- stack reconstruido; /api/v1/health/live, /api/v1/health/ready e frontend retornaram 200.

Pendencia real:

- o efeito sobre SUSPENDED/AT_RISK depende das tabelas de alocacao e reserva,
  ainda inexistentes e previstas nas TASK-006/TASK-007; StudentEligibility
  ja fornece a consulta unica que essas tarefas devem consumir.

## Validacao minima

Testes com arquivos validos e disfarçados, estados, validade, BOLA e auditoria;
teste de componente do checklist e da recusa com mensagem de correcao.
