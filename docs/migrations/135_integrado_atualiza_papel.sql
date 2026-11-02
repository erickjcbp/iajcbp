-- Ao concluir o CRM, tira do papel 'novo' quem entrou em integrado.
-- Sem isso a Home mostra "Sua Integração" e as outras telas voltam para ela (shared.js),
-- mesmo com o membro ativo e escalado. O papel sai do nível; o nível continua decidido
-- pelos caminhos atuais e o gatilho `acolitos_crm_integrado` só preenche o vazio.
-- Só altera quem está em 'novo': papel escolhido pela coordenação nunca é rebaixado.
-- O nome ordena este gatilho depois de `acolitos_crm_integrado`, que grava o nível.
begin;
create or replace function public.acolitos_papel_do_nivel(p_nivel text,p_eh_equipe boolean)
returns text language sql immutable set search_path=public,pg_temp as $$
 select case
  when p_eh_equipe then 'membro_equipe'
  when p_nivel like 'cerimoniario\_%' then 'cerimonario'
  when p_nivel like 'acolito\_%' or p_nivel='aspirante_cerimoniario' then 'acolito'
  when p_nivel='coroinha' then 'coroinha'
  else 'aspirante'
 end
$$;
create or replace function public.acolitos_integrado_atualiza_papel()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.etapa is distinct from 'integrado' then return new; end if;
 update public.pastoral_members pm
    set role=public.acolitos_papel_do_nivel(m.nivel,coalesce(m.eh_equipe,false))
   from public.acolitos_membros m,public.pastoral_modules mo
  where m.id=new.membro_id and pm.user_id=m.user_id and mo.id=pm.module_id
    and mo.slug='acolitos' and pm.role='novo';
 return new;
end $$;
revoke all on function public.acolitos_integrado_atualiza_papel() from public,anon,authenticated;
revoke all on function public.acolitos_papel_do_nivel(text,boolean) from public,anon,authenticated;
drop trigger if exists acolitos_crm_integrado_papel on public.acolitos_crm;
create trigger acolitos_crm_integrado_papel
after insert or update of etapa on public.acolitos_crm
for each row execute function public.acolitos_integrado_atualiza_papel();
comment on function public.acolitos_integrado_atualiza_papel() is
'Ao entrar em integrado no CRM, troca o papel novo pelo papel do nível. Nunca altera outro papel.';
-- Quem já saiu do CRM e ficou preso em novo.
update public.pastoral_members pm
   set role=public.acolitos_papel_do_nivel(m.nivel,coalesce(m.eh_equipe,false))
  from public.acolitos_membros m,public.acolitos_crm c,public.pastoral_modules mo
 where m.user_id=pm.user_id and c.membro_id=m.id and mo.id=pm.module_id
   and mo.slug='acolitos' and pm.role='novo' and c.etapa='integrado';
commit;
