-- 102 — O robô avisa se tem chave da IA (Configurações mostra "IA sem chave" em vez de calar)
alter table public.tarcisio_config add column ia_disponivel boolean not null default false;
