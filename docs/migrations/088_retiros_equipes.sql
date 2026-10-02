-- Acólitos 088 — EQUIPES do retiro, com WhatsApp
--
-- PEDIDO DO DONO (02/10/2026): "permita editar equipes também do retiro, podendo adicionar
-- WhatsApp". Cada área (retiro/formação/espiritualidade) tem as suas equipes — cozinha,
-- liturgia, decoração... — com as pessoas de cada uma e o WhatsApp para falar com elas.
--
-- PESSOA ≠ MEMBRO. Quem ajuda num retiro muitas vezes não está no cadastro da pastoral (pais,
-- voluntários da comunidade). Por isso a pessoa guarda nome e WhatsApp PRÓPRIOS; `membro_id` é
-- opcional, só para quem já é da pastoral. Obrigar a ter ficha empurraria cadastro de gente que
-- só vai cozinhar num fim de semana.
--
-- WhatsApp da equipe = o LINK do grupo (https://chat.whatsapp.com/...). O número da pessoa
-- vai em `whatsapp` (só dígitos, com DDD; a tela monta o link wa.me).
-- Mesma regra de acesso das demais tabelas de Retiros (acolitos_pode_retiros()).
create table if not exists public.acolitos_retiro_equipes (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references public.acolitos_retiro_areas(id) on delete cascade,
  nome        text not null check (length(btrim(nome)) > 0),
  descricao   text,
  grupo_whatsapp text,        -- link do grupo
  criada_em   timestamptz not null default now(),
  criada_por  uuid
);
create index if not exists acolitos_retiro_equipes_area_idx on public.acolitos_retiro_equipes (area_id);

create table if not exists public.acolitos_retiro_pessoas (
  id         uuid primary key default gen_random_uuid(),
  equipe_id  uuid not null references public.acolitos_retiro_equipes(id) on delete cascade,
  membro_id  uuid references public.acolitos_membros(id) on delete set null,
  nome       text not null check (length(btrim(nome)) > 0),
  whatsapp   text,            -- só dígitos (ex.: 19999071702)
  funcao     text,            -- ex.: coordenadora, apoio
  lider      boolean not null default false,
  criada_em  timestamptz not null default now()
);
create index if not exists acolitos_retiro_pessoas_equipe_idx on public.acolitos_retiro_pessoas (equipe_id);

-- itens do plano e compras podem ser de uma equipe
alter table public.acolitos_retiro_itens   add column if not exists equipe_id uuid references public.acolitos_retiro_equipes(id) on delete set null;
alter table public.acolitos_retiro_compras add column if not exists equipe_id uuid references public.acolitos_retiro_equipes(id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['acolitos_retiro_equipes','acolitos_retiro_pessoas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Retiros: quem tem a permissão" on public.%I', t);
    execute format('create policy "Retiros: quem tem a permissão" on public.%I to authenticated '
                   'using (public.acolitos_pode_retiros()) with check (public.acolitos_pode_retiros())', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;
