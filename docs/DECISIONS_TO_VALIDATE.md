# Decisoes a validar com a instituicao

Estas perguntas nao bloqueiam o inicio. A coluna Default do MVP permite
implementar e demonstrar; qualquer resposta diferente deve atualizar primeiro a
spec/regra indicada.

| Tema | Default do MVP | Validar antes de producao | Documento afetado |
| --- | --- | --- | --- |
| Documentos exigidos | Tipos ficticios configurados por semestre/disciplina | Lista real, validade e quem pode revisar | SPEC-003 |
| Confirmacao | Comunidade confirma por codigo antes do horario | Se secretaria ou supervisor tambem confirma | SPEC-005 |
| Cancelamento | Permitido por codigo ate o inicio | Janela minima, motivo e politica de falta | BR-055, SPEC-005 |
| Contato | Nome e ao menos e-mail ou telefone | Canal obrigatorio e forma de verificacao | SPEC-005 |
| Menores | Demo atende somente adulto ficticio | Fluxo de responsavel, consentimento e dados adicionais | Produto e LGPD |
| Uso da sala | Um atendimento ocupa uma sala/consultorio | Ambientes compartilhados ou pesos diferentes | BR-031 |
| Equipamento | Quantidade configuravel por atendimento | Lista e consumo real por cada servico | BR-032 |
| Limite do supervisor | Numero de estudantes simultaneos | Se muda por curso, disciplina ou tipo de atendimento | SPEC-002/004 |
| Calendario | Sessoes datadas representam excecoes/feriados | Necessidade de recorrencia e calendario institucional | SPEC-002/004 |
| Retencao | 180 dias para contato; 12 meses para auditoria | Prazos legais/institucionais e descarte | Seguranca e LGPD |
| Notificacao | Codigo exibido na tela, sem envio real | Provedor e canal futuro | SPEC-005 |
| Chatbot | FAQ curada, sem dados pessoais | Valor para a banca, provedor e politica de dados | SPEC-007 |

## Criterio de decisao

Uma resposta so bloqueia o MVP se mudar a demonstracao dos requisitos Must. As
demais viram backlog pos-hackathon. Nao coletar um novo dado pessoal apenas para
antecipar uma possibilidade futura.
