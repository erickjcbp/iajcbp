# Acólitos — Fase 5: Planilha de escala completa + substituto na chamada

**Data:** 2026-05-31 · **Projeto:** iajcbp · **Spec base:** seções 6.4 e 6.6.

## Entregue

### A) Planilha de escala (`escala.html`, aba Planilha)
Antes só tinha Membro + Fn.Máx + datas. Agora colunas completas (spec 6.4):
- **Membro** (sticky): avatar + patch (derivado das habilitações) + nome
- **Idade** (calcIdade)
- **Freq** (mini barra + %, via view acolitos_frequencia)
- **Obs** (💬 → modal com necessidades especiais + restrições + observações)
- **MECE** (👪 → modal com pais ministros + comunidade)
- **Funções** (13 bolinhas coloridas por proficiência)
- **Fn.Máx** + colunas de datas (mantidas)
loadDados estendido (mais campos do membro, restrições, fetchFrequencia).
Modal genérico `#modal-info` para os balões.

### B) Substituto na chamada (`chamada.html`)
Ao marcar **ausente**, abre seletor de substituto (membros aptos àquela função e
não escalados na celebração). Ao confirmar:
- `acolitos_chamadas_itens.substituto_id` gravado
- escala do ausente vira `status='substituido'` + `substituto_id` (quando há sub);
  sem sub, segue `ausente`.

## Decisões / fora de escopo
- Agrupamento colapsável por nível na planilha: adiado (colunas eram o núcleo).
- Crédito de frequência ao substituto (criar escala 'presente' p/ o sub): adiado;
  por ora registra-se a substituição, sem somar presença ao substituto.

## Verificação
Sintaxe validada (node --check) em escala.html e chamada.html.
