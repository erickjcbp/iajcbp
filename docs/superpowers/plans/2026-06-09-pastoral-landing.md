# Landing da Pastoral `/pastoral` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Landing pública institucional + recrutamento da pastoral "Somos do Altar" em `coroinhas.jcbplimeira.com.br/pastoral`, com estética católica/barroca (vinho+dourado, serifada litúrgica), fotos tratadas com sutileza, seção do app e CTAs (Quero servir / WhatsApp / Instagram).

**Architecture:** Página única estática `projetos/acolitos/pastoral.html` (sem shared.js, sem login, sem banco). Imagens de `midia/landing/` otimizadas para `midia/landing/web/` (originais fora do deploy). Rota via rewrite no `vercel.json`.

**Tech Stack:** HTML/CSS estático, Google Fonts (Cormorant Garamond + Inter), `sips` (macOS) para otimizar imagens, deploy Vercel (do root).

**Spec:** `docs/superpowers/specs/2026-06-09-pastoral-landing-design.md`

**Convenções:** sem test-runner — verificação = checagem no browser + `curl`/tamanho de arquivos. Trabalha em `main`; implementadores commitam local, **push só na Task de validação**. Deploy do **root**. **A Task 2 (construção do HTML) DEVE usar a skill `frontend-design`** para a qualidade visual.

**Conteúdo (constantes no topo do `<script>`/HTML, valores a confirmar pelo usuário):**
- `WHATSAPP = '5519999999999'` (placeholder — substituir pelo número real)
- Tagline hero: `"Servir ao altar é servir a Cristo"`
- Instagram: `https://instagram.com/somosdoaltar`
- Missas: Matriz 7h · 9h · 17h · 19h; Santo Antônio 18h30 (dias: "aos finais de semana" até confirmar)

---

## File Structure

- **Create** `midia/landing/web/*.jpg` — versões otimizadas das fotos (servidas).
- **Modify** `.gitignore` (raiz) — ignorar originais pesados de `midia/landing/`, manter `web/`.
- **Create** `projetos/acolitos/pastoral.html` — a landing.
- **Modify** `vercel.json` — rewrite `/pastoral`.
- **Modify** `projetos/acolitos/login.html` — abrir aba "Quero servir" via `#cadastro` (deep-link do CTA).

---

## Task 1: Otimizar e curar as imagens

**Files:**
- Create: `midia/landing/web/` (imagens otimizadas)
- Modify: `.gitignore`

- [ ] **Step 1: Remover o duplicado**

```bash
cd /Users/erickmartins/iajcbp
rm -f "midia/landing/_DSC7307 2.JPG"
```

- [ ] **Step 2: Gerar versões web (máx 1600px, comprimidas) com sips**

```bash
cd /Users/erickmartins/iajcbp
mkdir -p midia/landing/web
for f in midia/landing/*.[jJ][pP]*[gG]; do
  base=$(basename "$f"); name="${base%.*}"
  sips -s format jpeg -s formatOptions 72 -Z 1600 "$f" --out "midia/landing/web/${name}.jpg" >/dev/null
done
echo "=== tamanhos resultantes (KB) ==="
ls -la midia/landing/web/ | awk '{print $5, $9}'
```
Esperado: cada arquivo em `web/` com algumas centenas de KB (não MB). Se algum passar de ~600KB, baixar para `-Z 1400` ou qualidade `60`.

- [ ] **Step 3: Curar (escolher hero + galeria)**

Abrir as imagens otimizadas (agora pequenas) e escolher:
- **1 foto de hero** — horizontal, com profundidade/altar, boa para fundo com texto por cima.
- **6 a 8 fotos** para a galeria (variedade: celebração, fraternidade, detalhes).

Renomear as escolhidas para nomes estáveis (facilita referenciar no HTML):
```bash
cd /Users/erickmartins/iajcbp/midia/landing/web
# exemplo — ajuste os nomes de origem conforme a curadoria:
# cp _DSC7257.jpg hero.jpg ; cp _DSC6887.jpg g1.jpg ; ... até g8.jpg
```
Resultado: `hero.jpg` + `g1.jpg`…`g8.jpg` em `midia/landing/web/`. (Anote os nomes usados — a Task 2 referencia exatamente esses.)

- [ ] **Step 4: Ignorar os originais pesados, manter as versões web**

Acrescentar ao `.gitignore` da raiz (criar a seção se não existir):
```
# Fotos originais pesadas da landing — só as versões web/ vão pro deploy
midia/landing/*.JPG
midia/landing/*.jpg
midia/landing/*.JPEG
midia/landing/*.jpeg
!midia/landing/web/
```

- [ ] **Step 5: Verificar que só as web entram no git e commitar**

```bash
cd /Users/erickmartins/iajcbp
git add .gitignore midia/landing/web
git status --short | grep 'midia/landing' | head
du -sh midia/landing/web
```
Esperado: apenas arquivos em `midia/landing/web/` staged; `du` na casa de poucos MB (não centenas).
```bash
git commit -m "chore(landing): fotos otimizadas para web (originais fora do deploy)"
```

