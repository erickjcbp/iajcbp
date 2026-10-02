-- Acólitos 087 — SUSPENSÃO: o membro fica fora da escala até uma data (45 dias por padrão)
--
-- PEDIDO DO DONO (01/10/2026): quem tem muita falta passa 1 mês e meio sem ser escalado. Ele
-- vinha fazendo isso APAGANDO a disponibilidade da pessoa — mas aí perde o registro de em que
-- horários ela serve (a tabela é apagada e regravada a cada salvamento da ficha).
--
-- COMO FUNCIONA: duas colunas em acolitos_membros. A pessoa continua ativa, com habilitações e
-- disponibilidade intactas; só não é escalada em celebração com data ANTES de suspenso_ate.
-- O dia de suspenso_ate já vale (a regra é "data < suspenso_ate" = fora).
--   • escala.html trata suspenso como ausente declarado (ausMap) — gerador, troca e seletor.
--   • acolitos_substituir_ausente (SQL) e o roster do substituto ganham o mesmo corte.
-- Dá para reativar antes do prazo (botão na aba Disponibilidade, com confirmação).
-- Privilégios: GRANT é de tabela inteira em acolitos_membros; nada a conceder.

ALTER TABLE public.acolitos_membros
  ADD COLUMN IF NOT EXISTS suspenso_ate date,
  ADD COLUMN IF NOT EXISTS suspenso_em  date;

COMMENT ON COLUMN public.acolitos_membros.suspenso_ate IS
  'Fora da escala em celebrações com data anterior a esta. NULL = não suspenso.';
COMMENT ON COLUMN public.acolitos_membros.suspenso_em IS
  'Dia em que a suspensão foi aplicada (para a tela dizer "suspenso há N dias").';

CREATE OR REPLACE FUNCTION public.acolitos_roster_substituicao()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text; v_result jsonb;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('membros', '[]'::jsonb, 'habs', '[]'::jsonb);
  end if;
  select jsonb_build_object(
    'membros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'nome', m.nome, 'apelido', m.apelido, 'foto_url', m.foto_url, 'nivel', m.nivel,
        'casa_id', m.casa_id,
        'comunidade', m.comunidade, 'pode_outras_comunidades', m.pode_outras_comunidades,
        'grupo_irmaos', m.grupo_irmaos, 'escalar_com_irmao', m.escalar_com_irmao,
        'data_nascimento', m.data_nascimento,
        'suspenso_ate', m.suspenso_ate
      ) order by m.nome)
      from acolitos_membros m where m.status = 'ativo'
    ), '[]'::jsonb),
    'habs', coalesce((
      select jsonb_agg(jsonb_build_object('membro_id', h.membro_id, 'funcao', h.funcao, 'proficiencia', h.proficiencia))
      from acolitos_habilitacoes h
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end; $function$
;

CREATE OR REPLACE FUNCTION public.acolitos_substituir_ausente(p_membros uuid[], p_celebracoes uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_eh_equipe boolean := acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe');
  v_membro uuid;
  v_cel record;
  v_slot record;
  v_sub uuid;
  v_diakey text;
  v_count int := 0;
  v_ok boolean;
begin
  if p_membros is null or p_celebracoes is null then return 0; end if;
  foreach v_membro in array p_membros loop
    v_ok := v_eh_equipe
      or exists (select 1 from acolitos_membros where id = v_membro and user_id = auth.uid())
      or exists (select 1 from acolitos_membros me join acolitos_membros tgt on tgt.grupo_irmaos = me.grupo_irmaos
                 where me.user_id = auth.uid() and me.grupo_irmaos is not null and tgt.id = v_membro);
    if not v_ok then continue; end if;

    for v_cel in select * from acolitos_celebracoes where id = any(p_celebracoes) loop
      v_diakey := case extract(dow from v_cel.data)::int when 0 then 'domingo' when 6 then 'sabado' else null end;
      for v_slot in select * from acolitos_escalas where celebracao_id = v_cel.id and membro_id = v_membro loop
        select m.id into v_sub
        from acolitos_membros m
        join acolitos_habilitacoes h on h.membro_id = m.id and h.funcao = v_slot.funcao and h.proficiencia in ('apto','experiente','referencia')
        where m.status = 'ativo' and m.id <> v_membro
          and (v_diakey is null or exists (select 1 from acolitos_disponibilidade d where d.membro_id = m.id and d.dia = v_diakey and d.horario = v_cel.horario))
          and not exists (select 1 from acolitos_ausencias a where a.membro_id = m.id and (a.celebracao_id = v_cel.id or a.data = v_cel.data))
          and not (m.suspenso_ate is not null and m.suspenso_ate > v_cel.data)
          and not exists (select 1 from acolitos_escalas e where e.celebracao_id = v_cel.id and e.membro_id = m.id)
        order by (select count(*) from acolitos_escalas e2 where e2.membro_id = m.id) asc, random()
        limit 1;
        if v_sub is not null then
          update acolitos_escalas set membro_id = v_sub, substituto_id = v_membro where id = v_slot.id;
          v_count := v_count + 1;
        else
          delete from acolitos_escalas where id = v_slot.id;
        end if;
      end loop;
    end loop;
  end loop;
  return v_count;
end;
$function$
;
