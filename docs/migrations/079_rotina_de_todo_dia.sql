-- Acólitos 079 — rotina de TODO DIA
--
-- PEDIDO DO DONO (18/09/2026), vendo a primeira versão funcionar: "11 pessoas por dia é muita
-- coisa, tem que ser uma por dia; o acompanhamento vai ser longo, mas enfim."
--
-- Ele está certo, e o remédio é o ritmo, não o lote: uma rotina de acompanhamento com lote 1
-- e repetição DIÁRIA dá uma conversa por dia — 11 pessoas em 11 dias, sem nunca mostrar uma
-- lista que assusta. Só que "todo dia" não existia: a rotina só aceitava semanal, mensal,
-- anual e a cada missa.
--
-- IDEMPOTENTE: a trava é derrubada e recriada; a função é `create or replace`.

-- ⚠️ ACHADO PELA PRÓPRIA PROVA, ANTES DE IR AO AR: sem o descanso abaixo, a pessoa com quem
-- se acabou de falar VOLTAVA no dia seguinte. Faz sentido para o computador (nada nos dados
-- dela mudou, então ela continua sendo a mais urgente) e é absurdo para gente: o Orientador
-- ligaria para a mesma criança todo dia. Conversa não muda o dado — muda a hora de voltar.
alter table public.acolitos_rotinas
  add column if not exists descanso_dias integer not null default 30;

comment on column public.acolitos_rotinas.descanso_dias is
  'Depois de uma conversa, quantos dias a pessoa sai da fila desta rotina. Sem isto ela voltaria no dia seguinte, porque o dado dela não muda só por ter sido procurada.';

alter table public.acolitos_rotinas drop constraint if exists acolitos_rotinas_recorrencia_check;
alter table public.acolitos_rotinas
  add constraint acolitos_rotinas_recorrencia_check
  check (recorrencia in ('diaria', 'semanal', 'mensal', 'anual', 'celebracao'));

-- A conta da próxima data ganha o caso do dia. O resto do corpo é o mesmo da 078 — está
-- repetido inteiro porque `create or replace function` não aceita remendo parcial.
create or replace function public.acolitos_rotinas_materializar()
  returns integer
  language plpgsql
  volatile
  security definer
  set search_path to 'public'
as $$
declare
  meus text[];
  papel text;
  criadas integer := 0;
  r record;
  p record;
  prox date;
  abertas integer;
  vagas integer;
begin
  papel := coalesce(public.acolitos_get_role(auth.uid()), '');
  if papel not in ('coord_admin', 'subadmin', 'membro_equipe') then
    raise exception 'Sem acesso às rotinas' using errcode = '42501';
  end if;
  meus := coalesce(public.acolitos_meus_times(auth.uid()), '{}'::text[]);

  for r in
    select * from public.acolitos_rotinas
     where ativa
       and proxima <= current_date
       and (papel in ('coord_admin','subadmin') or time_slug = any(meus))
     for update
  loop
    if r.fonte = 'acompanhamento' then
      select count(*) into abertas from public.acolitos_tarefas t
       where t.rotina_id = r.id and t.concluida_em is null;
      vagas := greatest(coalesce(r.lote, 3) - abertas, 0);

      for p in
        select a.membro_id, a.nome, a.faixa, a.dias_parado
          from public.acolitos_formacao_acompanhamento() a
         where a.faixa in ('parou', 'travado')
           -- fora da fila: quem já tem conversa em aberto, E quem foi procurado há pouco
           -- (senão a mesma pessoa volta amanhã, e todo dia)
           and not exists (select 1 from public.acolitos_tarefas t
                            where t.rotina_id = r.id and t.alvo_id = a.membro_id
                              and (t.concluida_em is null
                                   or t.concluida_em > now() - make_interval(days => coalesce(r.descanso_dias, 30))))
         order by case a.faixa when 'parou' then 0 else 1 end,
                  a.dias_parado desc nulls last, a.nome
         limit vagas
      loop
        insert into public.acolitos_tarefas
          (titulo, time_slug, responsavel_id, prazo, observacao, recorrencia, criada_por, rotina_id, alvo_id)
        values ('Falar com ' || p.nome,
                r.time_slug, r.responsavel_id, r.proxima,
                case when p.faixa = 'parou'
                     then 'Parou há ' || coalesce(p.dias_parado::text, '?') || ' dias: nenhuma missão e nenhuma missa servida nesse tempo. Pergunte como estão as coisas.'
                     else 'Entrou no app e não começou a trilha. Ajude a dar o primeiro passo.' end,
                'nenhuma', r.criada_por, r.id, p.membro_id);
        criadas := criadas + 1;
      end loop;

    else
      if exists (select 1 from public.acolitos_tarefas t
                  where t.rotina_id = r.id and t.concluida_em is null) then
        continue;
      end if;
      insert into public.acolitos_tarefas
        (titulo, time_slug, responsavel_id, prazo, observacao, recorrencia, criada_por, rotina_id)
      values (r.titulo, r.time_slug, r.responsavel_id, r.proxima, r.observacao, 'nenhuma', r.criada_por, r.id);
      criadas := criadas + 1;
    end if;

    prox := case r.recorrencia
              when 'diaria'  then r.proxima + 1
              when 'semanal' then r.proxima + 7
              when 'mensal'  then (r.proxima + interval '1 month')::date
              when 'anual'   then (r.proxima + interval '1 year')::date
              when 'celebracao' then (
                select min(c.data) from public.acolitos_celebracoes c where c.data > r.proxima)
            end;
    if prox is null then prox := r.proxima; end if;
    while prox <= current_date loop
      prox := case r.recorrencia
                when 'diaria'  then prox + 1
                when 'semanal' then prox + 7
                when 'mensal'  then (prox + interval '1 month')::date
                when 'anual'   then (prox + interval '1 year')::date
                else current_date + 1
              end;
    end loop;
    update public.acolitos_rotinas set proxima = prox where id = r.id;
  end loop;

  return criadas;
end $$;

notify pgrst, 'reload schema';
