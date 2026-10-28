# Checkpoint para Claude — Tarcísio / acolhida e CRM

**Pausado pelo dono em26/10/2026.** Ele pediu: “pause aqui e faça um checkpoint para continuar pelo claude”. Não continuar a execução nesta sessão. Trabalho ainda NÃO concluído: implementação local e banco inativo; falta revisão final, publicação e ativação.

## Pedido e decisões do dono
- Tarcísio administra CRM e conduz conversas individuais de acolhida.
- Idade estritamente maior que11anos (12completos) + WhatsApp próprio confirmado: conversar com jovem. Até11 ou sem próprio confirmado: mãe/responsável confirmado. Não adivinhar vínculos/números.
- Durante confecção da túnica: catequese curta sobre servir e liturgia, **terça e quinta18h Brasília**,14encontros para até7semanas. Versões diferentes para jovem e responsável conversar com filho.
- **Raquel,+55 19 99195-8657**: família trata diretamente medidas, valor, pagamento e prazo. Tarcísio só apresenta e acompanha.30-45dias é referência, não promessa nem transição automática.
- CRM atual: aprovacao_cadastro → integracao → whatsapp → tunica → disponivel_escala → integrado. Não aprovar cadastros, aptidão ou nível por IA. Final de integração permanece condicionado à coordenação; não reativar18integrados.
- Autorizações anteriores permitem implementar/publicar dentro desse escopo sem repetidas confirmações. Antes de disparos reais, provas e prévia ao dono; ainda NÃO houve prévia nem contato com famílias/costureira nesta feature.

## Estado concreto
- Repositório: `/Users/erickmartins/projetos/iajcbp`.
- Domínio: `https://coroinhas.jcbplimeira.com.br`.
- Supabase alvo: `fttjgsotuosjfrasttds`.
- **Migração112 foi aplicada em produção e reaplicada com as correções finais das funções. Configuração inicial INATIVA.** Nenhuma ativação executada. Verificar novamente ao retomar.
- Robô da VPS NÃO foi alterado, reconstruído ou reiniciado nesta feature. Código local ainda não foi enviado.
- Frontend do CRM NÃO foi publicado nesta feature. As3fontes novas/modificadas foram copiadas para o staging Vercel isolado, só isso.
- Sem novos envios WhatsApp, push ou alterações dos9cadastros reais por esta feature. Provas de banco usam transação com rollback.
- Auditoria sem expor telefones:9em acompanhamento (1integracao,8tunica),2com contato direto apto,5por responsável,2bloqueados por contato não confirmado.18integrados fora do fluxo.
- Config geral do robô estava pausado=false,respostas_ligadas=true,janela08-21h,teto150. Não alterar a pausa global por causa desta feature.
- Cópia segura das fontes.mjs da VPS em `/Users/erickmartins/arquivos/sao-tarcisio/acolhida-crm-2026-10-26/robo-live`. Antes das mudanças, os módulos locais eram iguais aos publicados. A primeira tentativa de tar com wildcard entre aspas falhou; segunda corrigida, snapshot completo obtido. Nenhum.env foi copiado.

## Fontes e responsabilidades
1. `tarcisio-robo/acolhida-core.mjs`: seleção de destinatário, bloqueio de telefone próprio compartilhado, janela terça/quinta18-20h SP, validação textual conservadora de marcos,14encontros, apresentações da Raquel/família. Conteúdos usam paráfrases e referências Sacrosanctum Concilium/IGMR; não conferem aptidão/XP.
2. `tarcisio-robo/acolhida.mjs`: carregar pipeline, planejar por contato/família, acolhida, catequese só emtunica, consultas30/45dias, pendências, validação antes do envio, ferramentas de registro e pausa/retomada explícitas sem depender da IA.
3. `tarcisio-robo/assistente.mjs`: injeta contexto/ferramenta registrar_acolhida para números vinculados ao acompanhamento, inclui membros em_integracao mesmo fora da lista anterior de ativos. Evidência deve vir de mensagem pendente atual; ferramenta confere destinatário e fato. Comandos explícitos de pausa/retomada tratados antes da IA.
4. `tarcisio-robo/robo.mjs`: chama acolhida.cuidar; valida item antes de enviar. Prefixoacolhida: não leva imagemATENÇÃO, falha não é repetida cegamente; itens interrompidos ficamfalhou ao reiniciar. Consolidar entrega é feito na rodada seguinte.
5. `principal.mjs`, `Dockerfile`, `implantar.sh`: ligação do módulo e inclusão das novas fontes no pacote.
6. `docs/migrations/112_tarcisio_acolhida.sql`:3tabelas comRLS (config,estado,ligação da fila), controles da coordenação, agendamento privado atômico (um contato/dia), consolidação idempotente de entrega/histórico, registro de marcos e reconciliação de etapas. Somente serviço registra fatos; autenticação comum não pode chamar os RPCs privados. Coord pode ler/controlar com permissãoCRM.
7. `projetos/acolitos/crm-acolhida.js/css`, alterações5linhas em`crm.html`: controle global emdetails e acompanhamento/pausa na ficha existente. Histórico usa comentáriosCRM atuais; sem painel paralelo.
8. `docs/superpowers/specs/2026-10-26-tarcisio-acolhida-crm.md` e plano em`docs/superpowers/plans/2026-10-26-tarcisio-acolhida-crm.md`.

