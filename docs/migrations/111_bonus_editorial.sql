begin;
-- Somente bônus livres anteriores; capítulos, exclusivas e sazonais de semana não são substituídos.
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Tire uma dúvida com o padre ou o sacristão.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Diplomata litúrgico' where id='7a00a8e0-5dd6-44fe-809e-96a8cd3f781e' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Diplomata litúrgico' and descricao is not distinct from 'Tire uma dúvida com o padre ou o sacristão.';
update public.acolitos_missoes set descricao='Duas pessoas. Um combinado. Será que sai redondo?

1. Combine com um colega uma pequena tarefa que os dois já podem fazer. Dividam as partes e confiram o resultado com quem orienta.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Como vocês dividiram a tarefa e o que ajustaram juntos?' , titulo='Dupla no mesmo ritmo' where id='5de12cf9-537a-43c5-8c3e-8acf2ae8e960' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Dupla dinâmica' and descricao is not distinct from 'Combine um sinal secreto com seu parceiro de altar.';
update public.acolitos_missoes set descricao='Um elogio fica melhor quando tem uma história por trás.

1. Escolha uma atitude boa que você viu em alguém da equipe. Conte à pessoa exatamente o que percebeu, sem forçar exposição em público.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Que atitude você reconheceu e como contou isso?' , titulo='Mensagem que vale guardar' where id='4646ea5f-4206-478e-8314-cc71f46cb208' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Elogio surpresa' and descricao is not distinct from 'Elogie sinceramente a túnica de um colega.';
update public.acolitos_missoes set descricao='Uma imagem, um nome e uma história que talvez você não conheça.

1. Escolha uma imagem de santo num lugar permitido e descubra um episódio de sua vida com uma fonte indicada pela formação.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Quem você escolheu e qual episódio achou mais interessante?' , titulo='Pista de santidade' where id='46831222-1b76-43c3-9b9b-86b754e438db' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Caça ao santo' and descricao is not distinct from 'Conte quantas imagens de santos tem na igreja.';
update public.acolitos_missoes set descricao='Sua missão é encontrar um jeito de deixar o dia de alguém mais leve.

1. Antes ou depois da missa, conte uma história curta, faça um elogio sincero ou uma brincadeira que a pessoa curta. Nada de constranger.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que você tentou e como a pessoa reagiu?' , titulo='Operação: sorriso desbloqueado' where id='d09fec85-75c4-4856-9ceb-b05f273d5007' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Caçador de sorrisos' and descricao is not distinct from 'Faça um colega sorrir antes da missa.';
update public.acolitos_missoes set descricao='O desafio é precisão, não velocidade. Você consegue servir com atenção do começo ao fim?

1. Durante a leitura, observe sua postura e mantenha a vela firme do jeito ensinado no treino. Sem criar testes com a chama.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que te ajudou a manter a atenção?' , titulo='Modo vela tranquila' where id='a81b225d-5d44-4e18-a01c-bf6f75413391' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre do equilíbrio' and descricao is not distinct from 'Segure a vela sem deixar a chama tremer durante uma leitura inteira.';
update public.acolitos_missoes set descricao='Um pit stop de respeito: tudo pronto, nada corrido.

1. Antes de servir, vista a túnica com calma e peça a uma dupla para conferir se está tudo certo. O recorde aqui é capricho, não cronômetro.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual detalhe a dupla percebeu na conferência?' , titulo='Pit stop da túnica' where id='36289cbd-1bc0-46a0-a293-5b2de6023186' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Velocista da túnica' and descricao is not distinct from 'Vista a túnica certinho no menor tempo possível (sem amassar!).';
update public.acolitos_missoes set descricao='A igreja tem detalhes que parecem invisíveis. Até você olhar de novo.

1. Escolha um detalhe visível do altar sem tocar nos objetos. Investigue o que ele significa com alguém da equipe.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual detalhe você escolheu e o que descobriu?' , titulo='O detalhe que passou batido' where id='cbc849e2-82e4-4837-9c4b-64c0239b05a5' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Olho de águia' and descricao is not distinct from 'Note um detalhe do altar que ninguém tinha reparado e conte pra coordenação.';
update public.acolitos_missoes set descricao='Consegue descobrir o código que anuncia a missa?

1. Escute as badaladas antes da celebração sem deixar sua função de lado. Compare sua contagem com a de uma dupla e confirme o costume local com a equipe.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Quantas você ouviu? A dupla ouviu o mesmo?' , titulo='O código das badaladas' where id='591f0336-5f82-469f-a3df-b24cdcde3432' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Adivinha o sino' and descricao is not distinct from 'Descubra quantas badaladas o sino dá antes da missa.';
update public.acolitos_missoes set descricao='Dez segundos de observação. Depois, só vale a memória.

1. Observe o altar de um lugar permitido por dez segundos. Olhe para outro lado e liste os objetos que lembra; confira com alguém da equipe sem tocar neles.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que lembrou de primeira e o que passou batido?' , titulo='Print na memória' where id='f6cc5297-59e0-4d55-b8bb-0e7b273a5951' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Memória fotográfica' and descricao is not distinct from 'Olhe o altar por 10 segundos e depois liste tudo que tinha nele.';
update public.acolitos_missoes set descricao='Uma frase em latim. Um significado para levar para fora da igreja.

1. Descubra o sentido de “Ite, missa est” com quem orienta a formação. Explique com uma situação do seu dia, sem copiar uma definição.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Como você explicaria a frase para um amigo?' , titulo='Desbloqueie a frase' where id='96722496-cd43-4053-b44a-2aa31217ae02' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Tradutor da missa' and descricao is not distinct from 'Descubra o que significa "Ite, missa est".';
update public.acolitos_missoes set descricao='Não é só roupa: cada peça conta uma parte da história.

