-- Acólitos 078 — a rotina que nomeia a pessoa: "Falar com Fulano"
--
-- O QUE FALTAVA: a rotina da 077 gera sempre o MESMO título ("falar com 3 coroinhas parados").
-- O dono apontou o buraco em 18/09: para o setor Orientador, a tarefa útil é a que **diz o
-- nome** — "Falar com Ana Clara, parada há 44 dias" — e essa lista o app já tem, desde que o
-- acompanhamento da Formação subiu (migration 075).
--
-- POR QUE EM LOTE: são 11 pessoas travadas ou paradas hoje, e 148 que nunca abriram o app.
-- Gerar uma tarefa para cada uma faria o Orientador abrir a tela e desistir. A rotina mantém
-- no máximo `lote` tarefas abertas ao mesmo tempo; quando ele conclui uma, a próxima pessoa
-- entra na vez seguinte. É o "só uma viva por vez" da 077 aplicado a GENTE, não a assunto.
--
-- QUEM ENTRA NA FILA: só quem **está dentro do app e não anda** — as faixas `parou` e
-- `travado`. Quem nunca entrou NÃO entra aqui de propósito: aquilo é problema de a senha
-- chegar, não de acompanhamento, e insistir em formação com quem não abriu o app é falar
-- sozinho. Esse caso já aparece no cartão da Jornada.

alter table public.acolitos_rotinas
  add column if not exists fonte text not null default 'fixa'
  check (fonte in ('fixa', 'acompanhamento'));

alter table public.acolitos_rotinas
  add column if not exists lote integer not null default 3;

comment on column public.acolitos_rotinas.fonte is
  '"fixa" = a tarefa sai do título escrito na rotina. "acompanhamento" = o app escolhe as pessoas paradas e cria uma tarefa por pessoa, até o limite de `lote` abertas.';

-- De quem a tarefa FALA (diferente de responsavel_id, que é quem a executa). É este elo que
-- impede duas tarefas abertas sobre a mesma pessoa.
alter table public.acolitos_tarefas
  add column if not exists alvo_id uuid references public.acolitos_membros(id) on delete set null;

create index if not exists acolitos_tarefas_alvo_idx on public.acolitos_tarefas (rotina_id, alvo_id)
  where concluida_em is null;

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
      -- Quantas ainda cabem: o lote é o teto de tarefas ABERTAS desta rotina, não o número
      -- de tarefas criadas por semana. Quem não concluiu nada não recebe mais nomes.
      select count(*) into abertas from public.acolitos_tarefas t
       where t.rotina_id = r.id and t.concluida_em is null;
      vagas := greatest(coalesce(r.lote, 3) - abertas, 0);

      for p in
        select a.membro_id, a.nome, a.faixa, a.dias_parado
          from public.acolitos_formacao_acompanhamento() a
         where a.faixa in ('parou', 'travado')
           and not exists (select 1 from public.acolitos_tarefas t
                            where t.rotina_id = r.id and t.alvo_id = a.membro_id
                              and t.concluida_em is null)
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

    -- A próxima data sai da que venceu, não de hoje: uma rotina semanal olhada com atraso
    -- volta ao dia certo da semana em vez de andar sozinha.
    prox := case r.recorrencia
              when 'semanal' then r.proxima + 7
              when 'mensal'  then (r.proxima + interval '1 month')::date
              when 'anual'   then (r.proxima + interval '1 year')::date
              when 'celebracao' then (
                select min(c.data) from public.acolitos_celebracoes c where c.data > r.proxima)
            end;
    if prox is null then prox := r.proxima; end if;
    while prox <= current_date loop
      prox := case r.recorrencia
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
  'Cria as tarefas das rotinas vencidas dos times de quem chama. Rotina "fixa": uma tarefa por vez, com o título escrito. Rotina "acompanhamento": uma tarefa por PESSOA parada ("Falar com Fulano"), mantendo no máximo `lote` abertas. Prova: docs/provas/provar-078-rotina-que-fala-com-gente.sql';

notify pgrst, 'reload schema';
