---
status: accepted
---

# Monolito modular com PostgreSQL

Usaremos React, FastAPI e PostgreSQL no mesmo repositorio, com uma API modular e
um unico banco, porque agenda, supervisao e recursos exigem transacoes fortes e
o prazo da hackathon nao justifica servicos distribuidos. Redis, filas e
microservicos foram rejeitados no MVP: acrescentam operacao sem resolver uma
necessidade atual; Redis so sera reconsiderado para rate limiting distribuido ou
multiplas instancias.
