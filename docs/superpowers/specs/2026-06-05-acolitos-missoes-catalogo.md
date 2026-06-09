# Catálogo de Missões — autoria nível a nível (em andamento)

Documento vivo. Cada nível lista os **requisitos pra CHEGAR nele**. Vamos do mais baixo ao mais alto.
Validações: `automatica` (dados do app) · `avaliada` (coordenação observa) · `reivindicada` (membro pede, coord aprova).
Liga e dificuldade escalam (Iniciantes acolhedor → Cerimoniários duro).

## Entrada
- Novo membro entra como **Aspirante** automaticamente ao ser **"integrado"** no CRM. Sem missão.

## Nível 2 — Coroinha  *(Aspirante → Coroinha · liga Iniciantes)* — ✅ FECHADO
| Missão | Validação | Critério | XP |
|---|---|---|---|
| Participar de 2 ensaios | automática | presença (chamada do ensaio) em evento tipo *ensaio* que convocou o nível, qtd 2 | 20 |
| Servir 4 missas | automática | `missas_servidas` (chamada presente/atrasado) qtd 4 | 20 |
| Enturmar-se com a pastoral | avaliada | coordenação percebe a integração | 15 |

---

## DEPENDÊNCIA NOVA: evento "ensaio" com convocação por nível + chamada de presença
Surgiu na autoria do Coroinha. Extensão da Agenda (`acolitos_eventos` + presença):
- Evento ganha **convocados**: **seleção manual de vários níveis** (ex.: marcar Aspirante + Coroinha).
- Aparece/notifica só os convocados.
- **Presença = chamada do ensaio** feita pela **coordenação** no dia (não RSVP) — mais confiável.
- Nova fonte automática de missão: `ensaio` (conta presenças confirmadas em ensaios que convocaram o nível do membro).
- **Quando construir:** junto da F2 (missões automáticas), pois as missões de ensaio dependem disso.

---

## Próximos (a autorar)
- Nível 3 — Acólito Aspirante
- Nível 4 — Acólito Guardião
- Nível 5 — Acólito Sentinela
- Nível 6 — Aspirante a Cerimoniário
- Nível 7 — Cerimoniário Aspirante
- Nível 8 — Cerimoniário Guardião
- Nível 9 — Cerimoniário Magistral
- Nível 10 — Cerimoniário Mor *(Referência: dominar TODAS as funções + competências avaliadas — duro)*
