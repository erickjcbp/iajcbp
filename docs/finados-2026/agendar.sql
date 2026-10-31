-- Agenda os avisos de Finados na fila do Tarcísio (tarcisio_envios). Horários em Brasília.
-- Cerimoniários 19h = arte + link (sáb 31/10). 22h e domingo 12h: lembretes da missa de segunda 02/11 às 8h.
begin;
create temp table g(nome text, jid text);
insert into g values
 ('Cerimoniários🔲 - JCBP','120363233737410251@g.us'),
 ('Pais❗ - Acólitos e Coroinhas | JCBP','5519993418883-1552947165@g.us'),
 ('Acólitos e Coroinhas ✝️ | JCBP','5519991597635-1454354632@g.us');

create temp table m(slot text, quando timestamptz, grupo text, texto text, img text);
insert into m values
 ('19h','2026-10-31 19:00-03','cer',
  E'🕯️ LITURGIA DE FINADOS — CERIMONIÁRIOS\n\nDomingo 01/11 (7h, 9h e 19h): turíbulo e naveta.\nSegunda 02/11 (8h): cerimoniários de altar e de credência, missal, cruz, velas, turíbulo e naveta.\n\nMarque sua função pelo link, entrando com seu login:\nhttps://coroinhas.jcbplimeira.com.br/finados',
  'https://fttjgsotuosjfrasttds.supabase.co/storage/v1/object/public/tarcisio/avisos/finados-cerimoniarios-v1.png'),
 ('19h','2026-10-31 19:00-03','pais',
  E'🕯️ Missa de Finados — segunda-feira, 02/11, às 8h, na Matriz.\n\nSeu filho(a) pode servir? Pelo link, entrando com o login dele(a), é possível marcar a missa e a função (altar, sineta, sinão, apoio):\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('19h','2026-10-31 19:00-03','aco',
  E'🕯️ Missa de Finados — segunda-feira, 02/11, às 8h, na Matriz.\n\nMarque sua presença e escolha sua função (altar, sineta, sinão, apoio) pelo link, entrando com seu login:\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('22h','2026-10-31 22:00-03','cer',
  E'🕯️ Lembrete — Finados, segunda 02/11 às 8h (Matriz).\nAinda precisamos de cerimoniários de altar e de credência, missal, cruz, velas, turíbulo e naveta. Marque a sua:\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('22h','2026-10-31 22:00-03','pais',
  E'🕯️ Lembrete — Missa de Finados, segunda 02/11 às 8h (Matriz). Seu filho(a) pode servir? Marque pelo link, com o login dele(a):\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('22h','2026-10-31 22:00-03','aco',
  E'🕯️ Lembrete — Missa de Finados, segunda 02/11 às 8h (Matriz). Ainda dá tempo de marcar sua função:\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('dom','2026-11-01 12:00-03','cer',
  E'🕯️ Última chamada — Finados é amanhã, segunda 02/11 às 8h (Matriz). Confira se sua função está marcada e complete as vagas que faltam:\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('dom','2026-11-01 12:00-03','pais',
  E'🕯️ Última chamada — Missa de Finados amanhã, segunda 02/11 às 8h (Matriz). Seu filho(a) pode servir? Marque pelo link, com o login dele(a):\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('dom','2026-11-01 12:00-03','aco',
  E'🕯️ Última chamada — Missa de Finados amanhã, segunda 02/11 às 8h (Matriz). Marque sua função pelo link:\nhttps://coroinhas.jcbplimeira.com.br/finados',null);

insert into tarcisio_envios(tipo,destino_jid,destino_nome,texto,imagem_url,agendado_para,chave_unica)
select 'aviso', g.jid, g.nome, m.texto, m.img, m.quando, 'finados-2026:'||m.slot||':'||g.jid
from m join g on g.jid = case m.grupo when 'cer' then '120363233737410251@g.us'
                                      when 'pais' then '5519993418883-1552947165@g.us'
                                      else '5519991597635-1454354632@g.us' end
on conflict (chave_unica) do nothing;

select destino_nome, agendado_para at time zone 'America/Sao_Paulo' brt, estado, imagem_url is not null arte from tarcisio_envios where chave_unica like 'finados-2026:%' order by agendado_para, destino_nome;
commit;
