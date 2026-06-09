# Landing pública da Pastoral — `/pastoral` (Somos do Altar)

**Data:** 2026-06-09
**Status:** design aprovado, aguardando plano de implementação

## Objetivo

Landing pública e intuitiva sobre a pastoral dos coroinhas ("Somos do Altar",
Paróquia Jesus Cristo Bom Pastor — Limeira/SP). Mix **institucional + recrutamento**:
apresenta a pastoral com beleza (estética católica/barroca/espiritual) e convida
crianças/jovens e famílias a participar, com caminhos claros de contato.

## Rota & técnica

- Arquivo único estático `projetos/acolitos/pastoral.html` — **sem** `shared.js`, sem login,
  sem dependência de banco. Mobile-first.
- Rewrite no `vercel.json` (host `coroinhas.jcbplimeira.com.br`):
  `/pastoral` → `/projetos/acolitos/pastoral.html`. Mantém a URL limpa. Não conflita
  (hoje só existem `/pastorais` do projeto central e `/acolitos`). A raiz `/` segue
  redirecionando pro login.
- Sem JS de dados; só interações leves (scroll suave, abrir links). Fontes via Google Fonts.

## Estética (barroco / litúrgico / espiritual)

- Paleta: vinho profundo / ox-blood de fundo, **dourado** nos acentos, filetes e ornamentos.
  Reusa as variáveis de cor do app (vinho+dourado) para coerência.
- Tipografia: serifada de display nos títulos (ex.: **Cormorant Garamond** ou EB Garamond)
  para o ar litúrgico/barroco; sans (Inter) no corpo para legibilidade.
- Ornamentos: fleurons/cruzes (✠ ✦) como divisores; molduras douradas finas; vinheta
  quente nas fotos; brilhos suaves. **Sem** estética flat/gamer.
- **Tratamento das fotos (NUNCA "secas"/cruas):** toda imagem entra com moldura dourada
  fina (1px), cantos levemente arredondados (~10–14px), **sombra suave** (drop-shadow
  difusa) e vinheta/gradiente quente sutil sobreposto. Sutileza acima de tudo — molduras
  e sombras discretas, sem exagero. Vale leve realce no hover na galeria.
- Brasão `midia/logos/brasao-pastoral.png` em destaque no hero e no favicon.

## Seções (scroll vertical, nesta ordem)

1. **Hero** — fundo com foto (de `midia/landing/`) + vinheta + ornamento dourado.
   Brasão, nome **"Somos do Altar"**, subtítulo "Pastoral dos Coroinhas · Paróquia Jesus
   Cristo Bom Pastor", **tagline espiritual** (ex.: "Servir ao altar é servir a Cristo"),
   e botões: **[Quero servir]**, **[Conhecer a pastoral]** (âncora pro restante) e um botão
   mais discreto **[📷 Álbum de fotos]** → pasta pública do Google Drive
   (`https://drive.google.com/drive/folders/1smBE0XjdZMJ0W8qwBK9Sjdz851e-GcGD?usp=drive_link`),
   `target="_blank"`. (Também repetido como "Ver todas as fotos" no fim da Galeria.)
2. **Quem somos** — parágrafo curto de missão/espiritualidade + um versículo (ex.: Sl 84,11).
3. **O chamado (3 pilares)** — Servir · Formar-se · Fraternidade, cada um com um ícone
   tirado de `midia/elementos/` (ex.: cálice, cruz, sino) e uma frase curta.
4. **Galeria** — grade responsiva de fotos de `midia/landing/` (molduras douradas + vinheta).
5. **Nosso app** — destaque do aplicativo próprio dos coroinhas: jornada gamificada
   (níveis, missões/XP, conquistas/medalhas, casas), escalas e agenda, chamada/presença.
   Tom: "a vida no altar também acontece no seu bolso". Ícone do app (`icon-192.png`),
   3–4 destaques curtos com ícones, e botão **[Acessar o app]** (→ `login.html`).
6. **Nossas missas** — convite a participar, listando as comunidades e horários:
   Matriz 7h · 9h · 17h · 19h; Santo Antônio 18h30. (Dias a confirmar pelo usuário.)
7. **Como participar (CTA de recrutamento)** — botões: **WhatsApp** (abre conversa),
   **Instagram** (@somosdoaltar), **Quero servir** (→ `login.html`, aba de cadastro).
8. **Rodapé** — Paróquia · Limeira/SP · Instagram; e links discretos: "Acesso dos coroinhas"
   (→ `login.html`) e "Informar ausência" (→ `/ausencias`).

## CTAs e links

- **Quero servir** → `login.html` (aba "Quero servir"/cadastro já existente). Opcional:
  pequena melhoria no `login.html` para abrir já na aba cadastro via `?cadastro` ou `#cadastro`.
- **WhatsApp** → `https://wa.me/<NUMERO>` (número a fornecer).
- **Instagram** → `https://instagram.com/somosdoaltar` (confirmar).
- **Informar ausência** (rodapé) → `/ausencias`.

## Assets

- O usuário adicionou ~20 fotos em `midia/landing/` **em resolução cheia (5–16 MB cada,
  ~350 MB no total)** — inviável para web.
- **Otimização obrigatória (tarefa do plano):** gerar versões web em `midia/landing/web/`
  com `sips` (nativo do macOS): redimensionar para no máx. ~1600px no maior lado, qualidade
  ~80, alvo < ~300 KB cada. Os **originais NÃO vão pro deploy** (entram no `.gitignore`;
  só as versões `web/` são commitadas/servidas). Remover o duplicado (`_DSC7307 2.JPG`).
- **Curadoria:** escolher ~1 foto forte para o hero e ~6–8 para a galeria (o usuário pode
  trocar depois). A página referencia nomes fixos das versões otimizadas.
- Placeholders elegantes (com `onerror` escondendo `<img>` faltante) evitam layout quebrado
  se alguma imagem faltar.
- Marca: `brasao-pastoral.png` e logos em `midia/logos/`; ícone do app `icon-192.png`.

## Conteúdo a fornecer (não bloqueia o desenho; entram como slots)

- Número do **WhatsApp**.
- Confirmar nome **"Somos do Altar"** e a **tagline** do hero.
- **Dias** das missas (só temos os horários).
- URL do Instagram (assumido `instagram.com/somosdoaltar`).
- Fotos em `midia/landing/`.

## Fora de escopo (YAGNI)

- Depoimentos, história longa da pastoral, página do padroeiro (São Tarcísio) — podem
  entrar depois como seções adicionais se desejado.
- Formulário de interesse próprio (o "Quero servir" reaproveita o cadastro do app).
- i18n, blog, área administrativa.