---

## Task 2: Construir `pastoral.html` (USAR skill frontend-design)

**Files:**
- Create: `projetos/acolitos/pastoral.html`

> **Antes de codar, invoque a skill `frontend-design`** e siga-a para a qualidade visual.
> O conteúdo, ordem das seções, links e tratamento abaixo são **requisitos** (não sugestões).

- [ ] **Step 1: Estrutura base (head, fontes, tokens de cor, favicon, brasão)**

Criar `projetos/acolitos/pastoral.html` com:
- `<title>Somos do Altar — Pastoral dos Coroinhas | JCBP</title>`
- favicon e apple-touch-icon = `../../midia/logos/brasao-pastoral.png`
- Google Fonts: `Cormorant Garamond` (600/700, títulos) + `Inter` (400/500/600, corpo).
- Tokens (reusar a linguagem vinho+dourado): `--wine:#1a0a0e; --wine2:#26101a; --gold:#8a6a24; --gold-light:#ffd97a; --text:#f7ebe7; --muted:#c79aa0; --border:#5a3a3f;`
- Fundo: `radial-gradient(1200px 600px at 50% -10%, #3a1320, var(--wine) 55%)`.
- Mobile-first, container `max-width:920px` centralizado.

- [ ] **Step 2: CSS do tratamento das fotos (sutil — moldura+sombra+vinheta)**

Classe reutilizável aplicada a TODA foto (hero e galeria) — nunca imagem crua:
```css
.framed{ position:relative; border-radius:13px; overflow:hidden;
  border:1px solid rgba(255,217,122,.35);
  box-shadow:0 14px 40px rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.25); }
.framed::after{ content:''; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(120% 90% at 50% 0%, transparent 55%, rgba(20,6,10,.55) 100%); }
.framed img{ display:block; width:100%; height:100%; object-fit:cover; transition:transform .5s ease; }
.gallery a.framed:hover img{ transform:scale(1.05); }
```
Ornamento divisor reutilizável:
```css
.fleuron{ text-align:center; color:var(--gold); opacity:.7; margin:30px 0; letter-spacing:8px; font-size:15px; }
/* uso: <div class="fleuron">✦ ✠ ✦</div> */
```

- [ ] **Step 3: Hero**

- `.framed` de fundo com `midia/landing/web/hero.jpg` (use `<img ... onerror="this.closest('.framed').style.display='none'">` para não quebrar se faltar).
- Por cima (overlay): brasão (`../../midia/logos/brasao-pastoral.png`, ~84px), título **"Somos do Altar"** em Cormorant grande, subtítulo "Pastoral dos Coroinhas · Paróquia Jesus Cristo Bom Pastor — Limeira/SP", tagline `"Servir ao altar é servir a Cristo"`.
- Botões: **[Quero servir]** (`href="login.html#cadastro"`) destacado dourado; **[Conhecer a pastoral]** (`href="#quem-somos"`) contorno; e um terceiro, mais discreto, **[📷 Álbum de fotos]** (`href="https://drive.google.com/drive/folders/1smBE0XjdZMJ0W8qwBK9Sjdz851e-GcGD?usp=drive_link" target="_blank" rel="noopener"`).

