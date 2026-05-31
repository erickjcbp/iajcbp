-- Acólitos — campo 'nivel' (rank da jornada, 10 níveis)
-- Distinto do 'role' (acesso). Driva os patches/jornada/level-up.
-- Valores: aspirante, coroinha, acolito_aspirante, acolito_guardiao,
-- acolito_sentinela, aspirante_cerimoniario, cerimoniario_aspirante,
-- cerimoniario_guardiao, cerimoniario_magistral, cerimoniario_mor.

alter table public.acolitos_membros
  add column if not exists nivel text;
