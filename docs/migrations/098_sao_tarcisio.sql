-- 098 — São Tarcísio | JCBP: o WhatsApp que só envia (2026-10-20)
-- Projeto: docs/superpowers/specs/2026-10-20-sao-tarcisio-whatsapp-design.md
--
-- O app e o robô (container tarcisio-robo, na VPS ao lado da Evolution) conversam SÓ por estas
-- tabelas: a tela grava pedidos e regras; o robô lê com service_role, envia e devolve o estado.
-- Nenhuma chave da Evolution passa pelo navegador, e a Evolution não fica exposta na internet.
-- Tudo aqui é visível e editável só por coord_admin/subadmin.

create or replace function public.tarcisio_pode_gerir()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'); $$;
revoke all on function public.tarcisio_pode_gerir() from public, anon;
grant execute on function public.tarcisio_pode_gerir() to authenticated;

-- 1) Configuração + estado da conexão (uma linha só, id = 1)
create table public.tarcisio_config (
  id int primary key default 1 check (id = 1),
  pausado boolean not null default false,
  teto_diario int not null default 150 check (teto_diario between 0 and 1000),
  janela_inicio time not null default '08:00',
  janela_fim time not null default '21:00',
  hora_lembrete time not null default '19:00',
  hora_aniversario time not null default '08:00',
  escala_ligada boolean not null default true,
  lembrete_ligado boolean not null default true,
  aniversario_ligado boolean not null default true,
  texto_lembrete text not null default 'Olá! Amanhã ({dia}) {itens}. Chegar 20 min antes. — São Tarcísio | JCBP',
  texto_aniversario text not null default 'Hoje é aniversário de {nome}! 🎉 A Pastoral dos Coroinhas e Acólitos da JCBP deseja muitas bênçãos. — São Tarcísio | JCBP',
  rodape text not null default 'Este número só envia avisos; dúvidas, fale com a coordenação.',
  -- escrito pelo robô
  conexao text not null default 'desconhecida',     -- open | close | connecting | desconhecida
  numero_conectado text,
  qr_code text,                                      -- data URL do QR (só enquanto pareando)
  qr_em timestamptz,
  robo_visto_em timestamptz,
  -- escrito pela tela
  pedir_qr_em timestamptz,                           -- tela pede um QR novo
  pedir_grupos_em timestamptz,                       -- tela pede a lista de grupos do número
  updated_at timestamptz not null default now()
);
insert into public.tarcisio_config (id) values (1);

-- 2) Grupos do número e o papel de cada um
create table public.tarcisio_grupos (
  jid text primary key,                              -- id do grupo no WhatsApp (…@g.us)
  nome text not null,
  papel text check (papel in ('pais','acolitos','cerimoniarios','equipe')),
  visto_em timestamptz not null default now()        -- última vez que o robô viu o número no grupo
);
create unique index tarcisio_grupos_um_por_papel on public.tarcisio_grupos (papel) where papel is not null;

-- 3) Avisos que a coordenação agenda
create table public.tarcisio_avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  texto text,
  imagem_url text,
  grupos text[] not null default '{}',               -- papéis de grupo: pais/acolitos/cerimoniarios/equipe
  privado text[] not null default '{}',              -- públicos no privado: os mesmos 4 papéis
  quando timestamptz not null,                       -- próxima saída
  repetir text not null default 'nao' check (repetir in ('nao','diario','semanal','mensal')),
  ate date,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (texto is not null or imagem_url is not null),
  check (cardinality(grupos) + cardinality(privado) > 0)
);

-- 4) A fila — e o registro de tudo que saiu, falhou ou ficou sem número
create table public.tarcisio_envios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('escala','lembrete','aviso','aniversario')),
  destino_jid text,                                  -- grupo
  destino_numero text,                               -- privado (só dígitos, com 55)
  destino_nome text,                                 -- p/ a tela: nome do grupo ou da pessoa
  texto text,
  imagem_url text,
  agendado_para timestamptz not null default now(),
  estado text not null default 'pendente'
    check (estado in ('aguardando_arte','pendente','enviando','enviado','falhou','cancelado','sem_numero')),
  erro text,
  tentativas int not null default 0,
  enviado_em timestamptz,
  aviso_id uuid references public.tarcisio_avisos(id) on delete set null,
  membro_id uuid references public.acolitos_membros(id) on delete set null,
  domingo_data date,                                 -- tipo escala: o domingo da arte esperada
  chave_unica text unique,                           -- impede repetido: lembrete:<cel>:<num>, aniv:<membro>:<ano>…
  created_at timestamptz not null default now()
);
create index tarcisio_envios_fila on public.tarcisio_envios (agendado_para) where estado in ('pendente','aguardando_arte');
create index tarcisio_envios_recentes on public.tarcisio_envios (created_at desc);

-- RLS: só a coordenação; o robô usa service_role (passa por cima da RLS)
alter table public.tarcisio_config enable row level security;
alter table public.tarcisio_grupos enable row level security;
alter table public.tarcisio_avisos enable row level security;
alter table public.tarcisio_envios enable row level security;
create policy "Coordenacao gere" on public.tarcisio_config for all using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
create policy "Coordenacao gere" on public.tarcisio_grupos for all using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
create policy "Coordenacao gere" on public.tarcisio_avisos for all using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
create policy "Coordenacao gere" on public.tarcisio_envios for all using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
revoke all on public.tarcisio_config, public.tarcisio_grupos, public.tarcisio_avisos, public.tarcisio_envios from anon;
grant select, insert, update, delete on public.tarcisio_config, public.tarcisio_grupos, public.tarcisio_avisos, public.tarcisio_envios to authenticated;

-- 5) Confirmar a semana pede a arte nos grupos (uma vez por semana; a escala confirmada não é reenviada)
create or replace function public.tarcisio_pedir_escala(p_domingo date)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_n int;
begin
  if not tarcisio_pode_gerir() then return jsonb_build_object('erro','sem_permissao'); end if;
  if p_domingo is null or extract(dow from p_domingo) <> 0 then return jsonb_build_object('erro','domingo_invalido'); end if;
  if not (select escala_ligada from tarcisio_config where id = 1) then return jsonb_build_object('ok', true, 'desligado', true); end if;
  insert into tarcisio_envios (tipo, estado, domingo_data, chave_unica, destino_nome)
  values ('escala', 'aguardando_arte', p_domingo, 'escala:' || p_domingo, 'Grupos')
  on conflict (chave_unica) do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'novo', v_n > 0);
end; $$;
revoke all on function public.tarcisio_pedir_escala(date) from public, anon;
grant execute on function public.tarcisio_pedir_escala(date) to authenticated;
