-- 130: cinco medalhões de tempo de pastoral. Implantação em duas etapas:
-- estrutura/catálogo primeiro; ativação explícita apenas depois do cliente publicado.
create table if not exists public.acolitos_tempo_config (
 id boolean primary key default true check(id), ativo boolean not null default false, ativado_em timestamptz
);
alter table public.acolitos_tempo_config enable row level security;
revoke all on public.acolitos_tempo_config from public,anon,authenticated;
insert into public.acolitos_tempo_config(id) values(true) on conflict do nothing;

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
    if v_inicio is null or v_inicio+make_interval(months=>(c->>'meses')::int)>(now() at time zone 'America/Sao_Paulo')::date then return false;end if;
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
    select (servindo_desde+make_interval(months=>(c->>'meses')::int))::timestamp at time zone 'America/Sao_Paulo' into v from acolitos_membros where id=p_membro;
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
        when mi.criterio->>'fonte'='tenure_nivel' then 'Complete 5 anos de pastoral e alcance o nível Acólito Sentinela ou superior'
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
CREATE OR REPLACE FUNCTION public.acolitos_medalhas_avaliar(p_membro uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid:=auth.uid(); v_dono boolean; v_role text:=acolitos_get_role(v_uid); m record; v_n int:=0; v_tempo jsonb;
begin
  select (user_id=v_uid) into v_dono from acolitos_membros where id=p_membro;
  if coalesce(v_dono,false)=false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then return 0; end if;
  v_tempo:=public.acolitos_tempo_processar(p_membro);v_n:=coalesce((v_tempo->>'novas')::int,0);
  for m in (
    select mi.id, mi.xp, mi.badge_label, mi.criterio
    from acolitos_missoes mi
    where mi.ativo and mi.concede_badge and mi.validacao='automatica' and mi.nivel_alvo is null
      and mi.criterio is not null and mi.criterio->>'fonte' not in ('habilitacao','tenure','tenure_nivel')
      and not exists (select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')
  ) loop
    if acolitos_badge_cumpre(p_membro, m.criterio) then
      insert into acolitos_missao_progresso (missao_id, membro_id, status, xp_ganho, concluida_em)
        values (m.id, p_membro, 'concluida', 0, now())
      on conflict (missao_id, membro_id) do update set status='concluida', concluida_em=now();
      update acolitos_membros set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'tipo','medalha','label',m.badge_label,'seen',false,'ts',(extract(epoch from now())*1000 + v_n)::bigint)) where id=p_membro;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end; $function$

;
revoke all on function public._badge_data_ganho(uuid,jsonb) from public,anon,authenticated;
revoke all on function public._acolitos_medalha_detalhes(public.acolitos_missoes,boolean) from public,anon,authenticated;

-- O cadastro pessoal/familiar pode editar perfil, mas não fabricar a elegibilidade
-- usada para créditos. SECURITY INVOKER preserva current_user: RPCs administrativas
-- SECURITY DEFINER e o serviço conservam suas atribuições; chamadas diretas obedecem
-- ao papel da coordenação. INSERT também é protegido (inclusive filho sem user_id).
create or replace function public._acolitos_tempo_proteger_dados() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare restrito boolean;hoje date:=(now() at time zone 'America/Sao_Paulo')::date;begin
 restrito:=current_user in('authenticated','anon');
 if restrito then
  restrito:=coalesce(public.acolitos_get_role(auth.uid()),'') not in('coord_admin','subadmin','membro_equipe');
 end if;
 if tg_op='INSERT' then
  if restrito and (coalesce(new.nivel,'aspirante')<>'aspirante'
    or (new.servindo_desde is not null and new.servindo_desde<>hoje)
    or coalesce(new.servindo_desde_ou_antes,false)
    or coalesce(new.servindo_desde_fonte,'cadastro_app')<>'cadastro_app') then
   raise exception 'Tempo de pastoral e nível são definidos pela coordenação' using errcode='42501';
  end if;
  if new.servindo_desde is null then
   new.servindo_desde:=hoje;new.servindo_desde_ou_antes:=false;new.servindo_desde_fonte:='cadastro_app';
  end if;
 elsif restrito and (new.servindo_desde is distinct from old.servindo_desde
   or new.servindo_desde_ou_antes is distinct from old.servindo_desde_ou_antes
   or new.servindo_desde_fonte is distinct from old.servindo_desde_fonte
   or new.nivel is distinct from old.nivel) then
  raise exception 'Tempo de pastoral e nível são definidos pela coordenação' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public._acolitos_tempo_proteger_dados() from public,anon,authenticated;
