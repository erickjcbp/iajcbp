-- Acólitos 066 — o convite de volta para a foto
--
-- A 065 destravou o envio. Esta põe o recado na ficha de quem ficou sem foto no
-- período em que o app barrava todo mundo (09/06 a 01/09/2026).
--
-- QUEM RECEBE, e por que este recorte:
--   · ativo, com login, e SEM foto;
--   · e que já entrou no app pelo menos uma vez (`last_sign_in_at` preenchido).
--
-- Não existe registro de quem foi barrado — a falha só aparecia na tela da pessoa
-- e nada era anotado. Então o recorte é o mais estreito que NÃO deixa ninguém de
-- fora: quem nunca abriu o app nunca chegou a tentar. Filtrar pela data do último
-- login seria mais estreito ainda, mas erraria: o app fica instalado e a sessão
-- não expira, então quem entrou em maio e seguiu usando não aparece nessa conta.
-- Sobra o contrário — gente que nunca tentou vai receber um convite gentil. Esse
-- é o erro barato; o caro seria calar com quem apanhou.
--
-- IDEMPOTENTE: rodar de novo não duplica nada (só entra onde ainda não há recado
-- deste tipo). O `seen: false` é o que faz o pop-up aparecer; ele NÃO é marcado
-- como visto por ter aparecido — some quando a foto sobe (foto-recado-core.js).

update public.acolitos_membros m
   set avisos = m.avisos || jsonb_build_array(
         jsonb_build_object('tipo', 'foto_conserto', 'seen', false))
  from auth.users u
 where u.id = m.user_id
   and m.status = 'ativo'
   and coalesce(m.foto_url, '') = ''
   and u.last_sign_in_at is not null
   and not exists (
     select 1 from jsonb_array_elements(m.avisos) a
      where a->>'tipo' = 'foto_conserto'
   );
