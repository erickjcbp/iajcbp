-- Acólitos — a tarefa recorrente passa a saber de qual conclusão ela nasceu
--
-- Ao concluir uma tarefa que se repete, o app cria a próxima. Até aqui essa próxima nascia
-- SOLTA: nada ligava uma à outra. Consequência prática: ao reabrir uma conclusão, o app só
-- conseguia avisar "se a próxima já foi criada, ela continua existindo" — não conseguia dizer
-- QUAL é, nem oferecer apagá-la. E adivinhar por título e prazo seria pior que não oferecer:
-- apagaria a tarefa errada num dia de azar.
--
-- `on delete set null`: apagar a tarefa de origem NÃO pode levar a próxima junto. Elas são
-- trabalho de semanas diferentes; sumir com a de agora porque alguém arrumou o histórico seria
-- perder serviço combinado.
alter table public.acolitos_tarefas
  add column if not exists origem_id uuid references public.acolitos_tarefas(id) on delete set null;

-- Reabrir procura a filha por aqui, e só entre as não concluídas.
create index if not exists acolitos_tarefas_origem_idx
  on public.acolitos_tarefas (origem_id) where concluida_em is null;

-- Conferência: a coluna tem de aparecer.
select column_name from information_schema.columns
where table_name = 'acolitos_tarefas' and column_name = 'origem_id';
