-- Acólitos 086 — a arte da escala pode sair em DUAS imagens (sábado e domingo)
--
-- PEDIDO DO DONO (28/09/2026): o fim de semana de 3-4/10 tem 6 missas e 88 nomes; a arte
-- (quadro fixo de 2160×4800) cortou o domingo 19h. Decisão dele: "somente quando precisar,
-- duas artes" — nada de encolher a letra.
--
-- `png_url` continua sendo a arte única, ou a do SÁBADO quando dividiu. `png_url_domingo` é
-- NULA na arte única. Assim quem só conhece `png_url` (versão antiga do app aberta num
-- celular, o vigia da segunda) continua achando uma imagem válida em vez de um buraco.
--
-- Privilégios: a leitura de `acolitos_escala_artes` é por RLS (authenticated), no nível da
-- tabela; quem escreve é o gerador com a chave de serviço. Nada de GRANT aqui.

alter table public.acolitos_escala_artes
  add column if not exists png_url_domingo text;

comment on column public.acolitos_escala_artes.png_url_domingo is
  'Arte do domingo quando o fim de semana não coube numa imagem só; NULA na arte única (png_url).';
