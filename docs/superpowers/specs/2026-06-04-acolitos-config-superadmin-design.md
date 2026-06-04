# Submódulo de Configuração (superadmin) — Acólitos JCBP

**Data:** 2026-06-04
**Projeto:** iajcbp / Acólitos e Coroinhas (`projetos/acolitos/`)
**Objetivo:** Centralizar num único painel as configurações hoje espalhadas/hardcoded, tornando o app altamente customizável sem reescrever cada tela. Acesso restrito ao superadmin.

---

## 1. Princípio central: override com fallback

O código mantém os valores atuais como **PADRÃO**. Um `loadConfig()` no `shared.js` (chamado junto/depois do `loadListasCustom()`) carrega a config do banco e **sobrescreve os globais**. Sem dados no banco, o app se comporta **exatamente como hoje** — nada quebra. Cada seção é ligada incrementalmente.

Invariante: `valorEfetivo = configDoBanco ?? padraoDoCodigo`.

## 2. Modelo de dados

### 2.1 `acolitos_config` (nova)
```
chave        text primary key
valor        jsonb not null
updated_at   timestamptz default now()
updated_by   uuid
```
RLS:
- **SELECT**: `auth.role() = 'authenticated'` (o app precisa ler pra aplicar).
- **ALL (escrita)**: só superadmin — via função `acolitos_is_superadmin(auth.uid())` (security definer) que compara o username da conta com a lista `superadmins` salva na própria `acolitos_config` (default `['erickmartins','erickmartinsadmin']`).

Chaves previstas (jsonb):
- `superadmins` → `["erickmartins","erickmartinsadmin"]`
- `gerador` → `{ janela_dias:42, kit_leve:{comunidade:"santo_antonio", funcoes:["cruz","vela"], idade_min:7}, aleatorio:true }`
- `comunidades` → `[{slug,label,horarios:["17h","7h","9h","19h"]}, ...]`
- `cadastro_campos` → `{ data_nascimento:true, telefone:true, ..., foto:true }`
- `identidade` → `{ nome, paroquia, logo_url, cor_primaria, cor_ouro }`

### 2.2 `acolitos_listas` (já existe — reaproveitar)
Padrão atual: `tipo`, `valor`/`label`. Novos `tipo`s:
- `tipo_celebracao` (slug + rótulo)
- `funcao` (slug + rótulo + categoria + eh_maior + ordem — guardar extras num jsonb ou colunas; ver §2.3)
- existentes: `habilidade`, `competencia`, `setor`, `motivo` (ausência)

### 2.3 Nota sobre `funcao`
Função precisa de mais que rótulo: `categoria`, `eh_maior`, `ordem`. **Decidido:** estender `acolitos_listas` com uma coluna `meta jsonb default '{}'` (migração leve) e guardar `{categoria, eh_maior, ordem}` ali. Vale também pra futuros metadados de outras listas. Sem tabela nova.

## 3. Gate de superadmin

- `acolitos_is_superadmin(uid uuid) returns boolean` (security definer): pega o e-mail sintético da conta → extrai username → verifica se está em `acolitos_config['superadmins']`.
- Frontend `isSuperadmin(ctx)`: mesma checagem em JS (username da conta logada ∈ lista carregada por `loadConfig`).
- Nav: item **Config** só renderiza se `isSuperadmin(ctx)`. Página `config.html` redireciona se não for.

## 4. `config.html`

Layout: **menu lateral de seções** + painel principal. Cada seção é um editor CRUD isolado (uma função `renderSecaoX(container)`), comunicando só via leitura/escrita em `acolitos_config`/`acolitos_listas`. Topbar no padrão do projeto (`renderHeader`).

## 5. As 8 seções (Fase 1)

