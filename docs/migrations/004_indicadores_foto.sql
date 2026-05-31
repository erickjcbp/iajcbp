-- Acólitos Fase 3 — Camada de Indicadores (frequência) + Foto de Perfil (Storage)
-- Executar no Supabase Dashboard da conta iajcbp APÓS 003_acolitos_fase2.sql
-- SQL Editor → New query → colar tudo → Run

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE A — VIEW DE FREQUÊNCIA
-- Agrega acolitos_escalas + acolitos_celebracoes em 1 linha por membro.
-- Fonte da verdade: status gravado por chamada.html e ausencias.html.
-- ══════════════════════════════════════════════════════════════════════════

create or replace view public.acolitos_frequencia
with (security_invoker = on) as
select
  e.membro_id,
  count(*)                                                          as total_escalas,
  count(*) filter (where e.status in ('presente','atrasado'))       as servidas,
  count(*) filter (where e.status = 'ausente_justificado')          as faltas_just,
  count(*) filter (where e.status = 'ausente')                      as faltas_nao_just,
  count(*) filter (where e.status = 'atrasado')                     as atrasos,
  count(*) filter (where e.status = 'escalado')                     as pendentes,
  round(
    100.0 * count(*) filter (where e.status in ('presente','atrasado'))
    / nullif(count(*) filter (
        where e.status in ('presente','atrasado','ausente_justificado','ausente')
      ), 0)
  )                                                                 as taxa,
  max(c.data) filter (where e.status in ('presente','atrasado'))    as ultima_participacao
from public.acolitos_escalas e
join public.acolitos_celebracoes c on c.id = e.celebracao_id
group by e.membro_id;

grant select on public.acolitos_frequencia to authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE B — STORAGE: BUCKET DE AVATARES
-- ══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Leitura pública (qualquer um vê as fotos)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Avatars leitura publica'
  ) then
    create policy "Avatars leitura publica" on storage.objects
      for select using (bucket_id = 'avatars');
  end if;
end $$;

-- Escrita: equipe (qualquer membro) OU dono (pasta = seu uid)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Avatars insere equipe ou dono'
  ) then
    create policy "Avatars insere equipe ou dono" on storage.objects
      for insert with check (
        bucket_id = 'avatars' and (
          acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
          or (storage.foldername(name))[1] = auth.uid()::text
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Avatars atualiza equipe ou dono'
  ) then
    create policy "Avatars atualiza equipe ou dono" on storage.objects
      for update using (
        bucket_id = 'avatars' and (
          acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
          or (storage.foldername(name))[1] = auth.uid()::text
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Avatars remove equipe ou dono'
  ) then
    create policy "Avatars remove equipe ou dono" on storage.objects
      for delete using (
        bucket_id = 'avatars' and (
          acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
          or (storage.foldername(name))[1] = auth.uid()::text
        )
      );
  end if;
end $$;