## Provas já feitas
- **150testes do robô passaram**, log em`/Users/erickmartins/arquivos/sao-tarcisio/acolhida-crm-2026-10-26/testes-robo.txt`.
- Novos testes: `node --test tarcisio-robo/acolhida-core.test.mjs tarcisio-robo/acolhida.test.mjs` —15casos, incluindo11/12anos, mãe, telefone partilhado, família dedup, agenda, texto negativo, outro filho, pausa negativa,14encontros sem encerrar prazo e envio após avanço cancelado.
- Prova SQL em **produção com rollback**, sem envio externo: reserva única/dia, entrega/histórico únicos, registro/transição, idempotência, marcos fora da ordem e RLS (conta sem permissão vê0linhas). Arquivo preservado `docs/provas/acolhida-crm-rollback-2026-10-26.sql`; contém as definições e fixtures sintéticas, encerraROLLBACK. Para repetir, usar psql comON_ERROR_STOP; revisar primeiro.
- `node projetos/acolitos/provas/crm-acolhida.prova.mjs`: passou em390/768/1440/2560, controles, ficha, marcos, sem overflow. Imagens na pasta da entrega; ficha390 foi inspecionada visualmente.
- Dados reais auditados só em memória pelo script`/tmp/auditar-acolhida.mjs`; ele imprime contagens, não números ou nomes.

## Revisão feita e correções
Agente somente leitura`/root/revisao_acolhida` encontrou5casos; todos receberam correções e testes:
- Fato sobre outro filho: guarda adicional exige confirmação do nome completo em menções ambíguas. **Ainda merece revisão final adversarial**: linguagem natural pode citar múltiplas pessoas; não aceitar atualização no alvo errado.
- Marcos fora de ordem: SQL separa idempotência do fato da reconciliação, usa loop de etapas e histórico por transição. Grupo/túnica informados antes da reunião agora são reconciliados depois.
-14encontros: limite aplicado só à catequese, não aos prazos.
- Negação de pausa: “não quero parar” rejeitado; retomada negativa também.
- Etapa mudada após reserva: catequese/cobrança exigemtunica; cobrança também conferetem_tunica/marco.

## Pendências objetivas para continuar
1. Revisão final dos limites do executor de fatos e do agendamento com estado real, sem enviar a famílias. Revalidar a guarda de beneficiário; testar dois nomes na mesma frase e fatos na fala hipotética/terceira pessoa.
2. **Ajuste recomendado ainda NÃO realizado:** em`validarEnvio`, catequese confere a data e etapa, mas não refaz`horarioCatequese(relogio())`; uma fila longa pode enviar após20h, no mesmo dia. Revalidar a janela antes de enviar e testar. Não alterar código agora sem retomar autorização de trabalho.
3. Conferir a troca de destinatário quando completa12anos ou muda o telefone: estados por membro guardamacolhido_em, mas não o canal/número anterior. Pode começar a catequese no contato novo sem nova apresentação. Decidir e testar apresentação de transição sem reiniciar progresso.
4. Confirmar falta de tentativa ambígua: acolhida usa mesma fila do bot, erros sãofalhou e geram pendência, sem retry automático. Repetir demanda ação consciente da coordenação pela fila atual. Conferir UX de resolver falhas.
5. Provar integração do assistente com chamada real à IA usando fixture sintética (os testes atuais cobrem executor, não conversa real completa da nova ferramenta).
6. Verificar no banco que configcontinuaativa=false e filasacolhida0. ConferirAPI/RLS e atualizar registro de estado se algo externo tiver mudado.
7. Publicar apenas as3fontesCRM no stagingisolado após confirmar diff. Publicar robô com pacote isolado: preservar a cópia do servidor e núcleoscores/ atuais, não enviar todo worktree. Testarbuild e rollback; reinício do robô só nessa etapa.
8. Prévia ao dono no número de conferência já configurado, com exemplo jovem e responsável. NÃO enviar paraRaquel. Não afirmar aprovação/leitura só porque gatewayaceitou.
9. Depois das provas/prévia, ativarconfig e conferir filas/aceitação. Os2sem contato confirmado ficam como pendências naCaixa, não inferir contatos.
10. Atualizar plano/checkpoint com publicação, ativação e evidência real; não dizerconcluído antes.

## Acessos sem segredos
- LerAGENTS.md eCLAUDE.md; nunca trocar contas globais.
- Vercel projetoiajcbp,scopeerickjcbp-1650s-projects,sempre `vercel --global-config ~/.vercel-iajcbp`.
- Staging isolado: `/Users/erickmartins/arquivos/sao-tarcisio/jornada-implementacao-2026-10-25/publicacao`. Última produção anterior é a prévia de pop-ups `dpl_vUmQ6sa7VRPBaMmLMNM4SuU6BkGK`; esta featureCRM não foi publicada.
- `.env` possuiSUPABASE_DB_URL; helper seguro`/tmp/tarcisio-psql.cjs` valida ref e passaPGPASSWORD só por ambiente. Não imprimirURI/chaves.
- SSH`root@179.198.107.71`,chave`~/.ssh/sator_whatsapp_gateway_ed25519`; diretório`/opt/whatsapp/tarcisio`; container`wa-tarcisio-robo-1`. Variáveis do container nunca devem aparecer emlogs.
- O worktree tem MUITAS mudanças anteriores não relacionadas. Não resetar, não masscommit, não publicar o diretório inteiro. Sem commit desta feature até aqui.

