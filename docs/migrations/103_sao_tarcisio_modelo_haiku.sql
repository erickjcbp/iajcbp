-- 103 — São Tarcísio usa o Haiku (mais barato; basta para atender pais e redigir avisos).
alter table public.tarcisio_config alter column ia_modelo set default 'claude-haiku-5-5';
update public.tarcisio_config set ia_modelo = 'claude-haiku-5-5' where ia_modelo = 'claude-sonnet-5-5';
