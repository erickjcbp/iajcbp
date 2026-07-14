# Spec D — Navegação & Histórico de uso

**Data:** 2026-07-14
**Projeto:** Acólitos (iajcbp)
**Escopo:** Fazer o app "lembrar do usuário" e a navegação parecer nativa: Voltar fecha modal, salvar sem perder o lugar, restaurar contexto de cada tela, e voltar pra última tela usada. Melhoria transversal, centralizada no `shared.js`.

Fatiada em **4 fases** (1 por sessão). Ordem recomendada: **F2 → F1 → F3 → F4**.

---

## Contexto atual (verificado)

- App = **múltiplas páginas HTML standalone** (index/escala/membros/…); navegação entre telas = **page load** via `location.href` (em `shared.js` e botões). O Voltar do navegador funciona por página, mas **perde o estado dentro da tela** (modal aberto, rolagem, semana, filtros).
- **Modais**: abrem/fecham por `classList.add/remove('open')` nos `.modal-overlay`; helper `fecharModal(id)`. Não interagem com o histórico → o **Voltar sai da página inteira**, não fecha o modal.
- **Salvar escala** (`escala.html:1152 salvarEscala`): ao salvar, mostra "✓ salva", espera 1s, **`fecharModal('modal-montagem')` + `await loadDados()`** → fecha o modal e **re-renderiza a escala inteira**, perdendo rolagem/lugar. (Não é `location.reload`, mas o efeito percebido é "recarregou".)
- **Persistência de estado**: já existe pontual em `localStorage` (`agenda-view`, `agenda-tl-filtro`, `membros-vista`, `nav-mode`, `jcbp-theme`, `jor-collapsed`, `aus_tutorial_visto`). NÃO há para: semana/filtro/rolagem da Escala, "última tela", etc.

Fora de escopo: páginas públicas standalone (`ausencias-publica.html`, `pastoral.html`) — sem login/nav.

---

## Design por fase

### Fase 2 — Salvar sem perder o lugar (COMEÇAR AQUI)
Decisão do dono: ao salvar, **ficar no modal** com um "✓ salvo" e fechar manualmente.

- `salvarEscala` (escala.html): após gravar com sucesso, **não** fecha o modal nem chama `loadDados()`. Em vez disso:
  - Mostra inline no modal: **"✓ salvo · N posições"** (discreto, no lugar do estado atual do botão), botão volta a "Salvar Escala" (permite re-salvar após ajustes).
  - Marca a celebração como "suja" (precisa refresh) num flag; **não re-renderiza a tela**.
  - O modal ganha/mantém um botão **Fechar** claro.
- Ao **fechar** o modal de montagem (Fechar/X/Voltar): se houve save, atualizar **apenas o card daquela celebração** na planilha (re-render pontual), preservando a **rolagem** e a semana/filtro atuais. Sem `loadDados()` global.
  - Implementação: extrair do `loadDados`/render um helper que re-renderiza **um card de celebração** por id (ou re-fetch só daquela celebração + troca do nó no DOM), guardando e restaurando `window.scrollY`.
- Aplicar o mesmo princípio (não fechar+recarregar tudo) aos outros saves que hoje fecham+`loadDados` quando fizer sentido (ex.: nova celebração pode manter o fluxo, mas sem resetar a rolagem).

### Fase 1 — Voltar fecha o modal (app-wide, no shared.js)
- No `shared.js`, sistema global de histórico de modal:
  - **Detecção automática**: `MutationObserver` observando adição/remoção da classe `.open` em `.modal-overlay` (cobre todos os modais sem tocar em cada call-site).
  - Ao um modal **abrir**: `history.pushState({acmodal:id}, '')`.
  - No **`popstate`** (Voltar): se há modal aberto, **fecha o topo** (remove `.open`) e **não** navega; consume o estado.
  - Ao **fechar** por X/fundo/Fechar (não via Voltar): `history.back()` uma vez para descartar o estado empilhado, evitando histórico "fantasma".
  - Guardas: evitar push duplicado; pilha de modais (se abrir modal sobre modal); não empilhar em modais efêmeros (toasts, celebração de nível — usar um opt-out via atributo `data-no-history` se preciso).
- ⚠️ Fase mais delicada — testar em várias telas (escala, membros, agenda, config) e no iOS/Android (gesto de voltar).

### Fase 3 — Lembrar onde parei (estado por tela)
- Padrão `estado-<tela>` em `localStorage` (JSON): salvar ao mudar e ao sair; restaurar no load.
  - **Escala**: `{ semana/data-ref, comunidade (filtro), scrollY }`. Restaura a semana/filtro e a rolagem ao reabrir.
  - **Membros/outros**: estender o que já existe (vista) com filtros + rolagem.
- Restauração de rolagem: salvar `scrollY` no `pagehide`/`visibilitychange`; restaurar após o primeiro render.
- Reusar/uniformizar com as chaves já existentes (não duplicar `membros-vista`/`agenda-view`).

### Fase 4 — Voltar pra última tela
- `shared.js` grava `ultima-tela` (o href da página atual) a cada load de tela do app (exceto login/novos).
- Na **Home** (`index.html`): um chip/atalho **"▸ Continuar: <Tela>"** que leva à `ultima-tela` — **não** redireciona automático (respeita as regras de gate: login → novos → index → permissões, que hoje forçam `location.href`).
- Guardas: só mostra o chip se a última tela for diferente da Home e o usuário tiver permissão pra ela.

---

## Arquivos afetados (visão geral)

| Fase | Arquivos |
|---|---|
| F2 | `projetos/acolitos/escala.html` (salvarEscala + re-render pontual de card) |
| F1 | `projetos/acolitos/shared.js` (sistema de histórico de modal, app-wide) |
| F3 | `projetos/acolitos/shared.js` (helpers de estado/scroll) + telas (escala, membros…) |
| F4 | `projetos/acolitos/shared.js` (grava última tela) + `index.html` (chip Continuar) |

## Critérios de aceite (por fase)

**F2:** salvar a escala mantém o modal aberto com "✓ salvo"; a tela por trás não recarrega nem pula pro topo; ao fechar, só o card da celebração salva atualiza, preservando rolagem/semana/filtro.
**F1:** com um modal aberto, o Voltar do navegador/gesto **fecha o modal** (não sai da tela); fechar por X/fundo mantém o histórico consistente; funciona em escala/membros/agenda/config, iOS e Android.
**F3:** reabrir/recarregar uma tela restaura semana/filtro/rolagem de onde você estava.
**F4:** a Home mostra "▸ Continuar: <última tela>" quando aplicável; tocar leva de volta; sem quebrar os redirects de login/onboarding/permissão.

Transversal: responsivo, sem `confirm/alert` nativos (usar ui* do shared.js), sem dependência de CDN, sem quebrar telas existentes.

## Riscos / notas

- **F1 é a de maior risco** (histórico + gesto de voltar no iOS). Fazer com teste amplo; ter opt-out (`data-no-history`) para modais especiais.
- **F4**: NÃO transformar em redirect automático — só atalho — pra não colidir com a lógica de gate em `shared.js` (`navCaps`/redirects). Ver [[project_acolitos_permissoes]].
- Centralizar em `shared.js` mantém o app coeso (todas as telas herdam) — evita a colisão de globais já conhecida ([[project_acolitos_global_collisions]]); usar nomes únicos e IIFE.
- Só local até validar; deploy é do root (ver [[project_acolitos_deploy]]) com carimbo de BUILD.