## Atualização 26/10 (retomada)
- Item 2 feito: `validarEnvio` refaz `horarioCatequese(relogio())` para catequese (teste novo).
- Item 3 feito sem migração: `planejar` recebe `envios` consolidados; quem já foi acolhido mas nunca recebeu envio naquele número ganha nova apresentação (tipo `acolhida`, progresso preservado).
- Item 1 feito: `executar` rejeita fato com mais de um membro citado ou nome de terceiro ("túnica do Carlos"); testes novos. 153 testes do robô passam.
- Item 6 conferido: config `ativa=false`, 0 envios de acolhida.
- Faltam: 5 (conversa real com IA, fixture sintética), 7–10 (publicar, prévia ao dono, ativar). Robô local tem mudanças de outros trabalhos além da acolhida: revisar diff antes de empacotar.

## 26/10 noite — publicado e ativado
- Robô na VPS atualizado (backup `robo.bak-20261026acolhida`); CRM publicado em produção; `tarcisio_acolhida_config.ativa=true` às ~20h50 (fora da janela, nada saiu). Plano dos 9 atuais: `docs/PLANO-ACOLHIDA-ATUAIS-2026-10-26.md`.
- Membro de TESTE criado no banco real: id `d3ee2961-2f04-483d-ba09-ba4cb63fce53`, nome "Teste Acolhida (apagar)", responsável = número de conferência do dono, etapa túnica. **APAGAR após o teste** (delete em acolitos_membros; cascade leva crm e acompanhamento).
- Membro de teste APAGADO a pedido do dono (26/10). Teste real com a IA (item 5) segue não feito.

## 27/10 — DECISÕES NOVAS DO DONO (revertem regras antigas acima)
- **Túnica recebida = sai da CRM**: tunica → disponivel_escala → integrado (migração 113; status vira ativo; o gatilho `acolitos_crm_integrado` dá nível aspirante a quem não tem nível e Apoio apto). Vale para fala "já tem/recebeu/usa/já serviu com a túnica". "Pronta" ou "vou buscar" NÃO é recebida. Isso substitui "sem admissão/aptidão/nível automáticos" e "final de integração só pela coordenação".
- **Catequese não é presencial**: são 14 textos por WhatsApp (terça/quinta), lidos a qualquer hora. Nunca registrar ausência por isso. A apresentação NÃO fala de encontros; só depois que a família responder sobre a túnica (marcos respondeu_tunica/contato_raquel/pedido_confirmado/confeccao_iniciada/tunica_recebida) o texto 1 traz a explicação.
- **Catequese continua depois de sair da CRM** (gate = existir `tarcisio_acolhida.acolhido_em`, não a etapa; os 18 integrados antigos ficam de fora).
- Número ligado a UM membro: fatos são dele, sem pedir nome; apelidos valem.
- 27/10: ausência de 29/10 da Maria Clara apagada; correção enviada à mãe; Mayara, Maria Clara e Beatriz registradas como túnica recebida (integrado). Beatriz mantém nível coroinha (gatilho só preenche vazio): dono decide se promove.
- Acolhida reativada (ativa=true) após deploy. Quinta 29/10 18h: 5 textos de catequese previstos.

## 27/10 tarde — aprovação de cadastro e integração pelo WhatsApp (migração 114)
- Tarcísio APROVA cadastro (aprovacao_cadastro → integracao) quando há nome completo, nascimento e contato com WhatsApp confirmado; senão abre pendência na Caixa com o que falta. Nunca recusa.
- Integração pelo WhatsApp: 4 apresentações (pastoral+missas vindas das celebrações, escala/ausências, vestes/roupas, chegada/conduta), uma por dia, qualquer dia 08–20h. Após a 4ª, "li e entendi" registra integracao_realizada (→ etapa whatsapp, grupo é com a coordenação).
- Vestes/roupas: fonte = avisos antigos ("roupa discreta e adequada, sapato fechado, evitar chinelos"). Roupas curtas/vestidos/saias valem só para o retiro. Dono pode ter regra mais rígida para missas — perguntar.
- Prévia das 4 mensagens enviada ao número de conferência. Vídeo motion: pacote em ~/Downloads/Compactados/2026-10/motion-claude-code é de After Effects (não instalado); aproveitar só os princípios (mola, curva .86/0/.07/1, entrada em cascata, voz manda no tempo).

## 27/10 — integração = UM vídeo (migração 115)
- Vídeo: `midia/video-integracao/` (roteiro, voz do dono em audio/, ilustrações em arte/, SFX do pacote motion). Versão leve de 5,5 MB hospedada em `tarcisio/integracao/apresentacao-pastoral-v1.mp4`. Para refazer: `node voz.mjs && node quadros.mjs todos && node montar.mjs`.
- A integração é 1 envio: vídeo + legenda curta (missas, link de ausências, "li e entendi"). Sem textos 2–4. `PASSOS_INTEGRACAO=1`. "li e entendi" após o envio registra integracao_realizada (→ etapa whatsapp).
- Chave do Fish Audio no chaveiro (`fishaudio-api`): conta sem crédito de API (402).
- 27/10 tarde: membro de TESTE criado de novo (id b7afdae1-9c17-4de0-8713-421a939b16b4) para a conversa real com a IA no número do dono; APAGAR depois (delete em acolitos_membros; cascade).
- 27/10 fim do dia: conversa real com a IA testada no número do dono (saudação, duração, hipótese, outra pessoa). Causa do 'passei para a coordenação': stop_reason=max_tokens por raciocínio interno → `thinking` desligado, 1200 tokens. Membro de teste APAGADO.

