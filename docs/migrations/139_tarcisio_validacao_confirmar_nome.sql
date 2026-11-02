-- 139: nome incompleto: o robô sugere o nome completo da ficha e aguarda a confirmação.
alter table public.tarcisio_validacao_contato add column if not exists pendente jsonb;
alter table public.tarcisio_validacao_contato drop constraint if exists tarcisio_validacao_contato_situacao_check;
alter table public.tarcisio_validacao_contato add constraint tarcisio_validacao_contato_situacao_check
  check (situacao in ('perguntado','filho_dados','filho_numero','filhos_dados','filhos_celular','confirmar_nome','gravado','revisar','nao_serve'));
