-- Acólitos 074 — sair do CRM como "integrado" dá o degrau Aspirante e a função Apoio
--
-- O QUE ESTAVA ERRADO (medido em 18/09/2026): o CRM leva a pessoa até a etapa "integrado" e
-- para por ali. Ninguém põe o degrau na ficha e ninguém habilita função nenhuma. Resultado:
-- das 17 pessoas já integradas, **15 estavam sem nível e sem nenhuma função** — invisíveis
-- para a escala e fora de qualquer trilha de formação, porque a trilha começa no degrau.
-- E isso não era um acúmulo do passado: ia continuar acontecendo com cada pessoa nova.
--
-- A REGRA, decidida pelo dono em 18/09: ao ficar "integrado", a pessoa vira **Aspirante** e
-- fica **apta na função Apoio** — que é por onde todo mundo começa a servir.
--
-- POR QUE UM GATILHO NO BANCO, E NÃO CÓDIGO NA TELA: a etapa do CRM pode ser mudada pela
-- tela do CRM, por uma correção à mão ou por um script. Regra que vive na tela só vale para
-- quem passa pela tela — e foi justamente assim que 15 pessoas ficaram para trás.
--
-- O QUE ELE NUNCA FAZ:
--   · não rebaixa ninguém: quem já tem degrau mantém o que tem;
--   · não mexe na proficiência de quem já é apto/experiente/referência no Apoio;
--   · não tira nada de ninguém, em nenhuma hipótese.
--
-- IDEMPOTENTE: o `create or replace` no gatilho, e a correção só toca em quem está sem.

-- ── 1. A regra ───────────────────────────────────────────────────────────────
-- SECURITY DEFINER: o gatilho escreve em acolitos_membros e acolitos_habilitacoes, que têm
-- trava própria. Sem isto, quem move a etapa pelo CRM tropeçaria na trava da tabela vizinha
-- e a mudança de etapa falharia inteira — o CRM pararia de funcionar.
create or replace function public.acolitos_integrado_vira_aspirante()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if new.etapa is distinct from 'integrado' then
    return new;
  end if;

  -- o degrau, só para quem ainda não tem
  update public.acolitos_membros
     set nivel = 'aspirante'
   where id = new.membro_id
     and coalesce(nivel, '') = '';

  -- a função Apoio. `do nothing` no conflito: quem já é experiente ou referência no Apoio
  -- não pode ser rebaixado para apto por causa de uma mudança de etapa.
  insert into public.acolitos_habilitacoes (membro_id, funcao, proficiencia)
  values (new.membro_id, 'apoio', 'apto')
  on conflict (membro_id, funcao) do nothing;

  return new;
end $$;

-- Visitante sem login não executa nada disto.
revoke all on function public.acolitos_integrado_vira_aspirante() from public;
revoke all on function public.acolitos_integrado_vira_aspirante() from anon;

drop trigger if exists acolitos_crm_integrado on public.acolitos_crm;
-- Dispara na INSERÇÃO também: há caminhos que criam a linha do CRM já em "integrado"
-- (importação, correção à mão). Só no update, esses passariam batido.
create trigger acolitos_crm_integrado
  after insert or update of etapa on public.acolitos_crm
  for each row execute function public.acolitos_integrado_vira_aspirante();

comment on function public.acolitos_integrado_vira_aspirante() is
  'Ao ficar "integrado" no CRM, a pessoa ganha o degrau Aspirante (se não tiver nenhum) e a função Apoio como apta (sem rebaixar quem já é mais). Prova: docs/provas/provar-074-integrado-vira-aspirante.sql';

-- ── 2. A correção de quem já passou ──────────────────────────────────────────
-- As 15 pessoas que saíram como "integrado" antes desta regra existir.
update public.acolitos_membros m
   set nivel = 'aspirante'
  from public.acolitos_crm c
 where c.membro_id = m.id
   and c.etapa = 'integrado'
   and coalesce(m.nivel, '') = '';

insert into public.acolitos_habilitacoes (membro_id, funcao, proficiencia)
select c.membro_id, 'apoio', 'apto'
  from public.acolitos_crm c
 where c.etapa = 'integrado'
on conflict (membro_id, funcao) do nothing;
