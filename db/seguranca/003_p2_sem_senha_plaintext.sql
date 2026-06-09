-- P2 (Opção B) — Acólitos: parar de guardar senha em texto puro (2026-06-09)
-- A senha "de verdade" vive só no Supabase Auth (hash bcrypt). A cópia plaintext
-- em acolitos_logins deixa de existir. Superadmin redefine (mostra 1x), não relê.

-- 1) login_registrar deixa de escrever senha (assinatura mantida p/ compat)
create or replace function public.acolitos_login_registrar(p_membro uuid, p_usuario text, p_senha text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  if not acolitos_is_superadmin() then return jsonb_build_object('erro','sem_permissao'); end if;
  -- p_senha ignorado de propósito: nada de senha em texto puro aqui.
  insert into acolitos_logins (membro_id, usuario, updated_at) values (p_membro, p_usuario, now())
  on conflict (membro_id) do update set
    usuario = coalesce(p_usuario, acolitos_logins.usuario),
    updated_at = now();
  return jsonb_build_object('ok', true);
end; $$;

-- 2) logins_listar deixa de devolver a senha
create or replace function public.acolitos_logins_listar()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not acolitos_is_superadmin() then return jsonb_build_object('erro','sem_permissao'); end if;
  return jsonb_build_object('membros', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'nome', m.nome, 'nivel', m.nivel, 'user_id', m.user_id,
      'tem_conta', (m.user_id is not null),
      'usuario', coalesce(l.usuario, split_part(u.email,'@',1))) order by m.nome)
    from acolitos_membros m
    left join acolitos_logins l on l.membro_id = m.id
    left join auth.users u on u.id = m.user_id
    where m.status='ativo'
  ), '[]'::jsonb));
end; $$;

-- 3) elimina o plaintext em repouso
alter table public.acolitos_logins drop column if exists senha;
