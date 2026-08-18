# Configuração arrumada — desenho

O dono disse: *"nas configurações, está horrível, acredito que tenha coisa redundante também"*.
Tem. Medi em 18/08/2026.

## O que está lá hoje

**15 seções soltas**, numa lista sem agrupamento nenhum: Identidade, Navegação, Equipe &
Permissões, Tipos & Modelos, Funções litúrgicas, Regras do gerador, Comunidades & horários,
Campos do cadastro, Categorias da Tesouraria, Etapas do CRM, Níveis / Jornada, Competências,
Missões & XP, Logins, Admins & superadmin.

**Seis delas são o MESMO editor**, copiado, mudando só uma palavra por dentro — todas gravam
em `acolitos_listas`, que é uma tabela só com `tipo`, `valor`, `label` e `meta`:

| Onde está hoje | Lista que edita | Tamanho |
|---|---|---|
| Config › Competências | `competencia` (+ `habilidade`) | 26 linhas |
| Config › Tipos & Modelos | `tipo_celebracao` | 18 linhas |
| Config › Funções litúrgicas | `funcao` | 41 linhas |
| Config › Categorias da Tesouraria | `cat_entrada` + `cat_saida` | 23 linhas |
| Config › Equipe & Permissões (escondido lá dentro) | `setor` | 108 linhas |
| **Ausências › fim da tela** (fora do Config!) | `motivo` | ~25 linhas |

**Duas delas têm um campo a mais, e é por isso que unificar cego perderia função:**
- **Funções litúrgicas** tem a marca **Maior/Menor** (função maior reserva cerimoniário). Ela
  **não** fica na lista: fica em `acolitos_config`, na chave `funcoes_maiores`, como um array de
  slugs, salvo num botão "Salvar funções maiores" separado.
- **Setores** tem a **responsabilidade do time** (texto longo), que também não fica na lista: fica
  em `acolitos_config`, chave `responsabilidades`, como um objeto `{slug: texto}`.

**A coluna `meta` de `acolitos_listas` existe e está vazia em todas as linhas** (`meta={}`).
É o lugar natural desses campos extras, e ninguém usou.

**Três lugares decidem quem pode o quê:** Equipe & Permissões, Logins (usuário/senha) e
Admins & superadmin.

## O que muda

### 1. Um editor de listas só

Uma seção **Listas** com um seletor de qual lista editar. As oito listas passam a morar no mesmo
lugar, com o mesmo comportamento: criar, renomear, remover, e o campo extra quando a lista tiver um.

O que cada lista é, em português, aparece junto — hoje "Competências" e "Funções litúrgicas" são
a mesma coisa por dentro (`habilidade` e `funcao`) e ninguém adivinha isso pela tela.

**O campo extra é declarado por lista, não espalhado pelo código.** Uma tabelinha diz: a lista
`funcao` tem um interruptor "Maior"; a lista `setor` tem um texto "Responsabilidade". Acrescentar
um campo a outra lista passa a ser uma linha nessa tabela.

**Onde os extras passam a ser gravados:** continuam em `acolitos_config` (`funcoes_maiores` e
`responsabilidades`), **sem migração de dado**. Mover para `meta` seria mais bonito e exigiria
migrar o que já está gravado e mexer em quem lê — `shared.js` lê `funcoes_maiores` para o gerador.
Não vale o risco nesta frente; fica anotado como possível arrumação futura.

### 2. Os motivos de ausência voltam para casa

O editor de `motivo` sai do fim da tela de Ausências e entra na seção Listas. Quem procura onde se
edita uma lista procura no Config — hoje essa uma está num lugar que ninguém adivinha.

### 3. As seções agrupadas

De 15 botões soltos para quatro grupos com título:

- **A paróquia** — Identidade, Comunidades & horários, Listas
- **As pessoas** — Equipe & Permissões, Admins & superadmin, Logins, Campos do cadastro
- **Como o app funciona** — Navegação, Regras do gerador, Níveis / Jornada, Missões & XP
- **Os módulos** — Tesouraria, CRM, Modelos

O agrupamento é só visual: **nenhuma seção some, nenhum id muda.** Os ids são contrato com
`acolitos_config` e com quem salvou uma ordem de navegação.

## O que NÃO entra

- Mover os extras de `acolitos_config` para `meta` (exigiria migrar dado e mexer no gerador).
- Unificar os três lugares de acesso (Equipe, Logins, Admins). São coisas diferentes por baixo —
  permissão de módulo, credencial de login e papel de administrador — e juntá-las às pressas é
  como a Caixa ficou confusa. Fica para uma frente própria, se incomodar depois de agrupadas.
- Qualquer mudança no que as listas significam para as outras telas.

## Como se prova que funcionou

1. **As oito listas continuam editáveis e gravando no mesmo lugar.** Para cada uma: criar um item,
   ver aparecer, remover, e conferir na tela que consome (uma competência aparece na ficha do
   membro; um tipo de celebração aparece na Escala; um motivo aparece na Ausência).
2. **Os dois campos extras não se perdem.** A marca Maior de uma função e a responsabilidade de um
   time continuam salvando e sendo lidas por quem já as lê (`shared.js`, gerador, aba Tarefas).
3. **Toda consulta e toda gravação lê o `error`.** Já há um caso provado aqui: a consulta dos
   setores devolvia lista vazia numa falha, indistinguível de "não há time cadastrado".
4. **A tela é verificada executando o `init()`**, com sessão simulada — e o Config exige superadmin,
   então o harness precisa aprender a simular isso (hoje não simula; ficou registrado na frente E).
5. **Nenhum id de seção mudou** — conferido contra o que está gravado em `acolitos_config`.

## Faseamento

- **Fase 1** — o editor de listas único, com as oito listas e os dois campos extras, substituindo
  as cinco seções do Config. A de Ausências continua no lugar por enquanto.
- **Fase 2** — o `motivo` migra para lá e o editor sai da tela de Ausências.
- **Fase 3** — o agrupamento das seções.
