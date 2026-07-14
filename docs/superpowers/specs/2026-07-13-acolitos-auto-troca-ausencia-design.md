# Spec B — Auto-troca por ausência (gerador)

**Data:** 2026-07-13
**Projeto:** Acólitos (iajcbp)
**Escopo:** Quando uma ausência cai em cima de alguém **já escalado**, o sistema tira a pessoa e encaixa automaticamente um substituto válido (hoje só marca "ausência" e mantém a pessoa). A escolha do substituto passa a viver num **motor JS único** compartilhado entre a Escala e a tela de Ausências.

Parte 2 de 3 do roadmap "escalas do servo": **A — Ausências 2.0** (feita), **B — esta**, **C — "Escala eu" + central do servo + caixa unificada** (pendente). Ver [[project_acolitos_ausencias_publica]], [[project_acolitos_gerador]].

---

## Contexto atual (verificado no código)

- **Escala** em `projetos/acolitos/escala.html`. A lógica de escolher substituto está **inline**:
  - `elegivelFuncao(m,f,comKey)` (linhas ~801-815): habilitação `apto/experiente/referencia` em `acolitos_habilitacoes` **OU** kit Santo Antônio (config `gerador.kit_leve`, default cruz/vela p/ ≥7 anos ou nível coroinha+ quando sem `data_nascimento`).
  - `FUNCOES_MAIORES` (linha ~838): `cred_altar, cred_credencia, missal, turibulo, naveta, mitra, baculo` (override via config `funcoes_maiores`).
  - "Cerimoniário" = `nivelInfo(m.nivel).int >= 6` (NÃO é a role de acesso; é o nível da jornada; NIVEIS em `shared.js`).
  - `carregarCargaHistorica(refData)` (linhas ~817-836): rodízio = nº de escalas por membro nas últimas `janela_dias` (config, default 42) até a data de ref, direto em `acolitos_escalas`.
  - `planejarVagas(...)` (linhas ~838-931): filtro duro + camadas de comunidade + reserva de cerimoniário pras MAIORES + `usadoFds` (preferência de não repetir no fds) + rodízio por carga.
  - `trocarPosicao(pe)` (linhas ~971-990): troca de UMA vaga por outra opção válida (análogo mais próximo do que a Spec B precisa) — hoje escolhe **aleatório** dentro do tier, **sem** pesar carga.
- **Ausências** entram por dois caminhos:
  1. **Coordenador "📅 Registrar ausência"** dentro da `escala.html` (`abrirRegistrarAusenciaCoord`, ~1353) → grava em `acolitos_ausencias`.
  2. **Fila pública aprovada** em `ausencias.html` → RPC `acolitos_ausencia_pendente_decidir(p_ids,'aprovar')` (em `db/seguranca/006`) grava em `acolitos_ausencias`. **Essa RPC NÃO toca `acolitos_escalas` hoje.**
- `ausencias.html` **já carrega** `acolitos_roster_substituicao()` → `{membros, habs}`; os membros já trazem `comunidade` e `pode_outras_comunidades` (usados em `ausencias.html:148,511`). `habs` = `{membro_id,funcao,proficiencia}`.
- **`acolitos_escalas`** (migration `docs/migrations/003`): colunas `celebracao_id, membro_id, funcao, status, substituto_id`. `status` CHECK inclui `'escalado'` e `'substituido'`. `substituto_id` referencia `acolitos_membros`. **Não há UNIQUE** em `(membro_id,celebracao_id)` nem `(celebracao_id,funcao)` no repo (prevenção de duplicado é client-side hoje).

**⚠️ Deriva de schema:** o histórico de migrations do repo está desatualizado vs. produção (colunas `apelido`, `grupo_irmaos`, `nivel_desde`; tabelas `acolitos_config/listas/modelos`; `acolitos_ausencias.celebracao_id` nullable; a própria RPC `acolitos_roster_substituicao()` — sem DDL no repo). **Qualquer suposição de banco desta spec deve ser confirmada contra o schema AO VIVO antes de codar** (via MCP Supabase na conta erickjcbp — hoje o MCP está na conta erickia da outra janela).

---

## Design

### Decisões (confirmadas com o dono)
- Troca **automática** + resumo do que mudou ("⚡ Trocas aplicadas (N)") com **Desfazer**. Sem confirmar cada uma.
- **Instantâneo na aprovação** (não só ao abrir a Escala).
- **Guardar histórico**: quem sai vira `status='substituido'` (não apaga).
- **Regras completas** (inclui cerimoniário reservado + kit Santo Antônio).
- **Desfazer = vaga vazia**: apaga o substituto; o ausente segue `substituido`; a ausência continua registrada; não re-troca sozinho depois.
- **Arquitetura: motor JS compartilhado** (não RPC SQL). Single-source-of-truth entre Escala e Ausências.