1. Escolha três paramentos que você conhece. Sem manusear, descubra seus nomes, cores e em que celebrações aparecem.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Quais três escolheu e qual detalhe te surpreendeu?' , titulo='O guarda-roupa tem pistas' where id='b7c3036d-ec3e-4c7c-99f5-d5aec82090c3' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre dos paramentos' and descricao is not distinct from 'Saiba o nome de 3 paramentos e a cor de cada um.';
update public.acolitos_missoes set descricao='Três letras, uma pista. Bora decifrar?

1. Encontre o símbolo IHS numa imagem ou lugar autorizado. Pergunte à equipe o que representa e invente um jeito curto de explicar.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Onde encontrou e como explicaria o símbolo?' , titulo='Arquivo IHS' where id='9dcbd7d8-221c-4011-8e7e-483a53abaed6' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Decifrador de símbolos' and descricao is not distinct from 'Descubra o que significa o símbolo IHS.';
update public.acolitos_missoes set descricao='Nem todo objeto é enfeite. Descubra o que faz falta de verdade.

1. Escolha um objeto importante para a celebração e confirme com a formação por que ele é necessário. Observe de longe, sem retirar nada do lugar.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual objeto investigou e qual é sua função?' , titulo='Caso aberto na sacristia' where id='aa2f40e8-1c0f-48b5-a2f7-9035b2322119' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Sherlock litúrgico' and descricao is not distinct from 'Descubra qual objeto não pode faltar de jeito nenhum numa missa.';
update public.acolitos_missoes set descricao='Um gesto que dura segundos pode ter uma história enorme.

1. Observe a reverência e o beijo do altar no início da missa. Depois, descubra seu significado com quem acompanha a formação.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que o gesto significa, nas suas palavras?' , titulo='Um gesto, uma história' where id='ca5bd98b-7344-4c64-811f-0cd360aac3d6' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Detetive dos gestos' and descricao is not distinct from 'Descubra por que o padre beija o altar no começo da missa.';
update public.acolitos_missoes set descricao='Às vezes, uma pequena mudança deixa tudo mais fácil.

1. Depois de servir, pense num ponto que poderia melhorar. Proponha uma solução possível à equipe, sem expor ou culpar colegas.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual foi sua ideia e que problema ela ajudaria a resolver?' , titulo='Uma ideia que muda o jogo' where id='0bf8289a-b066-4e9a-b419-176b781378a6' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Detetive de desvios' and descricao is not distinct from 'Aponte uma coisinha que daria pra melhorar na próxima celebração.';
update public.acolitos_missoes set descricao='O que muda quando a celebração ganha um tamanho diferente?

1. Compare uma missa habitual com uma solenidade que você conhece. Confira com a formação dois cuidados da equipe que mudam nesse contexto.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Quais diferenças você encontrou e por que elas importam?' , titulo='Modo celebração especial' where id='abd9bc6c-ee9d-49cc-8db1-fda5492e9ebb' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre cerimoniólogo' and descricao is not distinct from 'Explique a diferença entre uma missa comum e uma missa solene.';
update public.acolitos_missoes set descricao='Se a pastoral fosse um trailer de um minuto, o que não poderia faltar?

1. Convide alguém que queira ouvir para uma apresentação de um minuto. Conte o que fazemos e uma coisa que você gosta de viver aqui.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que escolheu contar e qual pergunta a pessoa fez?' , titulo='Trailer da nossa equipe' where id='0d65117f-6997-4b71-95b2-551b224eaa3b' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Embaixador da pastoral' and descricao is not distinct from 'Apresente a pastoral pra alguém de fora em 1 minuto.';
update public.acolitos_missoes set descricao='Três encontros rápidos podem mudar o clima da equipe.

1. Cumprimente três colegas antes de servir e pergunte como estão. Cada um escolhe se quer aceno, cumprimento ou só um oi.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que descobriu sobre o dia da equipe?' , titulo='Combo de boas-vindas' where id='d2aa3e3d-5180-4f2f-9824-c2b063c915c9' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Aperto especial' and descricao is not distinct from 'Cumprimente 3 acólitos antes de servir.';
update public.acolitos_missoes set descricao='Hoje sua oração tem um destino especial.

1. Escolha alguém por quem rezar durante a missa. Guarde a intenção com você; não precisa expor uma situação pessoal de ninguém.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Conte só como foi lembrar dessa pessoa na oração.' , titulo='Uma intenção no bolso' where id='075bb7c1-9eee-4bfd-aab7-be7b6dd2e6b9' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Intenção do dia' and descricao is not distinct from 'Reze por alguém específico durante a missa.';
update public.acolitos_missoes set descricao='Se pudesse salvar três momentos da missa de hoje, quais seriam?

1. Depois da celebração, relembre três coisas boas. Escolha uma delas para agradecer a quem ajudou a acontecer.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Quais momentos entrariam no seu replay?' , titulo='Replay das coisas boas' where id='ef6c7f32-d700-4009-97de-6d9c0a941577' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Gratidão' and descricao is not distinct from 'No fim da missa, lembre 3 coisas boas que aconteceram nela.';
update public.acolitos_missoes set descricao='Uma pequena pausa antes de entrar em cena.

1. Antes de servir, reze ao seu anjo da guarda e escolha uma atitude de atenção para viver na celebração.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Que atitude você escolheu levar para a missa?' , titulo='Antes do primeiro passo' where id='b87ffbdb-e6c5-4576-9b26-39d3ec3ef6ce' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Anjo da guarda' and descricao is not distinct from 'Reze pro seu anjo da guarda antes de entrar pra servir.';
update public.acolitos_missoes set descricao='Parecem parecidas, mas cada uma tem seu papel.

