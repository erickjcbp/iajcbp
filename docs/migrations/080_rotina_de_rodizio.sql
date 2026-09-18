-- Acólitos 080 — a rotina de RODÍZIO: passar por um grupo inteiro, um por dia
--
-- CORREÇÃO DE UMA LEITURA MINHA ERRADA. Na migration 076 eu registrei: "quem ORIENTA são os
-- mais graduados, do acólito sentinela para cima; quem é ACOMPANHADO são os mais novos" — e
-- pedi que o dono me corrigisse se estivesse torto. Estava. Em 18/09/2026 ele disse com todas
-- as letras: **a intenção é falar com todos do acólito sentinela para cima, mas todos mesmo**,
-- estejam eles parados ou não.
--
-- POR QUE ISSO EXIGE UM TIPO NOVO: a rotina de `acompanhamento` (078) só pesca quem está
-- parado ou travado — é a fila de quem precisa de socorro. O Orientador precisa do contrário:
-- uma volta completa por um GRUPO, inclusive quem vai bem, que é justamente com quem ninguém
-- costuma conversar. Dois trabalhos diferentes, duas fontes diferentes.
--
-- O RITMO (decisão do dono): uma por dia. São 45 pessoas, menos quem está no próprio setor
-- Orientador — quem orienta fica fora da fila, senão o app manda o orientador falar com ele
-- mesmo. Dá uma volta completa em cerca de 44 dias, e ninguém repete antes disso.

alter table public.acolitos_rotinas drop constraint if exists acolitos_rotinas_fonte_check;
alter table public.acolitos_rotinas
  add constraint acolitos_rotinas_fonte_check
  check (fonte in ('fixa', 'acompanhamento', 'rodizio'));

-- Quais degraus entram na roda. Fica na rotina, e não no código, para a coordenação poder
-- mudar o grupo sem migration nova.
alter table public.acolitos_rotinas
  add column if not exists alvo_niveis text[];

