# Fluxo pós-cadastro: família pula `novos.html` + melhorias do cadastro — Design

**Data:** 2026-06-10
**Projeto:** Acólitos (iajcbp)
**Status:** Design aprovado em brainstorming; aguardando revisão do spec.

## Problema

Depois que o responsável conclui o **wizard família** (`login.html` → "Meu filho(a) vai servir"), o filho, ao logar, é jogado para o **`novos.html`**, que **repete vários dados** já coletados — e ainda **duplicaria o membro** (o `novos.html` faz `insert` de um novo `acolitos_membros`).

### Causa raiz
- `shared.js` (linha ~137) redireciona para `novos.html` quando o usuário **não tem `pastoral_members`** (vínculo do módulo).
- O endpoint `api/signup-familia.js` cria `acolitos_membros` + `acolitos_crm`, mas **não** cria `pastoral_members`. Logo o filho é desviado para o `novos.html` antes de chegar à home.
- O mecanismo de "preencher só o que falta" **já existe**: `camposIncompletos()` + o pop-up **"Complete seu cadastro"** (`shared.js`) listam **apenas os campos vazios**. Ele só não é alcançado por causa do redirecionamento.

## Decisões (do brainstorming)

| Tema | Decisão |
|---|---|
| Filho cai no `novos.html`? | Não. `signup-familia` cria o `pastoral_members` (role `'novo'`) → filho vai para a **home**. |
| Pop-up "Complete seu cadastro" | Só **após aprovado** (etapa do CRM avançou de `aprovacao_cadastro`). Enquanto pendente, home mostra só o status "em análise" (já existe). |
| Celular do membro | Obrigatório se **> 12 anos** (≥ 13); opcional se ≤ 12. Contato principal continua o **celular da mãe**. |
| Ministros no `novos.html` | **Um** toggle "os pais são ministros" que **reaproveita** Nome do Pai e Nome da Mãe já preenchidos (sem o campo separado "Nome do Ministro"). |
| Regra de idade no pop-up | `telefone` exigido no `camposIncompletos` só se idade > 12. |

## Contexto técnico apurado

- **`shared.js`**
  - `buildContext` redireciona p/ `novos.html` se `!membership` (linha ~137).
  - `queueNotificacoes(membro)` (linha ~177) enfileira o pop-up de cadastro incompleto via `camposIncompletos` (linha 277-281), hoje **para qualquer membro** com campos vazios.
  - `CAMPOS_OBRIGATORIOS` (linha 614) inclui `telefone` com `padrao:true` (sempre exigido hoje). `camposIncompletos(membro)` (636) calcula os faltantes; `campoExigido(key, padrao)` (632) deixa o Config ligar/desligar cada campo.
- **`index.html`**
  - Para `role === 'novo'` (ou sem membership) chama `renderStatusCrm(ctx)` (linha 131) que mostra o status do CRM — ex.: "Seu cadastro foi recebido e está aguardando aprovação da coordenação." (linha 101). **Esse é o "ver a situação de cadastro".**
  - Etapas do CRM: `aprovacao_cadastro → integracao → whatsapp → tunica → disponivel_escala → integrado`.
- **`crm.html`**
  - Aprovar = avançar de `aprovacao_cadastro` para `integracao` (linha 117). O **`role` só muda na etapa final `integrado`** (linha 363-374) — então o sinal de "aprovado" **não** é o role, e sim **a etapa do CRM ter saído de `aprovacao_cadastro`**.
- **`novos.html`** (tela do "Eu vou servir", 342 linhas)
  - Blocos de membro: nome, nascimento, **celular (hoje sempre opcional, linha 181)**, comunidade, sacramentos, toggles.
  - Seção "Responsável": Nome do Pai (`r-pai`), Nome da Mãe (`r-mae`), Celular da Mãe (`r-cel-mae`), Celular de Recado, Endereço.
  - Toggle "Os pais são ministros extraordinários?" (`r-ministros`) revela **um** campo "Nome do Ministro (pai ou mãe)" (`r-ministro-nome`) + comunidade (`r-ministro-comunidade`).
  - `enviarCadastro()` (236) insere membro(s) + cria `pastoral_members` (role `'novo'`) p/ o 1º + cria CRM `aprovacao_cadastro`; ministros hoje gravam o **mesmo** `r-ministro-nome` em `nome_pai_ministro` e `nome_mae_ministro`.
- **`api/signup-familia.js`**: cria, por filho, conta Auth + `acolitos_membros` + `acolitos_crm`. **Falta** o `pastoral_members`.

## Componentes

### A. `api/signup-familia.js` — criar `pastoral_members` por filho

