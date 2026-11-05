<!-- mapa-funcional-local -->
# Coroinhas, Tarcísio e pastoral — mapa dos arquivos

App Coroinhas, automação Tarcísio, fontes de artes e entregas da pastoral. Cada assunto abaixo tem um caminho próprio.

Mapa local conferido em 03/11/2026. [Voltar ao mapa geral](../MAPA-DAS-PASTAS.md). O estado de aprovação ou publicação só é indicado quando há referência explícita; datas de arquivo não provam aprovação.

## Começar por aqui

- [CLAUDE.md](CLAUDE.md)
- [docs/estrutura-e-comandos.md](docs/estrutura-e-comandos.md)
- [docs/RETOMADA-TARCISIO-CRM.md](docs/RETOMADA-TARCISIO-CRM.md)

## Entregas e entradas por assunto

| Assunto | Abrir | Situação / uso | Identificação |
| --- | --- | --- | --- |
| Coroinhas: entrada do aplicativo | [projetos/acolitos/index.html](projetos/acolitos/index.html) | Fonte local ativa; publicação anterior verificada nesta conversa | Código do projeto |
| Davi — Guardião do Rebanho | [projetos/acolitos/davi.html](projetos/acolitos/davi.html) | Fonte do jogo | Código do projeto |
| Tíquico — Mensageiro | [projetos/acolitos/games.html](projetos/acolitos/games.html) | Fonte do jogo | Código do projeto |
| Mural de novidades | [projetos/acolitos/novidades.js](projetos/acolitos/novidades.js) | Edição Davi publicada nesta conversa | materiais-paroquia/provas/novidades/publicacao.json |
| Vídeo de apresentação do app (v11, com minijogos, 04/11/2026) | [midia/video-onboarding-app/v3-minijogos/sua-jornada-v11.mp4](midia/video-onboarding-app/v3-minijogos/sua-jornada-v11.mp4) | Cena nova "Minijogos" (Tíquico e Davi) gravada do app com dados de mentira; aprovada pelo dono em 04/11/2026 | Versão anterior abaixo |
| Vídeo de apresentação do app (v10) | [midia/video-onboarding-app/v2-brilho/sua-jornada-v10.mp4](midia/video-onboarding-app/v2-brilho/sua-jornada-v10.mp4) | Exportação local preservada; aprovação não revalidada nesta rodada | Arquivo preservado na organização anterior |
| Somos do Altar: marca e estandartes | [materiais-paroquia/somos-do-altar/entregas/](materiais-paroquia/somos-do-altar/entregas/) | Entregas agrupadas por assunto | materiais-paroquia/somos-do-altar/LEIA-PRIMEIRO.md |
| Somos do Altar: brandbook | [materiais-paroquia/somos-do-altar/entregas/03-Brandbook/Brandbook-Somos-do-Altar.pdf](materiais-paroquia/somos-do-altar/entregas/03-Brandbook/Brandbook-Somos-do-Altar.pdf) | PDF local atual | Estrutura de entrega vigente |
| Jogos Anuais: documento consolidado | [materiais-paroquia/somos-do-altar/entregas/07-Jogos-Anuais/Jogos-Anuais.pdf](materiais-paroquia/somos-do-altar/entregas/07-Jogos-Anuais/Jogos-Anuais.pdf) | PDF atual da pasta de entrega | materiais-paroquia/somos-do-altar/AGENTS.md |
| Vídeo das casas | [materiais-paroquia/somos-do-altar/entregas/06-Video-Casas/Casas-e-Jogos-Anuais.mp4](materiais-paroquia/somos-do-altar/entregas/06-Video-Casas/Casas-e-Jogos-Anuais.mp4) | Montagem atual em revisão audiovisual; não inferir aprovação | materiais-paroquia/somos-do-altar/entregas/06-Video-Casas/LEIA-PRIMEIRO.md |
| Encontros: planilha | [materiais-paroquia/encontros-nov-2026/planilhas/Coroinhas_Base_Encontros_28-10-2026_v1.xlsx](materiais-paroquia/encontros-nov-2026/planilhas/Coroinhas_Base_Encontros_28-10-2026_v1.xlsx) | Arquivo recebido preservado por hash; dados ainda sujeitos ao checkpoint | docs/encontros-nov-2026/CHECKPOINT.md |
| Encontros: relatório original | [materiais-paroquia/encontros-nov-2026/originais/relatorio-membros-2026-10-28/](materiais-paroquia/encontros-nov-2026/originais/relatorio-membros-2026-10-28/) | Seis scans originais identificados; dados pessoais | docs/encontros-nov-2026/CHECKPOINT.md |
| Encontros: artes | [materiais-paroquia/encontros-nov-2026/artes/](materiais-paroquia/encontros-nov-2026/artes/) | Quatro artes locais; organização não agenda nem envia | docs/encontros-nov-2026/CHECKPOINT.md |
| Artes sacras por tema | [materiais-paroquia/artes-sacras/](materiais-paroquia/artes-sacras/) | Biblioteca recebida; variantes temáticas preservadas | Origem registrada em organizacao-local/organizacao-por-assunto.json |
| Publicação atual | [publicacoes/app-atual/](publicacoes/app-atual/) | Pacote local de publicação; atualizar a mesma pasta | Rodada de publicação do mural |
| Tarcísio: retomada | [docs/RETOMADA-TARCISIO-CRM.md](docs/RETOMADA-TARCISIO-CRM.md) | Checkpoint de operação; ler antes de ações externas | Documento do projeto |