1. Observe as galhetas sem tocar nelas. Pergunte à equipe o que cada uma contém e como são usadas na preparação das oferendas.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que você descobriu sobre cada galheta?' , titulo='O mistério das galhetas' where id='037ae4e5-15d5-44ba-8b30-11c29bc8ab51' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Detetive do altar' and descricao is not distinct from 'Descubra o que tem dentro das galhetas.';
update public.acolitos_missoes set descricao='Pode estar numa parede, numa imagem ou num detalhe que você sempre ignorou.

1. Procure um símbolo cristão num espaço aberto e permitido. Descubra seu significado com alguém da formação.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual símbolo encontrou, onde estava e o que significa?' , titulo='Símbolo encontrado!' where id='12d6a658-988f-4651-a277-43685bb056ff' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Caça ao símbolo' and descricao is not distinct from 'Ache um símbolo cristão escondido na igreja (peixe, cordeiro, pomba...).';
update public.acolitos_missoes set descricao='Mesmo lugar. Um olhar completamente novo.

1. Observe um detalhe da igreja que você costuma passar sem perceber. Mostre a uma dupla e descubram juntos uma informação sobre ele.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que vocês notaram quando olharam com mais calma?' , titulo='Zoom no que ninguém viu' where id='6c597ba9-bb47-44fc-85fa-755728f25c35' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Olhar de lince' and descricao is not distinct from 'Perceba que uma vela está acabando antes de todo mundo.';
update public.acolitos_missoes set descricao='Sem buscar foto: como é o altar no seu desenho?

1. Depois de observar o altar de um lugar permitido, desenhe o que lembra. Compare com uma dupla e descubram juntos o detalhe que faltou.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que seu desenho acertou e o que você acrescentaria?' , titulo='Mapa de memória' where id='463f21d7-1ca9-4c92-8ddc-53d66210b28f' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Desenho do altar' and descricao is not distinct from 'Desenhe o altar de memória quando chegar em casa.';
update public.acolitos_missoes set descricao='Um microfone imaginário. Uma descoberta de verdade.

1. Depois da celebração, convide alguém da equipe para uma pergunta sobre como começou a servir. Ouça sem interromper.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Que pergunta fez e qual parte da resposta ficou com você?' , titulo='Uma pergunta boa' where id='20ebaf27-d648-4248-ad81-36969af6f775' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Repórter mirim' and descricao is not distinct from 'Conte pra sua família como foi servir hoje.';
update public.acolitos_missoes set descricao='O melhor truque para não correr é preparar antes.

1. Combine com quem orienta um pequeno checklist da sua função. Confira os itens permitidos antes de servir e peça uma conferência.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Que item do checklist fez diferença?' , titulo='Check antes de entrar' where id='29db2350-5ccc-4e5f-a2fc-5b5821512d52' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre da preparação' and descricao is not distinct from 'Separe tudo que vai usar antes da missa começar.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Por que o incenso?”. Sua missão é descobrir e contar do seu jeito.

1. Descubra o significado do incenso na missa.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Por que o incenso?' where id='c33b8f99-c3fa-4ee8-8c0b-fa3b641ddbad' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Por que o incenso?' and descricao is not distinct from 'Descubra o significado do incenso na missa.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “O que é a patena?”. Sua missão é descobrir e contar do seu jeito.

1. Descubra pra que serve a patena.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='O que é a patena?' where id='c93ff66f-e561-46a1-8fdd-017771b176c6' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='O que é a patena?' and descricao is not distinct from 'Descubra pra que serve a patena.';
update public.acolitos_missoes set descricao='Entre no desafio “As partes da missa” e descubra algo para contar à equipe.

1. Saiba dizer as 4 grandes partes da missa.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='As partes da missa' where id='2927b302-e0cc-4481-8f7f-3e7ffb06c146' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='As partes da missa' and descricao is not distinct from 'Saiba dizer as 4 grandes partes da missa.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Por que sineta?”. Sua missão é descobrir e contar do seu jeito.

1. Descubra por que tocamos a sineta na consagração.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Por que sineta?' where id='2c940ec9-5da2-4db2-b2f0-4ecd8a0afc8e' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Por que sineta?' and descricao is not distinct from 'Descubra por que tocamos a sineta na consagração.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “O que é o sacrário?”. Sua missão é descobrir e contar do seu jeito.

1. Descubra o que fica guardado no sacrário.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='O que é o sacrário?' where id='701fb43c-ceed-404f-a3c3-bcd00ab5b971' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='O que é o sacrário?' and descricao is not distinct from 'Descubra o que fica guardado no sacrário.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Cores do ano”. Sua missão é descobrir e contar do seu jeito.

1. Descubra quais são as 4 cores litúrgicas principais.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Cores do ano' where id='3c394765-9d06-40e3-b585-58266f54e8ba' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Cores do ano' and descricao is not distinct from 'Descubra quais são as 4 cores litúrgicas principais.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Advento x Quaresma”. Sua missão é descobrir e contar do seu jeito.

1. Descubra a diferença entre o tempo do Advento e o da Quaresma.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Advento x Quaresma' where id='593424da-4e7d-4be7-909e-c55c179131ff' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Advento x Quaresma' and descricao is not distinct from 'Descubra a diferença entre o tempo do Advento e o da Quaresma.';
update public.acolitos_missoes set descricao='A igreja também conta histórias pelo que a gente ouve.

1. Num momento permitido, observe os sons do ambiente sem produzir barulho. Escolha um e descubra de onde vem.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual som escolheu e por que chamou sua atenção?' , titulo='De onde vem esse som?' where id='acbbd325-d6bc-4159-9650-5853212d668a' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Caçador de eco' and descricao is not distinct from 'Descubra qual canto da igreja faz mais eco.';
update public.acolitos_missoes set descricao='Entre no desafio “Mestre do agradecimento” e descubra algo para contar à equipe.

1. Agradeça a 3 pessoas diferentes depois da missa.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Mestre do agradecimento' where id='75dfb64c-8443-4ee1-ac56-9ef4a3c95cd4' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre do agradecimento' and descricao is not distinct from 'Agradeça a 3 pessoas diferentes depois da missa.';
update public.acolitos_missoes set descricao='Entre no desafio “Detetive das velas” e descubra algo para contar à equipe.

