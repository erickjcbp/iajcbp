-- 131: regra aprovada pelo dono em01/11/2026: Veterano só para Cerimoniários.
-- Aspirante a Cerimoniário ainda não integra os quatro níveis de Cerimoniário.
update public.acolitos_missoes
set criterio=jsonb_set(criterio,'{nivel_min}','"cerimoniario_aspirante"'::jsonb),
 descricao='Cinco anos ou mais de pastoral e nível Cerimoniário Aspirante ou superior.',
 badge_desc='Cinco anos ou mais de pastoral e nível Cerimoniário Aspirante ou superior.'
where id='121bc1d5-93c7-5d7b-aeff-7014fdc4b447' and badge_icone='tempo_veterano';
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
        when mi.criterio->>'fonte'='tenure_nivel' then 'Complete 5 anos de pastoral e alcance o nível Cerimoniário Aspirante ou superior'
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
revoke all on function public._acolitos_medalha_detalhes(public.acolitos_missoes,boolean) from public,anon,authenticated;
notify pgrst,'reload schema';
