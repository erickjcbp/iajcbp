-- 119: registra QUANDO cada medalha foi conquistada (ordenação "mais recentes").
-- Até aqui `ganho` era calculado ao vivo e não guardava data. Regra de honestidade:
-- só há data quando ela é sabida. Missão avaliada, idade, tempo de pastoral, missas, ensaios,
-- solícitos e troféus têm data exata nos dados e entram no backfill; as demais (habilitação) ficam com ganho_em NULL ("antes do registro")
-- e só ganham data a partir de agora, na primeira vez que o app as detecta.

create table if not exists public.acolitos_badge_ganhos (
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  missao_id uuid not null references public.acolitos_missoes(id) on delete cascade,
  ganho_em timestamptz,
  registrado_em timestamptz not null default now(),
  primary key (membro_id, missao_id)
);
alter table public.acolitos_badge_ganhos enable row level security;
revoke all on public.acolitos_badge_ganhos from anon, authenticated;

-- Data exata em que o critério foi cumprido, quando ela existe nos dados. NULL = não dá para saber.
create or replace function public._badge_data_ganho(p_membro uuid, c jsonb) returns timestamptz
language plpgsql stable security definer set search_path to 'public' as $$
declare v timestamptz; n int;
begin
  if c is null then return null; end if;
  n := greatest(coalesce((c->>'quantidade')::int, 1), 1) - 1;
  if c->>'fonte' = 'idade' then
    select (data_nascimento + ((c->>'min')::int || ' years')::interval)::timestamptz into v from acolitos_membros where id=p_membro;
  elsif c->>'fonte' = 'tenure' then
    select created_at + ((c->>'meses')::int || ' months')::interval into v from acolitos_membros where id=p_membro;
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
end; $$;
revoke all on function public._badge_data_ganho(uuid, jsonb) from public;

-- Backfill: o que já está ganho hoje.
insert into public.acolitos_badge_ganhos (membro_id, missao_id, ganho_em)
select m.id, mi.id,
  case
    when mi.criterio is null then (select pr.concluida_em from acolitos_missao_progresso pr
        where pr.missao_id=mi.id and pr.membro_id=m.id and pr.status='concluida' order by pr.concluida_em limit 1)
    else _badge_data_ganho(m.id, mi.criterio) end
from acolitos_membros m
cross join acolitos_missoes mi
where mi.ativo and mi.concede_badge and mi.badge_label is not null
  and case when mi.criterio is null
        then exists(select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=m.id and pr.status='concluida')
        else acolitos_badge_cumpre(m.id, mi.criterio) end
on conflict do nothing;

-- Registro de novas conquistas: o app chama ao abrir a tela de conquistas.
create or replace function public.acolitos_badges_registrar(p_membro uuid) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid:=auth.uid(); v_dono boolean; v_n integer;
begin
  select (user_id=v_uid) into v_dono from acolitos_membros where id=p_membro;
  if coalesce(v_dono,false)=false then return 0; end if;
  insert into acolitos_badge_ganhos (membro_id, missao_id, ganho_em)
  select p_membro, mi.id,
    case when mi.criterio is null then (select pr.concluida_em from acolitos_missao_progresso pr
        where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida' order by pr.concluida_em limit 1)
      else coalesce(_badge_data_ganho(p_membro, mi.criterio), now()) end
  from acolitos_missoes mi
  where mi.ativo and mi.concede_badge and mi.badge_label is not null
    and case when mi.criterio is null
          then exists(select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')
          else acolitos_badge_cumpre(p_membro, mi.criterio) end
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end; $$;
revoke all on function public.acolitos_badges_registrar(uuid) from public;
grant execute on function public.acolitos_badges_registrar(uuid) to authenticated, service_role;

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
      'ganho_em', gn.ganho_em,
      'ganho', case
        when mi.criterio is null then exists(select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')
        else acolitos_badge_cumpre(p_membro, mi.criterio)
      end)
      order by array_position(array['coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'], mi.nivel_alvo) nulls last, mi.ordem)
    from acolitos_missoes mi
    left join acolitos_badge_ganhos gn on gn.missao_id=mi.id and gn.membro_id=p_membro
    where mi.ativo and mi.concede_badge and mi.badge_label is not null
  ), '[]'::jsonb);
end; $$;