No laço de cada filho, após inserir o membro e antes/depois do CRM, criar o vínculo (service role, via PostgREST):
- Buscar o `module_id` do módulo `acolitos` uma vez (antes do laço): `GET /rest/v1/pastoral_modules?slug=eq.acolitos&select=id`.
- Por filho: `POST /rest/v1/pastoral_members` com `{ user_id: <authId>, module_id, role: 'novo' }` (upsert por `user_id,module_id` para idempotência).
- Incluir o `pastoral_members` no **rollback** (deletar junto se algo falhar depois).

### B. `shared.js` — gatear "Complete seu cadastro" até aprovado

- `camposIncompletos` continua igual (lista os faltantes).
- O **enfileiramento** do pop-up (linha 277-281) passa a exigir que o membro esteja **aprovado**: a etapa atual do CRM ≠ `aprovacao_cadastro` (e ≠ ausência de CRM por estar pendente).
- Como obter a etapa: o `buildContext`/`queueNotificacoes` carrega a etapa atual do membro:
  `GET acolitos_crm?membro_id=eq.<id>&select=etapa&order=etapa_iniciada_em.desc&limit=1`.
  - Etapa `aprovacao_cadastro` → **pendente** → **não** enfileira o pop-up.
  - **Sem entrada de CRM** → membro já estabelecido (ex.: os 174 importados) → comporta **como hoje** (enfileira normalmente). **Não suprimir.**
  - Qualquer outra etapa (`integracao`+) → **aprovado** → enfileira o pop-up (só faltantes).
- Mantém o `sessionStorage` 1x-por-sessão já existente.
- **Regressão a evitar:** não suprimir o pop-up de membro sem CRM (senão os importados nunca completam o cadastro).

### C. `shared.js` — `telefone` exigido só se idade > 12

- Helper `idadeAnos(data_nascimento)` (anos completos a partir de hoje; null se sem data).
- Em `camposIncompletos`, para a chave `telefone`: só considerar exigido se `idadeAnos(membro.data_nascimento) > 12`. (Mantém `campoExigido` do Config como gate adicional: exigido = config/padrão **E** idade > 12.)

### D. `novos.html` — celular por idade + reaproveitar nomes dos pais nos ministros

1. **Celular condicional por idade** (por bloco de membro):
   - Label dinâmico: "Celular do Membro" + sufixo "(obrigatório)" ou "(opcional)" conforme a data de nascimento do bloco (atualiza no `change` do campo de nascimento).
   - Na validação do `enviarCadastro()`: se `idadeAnos(nasc) > 12` e o celular do bloco estiver vazio → erro "Informe o celular do membro (13 anos ou mais)." Se ≤ 12 → segue opcional.
2. **Ministros reaproveitando nomes:**
   - Remover o campo "Nome do Ministro (pai ou mãe)" (`r-ministro-nome`). Manter o toggle `r-ministros` e o select de comunidade.
   - Ao marcar o toggle, o bloco expandido mostra apenas a **Comunidade onde serve** (e um texto: "Usaremos os nomes do pai e da mãe informados acima.").
   - No `enviarCadastro()`, quando `r-ministros` marcado: `tem_pai_ministro=true`, `nome_pai_ministro = r-pai`; `tem_mae_ministro=true`, `nome_mae_ministro = r-mae`; `comunidade_ministro = r-ministro-comunidade`. (Se um dos nomes estiver vazio, grava o respectivo `nome_*_ministro` como null e `tem_*_ministro=false`.)

## Fora de escopo (YAGNI)

- Reescrever/mesclar o `novos.html` com o wizard família (overlap existe, mas não será unificado agora).
- Mudar o fluxo de aprovação do CRM.
- Coletar celular no wizard família (segue sendo pedido depois, no "Complete seu cadastro").

## Critérios de sucesso

- Após o wizard família, logar com a conta de um filho leva à **home** (não ao `novos.html`); **nenhum membro duplicado**; status "aguardando aprovação" visível.
- Enquanto pendente, o pop-up "Complete seu cadastro" **não** aparece. Após a coordenação aprovar (etapa sai de `aprovacao_cadastro`), no próximo acesso o pop-up aparece pedindo **só os campos faltantes**.
- No `novos.html`: membro com 13+ anos exige celular; com ≤12 o celular é opcional.
- No `novos.html`: marcar "os pais são ministros" grava os nomes do pai e da mãe (já digitados) em `nome_pai_ministro`/`nome_mae_ministro`, sem pedir o nome de novo.
- No pop-up "Complete seu cadastro", o `telefone` só é cobrado de quem tem mais de 12 anos.
