# Checkpoint — missões da paróquia — 03/11/2026

## Decisões do dono

O inventário aprovado tem 209 registros após o descarte de leituras incompletas. As 18 propostas são um primeiro lote: o dono considerou pouco e quer retomar para destrinchar muitas outras missões. Não tratar este lote como catálogo completo.

Em 03/11, autorizou implementar as 18, atualizar a semana atual e melhorar as capas dos cards com imagens, substituindo as ilustrações feitas por código.

## Fontes preservadas

- Quatro originais em Downloads: IMG_3135.MOV (igreja), IMG_3136.MOV (sacristia), IMG_3137.MOV (biblioteca), IMG_3138.MOV (sala).
- Inventário navegável, 438 quadros e folhas de contato: /Users/erickmartins/Downloads/decupagem-missoes/.
- Catálogo de 209 registros, texto, 18 propostas e cruzamento das 110 aventuras copiados para esta pasta. Os caminhos de imagens nos arquivos apontam para a pasta de decupagem em Downloads; não são assets públicos.

## Confirmações locais do dono

São Tarcísio no quadro atrás de Aparecida na sala; tochas de procissão; São Rafael no anjo da mesa da biblioteca; Dom Bosco no retrato; São Cristóvão e São Camilo de Lellis (santo da Pastoral da Saúde) no conjunto de imagens. Descartar o retrato identificado provisoriamente como Francisco de Sales. Leituras incompletas descartadas. Nos vitrais: Rafael (04:49) e Miguel (05:02); não Santo Expedito.

## Retomada da ampliação

Destrinchar o inventário por vitrais, personagens, atributos, símbolos, livros, imagens e objetos; criar descobertas e percursos encadeados. Quantidade deve representar descobertas diferentes, sem inflar com mera troca de redação. Não usar fotos de evidência nem gabaritos como capas que revelem a resposta. Sem caça no sacrário/presbitério. Sem acompanhamento obrigatório; manusear com cuidado e devolver ao lugar. Exigir foto, mantendo respostas curtas de nome/número. Identificações descartadas não voltam por inferência.

## Estado no início da implementação

Catálogo local: 110 aventuras; semana real 02–08/11/2026: Aperto no altar, Dois olhares/uma descoberta e Dupla repórter. Preservar IDs, progresso e envios existentes. As 18 propostas estavam apenas no documento, sem publicação. Registrar abaixo o resultado da implementação, testes, migração e deploy antes de concluir.

## Implementação desta rodada

- Novo tipo `descoberta`: resposta de um caractere ou mais, foto obrigatória, pista aberta sob demanda, revisão humana e 10 ou 20 XP por descoberta aprovada. Jogos existentes continuam decididos no servidor; fotos antigas seguem obrigatórias.
- As 18 foram acrescentadas à semana de 02 a 08/11 junto com as três já publicadas (21 no total), sem substituir IDs nem progresso. Registro idempotente em semana-2026-11-02.json e na migração desta rodada. Nas semanas seguintes, as descobertas entram no sorteio do slot de foto/descoberta, junto a um jogo e uma missão de grupo.
- Gabaritos ficam no banco editorial privado do servidor e são consultados pela fila de aprovação via a API já protegida da coordenação. Materiais desta pasta ficam fora do deploy público.
- Ajuste editorial D13: a pergunta foi reescrita para não revelar Rafael antes da descoberta. Não confundir o anjo confirmado com a identificação descartada.
- 14 novas ilustrações raster geradas com image_gen, exportadas em WebP, substituem os SVGs no consumo dos cards. Coleção temática; não são fotos documentais da igreja nem evidências de respostas. Originais e instruções ficam no manifesto e no registro de prompts.
- Revisão independente encontrou o nome antecipado em D13 e a consulta de gabaritos com limite aplicado antes de deduplicar missões. Ambos corrigidos.

## Verificações antes da publicação

