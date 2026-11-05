# Coleta individual de contatos — 04/11/2026

## Decisões do dono
- Manter Haiku 5.5. Sonnet só poderia ser usado se a estimativa total coubesse em R$ 50/mês. Não foi habilitado Sonnet nem roteamento automático: faltam dados mensais medidos para garantir essa condição.
- Coleta autorizada dos oito membros de 13 anos ou mais fora dos grupos. Perguntar se ainda servem e buscar o número próprio escrito. Grupo Acólitos e Coroinhas é de comunicados/avisos.
- Dúvidas ficam na Caixa em silêncio, sem anunciar encaminhamento à coordenação.
- Não mandar nova resposta para Gisele: número do Miguel já foi salvo e entrada no grupo confirmada no atendimento anterior.

## Causa e correção
`assistente.mjs` apagava mensagens iniciais com papel assistant para começar a API com user. Isso descartava a pergunta proativa. `montarHistorico` agora preserva a pergunta e inclui uma abertura neutra de contexto quando necessária.

`contato-servos.mjs` recupera a coleta autorizada pela chave `contato-13-mais:2026-11-04:<membro_id>`. O alvo vem da fila, não dos argumentos do modelo. Revalida vínculo do canal, idade, mensagens de entrada posteriores à coleta e evidência literal do número. Só opera sobre o membro da coleta. Usa CAS no telefone, recusa número compartilhado e confere WhatsApp e presença no grupo. Preserva o contato do responsável. Arquivamento por saída explícita usa status afastado; não retira o telefone do responsável em nome da criança.

A ferramenta pode pedir esclarecimento relevante, sem recomeçar o atendimento. Falha/incerteza na ação gera pendência silenciosa. As decisões conservadoras por falta de evidência não recebem fallback de modelo mais caro.

A instrução antiga de persona para anunciar encaminhamento foi substituída por pendência silenciosa. Histórico recente continua limitado a 20 registros; a pergunta original da coleta é recuperada separadamente.

`ia.mjs` registra apenas modelo e tokens de consumo (sem conteúdo da conversa/chaves) nos logs. Pendência silenciosa encerra o ciclo de ferramentas sem uma chamada extra para produzir texto. Não há teto financeiro automático nem medição histórica retroativa. Sonnet permanece desabilitado por não haver estimativa mensal comprovada.

## Verificação e publicação
- 265 testes locais passaram, incluindo identidade, telefone inventado, fonte antiga, continuidade, telefone compartilhado, falha na entrada do grupo, saída e preservação do responsável.
- Replay de três etapas com Haiku real e persona de produção: saudação -> mãe -> continua servindo + número; usou registrar_whatsapp_servo. Banco, ferramentas e WhatsApp simulados. Nenhum envio/cadastro real nesse teste.
- Evidências: historico-tarcisio/correcao-contexto-haiku-2026-11-04/ (testes.txt, replay-real.jsonl e fontes da prova).
- Publicados assistente.mjs, contato-servos.mjs, ia.mjs e Dockerfile, com backup dos anteriores `.bak-20261104-coleta` na VPS. implantar.sh local inclui o novo módulo para próximos pacotes.
- Hashes dentro do contêiner conferidos contra as fontes locais. Modelo efetivo claude-haiku-5-5, WhatsApp open. Não houve reenvio de mensagens já processadas.

## Incidente posterior: respostas pausadas e texto da coleta controlado pelo executor

A primeira revisão não foi suficiente: a resposta da Larissa às 09:34 foi anterior ao deploy das 09:41; a resposta da Daniela às 09:43 já usou a versão nova e vazou comentário interno do modelo. O dono determinou pausar respostas até corrigir. `respostas_ligadas=false` permanece em produção. O robô foi parado imediatamente e voltou somente para receber/guardar mensagens com essa flag desligada. `entrada-dono.mjs` passou a respeitar a pausa também na validação e em comandos. O assistente confere novamente a pausa antes do envio, evitando resposta que tenha começado antes de pausar.

Para esta coleta, agora só é oferecida `continuar_coleta` e a pendência interna. A API usa tool_choice any; todo texto livre do modelo é descartado, inclusive preâmbulos. `continuar_coleta` calcula o dado ausente pelo histórico e devolve exclusivamente `resposta_direta` produzida pelo código. Não há segunda chamada para redigir resposta depois da ferramenta. Se houver número sem confirmação de continuidade, pede só continuidade. Se houver continuidade sem número, pede só o número. Pergunta já feita sem esclarecimento não é repetida: vai para revisão silenciosa. Histórico é limitado ao instante da entrada que está sendo processada, evitando usar mensagem posterior sem marcá-la na mesma rodada.

