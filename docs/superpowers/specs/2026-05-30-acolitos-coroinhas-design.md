# Módulo Pastoral — Acólitos e Coroinhas
# Design Spec v1

**Data:** 2026-05-30
**Projeto:** iajcbp
**Igreja:** Jesus Cristo Bom Pastor — Limeira/SP
**Módulo:** Acólitos e Coroinhas (primeiro de vários módulos pastorais)

---

## 1. Visão Geral

Módulo pastoral integrado à Central JCBP que digitaliza toda a operação da Pastoral de Acólitos e Coroinhas: cadastro de membros, gestão de escala, onboarding via CRM, controle de frequência, tesouraria e canal espiritual (São Tarcísio).

**Stack:** HTML/CSS/JS vanilla (single-file por ferramenta), Supabase JS v2, mesmo projeto Supabase/GitHub/Vercel da Central JCBP.

**Padrão arquitetural:** Approach B — um arquivo HTML por ferramenta, pasta `projetos/acolitos/`. Cada arquivo registrado como tool na Central JCBP.

---

## 2. Arquitetura do Módulo

### 2.1 Estrutura de arquivos

```
projetos/acolitos/
  index.html          — home + dashboard (equipe e membro)
  membros.html        — gestão de membros (equipe/admin)
  novos.html          — cadastro de novos membros (público pós-login)
  crm.html            — pipeline de integração (equipe/admin)
  escala.html         — gestão de escala (equipe/admin)
  ausencias.html      — comunicado de ausência (todos)
  chamada.html        — chamada de escala (cerimoniário+)
  tesouraria.html     — tesouraria (coord_admin + subadmin)
  sao-tarcisio.html   — são tarcísio (todos)
  config.html         — configurações do módulo (coord_admin)
```

### 2.2 Fluxo de entrada

```
Central JCBP
  └── Card "Acólitos e Coroinhas" (tool registrada)
        └── acolitos/index.html
              ├── Sem vínculo pastoral? → novos.html (cadastro)
              ├── No CRM (status != 'integrado')? → tela de status da integração
              └── Integrado? → home/dashboard por role
```

### 2.3 Infraestrutura compartilhada entre módulos pastorais

Tabelas genéricas reutilizadas por todas as pastorais futuras:

```sql
pastoral_modules   — id, slug ('acolitos'), nome, ativo, created_at
pastoral_members   — user_id, module_id, role, status, created_at
```

`role` em `pastoral_members`: `coord_admin` | `subadmin` | `membro_equipe` | `cerimonario` | `acolito` | `coroinha` | `aspirante` | `novo`

---

## 3. Hierarquia de Papéis

| Role | Descrição | Acesso |
|------|-----------|--------|
| `coord_admin` | Coordenador Geral | Tudo + configurações sensíveis |
| `subadmin` | Vice-coordenador | Tudo exceto: permissões, roles, config do módulo |
| `membro_equipe` | Equipe da pastoral | Todas as ferramentas operacionais |
| `cerimonario` | Cerimoniário | Dashboard, escala, ausências, chamada, São Tarcísio |
| `acolito` | Acólito | Dashboard, escala, ausências, São Tarcísio |
| `coroinha` | Coroinha | Dashboard, escala, ausências, São Tarcísio |
| `aspirante` | Aspirante | Dashboard, São Tarcísio |
| `novo` | Em onboarding | Apenas tela de status do CRM |

---

## 4. Identidade Visual

Base: dark/wine da Central JCBP (`--bg:#0c0404`, `--wine:#8b2020`).
Cor de destaque do módulo: **dourado litúrgico** `#C9A84C` — evoca vestes e objetos sagrados.

### 4.1 Sistema de Patches de Rank (avatar)

SVG renderizado, sobreposto no canto inferior direito do avatar do membro. Inspirado em rankings de jogos (League of Legends / Valorant): forma distinta + ícone interno + efeito de brilho por tier.

| Nível | Forma | Ícone | Cor principal | Efeito CSS |
|-------|-------|-------|--------------|------------|
| Aspirante | Escudo simples | Cruz | `#8B8B8B` cinza metálico | Sem glow |
| Coroinha | Escudo com borda dupla | Coroa | `#4A90C4` azul + prata | `drop-shadow` suave azul |
| Acólito | Hexágono facetado | Cálice | `#C9A84C` dourado + âmbar | `drop-shadow` dourado médio |
| Cerimoniário | Diamante facetado | Báculo + estrela | `#7B4F9E` púrpura + gem | `drop-shadow` glow intenso púrpura |

