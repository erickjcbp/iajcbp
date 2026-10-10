# Auditoria do app Acólitos e Coroinhas — 10/10/2026

## Defeitos corrigidos

- Atualizações do service worker chamavam location.reload() com a tela em uso. A verificação ao voltar ao foco podia disparar essa troca. Removido o recarregamento automático; o carregamento network-first continua buscando conteúdo novo na próxima navegação.
- A ativação do service worker apagava todos os caches da origem, inclusive os da Central ou de outros aplicativos. A limpeza agora se limita ao prefixo acolitos-.
- X, Escape, gesto de arrastar e Voltar fechavam a montagem sem passar por fecharMontagem(), deixando os cards desatualizados depois de salvar. Todos esses caminhos agora usam o mesmo fechamento.
- O modal de montagem tinha largura inline de 96vw, que impedia tela cheia no celular. Agora usa a variável de largura apenas no desktop.
- O conteúdo principal era limitado a 1320/1500 px. Agora ocupa toda a largura com margens fluidas.
- Campos comuns e campos da montagem têm 16 px no celular; controles de toque têm pelo menos 44 px.

## Verificação

A suíte existente abre 20 telas nos quatro papéis com sessão e banco simulados. Também verifica regras, permissões visíveis, filtros, navegação, estados de erro e geração de escala.

Testes novos executam a configuração PWA e a ativação do service worker, reproduzindo as duas falhas antes da correção. A prova de estabilidade abre o modal, preenche uma pessoa apta, abre/dispensa confirmação, salva e fecha pelo X, em 390, 768, 1366 e 2560 px. Verifica manutenção dos campos, confirmação de gravação, atualização ao fechar, ausência de overflow, largura do conteúdo e alvos no celular.

A primeira execução encontrou sete falhas antigas nas expectativas da suíte: o filtro Idade estava ausente da expectativa; o rodízio agora exige abrir Ver detalhes, e seus cabeçalhos indicam a ordem com uma seta. Atualizados os cenários para exercer a interface atual, mantendo as verificações das contas e dos estados de erro.

Fotos e logs ficam em /Users/erickmartins/arquivos/auditoria-coroinhas-2026-10-10.

## Limites e ponto a aprofundar

Os testes de tela usam banco simulado: não comprovam escrita, RLS, entrega de notificações ou uso offline em uma sessão real de produção. Não foram alterados registros reais.

O salvamento da montagem ainda usa duas operações distintas no banco (delete e insert). Uma falha entre elas pode deixar a missa sem a escala anterior. O fluxo precisa de uma operação transacional no banco para eliminar esse risco; esta correção não altera essa persistência.

As instruções CLAUDE.md, as configurações Claude, os caminhos dos projetos e as alterações locais preexistentes foram preservados.

## Resultado final local

npm test terminou com código 0: 400 testes de regras, 484 verificações de tela e os quatro cenários de estabilidade passaram. git diff --check também passou.