- 27 testes de API passaram, incluindo privacidade de gabaritos e bloqueio de consulta por membro comum.
- Prova SQL dentro de transação revertida: 18 inícios, VII e 2 sem foto, estado em análise com XP zero, rejeição de resposta vazia/identidade alheia e de XP automático em descoberta, requisitos de fotos antigas preservados.
- Prova da tela real com sessão simulada: 21 cards, capas carregadas, modais, envio curto e gabarito da coordenação; fotos em 390, 768, 1440 e 2560 px.
- Suíte geral final: 650 passaram de 653; encontrou três falhas já existentes no arquivo xp-servico-notificacoes.test.js: ambiente VM sem navigator. shared.js e esse teste não foram alterados por esta rodada. A falha nova no carregador manual do teste de rotina foi corrigida para usar o carregador recursivo já existente.
- CLI Supabase instalado sofre SIGKILL ao iniciar. Migração foi preparada e validada por psql com as mesmas credenciais de projeto; nenhuma credencial foi copiada para o repositório.

## Publicação

Concluída em 03/11/2026 (Brasília; migração com timestamp UTC de 04/11).

- Commit de implementação: f48a9cb — enviado para main.
- Deploy produção: https://iajcbp-5j5vzv1k8-erickjcbp-1650s-projects.vercel.app (READY).
- App: https://coroinhas.jcbplimeira.com.br/projetos/acolitos/missoes.html#aventuras
- Migração aplicada e registrada: 20261104001120_missoes_paroquia_descobertas.
- Conferência real: 18 novas ativas + 3 anteriores = 21 na semana 02–08/11. Cinco registros da semana (três ativos e dois históricos inativos) permaneceram idênticos; quatro registros prévios de progresso preservados.
- 19 arquivos (cinco arquivos de interface e 14 capas) comparados por SHA-256 no domínio real. Materiais privados e migração respondem 404; consulta anônima à API de gabaritos responde 401.
- Nenhuma notificação foi enviada manualmente. A programação existente de convites não foi alterada.
- Capas finais em projetos/acolitos/quests-capas; prompts e originais referenciados em capas-prompts.md e capas-manifesto.json. Algumas missões compartilham famílias visuais; os oito primeiros cards têm capas distintas.
- Fotos finais da tela real com sessão simulada em historico-tarcisio/paroquia-descobertas-2026-11-03 (390, 768, 1440 e 2560 px, cards e modais).
- A ampliação além das 18 segue pendente por escolha do dono: usar os 209 registros aprovados para destrinchar novas missões e percursos. As 18 não encerram o trabalho editorial.

## Atualização — fotos, esforço e autonomia (04/11/2026)

Decisão do dono: nenhuma das 18 exige acompanhamento. Apenas cuidado com os objetos e devolução ao lugar. Foto obrigatória nas descobertas e atividades práticas, com botão Tirar foto no app. Descoberta simples: 10 XP; dois pontos: 20 XP; conversa/pastoral/interação: pelo menos 40 XP. Progresso e XP já conquistado preservados. Jogos digitais mantêm seu fluxo. Esta decisão substitui as regras anteriores de foto opcional e visita guiada.

Validação: 29 testes API passaram; prova SQL em transação revertida confirmou foto obrigatória, propriedade da evidência, bloqueio de bypass e ausência de XP antes da aprovação; prova de telas em 390, 768, 1440 e 2560 px, envio com foto, habilitação e aventuras anteriores passou.

Publicação desta atualização: commit `4154770`, produção READY em https://iajcbp-dcd1gsyxj-erickjcbp-1650s-projects.vercel.app e domínio coroinhas.jcbplimeira.com.br. Migração `20261104025758_missoes_foto_esforco_sem_acompanhamento.sql` aplicada e registrada via psql (CLI Supabase indisponível). Verificação pública: 20 arquivos com hashes corretos; documentos e migração retornam 404; gabarito anônimo retorna 401. Banco: 21 semanais, 18 descobertas com foto obrigatória, 110 aventuras práticas com foto obrigatória, nenhum grupo ativo abaixo de 40 XP, 818 registros de progresso antes e depois.

## Motor editorial publicado — 04/11/2026

Plano aprovado e implementado. Commits de produto até `13da9d9`; produção READY em https://iajcbp-4af8h16an-erickjcbp-1650s-projects.vercel.app, domínio coroinhas.jcbplimeira.com.br. Migrações 20261104120000/120100/120200 aplicadas e registradas em transação única.

