# Brasões e medalhões oficiais — aprovação de 01/11/2026

O dono aprovou explicitamente a família visual v19: “esses são os brasoes e medalhas oficiais”. O pacote definitivo fica em `projetos/acolitos/identidade-oficial/`, com hashes e recortes em `manifesto.json`.

## Formas dos brasões

- Aspirante: forma própria.
- Coroinha: forma própria.
- Acólitos: uma forma comum nos três níveis; evolução interna de camadas, reforços e acabamento.
- Cerimoniários: uma forma comum desde Aspirante a Cerimoniário até Mor; coroa do Mor como coroamento da mesma base.

Os dez centros aprovados permanecem: cruz, coroa, casinhas da vela com galhetas/linho/proteção, turíbulo apagado e livro aberto, primeiro incenso, turíbulo mais construído, estandarte e incenso, coroa e livro com pena. Não reintroduzir sino no Sentinela nem sineta no Cerimoniário Guardião. Não remodelar centros ou mudar contorno entre níveis de uma mesma família sem nova orientação.

## Medalhões de tempo

Cinco artes oficiais: Primeira Chama/bronze, Pilar do Tempo/prata, Raiz da Pastoral/ouro, Coluna do Altar/ônix e Veterano/rubi. Preservar os três primeiros e atlas superior refinado v5. O recorte do rubi aprovado é1692,112,480; não usar recorte antigo1675,105,495. Movimento aprovado: órbitas exclusivamente circulares, próximas da arte e progressivas; brilho sobre a própria transparência, sem faixa que revele recorte.

## Integração e automação

A implementação usa estes arquivos na Jornada, nos avatares, nas listas, na Escala e nas conquistas. Os PNGs originais são preservados; derivados WebP384×576 reduzem o conjunto dos dez brasões para aproximadamente520KB. O gerador de brasões ainda aceita uma especificação explícita para edição, enquanto a apresentação normal usa a identidade oficial.

Após ajuste pedido pelo dono, o avatar da Minha Jornada mede112/140/160/180px conforme a tela, com foto e informações lado a lado e sem altura mínima vazia. Casa, nível e tempo usam caixas quadradas iguais, de36%; o medalhão tem ajuste óptico interno. Anel e luz seguem o nível; órbitas seguem o marco de tempo. O feixe giratório atrás dos brasões foi restaurado; órbitas dos medalhões ficaram mais leves, com apenas uma no avatar. Movimento reduzido é respeitado.

A migração130 separa instalação e ativação. A ativação exige cliente publicado: `update acolitos_tempo_config set ativo=true,ativado_em=now() where id; select acolitos_tempo_processar();`. O processador é restrito ao serviço; o membro sincroniza somente seu cadastro, e avatares consultam uma lista limitada de marcos sem datas pessoais.

Novos cadastros recebem início na data local de cadastro quando a data não é informada. Membros/familiares não podem fabricar data antiga, nível, fonte ou indicador “ou antes” por INSERT/UPDATE. Perfil e cadastro continuam disponíveis; coordenação e RPCs administrativas conservam as alterações autorizadas.

Marcos:1/2/3/5anos valem30/40/50/70XP. Desde a migração132, Veterano exige mais de5anos (dia seguinte ao aniversário de5anos, migração132) e nível Cerimoniário Aspirante, Guardião, Magistral ou Mor (Aspirante a Cerimoniário não entra), com100XP. Não há promoção automática. O crédito e o aviso são únicos; datas históricas são preservadas e só aniversários dentro de uma temporada ativa contam nela. Concessão manual de tempo recebe XP uma vez. O cron existente verifica os marcos diariamente e a entrada no app também sincroniza.

## Evidências anteriores à publicação

- Suíte geral de telas:474/495, com as mesmas21falhas anteriores na Formação(5) e retiros(16), documentadas em `gestao-jornada-escala-medalhas-2026-11-01.md`. Nenhuma falha nova.
- 558 testes de regras passaram;93 testes de fluxos passaram; estabilidade da Escala passou nas4larguras.
- Prova `projetos/acolitos/provas/identidade-oficial.prova.mjs`: fotos360/390/768/1366/2560,3slotsiguais,hero,lote de avatares,invalidação durante consulta,recuperação offline e celebração com XP/círculos. Gestor de medalhas também aprovado nas5larguras.
- SQL130 aplicado duas vezes em rollback: catálogo sem duplicação e ativação preservada; créditos, datas, avisos, manual, níveis e autorização testados com papéis reais.
- Revisão independente identificou manipulação de elegibilidade por UPDATE/INSERT. A prova reproduziu a falha antes da proteção e passou depois, incluindo preservação de perfil/cadastro/coordenação.
- Ensaio retroativo com rollback:277concessões para128membros,10.400XP geral,940XP sazonal,277avisos. Segunda execução:0. Nenhum nível ou XP avulso alterado. Resultados de produção devem ser confirmados após ativação; este documento sozinho não comprova deploy.

## Consulta dos símbolos e avatares completos

Avatares de membros usam o mesmo componente na Agenda, Escala/Chamada, Jornada, Membros/fichas, Casas/Minha Casa, Destaques, Configuração e Tarefas. Listas parciais completam foto, nível e casa em lote com uma RPC limitada a esses dados visuais e a contas vinculadas ao app. Dados já informados pela tela prevalecem sobre cache antigo. Casa sem vínculo e medalhão ainda não conquistado não são inventados.

Toque no brasão de nível, no da casa ou no medalhão abre consulta com arte ampliada e explicação. O medalhão mostra os requisitos e as condições de posse do catálogo. O diálogo permite alternar os símbolos do avatar, respeita movimento reduzido, ocupa a tela do celular e restaura foco/rolagem ao fechar. Consultar não concede medalhas, XP nem dispara celebração.