O patch aparece em: cards de membro, ficha individual (tamanho grande), planilha de escala (miniatura), home do membro (destaque).

---

## 5. Banco de Dados — Tabelas do Módulo

```sql
-- Ficha completa do membro na pastoral
acolitos_membros (
  id uuid PK,
  user_id uuid FK → auth.users,
  nome text,
  data_nascimento date,
  telefone text,
  responsavel text,
  comunidade text,          -- 'matriz' | 'santo_antonio' | 'outra'
  pode_outras_comunidades bool,
  tem_pai_ministro bool,
  nome_pai_ministro text,
  tem_mae_ministro bool,
  nome_mae_ministro text,
  comunidade_ministro text,
  escalar_com_pais bool,
  missa_pais_fixada uuid FK → acolitos_celebracoes,
  tem_irmao_pastoral bool,
  irmao_id uuid FK → acolitos_membros,
  escalar_com_irmao bool,
  necessidades_especiais text,
  observacoes text,
  foto_url text,
  status text,              -- 'ativo' | 'afastado' | 'desligado'
  created_at timestamptz
)

-- Disponibilidade por membro
acolitos_disponibilidade (
  membro_id uuid FK,
  dia text,                 -- 'sabado' | 'domingo'
  horario text,             -- '17h' | '7h' | '9h' | '19h' | '18h30'
  comunidade text,
  restricao text            -- descrição livre de restrição
)

-- Matriz de habilitações: membro × função × proficiência
acolitos_habilitacoes (
  membro_id uuid FK,
  funcao text,              -- 'apoio' | 'cruz' | 'vela' | 'sineta' | 'sinao' |
                            --  'altar' | 'turibulo' | 'naveta' | 'missal' |
                            --  'cred_altar' | 'cred_credencia' | 'mitra' | 'baculo'
  proficiencia text,        -- 'nao_treinado' | 'em_formacao' | 'apto' | 'experiente' | 'referencia'
  updated_at timestamptz
)

-- CRM de onboarding
acolitos_crm (
  id uuid PK,
  membro_id uuid FK,
  etapa text,               -- 'integracao' | 'whatsapp' | 'tunica' |
                            --  'disponivel_escala' | 'integrado'
  etapa_iniciada_em timestamptz,
  observacoes text
)

acolitos_crm_historico (
  id uuid PK,
  crm_id uuid FK,
  etapa_de text,
  etapa_para text,
  changed_by uuid FK → auth.users,
  changed_at timestamptz
)

-- Calendário de celebrações
acolitos_celebracoes (
  id uuid PK,
  data date,
  horario text,
  comunidade text,
  tipo text,                -- 'missa_comum' | 'solenidade' | 'casamento' |
                            --  'batizado' | 'crisma' | 'ordenacao'
  observacoes text,
  recorrente bool,
  created_at timestamptz
)

-- Escala por celebração
acolitos_escalas (
  id uuid PK,
  celebracao_id uuid FK,
  membro_id uuid FK,
  funcao text,
  status text,              -- 'escalado' | 'presente' | 'ausente_justificado' |
                            --  'ausente' | 'atrasado' | 'substituido'
  substituto_id uuid FK → acolitos_membros,
  created_by uuid FK → auth.users,
  created_at timestamptz
)

-- Comunicados de ausência
acolitos_ausencias (
  id uuid PK,
  membro_id uuid FK,
  celebracao_id uuid FK,
  motivo text,              -- 'doenca' | 'viagem' | 'familia' | 'outro'
  observacao text,
  created_at timestamptz,
  bloqueado_cancelamento bool  -- true se < 2h antes da missa
)

-- Chamadas de escala
acolitos_chamadas (
  id uuid PK,
  celebracao_id uuid FK,
  realizada_por uuid FK → auth.users,
  realizada_em timestamptz
)

acolitos_chamadas_itens (
  id uuid PK,
  chamada_id uuid FK,
  escala_id uuid FK,
  resultado text,           -- 'presente' | 'ausente' | 'atrasado'
  substituto_id uuid FK → acolitos_membros
)

-- Tesouraria
acolitos_tesouraria (
  id uuid PK,
  data date,
  descricao text,
  categoria text,
  tipo text,                -- 'receita' | 'despesa'
  valor numeric(10,2),
  status text,              -- 'pago' | 'pendente'
  observacoes text,
  created_by uuid FK → auth.users,
  created_at timestamptz
)

-- São Tarcísio
acolitos_sao_tarcisio (
  id uuid PK,
  membro_id uuid FK,
  canal text,               -- 'app' | 'whatsapp' (preparado para integração futura)
  tipo text,                -- 'mensagem_livre' | 'pedido_oracao' | 'pedido_funcao'
  conteudo text,
  funcao_solicitada text,   -- preenchido quando tipo = 'pedido_funcao'
  membro_apto bool,         -- calculado no momento do pedido
  resposta_equipe text,
  respondido_por uuid FK → auth.users,
  status text,              -- 'novo' | 'lido' | 'respondido' | 'atendido'
  created_at timestamptz
)
```

