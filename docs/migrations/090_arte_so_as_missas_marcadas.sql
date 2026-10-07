-- Acólitos 090 — escolher quais missas entram na arte da semana
--
-- PEDIDO DO DONO (06/10/2026): poder tirar uma missa específica da arte do fim de semana
-- (ex.: uma celebração que não tem card no PNG, ou que saiu errado), sem apagar a missa
-- nem a escala dela — ela continua normal na aba Escala, só não aparece no PNG.
--
-- Coluna na própria celebração (não na tabela de override litúrgico): a arte lê direto a
-- missa, e o override é opcional e só existe quando tem ajuste de tempo/cor — guardar a
-- exclusão lá obrigaria a criar uma linha só pra isso. NOT NULL default true: toda missa
-- que já existe continua saindo na arte como sempre saiu.
--
-- IDEMPOTENTE: `add column if not exists`.

alter table public.acolitos_celebracoes
  add column if not exists incluir_na_arte boolean not null default true;

comment on column public.acolitos_celebracoes.incluir_na_arte is
  'Desmarcada = a missa fica de fora do PNG da arte da semana, mas continua normal na Escala. Marcado pela coordenação no modal "Arte da semana".';

-- O servidor de consultas só enxerga a coluna nova depois de recarregar.
notify pgrst, 'reload schema';