drop trigger if exists tempo_proteger_dados on public.acolitos_membros;
create trigger tempo_proteger_dados before insert or update of servindo_desde,servindo_desde_ou_antes,servindo_desde_fonte,nivel
 on public.acolitos_membros for each row execute function public._acolitos_tempo_proteger_dados();

-- Mantém os três IDs existentes, preservando histórico e referências.
insert into public.acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,nivel_alvo,criterio,concede_badge,badge_icone,badge_label,badge_desc,badge_tier,ativo,ordem,capitulo,obrigatoria,recorrente,exclusiva,seriedade)
values('0fba3b84-f070-4d67-af7e-c0ddc8086b2d','Primeira Chama','Um ano de serviço: a primeira chama que permanece acesa.','bonus','automatica',30,null,'{"fonte": "tenure", "meses": 12}'::jsonb,true,'tempo_chama','Primeira Chama','Um ano de serviço: a primeira chama que permanece acesa.','bronze',true,311,null,false,false,false,'surpresa')
on conflict(id) do update set titulo=excluded.titulo,descricao=excluded.descricao,validacao='automatica',xp=excluded.xp,criterio=excluded.criterio,badge_icone=excluded.badge_icone,badge_label=excluded.badge_label,badge_desc=excluded.badge_desc,badge_tier=excluded.badge_tier,ordem=excluded.ordem;
insert into public.acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,nivel_alvo,criterio,concede_badge,badge_icone,badge_label,badge_desc,badge_tier,ativo,ordem,capitulo,obrigatoria,recorrente,exclusiva,seriedade)
values('6e36739b-7ee6-4772-ba90-e3e2bcf8b256','Pilar do Tempo','Dois anos de serviço e compromisso com a pastoral.','bonus','automatica',40,null,'{"fonte": "tenure", "meses": 24}'::jsonb,true,'tempo_pilar','Pilar do Tempo','Dois anos de serviço e compromisso com a pastoral.','prata',true,312,null,false,false,false,'surpresa')
on conflict(id) do update set titulo=excluded.titulo,descricao=excluded.descricao,validacao='automatica',xp=excluded.xp,criterio=excluded.criterio,badge_icone=excluded.badge_icone,badge_label=excluded.badge_label,badge_desc=excluded.badge_desc,badge_tier=excluded.badge_tier,ordem=excluded.ordem;
insert into public.acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,nivel_alvo,criterio,concede_badge,badge_icone,badge_label,badge_desc,badge_tier,ativo,ordem,capitulo,obrigatoria,recorrente,exclusiva,seriedade)
values('e38aba98-bd7a-4279-8f6e-a66a0302a0d9','Raiz da Pastoral','Três anos de serviço: raízes que fortalecem a pastoral.','bonus','automatica',50,null,'{"fonte": "tenure", "meses": 36}'::jsonb,true,'tempo_raiz','Raiz da Pastoral','Três anos de serviço: raízes que fortalecem a pastoral.','ouro',true,313,null,false,false,false,'surpresa')
on conflict(id) do update set titulo=excluded.titulo,descricao=excluded.descricao,validacao='automatica',xp=excluded.xp,criterio=excluded.criterio,badge_icone=excluded.badge_icone,badge_label=excluded.badge_label,badge_desc=excluded.badge_desc,badge_tier=excluded.badge_tier,ordem=excluded.ordem;
insert into public.acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,nivel_alvo,criterio,concede_badge,badge_icone,badge_label,badge_desc,badge_tier,ativo,ordem,capitulo,obrigatoria,recorrente,exclusiva,seriedade)
values('58b31974-4816-5236-b4f3-0e0abb51929e','Coluna do Altar','Cinco anos de serviço, constância e dedicação ao altar.','bonus','automatica',70,null,'{"fonte": "tenure", "meses": 60}'::jsonb,true,'tempo_altar','Coluna do Altar','Cinco anos de serviço, constância e dedicação ao altar.','onix',true,314,null,false,false,false,'surpresa')
on conflict(id) do update set titulo=excluded.titulo,descricao=excluded.descricao,validacao='automatica',xp=excluded.xp,criterio=excluded.criterio,badge_icone=excluded.badge_icone,badge_label=excluded.badge_label,badge_desc=excluded.badge_desc,badge_tier=excluded.badge_tier,ordem=excluded.ordem;
insert into public.acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,nivel_alvo,criterio,concede_badge,badge_icone,badge_label,badge_desc,badge_tier,ativo,ordem,capitulo,obrigatoria,recorrente,exclusiva,seriedade)
values('121bc1d5-93c7-5d7b-aeff-7014fdc4b447','Veterano','Cinco anos ou mais de serviço e maturidade de Acólito Sentinela ou superior.','bonus','automatica',100,null,'{"fonte": "tenure_nivel", "meses": 60, "nivel_min": "acolito_sentinela"}'::jsonb,true,'tempo_veterano','Veterano','Cinco anos ou mais de serviço e maturidade de Acólito Sentinela ou superior.','rubi',true,315,null,false,false,false,'surpresa')
on conflict(id) do update set titulo=excluded.titulo,descricao=excluded.descricao,validacao='automatica',xp=excluded.xp,criterio=excluded.criterio,badge_icone=excluded.badge_icone,badge_label=excluded.badge_label,badge_desc=excluded.badge_desc,badge_tier=excluded.badge_tier,ordem=excluded.ordem;

