-- Conteúdo público das medalhas, sem dados de avaliação ou concessão individual.
create or replace function public._acolitos_medalha_detalhes(mi public.acolitos_missoes, p_manual boolean default false) returns jsonb
language sql stable set search_path='public' as $$
 select jsonb_build_object('desc',coalesce(nullif(mi.badge_desc,''),nullif(mi.descricao,'medalha'),mi.titulo),'requisito',case
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
        when mi.validacao in ('avaliada','reivindicada') then coalesce(nullif(nullif(mi.descricao,'medalha'),''),nullif(mi.badge_desc,''),mi.titulo) || ' Reconhecimento concedido pela coordenação.'
        else 'Conclua: ' || mi.titulo end, 'manutencao',case
 when p_manual then 'Concessão manual registrada, sem missão recorrente ou vencimento automático.'
 when mi.criterio->>'fonte'='habilitacao' then 'Manter a habilitação exigida nas funções desta missão. A posse automática acompanha a aptidão atual; concessões manuais não vencem automaticamente.'
 when mi.criterio->>'fonte'='funcoes_aptas' then 'Manter pelo menos ' || (mi.criterio->>'quantidade') || ' funções aptas. A posse automática acompanha a aptidão atual; concessões manuais não vencem automaticamente.'
 when mi.validacao in ('avaliada','reivindicada') then 'Sem missão recorrente ou vencimento automático após o reconhecimento da coordenação.'
 when mi.criterio is not null then 'Sem missão recorrente ou vencimento por tempo. A posse automática depende de os registros continuarem atendendo à missão.'
 else 'Manter a missão registrada como concluída. Sem tarefa recorrente ou vencimento por tempo.' end);
$$;
revoke all on function public._acolitos_medalha_detalhes(public.acolitos_missoes,boolean) from public,anon,authenticated;

create or replace function public.acolitos_medalhas_catalogo() returns jsonb
language plpgsql stable security definer set search_path='public' as $$
begin
 if auth.uid() is null or public.acolitos_get_role(auth.uid()) is null then raise exception 'Sem acesso' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',badge_label,'icone',badge_icone,'tier',badge_tier,'nivel',nivel_alvo,'desc',badge_desc,'validacao',validacao) || public._acolitos_medalha_detalhes(mi) order by badge_label)
 from public.acolitos_missoes mi where ativo and concede_badge and badge_label is not null),'[]'::jsonb);
end $$;
revoke all on function public.acolitos_medalhas_catalogo() from public,anon,authenticated;
grant execute on function public.acolitos_medalhas_catalogo() to authenticated;

-- Cartão autenticado mostra somente as medalhas conquistadas, com condições legíveis e sem critérios brutos ou dados pessoais.
create or replace function public.acolitos_medalhas_cartao(p_membro uuid) returns jsonb
language plpgsql stable security definer set search_path='public' as $$
begin
 if auth.uid() is null or public.acolitos_get_role(auth.uid()) is null then raise exception 'Sem acesso' using errcode='42501';end if;
 if not exists(select 1 from public.acolitos_membros where id=p_membro and status='ativo') then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',mi.id,'label',mi.badge_label,'icone',mi.badge_icone,'tier',mi.badge_tier,'nivel',mi.nivel_alvo,'desc',mi.badge_desc) || public._acolitos_medalha_detalhes(mi,exists(select 1 from public.acolitos_medalhas_manuais mm where mm.missao_id=mi.id and mm.membro_id=p_membro)) order by mi.badge_label)
 from public.acolitos_missoes mi where mi.ativo and mi.concede_badge and mi.badge_label is not null and public._acolitos_medalha_possui(p_membro,mi.id)),'[]'::jsonb);
end $$;
revoke all on function public.acolitos_medalhas_cartao(uuid) from public,anon,authenticated;
grant execute on function public.acolitos_medalhas_cartao(uuid) to authenticated;


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
      'ganho_em', coalesce(gn.ganho_em,manual.concedido_em),
      'concessao_manual', manual.membro_id is not null,
      'ganho', manual.membro_id is not null or case
        when mi.criterio is null then exists(select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')
        else acolitos_badge_cumpre(p_membro, mi.criterio)
      end) || public._acolitos_medalha_detalhes(mi,manual.membro_id is not null)
      order by array_position(array['coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'], mi.nivel_alvo) nulls last, mi.ordem)
    from acolitos_missoes mi
    left join acolitos_badge_ganhos gn on gn.missao_id=mi.id and gn.membro_id=p_membro
    left join public.acolitos_medalhas_manuais manual on manual.missao_id=mi.id and manual.membro_id=p_membro
    where mi.ativo and mi.concede_badge and mi.badge_label is not null
  ), '[]'::jsonb);
end; $$;


notify pgrst,'reload schema';