## 27/10 noite — túnica depois do WhatsApp e grupos (migração 116)
- Etapa whatsapp: depois de `integracao_realizada`, o Tarcísio (admin de Pais/Acólitos; NÃO é admin de "Escala") adiciona: jovem c/ WhatsApp próprio → Acólitos (+ responsável em Pais); responsável → Pais. Prova = lista de participantes do gateway; privacidade recusa → convite por link no privado. Confirmado → `tarcisio_acolhida_grupo_confirmado` → etapa tunica + mensagem "grupo-ok". Cerimoniários fica manual.
- Etapa tunica: 1ª mensagem apresenta a costureira (Raquel, +55 19 99195-8657; combinam medidas/valor/pagamento/prazo; 30–45 dias é referência). Marco `tunica_apresentada` (backfill nos 8 já acolhidos). Catequese só depois que a família responde sobre a túnica (ou 7 dias).
- Marco: vídeo de integração enviado manualmente 27/10 ~12h50; aguarda "li e entendi".

## 27/10 noite — controle humano (migração 117)
- O Tarcísio PROPÕe, a coordenação confirma com um toque (CRM → "Tarcísio · … propostas para você"): (1) sair da CRM como integrado após túnica recebida (a etapa agora PARA em disponivel_escala); (2) entrada nos grupos Pais/Acólitos. Aprovar cadastro completo continua automático. Tabela `tarcisio_acolhida_propostas`; RPC `tarcisio_acolhida_decidir` (só coordenação); a proposta vira pendência na Caixa.
- Prova SQL com rollback: `docs/provas/propostas-tarcisio-rollback-2026-10-27.sql`. Ela achou um BUG real em `tarcisio_acolhida_coord()`: com uid nulo/sem papel devolvia NULL e `if not coord()` não barrava (afetava também `tarcisio_acolhida_controlar`). Corrigido com coalesce(...,false).
- Migrações 110/111 (push da jornada, bônus editorial) são de outro trabalho: ficam fora deste commit.


## 27/10 — catequeses substituídas com aprovação do dono
- Dono rejeitou o formato de frases curtas + tarefas/perguntas que dependiam de procurar alguém na igreja. Aprovou os 14 textos completos apresentados na conversa: ensino pelo próprio WhatsApp, sem atividade ou resposta obrigatória.
- `tarcisio-robo/acolhida-core.mjs`: novos títulos e explicações completas; mesmo conteúdo central para jovem/responsável; encerramento permite dúvidas no WhatsApp e pausa. Agenda, destinatários, progresso e confirmações humanas preservados.
- Suíte existente `node --test --test-reporter=dot tarcisio-robo/*.test.mjs` passou. Conferidas as 28 mensagens renderizadas (14 por canal), de 694 a 1119 caracteres, sem campos vazios ou rótulos antigos de tarefas.
- Publicado SOMENTE acolhida-core.mjs na VPS, com backup anterior `/opt/whatsapp/tarcisio/robo/acolhida-core.mjs.bak-20261027-catequeses`; imagem reconstruída e robô reiniciado. Hash conferido DENTRO do container: `8438c5ed3cdac06c31d81c347c834c18710f8ac2a61149bcc182cd6c3ea0b57d`.
- Pós-publicação: WhatsApp `open`, acolhida ativa; simulação somente leitura para 29/10 18h gerou 5 catequeses de índice 1, todas com conteúdo novo e sem tarefas. Nenhum disparo manual nesta atualização.
- Prévia integral dos dois canais: `/Users/erickmartins/arquivos/sao-tarcisio/catequeses-aprovadas-2026-10-27/previa-mensagens.md`.


## 27/10 — 14 artes aprovadas e integradas aos envios
- Dono aprovou as 14 ilustrações da galeria. Originais em `midia/catequeses/v1/`; JPEGs para envio em `midia/catequeses/v1/whatsapp/01.jpg` até `14.jpg`.
- Publicadas no bucket público EXISTENTE `tarcisio`, caminhos `catequeses/v1/01.jpg` a `14.jpg`. Todos os 14 downloads foram conferidos por SHA256 contra os JPEGs locais; HTTP 200. Sem mudanças de políticas, esquema ou permissões.
- `acolhida.mjs`: após validar horário, contato, etapa e pausa, deriva a arte do índice do capítulo e grava `imagem_url` na fila pendente; funciona também com filas anteriores sem arte. `principal.mjs` fornece a URL do projeto. `robo.mjs` permite somente os caminhos de capítulos 01–14 além do vídeo já existente. Acolhida/túnica continuam sem a arte genérica ATENÇÃO.
- Legenda de até 1024 caracteres segue junto da imagem; acima disso envia a imagem com título e depois o texto completo. A entrega só termina após ambos; falha de acolhida permanece sem repetição automática.
- Suíte completa do robô passou, incluindo novos casos de capítulos 1/14, índice inválido, fila antiga e texto longo. Publicados apenas os 3 módulos alterados; backups `.bak-20261027-artes` no diretório do robô da VPS.
- Conferência dentro do container: hashes dos 3 módulos iguais aos locais; WhatsApp open; acolhida ativa; robô não pausado e respostas ligadas. Simulação com dados atuais e escrita apenas em memória: 5 catequeses para 29/10 18h, todas capítulo 1 + arte 01, texto integral. Nenhum disparo manual.
- Evidência: `/Users/erickmartins/arquivos/sao-tarcisio/catequeses-artes-2026-10-27/verificacao-publicacao.json`.


