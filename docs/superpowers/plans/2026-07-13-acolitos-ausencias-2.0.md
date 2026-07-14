# Ausências 2.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a página pública /ausencias fácil e à prova de erro: consertar a seleção de nome, adicionar tutorial guiado, e permitir marcar celebrações por mês/semana inteiros dentro da janela de 90 dias.

**Architecture:** Página standalone `ausencias-publica.html` (sem shared.js, sem build, CSS/JS inline, anon key). Mudanças 100% no front, exceto uma migration SQL que sobe o limite de celebrações por envio. Sem dependências de CDN externo (redes de operadora bloqueiam).

**Tech Stack:** HTML/CSS/JS puro; Supabase JS (cópia local em `vendor/`); Postgres RPCs `security definer`. Verificação via navegador (Playwright MCP) servindo o repo com `python3 -m http.server` a partir da **raiz do repo** (os caminhos são absolutos: `/projetos/acolitos/...`).

## Global Constraints

- Página **standalone**: sem shared.js, todo CSS/JS **inline**, **zero** dependência de CDN externo (só a cópia local `vendor/supabase-js-2.106.2.min.js`).
- Público, **sem login**: apenas as RPCs `acolitos_ausencia_publica_*` (anon). Não expor PII além de id+nome na busca.
- informante / motivo / contato continuam **obrigatórios** (front + servidor).
- **Mobile-first e responsivo**: não estourar a tela no celular; `max-width:540px` no wrap.
- Identidade visual atual (vinho + dourado, fontes Sora/Inter) preservada.
- **Só local por enquanto**: nada de push/deploy. Migration aplicada via MCP Supabase só quando o dono pedir.
- Semana = domingo→sábado (consistente com `DIAS=['Dom',...]` já no arquivo).

---

## Verificação — setup padrão (usado em todas as tarefas de front)

Servir o repo e abrir a página:

```bash
# a partir da raiz do repo (/Users/erickmartins/iajcbp)
python3 -m http.server 8765 >/tmp/aus-http.log 2>&1 &
# abrir no navegador de verificação:
# http://localhost:8765/projetos/acolitos/ausencias-publica.html
```

A página bate no Supabase real (anon), então busca e celebrações carregam de verdade. Ao terminar cada verificação, o servidor pode continuar de pé para a próxima tarefa.

---

## Task 1: Migration — subir cap de celebrações por envio (30 → 120)

Marcar "mês inteiro" pode passar de 30 celebrações. A RPC de envio rejeita com `muitos_itens` acima de 30. Subir para 120, mantendo todas as validações.

**Files:**
- Create: `db/seguranca/008_ausencias_publica_cap.sql`

**Interfaces:**
- Produces: `acolitos_ausencia_publica_enviar(uuid[],uuid[],text,text,text)` — mesma assinatura, novo limite 120 celebrações; retorno inalterado (`{ok, criadas}` ou `{erro}`).

- [ ] **Step 1: Criar a migration**

Create `db/seguranca/008_ausencias_publica_cap.sql`:

```sql
-- 008 — Sobe o limite de celebrações por envio na ausência pública (2026-07-13)
-- Motivo: a nova UI permite marcar mês/semana inteiros; 30 era pouco.
-- Mantém TODAS as validações do 006 (ativos, data futura, dedupe, membros <= 20).

create or replace function public.acolitos_ausencia_publica_enviar(
  p_membros uuid[], p_celebracoes uuid[], p_motivo text, p_informante text, p_contato text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_motivo text := nullif(left(btrim(coalesce(p_motivo,'')),200),'');
  v_inf    text := nullif(left(btrim(coalesce(p_informante,'')),200),'');
  v_con    text := nullif(left(btrim(coalesce(p_contato,'')),200),'');
  v_n int := 0;
begin
  if p_membros is null or array_length(p_membros,1) is null
     or p_celebracoes is null or array_length(p_celebracoes,1) is null then
    return jsonb_build_object('erro','sem_itens');
  end if;
  if v_inf is null or v_motivo is null or v_con is null then
    return jsonb_build_object('erro','campos_obrigatorios');
  end if;
  -- ANTES: p_celebracoes > 30. AGORA: 120.
  if array_length(p_membros,1) > 20 or array_length(p_celebracoes,1) > 120 then
    return jsonb_build_object('erro','muitos_itens');
  end if;

  insert into public.acolitos_ausencias_pendentes (membro_id, celebracao_id, data, motivo, informante_nome, informante_contato)
  select m.id, c.id, c.data, v_motivo, v_inf, v_con
  from unnest(p_membros) as mm(id)
  join public.acolitos_membros m on m.id = mm.id and m.status='ativo'
  cross join unnest(p_celebracoes) as cc(id)
  join public.acolitos_celebracoes c on c.id = cc.id and c.data >= current_date
  on conflict (membro_id, celebracao_id) where status='pendente' do nothing;

  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('erro','sem_itens_validos'); end if;
  return jsonb_build_object('ok', true, 'criadas', v_n);
end; $$;

grant execute on function public.acolitos_ausencia_publica_enviar(uuid[],uuid[],text,text,text) to anon, authenticated;
```

