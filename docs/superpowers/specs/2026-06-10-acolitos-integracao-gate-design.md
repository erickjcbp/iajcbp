# Membro só "sobe" após concluir o CRM + recusar apaga tudo — Design

**Data:** 2026-06-10
**Projeto:** Acólitos (iajcbp)
**Status:** Design aprovado em brainstorming; aguardando revisão do spec.

## Objetivo

1. **Não disponibilizar** o membro recém-cadastrado na lista de membros nem na escala **enquanto ele estiver no funil do CRM**. Ele só "sobe" (aparece e fica escalável) quando a coordenação **conclui o ciclo** (etapa final `integrado`).
2. **Recusar** na 1ª etapa (`aprovacao_cadastro`) deve **apagar tudo do sistema** — membro, vínculo, CRM/histórico **e a conta de login (Auth)**.

## Decisões (do brainstorming)

| Tema | Decisão |
|---|---|
| Sinal de "ainda no funil" | Novo `status='em_integracao'` no membro (em vez de filtrar por role/CRM em cada tela). |
| Quando "sobe" | Na etapa **final `integrado`** do CRM → status vira `ativo`. (Não em `disponivel_escala`.) |
| Recusar (1ª etapa) | Apaga membro + vínculo + CRM/histórico **+ conta Auth** (remoção completa). |
| Onde fica a remoção da conta | Nova ação `reject` no `api/acolito-admin.js` (service role, gateado a coord_admin/subadmin + `podeMexer`). |

## Contexto técnico apurado

- **`acolitos_membros.status`**: `text default 'ativo'`, CHECK atual `('ativo','afastado','desligado')`.
- **Filtros operacionais já existentes** (`.eq('status','ativo')`): `membros.html` (lista + arquivados via `afastado`), `escala.html` (gerador/pickers), `casas.html`, `index.html`, `config.html`, `jornada-admin.html`, e o seletor de família no `shared.js`. → Qualquer status ≠ `ativo` **já some** dessas telas.
- **`crm.html`** carrega via `acolitos_crm` (join com `acolitos_membros`), **sem** filtrar `status='ativo'` → continua mostrando o membro em integração.
- **CRM**: etapas `aprovacao_cadastro → integracao → whatsapp → tunica → disponivel_escala → integrado`. O **role** só vira o real em `integrado` (`crm.html` `confirmarAvancar`, bloco `if (proximaEtapa === 'integrado')`).
- **`crm.html` `recusarCadastro()`** (linha ~301): só aparece em `aprovacao_cadastro`; hoje apaga `pastoral_members` + `acolitos_membros` (cascata limpa CRM), **mas não apaga a conta Auth**.
- **`api/acolito-admin.js`**: endpoint admin do módulo (service role), gateado a coord_admin/subadmin, com `podeMexer(targetUid)` (rank do alvo < rank do chamador; `novo`=1). Ações atuais: `create`, `get`, `sync_role`, `password`, `username`.
- **Onde membros nascem**:
  - `novos.html` `enviarCadastro()`: insere `acolitos_membros` (hoje sem status explícito → default `ativo`), cria `pastoral_members` role `novo`, cria CRM `aprovacao_cadastro`.
  - `api/signup-familia.js`: insere membro com `status: 'ativo'` (no `paisBase`) + CRM + (já) vínculo `novo`.
- **Acesso do próprio membro**: `shared.js` carrega o registro do usuário por `user_id` **sem** filtro de status → a home do membro em integração funciona normalmente.

## Componentes

### 1. Migration — status `em_integracao`
```sql
alter table acolitos_membros drop constraint if exists acolitos_membros_status_check;
alter table acolitos_membros add constraint acolitos_membros_status_check
  check (status in ('ativo','afastado','desligado','em_integracao'));
```
(Não altera nenhum membro existente; só amplia o domínio.)

### 2. Membro nasce `em_integracao`
- **`api/signup-familia.js`**: no `paisBase`, trocar `status: 'ativo'` por `status: 'em_integracao'`.
- **`novos.html` `enviarCadastro()`**: no objeto `mData`, adicionar `status: 'em_integracao'`.

### 3. Ao integrar → `status='ativo'` (`crm.html`)
- No `confirmarAvancar()`, dentro do bloco `if (proximaEtapa === 'integrado')`, **além** de atualizar o role, setar o membro: `update acolitos_membros set status='ativo' where id = membroId`.
- (Robustez: fazer o update de status mesmo que a atribuição de role dependa de permissão — a "subida" não deve depender de quem pode atribuir role. O `status='ativo'` é aplicado para todo avanço a `integrado`.)

### 4. Recusar apaga tudo (`crm.html` + `api/acolito-admin.js`)
- **Nova ação `reject` em `api/acolito-admin.js`**:
  - Recebe `membro_id`.
  - Busca o membro (`user_id`). Se houver `user_id`, valida `podeMexer(user_id)` (alvo deve ser de rank menor; `novo`=1 < coord/subadmin). Sem `user_id` (cadastro sem login), segue.
  - Apaga, na ordem: `pastoral_members` (por `user_id`+`module_id`), `acolitos_membros` (por id — CASCADE limpa `acolitos_crm`/histórico), e a **conta Auth** (`DELETE /auth/v1/admin/users/{user_id}`).
  - Retorna `{ ok:true }`. Em erro de FK (membro vinculado em escala), retorna mensagem clara (improvável para `novo`, mas tratado).
- **`crm.html` `recusarCadastro()`**: em vez de apagar pelo client, chamar `POST /api/acolito-admin` com `{ action:'reject', membro_id }` (Authorization: Bearer do coordenador). Manter o `confirm()` atual. Em sucesso, recarregar o CRM.

## Fora de escopo (YAGNI)
- Migrar membros já existentes em funil para `em_integracao` (após a limpeza não há nenhum; novos já nascem assim).
- Renomear/repensar a etapa `disponivel_escala` (continua existindo, apenas informativa).
- Recusar em etapas posteriores (o botão segue só em `aprovacao_cadastro`).

## Critérios de sucesso
- Cadastro novo (solo via `novos.html` ou via wizard família) cria o membro com `status='em_integracao'` → **não aparece** em Membros nem na Escala; **aparece** no CRM.
- Avançar o membro até `integrado` no CRM → `status` vira `ativo` → passa a aparecer em Membros e ficar escalável.
- O próprio membro, logado, acessa sua home e vê o status do CRM normalmente enquanto em integração.
- Recusar na 1ª etapa remove **membro + vínculo + CRM + conta Auth**; o usuário não consegue mais logar com aquele login.
- Membros existentes (`status='ativo'`) seguem inalterados.
