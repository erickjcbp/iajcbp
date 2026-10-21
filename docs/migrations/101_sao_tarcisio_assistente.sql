-- 101 — São Tarcísio: assistente de IA que responde no WhatsApp (2026-10-20)
-- Projeto: docs/superpowers/specs/2026-10-20-sao-tarcisio-whatsapp-design.md (Fase 2)
-- O robô (service_role) grava conversas e pendências; a coordenação lê e decide.

-- 1) Persona e chaves da IA (tudo DESLIGADO até o dono ligar em Configurações)
alter table public.tarcisio_config
  add column respostas_ligadas boolean not null default false,
  add column variar_textos boolean not null default false,
  add column persona_nome text not null default 'São Tarcísio',
  add column persona_tom text not null default 'Acolhedor, simples e respeitoso, como um coordenador jovem da pastoral falando com famílias da paróquia. Frases curtas, sem gírias, no máximo um emoji.',
  add column persona_regras text not null default 'Nunca invente horário, data ou função: use só o que as ferramentas devolvem. Se não souber, diga que vai passar para a coordenação. Não fale de outros servos além dos ligados a este número. Assuntos fora da pastoral: responda com gentileza que este número é só da pastoral.',
  add column ia_modelo text not null default 'claude-sonnet-5-5';

-- 2) Mensagens que entram e saem (o histórico que a IA lê e que a coordenação confere)
create table public.tarcisio_mensagens (
  id uuid primary key default gen_random_uuid(),
  numero text not null,                              -- só dígitos, com 55
  direcao text not null check (direcao in ('entrada','saida')),
  texto text,
  midia text,                                        -- audio/imagem/… recebido (a IA pede texto)
  external_id text unique,                           -- id da mensagem no WhatsApp (evita repetir)
  membro_ids uuid[] not null default '{}',           -- servos ligados ao número naquele momento
  ferramentas jsonb,                                 -- o que a IA consultou/fez para responder
  respondida boolean not null default false,         -- entrada já tratada pela IA
  created_at timestamptz not null default now()
);
create index tarcisio_mensagens_numero on public.tarcisio_mensagens (numero, created_at desc);
create index tarcisio_mensagens_a_responder on public.tarcisio_mensagens (created_at) where direcao = 'entrada' and not respondida;

-- 3) Pendências para a coordenação (aparecem na Caixa)
create table public.tarcisio_pendencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('vincular_numero','coordenacao')),
  numero text not null,
  resumo text not null,
  dados jsonb not null default '{}',                 -- nome_completo, nascimento, relacao, candidatos…
  estado text not null default 'aberta' check (estado in ('aberta','resolvida','descartada')),
  resolvido_por uuid,
  resolvido_em timestamptz,
  created_at timestamptz not null default now()
);
create index tarcisio_pendencias_abertas on public.tarcisio_pendencias (created_at) where estado = 'aberta';

-- 4) Pedidos de texto à IA feitos pela tela (rascunho de aviso). O robô responde em segundos.
create table public.tarcisio_ia_pedidos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'rascunho_aviso' check (tipo in ('rascunho_aviso')),
  entrada text not null check (length(entrada) between 3 and 2000),
  saida text,
  estado text not null default 'pedido' check (estado in ('pedido','pronto','falhou')),
  erro text,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- RLS: conversas e rascunhos = admin/subadmin; pendências = quem decide na Caixa (equipe também)
alter table public.tarcisio_mensagens enable row level security;
alter table public.tarcisio_pendencias enable row level security;
alter table public.tarcisio_ia_pedidos enable row level security;
create policy "Coordenacao le" on public.tarcisio_mensagens for select using (tarcisio_pode_gerir());
create policy "Equipe decide" on public.tarcisio_pendencias for all
  using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'))
  with check (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
create policy "Coordenacao pede" on public.tarcisio_ia_pedidos for all using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
revoke all on public.tarcisio_mensagens, public.tarcisio_pendencias, public.tarcisio_ia_pedidos from anon;
grant select on public.tarcisio_mensagens to authenticated;
grant select, update on public.tarcisio_pendencias to authenticated;
grant select, insert on public.tarcisio_ia_pedidos to authenticated;

-- 5) Ligar o número desconhecido ao servo (a IA nunca faz isso: só a equipe, pela Caixa)
--    relacao 'proprio' → telefone do servo; qualquer outra → celular_recado (número do responsável)
create or replace function public.tarcisio_vincular_numero(p_pendencia uuid, p_membro uuid, p_relacao text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_p tarcisio_pendencias%rowtype; v_num text;
begin
  if acolitos_get_role(auth.uid()) not in ('coord_admin','subadmin','membro_equipe') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  select * into v_p from tarcisio_pendencias where id = p_pendencia and estado = 'aberta' for update;
  if v_p.id is null then return jsonb_build_object('erro','pendencia_fechada'); end if;
  if not exists (select 1 from acolitos_membros where id = p_membro) then return jsonb_build_object('erro','membro_invalido'); end if;
  -- grava no formato que o app mostra: (DD) 9XXXX-XXXX
  v_num := regexp_replace(v_p.numero, '^55(\d{2})(\d{5})(\d{4})$', '(\1) \2-\3');
  if p_relacao = 'proprio' then
    update acolitos_membros set telefone = v_num, telefone_whatsapp = true where id = p_membro;
  else
    update acolitos_membros set celular_recado = v_num where id = p_membro;
  end if;
  update tarcisio_pendencias set estado = 'resolvida', resolvido_por = auth.uid(), resolvido_em = now(),
    dados = dados || jsonb_build_object('vinculado_a', p_membro, 'como', p_relacao) where id = p_pendencia;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.tarcisio_vincular_numero(uuid, uuid, text) from public, anon;
grant execute on function public.tarcisio_vincular_numero(uuid, uuid, text) to authenticated;
