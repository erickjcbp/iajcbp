# Caixa e Ausências — separar duas telas que hoje são uma

**Data:** 2026-08-17
**Projeto:** Acólitos (iajcbp)
**Escopo:** Dividir `ausencias.html` em duas telas com trabalhos distintos, juntar os três botões de ausência do menu da Escala numa porta só, e mudar o "Faltar" do membro para dentro das Escalas dele.

Decisões do dono, tomadas no brainstorming de 17/08:

1. **Caixa fica só com pendências**; Ausências vira tela própria. *(descartado: a Caixa abrigar tudo em seções, ou em abas no topo, ou só juntar os botões sem mexer na Caixa)*
2. **Ausências tem duas abas** — "Avisos de ausência" e "Faltas". *(descartado: lista única etiquetada; eixo por pessoa; jogar Faltas para dentro da Frequência)*
3. **Caixa sem pendências mostra "Tudo em dia" e mais nada.** *(descartado: resumo do fim de semana, atalhos de ação, histórico de decisões)*
4. **O membro informa ausência por um botão dentro da aba Escalas.** *(descartado: botão em cada card da missa; os dois juntos)*

---

## Contexto verificado (17/08/2026)

Números reais de produção:

- **913 ausências registradas** — e **todas as 913 são de uma missa específica**. Nenhuma é de dia inteiro, embora o código trate os dois casos (`celebracao_id is null`, em `escala.html:551`, `escala.html:860` e `ausencias.html:560`). É um caminho vivo no código e morto no uso.
- **Escalas por status:** 456 presente, 219 escalado, **214 ausente**, 59 substituído, 20 atrasado. As "faltas" que a tela mostra saem daí, pela RPC `acolitos_faltas_recentes`.
- **Solicitações:** 16 no total, todas já decididas (11 candidaturas aprovadas, 3 canceladas, 1 negada, 1 troca coberta). A fila de aprovações passa a maior parte do tempo **vazia** — o que torna a decisão 3 (o estado "Tudo em dia") a tela mais vista, não a exceção.
- **41 dos 176 membros ativos têm login.** O "Faltar" da barra é para esses 41; os outros 135 avisam pela página pública ou pela coordenação.

### A tela de hoje tem dois públicos no mesmo arquivo

`ausencias.html` (827 linhas) decide, no `init()`, se desenha `renderViewEquipe` (a Caixa) ou `renderViewMembro` (o "Faltar"). O comentário no código registra a consequência:

> *"Esta tela é a única do app com dois públicos no mesmo arquivo: todo membro precisa dela pra informar ausência. Não troque isto por `initModulo({perm:'caixa'})`."*

É daí que vem boa parte da confusão que o dono relatou: a mesma tela é a caixa de decisões de 4 coordenadores e o formulário de aviso de 41 membros.

### Os três botões não são redundantes — são três coisas

No menu **⋯ Mais** da Escala (`escala.html:167-172`):

| Botão | O que faz | Onde |
|---|---|---|
| 🚫 Ausências | lista as últimas 80 ausências **avisadas** | `abrirAusencias`, escala.html:1695 |
| ❌ Faltas | lista quem **não apareceu**, da chamada | `abrirFaltas`, escala.html:1717 (RPC) |
| 📅 Registrar ausência | formulário para a coordenação **criar** um aviso | `abrirRegistrarAusenciaCoord`, escala.html:1560 |

Tratam do mesmo assunto e ter três portas é confuso — mas **"avisou antes" e "não apareceu" carregam informações opostas**. Misturar apaga a diferença entre quem foi responsável e quem sumiu, que é o que alimenta a frequência de cada um. Daí a decisão 2 (duas abas, não lista única).

---

## O desenho

```
CAIXA (coordenação)  → caixa.html (novo)
    o que espera decisão: trocas · candidaturas · cobrir vaga ·
    avisos de ausência da página pública a confirmar
    sem nada pendente: "Tudo em dia" e mais nada
    + Enviar aviso (já mora aqui desde 17/08)

AUSÊNCIAS (coordenação)  → ausencias.html (reaproveitado; o nome passa a dizer a verdade)
    [ Avisos de ausência ]  quem avisou antes
    [ Faltas ]              quem não apareceu (da chamada)
    + Registrar ausência de alguém

ESCALAS (membro)  → escalas-membro.html
    ganha o botão "não poderei ir" — a view do membro sai de ausencias.html
```

