-- Acólitos — as oito tabelas "só por função" também passam a RECUSAR quem não fez login
--
-- Continuação da 055. A varredura que escrevi primeiro tinha um furo: ela só olhava tabelas COM
-- regra de acesso, e por isso achou três. Estas oito não têm regra NENHUMA — o desenho é que
-- ninguém as lê direto, só através de funções `security definer`. Isso está certo, mas deixa o
-- mesmo buraco fino da 051 e da 055: a permissão da tabela continua concedida ao `anon`, e o que
-- segura a leitura é a AUSÊNCIA de regra. No dia em que alguém criar uma regra permissiva sem
-- dizer para quem, o visitante passa a ler.
--
-- Conferido sem sessão em 18/08/2026: as oito devolviam `[]` com HTTP 200 — sucesso com lista
-- vazia, igual a tabela vazia de verdade.
--
--   acolitos_logins              — nomes de usuário (a senha em texto puro caiu na 003)
--   acolitos_ausencias_pendentes — nome, contato e motivo de quem avisa pelo formulário PÚBLICO
--   acolitos_hab_pedidos         — pedidos de habilitação
--   acolitos_campeoes            — campeões de temporada
--   acolitos_xp_temporada        — pontuação por temporada
--   acolitos_presencas_avulsas   — presenças fora de celebração
--   acolitos_semana_override     — ajustes de semana da escala
--   acolitos_substituto_creditos — créditos de quem cobriu vaga
--
-- POR QUE NÃO QUEBRA NADA (conferido antes de mexer):
--   • O formulário público das Ausências escreve em `acolitos_ausencias_pendentes` através de
--     `acolitos_ausencia_publica_enviar`, que é **security definer** — roda como o dono, não
--     como o visitante, e portanto não passa por esta permissão. As outras duas funções
--     públicas (`_buscar` e `_celebracoes`) também são definer. Conferido no banco.
--   • Do lado do app, quem toca nessas tabelas é `config.html`, `conquistas.html`,
--     `destaques.html` e `missoes.html` — as quatro exigem login, e `authenticated` mantém
--     todas as permissões.
revoke all on table public.acolitos_logins              from anon;
revoke all on table public.acolitos_ausencias_pendentes from anon;
revoke all on table public.acolitos_hab_pedidos         from anon;
revoke all on table public.acolitos_campeoes            from anon;
revoke all on table public.acolitos_xp_temporada        from anon;
revoke all on table public.acolitos_presencas_avulsas   from anon;
revoke all on table public.acolitos_semana_override     from anon;
revoke all on table public.acolitos_substituto_creditos from anon;

-- Conferência: nenhuma linha com `anon`; `authenticated` e `service_role` inteiros nas oito.
select grantee, count(distinct table_name) as tabelas
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('acolitos_logins','acolitos_ausencias_pendentes','acolitos_hab_pedidos',
                     'acolitos_campeoes','acolitos_xp_temporada','acolitos_presencas_avulsas',
                     'acolitos_semana_override','acolitos_substituto_creditos')
  and grantee in ('anon','authenticated','service_role')
group by grantee order by grantee;