comment on column public.acolitos_rotinas.alvo_niveis is
  'Só para fonte = rodizio: os níveis que entram na roda de conversas. Ex.: do acólito sentinela para cima.';

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
  contexto text;
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
    if r.fonte in ('acompanhamento', 'rodizio') then
      -- o lote é o teto de conversas ABERTAS, não o número de tarefas criadas por dia: quem
      -- não falou com ninguém ontem não recebe dois nomes hoje
      select count(*) into abertas from public.acolitos_tarefas t
       where t.rotina_id = r.id and t.concluida_em is null;
      vagas := greatest(coalesce(r.lote, 3) - abertas, 0);

      for p in
        select a.membro_id, a.nome, a.nivel, a.faixa, a.dias_parado,
               a.ultima_missa, a.ultimo_progresso
          from public.acolitos_formacao_acompanhamento() a
          join public.acolitos_membros m on m.id = a.membro_id
         where (
                 -- ACOMPANHAMENTO: só quem está dentro do app e não anda
                 (r.fonte = 'acompanhamento' and a.faixa in ('parou', 'travado'))
                 or
                 -- RODÍZIO: todo mundo do grupo, indo bem ou não; só os ativos, e nunca quem
                 -- está no próprio setor da rotina (o orientador não se orienta)
                 (r.fonte = 'rodizio'
                  and coalesce(a.status, '') = 'ativo'
                  and a.nivel = any(coalesce(r.alvo_niveis, '{}'::text[]))
                  and not (r.time_slug = any(coalesce(m.setores, '{}'::text[]))))
               )
           -- fora da fila: quem já tem conversa em aberto, e quem foi procurado há pouco
           -- (senão a mesma pessoa volta amanhã, porque o dado dela não muda por ter sido ouvida)
           and not exists (select 1 from public.acolitos_tarefas t
                            where t.rotina_id = r.id and t.alvo_id = a.membro_id
                              and (t.concluida_em is null
                                   or t.concluida_em > now() - make_interval(days => coalesce(r.descanso_dias, 30))))
         order by
           -- no rodízio, primeiro quem está sem conversa há mais tempo (nunca procurado vem
           -- na frente); no acompanhamento, primeiro quem parou, e há mais tempo
           case when r.fonte = 'rodizio' then 0
                when a.faixa = 'parou' then 0 else 1 end,
           case when r.fonte = 'rodizio'
                then (select max(t2.criada_em) from public.acolitos_tarefas t2
                       where t2.rotina_id = r.id and t2.alvo_id = a.membro_id)
                else null end asc nulls first,
           a.dias_parado desc nulls last,
           a.nome
         limit vagas
      loop
        if r.fonte = 'rodizio' then
          contexto := case p.nivel
                        when 'acolito_sentinela' then 'Acólito Sentinela'
                        when 'aspirante_cerimoniario' then 'Aspirante a Cerimoniário'
                        when 'cerimoniario_aspirante' then 'Cerimoniário Aspirante'
                        when 'cerimoniario_guardiao' then 'Cerimoniário Guardião'
                        when 'cerimoniario_magistral' then 'Cerimoniário Magistral'
                        when 'cerimoniario_mor' then 'Cerimoniário-Mor'
                        else coalesce(p.nivel, 'sem degrau') end
            || ' · última missa: ' || coalesce(to_char(p.ultima_missa, 'DD/MM/YYYY'), 'nunca serviu')
            || ' · última missão: ' || coalesce(to_char(p.ultimo_progresso, 'DD/MM/YYYY'), 'nenhuma ainda')
            || case when p.faixa = 'parou' then ' · PAROU há ' || coalesce(p.dias_parado::text, '?') || ' dias'
                    when p.faixa = 'travado' then ' · entrou no app e não começou a trilha'
                    when p.faixa = 'nunca_entrou' then ' · nunca abriu o app'
                    else '' end
            || '. Pergunte como andam as coisas — na pastoral e fora dela.';

          insert into public.acolitos_tarefas
            (titulo, time_slug, responsavel_id, prazo, observacao, recorrencia, criada_por, rotina_id, alvo_id)
          values ('Conversar com ' || p.nome, r.time_slug, r.responsavel_id, r.proxima,
                  contexto, 'nenhuma', r.criada_por, r.id, p.membro_id);
        else
          insert into public.acolitos_tarefas
            (titulo, time_slug, responsavel_id, prazo, observacao, recorrencia, criada_por, rotina_id, alvo_id)
          values ('Falar com ' || p.nome, r.time_slug, r.responsavel_id, r.proxima,
                  case when p.faixa = 'parou'
                       then 'Parou há ' || coalesce(p.dias_parado::text, '?') || ' dias: nenhuma missão e nenhuma missa servida nesse tempo. Pergunte como estão as coisas.'
                       else 'Entrou no app e não começou a trilha. Ajude a dar o primeiro passo.' end,
                  'nenhuma', r.criada_por, r.id, p.membro_id);
        end if;
        criadas := criadas + 1;
      end loop;

    else
      -- rotina de título fixo (o comportamento da 077)
      if exists (select 1 from public.acolitos_tarefas t
                  where t.rotina_id = r.id and t.concluida_em is null) then
        continue;
      end if;
      insert into public.acolitos_tarefas
        (titulo, time_slug, responsavel_id, prazo, observacao, recorrencia, criada_por, rotina_id)
      values (r.titulo, r.time_slug, r.responsavel_id, r.proxima, r.observacao, 'nenhuma', r.criada_por, r.id);
      criadas := criadas + 1;
    end if;

    -- a próxima data sai da que venceu, não de hoje
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

comment on function public.acolitos_rotinas_materializar() is
  'Cria as tarefas vencidas das rotinas dos times de quem chama. "fixa": uma tarefa por vez com o título escrito. "acompanhamento": uma por PESSOA parada. "rodizio": uma volta completa por um grupo de níveis, quem está sem conversa há mais tempo primeiro, sem incluir quem é do próprio setor. Prova: docs/provas/provar-080-rodizio-do-orientador.sql';

notify pgrst, 'reload schema';
