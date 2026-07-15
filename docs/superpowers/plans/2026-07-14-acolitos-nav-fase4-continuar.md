# Spec D · Fase 4 — Chip "Continuar: <última tela>" na Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** O `shared.js` grava a última tela usada do app; a Home (`index.html`) mostra um chip **"▸ Continuar: <Tela>"** que leva de volta — SEM redirect automático, respeitando o gate de login/permissões.

**Architecture:** Gravação centralizada no `shared.js` (roda em toda tela do app após `initModulo`); leitura + render do chip só na `index.html`. Guarda `{href, label}` em `localStorage['ultima-tela']`. O chip só aparece se: (a) há última tela; (b) ela não é a própria Home; (c) o usuário tem permissão pra ela (via `navCaps`/lista de telas conhecidas).

**Tech Stack:** JS puro. Sem dependência externa. Verificação: navegador (Playwright, login coord) — visitar uma tela, voltar à Home, ver o chip, clicar.

## Global Constraints
- `shared.js` (gravar) + `index.html` (render do chip). Não tocar nas outras telas.
- **NÃO** redirect automático — só um atalho clicável na Home. Não interferir nos redirects de gate (login→novos→index→permissões).
- Só gravar telas "reais" do app (não login.html, não novos.html, não a própria index).
- localStorage em try/catch. Se algo falhar, o pior caso é "sem chip" (degrada).
- Só mostrar o chip pra tela que o usuário PODE acessar (segurança/coerência com a nav).
- Mobile-first; o chip deve caber no topo da Home sem estourar.

---

## Task 1: Gravar a última tela (shared.js)

**Files:**
- Modify: `projetos/acolitos/shared.js`

**Interfaces:**
- Consome: `location.pathname`, `NAV_COORD_MODULOS` (href→label), e um mapa de rótulos das telas de jornada.
- Produz: função `registrarUltimaTela()` chamada no fim do fluxo de página; chave `ultima-tela` = `{href, label}`.

- [ ] **Step 1: Mapa de rótulos por arquivo + função de registro**

Adicionar no `shared.js` (perto de `NAV_COORD_MODULOS`, ~linha 1313):

```js
// Rótulos amigáveis por arquivo, p/ o chip "Continuar" da Home (Fase 4).
// Cobre telas de coordenação (NAV_COORD_MODULOS) e de jornada.
const TELA_LABEL = {
  'membros.html':'Membros', 'escala.html':'Escala', 'crm.html':'CRM',
  'tesouraria.html':'Tesouraria', 'casas.html':'Casas',
  'missoes.html':'Quests', 'escalas-membro.html':'Minhas Escalas', 'agenda.html':'Agenda',
  'destaques.html':'Destaques', 'minha-casa.html':'Minha Casa', 'ausencias.html':'Ausências',
  'jornada-admin.html':'Jornada', 'conquistas.html':'Conquistas', 'config.html':'Config'
};
// Telas que NÃO devem ser lembradas como "última tela"
const TELA_NAO_LEMBRAR = { 'login.html':1, 'novos.html':1, 'index.html':1, '':1 };

function registrarUltimaTela(){
  try{
    const file = (location.pathname.split('/').pop()||'');
    if (TELA_NAO_LEMBRAR[file]) return;
    const label = TELA_LABEL[file];
    if (!label) return;                       // só telas conhecidas
    localStorage.setItem('ultima-tela', JSON.stringify({ href:file, label:label }));
  }catch(e){}
}
```

- [ ] **Step 2: Chamar o registro após o boot de cada tela**

O `initModulo()` (shared.js) roda em toda tela e retorna o ctx (ou null se gate redirecionou). Registrar a tela DEPOIS que o ctx é validado (só grava se o usuário realmente está na tela, não durante um redirect). Localizar o ponto onde `initModulo` retorna o ctx com sucesso (após todos os guards/redirects) e, antes do `return ctx`, chamar `registrarUltimaTela()`.

```js
// dentro de initModulo, no caminho de sucesso (após os guards que dão return null/redirect):
registrarUltimaTela();
return ctx;   // (ou o nome real da variável retornada)
```
(Confirmar o nome da var e o ponto exato de sucesso — NÃO registrar antes dos guards de login/novos/index.)

- [ ] **Step 3: Verificação parcial (offline)**

Servir + carregar `escala.html` (login-gated → redireciona). Após login (Step 4 do teste integrado), navegar por telas e conferir no console: `localStorage.getItem('ultima-tela')` reflete a última tela conhecida (ex.: `{"href":"escala.html","label":"Escala"}`), e NÃO muda ao ficar na Home/login.

---

## Task 2: Render do chip na Home (index.html)

**Files:**
- Modify: `projetos/acolitos/index.html`

