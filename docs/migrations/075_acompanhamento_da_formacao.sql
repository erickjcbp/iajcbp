-- Acólitos 075 — o acompanhamento da Formação: quem NÃO saiu do lugar
--
-- POR QUE EXISTE: a tela da Jornada responde "quem está chegando lá" — e em 18/09/2026 isso
-- era 1 pessoa pronta para subir e 1 quase lá. Ninguém respondia a pergunta que o setor
-- Formação precisa fazer toda semana: **com quem eu falo?** As 155 pessoas que nunca
-- progrediram são invisíveis em todas as telas de hoje, porque todas elas listam quem AGE.
--
-- As quatro faixas, da mais urgente para a menos:
--   nunca_entrou — tem conta e nunca abriu o app. NÃO é problema de formação, é de acesso:
--                  insistir em trilha com essa pessoa é falar sozinho (eram 148 em 18/09);
--   travado      — entrou no app e não cumpriu nenhuma missão;
--   parou        — já andou e sumiu: mais de 30 dias sem missão E sem servir. Os 30 dias
--                  foram escolha do dono em 18/09;
--   andando      — teve missão ou serviu nos últimos 30 dias.
--
-- POR QUE NO BANCO: só o banco enxerga `auth.users.last_sign_in_at`. A tela não tem acesso a
-- essa tabela — se a classificação morasse no JavaScript, a faixa mais importante (quem nunca
-- entrou) seria impossível de calcular, e o app chamaria de "travado" quem nem porta abriu.

create or replace function public.acolitos_formacao_acompanhamento()
  returns table (
    membro_id uuid,
    nome text,
    status text,
    nivel text,
    faixa text,
    dias_parado integer,
    capitulo_atual integer,
    obrigatorias_feitas integer,
    obrigatorias_do_capitulo integer,
    ultima_missa date,
    ultimo_progresso date,
    telefone text
  )
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
begin
  -- Portão explícito. Devolver lista vazia para quem não pode ver seria pior do que recusar:
  -- a tela diria "ninguém parado" e a coordenação acreditaria. Este projeto já levou esse golpe.
  --
  -- ⚠️ O `coalesce` NÃO é enfeite. `acolitos_get_role` devolve NULO para quem ele não conhece,
  -- e em SQL `NULO not in (...)` não é FALSO — é NULO. Sem o coalesce o `if` nunca disparava e
  -- o portão ficava ESCANCARADO: qualquer pessoa logada leria telefone e progresso de todos.
  -- Foi a seção 7 da prova que pegou isto, minutos depois de a função subir.
  if coalesce(public.acolitos_get_role(auth.uid()), '') not in ('coord_admin', 'subadmin', 'membro_equipe') then
    raise exception 'Sem acesso ao acompanhamento da Formação'
      using errcode = '42501';
  end if;

  return query
  with base as (
    select m.id,
           m.nome,
           m.status,
           coalesce(nullif(m.nivel, ''), null) as nivel,
           (u.last_sign_in_at is not null) as entrou_no_app,
           -- A regra da casa para o telefone (projetos/acolitos/telefones-core.js): o número
           -- de recado primeiro, o do responsável como reserva. O da própria pessoa entra por
           -- último porque boa parte é criança e o aparelho é da mãe ou do pai.
           coalesce(nullif(m.celular_recado, ''), nullif(m.celular_responsavel, ''),
                    nullif(m.celular_mae, ''), nullif(m.telefone, '')) as telefone,
           (select max(p.created_at)::date from public.acolitos_missao_progresso p
             where p.membro_id = m.id and p.status in ('concluida', 'medalha')) as ultimo_progresso,
           (select max(c.data) from public.acolitos_escalas e
              join public.acolitos_celebracoes c on c.id = e.celebracao_id
             where e.membro_id = m.id and c.data <= current_date) as ultima_missa
      from public.acolitos_membros m
      left join auth.users u on u.id = m.user_id
     where coalesce(m.status, '') <> 'desligado'
  ),
  comCapitulo as (
    select b.*,
           -- o capítulo atual é o PRIMEIRO com alguma obrigatória ainda por fazer
           (select min(q.capitulo) from public.acolitos_missoes q
             where q.nivel_alvo = b.nivel and q.obrigatoria and q.ativo
               and not exists (select 1 from public.acolitos_missao_progresso p
                                where p.membro_id = b.id and p.missao_id = q.id
                                  and p.status in ('concluida', 'medalha'))) as capitulo_atual
      from base b
  )
  select c.id,
         c.nome,
         c.status,
         c.nivel,
         case
           when not c.entrou_no_app then 'nunca_entrou'
           when c.ultimo_progresso is null then 'travado'
           when greatest(c.ultimo_progresso, coalesce(c.ultima_missa, c.ultimo_progresso))
                < current_date - 30 then 'parou'
           else 'andando'
         end as faixa,
         case
           when c.ultimo_progresso is null then null
           else (current_date - greatest(c.ultimo_progresso,
                                         coalesce(c.ultima_missa, c.ultimo_progresso)))::integer
         end as dias_parado,
         c.capitulo_atual,
         (select count(*)::integer from public.acolitos_missoes q
           where q.nivel_alvo = c.nivel and q.capitulo = c.capitulo_atual
             and q.obrigatoria and q.ativo
             and exists (select 1 from public.acolitos_missao_progresso p
                          where p.membro_id = c.id and p.missao_id = q.id
                            and p.status in ('concluida', 'medalha'))) as obrigatorias_feitas,
         (select count(*)::integer from public.acolitos_missoes q
           where q.nivel_alvo = c.nivel and q.capitulo = c.capitulo_atual
             and q.obrigatoria and q.ativo) as obrigatorias_do_capitulo,
         c.ultima_missa,
         c.ultimo_progresso,
         c.telefone
    from comCapitulo c
   order by case
              when not c.entrou_no_app then 0
              when c.ultimo_progresso is null then 1
              when greatest(c.ultimo_progresso, coalesce(c.ultima_missa, c.ultimo_progresso))
                   < current_date - 30 then 2
              else 3
            end,
            c.nome;
end $$;

-- Visitante sem login não executa. Este projeto já teve 64 funções SECURITY DEFINER abertas
-- ao anônimo; função nova não repete isso.
revoke all on function public.acolitos_formacao_acompanhamento() from public;
revoke all on function public.acolitos_formacao_acompanhamento() from anon;
grant execute on function public.acolitos_formacao_acompanhamento() to authenticated;

comment on function public.acolitos_formacao_acompanhamento() is
  'Uma linha por membro (fora os desligados) com a faixa de acompanhamento da Formação: nunca_entrou, travado, parou (30 dias sem missão e sem servir) ou andando. Já vem na ordem da urgência. Prova: docs/provas/provar-075-acompanhamento-da-formacao.sql';

notify pgrst, 'reload schema';
