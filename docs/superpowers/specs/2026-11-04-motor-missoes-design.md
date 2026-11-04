# Motor editorial e distribuição de missões

Aprovado conceitualmente pelo dono em 04/11/2026. Este documento consolida a conversa; valores marcados como escolha de implementação ainda são propostas técnicas para revisão do plano.

## Resultado esperado

Banco continuamente renovado com missões desejáveis, baseadas na paróquia real e na formação aprovada. A IA gera rascunhos; coordenação revisa e aprova; distribuição determinística oferece oportunidades equivalentes de XP a cada membro. Aproveitar a Jornada existente, preservando capítulos, aptidões, formação, evidências e XP histórico.

## Decisões aprovadas na conversa

- Reescrever hooks e títulos próprios, com mistério, desafio, descoberta e conexão local; instruções claras ao abrir. Não inventar fatos, prometer segredos inexistentes ou entregar respostas no card.
- Classificar o legado entre principal, reserva, sazonal, revisar e duplicata. Reserva não significa descarte. Meta editorial inicial: 24 práticas aprovadas em reserva; disponibilidade por nível e capacidade local precisam ser demonstradas antes de ativar a distribuição.
- Seis práticas por membro/semana: três simples (10 XP cada), duas investigações (20 cada), uma interação (40). Dois desafios digitais imediatos adicionais, ajustados ao nível cadastrado. Todos os membros recebem oportunidades equivalentes de XP.
- Descobertas acessíveis a todos; desafios digitais crescem em decisões e responsabilidade conforme o nível, sem alongar texto ou confundir idade com experiência.
- Foto obrigatória nas práticas, com captura no app e revisão humana; cuidado com os objetos e devolução ao lugar. As 18 descobertas não exigem acompanhamento. Desafios digitais têm verificação no servidor e não exigem foto.
- Distribuição individual prioriza inéditas, evita repetição e concentração em objetos, ambientes e pastorais. Uma troca semanal por faixa equivalente. Duplas podem compartilhar uma missão sem duplicar a recompensa individual.
- Missão iniciada fica em Minhas missões. Depois de uma semana sem avanço, oferecer continuar, pista ou troca dentro do app. Duas semanas sem avanço tiram da lista corrente e devolvem à reserva, sem perda de XP. A coordenação acompanha participação sem ranking de cobrança.
- Sem mensagens a terceiros ou novas notificações automáticas nesta entrega. Meta de três práticas concluídas é orientação de participação, sem XP extra por meta.
- IA nunca concede XP, aptidão ou promoção. Geração por reposição de estoque, não por abertura de tela. Publicação inicial somente após revisão explícita da coordenação.

## Escolhas técnicas propostas