1. Conte quantas velas estão acesas na missa de hoje.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Detetive das velas' where id='7ecbf6d1-c86a-4730-a6f4-5604f30f67ae' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Detetive das velas' and descricao is not distinct from 'Conte quantas velas estão acesas na missa de hoje.';
update public.acolitos_missoes set descricao='Entre no desafio “Pose de santo” e descubra algo para contar à equipe.

1. Imite a pose de uma imagem de santo numa foto.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Pose de santo' where id='3c3b68cb-cb9b-4826-9e8d-7dcc21816abb' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Pose de santo' and descricao is not distinct from 'Imite a pose de uma imagem de santo numa foto.';
update public.acolitos_missoes set descricao='Entre no desafio “Caça ao tesouro” e descubra algo para contar à equipe.

1. Ache o objeto mais brilhante da sacristia.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Caça ao tesouro' where id='7d6fc08a-3125-4ef1-8327-a95e2d207d57' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Caça ao tesouro' and descricao is not distinct from 'Ache o objeto mais brilhante da sacristia.';
update public.acolitos_missoes set descricao='Um desafio para viver por dentro. Faça no seu tempo.

1. Fique 5 minutos em silêncio total antes da missa começar.
2. Viva esse momento com calma. Você escolhe o que deseja compartilhar.
3. Que parte da experiência você gostaria de guardar? Não precisa expor intenções pessoais.' , titulo='Silêncio dourado' where id='132e1638-0c82-4ff0-bc68-2caae3b11d3a' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Silêncio dourado' and descricao is not distinct from 'Fique 5 minutos em silêncio total antes da missa começar.';
update public.acolitos_missoes set descricao='Entre no desafio “Mestre dos sinos” e descubra algo para contar à equipe.

1. Saiba o momento certo de tocar a sineta na consagração.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Mestre dos sinos' where id='3eaea2df-a92b-4538-b8b2-cee65606b8da' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre dos sinos' and descricao is not distinct from 'Saiba o momento certo de tocar a sineta na consagração.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Detetive das cores”. Sua missão é descobrir e contar do seu jeito.

1. Descubra por que o roxo é a cor da Quaresma.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Detetive das cores' where id='d5c75f6a-45fb-4cc0-9ffc-834a3bcd25b3' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Detetive das cores' and descricao is not distinct from 'Descubra por que o roxo é a cor da Quaresma.';
update public.acolitos_missoes set descricao='Entre no desafio “Cálice ou âmbula?” e descubra algo para contar à equipe.

1. Descubra a diferença entre o cálice e a âmbula.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Cálice ou âmbula?' where id='b6c53930-4e97-4aa7-8089-0248fcedf2c2' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Cálice ou âmbula?' and descricao is not distinct from 'Descubra a diferença entre o cálice e a âmbula.';
update public.acolitos_missoes set descricao='Entre no desafio “Caçador do padroeiro” e descubra algo para contar à equipe.

1. Descubra o padroeiro da paróquia e uma curiosidade dele.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Caçador do padroeiro' where id='ed400573-7439-4a44-9bc8-e48f8518ede7' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Caçador do padroeiro' and descricao is not distinct from 'Descubra o padroeiro da paróquia e uma curiosidade dele.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Mestre do gesto”. Sua missão é descobrir e contar do seu jeito.

1. Descubra o que significa a genuflexão.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Mestre do gesto' where id='ed8b63b5-85f8-47f4-ac3b-5b8bfeba8383' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre do gesto' and descricao is not distinct from 'Descubra o que significa a genuflexão.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Ensine um truque do altar pra um acólito em 30 segundos.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Mentor relâmpago' where id='dc91ed17-e54b-4d63-850d-535bc2be7990' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mentor relâmpago' and descricao is not distinct from 'Ensine um truque do altar pra um acólito em 30 segundos.';
update public.acolitos_missoes set descricao='Entre no desafio “Cronista da missa” e descubra algo para contar à equipe.

1. Diga em 3 frases o que tornou a missa de hoje especial.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Cronista da missa' where id='bcefe5a6-e8aa-458a-bc4b-5c1b973ae34b' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Cronista da missa' and descricao is not distinct from 'Diga em 3 frases o que tornou a missa de hoje especial.';
update public.acolitos_missoes set descricao='Entre no desafio “Inspetor de qualidade” e descubra algo para contar à equipe.

1. Faça um checklist mental do altar e relate à coordenação.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Inspetor de qualidade' where id='19015cbe-92aa-4041-a827-fa2fed7aee4d' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Inspetor de qualidade' and descricao is not distinct from 'Faça um checklist mental do altar e relate à coordenação.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Resolva a dúvida de um acólito com toda a paciência.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Diplomata' where id='d406882c-bc38-4b08-85e0-b73c63b01bca' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Diplomata' and descricao is not distinct from 'Resolva a dúvida de um acólito com toda a paciência.';
update public.acolitos_missoes set descricao='Entre no desafio “Historiador da paróquia” e descubra algo para contar à equipe.

1. Descubra há quanto tempo a paróquia existe.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Historiador da paróquia' where id='dbc8ccf4-0be9-46c7-963d-63d3e731bde8' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Historiador da paróquia' and descricao is not distinct from 'Descubra há quanto tempo a paróquia existe.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “O que é a píxide?”. Sua missão é descobrir e contar do seu jeito.

1. Descubra pra que serve a píxide.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='O que é a píxide?' where id='56e16bc3-03a3-402f-9f7e-052b22d05d29' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='O que é a píxide?' and descricao is not distinct from 'Descubra pra que serve a píxide.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Por que a água no vinho?”. Sua missão é descobrir e contar do seu jeito.

