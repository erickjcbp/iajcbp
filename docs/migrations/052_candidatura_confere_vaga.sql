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
