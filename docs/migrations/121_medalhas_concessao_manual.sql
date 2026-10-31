-- Concessões manuais não concluem missões nem alteram XP, idade ou aptidões.
create table if not exists public.acolitos_medalhas_manuais (
 membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
 missao_id uuid not null references public.acolitos_missoes(id),
 concedido_por uuid not null references auth.users(id),
 concedido_em timestamptz not null default now(),
 motivo text not null check(length(btrim(motivo)) between 3 and 500),
 primary key(membro_id,missao_id)
);
alter table public.acolitos_medalhas_manuais enable row level security;
revoke all on public.acolitos_medalhas_manuais from public,anon,authenticated;

create or replace function public.acolitos_medalhas_catalogo() returns jsonb
language plpgsql stable security definer set search_path='public' as $$
begin
 if auth.uid() is null or public.acolitos_get_role(auth.uid()) is null then raise exception 'Sem acesso' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',badge_label,'icone',badge_icone,'tier',badge_tier,'nivel',nivel_alvo,'desc',badge_desc,'validacao',validacao) order by badge_label)
 from public.acolitos_missoes where ativo and concede_badge and badge_label is not null),'[]'::jsonb);
end $$;
revoke all on function public.acolitos_medalhas_catalogo() from public,anon,authenticated;
grant execute on function public.acolitos_medalhas_catalogo() to authenticated;

create or replace function public._acolitos_medalha_possui(p_membro uuid,p_medalha uuid) returns boolean
language sql stable security definer set search_path='public' as $$
 select exists(select 1 from public.acolitos_medalhas_manuais where membro_id=p_membro and missao_id=p_medalha)
 or coalesce((select case when mi.criterio is null then exists(select 1 from public.acolitos_missao_progresso p where p.membro_id=p_membro and p.missao_id=mi.id and p.status='concluida')
 else public.acolitos_badge_cumpre(p_membro,mi.criterio) end from public.acolitos_missoes mi where mi.id=p_medalha),false);
$$;
revoke all on function public._acolitos_medalha_possui(uuid,uuid) from public,anon,authenticated;

create or replace function public.acolitos_medalhas_lote(p_medalha uuid,p_membros uuid[],p_motivo text default '',p_confirmar boolean default false) returns jsonb
language plpgsql security definer set search_path='public' as $$
declare ids uuid[]; medalha record; membro record; possui boolean; total integer:=0; existentes integer:=0; novas integer:=0; pessoas jsonb:='[]'::jsonb;
begin
 if coalesce(public.acolitos_get_role(auth.uid()),'') not in ('coord_admin','subadmin') then raise exception 'Só a coordenação pode conceder medalhas' using errcode='42501'; end if;
 if p_confirmar is null then raise exception 'Confirmação inválida'; end if;
 if coalesce(cardinality(p_membros),0)=0 or cardinality(p_membros)>500 or array_position(p_membros,null) is not null then raise exception 'Selecione de 1 a 500 membros'; end if;
 select array_agg(distinct x order by x) into ids from unnest(p_membros) x;
 select * into medalha from public.acolitos_missoes where id=p_medalha and ativo and concede_badge and badge_label is not null for share;
 if not found then raise exception 'Medalha inválida ou desativada'; end if;
 if p_confirmar and (p_motivo is null or length(btrim(p_motivo)) not between 3 and 500) then raise exception 'Informe um motivo com 3 a 500 caracteres'; end if;
 perform pg_advisory_xact_lock(hashtextextended('missao:'||p_medalha::text||':'||x::text,0)) from unnest(ids) x order by x;
 -- Mesma ordem para concorrência: um lote inválido nunca é parcialmente aplicado.
 perform id from public.acolitos_membros where id=any(ids) and status='ativo' and serve is true order by id for update;
 if (select count(*) from public.acolitos_membros where id=any(ids) and status='ativo' and serve is true)<>cardinality(ids) then raise exception 'Há membros indisponíveis. Atualize a seleção'; end if;
 for membro in select id,nome from public.acolitos_membros where id=any(ids) order by id loop
  possui:=public._acolitos_medalha_possui(membro.id,p_medalha);
  total:=total+1; if possui then existentes:=existentes+1; end if;
  pessoas:=pessoas||jsonb_build_array(jsonb_build_object('id',membro.id,'nome',membro.nome,'ja_possui',possui));
  if p_confirmar and not possui then
   insert into public.acolitos_medalhas_manuais(membro_id,missao_id,concedido_por,motivo) values(membro.id,p_medalha,auth.uid(),btrim(p_motivo));
   insert into public.acolitos_badge_ganhos(membro_id,missao_id,ganho_em) values(membro.id,p_medalha,now()) on conflict(membro_id,missao_id) do update set ganho_em=coalesce(acolitos_badge_ganhos.ganho_em,excluded.ganho_em);
   update public.acolitos_membros set avisos=coalesce(avisos,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('tipo','medalha','medalha_id',p_medalha,'label',medalha.badge_label,'icone',medalha.badge_icone,'tier',medalha.badge_tier,'nivel',medalha.nivel_alvo,'seen',false,'ts',(extract(epoch from clock_timestamp())*1000)::bigint)) where id=membro.id;
   novas:=novas+1;
  end if;
 end loop;
 return jsonb_build_object('ok',true,'confirmado',p_confirmar,'total',total,'existentes',existentes,'novas',case when p_confirmar then novas else total-existentes end,'membros',pessoas);
