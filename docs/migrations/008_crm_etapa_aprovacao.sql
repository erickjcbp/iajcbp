-- Acólitos — nova etapa inicial do CRM: "aprovacao_cadastro"
-- Dinâmica: a pessoa se cadastra e fica aguardando aprovação da coordenação
-- antes de seguir para a integração.

alter table public.acolitos_crm drop constraint acolitos_crm_etapa_check;
alter table public.acolitos_crm add constraint acolitos_crm_etapa_check
  check (etapa in (
    'aprovacao_cadastro','integracao','whatsapp','tunica','disponivel_escala','integrado'
  ));
alter table public.acolitos_crm alter column etapa set default 'aprovacao_cadastro';
