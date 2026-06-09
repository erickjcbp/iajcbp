# Sistema de Missões & XP (Acólitos) — Design

**Data:** 2026-06-05
**App:** iajcbp / Acólitos e Coroinhas (JCBP, Limeira-SP)
**Status:** design aprovado (brainstorm) → pendente de plano de implementação

## Objetivo

Transformar o submódulo passivo de "Meu Desenvolvimento" (hoje só listas de habilidades/competências preenchidas pela coordenação) num **sistema gamificado de Missões + XP** que mostre ao membro, de forma clara e motivadora, **o que falta para subir de nível** e o estimule a se engajar na pastoral. Subir de nível = ganhar experiência (XP) cumprindo missões + ser validado pela coordenação nos critérios subjetivos.

## Decisões fechadas (brainstorm)

1. **Progressão:** cada nível tem **missões-requisito**. Quando o membro conclui **todas** as requisito do próximo nível, fica **ELEGÍVEL** e a **coordenação confirma** a promoção (julgamento humano nos critérios subjetivos; nível continua sob controle da pastoral).
2. **Validação (híbrida):** missões são `automatica` (puxam de dados que o app já tem), `avaliada` (a coordenação marca ao observar) ou `reivindicada` (o membro diz "fiz" e a coordenação aprova).
3. **Taxonomia:** `requisito` (presa a um nível-alvo, obrigatória pra elegibilidade) + `bonus` (avulsa, dá XP/engajamento, inclui as bobas/pegadinhas, não trava promoção).
4. **Camada social:** ranking **individual por TEMPORADA** (zera no período), segmentado em **3 ligas** por faixa de nível (idade ≈ nível) pra não comparar criança com adolescente.
5. **Recompensas:** XP + barra de progresso + requisitos do próximo nível + ranking sazonal por liga + **campeão da temporada** vira Destaque + **Mural de Conquistas (badges)** de missões especiais. Sem moeda/loja.
6. **Permissões:** CRUD de missões = **superadmin** (Config); aprovar reivindicadas / marcar avaliadas / promover = **coordenação** (coord_admin/subadmin/membro_equipe).

### Ligas (default, editável em Config)
- **Iniciantes:** Aspirante · Coroinha · Acólito Aspirante (~9–11)
- **Acólitos:** Acólito Guardião · Acólito Sentinela (~11–14)
- **Cerimoniários:** Aspirante a Cerimoniário → Cerimoniário Mor (~14+)

### Temporada
Duração **configurável**; a coordenação **abre/fecha** manualmente (sugestão ~1 mês). Uma temporada ativa por vez. Ao fechar, registra os campeões por liga nos Destaques.

### Calibração de dificuldade (princípio de balanceamento)
As missões **não são "moles"** — subir de nível tem que custar esforço real, e a dificuldade **escala com a liga**:
- **Iniciantes:** acolhedoras, mas já exigem presença e o básico do altar.
- **Acólitos:** intermediárias (dominar funções novas, constância).
- **Cerimoniários:** **desafiadoras de verdade.** Ser referência exige domínio de **todas** as funções na proficiência máxima **+** várias competências **avaliadas** (liderança, postura, ensino, resolver desvios) — nada de promoção fácil ou só por tempo. **O número de requisitos, o XP que cada um vale e o rigor da avaliação crescem por liga** (a promoção é por requisitos cumpridos, não por limiar de XP — o XP maior serve de peso no ranking e de sinal de esforço). As missões **bônus** podem ser leves/divertidas; as **requisito** das ligas altas têm que ser exigentes.

## Arquitetura

**Missões como dados + elegibilidade/XP/ranking calculados.** Nada de gatilhos ocultos: as missões automáticas são avaliadas sob demanda por uma RPC `security definer` que lê chamada/habilitações. Mantém tudo transparente, administrável e incremental.

Padrão do projeto (lição aprendida — ver `project_acolitos_rls_roster`): qualquer leitura de dados de **outros membros** acessível a papéis não-equipe (ex.: ranking visível a cerimoniários/acólitos) vem de **RPC security-definer**, nunca de SELECT direto que vaze colunas sensíveis (público é majoritariamente menor de idade).

## Modelo de dados