1. Descubra por que o padre mistura água no vinho.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Por que a água no vinho?' where id='20835f54-4a0f-49f3-b00a-af2b8525fa38' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Por que a água no vinho?' and descricao is not distinct from 'Descubra por que o padre mistura água no vinho.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “O Aleluia some?”. Sua missão é descobrir e contar do seu jeito.

1. Descubra em que tempo litúrgico não se canta o Aleluia.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='O Aleluia some?' where id='ae0c5746-dc36-4417-a58d-38bc8c6cc5e0' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='O Aleluia some?' and descricao is not distinct from 'Descubra em que tempo litúrgico não se canta o Aleluia.';
update public.acolitos_missoes set descricao='Entre no desafio “Guardião atento” e descubra algo para contar à equipe.

1. Perceba e avise antes que falte algo no altar.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Guardião atento' where id='3b7a1c05-f1ad-44e1-9473-b8cc9c39dbed' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Guardião atento' and descricao is not distinct from 'Perceba e avise antes que falte algo no altar.';
update public.acolitos_missoes set descricao='Entre no desafio “Mestre do tempo” e descubra algo para contar à equipe.

1. Saiba a hora certa de cada gesto sem ser avisado.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Mestre do tempo' where id='aaa90a1a-2424-462a-8e8b-40ada213faf9' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre do tempo' and descricao is not distinct from 'Saiba a hora certa de cada gesto sem ser avisado.';
update public.acolitos_missoes set descricao='Entre no desafio “Detetive do erro” e descubra algo para contar à equipe.

1. Note um detalhe que poderia ter sido melhor (e guarde pra você).
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Detetive do erro' where id='e19797da-97b2-45d9-b133-7ac9d51d38c9' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Detetive do erro' and descricao is not distinct from 'Note um detalhe que poderia ter sido melhor (e guarde pra você).';
update public.acolitos_missoes set descricao='Sabe aquela pessoa que você vê sempre e ainda não conhece?

1. Converse com três colegas que topem participar. Descubra como gostam de ser chamados e uma coisa que curtem fazer.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Conte como foi lembrar e chamar cada um pelo nome, sem expor informações pessoais.' , titulo='Nomes que viram encontros' where id='b27413cc-6172-4699-914b-beab42b87d46' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Memória de nomes' and descricao is not distinct from 'Decore o nome de 5 colegas da pastoral.';
update public.acolitos_missoes set descricao='Um desafio para viver por dentro. Faça no seu tempo.

1. Leve um versículo no coração durante a missa.
2. Viva esse momento com calma. Você escolhe o que deseja compartilhar.
3. Que parte da experiência você gostaria de guardar? Não precisa expor intenções pessoais.' , titulo='Versículo no bolso' where id='15e7e191-116d-46e2-ab00-046269065a5e' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Versículo no bolso' and descricao is not distinct from 'Leve um versículo no coração durante a missa.';
update public.acolitos_missoes set descricao='Um desafio para viver por dentro. Faça no seu tempo.

1. Ofereça a missa por alguém da sua família.
2. Viva esse momento com calma. Você escolhe o que deseja compartilhar.
3. Que parte da experiência você gostaria de guardar? Não precisa expor intenções pessoais.' , titulo='Oferecimento' where id='c3869e02-9e2d-473b-b0e3-cfde0cbb753c' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Oferecimento' and descricao is not distinct from 'Ofereça a missa por alguém da sua família.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Explique o significado de um paramento pra um acólito.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Aula relâmpago' where id='512d166c-caf8-442f-8d1f-4a13f4cbfb38' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Aula relâmpago' and descricao is not distinct from 'Explique o significado de um paramento pra um acólito.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Mestre dos ritos”. Sua missão é descobrir e contar do seu jeito.

1. Explique por que existe a procissão de entrada.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Mestre dos ritos' where id='fd027d67-a657-437a-b9f8-beef1a4ffdb9' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre dos ritos' and descricao is not distinct from 'Explique por que existe a procissão de entrada.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Explique o que muda numa missa solene.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Guia da solene' where id='6eddc4ab-f6c8-4a5e-b792-f279dd2a4e8d' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Guia da solene' and descricao is not distinct from 'Explique o que muda numa missa solene.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Professor de gestos”. Sua missão é descobrir e contar do seu jeito.

1. Ensine a reverência correta pra um novato.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Professor de gestos' where id='51b058a0-64a6-4ed1-8089-d32f48ed0e75' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Professor de gestos' and descricao is not distinct from 'Ensine a reverência correta pra um novato.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Contador de tradições”. Sua missão é descobrir e contar do seu jeito.

1. Conte uma tradição da Igreja pra a turma.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Contador de tradições' where id='0dcd894b-11c7-45a3-8465-f453c248c3bb' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Contador de tradições' and descricao is not distinct from 'Conte uma tradição da Igreja pra a turma.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Organize a fila de entrada dos acólitos.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Maestro' where id='2d85b537-32a5-4a74-95c9-9c96e2940cfb' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Maestro' and descricao is not distinct from 'Organize a fila de entrada dos acólitos.';
update public.acolitos_missoes set descricao='Entre no desafio “Olho clínico” e descubra algo para contar à equipe.

1. Faça uma vistoria no altar antes da missa começar.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Olho clínico' where id='d69793f1-9e07-4e2a-87fa-db4d7dd8c2d6' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Olho clínico' and descricao is not distinct from 'Faça uma vistoria no altar antes da missa começar.';
update public.acolitos_missoes set descricao='Entre no desafio “Plano da missa” e descubra algo para contar à equipe.