-- Só funções internas chegam aqui. O progresso é a trava de crédito; ganho_em é a data
-- histórica e o aviso usa o instante da concessão (não a data retroativa).
create or replace function public._acolitos_tempo_conceder(p_membro uuid,p_missao uuid,p_data timestamptz,p_avisar boolean default true) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare mi public.acolitos_missoes;gravou uuid;temp uuid;instante timestamptz;begin
 select * into mi from public.acolitos_missoes where id=p_missao and ativo and concede_badge and criterio->>'fonte' in('tenure','tenure_nivel');
 if not found then return 0;end if;
 perform 1 from public.acolitos_membros where id=p_membro and status='ativo' and serve is true for update;
 if not found then return 0;end if;
 instante:=coalesce(p_data,now());
 if instante>now() then instante:=now();end if;
 -- O XP da temporada respeita a data real; marcos de anos anteriores não
 -- entram indevidamente na disputa da temporada atual.
 select id into temp from public.acolitos_temporadas where ativa and (instante at time zone 'America/Sao_Paulo')::date between inicio and fim order by inicio desc limit 1;
 insert into public.acolitos_missao_progresso(missao_id,membro_id,status,xp_ganho,temporada_id,concluida_em)
 values(mi.id,p_membro,'concluida',mi.xp,temp,instante)
 on conflict(missao_id,membro_id) do update set status='concluida',xp_ganho=excluded.xp_ganho,temporada_id=excluded.temporada_id,concluida_em=excluded.concluida_em
 where acolitos_missao_progresso.status<>'concluida' returning id into gravou;
 if gravou is null then return 0;end if;
 insert into public.acolitos_badge_ganhos(membro_id,missao_id,ganho_em) values(p_membro,mi.id,instante)
 on conflict(membro_id,missao_id) do update set ganho_em=excluded.ganho_em;
 if temp is not null and mi.xp>0 then
  insert into public.acolitos_xp_temporada(membro_id,temporada_id,xp,origem,created_at) values(p_membro,temp,mi.xp,'medalhao_tempo:'||mi.id::text,now());
 end if;
 if p_avisar then
  update public.acolitos_membros set avisos=coalesce(avisos,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
   'tipo','medalha','medalha_id',mi.id,'label',mi.badge_label,'icone',mi.badge_icone,'tier',mi.badge_tier,
   'tempo_marco',case when mi.criterio->>'fonte'='tenure_nivel' then 'V' else ((mi.criterio->>'meses')::int/12)::text end,
   'xp',mi.xp,'ganho_em',instante,'seen',false,'ts',(extract(epoch from clock_timestamp())*1000)::bigint)) where id=p_membro;
 end if;
 return 1;
end $$;
revoke all on function public._acolitos_tempo_conceder(uuid,uuid,timestamptz,boolean) from public,anon,authenticated;