- [ ] **Step 2: Verificar sintaxe SQL (leitura)**

Reler o arquivo; confirmar que só a linha do `if ... > 120` mudou vs `006`, e que o grant está presente.
Expected: idêntico ao `006` exceto o limite 30→120.

- [ ] **Step 3: Commit**

```bash
git add db/seguranca/008_ausencias_publica_cap.sql
git commit -m "feat(acolitos): sobe cap de celebrações da ausência pública p/ 120"
```

> Nota: **não aplicar** no banco agora (só local). Aplicação via MCP Supabase quando o dono pedir. Até lá, se a UI enviar >30 celebrações antes da migration ir pro banco, a RPC antiga retorna `muitos_itens` — comportamento esperado até o deploy.

---

## Task 2: Conserto da seleção de nome

Deixar óbvio **onde** buscar o nome e **que dá pra adicionar vários**. Três frentes: (a) indicador apontando pro campo até a 1ª pessoa, (b) resultados com afordância de toque, (c) feedback ao adicionar.

**Files:**
- Modify: `projetos/acolitos/ausencias-publica.html`

**Interfaces:**
- Consumes: RPC `acolitos_ausencia_publica_buscar(p_q)` (retorna `[{id,nome}]`), Map `selMembros`, `renderChips()`, `$()`.
- Produces: função `flashAdd(msg)` (toast temporário); nada consumido por outras tasks.

- [ ] **Step 1: CSS — indicador do campo de nome, resultados e toast**

No bloco `<style>`, logo após a regra `.results button:active{...}` (por volta da linha 54), adicionar:

```css
    /* Afordância de toque nos resultados */
    .results .rhint{ font-size:11px; color:var(--gold-light); padding:8px 13px 6px; background:#2a1520;
      border-bottom:1px solid var(--border-soft); font-family:'Sora',sans-serif; letter-spacing:.2px; }
    .results button{ display:flex; align-items:center; gap:10px; }
    .results .ini{ width:26px; height:26px; border-radius:50%; flex:none; display:flex; align-items:center;
      justify-content:center; font-size:12px; font-weight:700; color:#2a1500;
      background:linear-gradient(160deg,var(--gold-light),var(--gold)); }
    .results .rn{ flex:1; min-width:0; }
    .results .plus{ flex:none; width:22px; height:22px; border-radius:50%; background:#00000030;
      color:var(--gold-light); font-weight:800; display:flex; align-items:center; justify-content:center; font-size:16px; }

    /* Indicador que aponta pro campo de nome (some após 1ª pessoa) */
    .point{ position:relative; margin:8px 0 0; padding:10px 12px; border-radius:11px;
      background:#3a1c24; border:1px dashed var(--gold-dim); color:var(--gold-light);
      font-size:12.5px; display:flex; align-items:center; gap:8px; animation:pointPulse 1.6s ease-in-out infinite; }
    .point::before{ content:''; position:absolute; top:-7px; left:22px; width:12px; height:12px;
      background:#3a1c24; border-left:1px dashed var(--gold-dim); border-top:1px dashed var(--gold-dim);
      transform:rotate(45deg); }
    .point.hide{ display:none; }
    @keyframes pointPulse{ 0%,100%{ opacity:.85 } 50%{ opacity:1 } }

    /* Toast "adicionou" */
    .flash{ position:fixed; left:50%; bottom:26px; transform:translateX(-50%) translateY(10px);
      background:#1f3a24; color:#c9f5d3; border:1px solid var(--ok); border-radius:12px;
      padding:10px 16px; font-size:13px; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,.5);
      opacity:0; pointer-events:none; transition:opacity .2s, transform .2s; z-index:60; }
    .flash.show{ opacity:1; transform:translateX(-50%) translateY(0); }
```