- Reusar provedor já integrado e as variáveis ANTHROPIC_API_KEY e JORNADA_ANTHROPIC_MODEL/ANTHROPIC_MODEL; não escolher nome de modelo novo por suposição. Configuração/saúde do motor deve informar ausência de credencial sem revelar segredos. Validar contrato em documentação oficial durante implementação.
- Dois desafios digitais de 10 XP cada, independentemente do nível: total semanal de oportunidade 130 XP (110 práticas + 20 digitais). Conteúdo legado de recompensa superior permanece histórico; só entra no novo programa após versão editorial com faixa compatível. Nenhuma redução retroativa de XP.
- Começar com múltipla escolha, associação e ordenação; respostas e explicações corretivas ficam privadas até a tentativa ser conferida. Sem geração em tempo real para o membro.
- Lotes de no máximo quatro propostas; até oito chamadas por dia para o módulo, incluindo geração e revisão, teto compartilhado por coordenação e rotina. Uma revisão por lote. Reservar quota e chave de idempotência atomicamente antes de chamar o provedor. Sem retries de IA automáticos. Registrar modelo, tokens, latência, versão de prompt e erro sanitizado; estimativa monetária só com preços configurados, nunca inventados.
- Reposição cron diária com no máximo um lote, ligada por flag apenas após validar fontes e configurações. Priorizar lacunas por formato/nível; contar também rascunhos válidos pendentes para não gerar indefinidamente enquanto ninguém revisa. Meta: quatro conjuntos de práticas (24) e quatro pares digitais (8) por nível; práticas universais podem contar para diferentes níveis, mas distribuição deve respeitar capacidade. Parar e mostrar insuficiência quando não houver combinação justa.
- Catálogo e revisões imutáveis, com fonte e versão rastreáveis; tabelas privadas para fontes, lotes, versões e gabaritos. Payload do membro por allowlist, sem acesso direto ao conteúdo privado.
- Publicar significa aprovar uma versão para a reserva; disponibilizar semanalmente é outro ato. Edição de uma missão aprovada cria nova versão e exige nova revisão.
- Critérios de publicação: fonte ativa com referência específica, formato válido, nível válido, critério verificável, gabarito revisado, hook e instruções próprios, foto nas práticas e classificação de esforço. Vincular fonte não prova verdade do conteúdo: coordenador confere a correspondência factual. IA revisora pode apontar problemas; não substitui essa conferência.
- Importar os 209 registros confirmados do inventário, com IDs estáveis e proveniência. Não importar descartes ou leituras incompletas. Livro com título legível não autoriza inventar seu conteúdo. Formação vem de trechos e orientações aprovados no painel, sem fazer scraping ou declarar fontes externas revisadas por inferência.
- Distribuição semanal planejada em lote por nível, usando histórico completo paginado. Transação impede dois planejadores de exceder capacidade ou atribuir slots duplicados. Desempates estáveis; semanas já publicadas não são recalculadas ao abrir o app. Ao faltar fonte, missão ou capacidade, não publicar seleção incompleta/injusta silenciosamente.
- Preferir conteúdos não concluídos e não vistos nas quatro semanas anteriores. Mesmo objetivo/objeto/mecânica conta como repetição, não só título. Sem alternativas suficientes, mostrar lacuna à coordenação antes da ativação, sem reaproveitar missão concluída para novo XP.
- Capacidade por pastoral/objeto é explícita, aprovada pela coordenação. Total de vagas equivalentes deve cobrir os participantes antes de ativar a semana. Não adivinhar capacidade a partir de IA.
- Uma troca ocupa o mesmo slot/faixa; transação revoga anterior e reserva substituta. Missão com envio em análise ou concluída não é trocável. Unicidade por membro/semana/slot e concessão por objetivo editorial impede farming por troca, dupla, revisão ou reenviar.
- Início e envio conferem atribuição no servidor, não só visibilidade. Mudança de nível na semana preserva seleção e XP; nível novo afeta a próxima seleção. Novos membros recebem conjunto completo se houver capacidade; caso contrário, coordenação recebe lacuna e membro vê estado claro.
- Prática iniciada mantém janela de até 14 dias contados do início; expiração da seleção não invalida envio já em análise. XP aprovado depois permanece atribuído ao slot de origem. A semana seguinte pode coexistir sem duplicar o mesmo objetivo.
- A rotina existente de pushes deve filtrar atribuições quando o programa estiver ativo, preservando pausa e limites existentes. Esta entrega não dispara notificações ou convites.
- Flag global permite manter o fluxo antigo até reserva suficiente e prévia aprovada. Ativação em fronteira semanal de Brasília; não cortar as 21 missões atuais no meio da semana nem invalidar sessões já iniciadas. Desativar preserva atribuições, evidências, revisões e recompensas.

## Interface

No painel existente da Jornada: Banco de missões com fontes, estoque por nível/faixa, geração de lote, rascunhos, alertas, edição, prévia do card e da missão, revisão, aprovação para reserva e programação. Estados de carregamento, falha, vazio, falta de capacidade e conflito de edição distintos. No app: seis práticas e dois desafios em seleção individual, filtro Minhas missões, próximo passo e troca equivalente. Nada de jargão do motor no fluxo do membro.

Desktop/TV usam toda largura lateral com margens fluidas; limitar largura apenas de texto longo/formulários. Celular sem overflow, modais fullscreen, alvos >=44px, campos >=16px, zoom bloqueado conforme regra do dono. Fotografar 390, 768, 1440 e 2560 px antes de concluir.

## Fontes de implementação verificadas

- api/_jornada.js: autenticação e permissão real de Jornada, autoria por nível e rascunhos; não reutilizar cegamente seu prompt antigo que proíbe fotos, pois pertence a outro formato.
- api/_bonus-rotina.js: calendário Brasília, seleção global de três modelos, cron e pushes existentes.
- api/_bonus.js, api/_bonus-banco.js, api/_paroquia-banco.js: catálogo, iniciar desafios e serialização pública.
- projetos/acolitos/jornada-admin.html, jornada-autoria.js, jornada-programacao.js: painel existente.
- projetos/acolitos/bonus-semana.js e missoes.html: experiência e evidência atuais.
- docs/missoes-paroquia/catalogo-detalhado.json, propostas.json e CHECKPOINT.md: inventário e decisões confirmadas.
- projetos/acolitos/jornada-core.js: dez níveis oficiais; usar nível atual, sem confundir nivel_alvo com nível do membro.

## Aceite

IA salva apenas rascunho; aprovação não consegue burlar validações nem versão. Membro e equipe sem permissão não acessam geração, fontes privadas, gabaritos ou atribuições alheias. Seleções individuais têm mesmos slots/XP, respeitam capacidade, persistem e sobrevivem a concorrência/retries. Foto tem ownership e vínculo à missão. Jogos não vazam respostas nem pagam duas vezes. Falhas do provedor ou banco não publicam conteúdo parcial. Banco histórico permanece íntegro; prova autenticada das funções/RLS e capturas responsivas antes da publicação.
