-- 105 — São Tarcísio: escala automática, correções da revisão final (2026-10-21)
-- Projeto: docs/superpowers/specs/2026-10-20-escala-automatica-design.md
--
-- 1) Confirmar de novo revive o pedido da arte que FALHOU.
--    Antes: chave_unica 'escala:<domingo>' + "on conflict do nothing". Se a arte não ficava pronta em
--    30 min o pedido virava 'falhou' e a chave ficava gasta: confirmar de novo respondia novo:false e
--    nada voltava para a fila (o próprio texto do erro mandava "confirme de novo"). Agora só um pedido
--    'falhou' volta a 'aguardando_arte' com created_at novo (o robô só envia arte gerada DEPOIS do
--    pedido). Enviado ou ainda esperando: não mexe (a escala confirmada é a que vale).
--    O robô (chave de serviço) faz o mesmo em confirmar-semana-core.js (pedirArtePeloServico).
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
  on conflict (chave_unica) do update
    set estado = 'aguardando_arte', erro = null, created_at = now()
    where tarcisio_envios.estado = 'falhou';
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'novo', v_n > 0);
end; $$;
revoke all on function public.tarcisio_pedir_escala(date) from public, anon;
grant execute on function public.tarcisio_pedir_escala(date) to authenticated;

-- 2) Estado intermediário 'confirmando' (Confirmar do dono no WhatsApp).
--    Antes o estado ia direto a 'confirmada' ANTES dos avisos: se o robô reiniciasse no meio, a semana
--    ficava 'confirmada' com parte dos avisos e sem arte, e todo toque seguinte dizia "já tratada".
--    Agora: aguardando → confirmando → confirmada (ou volta a aguardando). Presa em 'confirmando' há
--    mais de 15 min (confirmando_em) = o robô caiu no meio: a varredura devolve para 'aguardando'.
alter table public.tarcisio_escala_auto drop constraint if exists tarcisio_escala_auto_estado_check;
alter table public.tarcisio_escala_auto add constraint tarcisio_escala_auto_estado_check
  check (estado in ('gerando','aguardando','em_revisao','confirmando','confirmada','falhou','sem_missas','ja_confirmada'));
alter table public.tarcisio_escala_auto add column if not exists confirmando_em timestamptz;

-- 3) NÃO entra aqui: índice único em acolitos_escalas (celebracao_id, membro_id).
--    Em 21/10/2026 a produção tinha 2 pares repetidos (missa de 12/06/2026 7h Matriz: a mesma pessoa
--    em duas funções, ambas 'presente'). Dado real não se mexe; o dono decide antes. A trava contra
--    gerar por cima mora no robô (escala-auto.mjs: fim de semana com escala já montada só vai para
--    conferência, sem gravar nada).