**Interfaces:**
- Consome: `localStorage['ultima-tela']`, `navCaps(ctx)` (pra checar permissão), o container `#main` da Home, o `ctx` do boot.
- Produz: `renderContinuar(ctx)` chamado no boot da Home.

- [ ] **Step 1: Função de render do chip**

Adicionar em `index.html` (no script da Home):

```js
function renderContinuar(ctx){
  let u; try{ u = JSON.parse(localStorage.getItem('ultima-tela')||'null'); }catch(e){ u=null; }
  if(!u || !u.href || !u.label) return;
  // segurança/coerência: só oferece telas que o usuário pode acessar
  const caps = (typeof navCaps==='function') ? navCaps(ctx) : null;
  const COORD = { 'membros.html':'membros','escala.html':'escala','crm.html':'crm','tesouraria.html':'tesouraria','casas.html':'casas' };
  const permKey = COORD[u.href];
  if(permKey){                              // tela de coordenação: exige permissão
    if(!caps || !caps.perms || caps.perms.indexOf(permKey)===-1) return;
  }
  // telas de jornada (missoes/agenda/etc.) são acessíveis a quem serve; se não serve, não mostra as de coordenação (já barrado acima)
  const host = document.getElementById('continuar-slot') || document.getElementById('main');
  if(!host) return;
  const chip = document.createElement('a');
  chip.href = u.href; chip.className = 'continuar-chip';
  chip.innerHTML = '';
  const ic = document.createElement('span'); ic.className='cc-ic'; ic.textContent='▸';
  const tx = document.createElement('span'); tx.textContent = 'Continuar: ' + u.label;
  chip.append(ic, tx);
  // insere no topo do main (antes do primeiro filho)
  if(host.id==='main' && host.firstChild) host.insertBefore(chip, host.firstChild);
  else host.appendChild(chip);
}
```

- [ ] **Step 2: CSS do chip (discreto, vinho+dourado)**

Adicionar no `<style>` da index:

```css
.continuar-chip{ display:inline-flex; align-items:center; gap:8px; margin:0 0 14px;
  padding:9px 14px; border-radius:22px; text-decoration:none;
  background:linear-gradient(160deg, rgba(232,205,143,.14), rgba(138,106,36,.1));
  border:1px solid var(--gold-dim, #7a5a1a); color:var(--gold-light, #ffd97a);
  font-size:13px; font-weight:700; font-family:'Sora',system-ui,sans-serif; }
.continuar-chip .cc-ic{ font-size:14px; }
.continuar-chip:active{ background:rgba(232,205,143,.2); }
```
(usar as variáveis reais da index; se não existirem, os fallbacks cobrem.)

- [ ] **Step 3: Chamar no boot da Home**

No `boot()` da index (após `renderHeader`/antes ou depois de montar o dashboard — melhor logo após ter o `ctx`, ~linha 126-135), chamar:
```js
renderContinuar(ctx);
```
Colocar de modo que o chip apareça no topo do conteúdo da Home (antes do dashboard), tanto no modo coordenação quanto jornada. Confirmar o container real (`#main`) e ajustar a inserção.

- [ ] **Step 4: Verificação (Playwright, login coord)**

- Servir root + login `bot-teste@jcbplimeira.com` / `Coroinha-Bot-2026!`.
- Ir pra **Escala** (grava ultima-tela). Voltar pra **Home** (index). Confirmar: aparece o chip **"▸ Continuar: Escala"** no topo. Clicar → vai pra escala.html.
- Ir pra **Membros**, voltar à Home → chip vira "Continuar: Membros".
- Confirmar que NÃO há redirect automático (a Home carrega normal; o chip é só um atalho).
- Confirmar que o chip só aparece pra tela permitida (coord tem acesso a tudo; o gate de perm foi respeitado no código).
- Sem erro de console. Mobile 390px: chip não estoura.

- [ ] **Step 5: Commit**
```bash
git add projetos/acolitos/shared.js projetos/acolitos/index.html
git commit -m "feat(acolitos): chip 'Continuar: <última tela>' na Home (Spec D F4)"
```

---

## Self-review (na escrita)
- **Cobertura:** F4 do spec (grava última tela no shared.js; chip na Home; NÃO redirect automático; só tela permitida) → Tasks 1+2. ✔
- **Segurança:** o chip checa `navCaps().perms` pras telas de coordenação (não oferece o que o usuário não pode abrir). Telas de jornada são acessíveis a quem serve. ✔
- **Não brigar com gate:** o registro só ocorre no caminho de SUCESSO do `initModulo` (após os redirects login/novos/index) — nunca durante um redirect. O chip é atalho, não redirect. ✔
- **Placeholders:** funções completas; pontos de "confirmar var/ponto de sucesso do initModulo" e "container real da Home" são integração no arquivo existente, com o critério descrito. ✔
- **Risco baixo/reversível:** shared.js + index.html; pior caso = "sem chip". Revert simples. ✔
