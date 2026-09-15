---
status: accepted
---

# Capacidade materializada e reservada no PostgreSQL

Cada sessao publicada gera horarios com capacidade explicavel e persistida; a
reserva bloqueia o horario e as linhas dos recursos compartilhados em ordem
estavel, revalida capacidade global e grava tudo na mesma transacao. Calcular
apenas no navegador ou usar contador em cache foi rejeitado porque permitiria
overbooking entre sessoes; o custo e recalcular horarios futuros quando
documentos, alocacoes ou recursos mudarem.
