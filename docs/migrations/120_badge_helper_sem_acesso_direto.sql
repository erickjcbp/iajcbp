-- 120: `_badge_data_ganho` (migration 119) é SECURITY DEFINER e lê data_nascimento de qualquer
-- membro. O Supabase concede EXECUTE a authenticated por padrão, então qualquer conta logada
-- poderia chamá-la por RPC com o id de outro membro. Só as funções definer
-- `acolitos_badges_registrar` e o backfill (dono do banco) precisam dela.
revoke all on function public._badge_data_ganho(uuid, jsonb) from public, anon, authenticated;