### `acolitos_missoes` (definição)
| campo | tipo | descrição |
|---|---|---|
| `id` | uuid pk | |
| `titulo` | text | |
| `descricao` | text | explicação/como cumprir |
| `tipo` | text | `requisito` \| `bonus` |
| `validacao` | text | `automatica` \| `avaliada` \| `reivindicada` |
| `xp` | int | pontos concedidos |
| `nivel_alvo` | text null | (requisito) slug do nível que destrava; null p/ bônus |
| `aplica_de` | text null | slug do nível mínimo a que a missão aparece (null = todos) |
| `aplica_ate` | text null | slug do nível máximo a que aparece (null = todos) |
| `criterio` | jsonb null | (automática) `{fonte, funcao?, proficiencia?, quantidade?}` |
| `concede_badge` | bool | se vira conquista no mural |
| `badge_icone` | text null | um dos símbolos do gerador de patch (cruz, hostia, ...) |
| `badge_label` | text null | nome da conquista |
| `seriedade` | text null | tom/categoria p/ filtro de autoria: `seria` \| `boba` \| `pegadinha` (opcional, só organização) |
| `ativo` | bool default true | |
| `ordem` | int | |
| `created_at` | timestamptz | |

RLS: SELECT por qualquer autenticado (membro precisa ver as missões). INSERT/UPDATE/DELETE só superadmin (`acolitos_is_superadmin`).

### `acolitos_missao_progresso` (status por membro)
Só cria linha quando há atividade; ausência de linha = não feita.
| campo | tipo | descrição |
|---|---|---|
| `id` | uuid pk | |
| `missao_id` | uuid fk | |
| `membro_id` | uuid fk | |
| `status` | text | `em_analise` \| `concluida` |
| `xp_ganho` | int | snapshot do XP da missão na conclusão |
| `temporada_id` | uuid fk null | temporada ativa no momento da conclusão (p/ ranking) |
| `evidencia` | text null | (reivindicada) o que o membro escreveu |
| `aprovado_por` | uuid null | quem aprovou/marcou |
| `concluida_em` | timestamptz null | |
| unique | (missao_id, membro_id) | |

RLS: membro lê o **próprio** progresso; coordenação lê todos; membro pode INSERT do próprio (status `em_analise`, só missão `reivindicada`); coordenação UPDATE→`concluida`. Conclusões automáticas via RPC security-definer (ignora RLS). Leitura agregada de outros (ranking) via RPC.

### `acolitos_temporadas`
`id`, `nome`, `inicio date`, `fim date null`, `ativa bool`. Constraint: no máximo uma `ativa`. RLS: SELECT autenticado; escrita coordenação.

### Config
- `ligas` = `[{slug, nome, niveis:[slug...]}]` (default as 3 ligas acima).
- `temporada_sugestao_dias` (opcional, só dica de UI).

### Derivados (sem tabela)
- **Badges do membro** = `missao_progresso` concluído ⨝ `missoes` com `concede_badge`.
- **Ranking da liga** = soma de `xp_ganho` na temporada ativa, agrupado por membro, particionado pela liga do `membro.nivel`. Servido por RPC `acolitos_ranking_temporada()`.
- **XP total** = soma de todo `xp_ganho` concluído do membro.
- **Elegibilidade** = para o `nivel_alvo` = próximo nível do membro, todas as `missoes` (tipo=requisito, ativo) têm progresso `concluida` daquele membro.

## Experiência do MEMBRO — "Minha Jornada" (evolui o "Meu Desenvolvimento")

Substitui a view passiva. Seções:
1. **Próximo nível** — emblema-alvo + barra "3 de 5 requisitos"; lista das missões-requisito com ✓/○ e XP. Tudo concluído → banner *"Pronto pra subir! Aguardando a coordenação."*
2. **XP & Liga** — XP total, XP da temporada, badge da liga, posição (*"3º na Liga Acólitos"*).
3. **Missões bônus** — cards aplicáveis ao nível (via `aplica_de/ate`); botão **"Já fiz"** (reivindicada → cria progresso `em_analise`), aviso *"a coordenação avalia"* (avaliada), ou progresso **6/10** (automática, read-only).
4. **Mural de Conquistas** — grade dos badges conquistados.
5. **Ranking** (aba/tela) — top da sua liga na temporada + sua posição (via RPC).

Os campos antigos (`habilidades_desenvolvidas`, `desenvolvimento_competencias`, etc.) permanecem **editáveis na aba Evolução do membro** como anotação da coordenação — não são mais a view motivacional. Sem migração de dados.

## Experiência da COORDENAÇÃO / ADMIN

