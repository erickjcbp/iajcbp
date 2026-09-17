-- Acólitos 068 — quem já entrou no app (para o filtro da aba Membros)
--
-- O dono pediu filtros melhores nas abas (16/09/2026). Em Membros, um deles é "já entrou
-- no app / nunca entrou": só 39 dos 177 entraram alguma vez, e é assim que a coordenação
-- acha quem precisa de ajuda com o login.
--
-- A data do último acesso mora em auth.users, que o app não enxerga — e não deve: lá tem
-- e-mail. Esta função devolve SÓ o id do membro. Nem e-mail, nem data.
--
-- A TRAVA é a da própria tela Membros (membros.html: coord_admin, subadmin,
-- membro_equipe). Mais estreita que isso, a equipe veria o filtro quebrado.
--
-- SEM PERMISSÃO = ERRO, não lista vazia. Lista vazia diria "ninguém entrou" — e a tela
-- mostraria 177 pessoas como "nunca entrou". Falha que vira número é o defeito que este
-- app mais repetiu.
--
-- IDEMPOTENTE: create or replace. Prova: docs/provas/provar-068-quem-ja-entrou.sql

create or replace function public.acolitos_membros_ja_entraram()
returns table (membro_id uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return query
    select m.id
      from acolitos_membros m
      join auth.users u on u.id = m.user_id
     where u.last_sign_in_at is not null;
end; $$;

revoke all on function public.acolitos_membros_ja_entraram() from public;
revoke all on function public.acolitos_membros_ja_entraram() from anon;
grant execute on function public.acolitos_membros_ja_entraram() to authenticated;
grant execute on function public.acolitos_membros_ja_entraram() to service_role;

comment on function public.acolitos_membros_ja_entraram() is
  'Ids dos membros que já entraram no app (filtro da aba Membros). Só devolve membro_id. Sem permissão = erro 42501. Prova: docs/provas/provar-068-quem-ja-entrou.sql';