- [ ] **Step 4: Seção "Quem somos" (#quem-somos)**

Parágrafo curto de missão/espiritualidade + um versículo em itálico (ex.: *"Prefiro um dia nos teus átrios a mil em qualquer outro lugar." — Sl 84,11*). Divisor `.fleuron` entre seções.

- [ ] **Step 5: Seção "O chamado" — 3 pilares**

Grade de 3 cards: **Servir**, **Formar-se**, **Fraternidade**, cada um com um ícone de `../../midia/elementos/` (ex.: `calice.png`, `biblia.png`/`cruz.png`, `sino.png` — `onerror` esconde) e uma frase de 1 linha.

- [ ] **Step 6: Seção "Galeria"**

Grade responsiva (CSS grid, `repeat(auto-fill,minmax(150px,1fr))`, gap 10px) de `.framed` com `g1.jpg`…`g8.jpg` de `midia/landing/web/` (cada `<a class="framed">` envolvendo `<img onerror=...>`). Hover com leve zoom (já no CSS do Step 2). Ao fim da grade, um botão/linha centralizado **[Ver todas as fotos]** → mesma pasta do Drive (`https://drive.google.com/drive/folders/1smBE0XjdZMJ0W8qwBK9Sjdz851e-GcGD?usp=drive_link`, `target="_blank" rel="noopener"`).

- [ ] **Step 7: Seção "Nosso app"**

Card destacado: ícone do app (`icon-192.png`, cantos arredondados, sombra), título "O altar também no seu bolso", texto curto e 3–4 mini-destaques com ícone: *Jornada & níveis*, *Missões e conquistas*, *Escalas e agenda*, *Casas e fraternidade*. Botão **[Acessar o app]** → `login.html`.

- [ ] **Step 8: Seção "Nossas missas"**

Dois blocos (Matriz / Santo Antônio) com os horários (Matriz 7h · 9h · 17h · 19h; Santo Antônio 18h30) e a linha "aos finais de semana" (texto editável). Convite: "Venha servir conosco".

- [ ] **Step 9: Seção "Como participar" (CTA)**

Três botões grandes: **WhatsApp** (verde, `href="https://wa.me/" + WHATSAPP` — definir `WHATSAPP` como constante JS no topo ou hardcode com comentário claro `<!-- TROCAR pelo número real -->`), **Instagram** (`https://instagram.com/somosdoaltar`, `target="_blank" rel="noopener"`), **Quero servir** (`login.html#cadastro`).

- [ ] **Step 10: Rodapé**

"Paróquia Jesus Cristo Bom Pastor — Limeira/SP" + Instagram; e links discretos: **Acesso dos coroinhas** (`login.html`) e **Informar ausência** (`/ausencias`).

- [ ] **Step 11: Verificar e commitar**

```bash
cd /Users/erickmartins/iajcbp/projetos/acolitos
node -e "const s=require('fs').readFileSync('pastoral.html','utf8');const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;console.log('{',o,'}',c)"
grep -c 'login.html#cadastro\|wa.me\|instagram.com/somosdoaltar\|/ausencias' pastoral.html
```
Esperado: chaves equilibradas; os links presentes.
```bash
git add projetos/acolitos/pastoral.html
git commit -m "feat(landing): pastoral.html — landing Somos do Altar (barroco, fotos tratadas, seção do app)"
```

---

## Task 3: Rota `/pastoral` no `vercel.json`

**Files:**
- Modify: `vercel.json` (chave `rewrites`, já existente após a feature de ausências)

- [ ] **Step 1: Adicionar o rewrite (irmão do `/ausencias`)**

No array `rewrites`, acrescentar:
```json
    { "source": "/pastoral",
      "has": [{ "type": "host", "value": "coroinhas.jcbplimeira.com.br" }],
      "destination": "/projetos/acolitos/pastoral.html" },
```
Validar e commitar:
```bash
cd /Users/erickmartins/iajcbp
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'));console.log('JSON OK')"
git add vercel.json && git commit -m "feat(landing): rota /pastoral (rewrite, host coroinhas)"
```

---

## Task 4: Deep-link do "Quero servir" no `login.html`

**Files:**
- Modify: `projetos/acolitos/login.html`

- [ ] **Step 1: Abrir a aba cadastro quando a URL tiver `#cadastro`**

No `<script>` do `login.html`, perto do final (onde `showScreen` está definido), adicionar:
```js
if (location.hash === '#cadastro') showScreen('cadastro');
```
Isso faz o botão "Quero servir" da landing cair direto na aba de cadastro.

- [ ] **Step 2: Commitar**

```bash
git add projetos/acolitos/login.html
git commit -m "feat(login): abrir aba 'Quero servir' via #cadastro (deep-link da landing)"
```

---

## Task 5: Validação + deploy

**Files:** (nenhum — push + checagem)

- [ ] **Step 1: Push**

```bash
cd /Users/erickmartins/iajcbp && git push origin main
```

- [ ] **Step 2: Conferir a rota servida**

```bash
sleep 10
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://coroinhas.jcbplimeira.com.br/pastoral
curl -s https://coroinhas.jcbplimeira.com.br/pastoral | grep -o 'Somos do Altar\|landing/web/hero\|login.html#cadastro\|wa.me' | sort -u
```
Esperado: HTTP 200; marcadores presentes.

- [ ] **Step 3: Conferir peso das imagens servidas**

```bash
for f in hero g1 g2; do
  curl -s -o /dev/null -w "$f %{size_download} bytes\n" "https://coroinhas.jcbplimeira.com.br/midia/landing/web/$f.jpg"
done
```
Esperado: cada imagem em centenas de KB (não MB).

- [ ] **Step 4: Olhar no browser (visual)**

Abrir `coroinhas.jcbplimeira.com.br/pastoral` no celular: hero com brasão+foto tratada, seções na ordem, fotos com moldura/sombra/vinheta (não cruas), botões funcionando (Quero servir cai na aba cadastro; WhatsApp/Instagram abrem; ausência no rodapé). Ajustar o que destoar.

- [ ] **Step 5: Atualizar memória**

Registrar em `project_acolitos_landing.md`: rota `/pastoral`, arquivo `pastoral.html`, estética barroca, fotos otimizadas em `midia/landing/web/` (originais no .gitignore), seção do app, CTAs. Ligar a `[[project_acolitos_ausencias_publica]]`.

---

## Pendências de conteúdo (lembrar ao usuário na validação)
- Número real do **WhatsApp** (hoje placeholder).
- **Dias** das missas.
- Confirmar **tagline** e textos institucionais.
