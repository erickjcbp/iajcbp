# Auditoria visual — Acólitos e Coroinhas — 10/10/2026

## Cobertura

25 páginas do módulo, incluindo login, cadastros, ausência pública, novena e página da pastoral. Foram fotografados 115 estados de telas, abas, filtros e modais em 390, 768, 1366 e 2560 px, com cinco checagens adicionais em 360 px: 465 capturas consolidadas. Dados e sessão são simulados; as fontes originais são carregadas.

Inclui fichas de membros e suas abas, operacionais/planilha/rodízio, criação de celebração e modelos, registro de ausência, agenda/calendário/linha do tempo, painel de filtros, cadastro de tarefas e rotinas, quadro/lista/áreas, retiros e suas oito abas e formulários, tesouraria, configuração e sub-abas, conquistas, cartões, jornada e seus editores, conta e notificações.

## Correções

- Calendário: a classe genérica de estado vazio aplicava 48 px de padding aos dias sem data. Com aspect-ratio e colunas de tamanho automático, a grade crescia para além do celular. Colunas agora encolhem corretamente, células vazias não recebem padding e a altura dos dias é adequada também para telas grandes.
- Agenda: o botão flutuante de criar evento encobria conteúdo. Agora fica nas ações da página, antes do filtro.
- Cabeçalho: altura e alinhamento acomodam controles de 44 px; o nome completo da pastoral pode ocupar duas linhas no celular, sem ficar cortado. Mantidas as áreas seguras do aparelho.
- Campos: fontes de 16 px no celular, inclusive buscas e campos com estilos próprios; largura mínima zero evita que campos nativos em linhas flexíveis causem rolagem horizontal na Jornada.
- Controles: abas, botões, setas e pequenos comandos têm área mínima de 44 px no celular.
- Modais: largura de tela cheia no celular prevalece também sobre larguras inline legadas. A confirmação da novena segue o mesmo padrão.
- Formulários públicos: estilos comuns de legibilidade, toque e foco por teclado. Corrigido o texto de orientação da ausência pública que ficava dividido em colunas estreitas.
- Configuração: menu lateral fica abaixo do cabeçalho e tem rolagem própria quando ultrapassa a altura disponível; no celular continua sendo a lista normal de seções.
- Página da pastoral: conteúdo e seção inicial usam margens fluidas e largura total no desktop.
- Navegação por teclado: adicionado indicador de foco visível, preservando a identidade visual.

## Evidências e reprodução

Galeria e medições: /Users/erickmartins/arquivos/auditoria-visual-coroinhas-2026-10-10.

Rodar novamente: npm run auditar-visual. FOTOS_VISUAL permite escolher a pasta das fotos.

A auditoria usa apenas dados simulados. Não submete formulários públicos nem altera cadastros ou escalas reais. Nada desta etapa altera políticas do banco ou envio de mensagens.

A captura de página inteira do Chrome ocultava o painel de Configuração em telas grandes, apesar de o DOM e a captura de viewport estarem corretos. As fotos desse painel usam a área visível. A página da pastoral é percorrida antes da foto para acionar as animações que revelam seções durante a rolagem.

O app mantém o tema escuro existente. O tema claro legado não é oferecido pela interface e não faz parte da cobertura final.

A suíte antiga do Rodízio tinha datas de exemplo convertidas para UTC e falhava depois das 21h. Corrigido o fixture para usar o dia local.

## Limites

A revisão cobre os estados descritos com nomes longos, dados de exemplo e estados vazios. Não comprova toda combinação de volume, configuração personalizada, foto enviada, permissão e dados reais, nem substitui teste de banco em produção. O risco de salvar escala com delete e insert separados, registrado na auditoria funcional anterior, continua pendente.

Arquivos e configurações Claude, caminhos dos projetos e alterações locais anteriores foram preservados.

## Resultado final

465 capturas de 115 estados sem falhas nos critérios medidos. npm test: 400 testes de regras e 484 verificações de tela passaram, assim como os quatro cenários de estabilidade. git diff --check passou.
