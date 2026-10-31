-- Orientações de continuidade; não cria renovação, perda automática ou concessões.
alter table public.acolitos_missoes add column if not exists badge_manutencao text;
comment on column public.acolitos_missoes.badge_manutencao is 'Missão de continuidade da medalha; orientação pastoral, sem vencimento automático.';
with orientacoes(id,texto) as (values
('48c81656-d6db-5d56-a1f2-ca0301200696'::uuid,'Continue cultivando a empatia: converse com todos, escute com respeito e inclua quem estiver sozinho nas atividades.'),
('ae02cb81-c38b-59ec-a46c-2b912e8f5436'::uuid,'Continue atento a quem precisa: ofereça ajuda com generosidade e participe das ações solidárias que estiverem ao seu alcance.'),
('0e6fa658-90e8-54cd-ab96-5cc4fe0091a7'::uuid,'Continue recebendo os novos pelo nome, apresentando a equipe e acompanhando seus primeiros passos para que se sintam parte da pastoral.'),
('e3e89247-dbe8-5d0c-9490-9fef78462626'::uuid,'Continue firme no seu recomeço: cumpra os combinados, peça ajuda nas dificuldades e retome o serviço quando algo não sair como esperado.'),
('02665df3-b6d6-49a9-8d84-d6354e6afe2d'::uuid,'Cultive sua vida de oração e participe das celebrações com atenção, levando o respeito e a fé também para as atitudes do dia a dia.'),
('64faf676-5d46-59c1-9b42-30e8d3fc7d21'::uuid,'Continue acolhendo as orientações com humildade, colocando em prática o que aprendeu e pedindo retorno sobre sua evolução.'),
('3e021564-887b-4aaf-92c2-65f63998395d'::uuid,'Continue cooperando com a equipe: compartilhe tarefas, respeite os combinados e ajude os colegas sem precisar ser o centro das atenções.'),
('bf121e63-7f14-485f-b468-9b454a4bdcf1'::uuid,'Continue servindo com constância e responsabilidade; avise quando não puder comparecer e procure apoio para atravessar as dificuldades.'),
('f55b34da-f14a-4b8d-84c5-64bd2887e7c9'::uuid,'Continue acompanhando quem está aprendendo, ensine com paciência e dê espaço para que os novos sirvam com autonomia e confiança.'),
('2fbbe92b-3ce1-5bbc-82d9-7b03e985c5c5'::uuid,'Continue cuidando dos materiais e dos espaços da pastoral: evite desperdícios, reutilize o que puder e incentive a equipe a fazer o mesmo.'),
('b08b7d6c-f4c5-498b-8caf-ff111c261f5f'::uuid,'Continue sendo exemplo de humildade, cuidado com a celebração e responsabilidade; acompanhe a equipe e ajude a formar novos servidores.'),
('d9574327-65f6-41b9-a2b9-296a8c6708e4'::uuid,'Mantenha o capricho no serviço: prepare os materiais com cuidado, confira os detalhes e ensine os colegas a cuidar bem do que utilizam.'),
('a4bdff49-ed32-519a-b3af-55458abec35d'::uuid,'Continue organizando os materiais e registrando os aprendizados, mantendo tudo acessível e atualizado para quem vier depois.'),
('b9a268d8-0c07-4714-8736-c5525a83965a'::uuid,'Continue convidando com respeito e acolhendo quem demonstrar interesse; acompanhe os novos para que o convite se transforme em participação.'),
('0a85674c-fb91-43c6-a2ca-0675daeff171'::uuid,'Continue comprometido com a formação de cerimoniário: participe dos encontros, estude e pratique as orientações com humildade.'),
('72a6d0c9-1729-49f0-81f3-0ffcefe6e283'::uuid,'Continue sendo alguém em quem a equipe pode confiar: cumpra os combinados, acolha as dúvidas e ajude sem diminuir ninguém.'),
('ffddc9fa-ceb9-57a1-a533-1cbff8aac446'::uuid,'Continue promovendo o diálogo: escute os envolvidos sem alimentar fofocas e ajude a resolver os conflitos com respeito e serenidade.'),
('f247fb41-9758-480f-a2ba-29739987e09b'::uuid,'Continue chegando com antecedência para se preparar, respeite os horários e avise a equipe assim que perceber um imprevisto.'),
('fb2b6ede-64b9-4601-91da-83287d325426'::uuid,'Honre seu compromisso com a Ordem dos Cerimoniários: mantenha a formação, respeite as orientações e sirva em união com toda a equipe.'),
('501749da-47ba-524c-b843-3342317d9434'::uuid,'Continue lendo e refletindo o Evangelho, partilhando suas reflexões com simplicidade e procurando viver aquilo que anuncia.'),
('a188d83c-07db-5c1f-867e-257b9be8940a'::uuid,'Continue percebendo o que precisa ser preparado e organizado, colaborando antes e depois das celebrações mesmo quando ninguém estiver olhando.'),
('54082821-ba5c-460c-8ba5-eaf7187c9d18'::uuid,'Continue ouvindo os mais novos, incentivando sua participação e dando exemplo de respeito, alegria e responsabilidade no serviço.')
)
update public.acolitos_missoes mi set badge_manutencao=o.texto from orientacoes o
where mi.id=o.id and mi.concede_badge and mi.validacao in ('avaliada','reivindicada');