Provas finais: 273 testes passaram. Replay integrado com Haiku real, banco em memória e WhatsApp falso passou para Gisele (executa cadastro/grupo simulados), Larissa (pergunta só continuidade) e Daniela (frase controlada sobre continuar servindo, sem narrar o raciocínio). Cada caso usou uma chamada de aproximadamente 1.300 tokens de entrada e 20 de saída, sem Sonnet. Artefatos em `historico-tarcisio/correcao-contexto-haiku-2026-11-04/replay-controlado.jsonl` e `testes-deterministicos.txt`.

A correção foi publicada e os quatro módulos conferidos por hash dentro do contêiner. As respostas continuam PAUSADAS; não afirmar que o atendimento automático foi retomado.

## Retomada autorizada pelo dono após ajustes familiares

Em 04/11, o dono autorizou respostas manuais a Andressa (Kauan), Marisa (Isabelly/Lívia), Maria de Lourdes (Maria Eduarda Silva da Costa), e avisos privados aos dois cerimoniários da missa de 08/11 às 9h (Gustavo e Franciele). Também autorizou reativar o atendimento automático depois desses ajustes.

- Kauan: telefone próprio informado por cartão salvo, mãe preservada como responsável; presença dos dois no grupo confirmada. Mãe avisada de que Kauan não está escalado em 07–08/11.
- Isabelly: ficha e habilitações ajustadas para somente Apoio conforme orientação familiar/coordenação; escala de 08/11 às 9h em Apoio. Cerimoniários e mãe avisados em privado; não houve anúncio da condição de saúde no grupo.
- Maria Eduarda: não estava suspensa. Histórico: uma falta em 02/11 (chamada finalizada), quatro escalas em outubro, ausências informadas para 24–25/10 e presenças avulsas incluindo 17/10. Não atribuir exclusão a uma suspensão inexistente. Colocada no Altar em 08/11 às 9h na vaga anterior da Isabelly. Número da mãe reclassificado como responsável; telefone próprio da filha ainda não confirmado. Mãe foi avisada da escala e recebeu pedido específico do número próprio.
- Arte oficial de 08/11 regenerada após as alterações, sem reenvio automático aos grupos.
- Novo ajuste de fluxo: responsável vinculado na ficha não precisa repetir parentesco; número da mãe é separado do escrito para o filho; atualização de telefone vazio usa CAS com IS NULL. 274 testes passaram e módulo conferido por hash em execução.
- Retomada executada após conferir os cinco envios: `respostas_ligadas=true`, `ia_modelo=claude-haiku-5-5`, WhatsApp open. A anotação de pausa anterior é histórica: o atendimento automático está ATIVO nesta conclusão.
- Evidências e backup: `historico-tarcisio/ajustes-familias-2026-11-04/`.

## Encerramento persistente após pergunta indevida à Daniela

Às 13:00 de 04/11, o robô voltou a perguntar se Aylla servia após ela já ter tido telefone/grupo/escala resolvidos manualmente e a mãe enviar somente Boa tarde, Ah ótimo e Obrigada. Causa: a fila original enviada ainda era usada como coleta ativa, sem marca persistente de conclusão; a despedida vinha misturada com saudação.

Correção publicada: `tarcisio_validacao_contato.pendente` registra `coleta_concluida=true` e `campanha_id` da coleta; isso é gravado ao concluir telefone/grupo, arquivar ou dispensar celular próprio. Operações manuais com telefone próprio distinto do responsável e entrada no grupo confirmada também são reconhecidas e encerradas. Saudação/agradecimento depois de concluído é consumido sem IA nem envio; novas perguntas reais seguem para atendimento normal, sem a ferramenta de coleta.

Replay exato da Daniela e persistência após nova instância cobertos em testes. Suíte de 277 testes passou. Encerramento de Aylla, Miguel dos Santos Ribeiro e Kauan foi conferido em produção. Nenhuma nova mensagem foi enviada à Daniela; a proteção temporária silenciosa foi resolvida após o marcador de encerramento ser persistido. Atendimento geral continua ativo.