- [ ] **Step 2: HTML — inserir o indicador e o toast**

No HTML, logo após `<div id="chips" class="chips"></div>` (linha ~111), adicionar o indicador:

```html
        <div id="point" class="point">👆 Comece aqui: digite o nome do coroinha e <b>toque no nome</b> que aparecer para adicionar.</div>
```

E antes do fechamento `</div>` do `.wrap` (após o `ok-screen`, linha ~138), adicionar o toast:

```html
    <div id="flash" class="flash"></div>
```

- [ ] **Step 3: JS — resultados com avatar/+, toast, e esconder indicador após 1ª pessoa**

Substituir a função `buscar` e a função `renderChips` (linhas ~176-196) por:

```js
    async function buscar(q){
      const { data, error } = await sb.rpc('acolitos_ausencia_publica_buscar', { p_q:q });
      const box=$('results'); box.innerHTML='';
      if(error || !Array.isArray(data) || !data.length){ box.classList.remove('show'); return; }
      const hint=document.createElement('div'); hint.className='rhint'; hint.textContent='toque no nome para adicionar';
      box.appendChild(hint);
      data.forEach(m=>{
        const b=document.createElement('button');
        const ini=document.createElement('span'); ini.className='ini'; ini.textContent=(m.nome||'?').trim().charAt(0).toUpperCase();
        const nm=document.createElement('span'); nm.className='rn'; nm.textContent=m.nome;
        const pl=document.createElement('span'); pl.className='plus'; pl.textContent='+';
        b.append(ini,nm,pl);
        b.onclick=()=>{
          const novo=!selMembros.has(m.id);
          selMembros.set(m.id, m.nome); renderChips();
          box.classList.remove('show'); $('busca').value='';
          if(novo) flashAdd('Adicionou! Pode buscar e adicionar mais de um.');
        };
        box.appendChild(b);
      });
      box.classList.add('show');
    }
    function renderChips(){
      const c=$('chips'); c.innerHTML='';
      selMembros.forEach((nome,id)=>{
        const chip=document.createElement('span'); chip.className='chip';
        const ini=document.createElement('span'); ini.className='cini'; ini.textContent=(nome||'?').trim().charAt(0).toUpperCase();
        const b=document.createElement('b'); b.textContent=nome;
        const x=document.createElement('span'); x.className='x'; x.textContent='×';
        x.onclick=()=>{ selMembros.delete(id); renderChips(); };
        chip.append(ini,b,x); c.appendChild(chip);
      });
      // Indicador some quando já há ao menos 1 pessoa
      $('point').classList.toggle('hide', selMembros.size>0);
    }
    function flashAdd(msg){
      const f=$('flash'); f.textContent=msg; f.classList.add('show');
      clearTimeout(flashAdd._t); flashAdd._t=setTimeout(()=>f.classList.remove('show'), 2600);
    }
```

- [ ] **Step 4: CSS do avatar no chip**

No `<style>`, após a regra `.chip b{...}` (linha ~60), adicionar:

```css
    .chip .cini{ width:22px; height:22px; border-radius:50%; flex:none; display:flex; align-items:center;
      justify-content:center; font-size:11px; font-weight:700; color:#2a1500;
      background:linear-gradient(160deg,var(--gold-light),var(--gold)); margin-left:-4px; }
```

- [ ] **Step 5: Verificar no navegador**

Servir (ver setup padrão) e abrir a página no Playwright. Confirmar:
1. Ao carregar, o balão "👆 Comece aqui..." aparece abaixo do campo de nome.
2. Digitar 2+ letras mostra a lista com inicial + nome + "+" e o cabeçalho "toque no nome para adicionar".
3. Tocar num nome: vira chip (com inicial), aparece o toast verde "Adicionou! Pode buscar e adicionar mais de um.", e o balão indicador some.
4. Remover o único chip (×) faz o balão indicador voltar.

Expected: todos os 4 pontos OK.

- [ ] **Step 6: Commit**

```bash
git add projetos/acolitos/ausencias-publica.html
git commit -m "feat(acolitos): ausência pública — seleção de nome guiada (indicador, afordância, feedback)"
```

