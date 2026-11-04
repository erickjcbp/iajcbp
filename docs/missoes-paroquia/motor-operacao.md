# Operação do motor de missões

## Uso pela coordenação

Na Jornada, abra **Banco de missões**. O inventário inicial entra como fonte confirmada e as 18 novas chamadas entram como rascunhos. Jogos do banco já aprovado fornecem referências iniciais de formação. Texto novo da IA continua sujeito à revisão.

1. Selecione até dez fontes, formato, nível e até quatro propostas por lote.
2. O motor reserva duas chamadas da quota diária, gera e revisa. Limite global: oito chamadas por dia; pedidos repetidos não cobram nova reserva.
3. Confira título, hook, instruções, fonte completa, viabilidade, foto e gabarito. Salve antes de aprovar. Aprovação coloca a versão na reserva, não na tela do membro.
4. Nas capacidades, confirme quantas pessoas cada objeto/local/pastoral consegue receber por semana. Zero não tem vaga. Não há capacidade presumida pela IA.
5. Confira a seleção semanal e programe uma próxima segunda-feira. O banco só aceita conjuntos completos: 3x10 XP, 2x20 XP, 1x40 XP e 2 desafios de 10 XP = 130 XP por membro, respeitando nível e histórico.
6. Uma troca semanal ocupa o mesmo slot e esforço. Depois do envio, aguarde revisão; não há troca de missão concluída ou em análise.

## Automação e falhas

Vercel executa `/api/acolito-admin?action=jornada_rotina&modo=motor` diariamente às 11h UTC (08h de Brasília), autenticado pelo CRON_SECRET existente. A reposição só roda se habilitada e salva rascunhos; nunca publica conteúdo livre automaticamente. Geração e revisão usam ANTHROPIC_API_KEY e o modelo JORNADA_ANTHROPIC_MODEL/ANTHROPIC_MODEL já configurados no servidor. Abertura de tela não chama IA. Falta de chave/crédito, timeout ou saída inválida aparecem como falha do lote, sem publicação parcial; pedidos falhos não são repetidos automaticamente.

A quota é conservadora: reserva o par de chamadas antes do provedor. Falha na primeira chamada continua consumindo a reserva para limitar gasto e retries. Registra modelo, tokens e latência; sem tabela de preços configurada, não exibe um valor monetário estimado.

Reserva alvo: 12 simples, 8 investigações, 4 interações e 8 desafios por nível, contando práticas universais e rascunhos pendentes para não gerar indefinidamente sem revisão. Fontes vazias, falta de variedade ou capacidade insuficiente exigem revisão do banco. A prévia mostra as lacunas em vez de publicar uma semana desigual.

## Integridade e transição

Fotos são comprimidas no app e exigem objeto de storage pertencente à conta e à missão. Gabaritos não vão ao membro. Desafios são decididos no servidor; repetição de resposta/aprovação não concede XP novamente. Conclusões das 18 descobertas anteriores são reconhecidas na equivalência do novo banco.

Seleções publicadas são estáveis. Mudança de nível afeta a próxima semana. Missão iniciada tem 14 dias; após sete sem avanço, o app oferece continuar/pista/troca. Envio em análise e XP histórico não são apagados. Uma seleção passada sem prazo ativo sai da lista corrente sem virar dívida.

Desligar a distribuição remove sua data de início na programação; preserva tabelas, atribuições, evidências e XP. Nenhum push novo ou mensagem a terceiros é enviado pelo motor. O fluxo global anterior segue antes da ativação da distribuição individual. Não apagar versões ou reescrever evidências para fazer rollback.

## Referências técnicas consultadas

- [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Anthropic — tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)

## Melhorias menores pendentes

- Depois de gerar novos alvos locais, reabrir o painel para atualizar os campos de capacidade.
- Na fila de aprovação, consultar o gabarito da missão do motor em sua versão no Banco de missões; o atalho de gabarito da fila ainda cobre o banco estático.
- Tornar mais explícita uma asserção da prova da RPC genérica legada. A execução autenticada e as travas do motor têm provas próprias.
