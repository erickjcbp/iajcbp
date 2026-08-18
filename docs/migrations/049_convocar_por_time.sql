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
