# Motor de missões Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar banco revisável de missões com fontes confirmadas e distribuir oito oportunidades semanais equivalentes por membro.

**Architecture:** Separar contrato editorial, persistência privada, geração/revisão e distribuição transacional. Reusar autenticação, painel, calendário, foto e recompensa existentes com flag de transição; conteúdo gerado só chega à reserva após aprovação humana.

**Tech Stack:** JavaScript do projeto, API serverless existente, Postgres/Supabase, provedor Anthropic já integrado, node:test e provas Puppeteer existentes.

**Spec:** docs/superpowers/specs/2026-11-04-motor-missoes-design.md

## Global Constraints

- Seis práticas por membro/semana: três simples (10 XP cada), duas investigações (20 cada), uma interação (40).
- Dois desafios digitais de 10 XP cada, independentemente do nível: total semanal de oportunidade 130 XP (110 práticas + 20 digitais).
- Foto obrigatória nas práticas, com captura no app e revisão humana; cuidado com os objetos e devolução ao lugar.
- As 18 descobertas não exigem acompanhamento. Desafios digitais têm verificação no servidor e não exigem foto.
- Publicação inicial somente após revisão explícita da coordenação.
- Uma troca semanal por faixa equivalente. Sem perda de XP e sem nova recompensa por repetir objetivo.
- Não enviar dados pessoais ao provedor. Sem mensagens a terceiros ou novas notificações automáticas nesta entrega.
- Desktop/TV usam toda largura lateral com margens fluidas; limitar largura apenas de texto longo/formulários.
- Celular sem overflow, modais fullscreen, alvos >=44px, campos >=16px, zoom bloqueado conforme regra do dono.
- Fotografar 390, 768, 1440 e 2560 px antes de concluir.
- Preservar alterações locais alheias; nunca trocar conta global GitHub/Vercel.

## Review Focus

- Duas gerações ou trocas simultâneas: quota, capacidade, revisão e concessão precisam de unicidade/lock no banco.
- JSON válido com fonte inventada, comando injetado ou gabarito inconsistente: bloquear referência inválida e exigir conferência factual humana.
- Banco insuficiente, férias pastorais, nível ausente ou mudança de nível: nunca ocultar desigualdade de oportunidade com seleção parcial.
- Acesso por RPC direta e sessão antiga: atribuição, ownership e autorização precisam ser conferidos no servidor em todos os caminhos.
- Semana expirada com foto já enviada/aprovação tardia: preservar evidência e XP de origem sem duplicar recompensa por troca ou revisão.

---

### Task 1: Contrato editorial e fontes curadas

**Files:**
- Create: api/_missoes-core.js, api/_missoes-fontes.js
- Create: testes-api/missoes-core.test.mjs
- Create: docs/missoes-paroquia/triagem-motor.json
- Read: api/_paroquia-banco.js, projetos/acolitos/aventuras-catalogo.json, projetos/acolitos/jornada-core.js, docs/missoes-paroquia/catalogo-detalhado.json

**Interfaces:**
- Produces: validarProposta(input,{fontes,niveis}) -> proposta normalizada; classificarEsforco(tipo) -> {faixa,xp}; publicarSeguro(versao) -> payload público por allowlist.
- Proposta: {versao:1,titulo,gancho,objetivo,tipo,niveis,tempo_min,passos,pistas,fontes:[{id,trecho}],alvo_local,objetivo_chave,mecanica,avaliacao}. tipo em simples/investigacao/interacao/desafio; avaliação privada traz critério, gabarito e itens digitais quando aplicável. XP/foto derivam do tipo, não do modelo.
- fonte: {id,versao,tipo,conteudo,proveniencia,estado}; fonte inativa/descartada não é elegível.

