-- 007 — Busca pública de ausências ignora acentos (2026-06-09)
-- Mantém os nomes reais intactos (com acento); compara unaccent dos dois lados.
-- Ex.: "livia" encontra "Lívia" e vice-versa. unaccent vive no schema public.

create extension if not exists unaccent;

create or replace function public.acolitos_ausencia_publica_buscar(p_q text)
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.nome), '[]'::jsonb)
  from (
    select id, nome
    from public.acolitos_membros
    where status='ativo'
      and length(btrim(coalesce(p_q,''))) >= 2
      and unaccent(nome) ilike '%' || unaccent(replace(replace(replace(btrim(p_q),'\','\\'),'%','\%'),'_','\_')) || '%'
    order by nome
    limit 20
  ) s;
$$;