- **CRUD de missões** no **Config (superadmin)**: criar/editar/excluir; definir tipo, validação, XP, nível-alvo, faixa de aplicação, critério (se automática), badge. Filtro por nível/liga/seriedade pra facilitar a autoria em massa.
- **Fila de aprovação** (coordenação): missões `reivindicada` em `em_analise` → aprovar (vira `concluida`, credita XP, carimba temporada) / recusar (remove a linha). Missões `avaliada` → buscar membro + missão e marcar concluída.
- **Promoções pendentes** (coordenação): lista de membros **elegíveis** → botão **Promover** (seta `membro.nivel` e dispara o "level-up"/notificação que já existem).
- **Temporadas** (coordenação): abrir/fechar; ao fechar, grava campeões por liga nos **Destaques**.

## Missões automáticas — critérios

RPC `acolitos_avaliar_missoes(p_membro uuid)` (`security definer`), chamada **ao abrir o app** (lado membro) e **após confirmar a chamada**. Para cada missão `automatica` aplicável ainda não concluída, checa o `criterio` e, se atingido, cria progresso `concluida` (carimba temporada ativa, credita `xp_ganho`):
- **`missas_servidas`** — conta presenças na chamada (`status in ('presente','atrasado')`), `quantidade` = limiar. Ex.: "Sirva 10 missas".
- **`habilitacao`** — membro tem `funcao` na `proficiencia` ≥ alvo (apto/experiente/referencia). Ex.: "Fique **apto** na vela" → cumpre requisito do Guardião.
- **`frequencia`** — presença num período (sequência/contagem).

É assim que "Guardião aprende sineta / Sentinela aprende sinão e sineta" e "Cerimoniário Referência domina todas as funções" viram **requisito-automática** ligada à habilitação.

## Catálogo de Missões — autoria iterativa

O motor é construído uma vez; o **conteúdo** (dezenas/centenas de missões) é autorado aos poucos **pelo próprio CRUD**, em sessões de brainstorm dedicadas — por nível, por liga, separando sérias × bobas × pegadinhas (campo `seriedade` ajuda a organizar). O motor só precisa tornar fácil adicionar/editar/revisar em lote.

### Conjunto-semente (pra validar o motor)
Exemplos derivados das ideias do dono (serão refinados na autoria):
- **Acólito Guardião (requisito · automática):** apto na **sineta**.
- **Acólito Sentinela (requisito · automática):** apto no **sinão** e na **sineta**.
- **Cerimoniário Referência (requisito):** dominar (referência) **todas** as funções — apoio, vela, cruz, altar, missal, turíbulo, naveta, cerimoniário altar, cerimoniário credência, mitra, báculo (automáticas via habilitação) **+** avaliadas: pró-atividade, resolver desvios na missa, saber ensinar, liderança, postura impecável, responsabilidade apurada, boa comunicação.
- **Bônus (exemplos):** "Sirva 10 missas na temporada" (automática), "Ensine um novato" (avaliada, concede badge), além de missões bobas/pegadinhas a definir.

## Faseamento (1 fase por sessão; cada fase entrega algo usável)

- **F1 — Núcleo:** `acolitos_missoes` + `acolitos_missao_progresso`; CRUD no Config; board do membro (requisito do próximo nível + bônus); validação **reivindicada** + **avaliada**; XP total; elegibilidade + tela **"Promoções pendentes"** pra coordenação confirmar. *(loop principal já em pé)*
- **F2 — Automáticas:** RPC `acolitos_avaliar_missoes` (chamada/habilitações); integra no abrir do app e pós-chamada; semente automática (sineta/sinão/funções).
- **F3 — Temporadas & Ranking:** `acolitos_temporadas`; RPC de ranking por liga; campeão → Destaques; config das ligas.
- **F4 — Mural de Conquistas:** badges derivados das missões especiais; grade no perfil.

## Fora de escopo / futuro
- Loja/recompensas resgatáveis com XP.
- Faixa etária por data de nascimento (usamos faixa de nível).
- Migração dos campos antigos de desenvolvimento.
- Auto-rollover de temporada por data (abertura/fecho é manual).

## Riscos / pontos de atenção
- **RLS:** ranking e progresso de terceiros só via RPC security-definer (não vazar dados de menores).
- **Idempotência das automáticas:** a RPC não pode duplicar conclusão (unique + checagem de existência).
- **Catálogo é o trabalho longo:** o motor precisa de CRUD em lote bom; conteúdo vem em sessões de brainstorm.
