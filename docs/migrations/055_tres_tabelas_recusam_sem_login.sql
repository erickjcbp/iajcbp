-- Acólitos — mais três tabelas passam a RECUSAR quem não fez login
--
-- Mesmo defeito que a 051 fechou na `acolitos_tarefas`, encontrado nas outras 39 tabelas em
-- 18/08/2026 lendo a estrutura inteira do banco. Conferido na prática, sem sessão: as três
-- devolviam `[]` com HTTP 200 — sucesso com lista vazia, indistinguível de tabela vazia.
--
--   acolitos_push_subs         — endereço e chaves de notificação do celular de cada pessoa
--   acolitos_escala_artes      — as artes da escala geradas
--   acolitos_liturgia_override — ajustes de tempo litúrgico
--
-- NÃO vaza linha hoje: as regras de cada uma são `to authenticated`, então o visitante não é
-- avaliado por nenhuma e leva zero linha. Mas é uma trava fina demais para o que a primeira
-- guarda. A permissão da TABELA continua concedida ao `anon`; a única coisa entre o visitante e
-- os dados é a cláusula `to authenticated` de cada regra. Uma regra nova escrita sem ela — e é
-- fácil esquecer — abre a leitura do endereço de push e das chaves do aparelho de cada coroinha.
--
-- Tirando a permissão da tabela, a recusa passa a acontecer na porta, antes de qualquer regra
-- ser consultada. É o mesmo remédio da 051, e pela mesma razão: "vazio" e "recusado" se parecem
-- na tela e significam coisas opostas.
--
-- QUEM USA ESSAS TRÊS (conferido antes de mexer):
--   • de dentro do app, com login — `escala.html` e `shared.js`;
--   • do servidor — `api/enviar-push.js`, `api/cron-vigia-arte.js` e `arte-escala/gerar.mjs`,
--     todos com a chave de serviço, que não passa por aqui.
-- Nenhuma tela pública lê qualquer uma delas. A das Ausências Públicas, que é a única sem
-- login, não toca em nenhuma.
revoke all on table public.acolitos_push_subs         from anon;
revoke all on table public.acolitos_escala_artes      from anon;
revoke all on table public.acolitos_liturgia_override from anon;

-- Conferência: `authenticated` e `service_role` TÊM de continuar; `anon` não pode aparecer.
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as permissoes
from information_schema.role_table_grants
where table_name in ('acolitos_push_subs','acolitos_escala_artes','acolitos_liturgia_override')
  and grantee in ('anon','authenticated','service_role')
group by table_name, grantee order by table_name, grantee;
