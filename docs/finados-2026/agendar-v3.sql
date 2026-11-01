-- v3 (31/10 noite): grade final de avisos. Horários de Brasília. Substitui os pendentes da v2.
-- Cerimoniários: agora e 05h45 (domingo+segunda, com arte), 08h (a partir das 9h), 17h (a partir das 19h), 21h (só segunda).
-- Pais e Acólitos/Coroinhas: só segunda, 12h, 15h e 18h.
begin;
update tarcisio_envios set estado='cancelado', erro='grade v3' where chave_unica like 'finados-2026:v2-%' and estado='pendente';
create temp table m(slot text, quando timestamptz, jid text, nome text, texto text, img text);
do $$
declare
  cer text := '120363233737410251@g.us'; pais text := '5519993418883-1552947165@g.us'; aco text := '5519991597635-1454354632@g.us';
  link text := E'\n\nMarque sua função:\nhttps://coroinhas.jcbplimeira.com.br/finados';
  art text := 'https://fttjgsotuosjfrasttds.supabase.co/storage/v1/object/public/tarcisio/avisos/finados-cerimoniarios-v3.png';
  seg_cer text := E'Segunda 02/11, Finados (8h): cerimoniários de altar e de credência, missal, cruz, velas, turíbulo e naveta.';
  seg_fil text := 'Missa de Finados, segunda-feira, 02/11, às 8h, na Matriz. Vagas: altar, sineta, sinão, apoio, cruz e velas.';
begin
  insert into m values
   ('v3-agora', now(), cer,'Cerimoniários🔲 - JCBP', E'🕯️ Todos os Santos e Finados.\n\nDomingo 01/11, Solenidade de Todos os Santos (7h, 9h e 19h): turíbulo e naveta.\n'||seg_cer||link, art),
   ('v3-0545', '2026-11-01 05:45-03', cer,'Cerimoniários🔲 - JCBP', E'🕯️ Todos os Santos e Finados.\n\nDomingo 01/11, Solenidade de Todos os Santos (7h, 9h e 19h): turíbulo e naveta.\n'||seg_cer||link, art),
   ('v3-0800', '2026-11-01 08:00-03', cer,'Cerimoniários🔲 - JCBP', E'🕯️ Todos os Santos e Finados.\n\nDomingo 01/11, Solenidade de Todos os Santos (9h e 19h): turíbulo e naveta.\n'||seg_cer||link, null),
   ('v3-1700', '2026-11-01 17:00-03', cer,'Cerimoniários🔲 - JCBP', E'🕯️ Todos os Santos e Finados.\n\nDomingo 01/11, Solenidade de Todos os Santos (19h): turíbulo e naveta.\n'||seg_cer||link, null),
   ('v3-2100', '2026-11-01 21:00-03', cer,'Cerimoniários🔲 - JCBP', E'🕯️ Finados.\n\n'||seg_cer||link, null);
  insert into m select s.slot, s.q, g.jid, g.nome, '🕯️ '||s.pre||seg_fil||E'\n\nMarque '||g.fim||E':\nhttps://coroinhas.jcbplimeira.com.br/finados', null
  from (values ('v3-1200','2026-11-01 12:00-03'::timestamptz,''),('v3-1500','2026-11-01 15:00-03','Ainda há vagas. '),('v3-1800','2026-11-01 18:00-03','Última chamada. ')) s(slot,q,pre),
       (values (pais,'Pais❗ - Acólitos e Coroinhas | JCBP','pelo link'),(aco,'Acólitos e Coroinhas ✝️ | JCBP','sua função')) g(jid,nome,fim);
end $$;
insert into tarcisio_envios(tipo,destino_jid,destino_nome,texto,imagem_url,agendado_para,chave_unica)
select 'aviso',jid,nome,texto,img,quando,'finados-2026:'||slot||':'||jid from m on conflict (chave_unica) do nothing;
select destino_nome, agendado_para at time zone 'America/Sao_Paulo' brt, estado, imagem_url is not null arte from tarcisio_envios where chave_unica like 'finados-2026:v3-%' order by agendado_para,destino_nome;
commit;
