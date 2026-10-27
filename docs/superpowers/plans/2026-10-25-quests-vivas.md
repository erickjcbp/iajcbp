# Quests vivas Implementation Plan

> Execução nesta sessão, pelo próprio agente, conforme autorização do dono para implementar o panorama com linguagem jovem.

**Goal:** integrar desafios com escolhas, pistas, prática e retorno à tela existente de quests.
**Architecture:** cada quest continua sendo um objetivo do banco. Duas maneiras equivalentes ficam em `criterio.jornada`; ambas usam o mesmo id e a mesma confirmação humana. Novos episódios são opcionais, por nível atual; requisitos formais continuam no percurso atual. A IA gera rascunhos, nunca publica diretamente.
**Tech Stack:** HTML, CSS, JavaScript, API administrativa existente e REST Supabase.
**Spec:** `docs/jornada-ia-piloto-e-implementacao.md`, panorama aprovado e ajuste de linguagem de 25/10.

## Global Constraints
- Tela existente `missoes.html`; sem segunda entrada de quests.
- Linguagem curta, natural, sem tratar adolescente como criança nem usar gíria forçada.
- Dificuldade: descobrir → preparar → antecipar → decidir → coordenar → ensinar → formar mentores.
- Escolhas com consequências, caminhos equivalentes e critérios observáveis; XP somente após confirmação já existente.
- Nada de alterar presenças, habilitações, promoções ou histórico automaticamente.
- IA recebe somente referências e objetivos, sem cadastros; geração limitada e revisão editorial explícita.
- Fotografias em 390, 768, 1440 e 2560; sem transbordamento, controles 44px, modal móvel em tela cheia.

## Review Focus
- Quest antiga sem metadados continua abrindo o fluxo anterior.
- Conteúdo inválido ou malicioso não vira HTML nem dispara escrita.
- Duas opções nunca criam dois registros de conclusão.
- Falha de rede preserva resposta e permite tentar de novo.
- Fechar e retornar preserva rolagem e foco, inclusive por teclado.

### Task 1: contrato e conteúdo
- [x] Criar `jornada-core.js`: validar episódios, determinar dificuldade por nível e montar evidência com caminho escolhido.
- [x] Criar `jornada-catalogo.json`: um episódio com dois caminhos para cada nível atual.
- [x] Provar contrato, progressão e equivalência por id com `node --test projetos/acolitos/jornada-core.test.js`.

### Task 2: experiência na tela atual
- [x] Criar `jornada-quests.js/css`: cena com retorno, escolha de caminho, pistas e relato para coordenação.
- [x] Carregar metadados dos episódios ativos e usar nos registros exibidos em `missoes.html`; usar fluxo antigo quando ausentes.
- [x] Provar cenário, troca, ajuda, erro/reenvio, foco e quatro larguras com navegador isolado.

### Task 3: autoria e IA
- [x] Criar `api/_jornada.js` e encaminhamento `jornada_` na API administrativa.
- [x] Validar identidade e permissão Jornada; limitar geração com reserva persistida; modelo configurável próprio.
- [x] Rascunhos persistidos sem notificar; publicação explícita idempotente em quest opcional exclusiva do nível.
- [x] Integrar revisão/edição/prévia no `jornada-admin.html`; catálogo editorial disponível sem IA.
- [x] Testar negação de acesso, geração sem publicação, publicação repetida e falhas do provedor.

### Task 4: entrega
- [x] Revisar diff exclusivamente deste trabalho, testes e fotografias.
- [x] Publicar somente após conferir projeto, dependências e estado atual publicado; registrar qualquer barreira real.

Ruling: usar a quest existente como objetivo elimina a necessidade de um segundo avaliador para alternativas. Cenários são preparação e geram retorno, sem conclusão automática. A primeira versão acrescenta episódios opcionais; substituir requisitos existentes exige equivalências revisadas, não é uma edição cosmética.

## Continuidade — 26/10/2026

- Implementado painel de reserva por nível, com publicados, rascunhos e contagem agregada de membros que concluíram todos os episódios ativos daquele nível. Nenhum cadastro é enviado ao modelo.
- Gerador permite foco em descoberta, formação, treino acompanhado, equipe ou mentoria; incorpora objetivos e caminhos anteriores e rejeita título/objetivo idêntico. Reposição é solicitada pela coordenação e publicada após revisão, sem cron ou liberação automática.
- Metas iniciais: três episódios nos dois níveis iniciais, quatro nos três níveis de acólito e cinco nos níveis seguintes; extras não têm um teto editorial e não substituem requisitos formais.
- Apresentação móvel dividida em cena, prática e conquista.
- Geração real com a mesma chave Anthropic do WhatsApp validada em produção. Conta técnica temporária removida.
- Catálogo inicial de dez episódios opcionais publicado em 25/10; 20 caminhos. Nível, leitura autenticada e sete arquivos públicos conferidos por prova real.
- Regras de progressão obrigatória atuais preservadas. A trilha completa de 3–5 episódios e a substituição das missões antigas ainda exigem expansão editorial e mapa de equivalências; não são alegadas como concluídas por esta primeira entrega.
