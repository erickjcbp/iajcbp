-- 133: validação dos números dos grupos: quem não foi identificado responde nome completo e idade.
-- Só o robô (chave de serviço) lê e grava: nenhuma política para usuários do app.
create table if not exists public.tarcisio_validacao_contato (
  numero text primary key,
  grupo text not null,
  situacao text not null default 'perguntado'
    check (situacao in ('perguntado','gravado','revisar','nao_serve')),
  tentativas int not null default 0,
  teste boolean not null default false,
  resposta text,
  nome_informado text,
  idade_informada int,
  membro_id uuid references public.acolitos_membros(id) on delete set null,
  motivo text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.tarcisio_validacao_contato enable row level security;