end $$;
revoke all on function public.acolitos_medalhas_lote(uuid,uuid[],text,boolean) from public,anon,authenticated;
grant execute on function public.acolitos_medalhas_lote(uuid,uuid[],text,boolean) to authenticated;

create or replace function public.acolitos_medalhas_historico(p_medalha uuid) returns jsonb
language plpgsql stable security definer set search_path='public' as $$
begin
 if coalesce(public.acolitos_get_role(auth.uid()),'') not in ('coord_admin','subadmin') then raise exception 'Sem permissão' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(h) order by h.concedido_em desc) from (select mm.membro_id,m.nome,mm.concedido_em,mm.motivo,coalesce(p.nome,'Coordenação') autor from public.acolitos_medalhas_manuais mm join public.acolitos_membros m on m.id=mm.membro_id left join public.profiles p on p.id=mm.concedido_por where mm.missao_id=p_medalha order by mm.concedido_em desc limit 100) h),'[]'::jsonb);
end $$;
revoke all on function public.acolitos_medalhas_historico(uuid) from public,anon,authenticated;
grant execute on function public.acolitos_medalhas_historico(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.acolitos_badges_membro(p_membro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_dono boolean; v_role text:=acolitos_get_role(v_uid);
begin
  select (user_id=v_uid) into v_dono from acolitos_membros where id=p_membro;
  if coalesce(v_dono,false)=false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then
    return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', mi.id, 'label', mi.badge_label, 'icone', mi.badge_icone, 'nivel', mi.nivel_alvo,
      'tier', mi.badge_tier, 'validacao', mi.validacao, 'desc', mi.badge_desc,
      'requisito', case
        when mi.criterio->>'fonte'='habilitacao' then 'Fique Apto em ' || (
          select string_agg(coalesce(lbl.label, f.value), ' e ' order by f.ord)
          from jsonb_array_elements_text(mi.criterio->'funcoes') with ordinality f(value,ord)
          left join (values ('apoio','Apoio'),('cruz','Cruz'),('vela','Vela'),('sineta','Sineta'),('sinao','Sinão'),
            ('altar','Altar'),('turibulo','Turíbulo'),('naveta','Naveta'),('missal','Missal'),
            ('cred_altar','Cerimoniário de Altar'),('cred_credencia','Cerimoniário de Credência'),
            ('mitra','Mitra'),('baculo','Báculo')) lbl(slug,label) on lbl.slug=f.value)
        when mi.criterio->>'fonte'='idade' then 'Complete ' || (mi.criterio->>'min') || ' anos'
        when mi.criterio->>'fonte'='missas_total' then 'Sirva ' || (mi.criterio->>'quantidade') || ' missas no total'
        when mi.criterio->>'fonte'='ensaios_total' then 'Participe de ' || (mi.criterio->>'quantidade') || ' ensaios no total'
        when mi.criterio->>'fonte'='funcoes_aptas' then 'Fique Apto em ' || (mi.criterio->>'quantidade') || ' funções'
        when mi.criterio->>'fonte'='solicitos' then 'Sirva ' || (mi.criterio->>'quantidade') || ' vezes sem estar escalado'
        when mi.criterio->>'fonte'='campeao' then 'Vença ' || (mi.criterio->>'quantidade') || ' temporada(s)'
        when mi.criterio->>'fonte'='tenure' then 'Complete ' || case when (mi.criterio->>'meses')::int >= 12 and (mi.criterio->>'meses')::int % 12 = 0
              then ((mi.criterio->>'meses')::int / 12)::text || ' ano(s)' else (mi.criterio->>'meses') || ' meses' end || ' de pastoral'
        when mi.validacao='avaliada' then 'Concedida pela coordenação'
        else 'Conclua: ' || mi.titulo end,
      'ganho_em', coalesce(gn.ganho_em,manual.concedido_em),
      'concessao_manual', manual.membro_id is not null,
      'ganho', manual.membro_id is not null or case
        when mi.criterio is null then exists(select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')
        else acolitos_badge_cumpre(p_membro, mi.criterio)
      end)
      order by array_position(array['coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'], mi.nivel_alvo) nulls last, mi.ordem)
    from acolitos_missoes mi
    left join acolitos_badge_ganhos gn on gn.missao_id=mi.id and gn.membro_id=p_membro
    left join public.acolitos_medalhas_manuais manual on manual.missao_id=mi.id and manual.membro_id=p_membro
    where mi.ativo and mi.concede_badge and mi.badge_label is not null
  ), '[]'::jsonb);
end; $$;

notify pgrst, 'reload schema';
