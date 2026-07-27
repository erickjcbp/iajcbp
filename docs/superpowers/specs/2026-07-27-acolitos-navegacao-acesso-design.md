# Navegação — arrumar o acesso (pente fino)

**Data:** 2026-07-27
**Projeto:** Acólitos (iajcbp)
**Escopo:** Corrigir *de onde se chega* nas telas. Nenhuma tela é criada, fundida ou removida.

Decisão do dono, tomada no brainstorming: **manter as telas como estão e só arrumar o acesso.** Foi descartada a alternativa de juntar telas em hubs (Jornada = Quests+Conquistas+Destaques) e a de repensar os dois modos.

---

## Contexto verificado (2026-07-26/27)

Números reais de produção, que reenquadram o problema:

- **175 membros ativos, 39 com login.**
- **171 são "só membro"** (modo jornada) — ~35 deles com login.
- **4 são equipe** (Gustavo, Franciele, Erick, Maria E. Carli), e **todos os 4 também servem**, então alternam entre os dois modos. Não existe ninguém "só coordenação".

Ou seja: a barra de 9 itens da coordenação é vista por 4 pessoas — as que mais conhecem o app. A de 7 do modo jornada é a que a maioria usa. As duas não são o mesmo problema.

**A barra já rola de lado.** `shared.css:137` (`.app-nav` com overflow), `.nav-arrow` (setas ‹ ›) e `setupNavArrows` (`shared.js:1652-1669`), que inclusive pisca a seta direita por 2,6s como dica quando há transbordo. O que falta é só rolar o item **ativo** pra dentro da vista.

**Ordem da barra é configurável** por `Config › Navegação` (`acolitos_config.nav_ordem_coord` / `nav_ordem_jornada`), e `renderBottomNav` ordena por essa lista. Itens fora da lista vão pro fim.

---

## Problemas que este spec resolve

1. **Caixa de Aprovações inalcançável quando vazia.** `ausencias.html` é, para a equipe, a caixa unificada (novos cadastros, coberturas, avisos, homologações). Ela não está na barra da coordenação: só se chega por um aviso vermelho na Home (`index.html:623`) **que só é renderizado se `total > 0`**. Sem pendências, não há caminho.
2. **Conquistas fora de qualquer menu.** Tela cheia (insígnias de nível, troféus de temporada, medalhas). Só se chega por dentro do Quests ou por um modal de comemoração.
3. **Item ativo pode abrir fora da vista** numa barra que rola.
4. **Rótulo que não descreve o destino.** Na barra do membro, "Ausência" abre a tela de informar falta; a mesma tela, para a equipe, é a caixa de aprovações. Um arquivo, dois públicos, um nome só.

## Explicitamente fora de escopo

- **O menu `⋯ Mais` da Escala fica inteiro.** O dono confirmou que usa Modelos, Ausências, Registrar ausência, Frequência e Faltas **de dentro da Escala**, enquanto monta o roteiro. Isso é acesso no contexto certo, não redundância.
- **Juntar telas em hubs** — descartado.
- **Mexer nos dois modos (Jornada ⇄ Coordenação)** — descartado.
- **De-duplicar implementações.** Ausências, Frequência e Modelos têm código próprio dentro de `escala.html` *e* nas telas dedicadas. Os botões ficam; a duplicação de código é dívida registrada, não atacada aqui.

---

## Design

### 1. Item ativo sempre visível

Em `setupNavArrows(el)`, após a primeira medição, rolar o `.nav-item.active` para dentro da área visível (`scrollIntoView({ inline: 'center', block: 'nearest' })` ou cálculo equivalente de `scrollLeft`).

Deve rodar **depois** do `requestAnimationFrame` que já existe, para não brigar com a animação de dica da seta. Se não houver transbordo, não faz nada.

### 2. Caixa de Aprovações na barra da coordenação

Novo módulo liberável **`caixa`**, seguindo a regra do projeto de que todo módulo novo nasce como permissão própria gateada por admin (mesma decisão tomada para `jornada` em 2026-07-26).

