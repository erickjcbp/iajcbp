-- 060 — "Já foi investido?" passa a morar no app.
--
-- Até 26/08/2026 essa resposta só existia na coluna INVESTIDURA de uma planilha
-- de Excel, que o app não sabia que existia. A partir daqui o app é o dono da
-- resposta e a planilha vira uma foto tirada dele.
--
-- Fica ao lado dos outros marcos da caminhada (batismo, primeira eucaristia,
-- crisma) e segue o mesmo formato deles: sim ou não, nascendo "não".
--
-- SEM VALOR PADRÃO, de propósito. Se a coluna nascesse "não", quem nunca
-- respondeu ficaria idêntico a quem respondeu que não — e o "Complete seu
-- cadastro" só pergunta o que está REALMENTE em branco, então ele nunca
-- perguntaria isso a ninguém. Em branco significa "ainda não perguntamos".
-- As 189 pessoas que já estão no app receberam a resposta da planilha na
-- carga inicial; quem chegar daqui pra frente nasce em branco e é perguntado.
--
-- Permissões: medidas antes. A tabela é liberada no nível da TABELA
-- (relacl), sem nenhuma coluna com permissão própria (attacl), então a coluna
-- nova herda o acesso e nenhuma linha deixa de ser lida. RLS continua ligada,
-- com as mesmas 7 políticas — coluna nova não precisa de política nova.

alter table public.acolitos_membros
  add column if not exists investido boolean;

alter table public.acolitos_membros
  alter column investido drop default;

comment on column public.acolitos_membros.investido is
  'Se a pessoa já foi investida. O app é a fonte desde 27/08/2026; antes vivia só na planilha da escala.';
