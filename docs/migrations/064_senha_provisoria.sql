-- 064 — a marca de "senha provisória".
--
-- Em 30/08/2026 foram criados 138 logins para quem já estava no cadastro da pastoral e
-- ainda não tinha conta nenhuma. Todos nasceram com a MESMA senha, impressa numa folha
-- entregue às famílias. Enquanto uma criança não trocar, quem tiver a folha na mão entra
-- na conta dela — por isso a troca não pode ser um convite, tem de ser um portão.
--
-- Esta coluna é o portão. Verdadeira = o app abre na tela "crie sua senha" e não passa
-- dali. Cai sozinha quando a pessoa troca. Nasce FALSA de propósito: ninguém que já usa
-- o app pode ser empurrado para essa tela — a carga em lote é que marca as 138.
--
-- Ela também serve à coordenação: Config › Logins mostra quem ainda não entrou pela
-- primeira vez, que é como se cobra as famílias que ficaram para trás.
alter table public.acolitos_membros
  add column if not exists senha_provisoria boolean not null default false;

comment on column public.acolitos_membros.senha_provisoria is
  'Verdadeira enquanto a pessoa ainda usa a senha impressa da folha de acesso. O app não deixa passar da tela "crie sua senha" enquanto isto for verdadeiro.';

create index if not exists acolitos_membros_senha_provisoria
  on public.acolitos_membros (senha_provisoria) where senha_provisoria;
