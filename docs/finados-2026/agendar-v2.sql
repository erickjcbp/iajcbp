-- v2 (31/10 noite): cerimoniários = domingo (Todos os Santos) + segunda (Finados); pais e acólitos = só segunda.
-- Link sem login. Horários de Brasília. Substitui os avisos pendentes da v1 (já cancelados).
begin;
create temp table m(slot text, quando timestamptz, jid text, nome text, texto text, img text);
insert into m values
 ('v2-0630','2026-11-01 06:30-03','120363233737410251@g.us','Cerimoniários🔲 - JCBP',
  E'🕯️ CORREÇÃO — esta mensagem substitui a anterior. O link NÃO precisa de login: é só digitar o seu nome.\n\nDomingo 01/11, Solenidade de Todos os Santos (7h, 9h e 19h): turíbulo e naveta.\nSegunda 02/11, Finados (8h): cerimoniários de altar e de credência, missal, cruz, velas, turíbulo e naveta.\n\nMarque sua função:\nhttps://coroinhas.jcbplimeira.com.br/finados',
  'https://fttjgsotuosjfrasttds.supabase.co/storage/v1/object/public/tarcisio/avisos/finados-cerimoniarios-v2.png'),
 ('v2-0630','2026-11-01 06:30-03','5519993418883-1552947165@g.us','Pais❗ - Acólitos e Coroinhas | JCBP',
  E'🕯️ CORREÇÃO — esta mensagem substitui a anterior. O link NÃO precisa de login: é só digitar o nome do seu filho(a).\n\nSegunda-feira, 02/11, Missa de Finados, às 8h, na Matriz. Vagas: altar, sineta, sinão, apoio, cruz e velas.\n\nMarque pelo link:\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('v2-0630','2026-11-01 06:30-03','5519991597635-1454354632@g.us','Acólitos e Coroinhas ✝️ | JCBP',
  E'🕯️ CORREÇÃO — esta mensagem substitui a anterior. O link NÃO precisa de login: é só digitar o seu nome.\n\nSegunda-feira, 02/11, Missa de Finados, às 8h, na Matriz. Vagas: altar, sineta, sinão, apoio, cruz e velas.\n\nMarque sua função:\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('v2-12h','2026-11-01 12:00-03','120363233737410251@g.us','Cerimoniários🔲 - JCBP',
  E'🕯️ Última chamada — Finados é amanhã, segunda 02/11 às 8h (Matriz). Hoje ainda há turíbulo e naveta na Solenidade de Todos os Santos (7h, 9h e 19h). Sem login, é só digitar o seu nome:\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('v2-12h','2026-11-01 12:00-03','5519993418883-1552947165@g.us','Pais❗ - Acólitos e Coroinhas | JCBP',
  E'🕯️ Última chamada — Missa de Finados amanhã, segunda 02/11 às 8h (Matriz). Seu filho(a) pode servir? Sem login, é só digitar o nome dele(a):\nhttps://coroinhas.jcbplimeira.com.br/finados',null),
 ('v2-12h','2026-11-01 12:00-03','5519991597635-1454354632@g.us','Acólitos e Coroinhas ✝️ | JCBP',
  E'🕯️ Última chamada — Missa de Finados amanhã, segunda 02/11 às 8h (Matriz). Sem login, é só digitar o seu nome:\nhttps://coroinhas.jcbplimeira.com.br/finados',null);
insert into tarcisio_envios(tipo,destino_jid,destino_nome,texto,imagem_url,agendado_para,chave_unica)
select 'aviso',jid,nome,texto,img,quando,'finados-2026:'||slot||':'||jid from m on conflict (chave_unica) do nothing;
select destino_nome, agendado_para at time zone 'America/Sao_Paulo' brt, estado, imagem_url is not null arte from tarcisio_envios where chave_unica like 'finados-2026:v2-%' order by agendado_para,destino_nome;
commit;
