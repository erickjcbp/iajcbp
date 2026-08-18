-- Acólitos — quem pode ser responsável por uma tarefa: basta estar num time
--
-- A 050 exigia `eh_equipe is true` E estar num time. Só 4 dos 176 membros têm `eh_equipe`, então
-- na prática dava para responsabilizar quatro pessoas — num recurso feito para 11 times. Quem o
-- dono pusesse num time pelo organograma das Casas continuava fora da lista, sem explicação.
--
-- A decisão do dono em 18/08/2026 foi "só quem está DE FATO num time". `eh_equipe` não é isso:
-- é a marca de coordenação, usada para outra coisa no resto do app. Estar num time é ter
-- `setores` preenchido, que é exatamente o que o organograma das Casas grava.
--
-- Vai junto com a mudança da barra de navegação (navegacao-core.js, mesma data): permissão de
-- módulo passou a valer também na barra, então liberar "Tarefas dos times" para alguém que não é
-- da equipe finalmente faz alguma coisa. As duas pontas tinham de mudar juntas — arrumar só uma
-- deixaria a pessoa vendo a aba e não podendo ser responsável, ou o contrário.
create or replace function public.acolitos_responsaveis_de_tarefa()
returns table (id uuid, nome text, apelido text, setores text[])
language sql
security definer
set search_path = public
as $$
  select m.id, m.nome, m.apelido, m.setores
  from public.acolitos_membros m
  where m.status = 'ativo'
    and m.setores is not null
    and array_length(m.setores, 1) > 0
  order by coalesce(m.apelido, m.nome);
$$;

-- As permissões não vêm junto do `create or replace`: reaplicadas como na 050.
revoke all on function public.acolitos_responsaveis_de_tarefa() from public, anon;
grant execute on function public.acolitos_responsaveis_de_tarefa() to authenticated;

-- Conferência: tem de devolver bem mais que 4. Se devolver 4, a coluna `setores` está vazia
-- para quase todo mundo — e aí o problema é outro (ninguém foi posto num time ainda).
select count(*) as podem_ser_responsaveis from public.acolitos_responsaveis_de_tarefa();
