# TASK-008 - Painel, demonstracao e endurecimento

Status: TODO
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

- [ ] Todos os cenarios da SPEC-006 passam.
- [ ] Seed duas vezes mantem os mesmos totais.
- [ ] Roteiro completo roda do zero em menos de cinco minutos.
- [ ] Validacao global de `docs/VALIDATION.md` passa.
- [ ] Dados e arquivos usados sao explicitamente ficticios.
- [ ] Nenhum segredo ou PII aparece no Git, logs ou capturas.
- [ ] Aplicacao essencial e utilizavel em 360 px, tablet e desktop.

## Validacao minima

Subir ambiente do zero, executar migrations/seed/gates, realizar o roteiro em
janela limpa e guardar os resultados reais no handoff.