### 1. Motor único — `projetos/acolitos/gerador-substituto.js` (novo)

Módulo standalone (carregado por `<script>` nas duas páginas; sem bundler). Expõe uma função **pura** (sem I/O — recebe tudo pronto):

```
escolherSubstituto(ctx) -> { membroId } | { membroId: null, motivo: 'sem_candidato' }
```

`ctx` (montado por quem chama):
- `funcao` — a função da vaga a repor.
- `comunidade` — `acolitos_celebracoes.comunidade` da missa (`'matriz'|'santo_antonio'`), usado como `comKey`.
- `horKey` — chave dia+horário p/ disponibilidade (mesmo formato que `dispMap` da escala).
- `membroAusenteId` — quem saiu (excluído do pool).
- `roster` — `[{id,nome,apelido,nivel,comunidade,pode_outras_comunidades,data_nascimento}]` (de `acolitos_roster_substituicao()`; **verificar** se traz `data_nascimento` — senão estender a RPC).
- `habMap` — `{membroId:{funcao:proficiencia}}`.
- `dispMap` — `{membroId:[horKey,...]}` (de `acolitos_disponibilidade`).
- `cargaMap` — `{membroId:count}` (janela de rodízio; mesma lógica de `carregarCargaHistorica`).
- `usadosNaMissa` — `Set(membroId)` já escalados nessa celebração (não duplicar).
- `usadoFds` — `Set(membroId)` já usados no fim de semana (preferência de não repetir).
- `config` — `{ gerador:{janela_dias,kit_leve}, funcoes_maiores:[...] }` (de `acolitos_config`).
- `nivelInt(slug)` — função/mapa do nível→int (reusar a mesma tabela NIVEIS do `shared.js`).

**Regras internas** (portadas 1:1 do `escala.html`, para as duas telas ficarem idênticas):
1. Elegibilidade `elegivelFuncao` (habilitação apto+ OU kit Santo Antônio).
2. Filtro duro: elegível + disponível (`dispMap`) + `!= membroAusenteId` + não em `usadosNaMissa`.
3. Camadas de comunidade: mesma comunidade → cruza só se `pode_outras_comunidades` → qualquer. Primeiro tier não-vazio vence.
4. Reserva de cerimoniário (nível int ≥ 6): para funções **menores**, cerimoniários vão pro último tier; ordem = (não-cerimoniário & fora do fds) → (não-cerimoniário) → (qualquer fora do fds) → (qualquer). Para **MAIORES**, tiers = (fora do fds) → (qualquer).
5. Rodízio: dentro do tier, menor `cargaMap` primeiro; empate aleatório. (Diferente do `trocarPosicao` atual, que é puramente aleatório — a Spec B usa rodízio, consistente com `planejarVagas`.)
6. Sem candidato em nenhum tier → `{membroId:null}`.

`escala.html` passa a **importar** e usar essa função em `trocarPosicao` e na montagem, removendo a duplicação (o `trocarPosicao` ganha o rodízio de brinde — melhoria alinhada ao gerador).

> Extração cuidadosa: `escala.html` é um arquivo grande. Extrair só a função de escolha + suas dependências puras (elegibilidade, tiers, ordenação) para o módulo; a montagem de `ctx` (queries) continua em cada página.

### 2. `escala.html` — auto-troca no "Registrar ausência"

Após `abrirRegistrarAusenciaCoord` gravar a(s) ausência(s): para cada `(membro, celebração)` gravado, se o membro está escalado nessa celebração (`acolitos_escalas`), aplicar a troca (seção 4) usando `escolherSubstituto` (o `ctx` monta-se dos dados já carregados na escala) e abrir o modal-resumo (seção 5).

### 3. `ausencias.html` — auto-troca na aprovação

Ao **Aprovar** (hoje chama `acolitos_ausencia_pendente_decidir`): depois do retorno OK, para cada ausência aprovada, buscar se o membro está escalado na celebração e, se sim, montar `ctx` e aplicar a troca (seção 4), acumulando um resumo. Abrir o modal-resumo (seção 5) com o total.

Dados que a `ausencias.html` precisa buscar na aprovação (além do roster que já tem):
- `acolitos_escalas` da(s) celebração(ões) afetada(s) (quem está escalado, função, para achar a vaga e `usadosNaMissa`).
- `acolitos_disponibilidade` (dispMap) — **verificar RLS de leitura p/ coordenação**.
- carga de rodízio (mesma janela) — buscar como `carregarCargaHistorica`.
- `acolitos_config` (`gerador`, `funcoes_maiores`).
- as outras celebrações do fim de semana p/ `usadoFds` (opcional; se custoso, `usadoFds` pode entrar vazio nesta tela — é só preferência, não filtro duro).

