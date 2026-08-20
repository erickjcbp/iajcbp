-- Acólitos — cada time passa a ver só as tarefas DELE
--
-- Até aqui a trava das tarefas olhava só o PAPEL: quem fosse coord_admin, subadmin ou
-- membro_equipe lia e escrevia TODAS as tarefas de TODOS os onze times. E entrar em qualquer
-- time promove a pessoa a membro_equipe automaticamente — ou seja, quem entrasse no
-- Almoxarifado podia apagar tarefa da Coordenação. O que segurava isso era a aba exigir a
-- permissão `tarefas`, que nasce desmarcada: um portão na TELA, não no dado. Filtro de tela
-- esconde, não protege — quem soubesse consultar continuaria lendo tudo.
--
-- Feito agora, com a tabela VAZIA (zero tarefas em 20/08/2026), de propósito: errar aqui
-- depois, com o quadro cheio, esconderia trabalho real de gente real.
--
-- ATENÇÃO ao mexer nisto no futuro: política de RLS errada NÃO dá erro. Ela devolve lista
-- vazia, e a tela diz "nenhuma tarefa" como se estivesse tudo em dia. Este projeto já levou
-- esse golpe. Prove rodando (fingindo ser cada papel), nunca lendo o SQL.

-- ── 1. Quais são os times desta pessoa ───────────────────────────────────────
-- SECURITY DEFINER porque a política precisa ler `acolitos_membros`, que tem trava própria:
-- sem isto a política tropeçaria na trava da tabela que ela mesma consulta. Mesmo molde da
-- irmã `acolitos_get_role`.
create or replace function public.acolitos_meus_times(uid uuid)
  returns text[]
  language sql
  stable security definer
  set search_path to 'public'
as $$
  select coalesce(m.setores, '{}'::text[])
  from public.acolitos_membros m
  where m.user_id = uid
  limit 1;
$$;

-- Visitante sem login não executa. Este projeto já teve 64 funções SECURITY DEFINER abertas
-- ao anônimo; função nova não repete isso.
revoke all on function public.acolitos_meus_times(uuid) from public;
revoke all on function public.acolitos_meus_times(uuid) from anon;
grant execute on function public.acolitos_meus_times(uuid) to authenticated;

-- ── 2. As travas da tabela de tarefas ────────────────────────────────────────
drop policy if exists "Tarefas leitura coordenacao" on public.acolitos_tarefas;
drop policy if exists "Tarefas escrita coordenacao" on public.acolitos_tarefas;
-- E as novas também: assim rodar esta migration duas vezes não estoura. Migration que só
-- funciona na primeira tentativa vira armadilha no dia em que alguém precisar reaplicar.
drop policy if exists "Tarefas: coordenação vê e mexe em tudo" on public.acolitos_tarefas;
drop policy if exists "Tarefas: equipe só no time dela" on public.acolitos_tarefas;

-- A coordenação continua vendo e mexendo em tudo: é ela que distribui o trabalho e precisa
-- do quadro inteiro.
create policy "Tarefas: coordenação vê e mexe em tudo"
  on public.acolitos_tarefas for all to authenticated
  using      (public.acolitos_get_role(auth.uid()) = any (array['coord_admin','subadmin']))
  with check (public.acolitos_get_role(auth.uid()) = any (array['coord_admin','subadmin']));

-- Quem é de time vê e mexe SÓ no que é do time dela. As duas metades importam:
--   `using`      → quais linhas ela enxerga e pode alterar/apagar;
--   `with check` → como a linha pode FICAR depois de criada ou editada.
-- Sem o `with check`, ela editaria uma tarefa do time dela e trocaria o time para outro — ou
-- puxaria uma tarefa de outro time para o dela. A separação vazaria pela edição, não pela
-- leitura, que é o buraco que ninguém procura.
create policy "Tarefas: equipe só no time dela"
  on public.acolitos_tarefas for all to authenticated
  using (
    public.acolitos_get_role(auth.uid()) = 'membro_equipe'
    and time_slug = any (public.acolitos_meus_times(auth.uid()))
  )
  with check (
    public.acolitos_get_role(auth.uid()) = 'membro_equipe'
    and time_slug = any (public.acolitos_meus_times(auth.uid()))
  );

-- ── 3. Conferência (só leitura; rode depois de aplicar) ──────────────────────
-- Espera-se: duas políticas, ambas para `authenticated`, e a função sem execução para anon.
select polname, polcmd, polroles::regrole[] as papeis
from pg_policy where polrelid = 'public.acolitos_tarefas'::regclass
order by polname;

select has_function_privilege('anon',          'public.acolitos_meus_times(uuid)', 'execute') as anon_executa,
       has_function_privilege('authenticated', 'public.acolitos_meus_times(uuid)', 'execute') as logado_executa;
