-- Link de redefinição de senha com uso único, enviado ao WhatsApp já cadastrado.
-- O banco conserva somente o hash do token; nunca a senha escolhida.
create table if not exists public.acolitos_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  token_hash text unique,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz,
  revoked_at timestamptz
);

create index if not exists acolitos_password_resets_ip_created
  on public.acolitos_password_resets (ip_hash, created_at desc);
create index if not exists acolitos_password_resets_user_created
  on public.acolitos_password_resets (user_id, created_at desc);

alter table public.acolitos_password_resets enable row level security;
revoke all on public.acolitos_password_resets from anon, authenticated;
grant all on public.acolitos_password_resets to service_role;

create or replace function public.acolitos_membro_por_usuario(p_usuario text)
returns table(membro_id uuid, user_id uuid)
language sql stable security definer
set search_path = public, auth
as $$
  select m.id, m.user_id
  from public.acolitos_membros m
  join auth.users u on u.id = m.user_id
  where lower(split_part(u.email, '@', 1)) = lower(p_usuario)
  limit 1;
$$;
revoke all on function public.acolitos_membro_por_usuario(text) from public, anon, authenticated;
grant execute on function public.acolitos_membro_por_usuario(text) to service_role;
