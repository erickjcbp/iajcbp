-- Acólitos 072 — as funções do banco também ordenam a missa pela HORA, não pelo texto
--
-- A migration 071 fez a tabela guardar a hora da missa em MINUTOS (`minutos`), e o
-- JavaScript das telas já passou a pedir a ordem por ela. Mas cinco funções do banco
-- continuavam com o `order by` antigo, comparando `horario` como TEXTO — e texto sem
-- zero na frente ordena errado: '19h' vem antes de '7h' e de '9h', porque '1' é menor
-- que '7' e '9' olhando caractere por caractere.
--
-- Medido em produção (20/09, 27/09, 04/10 e 11/10/2026 — todos domingos de missa às
-- 7h, 9h e 19h): estas funções devolviam ["19h","7h","9h"]; a coluna `minutos` já
-- devolve na ordem certa, 7h, 9h, 19h. Resultado: o MESMO domingo aparecia em duas
-- ordens diferentes dentro da MESMA tela, dependendo de qual pedaço vinha do
-- JavaScript (certo, desde a 071) e qual vinha de uma destas cinco funções (errado).
--
-- O QUE MUDA E O QUE NÃO MUDA: cada função abaixo é a definição que já está no ar
-- (conferida com `pg_get_functiondef`), com UMA única troca por função: onde o
-- `order by` comparava `horario` (texto), passa a comparar por hora de verdade —
-- usando a coluna `minutos` quando a tabela `acolitos_celebracoes` está diretamente
-- disponível na consulta, ou a função `acolitos_minutos_do_horario()` (criada na 070)
-- quando a ordenação acontece sobre um resultado já montado que não carrega a coluna
-- `minutos` (as duas primeiras funções, que ordenam dentro de um `json_agg`). Nada
-- mais muda: nem a assinatura, nem o tipo de retorno, nem o `security definer`, nem
-- o `set search_path`, nem uma linha do corpo, nem os `grant`/`revoke` (que
-- `create or replace function` preserva sozinho).
--
-- FORA do escopo, de propósito: `acolitos_faltas_recentes()` também ordena por
-- texto, mas está sem uso e marcada para ser apagada — não mexe aqui.
--
-- IDEMPOTENTE: `create or replace function` — pode rodar de novo sem problema.
-- Prova: docs/provas/provar-072-funcoes-em-ordem.sql (vermelho antes, verde depois).

-- 1) acolitos_escalas_futuras() — aba "Próximas" de escalas-membro.html
--    A ordenação é sobre o resultado `c` do `json_agg`, que não carrega `minutos` —
--    por isso usa a função de conversão em cima de `c.horario`, já disponível ali.
create or replace function public.acolitos_escalas_futuras()
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(json_agg(c order by c.data, public.acolitos_minutos_do_horario(c.horario)), '[]'::json)
  from (
    select cel.id, cel.data, cel.horario, cel.comunidade, cel.tipo,
      coalesce((
        select json_agg(json_build_object('funcao', e.funcao,
                 'nome', coalesce(nullif(m.apelido,''), m.nome)) order by e.funcao)
        from public.acolitos_escalas e
        join public.acolitos_membros m on m.id = e.membro_id
        where e.celebracao_id = cel.id
      ), '[]'::json) as escalados
    from public.acolitos_celebracoes cel
    where cel.data >= (now() at time zone 'America/Sao_Paulo')::date
  ) c;
$function$;

comment on function public.acolitos_escalas_futuras() is
  'Escalas futuras (aba "Próximas" de escalas-membro.html), ordenadas por data e hora em MINUTOS (072; antes ordenava horario como texto). Prova: provar-072.';

-- 2) acolitos_escalas_passadas() — aba "Próximas" (histórico) de escalas-membro.html
--    Aqui há DOIS lugares com `order by horario`: o de dentro (que decide, junto com o
--    `limit 60`, QUAIS linhas sobrevivem) usa `cel.minutos` — coluna real da tabela,
--    disponível ali; o de fora (que decide a ordem final do `json_agg`) usa a função,
--    pelo mesmo motivo da função anterior.
create or replace function public.acolitos_escalas_passadas()
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(json_agg(c order by c.data desc, public.acolitos_minutos_do_horario(c.horario) desc), '[]'::json)
  from (
    select cel.id, cel.data, cel.horario, cel.comunidade, cel.tipo,
      coalesce((
        select json_agg(json_build_object('funcao', e.funcao,
                 'nome', coalesce(nullif(m.apelido,''), m.nome)) order by e.funcao)
        from public.acolitos_escalas e
        join public.acolitos_membros m on m.id = e.membro_id
        where e.celebracao_id = cel.id
      ), '[]'::json) as escalados
    from public.acolitos_celebracoes cel
    where cel.data < (now() at time zone 'America/Sao_Paulo')::date
      and exists (select 1 from public.acolitos_escalas e2 where e2.celebracao_id = cel.id)
    order by cel.data desc, cel.minutos desc
    limit 60
  ) c;
