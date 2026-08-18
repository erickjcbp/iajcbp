-- Acólitos — a tabela das Tarefas passa a RECUSAR quem não fez login, em vez de devolver
-- lista vazia.
--
-- Conferido em 18/08/2026 pela chave pública do site, sem sessão nenhuma. As irmãs recusam:
--   acolitos_membros    → 42501 permission denied for function acolitos_meu_grupo
--   acolitos_escalas    → 42501 permission denied for function acolitos_get_role
--   acolitos_ausencias  → 42501 permission denied for function acolitos_meu_grupo
--   acolitos_listas     → 42501 permission denied for function acolitos_get_role
-- A acolitos_tarefas respondia `[]` com HTTP 200 — exatamente igual a uma tabela vazia.
--
-- NÃO é vazamento: nenhuma linha sai, e a escrita já recusava (42501, "new row violates
-- row-level security policy", conferido no mesmo teste). O que está errado é a RESPOSTA:
-- "recusado" e "não há nada" são coisas diferentes, e neste app é essa diferença que decide
-- o que a tela escreve — "não foi possível carregar as tarefas" ou "nenhuma tarefa por aqui".
-- Dizer "está tudo em dia" quando não se conseguiu perguntar é o defeito que mais se repete
-- aqui, e é ele que esta migration fecha na porta do banco.
--
-- A causa: as duas políticas da 048 são `to authenticated`. Para o papel `anon` não existe
-- política nenhuma, então o Postgres não avalia nada, nunca chama o `acolitos_get_role` — que
-- é justamente quem recusa nas irmãs — e devolve zero linha calado. Tirar a permissão da
-- tabela do `anon` recusa antes de qualquer política ser consultada.
--
-- Quem fez login não é afetado: a permissão de `authenticated` continua intacta, e quem está
-- logado sem ser da coordenação segue vendo lista vazia, igual às irmãs.
revoke all on table public.acolitos_tarefas from anon;

-- Conferência: tem de sobrar `authenticated` e NÃO pode sobrar `anon`.
select grantee, string_agg(privilege_type, ', ' order by privilege_type) as permissoes
from information_schema.role_table_grants
where table_name = 'acolitos_tarefas' and grantee in ('anon', 'authenticated')
group by grantee order by grantee;
