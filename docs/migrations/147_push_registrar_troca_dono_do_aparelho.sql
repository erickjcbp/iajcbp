-- Gravar a inscrição de push de um aparelho que JÁ tem inscrição de outra conta.
--
-- Caso real (05/11/2026, Jullyana): celular compartilhado em família. A inscrição do navegador
-- (endpoint) já estava gravada pela conta de outra pessoa; `acolitos_push_subs` tem UNIQUE(endpoint) e a
-- policy "Push subs do próprio dono" (user_id = auth.uid()) nega o UPDATE da linha alheia, então o
-- upsert do app falhava, o portão de notificações não abria e a pessoa ficava presa na parede.
--
-- A função troca o dono da linha SÓ quando quem pede traz as MESMAS chaves da inscrição (p256dh e auth):
-- essas chaves nascem no aparelho e não aparecem em lugar nenhum — quem as tem está de posse dele.
-- Com chaves diferentes recusa (42501) e o app cria uma inscrição nova. O endpoint, sozinho, não basta.
begin;

create or replace function public.acolitos_push_registrar(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  dono uuid;
begin
  if uid is null then raise exception 'sem sessão' using errcode = '28000'; end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'inscrição incompleta' using errcode = '22023';
  end if;

  select user_id into dono from public.acolitos_push_subs where endpoint = p_endpoint;

  if dono is null then
    insert into public.acolitos_push_subs (user_id, endpoint, p256dh, auth, user_agent)
    values (uid, p_endpoint, p_p256dh, p_auth, p_user_agent);
  elsif dono = uid then
    update public.acolitos_push_subs
       set p256dh = p_p256dh, auth = p_auth, user_agent = p_user_agent
     where endpoint = p_endpoint;
  else
    update public.acolitos_push_subs
       set user_id = uid, user_agent = p_user_agent
     where endpoint = p_endpoint and p256dh = p_p256dh and auth = p_auth;
    if not found then raise exception 'inscrição de outro aparelho' using errcode = '42501'; end if;
  end if;
  return true;
end $$;

revoke all on function public.acolitos_push_registrar(text, text, text, text) from public, anon;
grant execute on function public.acolitos_push_registrar(text, text, text, text) to authenticated;

commit;