## 27/10 — correção do recebimento da túnica do Henzo
- Mensagem real `983b9fe1-b94b-4bee-86a7-d2f42ddc0278`: “Ola Tarcísio, minha túnica já foi recebida”. IA chamou registrar_acolhida corretamente, mas confirmacaoExplicita não reconhecia a voz passiva; ferramenta recusou e abriu pendência de coordenação.
- Validador aceita “túnica foi recebida/retirada/buscada”; mantém bloqueio de negativa, previsão e hipótese (incluindo “se a túnica foi recebida”). Suíte completa passou. Publicado só acolhida-core.mjs, backup `.bak-20261027-recebimento-passivo`; hash no container `eb08215523a8587033ebca198d5d24358262ccf2d18b77dc96d4f39290139655`.
- Reaplicada a mensagem original pelo executor normal, sem envio de WhatsApp: Henzo agora tem_tunica=true, etapa disponivel_escala. Proposta integrado pendente `28061b28-340d-40cd-9e93-e5f0a82ea80e`, decisão permanece com a coordenação. Só a pendência técnica antiga específica foi resolvida, com justificativa.
- Evidência em `/Users/erickmartins/arquivos/sao-tarcisio/catequeses-artes-2026-10-27/correcao-henzo.json`. WhatsApp open, nenhuma mensagem manual enviada.


## 27/10 — interpretação semântica publicada (autorizada pelo dono)
- Dono autorizou substituir limitação por palavras-chave por compreensão via IA, mantendo vínculo, mensagem de origem, etapa e confirmações humanas.
- `ia.mjs`: `avaliarAcolhida` é verificador sem ferramentas; recebe somente membros em acompanhamento, fato solicitado, mensagem atual e até 10 mensagens de contexto. Retorna JSON; código exige confirmado booleano true, membro/marco exatos e evidência literal na mensagem atual. JSON inválido, truncamento ou indisponibilidade nunca liberam registro.
- `acolhida.mjs`: com IA configurada, os fatos passam pela interpretação semântica, substituindo as guardas lexicais de assunto/pessoa. Guardas de número ligado, ID de mensagem pendente, marco permitido e vídeo enviado continuam determinísticas; SQL continua verificando mensagem de entrada da conversa nas últimas 24h e permissões. Comandos explícitos de pausa/retomada seguem imediatos e independem de IA; verificação lexical permanece como apoio sem IA, sem ser fallback automático em falha da IA.
- `assistente.mjs`: fornece histórico recente ao executor e orienta perguntar diretamente à pessoa quando houver ambiguidade, sem abrir pendência de coordenação apenas por isso. `principal.mjs` injeta a IA no módulo de acolhida.
- Validação: 170 testes locais passaram; 20/20 classificações com IA real (afirmação indireta, voz passiva, pronome, sim contextual, negativa, futuro, hipótese, outra pessoa, dois irmãos, vídeo, contato Raquel, tentativa de manipular instruções). Primeira rodada teve 2 falsos negativos, corrigidos com exemplos explícitos; rodada final 20/20.
- Prova ponta a ponta com IA real em banco em memória e gateway falso: 4/4 passaram. “Minha túnica já foi recebida” e “Já estou com ela” registraram tunica_recebida; “pronta, vou buscar” só respondeu_tunica; frase ambígua pediu esclarecimento, sem registro e sem coordenação.
- Publicados somente ia.mjs, acolhida.mjs, assistente.mjs e principal.mjs. Backup prévio `.bak-20261027-semantica` no diretório do robô da VPS. Após build/reinício, hashes conferidos dentro do container, interpretação conectada no principal, WhatsApp open, robô e respostas ativos, acolhida ativa, 0 entradas pendentes. Nenhuma mensagem manual ou alteração de cadastro nesta atualização; Henzo continua disponivel_escala com proposta integrado aguardando coordenação.
- Evidências e scripts: `/Users/erickmartins/arquivos/sao-tarcisio/interpretacao-semantica-2026-10-27/` (`prova-ia-real-final.jsonl`, `prova-fluxo-ia-real.jsonl`, `hashes-publicados.json`, `verificacao-producao.json`).


## 27/10 — concluir CRM ativa toda a grade da Matriz
- Nova regra do dono: além de nível Aspirante (quando ainda não tem nível) e Apoio apto, quem sai do CRM deve ter disponibilidade em todos os horários regulares da Matriz.
- Migração 118 aplicada e conferida em produção: gatilho adicional `acolitos_crm_integrado_disponibilidade`, função `acolitos_integrado_disponibilidade_matriz`, sem alterar o gatilho existente de nível/Apoio. Grade oficial HORARIOS em shared.js: sábado 17h; domingo 7h, 9h e 19h. Sábado 18h30 é Santo Antônio e não é acrescentado por esta regra.
- Executa ao entrar em integrado, por proposta aprovada ou CRM manual, inclusive INSERT já integrado. Apenas adiciona horários faltantes; preserva disponibilidade/restrição existente, não duplica, não rebaixa nível nem substitui proficiência Apoio. UPDATE que mantém integrado não repõe horários que alguém removeu depois. Sem atualização retroativa de integrados antigos.
- Prova com fixtures e ROLLBACK antes e depois da publicação: não ativa na etapa disponivel_escala, coordenação confirma → ativa os 4 horários; preserva Santo Antônio e domingo 9h existentes; nível/status/Apoio corretos; sem duplicação; respeita edição posterior; inserção direta recebe grade e preserva nível coroinha. Zero fixtures restantes.
- Na conferência final, a coordenação já havia confirmado Henzo em 27/10 19:33:43 UTC: integrado, aspirante, ativo, ainda sem disponibilidade. Complementados SOMENTE os 4 horários da Matriz para Henzo, com comentário de auditoria no CRM. Não foi a execução que aprovou sua proposta. Grade conferida após inserir.
- CLI Supabase local não executou (SIGKILL até no --help); migração foi criada seguindo a numeração existente em docs/migrations e aplicada pelo psql com conexão segura via variável de ambiente. Nenhuma credencial foi gravada nos arquivos de entrega.


