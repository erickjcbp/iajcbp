-- ============================================================
-- ACÓLITOS — o que falta aplicar no banco
-- Atualizado em 18/08/2026.
--
-- PENDENTE — cole tudo abaixo de uma vez e clique em Run.
-- É seguro rodar duas vezes (as duas são `create or replace`).
--
-- 052 — aprovar candidatura passa a conferir a vaga no servidor.
--       Hoje aprovar insere na escala sem olhar nada: dá para superlotar uma função e para
--       escalar a mesma pessoa duas vezes na mesma missa.
--
-- 053 — ser responsável por uma tarefa passa a exigir só "estar num time".
--       Hoje exige também `eh_equipe`, que só 4 dos 176 têm. Vai junto com a mudança da barra
--       de navegação que já está no ar: sem a 053, a pessoa vê a aba e não pode ser responsável.
--
-- Já aplicado e conferido rodando: 048, 049, 050, 051.
-- ============================================================

-- Acólitos — aprovar candidatura passa a conferir a vaga NO SERVIDOR
--
-- Achado conferido em 18/08/2026 lendo `db/seguranca/011_solicitacoes.sql`. O ramo
-- 'aprovar_candidatura' de `acolitos_solicitacao_decidir` insere direto em `acolitos_escalas`,
-- sem olhar mais nada. São DOIS buracos, não um:
--
--   1. SUPERLOTAÇÃO. Nada compara com o modelo da celebração. Duas pessoas se candidatam à Cruz,
--      dois coordenadores aprovam, e a missa fica com duas Cruzes num modelo que pede uma.
--
--   2. A MESMA PESSOA DUAS VEZES NA MESMA MISSA. Candidatar-se confere "já escalado" na hora de
--      PEDIR, mas entre pedir e aprovar pode passar um dia — e o gerador de escala pode ter
--      escalado a pessoa nesse meio tempo, em outra função. Aprovar depois escala de novo.
--
-- Nada aqui muda os outros ramos (negar, homologar troca, confirmar cobertura): o texto deles é o
-- mesmo do 011, copiado do arquivo e não redigitado.
--
-- Conferência depois de aplicar: aprovar uma candidatura numa função que já está cheia tem de
-- devolver {"erro":"vaga_cheia"}, e a escala NÃO pode ganhar linha nova.

