# Acólitos (iajcbp) — instruções do projeto

## AS CONTAS DESTE PROJETO — nunca trocar conta global

Esta máquina tem **três contas de GitHub** (`brenoov`, `erickjcbp`, `emsilva99`) e
**três contas de Vercel**, porque o dono toca vários projetos ao mesmo tempo e
costuma ter **mais de uma janela aberta**. Os Acólitos são da conta `erickjcbp`.

**Regra: NUNCA rodar `gh auth switch` nem `vercel switch`.** A troca é global e
derruba a outra janela, que pode estar em produção.

### GitHub → já está automático, não precisa fazer nada
- Repositório: `erickjcbp/iajcbp` · conta: `erickjcbp`
- Está gravado no `git config` **local** desta pasta um ajudante de credencial que
  busca o acesso da conta certa na hora do comando. `git push` e `git pull` comuns
  funcionam daqui seja qual for a conta ativa da máquina. Nenhum segredo em arquivo:
  ele lê do cofre do próprio `gh`. Como a regra é local, nenhuma outra janela sente.
- ⚠️ Se um dia precisar refazer, o `-c credential.helper=` **vazio** antes do
  ajudante é obrigatório: `credential.helper` é uma LISTA que acumula, e sem zerar a
  fila o `osxkeychain` responde PRIMEIRO, com a conta errada — e a linha falha
  idêntica a não ter feito nada.

### Vercel → sempre com `--global-config`
- Projeto: `iajcbp` · espaço: `erickjcbp-1650s-projects`
- ⚠️ A conexão interna (MCP da Vercel) está na conta do **iamundi**, não nesta.
  Ela responde `403 ... scope "erickjcbp-1650s-projects"` aqui. **Usar o CLI.**
- O login desta conta mora numa pasta só dele: `~/.vercel-iajcbp`
  ```
  vercel --global-config ~/.vercel-iajcbp ls iajcbp
  vercel --global-config ~/.vercel-iajcbp inspect <url>
  ```
- Sem o apontador, cai no login global (conta errada) e responde `Not authorized`.

### Sintoma que engana
Repositório privado + conta errada dá **`Repository not found`**, e não "sem
permissão" — parece repositório apagado ou renomeado, e não é. Antes de investigar
qualquer outra coisa, conferir a lista da conta dona:
`GH_TOKEN=$(gh auth token -u erickjcbp) gh repo list erickjcbp`

### Conferir se uma publicação aconteceu
`vercel inspect` **não imprime o commit**, e `ls` só dá a idade — que não prova
autoria. O que fecha a conta é casar a hora do envio com a hora da publicação:
`GH_TOKEN=$(gh auth token -u erickjcbp) gh api repos/erickjcbp/iajcbp/events \
  --jq '.[]|select(.type=="PushEvent")|"\(.created_at) \(.payload.head[0:7])"'`
O GitHub responde em UTC e o CLI da Vercel em hora local — lembrar dos 3 horas.