---

## Task 3: Celebrações agrupadas por mês/semana com "marcar mês/semana"

**Files:**
- Modify: `projetos/acolitos/ausencias-publica.html`

**Interfaces:**
- Consumes: RPC `acolitos_ausencia_publica_celebracoes()` (retorna `[{id,data,horario,comunidade}]` ordenado por data/horario), Set `selCels`, `updateCelsMeta()`, `celLabel()`, `DIAS`.
- Produces: função `grupoKeySemana(dateObj)` (retorna string chave da semana domingo-sábado); render agrupado. Nada consumido por outras tasks além do próprio arquivo.

- [ ] **Step 1: CSS — cabeçalhos de mês/semana e botões "marcar"**

No `<style>`, após a regra `.cels-empty{...}` (linha ~79), adicionar:

```css
    .cel-mes{ display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding:10px 13px; background:#2a1520; border-bottom:1px solid var(--border-soft);
      position:sticky; top:0; z-index:2; }
    .cel-mes .mtit{ font-family:'Sora',sans-serif; font-weight:800; font-size:13px; color:var(--gold-light); letter-spacing:.3px; }
    .cel-sem{ display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding:7px 13px 7px 16px; background:#241019; border-bottom:1px solid var(--border-soft); }
    .cel-sem .stit{ font-size:11.5px; color:var(--muted); font-weight:600; }
    .mark-btn{ flex:none; border:1px solid var(--gold-dim); background:#3a1c24; color:var(--gold-light);
      border-radius:20px; padding:5px 11px; font-size:11.5px; font-weight:700; cursor:pointer; font-family:'Sora',sans-serif; }
    .mark-btn:active{ background:#4a2430; }
    .mark-btn.on{ background:linear-gradient(160deg,var(--gold-light),var(--gold)); color:#2a1500; border-color:var(--gold-light); }
    .cel{ padding-left:16px; }
```

- [ ] **Step 2: JS — helper de semana e render agrupado**

Substituir a função `carregarCelebracoes` inteira (linhas ~199-238) por esta versão. Mantém o tratamento de erro/timeout existente; muda só a parte de render (o `data.forEach`).

