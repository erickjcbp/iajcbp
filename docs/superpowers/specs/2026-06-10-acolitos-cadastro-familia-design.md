# Cadastro "Quero servir": Eu vs. Meu Filho — Design

**Data:** 2026-06-10
**Projeto:** Acólitos (iajcbp) — tela `projetos/acolitos/login.html` (aba "Quero servir")
**Status:** Design aprovado em brainstorming; aguardando revisão do spec.

## Objetivo

Na aba **"Quero servir"** do login, oferecer dois caminhos de cadastro:

1. **"Eu vou servir"** — mantém o fluxo atual (nome + usuário + senha → `/api/signup-acolito`).
2. **"Meu filho(a) vai servir"** — novo wizard: coleta dados dos pais, cadastra **um ou mais filhos** (cada um vira um membro com conta própria), vinculados pela **conta de família** (`grupo_irmaos`) já existente. Qualquer conta de filho enxerga todos os irmãos para acompanhar a jornada.

## Decisões (do brainstorming)

| Tema | Decisão |
|---|---|
| Modelo de conta | **Uma conta por filho** (usuário = nome do filho). Pais não têm conta separada. Vínculo por `grupo_irmaos`. Dados dos pais gravados em cada filho. |
| Dados dos pais | Nome da mãe + nome do pai; telefone/WhatsApp de contato; qual responsável é o contato principal. (Sem e-mail.) |
| Credenciais | Usuário sugerido do nome de cada filho + **uma senha única** para todas as contas dos filhos. |
| Campos do filho | Nome (obrigatório), data de nascimento, comunidade. Resto fica para o cadastro no app + aprovação. |
| Escalar x ver | **Escalados juntos por padrão** (`escalar_com_irmao = true`) — reusa o seletor de família como está. Coordenação pode mudar depois. |
| Aprovação | Cada filho entra no CRM (`etapa='aprovacao_cadastro'`), igual ao fluxo solo. |
| Pais ministros | Toggles "mãe é ministra"/"pai é ministro" **reaproveitam** `nome_mae`/`nome_pai` (sem redigitar) → preenchem `nome_*_ministro`. Colunas já existem. |

## Contexto técnico apurado

- **Signup atual (`api/signup-acolito.js`):** cria **apenas** o usuário Auth (email sintético `usuario@coroinhas.jcbplimeira.com.br`, `email_confirm:true`, metadata `nome`). O registro `acolitos_membros` é inserido depois, **pelo próprio usuário logado** (RLS INSERT: `auth.role()='authenticated' AND user_id = auth.uid()`).
- **Implicação chave:** no fluxo família, cada filho tem `user_id` próprio. O responsável (logado como filho A) **não** pode inserir o membro do filho B via RLS. Portanto, **todos os membros + contas Auth dos filhos são criados server-side** com a service role.
- **Conta de família existente (`shared.js`):** se `conta.grupo_irmaos && conta.escalar_com_irmao`, carrega os irmãos do mesmo `grupo_irmaos` (já filtrando `status='ativo'`), monta `grupoIrmaos` e exibe o chip de troca de perfil. Setar `escalar_com_irmao=true` nos filhos faz isso funcionar sem alterar código.
- **CRM (`acolitos_crm`):** colunas `membro_id` (NOT NULL), `etapa` (default `'aprovacao_cadastro'`), `etapa_iniciada_em` (default now), `observacoes`.
- **`acolitos_membros`** já tem: `responsavel`, `celular_mae`, `grupo_irmaos`, `irmao_id`, `escalar_com_irmao`, `escalar_com_pais`, `data_nascimento`, `comunidade`, `status` (CHECK `ativo|afastado|desligado`), `telefone`, `telefone_whatsapp`. Os campos `*_ministro` são sobre pais que são ministros — **não** reusar para o contato geral.

## Componentes

### 1. UI — `login.html`, aba "Quero servir"

A aba abre com uma pergunta e dois botões:

```
Quem vai servir ao altar?
[ Eu vou servir ]   [ Meu filho(a) vai servir ]
```

- **"Eu vou servir"** → mostra o formulário atual (`screen-cadastro` como está hoje).
- **"Meu filho(a) vai servir"** → mostra o novo wizard `screen-cadastro-familia`, em 3 passos numa mesma tela rolável:

  **Passo 1 — Dados dos pais**
  - Nome da mãe (texto)
  - Nome do pai (texto)
  - Telefone/WhatsApp de contato (texto) + checkbox "é WhatsApp"
  - Contato principal: ( ) mãe ( ) pai
  - [ ] Mãe é ministra na paróquia?  [ ] Pai é ministro?
    - **Reaproveitamento de nomes:** ao marcar, NÃO pede o nome de novo — usa o `nome_mae`/`nome_pai` já preenchido acima. Se algum nome ainda estiver vazio, o campo correspondente fica desabilitado com a dica "preencha o nome acima primeiro".
    - Se qualquer um marcado, mostra um campo opcional **Comunidade dos ministros** (`comunidade_ministro`).

  **Passo 2 — Filho(s)**
  - Bloco repetível por filho: Nome completo · Data de nascimento · Comunidade (matriz/santo_antonio/outra)
  - Usuário sugerido exibido e editável (gerado do nome; ver §4)
  - Botão **"+ Adicionar outro filho"** (mínimo 1)

  **Passo 3 — Senha e confirmação**
  - Senha única (≥ 6) usada em todas as contas
  - Aviso: "Criaremos uma conta por filho. Qualquer uma enxerga todos os irmãos para acompanhar a jornada."
  - Botão **"Criar contas e continuar"** → `POST /api/signup-familia`

  Ao sucesso: mostra os **usuários criados** ("anote: joao.silva, maria.silva — senha que você definiu") e, após confirmação, vai para a aba **Entrar**.

