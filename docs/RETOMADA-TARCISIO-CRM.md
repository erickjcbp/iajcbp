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
