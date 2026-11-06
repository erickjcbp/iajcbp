-- Ritmo conservador depois da restrição do WhatsApp (05/11/2026).
-- O WhatsApp restringiu o número do Tarcísio por ~20 h: dia com 86 envios (média ~35) e mudanças de grupo em série.
--  1) pausa_grupos_ate: enquanto estiver no futuro, o robô NÃO entra nem sai de grupo (guarda-grupos.mjs);
--  2) tarcisio_grupo_operacoes: registro das entradas/saídas (o robô só faz 1 a cada 30 min e 3 números por 24 h);
--  3) pausa de grupos até 08/11/2026 00:00 UTC e teto diário de envios de 150 para 70 (maior dia normal: 49).
-- Tudo reversível pelo painel/SQL: a pausa é só uma data; o teto é a configuração de sempre.
begin;

alter table public.tarcisio_config add column if not exists pausa_grupos_ate timestamptz;
comment on column public.tarcisio_config.pausa_grupos_ate is 'Enquanto no futuro, o robô não entra nem sai de grupo de WhatsApp (guarda-grupos.mjs).';

create table if not exists public.tarcisio_grupo_operacoes (
  id uuid primary key default gen_random_uuid(),
  quando timestamptz not null default now(),
  acao text not null check (acao in ('adicionar', 'remover')),
  papel text,
  qtd int not null default 1 check (qtd > 0),
  numeros_fim text[] not null default '{}'   -- só os 4 últimos dígitos: nada de número inteiro aqui
);
create index if not exists tarcisio_grupo_operacoes_quando on public.tarcisio_grupo_operacoes (quando desc);

alter table public.tarcisio_grupo_operacoes enable row level security;
drop policy if exists "Coordenacao le" on public.tarcisio_grupo_operacoes;
create policy "Coordenacao le" on public.tarcisio_grupo_operacoes for select using (tarcisio_pode_gerir());
revoke all on public.tarcisio_grupo_operacoes from anon;
grant select on public.tarcisio_grupo_operacoes to authenticated;
grant all on public.tarcisio_grupo_operacoes to service_role;

update public.tarcisio_config set pausa_grupos_ate = '2026-11-08T00:00:00Z' where id = 1;
update public.tarcisio_config set teto_diario = 70 where id = 1 and teto_diario > 70;

commit;