- [ ] Escrever testes para cardinalidade, limites de texto (título 90, gancho 240, 2–4 passos de 450), fonte inexistente/inativa, nível fora dos dez, tentativa de sobrescrever XP e vazamento de gabarito.
- [ ] Rodar node --test testes-api/missoes-core.test.mjs e observar falhas anteriores ao código.
- [ ] Implementar contrato e carregar fontes com IDs derivados de proveniência; importar apenas registros confirmados. Não inferir conteúdo de livros a partir do título.
- [ ] Triar as 110 antigas e 18 novas; identificar objetivo duplicado, sazonalidade e fontes ausentes; reescrever hooks individualmente nos candidatos principais e reserva, sem publicar automaticamente.
- [ ] Rodar testes e revisar conjunto editorial contra inventário. Commit somente arquivos desta tarefa.

### Task 2: Persistência, versões, quota e autorização

**Files:**
- Create: supabase/migrations/<UTC>_motor_missoes_editorial.sql
- Create: testes-api/missoes-banco.test.mjs, projetos/acolitos/provas/missoes-motor-banco.prova.cjs
- Modify: .vercelignore

**Interfaces:**
- Produces: tabelas acolitos_motor_fontes, acolitos_motor_lotes, acolitos_motor_versoes, acolitos_motor_uso, acolitos_motor_atribuicoes e acolitos_motor_semanas; leitura/escrita direta só service_role.
- RPCs privadas: acolitos_motor_reservar_geracao(p_pedido uuid,p_ator uuid,p_dia date,p_limite int) -> {reservado,lote_id}; acolitos_motor_salvar_versao(p_id uuid,p_revisao int,p_conteudo jsonb) -> versão; acolitos_motor_aprovar(p_id uuid,p_revisao int,p_ator uuid) -> versão aprovada.
- Atribuições: unique(membro_id,semana,slot), referência à versão aprovada e missão existente, estado, prazo, troca_usada; objetivo estável separado da versão. Versões aprovadas são imutáveis.

- [ ] Escrever prova transacional de usuário anônimo, membro, equipe sem Jornada e coordenação; incluir concorrência de pedido/quota e revisão desatualizada.
- [ ] Conferir definições efetivas das RPCs existentes e políticas via leitura no projeto correto antes da migração; ler skill Supabase. Registrar baseline de XP/progresso sem exportar cadastros.
- [ ] Implementar migração aditiva, locks/CAS e log sanitizado. Limite global diário de oito chamadas compartilhado com rotina; idempotência antes de chamadas remotas.
- [ ] Excluir migração, fontes/gabaritos privados e provas da hospedagem estática.
- [ ] Aplicar primeiro em transação revertida e executar prova com identidades efetivas. Só registrar migração em produção após verificações. Commit restrito.

### Task 3: Gerador, revisor e reposição da reserva

**Files:**
- Create: api/_missoes-editorial.js, api/_missoes-ia.js
- Modify: api/_jornada.js, api/_bonus-rotina.js
- Create: testes-api/missoes-editorial.test.mjs

**Interfaces:**
- Consumes: contrato/fontes da Task 1 e RPCs da Task 2.
- Produces: tratarEditorial(req,res,{raw,user}) sob guard Jornada existente; ações jornada_motor_config, jornada_motor_fontes, jornada_motor_listar, jornada_motor_gerar, jornada_motor_salvar, jornada_motor_aprovar, jornada_motor_arquivar, jornada_motor_estoque.
- gerarLote({pedidoId,fontesIds,tipo,nivel,quantidade<=4},deps) -> lote persistido, nunca missão publicada.
- reporReserva({data,raw,provider}) -> {lacunas,lote_id,pausada}; cron reserva no máximo um lote diário, sem push.

