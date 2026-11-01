-- 128 — Conversas do Tarcísio: enviar e apagar mensagens pelo painel e pelo WhatsApp do dono (2026-11-01)
-- Envio manual = tarcisio_envios.tipo 'manual' (o robô envia fora da janela 8h-21h e mesmo pausado: é gesto humano).
-- Apagar para todos = a tela marca apagar_pedido_em; o robô chama a Evolution e grava apagada_em ou apagar_erro.
-- external_id guarda o id da mensagem no WhatsApp (necessário para apagar).
begin;

alter table public.tarcisio_envios drop constraint if exists tarcisio_envios_tipo_check;
alter table public.tarcisio_envios add constraint tarcisio_envios_tipo_check
  check (tipo = any (array['escala','lembrete','aviso','aniversario','manual']));
alter table public.tarcisio_envios
  add column if not exists external_id text,
  add column if not exists apagar_pedido_em timestamptz,
  add column if not exists apagada_em timestamptz,
  add column if not exists apagar_erro text,
  add column if not exists oculta boolean not null default false;

alter table public.tarcisio_mensagens
  add column if not exists apagar_pedido_em timestamptz,
  add column if not exists apagada_em timestamptz,
  add column if not exists apagar_erro text,
  add column if not exists oculta boolean not null default false;

-- a coordenação só mexe nestas colunas das mensagens; o texto e o resto continuam intocáveis
drop policy if exists "Coordenacao atualiza" on public.tarcisio_mensagens;
create policy "Coordenacao atualiza" on public.tarcisio_mensagens for update
  using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
revoke update on public.tarcisio_mensagens from authenticated;
grant update (oculta, apagar_pedido_em) on public.tarcisio_mensagens to authenticated;

create index if not exists tarcisio_envios_apagar on public.tarcisio_envios (apagar_pedido_em) where apagar_pedido_em is not null and apagada_em is null;
create index if not exists tarcisio_mensagens_apagar on public.tarcisio_mensagens (apagar_pedido_em) where apagar_pedido_em is not null and apagada_em is null;
commit;