```js
    // chave da semana (domingo → sábado) a partir de um Date local
    function grupoKeySemana(d){
      const dom=new Date(d); dom.setDate(d.getDate()-d.getDay()); // volta pro domingo
      const sab=new Date(dom); sab.setDate(dom.getDate()+6);
      const fmt=x=>x.getDate()+'/'+(x.getMonth()+1);
      return { key: dom.toISOString().slice(0,10), label:'Semana '+fmt(dom)+'–'+fmt(sab) };
    }
    function toggleGrupo(ids, btn){
      const todasOn = ids.every(id=>selCels.has(id));
      ids.forEach(id=>{
        const row=document.querySelector('.cel[data-id="'+id+'"]');
        if(todasOn){ selCels.delete(id); if(row){ row.classList.remove('on'); row.querySelector('.box').textContent=''; } }
        else { selCels.add(id); if(row){ row.classList.add('on'); row.querySelector('.box').textContent='✓'; } }
      });
      updateCelsMeta(); refreshMarkBtns();
    }
    // liga o estado "on" nos botões de mês/semana conforme o grupo esteja todo marcado
    const _grupos=[]; // {ids, btn}
    function refreshMarkBtns(){
      _grupos.forEach(g=>{ g.btn.classList.toggle('on', g.ids.length>0 && g.ids.every(id=>selCels.has(id))); });
    }

    async function carregarCelebracoes(){
      const box=$('cels');
      box.innerHTML='<div class="cels-empty">Carregando celebrações…</div>';
      let data, error;
      try {
        const resp = await Promise.race([
          sb.rpc('acolitos_ausencia_publica_celebracoes'),
          new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), 12000))
        ]);
        data = resp.data; error = resp.error;
      } catch(e){ error = e; }
      box.innerHTML=''; _grupos.length=0;
      if(error){
        const w=document.createElement('div'); w.className='cels-empty';
        w.appendChild(document.createTextNode('Não foi possível carregar as celebrações (falha de conexão). '));
        const a=document.createElement('a'); a.href=''; a.textContent='Tentar de novo';
        a.style.cssText='color:var(--gold);text-decoration:underline;';
        a.onclick=(ev)=>{ ev.preventDefault(); carregarCelebracoes(); };
        w.appendChild(a); box.appendChild(w); return;
      }
      if(!Array.isArray(data) || !data.length){
        box.innerHTML='<div class="cels-empty">Nenhuma celebração futura cadastrada.</div>'; return;
      }

      // agrupa por mês, depois por semana (data já vem ordenada por data/horario)
      const meses=new Map(); // 'YYYY-MM' -> { label, semanas: Map(semKey -> {label, itens[]}) }
      data.forEach(c=>{
        const dt=new Date(c.data+'T00:00:00');
        const mk=c.data.slice(0,7);
        if(!meses.has(mk)){
          meses.set(mk, { label: dt.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}), semanas:new Map() });
        }
        const sem=grupoKeySemana(dt);
        const M=meses.get(mk);
        if(!M.semanas.has(sem.key)) M.semanas.set(sem.key, { label:sem.label, itens:[] });
        M.semanas.get(sem.key).itens.push(c);
      });

      meses.forEach(M=>{
        const idsMes=[];
        // cabeçalho do mês
        const hMes=document.createElement('div'); hMes.className='cel-mes';
        const tit=document.createElement('span'); tit.className='mtit';
        tit.textContent=M.label.charAt(0).toUpperCase()+M.label.slice(1);
        const bMes=document.createElement('button'); bMes.className='mark-btn'; bMes.textContent='✓ marcar mês';
        hMes.append(tit,bMes); box.appendChild(hMes);

        M.semanas.forEach(S=>{
          const idsSem=S.itens.map(c=>c.id); idsMes.push(...idsSem);
          const hSem=document.createElement('div'); hSem.className='cel-sem';
          const st=document.createElement('span'); st.className='stit'; st.textContent=S.label;
          const bSem=document.createElement('button'); bSem.className='mark-btn'; bSem.textContent='✓ marcar semana';
          hSem.append(st,bSem); box.appendChild(hSem);
          bSem.onclick=()=>toggleGrupo(idsSem, bSem);
          _grupos.push({ ids:idsSem, btn:bSem });

          S.itens.forEach(c=>{
            const lab=celLabel(c);
            const row=document.createElement('div'); row.className='cel'; row.dataset.id=c.id;
            row.innerHTML='<div class="box"></div><div class="lab"><div class="d1"></div><div class="d2"></div></div>';
            row.querySelector('.d1').textContent=lab.d1;
            row.querySelector('.d2').textContent=lab.d2;
            row.onclick=()=>{
              if(selCels.has(c.id)){ selCels.delete(c.id); row.classList.remove('on'); row.querySelector('.box').textContent=''; }
              else { selCels.add(c.id); row.classList.add('on'); row.querySelector('.box').textContent='✓'; }
              updateCelsMeta(); refreshMarkBtns();
            };
            box.appendChild(row);
          });
        });
        bMes.onclick=()=>toggleGrupo(idsMes, bMes);
        _grupos.push({ ids:idsMes, btn:bMes });
      });
      updateCelsMeta(); refreshMarkBtns();
    }
```

- [ ] **Step 3: Verificar no navegador**

Servir e abrir. Confirmar:
1. As celebrações aparecem sob cabeçalhos de **mês** (ex.: "Julho de 2026") e sub-cabeçalhos de **semana** ("Semana 13/7–19/7").
2. "✓ marcar semana" marca todas as celebrações daquela semana; tocar de novo desmarca todas.
3. "✓ marcar mês" marca/desmarca o mês inteiro; o botão fica dourado ("on") quando o grupo está todo marcado, e volta ao normal se você desmarcar um item individual.
4. Contador embaixo ("N celebração(ões) selecionada(s)") acompanha.

