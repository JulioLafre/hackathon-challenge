# TASK-005 - Documentos e elegibilidade

Status: TODO
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

- [ ] Todos os cenarios da SPEC-003 passam.
- [ ] Recusa sem motivo falha e reenvio preserva versao anterior.
- [ ] Download fora do escopo nao confirma existencia do arquivo.
- [ ] Elegibilidade retorna requisitos pendentes de forma deterministica.
- [ ] Nenhum dado ou conteudo do arquivo aparece no log.

## Validacao minima

Testes com arquivos validos e disfarçados, estados, validade, BOLA e auditoria;
teste de componente do checklist e da recusa com mensagem de correcao.
