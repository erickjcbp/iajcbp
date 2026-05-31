# Acólitos — Fase 4: Dashboard com gráficos + upload de foto do membro

**Data:** 2026-05-30 · **Projeto:** iajcbp · **Spec base:** seção 6.7 do design.

## Objetivo
Substituir o `index.html` cru (esqueleto) por dashboards reais, usando a view
`acolitos_frequencia` (F3) e os dados de celebrações/escalas. Gráficos feitos à
mão em SVG/CSS — sem dependências pesadas (princípio do spec).

## Entregue
- **`index.html` reescrito** (vanilla, single-file):
  - **Dashboard Membro:** avatar editável (membro sobe a PRÓPRIA foto — fecha a
    pendência da F3), KPIs reais (Frequência %, Missas servidas, Última missa via
    fetchFrequencia), jornada, minhas próximas escalas (query real, antes era
    placeholder), agenda da pastoral.
  - **Dashboard Equipe:** KPIs (ativos, freq. média, missas no mês, onboarding);
    3 gráficos à mão — presença/6 meses (barras), membros por nível (barras
    horizontais), cobertura próximas 4 semanas (donut SVG); painel de alertas
    (frequência baixa); agenda com badge de cobertura; acesso rápido.
- Roteamento por role mantido (novo → status CRM; membro → pessoal; equipe → operacional).

## Decisões
- Gráficos hand-rolled (SVG/CSS), sem Chart.js.
- Cobertura usa mínimo por comunidade (17 matriz / 8 Sto. Antônio) como denominador
  simplificado — alinhado ao dimensionamento do spec; cálculo fino por função fica
  na planilha de escala (F5).
- Lista de níveis derivada de pastoral_members (mesma semântica de membros.html).

## Verificação
Sintaxe validada (node --check). Visual: abrir como coord_admin → agenda e donut
já mostram as 43 celebrações semeadas; demais gráficos ganham dados conforme
chamadas/escalas forem registradas.