create or replace function public.acolitos_tempo_processar(p_membro uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m record;mi record;manual timestamptz;n integer:=0;begin
 if not coalesce((select ativo from public.acolitos_tempo_config where id),false) then return jsonb_build_object('novas',0);end if;
 for m in select id from public.acolitos_membros where status='ativo' and serve is true and (p_membro is null or id=p_membro) order by id for update loop
  for mi in select id,criterio from public.acolitos_missoes where ativo and concede_badge and criterio->>'fonte' in('tenure','tenure_nivel') order by ordem,id loop
   select concedido_em into manual from public.acolitos_medalhas_manuais where membro_id=m.id and missao_id=mi.id;
   if manual is not null then
    n:=n+public._acolitos_tempo_conceder(m.id,mi.id,manual,false);
   elsif coalesce(public.acolitos_badge_cumpre(m.id,mi.criterio),false) then
    n:=n+public._acolitos_tempo_conceder(m.id,mi.id,public._badge_data_ganho(m.id,mi.criterio),true);
   end if;
  end loop;
 end loop;
 return jsonb_build_object('novas',n);
end $$;
revoke all on function public.acolitos_tempo_processar(uuid) from public,anon,authenticated;
grant execute on function public.acolitos_tempo_processar(uuid) to service_role;

-- Concessões manuais de TEMPO recebem o XP correspondente uma só vez.
-- As demais medalhas manuais conservam as regras anteriores (sem crédito de XP).
create or replace function public._acolitos_tempo_manual() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if coalesce((select ativo from public.acolitos_tempo_config where id),false) then
  perform public._acolitos_tempo_conceder(new.membro_id,new.missao_id,new.concedido_em,false);
 end if;
 return new;
end $$;
revoke all on function public._acolitos_tempo_manual() from public,anon,authenticated;
drop trigger if exists tempo_medalha_manual on public.acolitos_medalhas_manuais;
create trigger tempo_medalha_manual after insert on public.acolitos_medalhas_manuais for each row execute function public._acolitos_tempo_manual();

-- Um lote por lista de avatares; devolve apenas o marco já registrado, sem datas
-- pessoais, critérios ou saldo de XP de terceiros.
create or replace function public.acolitos_tempo_marcos_lote(p_membros uuid[]) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$begin
 if auth.uid() is null or public.acolitos_get_role(auth.uid()) is null then raise exception 'Sem acesso' using errcode='42501';end if;
 if coalesce(cardinality(p_membros),0)>500 or array_position(p_membros,null) is not null then raise exception 'Lista de membros inválida';end if;
 return coalesce((select jsonb_object_agg(membro_id::text,marco) from (
  select distinct on(g.membro_id) g.membro_id,jsonb_build_object('id',mi.id,'label',mi.badge_label,'icone',mi.badge_icone,'tier',mi.badge_tier,
   'marco',case when mi.criterio->>'fonte'='tenure_nivel' then 'V' else ((mi.criterio->>'meses')::int/12)::text end) marco
  from public.acolitos_badge_ganhos g join public.acolitos_missoes mi on mi.id=g.missao_id
  join public.acolitos_membros m on m.id=g.membro_id and m.status='ativo'
  where g.membro_id=any(p_membros) and mi.ativo and mi.criterio->>'fonte' in('tenure','tenure_nivel') and public._acolitos_medalha_possui(g.membro_id,mi.id)
  order by g.membro_id,mi.ordem desc
 ) x),'{}'::jsonb);
end $$;
revoke all on function public.acolitos_tempo_marcos_lote(uuid[]) from public,anon,authenticated;
grant execute on function public.acolitos_tempo_marcos_lote(uuid[]) to authenticated;

create or replace function public.acolitos_tempo_sincronizar(p_membro uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb;begin
 if auth.uid() is null or not exists(select 1 from public.acolitos_membros where id=p_membro and user_id=auth.uid()) then
  return jsonb_build_object('erro','sem_permissao');
 end if;
 r:=public.acolitos_tempo_processar(p_membro);
 return r||jsonb_build_object('avisos',(select avisos from public.acolitos_membros where id=p_membro));
end $$;
revoke all on function public.acolitos_tempo_sincronizar(uuid) from public,anon,authenticated;
grant execute on function public.acolitos_tempo_sincronizar(uuid) to authenticated;
notify pgrst,'reload schema';