### 2. Migration de banco

Novas colunas em `acolitos_membros`:
- `nome_mae text`
- `nome_pai text`
- `contato_principal text` com CHECK `contato_principal in ('mae','pai')` (nullable)
- `celular_responsavel text`
- `responsavel_whatsapp boolean default false`

(`responsavel` existente recebe o nome do contato principal por conveniência de exibição.)

### 3. Endpoint `api/signup-familia.js` (service role)

`POST` com body:
```json
{
  "senha": "…",
  "pais": { "nome_mae": "…", "nome_pai": "…", "celular": "…", "whatsapp": true, "contato_principal": "mae",
            "mae_ministra": false, "pai_ministro": false, "comunidade_ministro": "" },
  "filhos": [
    { "nome": "…", "usuario": "joao.silva", "data_nascimento": "2014-05-01", "comunidade": "matriz" }
  ]
}
```

Fluxo (service role key, `SUPABASE_SERVICE_ROLE_KEY`):
1. Validar: senha ≥ 6; ≥ 1 filho; cada filho com nome e usuário; comunidade ∈ conjunto válido.
2. Gerar um `grupo_irmaos` uuid (compartilhado por todos os filhos).
3. Para cada filho, na ordem:
   a. Resolver usuário final: se `synthEmail(usuario)` já existe no Auth, anexar sufixo numérico (`joao.silva2`, `joao.silva3`…). Retornar o usuário final.
   b. Criar usuário Auth (`email_confirm:true`, metadata `nome`).
   c. Inserir `acolitos_membros`: `user_id`, `nome`, `data_nascimento`, `comunidade`, `status='ativo'`, `grupo_irmaos`, `escalar_com_irmao=true`, `nome_mae`, `nome_pai`, `celular_responsavel`, `responsavel_whatsapp`, `contato_principal`, `responsavel` (= nome do contato principal). **Campos de ministro derivados (sem redigitar):** se `pai_ministro` → `tem_pai_ministro=true`, `nome_pai_ministro = nome_pai`; se `mae_ministra` → `tem_mae_ministro=true`, `nome_mae_ministro = nome_mae`; `comunidade_ministro` quando informado. (Colunas `*_ministro` já existem — sem migration.)
   d. Inserir `acolitos_crm` com `membro_id` e `etapa='aprovacao_cadastro'`.
4. **Rollback ao falhar:** se qualquer filho falhar no meio, desfazer os já criados nesta chamada (deletar membros + usuários Auth criados) e retornar erro indicando o filho problemático. (Operação não é transação SQL única por envolver Auth + REST; rollback é compensatório no handler.)
5. Resposta: `{ ok:true, usuarios:["joao.silva","maria.silva"] }`.

### 4. Geração do usuário sugerido (client + server)

- Cliente sugere a partir do nome: minúsculas, sem acento, espaços → ponto, remove caracteres inválidos (mesmo saneamento do `synthEmail`). Ex.: "João da Silva" → `joao.silva` (primeiro + último token).
- O servidor é a autoridade sobre colisão (sufixo numérico) e devolve o usuário efetivamente criado.

### 5. Aprovação (CRM)

Sem mudança no painel. Cada filho aparece como `aprovacao_cadastro`. Como compartilham `grupo_irmaos`, a coordenação os vê agrupados onde o app já agrupa irmãos.

## Fora de escopo (YAGNI)

- Conta/login próprio para o responsável.
- E-mail do responsável.
- Edição em massa dos filhos após criados (a coordenação/edição usa as telas existentes).
- Vincular filhos a uma família **já existente** no segundo cadastro (cada submissão cria um novo `grupo_irmaos`; reaproveitamento fica para depois).

## Critérios de sucesso

- Na aba "Quero servir", os dois botões aparecem; "Eu vou servir" mantém o fluxo atual intacto.
- "Meu filho vai servir" cria, em uma submissão, N contas de filho (N ≥ 1) com a mesma senha, mesmo `grupo_irmaos` e `escalar_com_irmao=true`.
- Logando com qualquer conta de filho, o chip de família aparece e troca entre todos os irmãos.
- Cada filho entra no CRM como `aprovacao_cadastro`.
- Colisão de usuário é resolvida com sufixo e o usuário final é mostrado ao responsável.
- Falha no meio não deixa contas órfãs (rollback compensatório).