-- Conteúdo público das medalhas, sem dados de avaliação ou concessão individual.
create or replace function public._acolitos_medalha_detalhes(mi public.acolitos_missoes, p_manual boolean default false) returns jsonb
language sql stable set search_path='public' as $$
 select jsonb_build_object('desc',coalesce(nullif(mi.badge_desc,''),nullif(mi.descricao,'medalha'),mi.titulo),'requisito',case
        when mi.criterio->>'fonte'='habilitacao' then 'Fique Apto em ' || (
          select string_agg(coalesce(lbl.label, f.value), ' e ' order by f.ord)
          from jsonb_array_elements_text(mi.criterio->'funcoes') with ordinality f(value,ord)
          left join (values ('apoio','Apoio'),('cruz','Cruz'),('vela','Vela'),('sineta','Sineta'),('sinao','Sinão'),
            ('altar','Altar'),('turibulo','Turíbulo'),('naveta','Naveta'),('missal','Missal'),
            ('cred_altar','Cerimoniário de Altar'),('cred_credencia','Cerimoniário de Credência'),
            ('mitra','Mitra'),('baculo','Báculo')) lbl(slug,label) on lbl.slug=f.value)
        when mi.criterio->>'fonte'='idade' then 'Complete ' || (mi.criterio->>'min') || ' anos'
        when mi.criterio->>'fonte'='missas_total' then 'Sirva ' || (mi.criterio->>'quantidade') || ' missas no total'
        when mi.criterio->>'fonte'='ensaios_total' then 'Participe de ' || (mi.criterio->>'quantidade') || ' ensaios no total'
        when mi.criterio->>'fonte'='funcoes_aptas' then 'Fique Apto em ' || (mi.criterio->>'quantidade') || ' funções'
        when mi.criterio->>'fonte'='solicitos' then 'Sirva ' || (mi.criterio->>'quantidade') || ' vezes sem estar escalado'
        when mi.criterio->>'fonte'='campeao' then 'Vença ' || (mi.criterio->>'quantidade') || ' temporada(s)'
        when mi.criterio->>'fonte'='tenure' then 'Complete ' || case when (mi.criterio->>'meses')::int >= 12 and (mi.criterio->>'meses')::int % 12 = 0
              then ((mi.criterio->>'meses')::int / 12)::text || ' ano(s)' else (mi.criterio->>'meses') || ' meses' end || ' de pastoral'
        when mi.validacao in ('avaliada','reivindicada') then coalesce(nullif(nullif(mi.descricao,'medalha'),''),nullif(mi.badge_desc,''),mi.titulo) || ' Reconhecimento concedido pela coordenação.'
        else 'Conclua: ' || mi.titulo end, 'manutencao',case
 when mi.validacao in ('avaliada','reivindicada') and nullif(btrim(mi.badge_manutencao),'') is not null then mi.badge_manutencao
 when p_manual then 'Concessão manual registrada, sem missão recorrente ou vencimento automático.'
 when mi.criterio->>'fonte'='habilitacao' then 'Manter a habilitação exigida nas funções desta missão. A posse automática acompanha a aptidão atual; concessões manuais não vencem automaticamente.'
 when mi.criterio->>'fonte'='funcoes_aptas' then 'Manter pelo menos ' || (mi.criterio->>'quantidade') || ' funções aptas. A posse automática acompanha a aptidão atual; concessões manuais não vencem automaticamente.'
 when mi.validacao in ('avaliada','reivindicada') then 'Sem missão recorrente ou vencimento automático após o reconhecimento da coordenação.'
 when mi.criterio is not null then 'Sem missão recorrente ou vencimento por tempo. A posse automática depende de os registros continuarem atendendo à missão.'
 else 'Manter a missão registrada como concluída. Sem tarefa recorrente ou vencimento por tempo.' end);
$$;
revoke all on function public._acolitos_medalha_detalhes(public.acolitos_missoes,boolean) from public,anon,authenticated;


notify pgrst,'reload schema';
