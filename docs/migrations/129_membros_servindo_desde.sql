-- 129 — Tempo de serviço: "servindo desde" por membro (2026-11-01)
-- Origem: primeira aparição do nome nas planilhas de escala do Drive (set/2022 a jun/2026), validada pelo dono;
-- quem entrou depois da importação do app (01/06/2026) usa a data do cadastro. Só colunas novas, sem apagar nada.
begin;
alter table public.acolitos_membros
  add column if not exists servindo_desde date,
  add column if not exists servindo_desde_ou_antes boolean not null default false,
  add column if not exists servindo_desde_fonte text,
  add column if not exists escalas_planilhas integer,
  add column if not exists meses_escalados_planilhas integer,
  add column if not exists ultima_escala_planilha date;
alter table public.acolitos_membros drop constraint if exists acolitos_membros_servindo_desde_fonte_check;
alter table public.acolitos_membros add constraint acolitos_membros_servindo_desde_fonte_check
  check (servindo_desde_fonte is null or servindo_desde_fonte in ('planilhas','cadastro_app','manual'));
comment on column public.acolitos_membros.servindo_desde is 'Data da primeira escala conhecida (planilhas do Drive) ou do cadastro, para quem entrou depois do app.';
comment on column public.acolitos_membros.servindo_desde_ou_antes is 'true quando a data é a da planilha mais antiga (set/2022): a entrada real pode ser anterior.';
commit;
