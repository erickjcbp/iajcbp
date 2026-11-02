-- 134: a validação de contato também conduz a conversa com pai ou mãe de quem serve.
alter table public.tarcisio_validacao_contato drop constraint if exists tarcisio_validacao_contato_situacao_check;
alter table public.tarcisio_validacao_contato add constraint tarcisio_validacao_contato_situacao_check
  check (situacao in ('perguntado','filho_dados','filho_numero','gravado','revisar','nao_serve'));