create or replace function public.acolitos_solicitacao_decidir(
  p_solicitacao_id uuid, p_acao text, p_substituto_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_role text; s public.acolitos_solicitacoes%rowtype; v_troca jsonb; v_novo_esc uuid; v_final text;
        v_tipo text; v_com text; v_cap int; v_ocup int;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  select * into s from public.acolitos_solicitacoes where id = p_solicitacao_id;
  if s.id is null then return jsonb_build_object('erro','nao_encontrada'); end if;

  if p_acao = 'negar' then
    -- guarda contra dupla-decisão (concorrência de coords): só nega o que ainda está pendente,
    -- senão re-negaria um pedido já homologado/coberto e deixaria a escala mutada + resultado órfão.
    update public.acolitos_solicitacoes set status='negado', decidido_por=auth.uid(), atualizado_em=now()
      where id = s.id
        and status in ('aguardando_colega','aguardando_coordenacao','aguardando_cobertura','recusado_colega');
    if not found then return jsonb_build_object('erro','nao_pendente'); end if;
    return jsonb_build_object('ok',true,'status','negado');

  elsif p_acao = 'homologar' and s.tipo='troca' and s.status='aguardando_coordenacao' then
    -- membro sai, colega (alvo) entra
    v_troca := public.acolitos_aplicar_troca_escala(s.celebracao_id, s.membro_id, s.alvo_membro_id);
    -- se o membro já não estava escalado (ex.: ausência aprovada rodou auto-troca antes), não marca sucesso falso
    if (v_troca->>'nao_escalado')::boolean then return jsonb_build_object('erro','ja_nao_escalado'); end if;
    v_novo_esc := nullif(v_troca->>'novo_escala_id','')::uuid;
    update public.acolitos_solicitacoes set status='homologado', decidido_por=auth.uid(),
      resultado_escala_id=v_novo_esc, atualizado_em=now() where id=s.id;
    return jsonb_build_object('ok',true,'status','homologado');

  elsif p_acao = 'confirmar_cobertura' and s.tipo='troca' and s.status='aguardando_cobertura' then
    -- membro sai, substituto escolhido pela coordenação entra (p_substituto_id pode ser null = vaga vazia)
    v_troca := public.acolitos_aplicar_troca_escala(s.celebracao_id, s.membro_id, p_substituto_id);
    if (v_troca->>'nao_escalado')::boolean then return jsonb_build_object('erro','ja_nao_escalado'); end if;
    v_novo_esc := nullif(v_troca->>'novo_escala_id','')::uuid;
    update public.acolitos_solicitacoes set status='coberto', decidido_por=auth.uid(),
      resultado_escala_id=v_novo_esc, atualizado_em=now() where id=s.id;
    return jsonb_build_object('ok',true,'status','coberto');

  elsif p_acao = 'aprovar_candidatura' and s.tipo='candidatura' and s.status='aguardando_coordenacao' then
    -- Serializa por celebração+função: sem isto, dois coordenadores aprovando no mesmo segundo
    -- passam os dois pela contagem antes de qualquer um inserir. É exatamente quando há fila
    -- que este buraco morde.
    perform pg_advisory_xact_lock(hashtextextended(s.celebracao_id::text || '|' || s.funcao, 0));

    -- A pessoa não pode entrar duas vezes na mesma missa. A candidatura já confere isto na hora
    -- de PEDIR, mas entre pedir e aprovar pode passar um dia — e o gerador de escala pode ter
    -- escalado a pessoa nesse meio tempo, em outra função.
    if exists (select 1 from public.acolitos_escalas
               where celebracao_id = s.celebracao_id and membro_id = s.membro_id
                 and status = 'escalado') then
      return jsonb_build_object('erro','ja_escalado');
    end if;

    -- A vaga tem de estar aberta AGORA. A regra espelha a da tela (escala.html modeloFor):
    -- tipo+comunidade, caindo para missa_comum da comunidade e depois missa_comum|matriz.
    -- Se o servidor usasse outra regra que a tela, recusaria vaga que a tela mostra aberta.
    select c.tipo, c.comunidade into v_tipo, v_com
      from public.acolitos_celebracoes c where c.id = s.celebracao_id;
    select mo.quantidade into v_cap from public.acolitos_modelos mo
      where mo.funcao = s.funcao
        and (mo.tipo, mo.comunidade) in ((v_tipo, v_com), ('missa_comum', v_com), ('missa_comum', 'matriz'))
      order by case when mo.tipo = v_tipo and mo.comunidade = v_com then 0
                    when mo.tipo = 'missa_comum' and mo.comunidade = v_com then 1
                    else 2 end
      limit 1;
    -- Sem modelo nenhum para a função, não se inventa limite: mantém o comportamento de antes.
    if v_cap is not null then
      select count(*) into v_ocup from public.acolitos_escalas
        where celebracao_id = s.celebracao_id and funcao = s.funcao and status = 'escalado';
      if v_ocup >= v_cap then
        return jsonb_build_object('erro','vaga_cheia','ocupadas',v_ocup,'vagas',v_cap);
      end if;
    end if;

    insert into public.acolitos_escalas(celebracao_id, membro_id, funcao, status, created_by)
    values (s.celebracao_id, s.membro_id, s.funcao, 'escalado', auth.uid())
    returning id into v_novo_esc;
    update public.acolitos_solicitacoes set status='aprovado', decidido_por=auth.uid(),
      resultado_escala_id=v_novo_esc, atualizado_em=now() where id=s.id;
    return jsonb_build_object('ok',true,'status','aprovado');
  end if;

  return jsonb_build_object('erro','acao_invalida','tipo',s.tipo,'status',s.status);
end; $$;


-- ============================================================

-- Acólitos — quem pode ser responsável por uma tarefa: basta estar num time
--
-- A 050 exigia `eh_equipe is true` E estar num time. Só 4 dos 176 membros têm `eh_equipe`, então
-- na prática dava para responsabilizar quatro pessoas — num recurso feito para 11 times. Quem o
-- dono pusesse num time pelo organograma das Casas continuava fora da lista, sem explicação.
--
-- A decisão do dono em 18/08/2026 foi "só quem está DE FATO num time". `eh_equipe` não é isso:
-- é a marca de coordenação, usada para outra coisa no resto do app. Estar num time é ter
-- `setores` preenchido, que é exatamente o que o organograma das Casas grava.
--
-- Vai junto com a mudança da barra de navegação (navegacao-core.js, mesma data): permissão de
-- módulo passou a valer também na barra, então liberar "Tarefas dos times" para alguém que não é
-- da equipe finalmente faz alguma coisa. As duas pontas tinham de mudar juntas — arrumar só uma
-- deixaria a pessoa vendo a aba e não podendo ser responsável, ou o contrário.
create or replace function public.acolitos_responsaveis_de_tarefa()
returns table (id uuid, nome text, apelido text, setores text[])
language sql
security definer
set search_path = public
as $$
  select m.id, m.nome, m.apelido, m.setores
  from public.acolitos_membros m
  where m.status = 'ativo'
    and m.setores is not null
    and array_length(m.setores, 1) > 0
  order by coalesce(m.apelido, m.nome);
$$;

-- As permissões não vêm junto do `create or replace`: reaplicadas como na 050.
revoke all on function public.acolitos_responsaveis_de_tarefa() from public, anon;
grant execute on function public.acolitos_responsaveis_de_tarefa() to authenticated;

-- Conferência: tem de devolver bem mais que 4. Se devolver 4, a coluna `setores` está vazia
-- para quase todo mundo — e aí o problema é outro (ninguém foi posto num time ainda).
select count(*) as podem_ser_responsaveis from public.acolitos_responsaveis_de_tarefa();