**No menu ⋯ Mais da Escala:** os três itens viram **um** — 🚫 Ausências, que abre `ausencias.html`.
**Na barra do membro:** o item "Faltar" sai. Um item a menos para os 41 que têm login.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `caixa.html` | **novo** — só pendências + "Tudo em dia" + Enviar aviso |
| `ausencias.html` | perde a view do membro e o bloco de pendências; ganha as duas abas |
| `escalas-membro.html` | recebe o "não poderei ir" (a antiga `renderViewMembro`) |
| `navegacao-core.js` | id `caixa` aponta para `caixa.html`; id `ausencias` sai de `ITENS_JORNADA` |
| `escala.html` | três itens do menu Mais viram um |
| `acesso-core.js` | **novo** — regra pura de quem vê o quê (ver abaixo) |

Os **ids da barra são contrato** com `acolitos_config.nav_ordem_coord/jornada` — o id `caixa` é mantido, só o `href` muda. O id `ausencias` sai da lista do modo jornada; `ordenarPorConfig` já ignora id que não existe mais (`navegacao-core.js:58`).

---

## O ponto crítico: permissão

A separação **desfaz a premissa** do aviso citado acima — o membro deixa de precisar de `ausencias.html`. Isso libera trancar a tela, mas é exatamente onde um erro passa despercebido:

- **Equipe** (`EQUIPE_ROLES`): vê Caixa e Ausências, aprova, registra por outro.
- **Cerimoniário**: **registra ausência de outro** e vê a lista — a RLS já libera isso hoje (`ausencias.html:307`). Não aprova.
- **Membro comum**: não vê nenhuma das duas. Informa a própria ausência pelas Escalas.

Se o gate for `initModulo({perm:'caixa'})` na tela de Ausências, **o cerimoniário perde a função e ninguém é avisado** — a tela simplesmente não abre para ele. Este é o defeito mais provável desta mudança.

**Mitigação:** a regra vai para `acesso-core.js`, módulo puro testado em node (padrão de `navegacao-core.js`, `alertas-core.js` e `kits-core.js`), com um caso por papel × tela. Mais a verificação de tela real com as contas de equipe, cerimoniário e membro.

---

## O que NÃO muda

- `ausencias-publica.html` (página sem login) — intocada.
- As tabelas e a RLS — nenhuma migration. Só telas e navegação.
- O bloco de aprovação de trocas/candidaturas — muda de arquivo, não de comportamento.
- A Frequência continua onde está, no menu Mais.

## O que fica de fora, de propósito

- **Ausência de dia inteiro.** O código trata, o uso não usa (0 de 913). Não vou removê-la nesta mudança — remover caminho vivo exige medir mais do que uma contagem —, mas ela **não ganha lugar na tela nova**. Fica anotada como dívida.
- Eixo "por pessoa" na tela de Ausências (descartado na decisão 2).

---

## Como se prova que funcionou

1. **`acesso-core.js`**: testes em node cobrindo equipe, cerimoniário e membro comum contra as duas telas — incluindo o caso do cerimoniário, que é o risco declarado.
2. **Tela real, sem sessão**: carregar `caixa.html` e `ausencias.html` com a partida desligada e conferir o que desenham em 390px e desktop (técnica usada em 17/08 para os alertas e o Config).
3. **Estado vazio**: a Caixa sem pendências mostra "Tudo em dia" — é o estado mais comum (16 solicitações, todas decididas), então é o que precisa estar mais certo.
4. **Contrato da barra**: `navegacao-core.test.js` continua verde, e o id `caixa` segue existindo.
5. **Deploy conferido pela ponta**: baixar os arquivos do ar e comparar com os locais, mais o carimbo do `sw.js`.

## Faseamento

Uma frente por sessão, como é o hábito do projeto:

- **Fase 1** — `acesso-core.js` + `caixa.html` (a Caixa enxuta, com o estado "Tudo em dia").
- **Fase 2** — `ausencias.html` com as duas abas + o item único no menu Mais.
- **Fase 3** — o "não poderei ir" dentro das Escalas do membro + saída do item da barra.

A ordem importa: enquanto a Fase 3 não for ao ar, **o membro ainda precisa do caminho antigo** — então o item "Faltar" só sai da barra na última fase, e não antes.