- [ ] Testar guard de permissão, prompt injection em fonte, ID inventado, JSON incompleto, saída com XP/status extra, revisão bloqueante, timeout, quota e repetição de pedido. Assegurar que nenhum caminho de geração escreve acolitos_missoes.
- [ ] Verificar contrato atual do provedor em documentação oficial. Reusar credencial/modelo existente, ferramenta estruturada e limites; gerar até quatro itens e fazer uma revisão por lote, contabilizando ambas as chamadas.
- [ ] Separar validação determinística de alertas do revisor; comparar objetivo_chave/alvo/mecânica, não apenas título. Aprovação exige fonte/versão atual e marcação humana de conferência factual.
- [ ] Implementar estoque aprovado e pendente por faixa/nível; alvo 24 práticas universais e oito digitais por nível, ajustado por capacidade. Pausar reposição enquanto houver pendência suficiente; registrar lacunas sem geração infinita.
- [ ] Registrar tokens/modelo/latência e custo apenas se tabela configurada. Erros sem chave, prompt integral ou dados pessoais. Testar indisponibilidade sem perder rascunhos.
- [ ] Rodar node --test testes-api/missoes-core.test.mjs testes-api/missoes-editorial.test.mjs testes-api/jornada.test.mjs. Commit restrito.

### Task 4: Seleção individual e trocas equivalentes

**Files:**
- Create: api/_missoes-distribuicao.js, testes-api/missoes-distribuicao.test.mjs
- Create: supabase/migrations/<UTC>_motor_missoes_distribuicao.sql
- Modify: api/_bonus-rotina.js, api/_bonus.js

**Interfaces:**
- Produces: planejarSemana({semana,membros,versoes,historico,capacidades}) -> {atribuicoes,lacunas,total_xp:130}; atribuições só são publicadas se conjunto completo cabe nas capacidades.
- RPCs: acolitos_motor_publicar_semana(p_semana date,p_plano jsonb) -> resumo transacional service-only; acolitos_motor_trocar(p_membro uuid,p_atribuicao uuid) -> atribuição equivalente, autenticação efetiva e uma troca semanal; acolitos_motor_minhas(p_membro uuid) -> payload público autorizado.
- Membro inclui somente ID e nível no distribuidor local; nada disso segue ao provedor.

- [ ] Testar grupos com níveis diferentes, histórico >1000 registros, pouca reserva, pastoral sem vaga, novo membro e entrada concorrente; exigir 3/2/1/2 slots e 130 XP para todos os conjuntos publicados.
- [ ] Implementar paginação completa, priorização de inéditas, janela de quatro semanas e desempate estável. Usar nível atual do membro; preservar atribuições já publicadas ao mudar nível.
- [ ] Publicar plano sob lock por semana/capacidade; revalidar versões aprovadas e população no commit. Insuficiência retorna lacunas e não ativa injustamente o novo programa.
- [ ] Testar duas trocas simultâneas, tentativa após envio, troca por faixa maior e repetição de objetivo; implementar RPC com revogação/reserva atômicas e manutenção dos slots de XP.
- [ ] Adaptar rotina e listar bônus à flag/atribuições. Ajustar seleção dos pushes existentes para nunca apontar missão alheia, sem disparar envios durante prova.
- [ ] Testar dupla com atribuição compatível por participante, mesma missão e recompensa individual única; limitar vagas pelo número real de pessoas. Commit restrito.

### Task 5: Execução, foto, desafios por nível e XP íntegro

**Files:**
- Modify: api/_bonus.js, api/_bonus-banco.js
- Create: supabase/migrations/<UTC>_motor_missoes_execucao.sql
- Create: testes-api/missoes-execucao.test.mjs
- Extend: projetos/acolitos/provas/missoes-motor-banco.prova.cjs

**Interfaces:**
- Consumes: atribuição/versão privada e payload público das Tasks 1–4.
- Produces: iniciar atribuição a partir da versão aprovada; conteúdo público sem resposta. A API e todas as RPCs de iniciar/enviar/responder/aprovar exigem atribuição e estado elegível quando motor ativo.
- Concessão única por membro e objetivo editorial; aprovação resolve slot/versão de origem, nunca XP enviado pelo cliente.

