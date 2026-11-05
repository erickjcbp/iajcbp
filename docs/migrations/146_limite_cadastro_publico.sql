-- Limite de cadastros públicos por IP (api/_limite-cadastro.js): signup-acolito e signup-familia
-- criam conta já confirmada, sem login. Só guarda o HASH do IP; só a service_role lê e grava.
begin;
create table if not exists public.acolitos_signup_tentativas (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists acolitos_signup_tentativas_ip on public.acolitos_signup_tentativas (ip_hash, created_at desc);
alter table public.acolitos_signup_tentativas enable row level security;
revoke all on public.acolitos_signup_tentativas from public, anon, authenticated;
grant all on public.acolitos_signup_tentativas to service_role;
-- Linhas com mais de um dia não servem para nada.
delete from public.acolitos_signup_tentativas where created_at < now() - interval '1 day';
commit;
