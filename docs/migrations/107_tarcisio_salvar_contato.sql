-- Salva o contato inline e reconcilia a fila em uma única transação, respeitando a RLS.
create or replace function public.tarcisio_salvar_contato(p_membro uuid, p_numero text, p_relacao text default 'proprio')
returns jsonb language plpgsql security invoker set search_path to 'public' as $$
declare
  n text; item record; existe boolean; atualizados int:=0; agrupados int:=0; antigos int:=0; gravados int;
begin
  if not coalesce(public.tarcisio_pode_gerir(),false) then return jsonb_build_object('erro','sem_permissao'); end if;
  if p_relacao not in ('proprio','responsavel') then return jsonb_build_object('erro','relacao_invalida'); end if;
  n:=regexp_replace(coalesce(p_numero,''),'[^0-9]','','g'); n:=regexp_replace(n,'^0+','');
  if length(n) in (10,11) then n:='55'||n; end if;
  if length(n)=12 and left(n,2)='55' and substring(n,5,1)~'[6-9]' then n:=left(n,4)||'9'||substring(n,5); end if;
  if n !~ '^55[0-9]{2}9[0-9]{8}$' then return jsonb_build_object('erro','numero_invalido'); end if;
  perform pg_advisory_xact_lock(hashtextextended('tarcisio-contato:'||n,0));
  perform id from public.acolitos_membros where id=p_membro for update;
  if not found then return jsonb_build_object('erro','membro_nao_encontrado'); end if;
  if p_relacao='proprio' then update public.acolitos_membros set telefone=n where id=p_membro;
  else update public.acolitos_membros set celular_recado=n where id=p_membro; end if;
  get diagnostics gravados=row_count;
  if gravados<>1 then raise exception 'Contato não pôde ser salvo'; end if;
  for item in select * from public.tarcisio_envios where membro_id=p_membro
    and (estado='sem_numero' or (estado='falhou' and erro='Número sem WhatsApp')) for update
  loop
    if item.agendado_para<now() or (item.aviso_id is not null and not exists(select 1 from public.tarcisio_avisos where id=item.aviso_id and ativo)) then
      update public.tarcisio_envios set estado='cancelado',erro='Contato corrigido; aviso antigo ou encerrado não reenviado' where id=item.id;
      antigos:=antigos+1; continue;
    end if;
    select exists(select 1 from public.tarcisio_envios e where e.id<>item.id and e.destino_numero=n
      and e.estado in ('pendente','enviando','enviado')
      and date_trunc('minute',e.agendado_para)=date_trunc('minute',item.agendado_para)
      and ((item.aviso_id is not null and e.aviso_id=item.aviso_id) or
        (item.aviso_id is null and e.aviso_id is null and split_part(e.chave_unica,':',1)=split_part(item.chave_unica,':',1)
          and split_part(e.chave_unica,':',2)=split_part(item.chave_unica,':',2)))) into existe;
    if existe then
      update public.tarcisio_envios set estado='cancelado',erro='Contato corrigido; número já incluído neste disparo' where id=item.id;
      agrupados:=agrupados+1;
    else
      update public.tarcisio_envios set destino_numero=n,estado='pendente',erro=null,tentativas=0 where id=item.id;
      atualizados:=atualizados+1;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'numero',n,'futuros_atualizados',atualizados,'agrupados',agrupados,'antigos_preservados',antigos);
end; $$;
revoke all on function public.tarcisio_salvar_contato(uuid,text,text) from public, anon;
grant execute on function public.tarcisio_salvar_contato(uuid,text,text) to authenticated;
