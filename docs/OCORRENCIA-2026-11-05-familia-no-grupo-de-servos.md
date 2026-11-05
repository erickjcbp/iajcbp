# Ocorrência de 05/11/2026 — famílias dentro do grupo de Acólitos

**Registrada a pedido do dono. Estado: corrigida no código; reconferência das fichas aguardando a reconexão do
WhatsApp.** (Este arquivo não traz nomes nem números de famílias, de propósito: os nomes estão na conversa do
dono e no banco.)

## O que aconteceu
No grupo de WhatsApp dos Acólitos (72 participantes na leitura de 05/11) havia **5 números de família** de
servos: 3 responsáveis, 1 mãe e 1 contato de recado. O grupo é só dos servos; família entra no grupo de **Pais**.

Decisão do dono (05/11): 3 responsáveis saem; 1 contato de recado fica (exceção de propósito); a mãe que entrou
a pedido dela em 04/11 ("colocar o meu também, por enquanto", celular do filho quebrado — o Tarcísio respondeu
que incluiu os dois) também saiu da lista. Na leitura seguinte os números já estavam fora do grupo (alguém os
retirou antes do robô): 72 → 68 participantes. O número do grupo que aparecia sem ficha é o **próprio Tarcísio**.

## Quem colocou — o que se sabe e o que não se sabe
- Não foi a sessão de 05/11: nenhuma chamada de adicionar/remover grupo foi feita nela (só leituras de lista).
- O robô tem três rotinas que adicionam gente a grupo sozinhas (`acolhida.mjs`, `contato-servos.mjs`,
  `validacao-contato.mjs`), cada uma com a sua conferência. Não é possível dizer qual colocou cada número: o log
  do Evolution não registra adição de participante.
- Três registros de validação foram fechados em lote em 04/11 às 17:01 com a nota "telefone próprio e entrada
  no grupo já confirmados" — **nota errada** (o número era do responsável). Corrigida em 05/11 em
  `tarcisio_validacao_contato`.

## Causas
1. **Cada rotina conferia por conta própria; não havia uma regra na porta do grupo.**
2. **A rotina de presença (`presenca-grupos.mjs`) escondia o problema.** Marcava `no_grupo_whatsapp` como
   verdadeiro se **qualquer** número da ficha (o do servo OU os da família) estivesse no grupo dos servos. Com a
   mãe lá dentro, a ficha do filho aparecia "no grupo" sem ele estar, e nenhum alerta disparava.

## O que foi feito
- **Trava na porta** (`tarcisio-robo/guarda-grupos.mjs`): só entra nos grupos de Acólitos e Cerimoniários um
  número que seja **telefone próprio de uma ficha** ou uma **exceção registrada**. Vale para as três rotinas e
  para qualquer outra futura. Falha fechada: sem conseguir ler as fichas, ninguém entra.
- **Exceções** (migration 148, tabela `tarcisio_grupo_excecoes`): a coordenação registra de propósito.
- **Presença corrigida:** servo e cerimoniário só contam pelo telefone **próprio**; servo sem telefone próprio
  não é cobrado no grupo dos servos (a família fica no de Pais).
- **Alerta:** a conferência de presença (de hora em hora) abre uma pendência para a coordenação quando acha número
  de família num grupo de servos (uma por número e grupo, enquanto aberta). Não escreve o número inteiro.
- **Notas de validação corrigidas** nos 3 registros.
- Testes: `guarda-grupos.test.mjs` (10) e `presenca-grupos.test.mjs` (15). Os testes antigos de presença
  **encodavam a regra errada** e foram reescritos.

## Pendente
- **Reconferir as marcas das fichas** (`no_grupo_whatsapp` etc.): a conferência forçada de 05/11 não rodou porque o
  WhatsApp do Tarcísio estava desconectado (abaixo). Roda sozinha, de hora em hora, assim que reconectar.
- **Uma ficha com `nome_mae` e `nome_pai` trocados** (nome masculino em `nome_mae`, feminino em `nome_pai`).
  Não foi alterada (dado de cadastro, não desta ocorrência): a coordenação confirma e corrige.

## Segunda ocorrência no mesmo dia — WhatsApp do Tarcísio desconectado
- Desconexão em **05/11/2026 20:37:25 UTC (17:37 em Brasília)**, 5 s depois do último envio da fila.
- Motivo registrado pelo Evolution: `401 · conflict · device_removed` — o **aparelho vinculado foi removido do
  lado do WhatsApp** (Aparelhos conectados, no celular do Tarcísio). Não é falha do robô.
- Efeito: nada sai nem entra pelo Tarcísio; 21 envios ficaram pendentes.
- Para religar é preciso ler um QR com o celular do Tarcísio (Aparelhos conectados → Conectar um aparelho).
