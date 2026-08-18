-- ============================================================
-- ACÓLITOS — colar TUDO isto de uma vez no SQL Editor do Supabase
-- Gerado em 18/08/2026. É seguro rodar duas vezes.
-- 048: a tabela das Tarefas dos times (a aba já está no ar esperando por ela)
-- 049: convocar um evento por time da pastoral (cria função nova, não toca em nada)
-- ============================================================

-- Acólitos — Tarefas dos times
-- Cada tarefa pertence a um TIME (obrigatório) e opcionalmente a um responsável.
-- O time é o mesmo 'setor' que já existe em acolitos_listas (tipo='setor') e no campo
-- setores de acolitos_membros — não se cria catálogo novo.
create table if not exists public.acolitos_tarefas (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  time_slug     text not null,                      -- valor de acolitos_listas tipo='setor'
  responsavel_id uuid references public.acolitos_membros(id) on delete set null,
  prazo         date,
  observacao    text,
  recorrencia   text not null default 'nenhuma'
                check (recorrencia in ('nenhuma','semanal','mensal','anual','celebracao')),
  concluida_em  timestamptz,
  concluida_por uuid references public.acolitos_membros(id) on delete set null,
  criada_em     timestamptz not null default now(),
  criada_por    uuid
);

-- A tela abre agrupando por time e destacando atrasadas: os dois filtros da lista.
create index if not exists acolitos_tarefas_time_idx  on public.acolitos_tarefas (time_slug);
create index if not exists acolitos_tarefas_prazo_idx on public.acolitos_tarefas (prazo)
  where concluida_em is null;

alter table public.acolitos_tarefas enable row level security;

-- Quem lê e escreve é a coordenação com a permissão do módulo. Mesmo desenho das irmãs:
-- o helper acolitos_get_role, e não um join inline.
do $$ begin
  if not exists (select 1 from pg_policies
    where tablename='acolitos_tarefas' and policyname='Tarefas leitura coordenacao') then
    create policy "Tarefas leitura coordenacao" on public.acolitos_tarefas
      for select to authenticated
      using (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
  if not exists (select 1 from pg_policies
    where tablename='acolitos_tarefas' and policyname='Tarefas escrita coordenacao') then
    create policy "Tarefas escrita coordenacao" on public.acolitos_tarefas
      for all to authenticated
      using      (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'))
      with check (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

-- ============================================================

-- Acólitos — convocar um evento por TIME, não só por nível
--
-- Hoje a Agenda convoca por nível ("guardião pra cima"). Convocar "o time de Formação" não
-- era possível: a função que monta a lista de convocados só entende níveis, e o roster que a
-- tela recebe traz apenas id e nome — sem os setores, não dá para resolver no navegador.
--
-- Esta migration é ADITIVA de propósito: cria uma função NOVA e não toca em
-- acolitos_ensaio_convocados nem em nenhuma outra. Se algo der errado, basta não usá-la.
create or replace function public.acolitos_membros_por_setor(p_setores text[])
returns table (id uuid, nome text)
language sql
security definer
set search_path = public
as $$
  -- security definer porque membro comum não lê acolitos_membros direto (a RLS barra), e
  -- esta função devolve só id e nome — o mesmo que acolitos_roster_nomes já devolve a todos.
  select m.id, m.nome
  from public.acolitos_membros m
  where m.status = 'ativo'
    and p_setores is not null
    and array_length(p_setores, 1) > 0
    and m.setores && p_setores
  order by m.nome;
$$;

-- 'from public, anon' como as irmãs: revogar só de public deixaria o visitante NÃO logado
-- executando a função, que é exatamente o buraco já registrado neste projeto.
revoke all on function public.acolitos_membros_por_setor(text[]) from public, anon;
grant execute on function public.acolitos_membros_por_setor(text[]) to authenticated;

-- Conferência rápida depois de rodar: as duas linhas abaixo devem devolver 1 cada.
select count(*) as tabela_tarefas_existe from information_schema.tables where table_name = 'acolitos_tarefas';
select count(*) as funcao_por_setor_existe from pg_proc where proname = 'acolitos_membros_por_setor';