- [ ] Testar RPC direta de missão atribuída a outro, foto de outro usuário/missão, payload com XP e resposta antecipada em jogo; testar dupla, retry e duas aprovações simultâneas.
- [ ] Integrar versões dinâmicas sem depender de MODELOS estático para reconhecer geradas. Manter caminho legado para sessões existentes durante transição.
- [ ] Implementar formatos digitais verificáveis (alternativas, associação, ordenação), feedback após tentativa sem resposta correta pré-envio; dificuldade por nível e 10 XP por desafio.
- [ ] Confirmar propriedade/storage nas fotos e vínculo da evidência; fechamento, expiração e aprovação tardia não apagam envio em análise.
- [ ] Definir estados iniciado/parado/em_analise/concluido/arquivado; aviso in-app após sete dias sem avanço e remoção corrente após 14, sem remover evidências ou XP. Testar virada de semana e troca de nível.
- [ ] Rodar testes de bônus atuais, foto e prova SQL de XP/rollback. Commit restrito.

### Task 6: Painel de coordenação e experiência do membro

**Files:**
- Create: projetos/acolitos/missoes-motor-admin.js, projetos/acolitos/missoes-motor.css
- Modify: projetos/acolitos/jornada-admin.html, projetos/acolitos/bonus-semana.js, projetos/acolitos/missoes.html, projetos/acolitos/sw.js
- Create: projetos/acolitos/provas/missoes-motor.prova.mjs

**Interfaces:**
- Consumes: ações jornada_motor_* e bonus_* preservadas, RPC de troca e payload autorizado.
- Produces: seção Banco de missões no painel existente e seleção individual no app; fontes/estoque/rascunhos/revisão/prévia/reserva/programação, sem configuração técnica no fluxo do membro.

- [ ] Escrever provas de coordenação autorizada, membro sem painel, geração com erro/limite, conflito de revisão, aprovação, insuficiência de reserva e tentativa de acesso cruzado.
- [ ] Implementar prévia do card/hook e missão completa; permitir editar antes de aprovar, mostrar fontes/gabarito só à coordenação. Versão aprovada editada gera novo rascunho.
- [ ] Implementar seis práticas e dois desafios, XP por slot, Minhas missões, pista e troca equivalente com retorno claro. Não mostrar atribuições de colegas nem criar dívida por pendências.
- [ ] Fotografar e inspecionar 390/768/1440/2560: tela cheia lateral, modal fullscreen no celular, scroll interno funcional, foco/teclado, alvos 44px e campos 16px. Exercitar foto real de fixture e todos os formatos digitais.
- [ ] Atualizar cache do app e rodar regressões de missões, habilitações e capítulos. Commit restrito.

### Task 7: Abastecimento inicial, transição e publicação

**Files:**
- Modify: docs/missoes-paroquia/CHECKPOINT.md, .vercelignore
- Create: docs/missoes-paroquia/motor-validacao.json, docs/missoes-paroquia/motor-operacao.md
- Reuse: provas e testes das Tasks 1–6

**Interfaces:**
- Consumes: versões aprovadas e capacidade confirmada no painel.
- Produces: motor publicado com flags explícitas, reserva revisável e ativação semanal demonstrável; rollback da flag mantém histórico.

- [ ] Preparar candidatos iniciais a partir do legado e inventário, incluindo hooks reescritos; não declarar estoque aprovado sem revisão da coordenação. Gerar lote real pequeno somente depois das provas simuladas e com configuração disponível.
- [ ] Validar todas as regras com testes focados, prova autenticada transacional e capturas; executar suíte geral uma vez e separar falhas preexistentes de regressões.
- [ ] Realizar revisão independente final de autorização, concorrência, conteúdo público e XP. Corrigir achados e repetir apenas verificações afetadas.
- [ ] Publicar somente checkout limpo e migrações verificadas no projeto iajcbp/erickjcbp-1650s-projects via configuração local correta; não enviar mensagens nem pushes de teste.
- [ ] Conferir hashes/rotas, fontes/gabaritos privados fora da hospedagem, API sem sessão recusada e baseline histórico intacto. Habilitar geração apenas com fontes/quota prontas; distribuição nova apenas quando existir reserva/capacidade suficiente e fronteira semanal definida.
- [ ] Registrar commits, migrações, flags realmente ativas, estoque, limites e qualquer pendência humana factual. Explicar no resultado se geração está operacional e se distribuição individual já foi ativada; não confundir código publicado com reserva revisada.
