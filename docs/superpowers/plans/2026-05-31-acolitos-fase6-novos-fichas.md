# Acólitos — Fase 6: Fix do cadastro + abas Frequência/Evolução

**Data:** 2026-05-31 · **Projeto:** iajcbp

## Entregue

### A) Fix da perda de dados (`novos.html` + migration 006)
Antes: sacramentos, túnica e WhatsApp eram coletados mas NÃO salvos.
- **Migration 006**: novas colunas em acolitos_membros — batismo,
  primeira_eucaristia, crisma, tem_tunica, no_grupo_whatsapp, endereco,
  celular_mae, celular_recado. (Aplicada via MCP.)
- `novos.html`: passa a gravar todos esses campos; contatos viram colunas
  próprias (antes iam amontoados em observacoes).
- **Irmãos linkados**: vários filhos no mesmo cadastro agora viram irmãos
  entre si (tem_irmao_pastoral + irmao_id + escalar_com_irmao).

### B) Fichas completas (`membros.html`)
- **Pessoal**: passa a exibir contatos + sacramentos + túnica + WhatsApp.
- **Frequência**: ganhou gráfico de barras de presença dos últimos 6 meses
  (servidas vs faltas), além dos KPIs que já existiam (F3).
- **Evolução** (aba nova): jornada Aspirante→Cerimoniário, funções formadas
  (derivadas das habilitações apto+), funções em formação, e próxima etapa.

## Decisões
- "Funções formadas" derivadas das habilitações (sem nova tabela de formações).
- irmao_id é FK única: grupos de 3+ irmãos apontam para o primeiro (relação
  capturada de forma simplificada).

## Verificação
Sintaxe validada (node --check). 8 colunas confirmadas no banco.
