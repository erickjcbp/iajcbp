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

Destrinchar o inventário por vitrais, personagens, atributos, símbolos, livros, imagens e objetos; criar descobertas e percursos encadeados. Quantidade deve representar descobertas diferentes, sem inflar com mera troca de redação. Não usar fotos de evidência nem gabaritos como capas que revelem a resposta. Sem caça no sacrário/presbitério; sacristia guiada, demais espaços liberados fora das celebrações. Não exigir foto ou relato longo para uma resposta de nome/número. Identificações descartadas não voltam por inferência.

## Estado no início da implementação

Catálogo local: 110 aventuras; semana real 02–08/11/2026: Aperto no altar, Dois olhares/uma descoberta e Dupla repórter. Preservar IDs, progresso e envios existentes. As 18 propostas estavam apenas no documento, sem publicação. Registrar abaixo o resultado da implementação, testes, migração e deploy antes de concluir.

## Implementação desta rodada

- Novo tipo `descoberta`: resposta de um caractere ou mais, foto opcional, pista aberta sob demanda, revisão humana e 10 XP por descoberta aprovada. Jogos existentes continuam decididos no servidor; fotos antigas seguem obrigatórias.
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

A preencher com commit, deploy e resultado da verificação final no banco.
