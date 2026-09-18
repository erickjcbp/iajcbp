-- Acólitos 084 — o PROJETO: a tarefa que tem começo, meio e fim
--
-- PEDIDO DO DONO (18/09/2026): "quero o mais próximo possível da feature Áreas do erickIA".
-- Fui ler o desenho de lá (docs/superpowers/specs/2026-07-18-areas-projetos-ecossistema.md do
-- repositório erickia) em vez de inventar um parecido:
--
--   Área    = o contêiner permanente (aqui, o SETOR). Não acaba.
--   Tarefa  = atômica: faz e acaba.
--   Projeto = começo, meio e fim. É uma TAREFA com `tipo='projeto'` — não uma entidade nova —
--             e por isso herda prazo, hora, responsável, estados e a etiqueta do time sem
--             nenhuma tela precisar aprender um conceito a mais.
--   Marco   = o PASSO com prazo. Passo sem prazo continua sendo só um passo.
--
-- O QUE O PROJETO RESPONDE E A TAREFA NÃO: "vai fechar?". E a resposta não está na barra de
-- progresso — está na comparação entre quanto andou e quanto do TEMPO já correu. Por isso a
-- coluna `inicio`: sem ela não existe caminho a medir. (No erickIA essa barra lia um campo que
-- ninguém preenchia e ficava vazia para todo projeto, desde sempre, sem erro nenhum.)
--
-- `checkpoints` entra agora, vazia: é onde o acompanhamento semanal vai escrever quando a IA
-- for ligada. Coluna vazia hoje é mais barato do que uma migration no meio daquele trabalho.
--
-- IDEMPOTENTE: `if not exists` em tudo, políticas derrubadas antes de criar.

alter table public.acolitos_tarefas
  add column if not exists tipo text not null default 'tarefa';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'acolitos_tarefas_tipo_check') then
    alter table public.acolitos_tarefas
      add constraint acolitos_tarefas_tipo_check check (tipo in ('tarefa', 'projeto'));
  end if;
end $$;

alter table public.acolitos_tarefas add column if not exists inicio date;
alter table public.acolitos_tarefas add column if not exists checkpoints jsonb;

comment on column public.acolitos_tarefas.tipo is
  'tarefa (atômica) ou projeto (começo, meio e fim, com passos e marcos). Regras: projetos/acolitos/projeto-core.js';
comment on column public.acolitos_tarefas.inicio is
  'Quando o projeto começou. Sem isto não dá para dizer quanto do tempo já correu — e a barra de tempo fica sem resposta, de propósito, em vez de mostrar zero.';

-- ── Os passos (e, quando ganham prazo, os marcos) ────────────────────────────
create table if not exists public.acolitos_tarefa_passos (
  id             uuid primary key default gen_random_uuid(),
  tarefa_id      uuid not null references public.acolitos_tarefas(id) on delete cascade,
  titulo         text not null,
  prazo          date,                       -- com prazo = MARCO; sem prazo = só um passo
  responsavel_id uuid references public.acolitos_membros(id) on delete set null,
  concluido_em   timestamptz,
  ordem          integer not null default 0,
  criado_em      timestamptz not null default now()
);

create index if not exists acolitos_passos_tarefa_idx on public.acolitos_tarefa_passos (tarefa_id);
-- A consulta do acompanhamento: marcos abertos, em ordem de prazo.
create index if not exists acolitos_passos_marcos_idx on public.acolitos_tarefa_passos (prazo)
  where prazo is not null and concluido_em is null;

comment on table public.acolitos_tarefa_passos is
  'Os passos de um projeto. Passo COM prazo é um marco — é por ele que se sabe se o projeto vai fechar. Prova: docs/provas/provar-084-projeto-e-passos.sql';

-- ── A trava: o passo obedece ao TIME da tarefa dele ──────────────────────────
-- Sem isto, a separação por time vazaria pelo passo: bastaria ler os passos para saber o que
-- outro time está fazendo, e escrever neles para mexer no projeto alheio.
alter table public.acolitos_tarefa_passos enable row level security;

drop policy if exists "Passos: coordenação vê e mexe em tudo" on public.acolitos_tarefa_passos;
create policy "Passos: coordenação vê e mexe em tudo"
  on public.acolitos_tarefa_passos for all to authenticated
  using      (coalesce(public.acolitos_get_role(auth.uid()), '') = any (array['coord_admin','subadmin']))
  with check (coalesce(public.acolitos_get_role(auth.uid()), '') = any (array['coord_admin','subadmin']));

drop policy if exists "Passos: equipe só no time dela" on public.acolitos_tarefa_passos;
create policy "Passos: equipe só no time dela"
  on public.acolitos_tarefa_passos for all to authenticated
  using (
    coalesce(public.acolitos_get_role(auth.uid()), '') = 'membro_equipe'
    and exists (select 1 from public.acolitos_tarefas t
                 where t.id = acolitos_tarefa_passos.tarefa_id
                   and t.time_slug = any (coalesce(public.acolitos_meus_times(auth.uid()), '{}'::text[])))
  )
  with check (
    coalesce(public.acolitos_get_role(auth.uid()), '') = 'membro_equipe'
    and exists (select 1 from public.acolitos_tarefas t
                 where t.id = acolitos_tarefa_passos.tarefa_id
                   and t.time_slug = any (coalesce(public.acolitos_meus_times(auth.uid()), '{}'::text[])))
  );

notify pgrst, 'reload schema';