1. Antecipe mentalmente os momentos que vão exigir mais atenção.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Plano da missa' where id='412ee467-f7b9-49f9-b854-31a1efd726da' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Plano da missa' and descricao is not distinct from 'Antecipe mentalmente os momentos que vão exigir mais atenção.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Garanta que cada acólito sabe a função dele antes de começar.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Capitão da equipe' where id='3207963a-e07f-4be4-b2e5-bd6b7c6bdc35' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Capitão da equipe' and descricao is not distinct from 'Garanta que cada acólito sabe a função dele antes de começar.';
update public.acolitos_missoes set descricao='Entre no desafio “Resgate” e descubra algo para contar à equipe.

1. Ajude discretamente um acólito que travou no meio da missa.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Resgate' where id='2324ee7a-4eef-4bf2-b0d8-c9bc71267fd6' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Resgate' and descricao is not distinct from 'Ajude discretamente um acólito que travou no meio da missa.';
update public.acolitos_missoes set descricao='Entre no desafio “Contador de histórias” e descubra algo para contar à equipe.

1. Conte a história de um santo pra a turma antes ou depois da missa.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Contador de histórias' where id='dd481cf8-9002-4e9f-80d9-00e476631a90' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Contador de histórias' and descricao is not distinct from 'Conte a história de um santo pra a turma antes ou depois da missa.';
update public.acolitos_missoes set descricao='O segredo não é travar: é encontrar uma postura confortável.

1. No ensaio, peça orientação para segurar corretamente o objeto da sua função. Treine só com material autorizado e peça uma dica à dupla.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual dica deixou o movimento mais firme e confortável?' , titulo='Firmeza com leveza' where id='61b34889-8a19-4b74-b9ff-5a7bd1b25895' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mãos de estátua' and descricao is not distinct from 'Fique com as mãos juntas perfeitas durante uma oração inteira.';
update public.acolitos_missoes set descricao='Atenção no caminho, cuidado no gesto.

1. Pratique a postura e o deslocamento ensinados para servir com a vela, com acompanhamento e sem desafios com a chama.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual cuidado você aprendeu a fazer melhor?' , titulo='Luz no caminho' where id='a1293b86-0229-43e5-8464-127dbec122d7' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Vela firme' and descricao is not distinct from 'Carregue a vela sem deixar pingar cera.';
update public.acolitos_missoes set descricao='Mais do que acertar o movimento: entender o motivo.

1. Peça à formação uma orientação sobre a reverência no contexto da sua função. Treine com calma e explique o sentido do gesto.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que você ajustou e por que fazemos esse gesto?' , titulo='Um gesto com sentido' where id='2c834b7c-b1c2-40c3-b62a-108071a959dd' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Reverência perfeita' and descricao is not distinct from 'Faça a reverência mais bonita da sua vida diante do altar.';
update public.acolitos_missoes set descricao='Um livro bem posicionado ajuda outra pessoa a servir melhor.

1. Durante o ensaio, pratique com material autorizado a posição do livro da sua função. Peça para quem orienta conferir altura e firmeza.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Que ajuste deixou a leitura mais fácil?' , titulo='Missão: página certa' where id='84412ead-bc03-4b59-87e2-d59419459df0' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Equilíbrio do livro' and descricao is not distinct from 'Leve o missal sem deixar tremer.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Explique uma parte da missa pra um acólito como se fosse uma aula.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Professor por um dia' where id='b817ac80-8ff0-4a1f-9cd4-99f548531a71' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Professor por um dia' and descricao is not distinct from 'Explique uma parte da missa pra um acólito como se fosse uma aula.';
update public.acolitos_missoes set descricao='Entre no desafio “Cronista mor” e descubra algo para contar à equipe.

1. Avalie a celebração e dê uma sugestão construtiva à coordenação.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Cronista mor' where id='2c2499b5-bac3-4d43-ada8-1a564c52d2d8' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Cronista mor' and descricao is not distinct from 'Avalie a celebração e dê uma sugestão construtiva à coordenação.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Estudante dos ritos”. Sua missão é descobrir e contar do seu jeito.

1. Leia sobre uma parte da missa que você ainda não dominava.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Estudante dos ritos' where id='4f7602da-edd1-4c35-9967-c45e46a4a3dd' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Estudante dos ritos' and descricao is not distinct from 'Leia sobre uma parte da missa que você ainda não dominava.';
update public.acolitos_missoes set descricao='Entre no desafio “Mestre da postura” e descubra algo para contar à equipe.

1. Sirva uma missa inteira sendo exemplo de compostura.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Mestre da postura' where id='3aa618ca-fa7e-4772-9102-74ebb9a46b87' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre da postura' and descricao is not distinct from 'Sirva uma missa inteira sendo exemplo de compostura.';
update public.acolitos_missoes set descricao='Entre no desafio “Memória viva” e descubra algo para contar à equipe.

1. Conte pra um novato como era a pastoral quando você começou.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Memória viva' where id='edc03896-1b85-41a4-96de-8a1dd0c5c80c' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Memória viva' and descricao is not distinct from 'Conte pra um novato como era a pastoral quando você começou.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Motive um acólito que estava desanimado.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Inspirador' where id='157725a3-9102-4eaa-9a0c-b18fe4851d67' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Inspirador' and descricao is not distinct from 'Motive um acólito que estava desanimado.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Combine um detalhe da celebração com a equipe de música.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Embaixador da música' where id='ed9be742-8212-4d3d-b62d-ee693b07280b' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Embaixador da música' and descricao is not distinct from 'Combine um detalhe da celebração com a equipe de música.';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Cumprimente alguém da pastoral com quem você nunca tinha falado.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Boas-vindas' where id='73c25867-3aa7-4676-8a8e-581595bd7716' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Boas-vindas' and descricao is not distinct from 'Cumprimente alguém da pastoral com quem você nunca tinha falado.';
update public.acolitos_missoes set descricao='Missão discreta: perceber, combinar e ajudar.