## 27/10 18h — escala parcial impedia a prévia automática (corrigido/publicado)
- Dono recebeu push “escala ainda não montada”, sem arte no WhatsApp. Causa comprovada: semana 31/10–01/11 tinha só 4 linhas em 2 de 5 missas; escala-auto tratava QUALQUER linha existente como semana pronta e não chamava o gerador. Workflow 40583165127 falhou às 21:01 UTC porque 3/5 missas estavam vazias; o push foi consequência correta desse bloqueio.
- `escala-auto.mjs`: `temVagasAbertas` compara o modelo por função/quantidade com posições existentes. Semana completa segue somente para conferência; parcial passa pelo mesmo gerador da tela, que preserva linhas existentes e completa vagas. 171 testes do robô passaram, incluindo regressão de parcial preservada e arte pedida após completar.
- Publicado SOMENTE escala-auto.mjs; backup remoto `.bak-20261027-escala-parcial`; hash dentro do container `a1c3f4b53862465e84e249f047aa7f0dd805f34845501c3774198ec556a32ad8`.
- Após reinício (para interromper a espera antiga da arte falhada), estado anterior da tentativa foi salvo em `/Users/erickmartins/arquivos/sao-tarcisio/escala-parcial-2026-10-27/estado-anterior.json`. Reaberta exclusivamente a semana 2026-10-31 em gerando/falhou, sem mensagem_dono_id, para uma tentativa corrigida.
- Resultado real: 92 posições, 4 anteriores preservadas + 88 novas, 0 vagas vazias; semMinistros=false. Workflow 40584252303 SUCCESS, arte de 01/11 gerada às 21:08:54 UTC, HTTP 200. Imagem salva e inspecionada em `/Users/erickmartins/arquivos/sao-tarcisio/escala-parcial-2026-10-27/previa-2026-11-01.png`.
- Pipeline enviou arte ao número de conferência e registrou botões/texto ID `3EB0D537EAACE7EF3F6145`, estado aguardando. Durante a conferência final mudou para confirmada pelo fluxo existente; 92 registros de aviso da semana e pedido `escala:2026-11-01` criado. Esta execução NÃO chamou a confirmação diretamente.


## 27/10 — troca de responsável autorizada e continuidade natural da conversa
- Dono autorizou executar pedidos claros do responsável atual para trocar o contato responsável e a participação no grupo de Pais, sem repetir aprovação da coordenação. Também autorizou retornar à mãe do Adryan após concluir. Não confundir saída do adulto do grupo com desistência/pausa da criança.
- Caso real: Luciana pediu que Saulo assumisse o Adryan e forneceu o telefone local nas mensagens c56f494f-3725-433b-8d8b-381d128d5a08 e a2b23ffe-886c-43a3-b009-7d5cfc0701ca. WhatsApp do pai validado; pai adicionado ao grupo Pais e entrada conferida na lista. Mãe já não constava na lista (todos os 162 participantes tinham phoneNumber), portanto não houve remoção fictícia. Cadastro celular_responsavel atualizado, no_grupo_whatsapp=true, pendência antiga resolvida e histórico comentado. Retorno enviado à mãe e registrado. Acolhida segue sem pausa.
- `acolhida-core.mjs` e rotas em acolhida.mjs priorizam celular_responsavel explicitamente definido, depois mãe, depois recado; preservam WhatsApp próprio de jovem elegível. Mãe continua como dado familiar, sem ser canal preferencial. Roteamento real do pai confirmado após deploy.
- Nova ferramenta `trocar_responsavel` no assistente + executor de acolhida: exige solicitante ser responsável atual confirmado, mensagem atual e evidências de entrada da mesma conversa nas últimas 24h, telefone efetivamente fornecido e interpretação semântica do pedido completo. Valida WhatsApp e entrada do novo no grupo antes de alterar cadastro/retirar antigo. Nunca pausa criança, muda etapa ou nível. Preserva o contato anterior quando o novo não entra; pedido ambíguo/cancelado não executa. Falha de retirada após contato alterado abre pendência técnica e retorna o estado exato. Novo método removerDoGrupo no gateway usa a mesma rota autenticada de participantes.
- Dono criticou apresentações repetidas (“aqui é Tarcísio”). Prompt agora exige ler histórico e continuar o assunto, sem repetir Oi/Olá/apresentação a cada resposta. Apresentar-se apenas no primeiro contato ou quando perguntarem quem fala.
- Validação: 174 testes locais passaram; 4 casos semânticos com IA real (troca clara, hipótese, saída não autorizada, cancelamento) + fluxo completo simulado com IA real passaram. Fluxo confirmou entrada→retirada e respondeu “Pronto...” sem reapresentação. Nenhuma mensagem real nos testes.
- Publicados somente acolhida-core.mjs, acolhida.mjs, assistente.mjs, ia.mjs e evolution.mjs; backups `.bak-20261027-responsavel-continuacao`. Hashes dentro do container conferidos; WhatsApp open; pai no grupo e como destinatário da acolhida, mãe fora, acolhida sem pausa e retorno à mãe registrado.
- Evidências: `/Users/erickmartins/arquivos/sao-tarcisio/troca-responsavel-2026-10-27/`.


