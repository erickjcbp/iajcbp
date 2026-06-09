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
- Brasão `midia/logos/brasao-pastoral.png` em destaque no hero e no favicon.

## Seções (scroll vertical, nesta ordem)

1. **Hero** — fundo com foto (de `midia/landing/`) + vinheta + ornamento dourado.
   Brasão, nome **"Somos do Altar"**, subtítulo "Pastoral dos Coroinhas · Paróquia Jesus
   Cristo Bom Pastor", **tagline espiritual** (ex.: "Servir ao altar é servir a Cristo"),
   e dois botões: **[Quero servir]** e **[Conhecer a pastoral]** (âncora pro restante).
2. **Quem somos** — parágrafo curto de missão/espiritualidade + um versículo (ex.: Sl 84,11).
3. **O chamado (3 pilares)** — Servir · Formar-se · Fraternidade, cada um com um ícone
   tirado de `midia/elementos/` (ex.: cálice, cruz, sino) e uma frase curta.
4. **Galeria** — grade responsiva de fotos de `midia/landing/` (molduras douradas + vinheta).
5. **Nossas missas** — convite a participar, listando as comunidades e horários:
   Matriz 7h · 9h · 17h · 19h; Santo Antônio 18h30. (Dias a confirmar pelo usuário.)
6. **Como participar (CTA de recrutamento)** — botões: **WhatsApp** (abre conversa),
   **Instagram** (@somosdoaltar), **Quero servir** (→ `login.html`, aba de cadastro).
7. **Rodapé** — Paróquia · Limeira/SP · Instagram; e links discretos: "Acesso dos coroinhas"
   (→ `login.html`) e "Informar ausência" (→ `/ausencias`).

## CTAs e links

- **Quero servir** → `login.html` (aba "Quero servir"/cadastro já existente). Opcional:
  pequena melhoria no `login.html` para abrir já na aba cadastro via `?cadastro` ou `#cadastro`.
- **WhatsApp** → `https://wa.me/<NUMERO>` (número a fornecer).
- **Instagram** → `https://instagram.com/somosdoaltar` (confirmar).
- **Informar ausência** (rodapé) → `/ausencias`.

## Assets

- A página consome as imagens presentes em `midia/landing/` (o usuário vai adicioná-las).
  Os nomes/arquivos reais são fiados na implementação (o controller checa o que existe em
  `midia/landing/` e referencia). Enquanto não houver fotos, usa placeholders elegantes
  (blocos com ornamento) que não quebram o layout (com `onerror` escondendo `<img>` faltante).
- Marca: `brasao-pastoral.png` e logos em `midia/logos/`.

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
