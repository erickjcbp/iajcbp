# Central JCBP — Design da Base

**Data:** 2026-05-23
**Projeto:** iajcbp
**Igreja:** Jesus Cristo Bom Pastor

---

## Visão Geral

Portal web responsivo que centraliza ferramentas digitais da Igreja Jesus Cristo Bom Pastor. Membros acessam as ferramentas liberadas para seu grupo. Admins gerenciam usuários, grupos, permissões e ferramentas com CRUD completo em tudo.

**Stack:**
- Frontend: HTML/CSS/JS (single-file por ferramenta, mesmo padrão do iamundi)
- Backend: Supabase (conta exclusiva iajcbp)
- Hospedagem: Vercel + GitHub (contas/organização exclusiva iajcbp)

---

## Autenticação

- Login por email + senha via Supabase Auth
- Sem magic link, sem OAuth
- Sessão gerenciada pelo Supabase Auth
- Rotas protegidas — usuário não autenticado é redirecionado ao login

**Fluxo de solicitação de acesso:**
1. Visitante clica em "Solicitar acesso" na tela de login
2. Preenche: nome completo, email, grupo de interesse, mensagem opcional
3. Tela confirma: "Solicitação enviada, aguarde aprovação"
4. Admin aprova → conta criada + email com senha temporária enviado ao solicitante
5. Admin rejeita → email de notificação enviado ao solicitante

---

## Usuários

**Campos:** nome, email, foto (opcional), grupo, status, nível de acesso

**Status:**
- `pendente` — solicitou acesso, aguarda aprovação
- `ativo` — acesso liberado
- `bloqueado` — suspenso sem exclusão

**Níveis de acesso:**
- `admin` — acesso total, gerencia tudo
- `lider` — gerencia usuários do próprio grupo
- `membro` — acessa apenas ferramentas liberadas para seu grupo

**Regras de segurança:**
- Admin não pode se autoexcluir
- Admin não pode rebaixar o próprio nível

**CRUD:**
- Criar, editar, excluir usuários
- Aprovar/rejeitar solicitações de acesso
- Bloquear/reativar sem excluir
- Mover usuário entre grupos

---

## Grupos

Representam os departamentos/ministérios da igreja.

**Campos:** nome, descrição, líder responsável, membros, ferramentas liberadas

**CRUD:**
- Criar, editar, excluir grupos
- Adicionar/remover membros
- Definir líder do grupo
- Associar/desassociar ferramentas

---

## Ferramentas

Cada ferramenta é um item cadastrado no sistema que aponta para uma funcionalidade.

**Campos:** nome, descrição curta, ícone, URL/rota, status (ativa/inativa), grupos com acesso

**CRUD:**
- Cadastrar, editar, excluir ferramentas
- Ativar/desativar sem excluir
- Gerenciar quais grupos têm acesso

---

## Telas

### 1. Login
- Campos: email, senha
- Link: "Solicitar acesso"

### 2. Solicitação de Acesso
- Campos: nome completo, email, grupo de interesse, mensagem (opcional)
- Confirmação na tela após envio

### 3. Central (Home)
- Cards das ferramentas liberadas para o usuário logado
- Cada card: ícone, nome, descrição curta, botão de acesso
- Membro vê só ferramentas do grupo
- Líder vê ferramentas do grupo + badge de gerenciamento
- Admin vê tudo + acesso ao painel administrativo

### 4. Painel Admin
Quatro abas com CRUD completo:

| Aba | Conteúdo |
|-----|----------|
| Usuários | Lista com filtro, aprovar pendentes, editar, bloquear, excluir |
| Grupos | Criar/editar/excluir grupos, gerenciar membros e líderes |
| Ferramentas | Cadastrar/editar/ativar/desativar ferramentas e permissões |
| Solicitações | Fila de pedidos pendentes com aprovar/rejeitar |

---

## Banco de Dados (Supabase)

**Tabelas principais:**

- `users` — gerenciada pelo Supabase Auth + perfil estendido
- `profiles` — nome, foto, grupo_id, nivel, status
- `groups` — id, nome, descricao, lider_id
- `tools` — id, nome, descricao, icone, url, ativo
- `group_tools` — group_id, tool_id (quais grupos acessam quais ferramentas)
- `access_requests` — id, nome, email, grupo_interesse, mensagem, status, created_at

---

## Identidade Visual

A ser definida após análise das imagens na pasta `midia/`. O design seguirá a identidade da Igreja Jesus Cristo Bom Pastor.

---

## Fora de Escopo (v1)

- App mobile nativo
- Notificações push
- Login social (Google, Facebook)
- Múltiplos admins com permissões granulares entre si