### 4. Gravação da troca (`acolitos_escalas`)

Numa operação (idealmente atômica; se feita client-side, sequência com verificação):
- Linha do ausente naquela `(celebracao_id, funcao)`: `update status='substituido', substituto_id=<novoId ou null>`.
- Se houve substituto: `insert` nova linha `{celebracao_id, membro_id:<novoId>, funcao, status:'escalado'}`.
- Se **não** houve substituto: só marca `substituido` (vaga fica vazia).

**Verificar** RLS: a coordenação (papel coord_admin/subadmin/membro_equipe/cerimonario) precisa poder `insert`/`update` em `acolitos_escalas` a partir de `ausencias.html`. A `escala.html` já grava escalas (delete+insert) — confirmar que a policy cobre o mesmo user na outra página.

### 5. Modal-resumo "⚡ Trocas aplicadas" + Desfazer

Modal compartilhado (pode viver no `gerador-substituto.js` ou num helper), aberto pelas duas telas:
- Lista cada troca: `Fulano (Função, Missa) — ausente → entrou Beltrano` ou `… → SEM substituto ⚠ (vaga vazia)`.
- Botão **Desfazer** por item (ou um "Desfazer tudo"): apaga a linha do substituto (`delete` da linha `escalado` inserida) e mantém o ausente como `substituido` (vaga vazia). Não mexe na ausência. Guarda em memória os ids inseridos p/ o Desfazer.
- Botão **Ok/Fechar** e recarrega a escala/lista.

Usar `uiConfirm/uiAlert` do padrão do projeto (nada de `confirm` nativo) — mas o resumo é um modal próprio.

### 6. Fora de escopo
- Não arrasta irmãos (co-escala) na substituição — é geração em massa.
- Não mexe na geração da escala em si, só na reposição por ausência.
- Não reimplementa o gerador em SQL.
- Módulo "Escala eu" e fusão de módulos = Spec C.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `projetos/acolitos/gerador-substituto.js` (novo) | Motor `escolherSubstituto(ctx)` + helper do modal-resumo. Regras completas portadas do escala.html. |
| `projetos/acolitos/escala.html` | Usa o módulo em `trocarPosicao`/montagem (remove duplicação); auto-troca no "Registrar ausência" + modal-resumo. Inclui `<script src="gerador-substituto.js">`. |
| `projetos/acolitos/ausencias.html` | Na aprovação, aplica auto-troca (monta ctx, grava, resumo). Inclui o `<script>` do módulo e busca dispMap/escalas/carga/config. |
| `acolitos_roster_substituicao()` (RPC) | **Só se** não retornar `data_nascimento`: estender p/ incluir (migration nova em `db/`). A confirmar no schema ao vivo. |

## Critérios de aceite

1. Registrar/aprovar ausência de alguém **escalado** remove a pessoa da escala e encaixa um substituto válido automaticamente, mostrando o resumo.
2. O substituto respeita as regras completas: elegível na função (habilitação OU kit Santo Antônio) + disponível + não-ausente + sem repetir na missa + camada de comunidade + cerimoniário reservado pras MAIORES + rodízio (menor carga primeiro).
3. Sem substituto válido → vaga fica vazia e o resumo sinaliza claramente.
4. A troca grava histórico: ausente vira `substituido` (+`substituto_id`), substituto entra `escalado`.
5. **Desfazer** remove o substituto e deixa a vaga vazia; a ausência permanece; não re-troca sozinho.
6. A escolha do substituto é **idêntica** nas duas telas (mesmo módulo) e consistente com o gerador da Escala.
7. Funciona nos dois caminhos de ausência (Registrar na Escala + Aprovar na fila pública).
8. Sem dado real corrompido em testes (usar linha descartável; nunca membros reais — regra do projeto).

## Notas de implementação / riscos

- **Confirmar schema ao vivo antes de codar** (deriva de migrations): retorno do `acolitos_roster_substituicao()`, colunas reais de `acolitos_membros`/`acolitos_disponibilidade`/`acolitos_escalas`, RLS de escrita em `acolitos_escalas` e leitura de `acolitos_disponibilidade` pela coordenação. Fazer via MCP Supabase quando estiver na conta erickjcbp (hoje está na erickia — não trocar p/ não derrubar a outra janela).
- Páginas são standalone (padrão do projeto); o módulo é `<script>` clássico (expõe em `window`), sem ES modules/bundler, e sem dependência de CDN.
- Só local por enquanto: sem push/deploy; migration (se precisar) não aplicada até o dono pedir.
- `escala.html` é grande — extrair só o necessário pro módulo, seguindo o padrão existente, sem reestruturar além do preciso.
