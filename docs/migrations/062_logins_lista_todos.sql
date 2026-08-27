-- 062 — a tela de Logins passa a enxergar todo mundo, não só quem está "ativo".
--
-- O QUE ESTAVA ERRADO: a lista filtrava `m.status='ativo'`. Quem está no CRM na
-- etapa da túnica fica com situação "em integração" — e sumia da tela. Resultado:
-- a coordenação não conseguia redefinir a senha justamente de quem acabou de
-- chegar e ainda está se ambientando, que é quem mais esquece a senha. Eram 6
-- pessoas em 27/08/2026 (mais 2 afastadas).
--
-- Isso não é um filtro cosmético: como o app não manda e-mail de recuperação
-- (as contas usam e-mail inventado, e o domínio não recebe mensagem), a tela de
-- Logins é o ÚNICO caminho para recuperar acesso. Quem some dela fica sem saída.
--
-- A situação de cada pessoa passa a vir junto, para a tela poder separar.
-- O portão continua o mesmo: só superadmin.

create or replace function public.acolitos_logins_listar()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not acolitos_is_superadmin() then return jsonb_build_object('erro','sem_permissao'); end if;
  return jsonb_build_object('membros', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'nome', m.nome, 'nivel', m.nivel, 'user_id', m.user_id,
      'status', m.status,
      'tem_conta', (m.user_id is not null),
      'usuario', coalesce(l.usuario, split_part(u.email,'@',1))) order by m.nome)
    from acolitos_membros m
    left join acolitos_logins l on l.membro_id = m.id
    left join auth.users u on u.id = m.user_id
  ), '[]'::jsonb));
end; $function$;
