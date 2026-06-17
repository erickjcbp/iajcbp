-- P0 segurança (iajcbp) — Security Advisor
-- 1) View acolitos_frequencia: era SECURITY DEFINER (bypassa RLS) e legível por anon,
--    expondo a frequência de todos os membros sem login. security_invoker=on faz valer a
--    RLS das tabelas-base: authenticated lê tudo (política "Autenticados leem escalas/celebracoes"),
--    anon passa a ver vazio. SELECT do anon também revogado.
alter view public.acolitos_frequencia set (security_invoker = on);
revoke select on public.acolitos_frequencia from anon;

-- 2) Funções de trigger SECURITY DEFINER não devem ser executáveis pela API (rodam como owner
--    no disparo do trigger). Revoga EXECUTE de public/anon/authenticated (não afeta os triggers).
revoke execute on function public._acolitos_medalha_ao_apto() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
