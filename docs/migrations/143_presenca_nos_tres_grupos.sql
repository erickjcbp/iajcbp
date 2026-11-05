-- Presença da ficha em cada grupo do WhatsApp, com a data da última conferência pela lista real de participantes.
-- no_grupo_whatsapp passa a significar só "grupo dos servos" (Acólitos e Coroinhas); não é renomeada para não quebrar o CRM e o robô.
-- Grupo de Cerimoniários vale para quem atingiu cerimoniario_aspirante ou acima (acolitos_nivel_cerimoniario).
-- Colunas novas nascem protegidas pela trava 138: só coord_admin, subadmin e o robô (service role) gravam.
begin;
alter table public.acolitos_membros
  add column if not exists no_grupo_pais boolean not null default false,
  add column if not exists no_grupo_cerimoniarios boolean not null default false,
  add column if not exists grupo_servo_conferido_em timestamptz,
  add column if not exists grupo_pais_conferido_em timestamptz,
  add column if not exists grupo_cerimoniarios_conferido_em timestamptz;
comment on column public.acolitos_membros.no_grupo_whatsapp is 'Número da ficha está no grupo dos servos (Acólitos e Coroinhas). Conferido pela lista real de participantes.';
comment on column public.acolitos_membros.no_grupo_pais is 'Número do responsável está no grupo de Pais. Conferido pela lista real de participantes.';
comment on column public.acolitos_membros.no_grupo_cerimoniarios is 'Número da ficha está no grupo de Cerimoniários (só se aplica a quem tem acolitos_nivel_cerimoniario).';

create or replace function public.acolitos_nivel_cerimoniario(p_nivel text)
returns boolean language sql immutable as $$
  select coalesce(p_nivel in ('cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'), false)
$$;
commit;
notify pgrst, 'reload schema';
