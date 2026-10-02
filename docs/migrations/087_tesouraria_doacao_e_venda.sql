-- Acólitos 087 — a Tesouraria passa a ter os MESMOS tipos de entrada que a aba Retiros usa
--
-- PEDIDO DO DONO (02/10/2026): "a tesouraria precisa estar ligada aos tipos de entrada
-- também (venda de item, doação...), as duas precisam se conversar; e se for lançado pela
-- Tesouraria, permitir vincular a um retiro, formação ou espiritualidade".
--
-- Antes os Retiros gravavam doação como 'dizimo' (Dízimo/Doação) e venda como 'rifa'
-- (Rifa/Venda): categorias que existiam, mas misturavam coisas. Agora existem 'doacao' e
-- 'venda_item', e AS DUAS TELAS usam as mesmas. As antigas ficam (a Tesouraria estava vazia,
-- mas a lista é do dono e ele pode já ter dado outro uso a elas).
-- A tela lê as categorias DESTA tabela quando há alguma (o banco manda no código).
insert into public.acolitos_listas (tipo, valor, label) values
  ('cat_entrada', 'doacao',     'Doação'),
  ('cat_entrada', 'venda_item', 'Venda de item')
on conflict (tipo, valor) do nothing;