---

## 6. Sub-módulos — Design

### 6.1 Novos Membros (`novos.html`)

Tela de cadastro para quem acessa o módulo pela primeira vez.

**Suporte a cadastro múltiplo:** bloco de membro repete por filho via botão `+ Adicionar outro membro`. Dados do responsável preenchidos uma vez, vinculados a todos.

**Campos por membro:**
- Nome completo, data de nascimento, idade (calculada)
- Celular do membro (opcional)
- Possui Batismo? · Primeira Eucaristia? · Crisma? (toggles sim/não)
- Já possui túnica? · Já está no grupo de WhatsApp?

**Campos do responsável** (uma vez, compartilhado):
- Nome do pai / Nome da mãe
- Os pais são ministros? → se sim: nomes completos + comunidade
- Celular da mãe · Celular de recado · Endereço

**Ao enviar:**
1. Cria conta Supabase Auth (ou vincula existente)
2. Insere em `acolitos_membros` com status `ativo`
3. Insere em `pastoral_members` com role `novo`
4. Abre entrada no CRM na etapa **Integração**
5. Redireciona para tela de status do CRM

---

### 6.2 CRM (`crm.html`)

Pipeline de onboarding em 5 etapas: `Integração → WhatsApp → Túnica → Disponível para Escala → Integrado`

**Vista Pipeline (padrão):** colunas kanban com cards de membro. Cada card: foto + patch, nome, idade, dias na etapa, alerta se parado há +30 dias. Arrastar card avança etapa (com confirmação).

**Vista Lista:** tabela — Nome · Idade · Etapa · Dias na etapa · Data entrada · Ações.

**Ações por etapa:**

| Etapa | Ação |
|-------|------|
| Integração | Marcar reunião realizada |
| WhatsApp | Confirmar entrada nos grupos |
| Túnica | Confirmar recebimento |
| Disponível para Escala | Preencher disponibilidade + habilitar funções iniciais |
| Integrado | Modal: definir role (`aspirante` / `coroinha` / `acólito`) → membro migra para Gestão de Membros |

**KPIs no topo:** Total em onboarding · Média dias por etapa · Travados +30 dias · Integrados no mês.

**Tela de status (visão do membro `novo`):**
Barra de progresso com 5 etapas, etapa atual destacada, descrição do que falta, contato da equipe.

---

### 6.3 Gestão de Membros (`membros.html`)

**Vista Cards (única — planilha está na Gestão de Escala):**
Grid responsivo. Cada card: foto com patch de rank, nome, badge de status, comunidade, barra de frequência %, função máxima habilitada, ícone de alerta para obs. especiais.

Toolbar: busca por nome, filtros (status / comunidade / função / role), `+ Novo Membro`.

**Ficha individual (abre ao clicar):**

*Header fixo:* foto grande + patch rank em destaque + nome + status badge + comunidade + botões Editar / Histórico.

| Aba | Conteúdo |
|-----|----------|
| Pessoal | Nome, nascimento, idade, telefone, responsável, nec. especiais |
| Habilitações | Matriz visual: 13 funções × 5 níveis de proficiência. Cards por função com seletor |
| Disponibilidade | Checkboxes dia/horário + restrições livres + botão "Vincular missa dos pais" |
| Família | Pais ministros (nome + comunidade + flag escalar junto), irmãos na pastoral (link para perfil + flag escalar junto) |
| Frequência | KPIs: escalado, servido, taxa %, faltas just., faltas não just., atrasos, última participação. Gráfico barras 6 meses |
| Evolução | Checklist de formações + próxima etapa + linha do tempo visual Aspirante → Cerimoniário |