1. Observe uma pequena ajuda que a equipe precisa antes ou depois da missa. Combine com quem orienta e faça apenas o que você já pode fazer.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual ajuda você percebeu antes de pedirem?' , titulo='Ninja da atenção' where id='0c475497-c2f2-438a-8a39-3814a6166af1' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Modo ninja' and descricao is not distinct from 'Atravesse a sacristia sem fazer barulho nenhum.';
update public.acolitos_missoes set descricao='Entre no desafio “Detetive da sacristia” e descubra algo para contar à equipe.

1. Descubra qual é o objeto mais antigo da sacristia.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Detetive da sacristia' where id='546e1b48-b45d-4f11-85ab-4bd81db6992d' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Detetive da sacristia' and descricao is not distinct from 'Descubra qual é o objeto mais antigo da sacristia.';
update public.acolitos_missoes set descricao='Será que sua noção de tempo bate com a da dupla?

1. Fora da celebração, estime com um colega um intervalo curto e confiram num relógio. Depois conversem sobre por que atenção ao tempo ajuda a equipe.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Quem chegou mais perto e onde esse cuidado ajuda a servir?' , titulo='Deu tempo?' where id='0e39fdab-bdd4-45b6-b156-00ba0c90e155' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Relógio quebrado' and descricao is not distinct from 'Adivinhe quanto tempo durou a missa sem olhar nenhum relógio.';
update public.acolitos_missoes set descricao='Se esse vitral pudesse contar uma história, qual seria?

1. Observe um vitral de um lugar permitido. Escolha uma cor ou figura e descubra com a formação o que representa.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Qual detalhe escolheu e que história descobriu?' , titulo='Uma história em cores' where id='8a495360-2f57-4309-a5f8-4c51f582c2fa' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Caça ao vitral' and descricao is not distinct from 'Conte quantos vitrais a igreja tem e fale pra coordenação.';
update public.acolitos_missoes set descricao='Ficar atento também é um desafio de equipe.

1. Durante o treino, pratique a postura da sua função com uma dupla, sem competir em tempo nem prender a respiração. Peça um ajuste e tente de novo.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Que ajuste sua dupla sugeriu e como ficou a segunda tentativa?' , titulo='Pause no corpo, play na atenção' where id='66484919-9c69-4cda-ab81-418070802018' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Estátua humana' and descricao is not distinct from 'Fique parado igual estátua durante a homilia inteira.';
update public.acolitos_missoes set descricao='Um jogo de pistas, sem precisar de fantasia.

1. Escolha um santo conhecido e prepare três pistas sobre sua história. Fora da celebração, convide uma dupla para adivinhar.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. Que pista fez a dupla descobrir?' , titulo='Quem é esse santo?' where id='83a03741-ac8d-4407-a670-2b0a72b161bf' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Sósia do santo' and descricao is not distinct from 'Descubra um santo que tem o seu nome ou a sua cara.';
update public.acolitos_missoes set descricao='Um desafio para viver por dentro. Faça no seu tempo.

1. Não dê risada nenhuma vez durante a missa inteira.
2. Viva esse momento com calma. Você escolhe o que deseja compartilhar.
3. Que parte da experiência você gostaria de guardar? Não precisa expor intenções pessoais.' , titulo='Rei da concentração' where id='eb7c267b-3f32-4757-ace1-f0e23bf4ee5a' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Rei da concentração' and descricao is not distinct from 'Não dê risada nenhuma vez durante a missa inteira.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Mestre do latim”. Sua missão é descobrir e contar do seu jeito.

1. Descubra o que significa "Dominus vobiscum".
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Mestre do latim' where id='8b36163c-537c-4f78-8f53-9ed5c34663bf' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Mestre do latim' and descricao is not distinct from 'Descubra o que significa "Dominus vobiscum".';
update public.acolitos_missoes set descricao='Esse desafio acontece com gente de verdade. Convide uma dupla e combinem o plano.

1. Explique a igreja como se fosse um guia turístico pra um colega novo.
2. Combine com a pessoa e com quem orienta a equipe; respeite o tempo e a vontade de participar.
3. O que vocês combinaram, como foi a experiência e qual dica levariam para a próxima?' , titulo='Guia turístico' where id='539450e0-5d19-43c7-a9e4-937f084b4421' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Guia turístico' and descricao is not distinct from 'Explique a igreja como se fosse um guia turístico pra um colega novo.';
update public.acolitos_missoes set descricao='Entre no desafio “Quantos altares?” e descubra algo para contar à equipe.

1. Descubra quantos altares tem a igreja.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Quantos altares?' where id='9f6fffa0-9301-44ef-9995-7a8f895b3e8b' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Quantos altares?' and descricao is not distinct from 'Descubra quantos altares tem a igreja.';
update public.acolitos_missoes set descricao='Entre no desafio “Caça ao crucifixo” e descubra algo para contar à equipe.

1. Conte quantos crucifixos você encontra na igreja.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Caça ao crucifixo' where id='b45e9270-47e1-4f48-bfbd-1fa25b833381' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Caça ao crucifixo' and descricao is not distinct from 'Conte quantos crucifixos você encontra na igreja.';
update public.acolitos_missoes set descricao='Entre no desafio “Nome do padre” e descubra algo para contar à equipe.

1. Saiba o nome completo do padre da sua missa.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Nome do padre' where id='d4a22f8e-c629-41bd-ae1f-f2bb1dd40fd8' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Nome do padre' and descricao is not distinct from 'Saiba o nome completo do padre da sua missa.';
update public.acolitos_missoes set descricao='Entre no desafio “Cor do dia” e descubra algo para contar à equipe.

1. Descubra a cor da vestimenta do padre hoje e o que ela significa.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Cor do dia' where id='67e67892-7482-44e3-a7c2-5e4153b67dcd' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Cor do dia' and descricao is not distinct from 'Descubra a cor da vestimenta do padre hoje e o que ela significa.';
update public.acolitos_missoes set descricao='Entre no desafio “Quantos bancos?” e descubra algo para contar à equipe.