1. **Identidade da pastoral** — form: nome, paróquia, logo/brasão (upload), cor primária, cor ouro. Aplica tema injetando variáveis CSS em runtime (`document.documentElement.style.setProperty`). *Maior risco (tema) → construir por último.*
2. **Tipos de celebração** — CRUD lista (`tipo_celebracao`). **Pré-requisito:** relaxar/derrubar o check constraint de `acolitos_celebracoes.tipo` (já foi parcialmente feito em migrações anteriores; garantir que aceita qualquer slug). Alimenta `TIPO_LABEL` e o select de criar celebração.
3. **Funções litúrgicas** — CRUD com `rótulo · categoria · eh_maior · ordem`. Alimenta `FUNCAO_LABEL`, `FUNCOES_MAIORES`, `FUNCOES_ORDER`. **Pré-requisito:** check constraint de `acolitos_escalas.funcao` já foi derrubado (migração 028).
4. **Listas customizáveis** — sub-abas: habilidades, competências, setores, motivos de ausência. Usa o padrão `.mini-add/.mini-del` já existente.
5. **Regras do gerador** — form sobre `config['gerador']`: janela do rodízio, kit leve (comunidade+funções+idade), aleatório on/off. O gerador (`escala.html`) e a regra do kit (`elegivelFuncao`) passam a ler de `config` com fallback.
6. **Comunidades & horários** — editor de `config['comunidades']` (slug, label, horários). Alimenta criação de celebração (horários) e o `dispMap`/gerador. Cuidado: mudar slug de comunidade não deve quebrar dados existentes — slug é estável; só label/horários editáveis livremente.
7. **Campos do cadastro** — checkboxes sobre os campos candidatos + foto. Salva em `config['cadastro_campos']`. `camposIncompletos()` passa a ler quais estão ativos (fallback: todos ativos, como hoje).
8. **Admins & superadmin** — lista membros com papel coord_admin/subadmin; promover/rebaixar via `apiPost sync_role` (já existe). Gerencia os usernames de `config['superadmins']`. Leitura: `pastoral_members` + `acolitos_membros`.

## 6. Pontos de integração (onde o override é aplicado)

- `shared.js`: `loadConfig()` + sobrescreve `TIPO_LABEL`, `FUNCAO_LABEL`, `NIVEIS`?(fora da fase 1), `MOTIVOS`, comunidades, `CAMPOS_OBRIGATORIOS`, identidade/tema. `isSuperadmin`. Nav (item Config).
- `escala.html`: `FUNCOES_MAIORES`, `FUNCOES_ORDER`, janela do rodízio (`carregarCargaHistorica`), `elegivelFuncao` (kit) passam a ler de config com fallback.
- `membros.html`: `MODULOS_LIBERAVEIS` e a aba Acessos continuam; a seção Admins do Config é uma visão consolidada (não substitui a ficha).
- Criação de celebração (escala.html): horários e tipos vêm de config.

## 7. Ordem de construção

1. Migração `acolitos_config` + `acolitos_is_superadmin` + (se preciso) `meta jsonb` em `acolitos_listas` + relaxar constraint de tipo.
2. `loadConfig()` + `isSuperadmin()` + nav + `config.html` (shell + menu lateral).
3. Seções de baixo risco: Listas → Tipos → Funções → Campos do cadastro → Regras do gerador → Comunidades/horários → Admins.
4. Identidade/tema (CSS) por último.

## 8. Riscos e mitigação

- **Tema (cores) em runtime**: aplicar via CSS variables com fallback; testar dark/light. Risco médio → último.
- **Override de globais**: cada constante vira "config ?? padrão"; se `loadConfig` falhar, fallback total ao código (try/catch).
- **Constraints de tipo/função**: garantir relaxadas antes de liberar CRUD.
- **Concorrência de edição**: superadmin único na prática; `acolitos_config` por chave (edições de chaves diferentes não colidem).
- **Não-superadmin**: gate no nav + redirect em `config.html` + RLS de escrita (defesa em profundidade).

## 9. Fora de escopo (fases futuras)

Modelos de celebração (centralizar — hoje em Escala), Níveis/Jornada, Etapas do CRM, Categorias da Tesouraria, Casas (atalho), Export/backup. Cada um vira seção nova depois, no mesmo `config.html`.

## 10. Critérios de sucesso

- Só superadmin vê e abre o Config (nav + página + RLS).
- Cada seção edita e o efeito aparece no app (ex.: novo tipo de celebração aparece no select; nova função entra no gerador; campo do cadastro deixa de ser exigido).
- Sem config no banco, o app é idêntico ao atual.