Expected: todos os 4 pontos OK.

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/ausencias-publica.html
git commit -m "feat(acolitos): ausência pública — celebrações agrupadas por mês/semana com marcar em massa"
```

---

## Task 4: Tutorial guiado (coach-marks) + botão "Ver tutorial"

Overlay de balões numerados guiando ① nome → ② celebrações → ③ seus dados → ④ Enviar. Self-contained, sem libs. Só aparece sozinho na 1ª visita; reabrível pelo botão.

**Files:**
- Modify: `projetos/acolitos/ausencias-publica.html`

**Interfaces:**
- Consumes: elementos com `id` (`busca`, `cels`, `informante`, `enviar`), `$()`.
- Produces: função `startTour()`; nada consumido por outras tasks.

- [ ] **Step 1: CSS do tour**

No `<style>`, antes de `/* Tela de sucesso */` (linha ~92), adicionar:

```css
    /* Tutorial (coach-marks) */
    #tourBackdrop{ position:fixed; inset:0; background:rgba(0,0,0,.62); z-index:80; display:none; }
    #tourBackdrop.show{ display:block; }
    #tourRing{ position:absolute; border:2px solid var(--gold-light); border-radius:14px;
      box-shadow:0 0 0 4000px rgba(0,0,0,.62); transition:all .25s ease; pointer-events:none; }
    #tourTip{ position:absolute; max-width:280px; background:linear-gradient(180deg,var(--surface),#241019);
      border:1px solid var(--gold-dim); border-radius:14px; padding:14px 15px; z-index:82;
      box-shadow:0 14px 40px rgba(0,0,0,.6); transition:all .25s ease; }
    #tourTip .tnum{ font-family:'Sora',sans-serif; font-size:11px; color:var(--gold-light); font-weight:800; letter-spacing:.4px; }
    #tourTip .ttxt{ font-size:13.5px; line-height:1.5; margin:5px 0 12px; color:var(--text); }
    #tourTip .trow{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
    #tourTip .tskip{ background:none; border:none; color:var(--muted); font-size:12.5px; cursor:pointer; font-family:inherit; }
    #tourTip .tnext{ border:none; border-radius:10px; padding:9px 16px; font-family:'Sora',sans-serif;
      font-weight:800; font-size:13px; cursor:pointer; color:#2a1500;
      background:linear-gradient(160deg,var(--gold-light),var(--gold)); }
    .help-btn{ display:inline-flex; align-items:center; gap:6px; margin:0 auto; cursor:pointer;
      background:#3a1c24; border:1px solid var(--gold-dim); color:var(--gold-light);
      border-radius:20px; padding:6px 13px; font-size:12px; font-weight:700; font-family:'Sora',sans-serif; }
```

- [ ] **Step 2: HTML — botão "Ver tutorial" e nós do tour**

Dentro de `.top`, logo após o `<p class="sub">...</p>` (linha ~104), adicionar:

```html
        <button id="verTutorial" class="help-btn" type="button">❔ Ver tutorial</button>
```

Antes de `<!-- supabase-js ... -->` (linha ~140), adicionar os nós do overlay:

```html
  <div id="tourBackdrop"><div id="tourRing"></div></div>
  <div id="tourTip" style="display:none;">
    <div class="tnum" id="tourNum"></div>
    <div class="ttxt" id="tourTxt"></div>
    <div class="trow"><button class="tskip" id="tourSkip">Pular</button><button class="tnext" id="tourNext">Próximo</button></div>
  </div>