1. Estime quantas pessoas cabem sentadas na igreja.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Quantos bancos?' where id='0159057e-5b1e-4c70-8a71-33bf7ed72ea3' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Quantos bancos?' and descricao is not distinct from 'Estime quantas pessoas cabem sentadas na igreja.';
update public.acolitos_missoes set descricao='Caminhar com atenção é diferente de caminhar devagar demais.

1. No ensaio, pratique o trajeto permitido da sua função com postura tranquila. Peça uma dica a quem acompanha e refaça.
2. Se envolver outra pessoa, combine antes. Vale pedir ajuda e tentar de novo.
3. O que mudou entre a primeira e a segunda tentativa?' , titulo='Passo tranquilo' where id='a60b3264-e334-4610-bec6-678bcdae9c65' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Andar de monge' and descricao is not distinct from 'Atravesse a igreja andando bem devagarinho e em silêncio.';
update public.acolitos_missoes set descricao='Entre no desafio “Via-Sacra” e descubra algo para contar à equipe.

1. Participe de uma Via-Sacra na Quaresma.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Via-Sacra' where id='a45c8a7d-b787-4a90-838d-f9e81c6f4e2b' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Via-Sacra' and descricao is not distinct from 'Participe de uma Via-Sacra na Quaresma.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Coroa do Advento”. Sua missão é descobrir e contar do seu jeito.

1. Descubra o que significam as velas da Coroa do Advento.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Coroa do Advento' where id='c049725f-5075-42e4-a7c7-959a96a01877' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Coroa do Advento' and descricao is not distinct from 'Descubra o que significam as velas da Coroa do Advento.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “O primeiro presépio”. Sua missão é descobrir e contar do seu jeito.

1. Descubra quem montou o primeiro presépio da história.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='O primeiro presépio' where id='a51d9625-f60e-4a8d-90e0-d78f54f4e344' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='O primeiro presépio' and descricao is not distinct from 'Descubra quem montou o primeiro presépio da história.';
update public.acolitos_missoes set descricao='Entre no desafio “Missa do Galo” e descubra algo para contar à equipe.

1. Sirva ou participe da Missa do Galo no Natal.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Missa do Galo' where id='1e8ee9de-5af3-4f51-bd1a-333ac9e95b95' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Missa do Galo' and descricao is not distinct from 'Sirva ou participe da Missa do Galo no Natal.';
update public.acolitos_missoes set descricao='Entre no desafio “Vermelho de fogo” e descubra algo para contar à equipe.

1. Descubra por que Pentecostes usa a cor vermelha.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Vermelho de fogo' where id='bcfbe141-6e88-45df-935b-ab997552f599' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Vermelho de fogo' and descricao is not distinct from 'Descubra por que Pentecostes usa a cor vermelha.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Roxo da Quaresma”. Sua missão é descobrir e contar do seu jeito.

1. Descubra por que a Quaresma usa a cor roxa.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Roxo da Quaresma' where id='0e3f29b5-9d69-4f7b-876c-494393b3221a' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Roxo da Quaresma' and descricao is not distinct from 'Descubra por que a Quaresma usa a cor roxa.';
update public.acolitos_missoes set descricao='Entre no desafio “Os 40 dias” e descubra algo para contar à equipe.

1. Descubra o que representam os 40 dias da Quaresma.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Os 40 dias' where id='c42ba731-6866-482a-8561-272e13f49e93' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Os 40 dias' and descricao is not distinct from 'Descubra o que representam os 40 dias da Quaresma.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Aleluia!”. Sua missão é descobrir e contar do seu jeito.

1. Descubra por que a Páscoa é a maior festa do ano litúrgico.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Aleluia!' where id='ce2aab9e-02cc-40cf-9d9e-f9297bd92612' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Aleluia!' and descricao is not distinct from 'Descubra por que a Páscoa é a maior festa do ano litúrgico.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Círio pascal”. Sua missão é descobrir e contar do seu jeito.

1. Descubra o que é o Círio Pascal e o que ele representa.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Círio pascal' where id='92017abd-3e50-4d18-a49a-534ca26a4aaf' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Círio pascal' and descricao is not distinct from 'Descubra o que é o Círio Pascal e o que ele representa.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Quem foi São Tarcísio”. Sua missão é descobrir e contar do seu jeito.

1. Descubra a história de São Tarcísio, padroeiro dos coroinhas.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Quem foi São Tarcísio' where id='53df657d-7445-4341-b856-191a1a2b8044' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Quem foi São Tarcísio' and descricao is not distinct from 'Descubra a história de São Tarcísio, padroeiro dos coroinhas.';
update public.acolitos_missoes set descricao='Tem uma história escondida em “Coragem de Tarcísio”. Sua missão é descobrir e contar do seu jeito.

1. Descubra o que São Tarcísio protegeu com a própria vida.
2. Confira sua descoberta com quem acompanha a formação e pense num exemplo para explicar.
3. Qual foi a descoberta mais curiosa? Como explicaria para alguém que nunca ouviu falar disso?' , titulo='Coragem de Tarcísio' where id='997d2410-b4aa-41af-bb17-4d44664edaf3' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Coragem de Tarcísio' and descricao is not distinct from 'Descubra o que São Tarcísio protegeu com a própria vida.';
update public.acolitos_missoes set descricao='Entre no desafio “Festa do padroeiro” e descubra algo para contar à equipe.

1. Participe da festa do padroeiro da paróquia.
2. Experimente em um momento permitido, sem interromper a celebração. Se precisar, combine com a equipe.
3. O que você fez, o que percebeu e qual parte mais te surpreendeu?' , titulo='Festa do padroeiro' where id='7c8273fa-aae3-47aa-939c-7c37b2183d80' and capitulo is null and nivel_alvo is null and tipo='bonus' and titulo='Festa do padroeiro' and descricao is not distinct from 'Participe da festa do padroeiro da paróquia.';
commit;
