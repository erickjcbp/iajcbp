-- O link de redefinição de senha (api/acolito-admin.js › pedirRedefinicao) vai INTEIRO, com o
-- token, no `texto` de uma linha de tarcisio_envios. A tabela acolitos_password_resets guarda só
-- o hash — mas o token em claro ficava legível para coord_admin e subadmin pela RLS da fila, e
-- quem lê o link antes da pessoa troca a senha dela. Isso passava por cima do podeMexer (um
-- subadmin não pode mexer em coord_admin) e do RANK da Gestão de Acessos.
--
-- 1) Enquanto o link espera na fila, a coordenação não enxerga nem mexe na linha (chave_unica
--    'senha-reset:%'). O robô usa service_role e passa por cima da RLS: nada muda para ele.
-- 2) Quando a linha sai de pendente/enviando (enviado, falhou, cancelado…), o texto é apagado
--    por gatilho. Retentativa do robô volta para 'pendente' e mantém o texto: só se apaga no fim.
begin;

drop policy if exists "Coordenacao gere" on public.tarcisio_envios;
create policy "Coordenacao gere" on public.tarcisio_envios for all
  using (tarcisio_pode_gerir() and coalesce(chave_unica, '') not like 'senha-reset:%')
  with check (tarcisio_pode_gerir() and coalesce(chave_unica, '') not like 'senha-reset:%');

create or replace function public.tarcisio_envios_apaga_link_senha()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $$
begin
  if new.chave_unica like 'senha-reset:%' and new.estado not in ('pendente','enviando') then
    new.texto := '[link de redefinição de senha removido]';
  end if;
  return new;
end $$;
revoke all on function public.tarcisio_envios_apaga_link_senha() from public, anon, authenticated;

drop trigger if exists tarcisio_envios_apaga_link_senha on public.tarcisio_envios;
create trigger tarcisio_envios_apaga_link_senha
  before insert or update on public.tarcisio_envios
  for each row execute function public.tarcisio_envios_apaga_link_senha();

-- Os que já saíram antes desta migration.
update public.tarcisio_envios
   set texto = '[link de redefinição de senha removido]'
 where chave_unica like 'senha-reset:%' and estado not in ('pendente','enviando')
   and texto is distinct from '[link de redefinição de senha removido]';

commit;
