-- 096 — Ausência tira a pessoa da escala e põe outra no lugar, venha de onde vier (2026-10-20)
--
-- O problema: a troca só acontecia quando a TELA chamava a troca depois de gravar a ausência.
-- O formulário público aprovado na Caixa trocava pelo navegador e falhou calado (missa de 11/10:
-- ausência aprovada às 20:07 de 08/10 e a pessoa seguiu escalada, com 🚫 no nome). Ausência por
-- data avulsa vinda do formulário público nem tentava trocar.
--
-- O conserto: um gatilho em acolitos_ausencias. Toda ausência gravada (membro, coordenação,
-- cerimoniário, aprovação do formulário público) troca na hora quem estava ESCALADO numa missa
-- de hoje em diante. A escolha é a mesma da acolitos_substituir_ausente, que o membro já usava,
-- com a mesma comunidade em primeiro lugar. Sem ninguém apto, a vaga sai do nome (fica vazia).
-- Só mexe em status 'escalado': presença, falta e troca já registradas ficam como estão.

create or replace function public.acolitos_trocar_ausente(p_membro uuid, p_celebracao uuid)
returns integer language plpgsql security definer set search_path to 'public'
as $$
declare
  v_cel record;
  v_slot record;
  v_sub uuid;
  v_diakey text;
  v_count int := 0;
begin
  select * into v_cel from acolitos_celebracoes where id = p_celebracao;
  if v_cel.id is null then return 0; end if;
  v_diakey := case extract(dow from v_cel.data)::int when 0 then 'domingo' when 6 then 'sabado' else null end;
  for v_slot in select * from acolitos_escalas
                where celebracao_id = v_cel.id and membro_id = p_membro and status = 'escalado' loop
    select m.id into v_sub
    from acolitos_membros m
    join acolitos_habilitacoes h on h.membro_id = m.id and h.funcao = v_slot.funcao and h.proficiencia in ('apto','experiente','referencia')
    where m.status = 'ativo' and m.serve is true and m.id <> p_membro
      and (v_diakey is null or exists (select 1 from acolitos_disponibilidade d where d.membro_id = m.id and d.dia = v_diakey and d.horario = v_cel.horario))
      and not exists (select 1 from acolitos_ausencias a where a.membro_id = m.id and (a.celebracao_id = v_cel.id or a.data = v_cel.data))
      and not (m.suspenso_ate is not null and m.suspenso_ate > v_cel.data)
      and not exists (select 1 from acolitos_escalas e where e.celebracao_id = v_cel.id and e.membro_id = m.id)
    order by (m.comunidade is not distinct from v_cel.comunidade) desc,
             coalesce(m.pode_outras_comunidades, false) desc,
             (select count(*) from acolitos_escalas e2 where e2.membro_id = m.id) asc,
             random()
    limit 1;
    if v_sub is not null then
      update acolitos_escalas set membro_id = v_sub, substituto_id = p_membro where id = v_slot.id;
      v_count := v_count + 1;
    else
      delete from acolitos_escalas where id = v_slot.id;
    end if;
  end loop;
  return v_count;
end; $$;

revoke all on function public.acolitos_trocar_ausente(uuid, uuid) from public, anon, authenticated;

create or replace function public.acolitos_ausencia_troca_escala()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_cel record;
begin
  for v_cel in
    select c.id from acolitos_celebracoes c
    where (c.id = new.celebracao_id or (new.celebracao_id is null and c.data = new.data))
      and c.data >= (now() at time zone 'America/Sao_Paulo')::date
  loop
    perform acolitos_trocar_ausente(new.membro_id, v_cel.id);
  end loop;
  return null;
end; $$;

revoke all on function public.acolitos_ausencia_troca_escala() from public, anon, authenticated;

drop trigger if exists acolitos_ausencia_troca_escala on public.acolitos_ausencias;
create trigger acolitos_ausencia_troca_escala
after insert or update of membro_id, celebracao_id, data on public.acolitos_ausencias
for each row execute function public.acolitos_ausencia_troca_escala();

-- A RPC que as telas já chamam passa a usar a mesma escolha (mesma trava de quem pode).
create or replace function public.acolitos_substituir_ausente(p_membros uuid[], p_celebracoes uuid[])
returns integer language plpgsql security definer set search_path to 'public'
as $$
declare
  v_eh_equipe boolean := acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe');
  v_membro uuid;
  v_cel uuid;
  v_count int := 0;
begin
  if p_membros is null or p_celebracoes is null then return 0; end if;
  foreach v_membro in array p_membros loop
    if not (v_eh_equipe
      or exists (select 1 from acolitos_membros where id = v_membro and user_id = auth.uid())
      or exists (select 1 from acolitos_membros me join acolitos_membros tgt on tgt.grupo_irmaos = me.grupo_irmaos
                 where me.user_id = auth.uid() and me.grupo_irmaos is not null and tgt.id = v_membro)) then
      continue;
    end if;
    foreach v_cel in array p_celebracoes loop
      v_count := v_count + acolitos_trocar_ausente(v_membro, v_cel);
    end loop;
  end loop;
  return v_count;
end; $$;
