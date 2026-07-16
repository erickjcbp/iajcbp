-- Acólitos — inscrições de push (um aparelho por linha, ligado ao user dono)
create table if not exists public.acolitos_push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  criado_em timestamptz not null default now(),
  ultima_ok timestamptz
);
alter table public.acolitos_push_subs enable row level security;

-- o dono gerencia só os próprios aparelhos (o ENVIO usa service role e ignora RLS)
do $$ begin
  if not exists (select 1 from pg_policies
    where tablename='acolitos_push_subs' and policyname='Push subs do próprio dono') then
    create policy "Push subs do próprio dono" on public.acolitos_push_subs
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
