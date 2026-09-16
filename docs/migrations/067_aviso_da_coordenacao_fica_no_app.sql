-- Acólitos 067 — o aviso da coordenação passa a FICAR no app
--
-- O QUE ERA: o botão "Enviar aviso" da Caixa chamava só /api/enviar-push. Push é uma tarja
-- no celular: some quando a pessoa dispensa, e só chega a quem ligou notificação. Nada era
-- gravado, então o sininho ficava vazio e o pop-up nunca abria.
--
-- Não era falta de funcionalidade, era defeito: o LEITOR já existia e já esperava por isso.
-- A fila de notificações do shared.js tem a prioridade 0 reservada para "avisos da
-- coordenação não vistos", chamando showAvisoUnico um a um. Ninguém nunca os escrevia.
--
-- POR QUE FUNÇÃO NO BANCO, e não um laço na API: são 191 membros. Um laço faria 191
-- gravações numa chamada só, com risco de estourar o tempo da Vercel justamente no caso
-- "avisar todos". Aqui é UMA instrução. O dono pediu automático e sem risco de travar.
--
-- A FORMA DO AVISO é a que a tela sabe desenhar, e isso não é detalhe: avisoEl() lê
-- `msg`, e showAvisoUnico() cai no ramo genérico com o título "Aviso da Coordenação".
-- Se o campo mudar de nome, a notificação aparece EM BRANCO e nada quebra — provar-067
-- fica vermelho se isso acontecer.
--
-- A TRAVA é a mesma de api/enviar-push.js para o tipo 'aviso': COORD = coord_admin e
-- subadmin. Copiada de propósito — trava diferente nos dois caminhos é como um portão
-- fecha de um lado e abre do outro.
--
-- IDEMPOTENTE: create or replace. Rodar de novo não avisa ninguém.

create or replace function public.acolitos_avisar_todos(p_texto text, p_membros uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_role text := acolitos_get_role(auth.uid()); v_n int; v_msg text;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin') then
    return jsonb_build_object('erro','sem_permissao');
  end if;

  v_msg := trim(coalesce(p_texto,''));
  if v_msg = '' then return jsonb_build_object('erro','sem_texto'); end if;
  v_msg := left(v_msg, 500);

  -- status='ativo' e user_id not null: quem não tem login não abre o app, e afastado não
  -- recebe recado da coordenação. É o mesmo recorte que a acolitos_quest_criar já usa.
  update acolitos_membros
     set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'tipo','aviso', 'msg', v_msg, 'logout', false, 'seen', false,
           'ts', (extract(epoch from now())*1000)::bigint))
   where status = 'ativo'
     and user_id is not null
     and (p_membros is null or id = any(p_membros));

  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'notificados', v_n);
end; $$;

-- O PORTÃO. Memória do projeto: 'anon executa as 64' já foi achado de segurança aqui, e
-- 'revoke from public' sozinho NÃO fecha authenticated. Então: fecha tudo, e abre nominal.
revoke all on function public.acolitos_avisar_todos(text, uuid[]) from public;
revoke all on function public.acolitos_avisar_todos(text, uuid[]) from anon;
grant execute on function public.acolitos_avisar_todos(text, uuid[]) to authenticated;
grant execute on function public.acolitos_avisar_todos(text, uuid[]) to service_role;

comment on function public.acolitos_avisar_todos(text, uuid[]) is
  'Aviso da coordenação: grava em acolitos_membros.avisos (sininho + pop-up). p_membros null = todos os ativos com login. Só coord_admin/subadmin. Prova: docs/provas/provar-067-aviso-fica-no-app.sql';