## 27/10 — cerimoniário com preferência na cruz da Matriz
- Dono pediu acrescentar preferência de cerimoniário na cruz ao kit processional da Matriz. Configuração existente conferida no banco: kit processional ativo, modo trava, idade mínima 14 e lista de liberados; não foi alterada.
- `projetos/acolitos/gerador-escala-core.js`: nas duas entradas (gerarSemana e planejarVagas), reserva primeiro a cruz da Matriz para cerimoniário elegível (nível 6+). Mantém as verificações de kit/idade, habilitação, disponibilidade, ausência, plano semanal, limite mensal e não repetição. Respeita também a missa dos pais ministros. Sem cerimoniário elegível, segue o rodízio normal. Não afeta a cruz de Santo Antônio nem substitui posições existentes.
- Matching do plano semanal recebe somente slots restantes para não sobrepor a cruz reservada. Testes cobrem preferência mesmo com carga maior, cerimoniário elegível também em outra função, ausência, disponibilidade, habilitação, trava de idade, escolha manual, comunidade distinta, plano semanal sem duplicação e filho de ministro na missa dos pais.
- Fixture histórica original preservada; expectativas da regra nova em `fixtures/gerador-semana-cruz-cerimoniario.json`. Suíte conjunta de regras/API e robô passou (719 testes).
- Publicado só o núcleo alterado no staging Vercel isolado (arquivos app/API do staging conferidos contra HEAD; divergências anteriores eram apenas 2 provas). Projeto e conta confirmados. Produção Vercel `dpl_4MJzxz6C5waWFJJbtaNF4uvotvZ8` READY, domínio público devolve hash novo.
- Mesmo núcleo publicado na VPS em robo/cores e imagem reconstruída; backup `.bak-20261027-cruz-cerimoniario`. Hash no app público e dentro do container: `f71b390b63a4f18d1e9e3a6368704825cb15aeea001044d04b70955e93e63d31`. Simulação sintética dentro do container confirmou preferência; nenhuma escala real ou envio foi alterado. Semana atual permanece confirmada.
- Evidências em `/Users/erickmartins/arquivos/sao-tarcisio/cruz-cerimoniario-2026-10-27/`.

