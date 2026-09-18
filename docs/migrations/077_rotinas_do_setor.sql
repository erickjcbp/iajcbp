-- Acólitos 077 — o cardápio de rotinas de cada setor
--
-- O QUE FALTAVA: a tarefa recorrente já existia e já se comporta bem (a próxima nasce ao
-- concluir a anterior, e nunca duplica). Só que a corrente **só existe se alguém criar a
-- primeira tarefa à mão** — e em 18/09/2026 a tabela de tarefas estava VAZIA, com 13 setores
-- cadastrados. Pior: se ninguém conclui, a corrente morre em silêncio.
--
-- A ROTINA é o cardápio: escreve-se UMA VEZ ("conferir as velas, toda semana") e a tarefa
-- nasce sozinha quando vence — sem depender de alguém ter concluído a anterior.
--
-- A REGRA QUE O DONO ESCOLHEU (18/09): **só uma viva por vez**. Se a tarefa da semana passada
-- ainda está aberta, a desta semana NÃO nasce: a antiga continua lá, atrasada. Sem isso, um
-- setor que ficasse um mês sem olhar encontraria quatro "conferir as velas" empilhadas e
-- pararia de olhar de vez.
--
-- QUEM MEXE (decisão do dono): quem é do setor CRIA rotina do próprio setor; **alterar e
-- desligar é da coordenação**. É a trava das tarefas (migration 057) com um degrau a mais.
--
-- DUAS RECORRÊNCIAS, DE PROPÓSITO SEPARADAS: o campo `recorrencia` da TAREFA continua
-- existindo para o que já está no ar. A tarefa que nasce de uma rotina vem com
-- `recorrencia = 'nenhuma'` — quem repete é a rotina. Ter as duas na mesma tarefa criaria
-- duas correntes para a mesma coisa, e ninguém entenderia de onde veio a terceira cópia.

-- ── 1. O cardápio ────────────────────────────────────────────────────────────
create table if not exists public.acolitos_rotinas (
  id             uuid primary key default gen_random_uuid(),
  time_slug      text not null,                       -- valor de acolitos_listas tipo='setor'
  titulo         text not null,
  observacao     text,
  recorrencia    text not null
                 check (recorrencia in ('semanal','mensal','anual','celebracao')),
  proxima        date not null default current_date,  -- quando a próxima tarefa deve nascer
  responsavel_id uuid references public.acolitos_membros(id) on delete set null,
  ativa          boolean not null default true,
  criada_em      timestamptz not null default now(),
  criada_por     uuid
);

create index if not exists acolitos_rotinas_time_idx on public.acolitos_rotinas (time_slug);
create index if not exists acolitos_rotinas_proxima_idx on public.acolitos_rotinas (proxima) where ativa;

comment on table public.acolitos_rotinas is
  'O cardápio de rotinas de cada setor: escreve-se uma vez e a tarefa nasce sozinha quando vence. Só uma viva por vez. Prova: docs/provas/provar-077-rotinas-do-setor.sql';

-- De qual rotina veio a tarefa. É este elo que garante "só uma viva por vez" — sem ele,
-- a conta teria de casar por TÍTULO, e duas rotinas com o mesmo nome se atrapalhariam.
alter table public.acolitos_tarefas
  add column if not exists rotina_id uuid references public.acolitos_rotinas(id) on delete set null;

create index if not exists acolitos_tarefas_rotina_idx on public.acolitos_tarefas (rotina_id)
  where concluida_em is null;

-- ── 2. As travas ─────────────────────────────────────────────────────────────
alter table public.acolitos_rotinas enable row level security;

drop policy if exists "Rotinas: o setor lê as suas" on public.acolitos_rotinas;
create policy "Rotinas: o setor lê as suas" on public.acolitos_rotinas
  for select to authenticated
  using (
    coalesce(public.acolitos_get_role(auth.uid()), '') in ('coord_admin','subadmin')
    or time_slug = any(coalesce(public.acolitos_meus_times(auth.uid()), '{}'::text[]))
  );