```

- [ ] **Step 3: JS do tour**

Antes da chamada final `carregarCelebracoes();` (linha ~271), adicionar:

```js
    // ── TUTORIAL (coach-marks) ──
    const TOUR=[
      { el:'busca',      n:'PASSO 1 DE 4', t:'Comece digitando o nome do coroinha que vai faltar. Toque no nome que aparecer para adicionar — pode adicionar vários.' },
      { el:'cels',       n:'PASSO 2 DE 4', t:'Marque as celebrações em que ele vai faltar. Use "marcar mês" ou "marcar semana" para selecionar vários de uma vez.' },
      { el:'informante', n:'PASSO 3 DE 4', t:'Preencha seu nome, o motivo e um contato. São obrigatórios para a equipe confirmar.' },
      { el:'enviar',     n:'PASSO 4 DE 4', t:'Pronto! Toque em "Enviar aviso" e a equipe recebe a ausência para confirmar.' }
    ];
    let tourI=0;
    function posTour(){
      const step=TOUR[tourI]; const target=$(step.el); if(!target) return endTour();
      target.scrollIntoView({block:'center',behavior:'smooth'});
      // espera o scroll assentar antes de medir
      setTimeout(()=>{
        const r=target.getBoundingClientRect();
        const ring=$('tourRing'), tip=$('tourTip');
        ring.style.left=(r.left-6)+'px'; ring.style.top=(r.top-6)+'px';
        ring.style.width=(r.width+12)+'px'; ring.style.height=(r.height+12)+'px';
        $('tourNum').textContent=step.n; $('tourTxt').textContent=step.t;
        $('tourNext').textContent = tourI===TOUR.length-1 ? 'Entendi' : 'Próximo';
        tip.style.display='block';
        // posiciona o balão abaixo do alvo (ou acima se não couber)
        const th=tip.offsetHeight||150, below=r.bottom+12, fits=below+th < window.innerHeight;
        tip.style.top = (fits ? below : Math.max(12, r.top-th-12)) + 'px';
        const left=Math.min(Math.max(12, r.left), window.innerWidth-tip.offsetWidth-12);
        tip.style.left=left+'px';
      }, 260);
    }
    function startTour(){ tourI=0; $('tourBackdrop').classList.add('show'); posTour(); }
    function endTour(){
      $('tourBackdrop').classList.remove('show'); $('tourTip').style.display='none';
      try{ localStorage.setItem('aus_tutorial_visto','1'); }catch(e){}
    }
    $('tourNext').onclick=()=>{ if(tourI>=TOUR.length-1) return endTour(); tourI++; posTour(); };
    $('tourSkip').onclick=endTour;
    $('verTutorial').onclick=startTour;
    // auto-abre na 1ª visita
    try{ if(!localStorage.getItem('aus_tutorial_visto')) setTimeout(startTour, 500); }catch(e){}
```

- [ ] **Step 4: Verificar no navegador**

Servir com o `localStorage` limpo (Playwright: abrir em contexto novo / limpar storage). Confirmar:
1. Na 1ª visita, o tour abre sozinho após ~0,5s, destacando o campo de nome (Passo 1 de 4).
2. "Próximo" avança para celebrações → dados → Enviar; o anel/balão reposiciona em cada alvo.
3. No último passo o botão vira "Entendi"; ao tocar, o overlay fecha.
4. Recarregar a página: o tour **não** abre sozinho (localStorage marcou visto).
5. Tocar em "❔ Ver tutorial" reabre o tour do Passo 1.
6. Em viewport de celular (largura ~390px), o balão não estoura a tela lateralmente.

Expected: todos os 6 pontos OK.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/ausencias-publica.html
git commit -m "feat(acolitos): ausência pública — tutorial guiado (coach-marks) reabrível"
```

---

## Verificação final (fim a fim)

- [ ] Fluxo completo: abrir /ausencias, seguir o tour, adicionar 2 pessoas, marcar um mês inteiro (>30 celebrações), preencher informante/motivo/contato, Enviar → tela de sucesso "N aviso(s) enviado(s)".
  - > Se a migration da Task 1 **ainda não** foi aplicada no banco, marcar >30 celebrações retornará `muitos_itens` (esperado até o deploy). Testar o "mês inteiro >30" de fim a fim só depois de aplicar a migration; até lá, validar com ≤30.
- [ ] Conferir no app interno (`ausencias.html`, logado como aprovador) que os avisos caíram na fila pendente — **usar aviso descartável** ("ZZ TESTE"), nunca membros reais (regra: não mexer em dados reais).
- [ ] Rodar o /code-review no diff antes de considerar concluído.

---

## Self-review (feito na escrita)

- **Cobertura do spec:** Bloco 1 (nome)→Task 2; Bloco 2 (tutorial)→Task 4; Bloco 3 (mês/semana + cap)→Task 3 + Task 1; Bloco 4 (fora de escopo) respeitado (sem novo módulo, sem mexer em auth/fila). ✔
- **Placeholders:** nenhum "TODO/TBD"; todo passo com código real. ✔
- **Consistência de tipos:** `selMembros` (Map), `selCels` (Set), `_grupos` [{ids,btn}], `celLabel()`, `updateCelsMeta()`, `refreshMarkBtns()`, `toggleGrupo(ids,btn)`, `grupoKeySemana(d)`, `flashAdd(msg)`, `startTour()` — nomes usados de forma consistente entre tasks. ✔
- **Ordem:** Task 1 (migration, independente) → 2 → 3 → 4. Tasks 2–4 tocam o mesmo arquivo mas em regiões distintas (seleção de nome / lista de celebrações / overlay), sem conflito lógico. ✔
