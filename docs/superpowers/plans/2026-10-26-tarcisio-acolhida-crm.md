# Tarcísio: acolhida e CRM — Implementation Plan

**Goal:** acompanhar novos membros no WhatsApp e CRM com catequese terça/quinta18h, escolha de contato por idade e marcos confirmados da túnica.
**Architecture:** módulo isolado do robô, funções puras para destinatário/agenda/conteúdo, estado persistente e RPCs atômicas. Fila de envio atual, com validação de destinatário/etapa antes de enviar. Assistente recebe ferramentas limitadas de consulta/registro. CRM existente expõe pausa, estado e histórico.
**Tech Stack:** NodeESM, SupabasePostgres, Evolution, Anthropic existente; sem novas dependências.
**Spec:** docs/superpowers/specs/2026-10-26-tarcisio-acolhida-crm.md

## Restrições
12anos completos + próprio WhatsApp confirmado → jovem; caso contrário responsável confirmado. Sem número/idade confiável, abrir pendência. Não criar vínculos por IA. Sem admissão/aptidão/nível automáticos. CostureiraRaquel5519991958657; negociação direta família. Prazo30-45dias só após pedido confirmado.14 encontros, somenteterça/quinta18h, sem duplicata, pausa respeitada. Nunca reativar18integrados. Não enviar a famílias antes das provas. Cópia do robô em produção conferida, sem divergências nos módulos.mjs.

## Tarefas
- [ ] Testes e núcleo puro: idade, contato, colisões, horárioSP, evolução, prova de fato explícito,14 conteúdos com fontes oficiais.
- [ ] Banco: configuração, acompanhamento, ligação à fila; RLS/roles, transições e entrega atômicas, histórico/comentários.
- [ ] Robô: preparar/validar/consolidar filas e interação com assistente, pausa, expiração e falha sem repetição ambígua.
- [ ] CRM: resumo/controle no fluxo existente, histórico, navegação e responsividade.
- [ ] Provas integradas e prévia ao dono; publicação isolada e ativação verificada.

## Revisão
Números partilhados por famílias; aniversário no limite11/12; resposta negativa/hipotética não vira fato; reinício na janela de envio; contato alterado após agendamento. Interromper formação ao integrar, sem admitir formação concluída por simples envio.
