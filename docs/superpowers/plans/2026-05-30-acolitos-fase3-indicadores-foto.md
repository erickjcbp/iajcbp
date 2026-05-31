# Acólitos — Fase 3: Camada de Indicadores + Foto de Perfil

**Data:** 2026-05-30 · **Projeto:** iajcbp · **Spec base:** `specs/2026-05-30-acolitos-coroinhas-design.md`

## Objetivo
Criar a fundação de dados que destrava dashboards e planilha (F4/F5): cálculo de
frequência a partir da chamada/ausências, e foto de perfil editável (Storage).
Decisão de escopo: upload ligado **pela equipe** (ficha em `membros.html`) nesta fase;
upload pelo próprio membro entra na F4 junto da reconstrução do `index.html`.

## Entregáveis
1. **`docs/migrations/004_indicadores_foto.sql`**
   - View `acolitos_frequencia` (security_invoker), 1 linha/membro:
     total_escalas, servidas, faltas_just, faltas_nao_just, atrasos, pendentes,
     taxa (servidas ÷ realizadas ×100), ultima_participacao.
   - Bucket `avatars` (público p/ leitura) + políticas: escrita por equipe ou dono.
2. **`shared.js`**
   - `fetchFrequencia(membroId?)` → objeto único ou mapa {membro_id: row}.
   - `uploadAvatar(file, membro)` → sobe ao bucket, grava `foto_url`, retorna URL.
   - `buildAvatarEl(foto, role, size, opts)` ganha `opts.editable` → badge 📷 + input
     file (accept image/*) que chama uploadAvatar e troca a imagem.
3. **`membros.html`**
   - Avatar da ficha editável (equipe sobe/edita foto).
   - Nova aba **Frequência** (KPIs read-only via fetchFrequencia). Gráfico 6 meses
     e aba Evolução ficam para F6.

## Fora de escopo (fases seguintes)
- Upload pelo próprio membro + KPIs no dashboard → F4.
- Gráfico de frequência + timeline de evolução → F6.

## Teste manual
- Rodar 004 no Supabase. Abrir ficha de um membro com escalas já chamadas →
  aba Frequência mostra números coerentes. Subir foto pela ficha → aparece com
  patch sobreposto no card e na ficha.