**Regras de acesso:**

| Ação | coord_admin | subadmin | membro_equipe |
|------|:-----------:|:--------:|:-------------:|
| Ver membros | ✅ | ✅ | ✅ |
| Criar/editar | ✅ | ✅ | ✅ |
| Excluir | ✅ | ✅ | ❌ |
| Alterar role | ✅ | ❌ | ❌ |

---

### 6.4 Gestão de Escala (`escala.html`)

**Aba 1 — Visão Operacional:**
Cards de celebrações agrupados por semana. Cada card: data + horário + comunidade + tipo + barra de cobertura por categoria (Cerimoniais / Altares / Litúrgicos / Apoios) com status (`✅ Completa` / `⚠️ Parcial` / `🔴 Crítica` / `○ Vazia`). Botão `Montar Escala` / `Editar Escala`.

**Aba 2 — Planilha:**
Tabela horizontal. Zona esquerda fixa (scroll bloqueado):

| Coluna | Detalhe |
|--------|---------|
| Foto + Nome | Avatar + patch + nome clicável |
| Idade | Calculada |
| Freq % | Mini barra + número |
| Obs | 💬 hover → balão com restrições + nec. especiais |
| MECE | 👨‍👩 hover → nomes dos pais ministros + missa vinculada |
| Bolinhas funções | 13 colunas: ⚫ Não treinado · 🟡 Em formação · 🟢 Apto · 🔵 Experiente · 🟣 Referência |
| Fn. Máx | Função mais alta apta |

Zona direita (scroll horizontal): uma coluna por celebração.
- Cabeçalho duplo: `15/Jun Dom` / `9h · Matriz`
- Célula escalada: função colorida por categoria (ex: `Missal`)
- Vazia: `—` · Ausência just.: `AJ` âmbar · Falta: `F` vermelho
- Clique na célula → popover atribuir/editar função

Linhas agrupadas: Cerimoniários → Acólitos → Coroinhas → Aspirantes (colapsáveis).

**Montagem de Escala (tela dedicada):**
Duas colunas:
- Esquerda: posições necessárias por categoria (template da comunidade), cada posição com seletor de membro
- Direita: lista de membros elegíveis filtrada automaticamente pela ordem de prioridade:
  1. Disponibilidade no dia/horário
  2. Comunidade
  3. Restrições especiais
  4. Pais ministros nessa missa
  5. Irmão já escalado
  6. Aptidão para a função
  7. Menor frequência (rodízio)

Alertas em tempo real: membro inapto · restrição de horário · irmão em outra missa · função crítica vazia.

**Dimensionamento mínimo configurável:**

| Função | Matriz | Sto. Antônio |
|--------|:------:|:------------:|
| Cerimonial de Altar | 1 | 1 |
| Cerimonial de Credência | 1 | — |
| Missal | 1 | 1 |
| Altar | 3 | 3 |
| Cruz | 1 | 1 |
| Vela | 2 | 2 |
| Sineta | 1 | — |
| Sinão | 1 | — |
| Apoio | 6 | — |
| **Total mínimo** | **17** | **8** |

---

### 6.5 Comunicado de Ausência (`ausencias.html`)

**Visão do membro:** formulário para selecionar celebração escalada (apenas futuras) + motivo (Doença / Viagem / Família / Outro) + observação opcional. Ao confirmar: célula na Planilha vira `AJ`, função marcada como descoberta, escalista recebe alerta. Cancelamento bloqueado se < 2h antes da missa.

Lista das últimas 10 ausências informadas: Data · Missa · Função · Motivo · Status.

**Visão equipe (aba extra):** tabela de todas as ausências com filtros. Indicador de funções críticas descobertas.

---

### 6.6 Chamada de Escala (`chamada.html`)

Acesso: `cerimonario` · `membro_equipe` · `subadmin` · `coord_admin`

1. Selecionar celebração com escala publicada
2. Lista de chamada agrupada por categoria com três opções por membro: ✅ Presente · ⏰ Atrasado · ❌ Ausente
3. Ausente → expande seletor de substituto (membros aptos não escalados nessa missa)
4. Ao confirmar: atualiza `acolitos_chamadas`, alimenta indicadores de frequência e atrasos de cada membro

