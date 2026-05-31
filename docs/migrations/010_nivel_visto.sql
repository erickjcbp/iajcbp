-- Acólitos — coluna p/ celebração de level-up
-- Guarda o último nível que o membro JÁ VIU. Se o nível atual (role em
-- pastoral_members) for maior na jornada que o nivel_visto, mostra a
-- celebração "Parabéns, você avançou!" e atualiza nivel_visto.

alter table public.acolitos_membros
  add column if not exists nivel_visto text;