drop policy if exists "Rotinas: o setor cria as suas" on public.acolitos_rotinas;
create policy "Rotinas: o setor cria as suas" on public.acolitos_rotinas
  for insert to authenticated
  with check (
    coalesce(public.acolitos_get_role(auth.uid()), '') in ('coord_admin','subadmin')
    or time_slug = any(coalesce(public.acolitos_meus_times(auth.uid()), '{}'::text[]))
  );

-- Alterar e desligar é da coordenação. Foi decisão do dono: a rotina é um compromisso do
-- setor com a pastoral, não um bilhete que cada um reescreve.
drop policy if exists "Rotinas: alterar é da coordenação" on public.acolitos_rotinas;
create policy "Rotinas: alterar é da coordenação" on public.acolitos_rotinas
  for update to authenticated
  using      (coalesce(public.acolitos_get_role(auth.uid()), '') in ('coord_admin','subadmin'))
  with check (coalesce(public.acolitos_get_role(auth.uid()), '') in ('coord_admin','subadmin'));

drop policy if exists "Rotinas: apagar é da coordenação" on public.acolitos_rotinas;
create policy "Rotinas: apagar é da coordenação" on public.acolitos_rotinas
  for delete to authenticated
  using (coalesce(public.acolitos_get_role(auth.uid()), '') in ('coord_admin','subadmin'));

-- ── 3. A materialização ──────────────────────────────────────────────────────
-- Roda quando a tela de Tarefas abre. Está no BANCO, e não na tela, por dois motivos: duas
-- pessoas abrindo ao mesmo tempo não podem criar a tarefa duas vezes, e a conta da próxima
-- data tem de ser uma só.
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
  prox date;
begin
  papel := coalesce(public.acolitos_get_role(auth.uid()), '');
  if papel not in ('coord_admin', 'subadmin', 'membro_equipe') then
    -- Recusa explícita. Devolver 0 faria a tela dizer "nada a fazer" para quem não pode ver.
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
    -- SÓ UMA VIVA POR VEZ: se ainda há tarefa aberta desta rotina, não nasce outra. A antiga
    -- fica lá, atrasada, que é exatamente o que o dono pediu.
    if exists (select 1 from public.acolitos_tarefas t
                where t.rotina_id = r.id and t.concluida_em is null) then
      continue;
    end if;

    insert into public.acolitos_tarefas
      (titulo, time_slug, responsavel_id, prazo, observacao, recorrencia, criada_por, rotina_id)
    values (r.titulo, r.time_slug, r.responsavel_id, r.proxima, r.observacao, 'nenhuma', r.criada_por, r.id);
    criadas := criadas + 1;

    -- A próxima data sai da data que acabou de vencer, não de hoje: assim uma rotina semanal
    -- olhada com 10 dias de atraso volta ao dia certo da semana, em vez de andar sozinha.
    prox := case r.recorrencia
              when 'semanal' then r.proxima + 7
              when 'mensal'  then (r.proxima + interval '1 month')::date
              when 'anual'   then (r.proxima + interval '1 year')::date
              when 'celebracao' then (
                select min(c.data) from public.acolitos_celebracoes c where c.data > r.proxima)
            end;
    -- Sem celebração futura cadastrada, a rotina de celebração espera: fica na mesma data e
    -- tenta de novo amanhã. Inventar uma data cobraria alguém por um dia que ninguém marcou.
    if prox is null then prox := r.proxima; end if;
    -- Se a rotina estava MUITO atrasada, empurra até passar de hoje — mas sem criar a fila de
    -- tarefas do passado, que é justamente o que "só uma viva por vez" evita.
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

revoke all on function public.acolitos_rotinas_materializar() from public;
revoke all on function public.acolitos_rotinas_materializar() from anon;
grant execute on function public.acolitos_rotinas_materializar() to authenticated;

comment on function public.acolitos_rotinas_materializar() is
  'Cria as tarefas das rotinas vencidas dos times de quem chama (a tela de Tarefas chama ao abrir). Nunca cria uma segunda enquanto a anterior estiver aberta. Devolve quantas nasceram.';

notify pgrst, 'reload schema';
