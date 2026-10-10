-- Aplicada e conferida no Supabase Coroinhas em 10/10/2026.
-- A comunidade continua determinando o modelo. "Local: Nome" nas observações
-- permite indicar o local real no link público sem mudar inscrições/modelos.
begin;
alter table public.acolitos_celebracoes
  drop constraint if exists acolitos_celebracoes_comunidade_check;
alter table public.acolitos_celebracoes
  add constraint acolitos_celebracoes_comunidade_check
  check (comunidade in ('matriz', 'santo_antonio', 'outra', 'outras_comunidades'));

create or replace function public.acolitos_novena_publica_missas(p_membro_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_out jsonb;
begin
  if p_membro_id is null
     or not exists (select 1 from public.acolitos_membros where id = p_membro_id and status = 'ativo') then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'data', c.data, 'horario', c.horario, 'comunidade', c.comunidade,
           'local_nome', nullif(btrim(substring(c.observacoes from E'Local: ([^\\r\\n]+)')), ''),
           'minha_funcao', (select e.funcao from public.acolitos_escalas e
                            where e.celebracao_id = c.id and e.membro_id = p_membro_id and e.status = 'escalado' limit 1),
           'funcoes', coalesce((
             select jsonb_agg(jsonb_build_object('funcao', mo.funcao,
                      'restantes', mo.quantidade - (select count(*) from public.acolitos_escalas e3
                                                    where e3.celebracao_id = c.id and e3.funcao = mo.funcao and e3.status = 'escalado'))
                    order by coalesce(array_position(array['cred_altar','cred_credencia','missal','altar','cruz','sineta','sinao','vela','apoio'], mo.funcao), 99))
             from public.acolitos_modelos mo
             join public.acolitos_habilitacoes h on h.membro_id = p_membro_id and h.funcao = mo.funcao
             where mo.tipo = c.tipo and mo.comunidade = c.comunidade
               and mo.quantidade > (select count(*) from public.acolitos_escalas e4
                                    where e4.celebracao_id = c.id and e4.funcao = mo.funcao and e4.status = 'escalado')
           ), '[]'::jsonb),
           'lotada', not exists (
             select 1 from public.acolitos_modelos mo
             where mo.tipo = c.tipo and mo.comunidade = c.comunidade and mo.quantidade >
               (select count(*) from public.acolitos_escalas e2
                where e2.celebracao_id = c.id and e2.funcao = mo.funcao and e2.status = 'escalado'))
         ) order by c.data, c.minutos), '[]'::jsonb) into v_out
  from public.acolitos_celebracoes c
  where c.data >= current_date and c.observacoes ilike 'Novena%';
  return v_out;
end; $$;

revoke execute on function public.acolitos_novena_publica_missas(uuid) from public;
grant execute on function public.acolitos_novena_publica_missas(uuid) to anon, authenticated;
commit;
