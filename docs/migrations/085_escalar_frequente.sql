-- Acólitos 085 — a marca "frequente": quem o gerador escala um pouco mais que o normal
--
-- PEDIDO DO DONO (23/09/2026): "eu marco uma opção 'frequente' que vc vai passar a escalar
-- com mais frequência que o normal", para poucas pessoas (5-10), na aba de Disponibilidade
-- da ficha do membro.
--
-- POR QUE NÃO VAI EM `acolitos_disponibilidade`, que seria o lugar óbvio: ao salvar a ficha,
-- o app APAGA todas as linhas de disponibilidade da pessoa e grava de novo
-- (`membros.html`, perto da linha 1048). Uma coluna ali seria varrida a cada salvamento — e
-- de um jeito silencioso, porque o salvamento continuaria dando certo. A marca é UMA por
-- pessoa, não uma por faixa de horário, então o lugar dela é aqui.
--
-- O QUE ELA FAZ, medido e decidido com o dono: o rodízio compara um número só
-- (`carga[id]` = vezes no mês × 1000 + janela de 6 semanas). Um frequente conta como se
-- tivesse servido MEIA VEZ A MENOS no mês. Meia, e não uma: assim ele passa na frente de
-- quem também já cumpriu a regra dos 2× por mês, e NUNCA na frente de quem ainda está
-- devendo. O bônus se esgota sozinho em ~1 turno por mês (2 → 2,5 → 3 cai atrás de quem
-- está em 2), sem teto escrito no código.
--
-- NÃO há teto no banco de propósito: o dono escolheu "avisa e deixa passar". A tela mostra
-- "N de 10 marcados" e avisa o custo ao passar de 10, mas grava. Um CHECK aqui derrubaria a
-- transação INTEIRA do salvamento da ficha, por causa de uma preferência.
--
-- Privilégios: `acolitos_membros` tem GRANT no nível da TABELA (não por coluna), então a
-- coluna nova já nasce visível para quem lê a tabela. Nada de GRANT aqui.

ALTER TABLE public.acolitos_membros
  ADD COLUMN IF NOT EXISTS escalar_frequente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.acolitos_membros.escalar_frequente IS
  'Marcado na aba Disponibilidade da ficha: o gerador conta esta pessoa como meia vez a menos no mês, então ela serve ~1 vez a mais por mês — sem nunca passar na frente de quem ainda deve os 2x do mês.';
