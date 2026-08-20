-- 059 — quem está usando o app, e quem tem o sino ligado
--
-- POR QUE: não havia como a coordenação saber quem abriu o app e quem sumiu. A
-- pergunta é do dono e virou a aba Config › As pessoas › Atividade.
--
-- DE ONDE SAI O "ÚLTIMO USO" — e por que NÃO é o que parece:
-- O caminho óbvio seria `auth.users.last_sign_in_at`. Ele MENTE para esta pergunta:
-- marca a última vez que a pessoa DIGITOU A SENHA, e como o app fica logado, quem
-- entrou uma vez em junho e usa todo dia continua marcada como junho. Medido em
-- 20/08: a Franciele tinha `last_sign_in_at` de 03/06 e estava com o app aberto
-- naquela tarde. Uma tela dizendo "sumiu há 2 meses e meio" sobre quem acabou de
-- usar faria a coordenação cobrar a pessoa errada.
--
-- O sinal honesto é `auth.sessions.updated_at`: ele sobe toda vez que o app renova
-- a sessão, ou seja, quando a pessoa realmente usa. Conferido nas 6 pessoas que
-- ligaram o sino em 20/08 — bate NO MINUTO com a hora em que cada uma abriu o app.
--
-- NÃO usar `auth.sessions.refreshed_at`: é `timestamp WITHOUT time zone`. Converter
-- para o fuso de São Paulo devolve lixo (deu 6 horas de diferença em todo mundo).
-- O `updated_at` é `with time zone`, e é o que esta função manda.
--
-- OS QUATRO ESTADOS, e nenhum vira número inventado:
--   · usou              → tem sessão viva: `ultimo_uso` preenchido (35 de 41 em 20/08)
--   · sessão expirou    → entrou um dia e faz tempo: `ultimo_uso` nulo, `entrou_em` cheio (1)
--   · nunca entrou      → conta criada e nunca usada: os dois nulos (5)
--   · sem conta         → nem login tem: vai na lista `sem_conta` (135 dos 176 ativos)
--
-- O RECORTE POR "hoje / esta semana / este mês" é feito na TELA, de propósito: ele
-- depende do fuso de quem está olhando, e este projeto já pagou caro por data
-- derivada no servidor. A função manda o instante cru; quem corta é o navegador.
--
-- PERMISSÃO: só superadmin, pelo mesmo portão da `acolitos_logins_listar`
-- (`acolitos_is_superadmin()`, que compara o login com a lista de superadmins).
-- O grant NÃO é o portão: quem executa e não é superadmin recebe
-- `{"erro":"sem_permissao"}` e nenhum dado. O anônimo não executa nem isso.
--
-- COMO CONFERIR: docs/provar-059-atividade.sql — roda como anônimo, como pessoa
-- comum e como superadmin, e não escreve nada.

begin;

create or replace function public.acolitos_atividade_listar()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not acolitos_is_superadmin() then return jsonb_build_object('erro','sem_permissao'); end if;

  return jsonb_build_object(
    -- Quem tem login. Vai com foto, nível e casa para a lista poder usar o mesmo
    -- avatar do resto do app (brasão da casa incluído, migration 058).
    'contas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'nome', m.nome, 'apelido', m.apelido,
        'foto_url', m.foto_url, 'nivel', m.nivel, 'casa_id', m.casa_id,
        'usuario',    coalesce(l.usuario, split_part(u.email,'@',1)),
        'ultimo_uso', (select max(s.updated_at) from auth.sessions s where s.user_id = m.user_id),
        'entrou_em',  u.last_sign_in_at,
        'criada_em',  u.created_at,
        -- Contadas as INSCRIÇÕES, não os aparelhos adivinhados: é para cá que o
        -- aviso vai ser mandado de verdade. Um celular que trocou de inscrição
        -- aparece como 2 até o próximo envio, que apaga a morta sozinho.
        'sino',       exists(select 1 from acolitos_push_subs p where p.user_id = m.user_id),
        'sino_desde', (select min(p.criado_em) from acolitos_push_subs p where p.user_id = m.user_id),
        'aparelhos',  (select count(*) from acolitos_push_subs p where p.user_id = m.user_id)
      ) order by m.nome)
      from acolitos_membros m
      left join acolitos_logins l on l.membro_id = m.id
      join auth.users u on u.id = m.user_id
      where m.status='ativo' and m.user_id is not null
    ), '[]'::jsonb),

    -- Quem está ativo e não tem login nenhum. Não é detalhe: em 20/08 são 135 de
    -- 176, e é a informação mais acionável da tela — essa gente não consegue abrir
    -- o app de jeito nenhum.
    'sem_conta', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'nivel', m.nivel) order by m.nome)
      from acolitos_membros m
      where m.status='ativo' and m.user_id is null
    ), '[]'::jsonb),

    'ativos', (select count(*) from acolitos_membros where status='ativo')
  );
end; $$;

revoke all on function public.acolitos_atividade_listar() from public;
grant execute on function public.acolitos_atividade_listar() to authenticated;
grant execute on function public.acolitos_atividade_listar() to service_role;

commit;
