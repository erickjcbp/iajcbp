# Tarefas dos times — desenho

**Data:** 2026-08-17
**Projeto:** Acólitos (iajcbp)
**Escopo:** Uma aba nova, **Tarefas**, no módulo de coordenação: o que cada time é responsável por, e o que cada time precisa fazer.

Decisões do dono, no brainstorming de 17/08:

1. A aba junta **duas coisas**: as tarefas do dia a dia de cada time, e as **responsabilidades fixas** — o que aquele time É responsável por, como referência. *(descartado: uma tela para distribuir os membros entre os times)*
2. Toda tarefa pertence a um **time (obrigatório)**; o **responsável é opcional**. Sem responsável, a tarefa é "do time".
3. A tarefa tem **prazo**, **feita ou não**, **observação** e **recorrência**. *(descartado: anexo de arquivo)*
4. **A recorrência entra já nesta primeira fase**, contra a minha recomendação de adiá-la — decisão do dono depois de eu levantar o custo.
5. Recorrência é **disparada pela conclusão**: marcou como feita, nasce a próxima. Nunca acumula. *(descartado: nascer em dia fixo, acumulando; e nascer em dia fixo vencendo a anterior)*
6. Frequências: **semanal, mensal, anual e "a cada celebração ou evento"**.

---

## Contexto verificado (17/08/2026)

Números reais, que reenquadram o pedido:

- **Os 11 times já existem.** Não é preciso criá-los: há uma lista `setor` em `acolitos_listas` (11 entradas) e um campo `setores` (array) em `acolitos_membros`. Os times são: Almoxarifado, Coordenação, Escala, Espiritualidade, Eventos e Viagens, Formação, Mídia, Ordem e Disciplina, Secretaria, Tesouraria e Compras, Vice-Coordenação.
- **Mas estão praticamente vazios: 4 pessoas de 176.** E são sempre as mesmas quatro (Gustavo Santana, Franciele, Erick Martins, Maria E. Carli), ocupando oito times. **Três times não têm ninguém**: Almoxarifado, Eventos e Viagens, Tesouraria e Compras — e o Almoxarifado foi justamente o exemplo que o dono deu.
- **Não existe nenhuma tabela de tarefas** (`acolitos_tarefas`, `acolitos_times`, `acolitos_setores`, `acolitos_equipes`: nenhuma existe).
- **Só 4 pessoas veem o modo coordenação**, porque `navMode` exige `eh_equipe` (`shared.js:1551`). Hoje as 4 em times são exatamente as 4 com esse acesso — coincidência que se desfaz no primeiro acólito colocado num time.

### A consequência que isso impõe ao desenho

O dono supôs que "os times têm o módulo coordenação liberado". **Hoje é verdade por acidente.** No dia em que um acólito entrar no Almoxarifado, ele **não verá a aba** — a não ser que seja marcado como equipe, o que lhe dá o resto do módulo de coordenação junto.

É o mesmo padrão que já mordeu duas vezes neste projeto: o portão correto e o caminho inexistente (o cerimoniário sem porta para a tela de Ausências; a Caixa alcançável só por um aviso que sumia quando estava tudo em dia).

**Este spec não resolve isso** — resolver exigiria mexer em como o app decide os dois modos, o que é outra frente. Mas registra: *a aba de Tarefas nasce visível para 4 pessoas, e o dia em que os times forem preenchidos de verdade, a visibilidade precisa ser revista.*

---

## O desenho

### A tela

Aba **Tarefas** no módulo de coordenação, com permissão própria `tarefas` — como Escala, Membros e Caixa. Quem não tem a permissão não vê o item na barra.

```
TAREFAS
  [atrasadas em destaque, de todos os times]

  ALMOXARIFADO
    responsabilidades: <texto fixo, editável>
    ▸ conferir estoque de velas     · vence sáb 23/08 · do time
    ▸ repor incenso                 · vence 30/08 · Gustavo

  FORMAÇÃO
    responsabilidades: <texto fixo, editável>
    ▸ preparar encontro de setembro · sem prazo · Franciele
```

Agrupado por time. As **atrasadas** sobem para o topo da tela, fora do agrupamento — é o que transforma a lista em acompanhamento em vez de anotação.

### A tarefa

| Campo | Regra |
|---|---|
| título | obrigatório |
| time | **obrigatório** — um dos 11 do Config |
| responsável | opcional; sem ele, a tarefa é "do time" |
| prazo | opcional; vencido destaca |
| observação | texto livre |
| concluída | quem concluiu e quando |
| recorrência | nenhuma, semanal, mensal, anual, ou a cada celebração |

### As responsabilidades fixas

Um texto por time, editável por quem tem a permissão. Não é tarefa: é o que aquele time **é**. Aparece no topo do grupo dele, e serve de referência para a pastoral.

### A recorrência

**Disparada pela conclusão, nunca pelo relógio.** Ao marcar uma tarefa recorrente como feita, nasce imediatamente a próxima, com o prazo calculado:

- **semanal / mensal / anual:** o prazo da concluída + o intervalo. Sem prazo na concluída, conta a partir de hoje.
- **a cada celebração:** a próxima celebração futura em `acolitos_celebracoes`. Sem celebração futura cadastrada, a nova nasce **sem prazo** — nunca com prazo inventado.

**Consequência aceita pelo dono:** se ninguém concluir, nenhuma nova nasce. Fica uma só, atrasada, cobrando. É o oposto de acumular, e foi escolha explícita.

**Por que não por robô:** o app já tem cron, mas recorrência por relógio precisa decidir o que fazer com a anterior não concluída — e as duas saídas (acumular ou vencer) foram descartadas. Disparar na conclusão elimina o robô e o problema junto.

---

## O que NÃO entra

- **Distribuir membros entre os times** (descartado na decisão 1). Continua se fazendo pela ficha do membro, em Membros.
- **Anexo de arquivo** (descartado na decisão 3).
- **Tarefa visível para quem não é coordenação.** Quem recebe uma tarefa só a vê se tiver acesso ao módulo — ver a ressalva acima.
- Mudar como o app decide o modo coordenação. Fica registrado como consequência, não como escopo.

---

## Como se prova que funcionou

1. **A regra da recorrência vira módulo puro testado em node** (`tarefas-core.js`), no padrão de `navegacao-core.js`, `alertas-core.js`, `kits-core.js` e `acesso-core.js`: dado uma tarefa concluída, qual é a próxima. Um caso por frequência, mais os de borda — sem prazo, sem celebração futura, recorrência nenhuma.
2. **A tela é verificada executando o `init()` com sessão simulada**, nos papéis que importam — e não apenas carregada. Carregar sem sessão não prova nada: o `init()` retorna antes de tocar no código (foi assim que 6 defeitos críticos passaram por três verificações nesta mesma data).
3. **O estado vazio é o primeiro a ser provado.** Nenhum time tem tarefa hoje; a tela sem tarefa nenhuma é a que a coordenação vai ver primeiro.
4. **Migration conferida contra as tabelas irmãs** antes de aplicar — RLS por papel, como as demais tabelas `acolitos_*`.

## Faseamento

Uma frente por sessão, como é o hábito do projeto:

- **Fase 1** — a tabela, a RLS e `tarefas-core.js` com a regra da recorrência testada.
- **Fase 2** — a tela: lista por time, atrasadas no topo, criar e concluir.
- **Fase 3** — as responsabilidades fixas por time, e a recorrência ligada de ponta a ponta.