$function$;

comment on function public.acolitos_escalas_passadas() is
  'Escalas passadas (aba "Próximas", histórico, de escalas-membro.html), ordenadas por data e hora em MINUTOS (072; antes ordenava horario como texto, dentro e fora do limit 60). Prova: provar-072.';

-- 3) acolitos_vagas_abertas_membro() — "ESCALA EU!" em escalas-membro.html
--    `c` aqui é a própria tabela `acolitos_celebracoes` (não um resultado já montado),
--    então troca direta: `c.horario` vira `c.minutos`.
create or replace function public.acolitos_vagas_abertas_membro()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_me uuid; v_out jsonb;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('vagas','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'celebracao_id', c.id, 'data', c.data, 'horario', c.horario,
           'comunidade', c.comunidade, 'tipo', c.tipo, 'funcao', mo.funcao
         ) order by c.data, c.minutos), '[]'::jsonb) into v_out
  from public.acolitos_celebracoes c
  join public.acolitos_modelos mo
    on mo.tipo = c.tipo and mo.comunidade = c.comunidade
  join public.acolitos_habilitacoes h
    on h.membro_id = v_me and h.funcao = mo.funcao
  where c.data >= current_date
    and mo.quantidade > (
      select count(*) from public.acolitos_escalas e
      where e.celebracao_id = c.id and e.funcao = mo.funcao and e.status = 'escalado'
    )
    and not exists (
      select 1 from public.acolitos_escalas e2
      where e2.celebracao_id = c.id and e2.membro_id = v_me and e2.status = 'escalado'
    );
  return jsonb_build_object('vagas', v_out);
end; $function$;

comment on function public.acolitos_vagas_abertas_membro() is
  'Vagas abertas para o membro logado ("ESCALA EU!" em escalas-membro.html), ordenadas por data e hora em MINUTOS (072; antes ordenava horario como texto). Prova: provar-072.';

-- 4) acolitos_membro_card(uuid) — cartão do membro em destaques.html
--    `cel` aqui também é a própria tabela; troca direta `cel.horario` → `cel.minutos`.
create or replace function public.acolitos_membro_card(p_id uuid)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  select json_build_object(
    'id', m.id,
    'nome', coalesce(nullif(m.apelido,''), m.nome),
    'nome_completo', m.nome,
    'foto_url', m.foto_url,
    'nivel', m.nivel,
    'casa_id', m.casa_id,
    'comunidade', m.comunidade,
    'total_servido', (select count(*) from public.acolitos_escalas e where e.membro_id=m.id and e.status in ('presente','atrasado')),
    'funcoes', (select count(*) from public.acolitos_habilitacoes h where h.membro_id=m.id and h.proficiencia in ('apto','experiente','referencia')),
    'ultimas', coalesce((select json_agg(u) from (
        select cel.data, cel.horario, cel.comunidade, e.funcao
        from public.acolitos_escalas e
        join public.acolitos_celebracoes cel on cel.id=e.celebracao_id
        where e.membro_id=m.id and e.status in ('presente','atrasado')
        order by cel.data desc, cel.minutos desc
        limit 8) u), '[]'::json)
  )
  from public.acolitos_membros m
  where m.id = p_id and m.status='ativo';
$function$;

comment on function public.acolitos_membro_card(uuid) is
  'Cartão do membro (destaques.html), com as últimas presenças ordenadas por data e hora em MINUTOS (072; antes ordenava horario como texto). Prova: provar-072.';

-- 5) acolitos_ausencia_publica_celebracoes() — página PÚBLICA ausencias-publica.html, sem login
--    Aqui a tabela é lida direto, sem apelido — troca direta `horario` → `minutos`.
create or replace function public.acolitos_ausencia_publica_celebracoes()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'data', data, 'horario', horario, 'comunidade', comunidade
  ) order by data, minutos), '[]'::jsonb)
  from public.acolitos_celebracoes
  where data >= current_date and data <= (current_date + interval '3 months')::date;
$function$;

comment on function public.acolitos_ausencia_publica_celebracoes() is
  'Celebrações futuras para a página pública de ausências (ausencias-publica.html, sem login), ordenadas por data e hora em MINUTOS (072; antes ordenava horario como texto). Continua executável por anon. Prova: provar-072.';

-- O servidor de consultas (PostgREST) só enxerga as funções trocadas depois de recarregar.
notify pgrst, 'reload schema';