---

### 6.7 Home / Dashboard (`index.html`)

**Roteamento por role:**
- `novo` → tela de status de integração (barra de progresso CRM)
- `aspirante` / `coroinha` / `acolito` / `cerimonario` → Dashboard Pessoal
- `membro_equipe` / `subadmin` / `coord_admin` → Dashboard Operacional (com toggle para ver Pessoal)

**Dashboard Pessoal:**
- Header: foto + patch rank grande + nome + role + comunidade
- KPIs: Frequência % · Escalas no ano · Última missa
- Jornada: linha do tempo horizontal Aspirante → Cerimoniário com posição atual e funções conquistadas
- Próximas escalas: 3 cards com data / horário / comunidade / função + botão Informar Ausência
- Agenda da pastoral: eventos cronológicos com badges de tipo
- Acesso rápido ao São Tarcísio

**Dashboard Operacional:**
- KPIs: Membros ativos · Freq. média · Escalas do mês · No CRM · Alertas
- Gráficos: presença por mês (linha) · membros por nível (barras) · cobertura de escalas (donut)
- Agenda com badges de cobertura por celebração
- Painel de alertas: baixa frequência · funções críticas descobertas · CRM travado · ausências sem substituto

---

### 6.8 Tesouraria (`tesouraria.html`)

Acesso: `coord_admin` · `subadmin`

KPIs: Saldo atual · Receitas/mês · Despesas/mês · A pagar (pendentes).

Gráficos: fluxo de caixa 6 meses (linha) · receitas vs despesas por mês (barras) · por categoria (donut).

Tabela de lançamentos: Data · Descrição · Categoria · Tipo · Valor · Status · Ações. Filtros por período / categoria / tipo / status. Botão `+ Novo Lançamento`.

Aba **A Pagar / A Receber**: apenas lançamentos pendentes com botão `Marcar como Pago`.

Categorias:
- Receitas: Caixinha · Doação · Evento · Outro
- Despesas: Material Litúrgico · Túnicas · Transporte · Evento · Outro

---

### 6.9 São Tarcísio (`sao-tarcisio.html`)

Interface espiritual: visual mais sereno, ícone/imagem de São Tarcísio, tipografia acolhedora.

**Visão membro:**
Dois botões de entrada: `✉️ Mensagem livre` · `🙏 Fazer um Pedido`.

Pedido estruturado: Pedido de oração · Quero servir em uma função · Outro.

Lógica de pedido de função:
- Membro apto → cria alerta para escalista com tag `Pedido de Função`
- Membro não apto → resposta automática encorajadora + pedido registrado para acompanhamento

Histórico das próprias mensagens: data · tipo · status (Lido / Respondido / Atendido).

**Visão equipe:**
Lista de membros com atividade recente. Clique → histórico completo + campo de resposta.

Aba **Pedidos de Função**: tabela — Nome · Função · Apto? · Data · Status. Botão `Escalar` para os aptos.

**Arquitetura de integração futura:** campo `canal` (`app` / `whatsapp`) preparado para API do WhatsApp Business + agente de IA São Tarcísio.

---

### 6.10 Configurações do Módulo (`config.html`)

Acesso: `coord_admin` exclusivo.

| Seção | Conteúdo |
|-------|----------|
| Calendário Fixo | Missas recorrentes semanais editáveis (dia / horário / comunidade / tipo) |
| Templates de Escala | Dimensionamento mínimo por função por comunidade (tabela editável) |
| Funções e Habilitações | Gerencia lista de funções: nome / categoria / ativo |
| Permissões | Tabela visual roles × ferramentas com toggles |
| Equipe do Módulo | Gerencia coord_admin / subadmin / membro_equipe |
| Integrações | Campo API WhatsApp (desabilitado até implementação futura) |

---

## 7. Fora de Escopo (v1)

- App mobile nativo
- Integração WhatsApp / agente IA (estrutura preparada, não implementada)
- Notificações push
- Relatórios exportáveis em PDF/Excel
- Múltiplos módulos pastorais além de Acólitos (arquitetura preparada, outros módulos em ciclos futuros)
- Escala automatizada por IA (a montagem é manual assistida por filtros e sugestões)