## 27/10 — pais ministros, exceção Assis e conversas
- Dono autorizou acompanhar os pais nos itens 2,3,4,5,6,7,9,10,11,12 da lista (Jullyana, Lucas Fernandes, Manuela, Maria Clara Amador, Maria Clara Matias, Maria Clara Pereira, Miguel dos Santos, Pedro Miguel, Rayssa, Sophia), incluindo irmãos. Ativados também Laura Manuele, Matheus Fernandes Lima e Rafaela Rodrigues.
- Correção expressa: dos Assis SOMENTE Lucas Vieira de Assis acompanha os pais (`escalar_com_pais=true`); Matheus Vieira de Assis permanece false. Confirmado no banco. Não inferir obrigação para todos os irmãos sem respeitar a escolha individual.
- Núcleo do gerador compartilha registros importados de ministros pelo grupo de irmãos apenas para irmãos com opção true; registro original de quem tem false não o obriga. As duas entradas (app e robô) entregam todos os vínculos para o núcleo aplicar a escolha. Isso permite Lucas acompanhar os pais mesmo quando o PDF está vinculado ao cadastro de Matheus. Dois novos testes cobrem a exceção e irmãos com ambas as opções ativas.
- Alice Gonçalves Avelino: opção ativa; linha 2af5eec3-2b8a-4816-b6c5-184fc84df491 movida de domingo 01/11 7h para 9h Matriz; mensagem à mãe enviada e registrada na etapa anterior.
- Dono autorizou: quando encontrar divergência ministro x filho, avisar o responsável que pode levar o filho(a) à mesma missa em que serve como ministro(a). Confirmar o alinhamento da escala antes de afirmar que foi ajustada. Continuar a conversa sem nova apresentação repetida.
- Auditoria 31/10–01/11 encontrou Maria Clara Amador Heydman domingo 7h versus pai no sábado 31/10 17h Matriz. Linha 696c342e-0bd9-451b-bb5b-96127fb8d1fe transferida para sábado 17h, apoio (altar já tinha 3). Aviso enviado ao contato cadastrado e registrado em tarcisio_mensagens; external_id 3EB0C0E8BC5A09D01E528C. Não reemitir. Consulta posterior: zero divergências para os vínculos de ministros disponíveis e opção ativa. Ausência de registro de ministro não prova compatibilidade; não inventar horários de novembro.
- Arte regenerada após os ajustes: workflow 40604496880 sucesso; acolitos_escala_artes de 01/11 gerado_em 2026-10-27T23:47:43.494Z. Não reenfileirada publicação nos grupos já enviada.
- Robô publicado e ativo: gerador SHA256 a57a80b8e1c9a7ba9344f25bbe6f2d0c6ec903c5a07f722c6fa2f46aa1225f2c; escala-auto 6b246bee76654661491ab3267f5f48dadcd76d15df7a1293a5f5dd6d748c00a3. Hashes conferidos no contêiner e log de inicialização com IA.
- Conversas: lista com busca/filtros e pendências, histórico com busca e datas, envios automáticos, contexto do membro/CRM/túnica, atalhos para Caixa e WhatsApp. Sem compositor fictício nem confirmação de leitura inventada. Celular abre histórico em tela cheia; desktop ocupa a largura disponível.
- Prova nova projetos/acolitos/provas/tarcisio-conversas.prova.mjs com dados sintéticos: lista/chat a 360,390,768,1440,2560; busca geral e no histórico, sem overflow, alvos >=44, campos >=16, tela cheia móvel e largura total desktop. Fotos inspecionadas em /Users/erickmartins/arquivos/sao-tarcisio/conversas-2026-10-27. Remover splash na prova; aguardar transição antes de medir (medição intermediária pode dar falsa falha no tablet).
- Suíte completa passou: node --test --test-reporter=dot projetos/acolitos/*.test.js testes-api/*.test.mjs tarcisio-robo/*.test.mjs. Publicação Vercel isolada inclui somente config.html, escala.html, gerador-escala-core.js, tarcisio-painel.css e tarcisio-painel.js; manter demais alterações locais e arquivos LEIA-ME alheios.
- Vercel final dpl_D1RH6x7FY2awetDjEqsSQG9mbnCb READY, https://iajcbp-6t5gh8ked-erickjcbp-1650s-projects.vercel.app. Os cinco arquivos publicados foram novamente baixados do domínio coroinhas.jcbplimeira.com.br e os hashes conferem com os locais.

## Correção crítica 27/10 — Maria Clara Amador
- Dono contestou mensagens artificiais e vínculo de sábado. Família escreveu às 00:12:54Z que nem pai nem mãe servem 31/10 e filha está domingo; robô respondeu indevidamente reafirmando sábado/imutabilidade da semana. Não repetir essa resposta e não usar nossa própria alteração como prova.
- Fonte do erro: acolitos_escala_ministros e4f80bda-f5a6-4d0f-bbcb-5fe375c5560e, importado de ESCALA OUTUBRO REV01 (1).pdf, pai em 31/10 17h. Texto extraído tem Leandro nessa linha e Leandro H. em outro dia; primeiro nome foi tratado como identificação suficiente. Identidade do Leandro de sábado não está comprovada.
- DESFEITA transferência anterior: linha 696c342e-0bd9-451b-bb5b-96127fb8d1fe restaurada DOMINGO 01/11 7h Matriz ALTAR. Excluído somente vínculo contestado de 31/10; preservados demais registros. Inserida resposta negativa para alias leandro/pai deste membro para não reassociar na próxima importação.
- Aviso original enviado era errado; não foi enviada nova mensagem à família neste turno, pois dono está contestando justamente o conteúdo. Arte novamente solicitada após restauração.
- Orientação do assistente corrigida: contestação da família exige verificar/encaminhar divergência; semana confirmada limita ferramenta automática de ausência, não impede coordenação corrigir erro. Respostas curtas, primeiro nome, sem linguagem administrativa/defensiva. Testes assistente (11) passaram.

## 27/10 — validação de ministros na Caixa (instrução do dono)
- Informação insuficiente deve ir à Caixa para dono validar, sem alterar escala nem enviar correção à família. Contexto do casal é pista de conferência, não prova automática. Dono confirmou Leandro H. como pai da Maria Clara Amador e observou Cristiane junto; alias positivo leandro h. gravado, negativo leandro preservado.
- Núcleo ministros agora deixa primeiro nome isolado em dúvida mesmo com um único candidato; um NÃO para um candidato não confirma outro por eliminação. Inicial só identifica quando compatível com sobrenome cadastrado. Confirmação explícita de alias continua válida. Teste específico Leandro versus Leandro H. adicionado.
- Importação robô abre pendência coordenacao para cada dúvida, com arquivo, candidatos, nomes dos dois pais e ocorrências do PDF; deduplica pela chave ministro:mes:nome e estado aberta. Dúvidas não entram em acolitos_escala_ministros. Canal legado de perguntas ao dono ainda funciona em paralelo; não é envio à família. Importação pela tela também abre dúvidas não resolvidas na Caixa antes de salvar. Ainda não há botão específico na Caixa para confirmar alias: pode validar no chat do dono ou pelos controles já existentes de ministros; Resolvido apenas fecha o item.
- Assistente orientado a chamar_coordenacao para informação insuficiente, sem inferir por primeiro nome ou anunciar correção não validada.
- Cinco pendências reais abertas, origem validacao_pais_ministros: Rafaella Ferreira Moinhos/Jucimara Martimiano (mãe consta na ficha mas flag ministra falsa; confirmar se somente mãe), Manuela/Nair (somente mãe no cadastro), Henzo/Acisio e Adriana (flags ambos mas nomes ministro vazios), Maria Clara Pereira/Luciano e Simone (mesma falta), Assis (possível inversão Rosimary como pai e Josemar como mãe). Nenhum desses campos corrigido por inferência. Exceção somente Lucas acompanha pais preservada.
- Suíte completa passou. Publicação Vercel dpl_HhQvr4EpgPzmd3ZvdwSyMxpaFVRM READY; hashes dos dois arquivos baixados do domínio público conferem. Robô reconstruído com assistente, ministros-pdf e escala-ministros-core; backups .bak-20261027-validacao-caixa.
- Dono confirmou os cinco itens com "1. sim, 2.sim, 3.sim 4.sim 5.sim". Cadastros atualizados e verificados: Rafaella Moinhos somente mãe Jucimara; Manuela somente mãe Nair; Henzo pai Acisio/mãe Adriana; Maria Clara Pereira pai Luciano/mãe Simone. Assis pai Josemar/mãe Rosimary nos dois irmãos; nomes e flags ministros preenchidos também em Lucas. Registros importados vinculados a Matheus tiveram pai_ou_mae invertido para corresponder aos nomes corretos. Mantidos escalar_com_pais Lucas=true e Matheus=false. Cinco pendências resolvidas no banco; zero restantes desta revisão. Não alteradas escalas nem enviado aviso às famílias neste turno. Rafaella Moinhos continua escalar_com_pais=false, pois esta confirmação tratou da condição de ministra da mãe, sem pedido explícito de ativar acompanhamento.
