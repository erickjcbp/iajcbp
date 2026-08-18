-- Acólitos — a tarefa passa a ter TRÊS estados, não dois
--
-- Hoje a tabela só sabe se a tarefa foi concluída (`concluida_em` preenchido ou não). Para o
-- quadro de A fazer / Em andamento / Feita falta o estado do meio: alguém pegou e está tocando.
--
-- `andamento_em` guarda QUANDO foi para "em andamento" e `andamento_por` QUEM pegou — as duas
-- no mesmo formato de `concluida_em`/`concluida_por`, para a coluna ser lida do mesmo jeito.
-- Não se cria coluna `status` de texto: o estado sai das datas, então não há como a tabela
-- ficar dizendo "em andamento" numa linha que já tem data de conclusão.
alter table public.acolitos_tarefas
  add column if not exists andamento_em  timestamptz,
  add column if not exists andamento_por uuid references public.acolitos_membros(id) on delete set null;

-- O quadro abre filtrando as não concluídas e separando quem já está em andamento.
create index if not exists acolitos_tarefas_andamento_idx
  on public.acolitos_tarefas (andamento_em) where concluida_em is null;

-- ── Quem pode ser responsável por uma tarefa ─────────────────────────
-- Decisão do dono em 18/08/2026: só quem está DE FATO num time E é da equipe. Antes a lista
-- de responsáveis trazia os 176 membros, e escolher alguém de fora do time criava uma cobrança
-- que a pessoa nem sabia que existia.
--
-- Precisa ser função no servidor porque `acolitos_roster_nomes` devolve só id e nome — sem os
-- setores e sem `eh_equipe`, não dá para aplicar a regra no navegador. E membro comum não lê
-- `acolitos_membros` direto (a RLS barra), daí o security definer.
--
-- Devolve os setores junto para a TELA filtrar por time sem uma segunda ida ao servidor.
create or replace function public.acolitos_responsaveis_de_tarefa()
returns table (id uuid, nome text, apelido text, setores text[])
language sql
security definer
set search_path = public
as $$
  select m.id, m.nome, m.apelido, m.setores
  from public.acolitos_membros m
  where m.status = 'ativo'
    and m.eh_equipe is true
    and m.setores is not null
    and array_length(m.setores, 1) > 0
  order by coalesce(m.apelido, m.nome);
$$;

-- 'from public, anon' como as irmãs: revogar só de public deixaria o visitante sem login
-- executando a função.
revoke all on function public.acolitos_responsaveis_de_tarefa() from public, anon;
grant execute on function public.acolitos_responsaveis_de_tarefa() to authenticated;

-- Conferência: as duas colunas devem aparecer.
select column_name from information_schema.columns
where table_name = 'acolitos_tarefas' and column_name in ('andamento_em','andamento_por');
-- e a função nova deve existir (tem que devolver 1):
select count(*) as funcao_responsaveis from pg_proc where proname = 'acolitos_responsaveis_de_tarefa';
