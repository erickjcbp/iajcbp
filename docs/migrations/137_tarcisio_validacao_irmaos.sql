-- 137: a validação de contato também atende famílias com mais de um filho na pastoral.
alter table public.tarcisio_validacao_contato add column if not exists filhos jsonb not null default '[]'::jsonb;
alter table public.tarcisio_validacao_contato drop constraint if exists tarcisio_validacao_contato_situacao_check;
alter table public.tarcisio_validacao_contato add constraint tarcisio_validacao_contato_situacao_check
  check (situacao in ('perguntado','filho_dados','filho_numero','filhos_dados','filhos_celular','gravado','revisar','nao_serve'));