Entrada: Jornada → Preparar conteúdo → Banco de missões (`jornada-admin.html?aba=conteudo`). Há 233 registros de fontes/referências: 209 do inventário, 18 referências das propostas confirmadas e seis dos jogos de formação já aprovados. Foram importadas 18 chamadas reescritas como rascunho. Um teste real pela rotina assinada da Vercel gerou quatro investigações e fez sua revisão com `claude-haiku-5-5`: total 22 rascunhos, zero versões aprovadas. Geração: 9,76 s / 2487 tokens de saída; revisão: 5,741 s / 1103 tokens. A primeira tentativa inválida foi mantida como falha; limites do prompt e diagnóstico sanitizado foram corrigidos, e a nova tentativa passou. Não foram publicados textos de IA automaticamente.

**Flags reais:** geração automática ligada, diariamente às 08h de Brasília; distribuição individual ainda sem data de ativação. Exige revisão humana das versões e confirmação de capacidades. A semana corrente continua com as 21 missões existentes. Quando ativada, a distribuição oferece seis práticas + dois desafios por nível, 130 XP possíveis, uma troca equivalente e histórico por membro. Sessões legadas válidas e envios em análise são preservados na transição. Nenhum push ou mensagem de teste foi enviado.

**Provas:** 51 testes focados passaram; suíte final em main: 675/678, com as mesmas três falhas pré-existentes de `navigator` no teste de notificações. SQL autenticado em transação revertida publicou 1392 atribuições fictícias (174 perfis x oito), exigiu foto própria/vinculada, verificou desafio, aprovação tardia, troca no mesmo local lotado e equivalência de XP nas duas ordens (legado/motor). Duas conexões reais disputaram a mesma reserva: uma ganhou e a outra foi rejeitada idempotentemente; dados da prova de quota foram limpos. Telas do painel e membro em 390/768/1440/2560, regressão das 21 descobertas/capas e fluxo de instalação passaram. Sete arquivos públicos conferidos por hash; fontes/migrações/provas privadas retornam 404 e ação anônima do motor retorna 401.

**Histórico preservado:** antes/depois: 818 progressos e 15340 XP de missões; não foi alterado saldo já adquirido. Código de instalação publicado em paralelo foi integrado sem perder alterações. Arquivos sujos do robô, gitignore e materiais locais ficaram fora dos commits/deploy.

Operação, limites e pequenas melhorias pendentes: `motor-operacao.md`. Decisões e evidências de execução: `motor-execucao.md`. Próximo passo editorial: revisar as 22 propostas, completar diversidade/níveis da reserva e confirmar capacidade antes de programar uma segunda-feira. Não confundir rascunhos criados com missões já disponibilizadas ao membro.

## Decisões rápidas das propostas — 04/11/2026

Pedido do dono: simplificar revisão/aprovação com Aceitar, Recusar e Revisar. Publicado em `c62f056`, produção READY https://iajcbp-m562r7p5c-erickjcbp-1650s-projects.vercel.app. Banco de missões começa pela fila, com filtros Propostas/Aceitas/Recusadas e ferramentas de geração/programação recolhidas. Os três botões ficam no próprio card, visíveis no primeiro card em 390px; mostra XP, tempo, nível, foto, resposta esperada, alertas e detalhes/fontes.

Aceitar é a decisão humana explícita e coloca na reserva, sem programar uma semana. Recusar arquiva sem apagar e verifica revisão concorrente antes de confirmar sucesso. Revisar abre o rascunho; se já aceito ou recusado, cria cópia para preservar a versão anterior. Edição tem Salvar alterações e Cancelar edição, sem misturar edição e aceite. Durante gravação os controles ficam bloqueados para evitar decisões duplicadas ou perda de ajustes. Campos técnicos de objetivo/mecânica foram retirados da edição comum; valores internos permanecem preservados.

Validação: 53 testes focados passaram; suíte 677/680 com as mesmas três falhas anteriores de navigator no teste de notificações. Prova de aceitar/recusar/revisar/filtros/cópia em 390/768/1440/2560 e regressão do motor passaram. Revisão independente sem achados bloqueantes. Sete arquivos públicos com hash conferido, fontes e prova nova privadas (404), acesso anônimo do motor negado (401). Sem migração nova. Banco antes/depois idêntico: 22 propostas, zero aceitas, zero recusadas, distribuição individual sem data. Não foram tomadas decisões reais em nome do dono.