## Função das subpastas

| Pasta | Assunto e função | Natureza | Arquivos no escopo |
| --- | --- | --- | --- |
| [.claude](.claude/) | Coroinhas, Tarcísio e pastoral — Agentes, regras, hooks e configurações existentes do projeto; preservados. | Configuração Claude | 1 |
| [.github](.github/) | Coroinhas, Tarcísio e pastoral — Configuração de integração contínua e modelos de colaboração do repositório. | Configuração GitHub | 1 |
| [.github/workflows](.github/workflows/) | Coroinhas, Tarcísio e pastoral — Definições de execução automatizada no GitHub. | Automação de CI | 1 |
| [.superpowers](.superpowers/) | Coroinhas, Tarcísio e pastoral — Planejamento e estado técnico do fluxo de desenvolvimento por agentes; não é entrega. | Estado de ferramenta | 64 |
| [.superpowers/sdd](.superpowers/sdd/) | Coroinhas, Tarcísio e pastoral — Planejamento e estado técnico do fluxo de desenvolvimento por agentes; não é entrega. | Estado de ferramenta | 64 |
| [.vercel](.vercel/) | Coroinhas, Tarcísio e pastoral — Vínculo do projeto e arquivos técnicos do CLI de publicação. | Configuração de publicação | 2 |
| [api](api/) | API do Coroinhas — Endpoints e regras de servidor do cadastro, jornada, jogos e administração. | Código de servidor | 25 |
| [arte-escala](arte-escala/) | Artes das escalas — Geradores, modelos e fontes tipográficas das artes de escala. | Fonte de produção | 29 |
| [arte-escala/assets](arte-escala/assets/) | Artes das escalas — Imagens, fontes ou outros recursos usados pela fonte ou pacote do assunto. | Recurso de produção | 8 |
| [coletor](coletor/) | Coletor da pastoral — Pasta de coleta e seus registros; sem arquivos de conteúdo no inventário atual. | Coleta / registro | 0 |
| [coletor/logs](coletor/logs/) | Coletor da pastoral — Registros de execução e diagnóstico do assunto. | Registro técnico | 0 |
| [criar-logins](criar-logins/) | Guias e acessos da pastoral — Geradores de guias, folhas de acesso e fotos de interface para a equipe. | Fonte de produção | 39 |
| [criar-logins/fotos](criar-logins/fotos/) | Guias e acessos da pastoral — Geradores de guias, folhas de acesso e fotos de interface para a equipe. | Fonte de produção | 13 |
| [criar-logins/fotos-equipe](criar-logins/fotos-equipe/) | Guias e acessos da pastoral — Geradores de guias, folhas de acesso e fotos de interface para a equipe. | Fonte de produção | 19 |
| [db](db/) | Coroinhas, Tarcísio e pastoral — Fontes de esquema, migrações e provas de banco deste projeto. | Código / esquema | 17 |
| [db/provas](db/provas/) | Coroinhas, Tarcísio e pastoral — Scripts e/ou registros usados para verificar telas e regras; não equivalem a aceite do dono. | Evidência / ferramenta | 1 |
| [db/seguranca](db/seguranca/) | Coroinhas, Tarcísio e pastoral — Regras e provas de autorização e proteção dos dados. | Fonte / prova de segurança | 15 |
| [docs](docs/) | Coroinhas, Tarcísio e pastoral — Checkpoints, decisões, instruções e documentação técnica do projeto. | Documentação | 320 |
| [docs/anotacoes](docs/anotacoes/) | Coroinhas, Tarcísio e pastoral — Checkpoints, decisões, instruções e documentação técnica do projeto. | Documentação | 2 |
| [docs/checkpoint-2026-11-01](docs/checkpoint-2026-11-01/) | Coroinhas, Tarcísio e pastoral — Checkpoints, decisões, instruções e documentação técnica do projeto. | Documentação | 8 |
| [docs/encontros-nov-2026](docs/encontros-nov-2026/) | Encontros — fontes e cadastro — Transcrição, checkpoint e scripts; não agendar mensagens usando o mapa como autorização. | Fonte / checkpoint | 4 |
| [docs/finados-2026](docs/finados-2026/) | Finados 2026 — Artes, textos e scripts relativos ao evento de Finados. | Histórico de evento | 12 |
| [docs/migrations](docs/migrations/) | Coroinhas, Tarcísio e pastoral — Histórico ordenado do esquema; não eliminar como versão de entrega. | Histórico de esquema | 134 |
| [docs/provas](docs/provas/) | Coroinhas, Tarcísio e pastoral — Scripts e/ou registros usados para verificar telas e regras; não equivalem a aceite do dono. | Evidência / ferramenta | 30 |
| [docs/superpowers](docs/superpowers/) | Coroinhas, Tarcísio e pastoral — Checkpoints, decisões, instruções e documentação técnica do projeto. | Documentação | 88 |
| [docs/tempo-de-servico](docs/tempo-de-servico/) | Tempo de pastoral — Cruzamento e validação de dados usados nos marcos de serviço. | Estudo / dados restritos | 12 |
| [entregas](entregas/) | Entregas e documentos da pastoral — Guias, planilhas e documentos de acesso; alguns contêm dados pessoais e devem ficar restritos. | Entrega local / dados restritos | 15 |
| [entregas/arquivos-de-apoio](entregas/arquivos-de-apoio/) | Conciliação e apoio — Arquivos de comparação, carga e apoio às entregas da pastoral. | Apoio / histórico de dados | 5 |
| [entregas/materiais-originais](entregas/materiais-originais/) | Escala original — Original preservado da planilha; não é uma exportação antiga descartável. | Original | 1 |
| [estudos](estudos/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 644 |
| [estudos/cadastro-joao-marcos-2026-11-01](estudos/cadastro-joao-marcos-2026-11-01/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 19 |
| [estudos/destaques-cartao-2026-10-31](estudos/destaques-cartao-2026-10-31/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 6 |
| [estudos/escudos](estudos/escudos/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 32 |
| [estudos/gestao-tempo-2026-11-01](estudos/gestao-tempo-2026-11-01/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 21 |
| [estudos/jornada-abas-2026-10-30](estudos/jornada-abas-2026-10-30/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 76 |
| [estudos/medalhas](estudos/medalhas/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 221 |
| [estudos/medalhoes-integracao-2026-11-01](estudos/medalhoes-integracao-2026-11-01/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 111 |
| [estudos/medalhoes-tempo-2026-11-01](estudos/medalhoes-tempo-2026-11-01/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 147 |
| [estudos/trofeus-2026-10-30](estudos/trofeus-2026-10-30/) | Estudos de implementação — Experimentos, provas e registros de alterações. Não são destinos de publicação. | Estudo / histórico técnico | 11 |
| [historico-tarcisio](historico-tarcisio/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 710 |
| [historico-tarcisio/acolhida-crm-2026-10-26](historico-tarcisio/acolhida-crm-2026-10-26/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 24 |
| [historico-tarcisio/catequeses-aprovadas-2026-10-27](historico-tarcisio/catequeses-aprovadas-2026-10-27/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 1 |
| [historico-tarcisio/catequeses-artes-2026-10-27](historico-tarcisio/catequeses-artes-2026-10-27/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 4 |
| [historico-tarcisio/conversas-2026-10-27](historico-tarcisio/conversas-2026-10-27/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 17 |
| [historico-tarcisio/cruz-cerimoniario-2026-10-27](historico-tarcisio/cruz-cerimoniario-2026-10-27/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 2 |
| [historico-tarcisio/escala-parcial-2026-10-27](historico-tarcisio/escala-parcial-2026-10-27/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 2 |
| [historico-tarcisio/interpretacao-semantica-2026-10-27](historico-tarcisio/interpretacao-semantica-2026-10-27/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 7 |
| [historico-tarcisio/jornada-implementacao-2026-10-25](historico-tarcisio/jornada-implementacao-2026-10-25/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 581 |
| [historico-tarcisio/jornada-piloto-2026-10-25](historico-tarcisio/jornada-piloto-2026-10-25/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 13 |
| [historico-tarcisio/jornada-semanal-2026-10-26](historico-tarcisio/jornada-semanal-2026-10-26/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 13 |
| [historico-tarcisio/previa-popups-2026-10-26](historico-tarcisio/previa-popups-2026-10-26/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 4 |
| [historico-tarcisio/quests-panorama-2026-10-26](historico-tarcisio/quests-panorama-2026-10-26/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 12 |
| [historico-tarcisio/quests-repaginacao-2026-10-26](historico-tarcisio/quests-repaginacao-2026-10-26/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 18 |
| [historico-tarcisio/troca-responsavel-2026-10-27](historico-tarcisio/troca-responsavel-2026-10-27/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 3 |
| [historico-tarcisio/xp-missas-2026-10-26](historico-tarcisio/xp-missas-2026-10-26/) | Histórico do Tarcísio — Registros e fontes das implementações anteriores do atendimento. | Histórico técnico | 9 |
| [materiais-paroquia](materiais-paroquia/) | Coroinhas, Tarcísio e pastoral — Agrupador das artes, fontes, dados e provas por assunto da pastoral. | Material da pastoral | 5223 |
| [materiais-paroquia/artes-sacras](materiais-paroquia/artes-sacras/) | Biblioteca de artes sacras — Imagens e direções importadas das conversas, agrupadas por santo ou tema. | Biblioteca de imagens | 16 |
| [materiais-paroquia/auditorias](materiais-paroquia/auditorias/) | Coroinhas, Tarcísio e pastoral — Relatórios e evidências de verificações realizadas; consultar a data de cada registro. | Registro de verificação | 976 |
| [materiais-paroquia/contatos](materiais-paroquia/contatos/) | Contatos da pastoral — Arquivos e registros locais relativos a contatos; dados de uso restrito. | Dados / registro restrito | 1 |
| [materiais-paroquia/encontros-nov-2026](materiais-paroquia/encontros-nov-2026/) | Encontros de novembro — Artes e planilha recebidas dos encontros; fontes e checkpoint ficam em docs/encontros-nov-2026. | Entrega local / dados restritos | 11 |
| [materiais-paroquia/escalas](materiais-paroquia/escalas/) | Escalas da pastoral — Artes e materiais de escala agrupados pela referência do período. | Material de escala | 9 |
| [materiais-paroquia/games](materiais-paroquia/games/) | Jogos — fontes gráficas — Imagens-fonte e materiais de produção dos games; recursos do app ficam em projetos/acolitos/games-art. | Fonte de produção | 77 |
| [materiais-paroquia/jcbp-limeira](materiais-paroquia/jcbp-limeira/) | Referências JCBP Limeira — Materiais locais identificados com o site/paroquia JCBP Limeira. | Material de referência | 1 |
| [materiais-paroquia/provas](materiais-paroquia/provas/) | Provas e verificações da pastoral — Fotos de tela, relatórios de verificação e registros de publicação. | Evidência local | 3711 |
| [materiais-paroquia/provas/publicacoes](materiais-paroquia/provas/publicacoes/) | Histórico das publicações — Logs e verificações preservados, sem as antigas cópias completas do site. | Registro histórico | 37 |
| [materiais-paroquia/somos-do-altar](materiais-paroquia/somos-do-altar/) | Somos do Altar — Agrupador único de entregas e fontes das casas e Jogos Anuais. | Projeto de identidade | 421 |
| [materiais-paroquia/somos-do-altar/entregas](materiais-paroquia/somos-do-altar/entregas/) | Somos do Altar — entregas — Marca, casas, brandbook, especificações, vídeo e documento dos Jogos Anuais. | Entrega local | 63 |
| [materiais-paroquia/somos-do-altar/entregas/06-Video-Casas](materiais-paroquia/somos-do-altar/entregas/06-Video-Casas/) | Vídeo das casas — Montagem local atual e legendas; aguarda revisão audiovisual do dono, segundo LEIA-PRIMEIRO. | Em revisão | 19 |
| [materiais-paroquia/somos-do-altar/entregas/07-Jogos-Anuais](materiais-paroquia/somos-do-altar/entregas/07-Jogos-Anuais/) | Jogos Anuais — Documento consolidado HTML/PDF e conceito dos Jogos Anuais. | Entrega local | 3 |
| [materiais-paroquia/somos-do-altar/producao](materiais-paroquia/somos-do-altar/producao/) | Somos do Altar — fontes — Vetores, geradores, trilhas, locuções, composição e ferramentas de produção. | Fonte de produção | 356 |
| [midia](midia/) | Biblioteca de mídia da pastoral — Brasões, logos, elementos e mídia usados em produção ou no aplicativo. | Recurso / original | 4472 |
| [midia/brasoes](midia/brasoes/) | Biblioteca de mídia da pastoral — Brasões, logos, elementos e mídia usados em produção ou no aplicativo. | Recurso / original | 15 |
| [midia/catequeses](midia/catequeses/) | Biblioteca de mídia da pastoral — Brasões, logos, elementos e mídia usados em produção ou no aplicativo. | Recurso / original | 29 |
| [midia/elementos](midia/elementos/) | Biblioteca de mídia da pastoral — Brasões, logos, elementos e mídia usados em produção ou no aplicativo. | Recurso / original | 8 |
| [midia/landing](midia/landing/) | Biblioteca de mídia da pastoral — Brasões, logos, elementos e mídia usados em produção ou no aplicativo. | Recurso / original | 44 |
| [midia/logos](midia/logos/) | Biblioteca de mídia da pastoral — Assinaturas e símbolos usados pela marca ou aplicativo. | Recurso de marca | 7 |
| [midia/video-integracao](midia/video-integracao/) | Biblioteca de mídia da pastoral — Brasões, logos, elementos e mídia usados em produção ou no aplicativo. | Recurso / original | 74 |
| [midia/video-onboarding-app](midia/video-onboarding-app/) | Biblioteca de mídia da pastoral — Brasões, logos, elementos e mídia usados em produção ou no aplicativo. | Recurso / original | 4291 |
| [midia/video-onboarding-app/v2-brilho](midia/video-onboarding-app/v2-brilho/) | Vídeo de apresentação do app — Fonte da montagem e arquivo sua-jornada-v10.mp4; conservar a locução e os materiais de produção. | Vídeo e fonte de produção | 4174 |
| [projetos](projetos/) | Aplicações da paróquia — Agrupador do Coroinhas e da central de pastorais. | Aplicações | 399 |
| [projetos/acolitos](projetos/acolitos/) | App Coroinhas — Telas, navegação, jogos, insígnias e recursos usados pelo aplicativo. | Código e recursos do app | 396 |
| [projetos/acolitos/provas](projetos/acolitos/provas/) | Provas do Coroinhas — Scripts que abrem as telas com sessão simulada para verificar os fluxos reais. | Ferramenta de verificação | 83 |
| [projetos/central](projetos/central/) | Central de pastorais — Telas de login e central de pastorais, separadas do app Coroinhas. | Aplicação web | 3 |
| [publicacoes](publicacoes/) | Coroinhas, Tarcísio e pastoral — Pacotes ou registros de publicação; a entrega atual é indicada nas entradas por assunto. | Pacote / registro de publicação | 2477 |
| [publicacoes/app-atual](publicacoes/app-atual/) | Publicação do Coroinhas — Única cópia local atual para publicação; substituir o conteúdo no mesmo caminho. | Pacote de publicação | 997 |
| [publicacoes/conquistas-colecao-trofeus-2026-10-30](publicacoes/conquistas-colecao-trofeus-2026-10-30/) | Repositório de coleção preservado — Repositório Git próprio com alterações locais; não é a publicação atual. | Repositório preservado | 743 |
| [publicacoes/conquistas-visual-2026-10-30](publicacoes/conquistas-visual-2026-10-30/) | Repositório visual preservado — Repositório Git próprio com alterações locais; não é a publicação atual. | Repositório preservado | 737 |
| [supabase](supabase/) | Coroinhas, Tarcísio e pastoral — Esquema, migrações, funções e configuração de backend. | Código de backend | 12 |
| [supabase/.temp](supabase/.temp/) | Coroinhas, Tarcísio e pastoral — Esquema, migrações, funções e configuração de backend. | Código de backend | 1 |
| [supabase/migrations](supabase/migrations/) | Coroinhas, Tarcísio e pastoral — Histórico ordenado do esquema; não eliminar como versão de entrega. | Histórico de esquema | 11 |
| [tarcisio-robo](tarcisio-robo/) | Tarcísio — Código da automação paroquial e atendimento por WhatsApp. | Código | 40 |
| [tarcisio-robo/assets](tarcisio-robo/assets/) | Tarcísio — Imagens, fontes ou outros recursos usados pela fonte ou pacote do assunto. | Recurso de produção | 2 |
| [tarcisio-robo/fixtures](tarcisio-robo/fixtures/) | Tarcísio — Código da automação paroquial e atendimento por WhatsApp. | Código | 1 |
| [testes-api](testes-api/) | Coroinhas, Tarcísio e pastoral — Verificações automatizadas dos endpoints e das regras do servidor. | Teste | 11 |

## Localização de qualquer arquivo

[Catálogo por arquivo](../organizacao-local/catalogo-funcional.csv) contém caminho, assunto, função e natureza de cada arquivo inventariado. [Catálogo de pastas](../organizacao-local/catalogo-pastas.csv) inclui os níveis internos que não aparecem na tabela acima. Filtre a coluna `projeto` por `iajcbp`.

Dependências instaladas, ambientes Python, bundles de aplicativos, metadados Git e conteúdos de outras árvores de trabalho não são duplicados no catálogo. Originais, backups de banco e módulos importados não são classificados como exportações antigas.

As instruções e configurações existentes do Claude Code permanecem nos caminhos originais. Este mapa não substitui CLAUDE.md, AGENTS.md nem o checkpoint do projeto.
