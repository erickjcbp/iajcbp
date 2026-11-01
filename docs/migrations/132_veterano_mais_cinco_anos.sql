-- 132: Veterano exige MAIS de5anos, não o aniversário exato de5anos.
-- apos_marco vale só no critério do Veterano: Coluna do Altar segue inclusiva.
update public.acolitos_missoes
 set criterio=jsonb_set(criterio,'{apos_marco}','true'::jsonb),
 descricao='Mais de 5 anos de pastoral e nível Cerimoniário Aspirante ou superior.',
 badge_desc='Mais de 5 anos de pastoral e nível Cerimoniário Aspirante ou superior.'
 where id='121bc1d5-93c7-5d7b-aeff-7014fdc4b447' and badge_icone='tempo_veterano';
CREATE OR REPLACE FUNCTION public.acolitos_badge_cumpre(p_membro uuid, c jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_nasc date; v_created timestamptz; cnt int; v_inicio date; v_nivel text;
begin
  if c is null then return false; end if;
  if c->>'fonte' = 'habilitacao' then
    return jsonb_array_length(coalesce(c->'funcoes','[]'::jsonb)) > 0 and not exists (
      select 1 from jsonb_array_elements_text(c->'funcoes') f
       where not exists (select 1 from acolitos_habilitacoes h where h.membro_id=p_membro and h.funcao=f.value
          and _prof_rank(h.proficiencia) >= _prof_rank(c->>'proficiencia')));
  elsif c->>'fonte' = 'idade' then
    select data_nascimento into v_nasc from acolitos_membros where id=p_membro;
    return v_nasc is not null and date_part('year', age(v_nasc)) >= (c->>'min')::int;
  elsif c->>'fonte' = 'missas_total' then
    select count(*) into cnt from acolitos_chamadas_itens ci
      join acolitos_escalas e on e.id=ci.escala_id
     where ci.resultado in ('presente','atrasado') and e.membro_id=p_membro;
    return cnt >= (c->>'quantidade')::int;
  elsif c->>'fonte' = 'ensaios_total' then
    select count(distinct ep.evento_id) into cnt from acolitos_evento_presencas ep
      join acolitos_eventos ev on ev.id=ep.evento_id
     where ep.membro_id=p_membro and ep.status='presente' and ev.tipo='ensaio';
    return cnt >= (c->>'quantidade')::int;
  elsif c->>'fonte' = 'funcoes_aptas' then
    select count(*) into cnt from acolitos_habilitacoes h
     where h.membro_id=p_membro and h.proficiencia in ('apto','experiente','referencia');
    return cnt >= (c->>'quantidade')::int;
  elsif c->>'fonte' in ('tenure','tenure_nivel') then
    if not coalesce((select ativo from public.acolitos_tempo_config where id),false) then return false;end if;
    select servindo_desde,nivel into v_inicio,v_nivel from acolitos_membros where id=p_membro;
    if v_inicio is null or (v_inicio+make_interval(months=>(c->>'meses')::int))::date+(case when c->>'apos_marco'='true' then 1 else 0 end)>(now() at time zone 'America/Sao_Paulo')::date then return false;end if;
    if c->>'fonte'='tenure_nivel' then
      return coalesce(array_position(array['aspirante','coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'],v_nivel),0)>=coalesce(nullif(array_position(array['aspirante','coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'],c->>'nivel_min'),0),999);
    end if;
    return true;
  elsif c->>'fonte' = 'solicitos' then
    select count(*) into cnt from acolitos_presencas_avulsas where membro_id=p_membro;
    return cnt >= (c->>'quantidade')::int;
  elsif c->>'fonte' = 'campeao' then
    select count(*) into cnt from acolitos_campeoes where membro_id=p_membro;
    return cnt >= coalesce((c->>'quantidade')::int, 1);
  end if;
  return false;
end; $function$
;
CREATE OR REPLACE FUNCTION public._badge_data_ganho(p_membro uuid, c jsonb)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v timestamptz; n int;
begin
  if c is null then return null; end if;
  n := greatest(coalesce((c->>'quantidade')::int, 1), 1) - 1;
  if c->>'fonte' = 'idade' then
    select (data_nascimento + ((c->>'min')::int || ' years')::interval)::timestamptz into v from acolitos_membros where id=p_membro;
  elsif c->>'fonte' in ('tenure','tenure_nivel') then
    select ((servindo_desde+make_interval(months=>(c->>'meses')::int))::date+(case when c->>'apos_marco'='true' then 1 else 0 end))::timestamp at time zone 'America/Sao_Paulo' into v from acolitos_membros where id=p_membro;
  elsif c->>'fonte' = 'missas_total' then
    select d into v from (select ce.data::timestamptz d from acolitos_chamadas_itens ci
      join acolitos_escalas e on e.id=ci.escala_id join acolitos_celebracoes ce on ce.id=e.celebracao_id
      where ci.resultado in ('presente','atrasado') and e.membro_id=p_membro order by ce.data offset n limit 1) x;
  elsif c->>'fonte' = 'ensaios_total' then
    select d into v from (select ev.data::timestamptz d from acolitos_evento_presencas ep
      join acolitos_eventos ev on ev.id=ep.evento_id
      where ep.membro_id=p_membro and ep.status='presente' and ev.tipo='ensaio'
      group by ev.id, ev.data order by ev.data offset n limit 1) x;
  elsif c->>'fonte' = 'solicitos' then
    select d into v from (select ce.data::timestamptz d from acolitos_presencas_avulsas pa
      join acolitos_celebracoes ce on ce.id=pa.celebracao_id where pa.membro_id=p_membro order by ce.data offset n limit 1) x;
  elsif c->>'fonte' = 'campeao' then
    select d into v from (select created_at d from acolitos_campeoes where membro_id=p_membro order by created_at offset n limit 1) x;
  end if;
  return v;
end; $function$
;
CREATE OR REPLACE FUNCTION public._acolitos_medalha_detalhes(mi acolitos_missoes, p_manual boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
        when mi.criterio->>'fonte'='tenure_nivel' then 'Tenha mais de 5 anos de pastoral e nível Cerimoniário Aspirante ou superior'
        when mi.criterio->>'fonte'='tenure' then 'Complete ' || case when (mi.criterio->>'meses')::int >= 12 and (mi.criterio->>'meses')::int % 12 = 0
              then ((mi.criterio->>'meses')::int / 12)::text || ' ano(s)' else (mi.criterio->>'meses') || ' meses' end || ' de pastoral'
        when mi.validacao in ('avaliada','reivindicada') then coalesce(nullif(nullif(mi.descricao,'medalha'),''),nullif(mi.badge_desc,''),mi.titulo) || ' Reconhecimento concedido pela coordenação.'
        else 'Conclua: ' || mi.titulo end, 'manutencao',case
 when mi.criterio->>'fonte' in ('tenure','tenure_nivel') then 'Reconhecimento pelo tempo de serviço registrado. Sem renovação periódica ou vencimento por tempo.'
 when mi.validacao in ('avaliada','reivindicada') and nullif(btrim(mi.badge_manutencao),'') is not null then mi.badge_manutencao
 when p_manual then 'Concessão manual registrada, sem missão recorrente ou vencimento automático.'
 when mi.criterio->>'fonte'='habilitacao' then 'Manter a habilitação exigida nas funções desta missão. A posse automática acompanha a aptidão atual; concessões manuais não vencem automaticamente.'
 when mi.criterio->>'fonte'='funcoes_aptas' then 'Manter pelo menos ' || (mi.criterio->>'quantidade') || ' funções aptas. A posse automática acompanha a aptidão atual; concessões manuais não vencem automaticamente.'
 when mi.validacao in ('avaliada','reivindicada') then 'Sem missão recorrente ou vencimento automático após o reconhecimento da coordenação.'
 when mi.criterio is not null then 'Sem missão recorrente ou vencimento por tempo. A posse automática depende de os registros continuarem atendendo à missão.'
 else 'Manter a missão registrada como concluída. Sem tarefa recorrente ou vencimento por tempo.' end);
$function$
;
revoke all on function public._badge_data_ganho(uuid,jsonb) from public,anon,authenticated;
revoke all on function public._acolitos_medalha_detalhes(public.acolitos_missoes,boolean) from public,anon,authenticated;
notify pgrst,'reload schema';

-- Perfil visual limitado: listas/RPCs antigas nem sempre trazem nível/casa e a
-- RLS do membro não permite consultar toda a ficha alheia. Não amplia a ficha.
create or replace function public.acolitos_avatares_identidade_lote(p_membros uuid[]) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$begin
 if auth.uid() is null or public.acolitos_get_role(auth.uid()) is null then raise exception 'Sem acesso' using errcode='42501';end if;
 if coalesce(cardinality(p_membros),0)>500 or array_position(p_membros,null) is not null then raise exception 'Lista de membros inválida';end if;
 return coalesce((select jsonb_object_agg(m.id::text,jsonb_build_object('id',m.id,'foto_url',m.foto_url,'nivel',m.nivel,'casa_id',m.casa_id,'casa_slug',c.slug))
  from public.acolitos_membros m left join public.acolitos_casas c on c.id=m.casa_id
  where m.id=any(p_membros) and m.status='ativo'),'{}'::jsonb);
end $$;
revoke all on function public.acolitos_avatares_identidade_lote(uuid[]) from public,anon,authenticated;
grant execute on function public.acolitos_avatares_identidade_lote(uuid[]) to authenticated;
notify pgrst,'reload schema';
