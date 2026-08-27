-- 061 — quem tentou se cadastrar e já existe no cadastro.
--
-- O app passa a reconhecer, no momento do cadastro, que a pessoa JÁ está na
-- pastoral (vieram 170 pela planilha, e 134 ainda não têm login). Quando o nome
-- bate com alguém que já existe E a prova confere (data de nascimento ou nome da
-- mãe, os dois já pedidos no formulário), a conta é ligada à ficha existente em
-- vez de nascer uma segunda pessoa. Foi assim que a Isabeli Sousa Martins virou
-- duas em 23/07/2026.
--
-- Quando o nome bate mas a prova NÃO confere, o cadastro TRAVA — decisão do dono
-- em 27/08/2026. Travar sem deixar rastro faria a pessoa sumir na porta sem
-- ninguém saber; por isso esta tabela. Ela é a fila da coordenação.
--
-- O que NÃO é guardado: nada de quem passou direto (a esmagadora maioria). Só as
-- tentativas que precisam de gente para resolver.

create table if not exists public.acolitos_vinculo_tentativas (
  id                  uuid primary key default gen_random_uuid(),
  quando              timestamptz not null default now(),
  user_id             uuid,
  nome_digitado       text not null,
  nascimento_informado date,
  nome_mae_informado  text,
  -- 'confirmado'      = reconhecemos e ligamos à ficha que já existia
  -- 'prova_nao_bateu' = nome bate com alguém, mas a prova não; travado
  -- 'travado'         = errou três vezes; só a coordenação resolve
  resultado           text not null check (resultado in ('confirmado','prova_nao_bateu','travado')),
  membro_id           uuid references public.acolitos_membros(id) on delete set null,
  resolvido           boolean not null default false,
  -- A coordenação olhou e disse "não é a mesma pessoa, deixa entrar". Sem isto a
  -- pessoa bateria na mesma parede na tentativa seguinte, para sempre.
  liberado            boolean not null default false,
  resolvido_por       uuid,
  resolvido_em        timestamptz
);

create index if not exists acolitos_vinculo_tentativas_fila
  on public.acolitos_vinculo_tentativas (resolvido, quando desc);
create index if not exists acolitos_vinculo_tentativas_por_conta
  on public.acolitos_vinculo_tentativas (user_id, quando desc);

alter table public.acolitos_vinculo_tentativas enable row level security;

-- Só a coordenação enxerga e resolve. Quem ESCREVE é o servidor (service role),
-- que passa por cima da RLS — por isso não existe política de inserção: ninguém
-- logado pode fabricar uma tentativa.
drop policy if exists "Coordenação vê as tentativas" on public.acolitos_vinculo_tentativas;
create policy "Coordenação vê as tentativas" on public.acolitos_vinculo_tentativas
  for select using (
    acolitos_is_superadmin(auth.uid())
    or acolitos_get_role(auth.uid()) = any (array['coord_admin','subadmin','membro_equipe'])
  );

drop policy if exists "Coordenação resolve as tentativas" on public.acolitos_vinculo_tentativas;
create policy "Coordenação resolve as tentativas" on public.acolitos_vinculo_tentativas
  for update using (
    acolitos_is_superadmin(auth.uid())
    or acolitos_get_role(auth.uid()) = any (array['coord_admin','subadmin','membro_equipe'])
  );

comment on table public.acolitos_vinculo_tentativas is
  'Fila da coordenação: quem tentou se cadastrar, bateu com uma ficha existente e não provou ser a pessoa.';