- `MODULOS_LIBERAVEIS` (`shared.js`): `['caixa','Caixa de Aprovações','ausencias.html']`.
- `NAV_COORD_MODULOS`: `caixa: { label:'Caixa', href:'ausencias.html', icon:'inbox' }`. Ícone `inbox` precisa ser acrescentado ao mapa de `_svgIcon`.
- `ORDEM_MODULOS`: entra logo após `jornada`.
- `NAV_ITENS.coord` em `config.html` (seção Navegação) ganha `['caixa','Caixa']`, senão o item não aparece no editor de ordem.

**O gate NÃO vai no `initModulo` desta tela.** `ausencias.html` abre hoje com `initModulo()` sem exigir papel, porque **qualquer membro** precisa dela para informar ausência. Passar `{ perm: 'caixa' }` trancaria os 171 membros para fora da própria ausência — seria uma regressão grave.

Portanto `ausencias.html` **mantém `initModulo()` como está**. O gate é no *bloco* de coordenação: a parte de aprovações (novos cadastros, coberturas, avisos, homologar) só é renderizada quando `isAdmin || perms.includes('caixa')`. O item **Caixa** na barra da coordenação segue a permissão normalmente, via `ORDEM_MODULOS`.

Esta é a única tela do app em que a permissão gateia conteúdo em vez da porta — porque é a única com dois públicos no mesmo arquivo. Vale um comentário no código dizendo isso, senão alguém "conserta" para `{ perm: 'caixa' }` depois.

**Contador.** O item mostra o total de pendências, reaproveitando as duas RPCs que a Home já chama: `acolitos_solicitacoes_pendentes` (trocas + candidaturas + cobrir) e `acolitos_ausencia_pendente_listar` (pendentes). `renderBottomNav` é síncrono; o contador é buscado depois e pintado no item quando chega, sem segurar o render.

O item **nunca some**. Sem pendências, apenas não há número — foi exatamente o sumiço que criou o problema.

Precisa de CSS novo: `.nav-badge` (bolinha sobre o ícone). As classes `.badge` existentes são de nível/status e não servem.

### 3. Conquistas na barra do membro

Item `conquistas` → `conquistas.html`, ícone `award` (novo no `_svgIcon`), no bloco fixo do modo jornada em `renderBottomNav`. Entra também em `NAV_ITENS.jornada` (`config.html`) e em `TELA_LABEL` (`shared.js`), que hoje já tem `'conquistas.html':'Conquistas'`.

Sem permissão: gamificação é de todo mundo.

### 4. Rótulos por público

| barra | hoje | proposto |
|---|---|---|
| jornada (membro) | Ausência | **Faltar** |
| coordenação | *(não existia)* | **Caixa** |

O `id` do item na barra do membro continua `ausencias` — mudar quebraria a ordem já salva em `nav_ordem_jornada`. Muda só o `label`. O mesmo vale para `NAV_ITENS.jornada` em `config.html`, que precisa exibir o rótulo novo.

---

## Impacto em quem usa hoje

- **Ninguém perde acesso a informar ausência.** O gate de `caixa` é sobre o bloco de aprovações, não sobre a tela.
- **A Caixa nasce vazia para os 4 da equipe**, como aconteceu com `jornada`. `coord_admin` (Erick e mais 2) continua entrando por ser admin. Liberar em Config › Equipe & Permissões.
- A barra da coordenação passa de 9 para 10 itens **potenciais**, mas cada pessoa só vê o que tem liberado — na prática hoje são menos.
- A barra do membro passa de 7 para 8. A rolagem lateral já existente absorve.

## Como verificar

1. **Item ativo visível:** abrir a última tela da barra num viewport de 390px e conferir que ela está dentro da área visível ao carregar.
2. **Caixa sem pendências:** zerar mentalmente o contador (ou usar conta sem pendências) e confirmar que o item continua na barra, sem número.
3. **Caixa com pendências:** confirmar que o número bate com o aviso vermelho da Home (mesmas RPCs).
4. **Membro comum abre `ausencias.html`:** vê "Informar Ausência" e "Minhas Ausências"; **não** vê o bloco de aprovações.
5. **Equipe sem `caixa`:** não vê o item na barra; abrindo a URL, vê a parte de ausência mas não a de aprovações.
6. **Conquistas:** aparece na barra do membro e abre a tela.
7. **Ordem configurável:** Config › Navegação lista Caixa e Conquistas, e reordenar continua funcionando.
8. Rodar em 390px e conferir que nada estoura a lateral.
