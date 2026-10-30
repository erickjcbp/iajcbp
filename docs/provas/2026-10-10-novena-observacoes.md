# Missas do dia 12 desapareciam após editar observações

Projeto Supabase confirmado: `coroinhasjcbp` (`fttjgsotuosjfrasttds`).

As três celebrações de 12/10/2026 tinham observações sem o prefixo `Novena`: `Nossa Senhora Aparecida` nas missas das 7h e 11h e `Morro Alto` na das 8h30. As três RPCs públicas usavam esse prefixo para identificar a novena. A RPC de listagem retornava `[]`. As sete inscrições das 8h30 continuavam no banco.

Aplicada a migração `novena_independente_das_observacoes`: coluna `novena_publica`, preenchida nas celebrações já marcadas como novena e nas três celebrações de 12/10 previamente configuradas. Listar, inscrever, trocar e sair aceitam a marca persistente, mantendo também o prefixo antigo para compatibilidade. Nenhuma escala, modelo, habilitação ou observação foi alterada pela migração. APIs, assinaturas, permissões e search_path preservados.

A prova `db/provas/novena_observacoes.sql` passou no banco: três missas visíveis, edição de todas as observações sem perder visibilidade, inscrição, troca e saída. Tudo dentro de transação com ROLLBACK. Comparação integral das escalas confirmou preservação dos registros originais.

Navegador sem login no link publicado: três cards (7h, 8h30, 11h), 8h30 lotada, nenhum erro JavaScript. Fotos em 390px, 768px, 1366px e 2560px em `/Users/erickmartins/projetos/iajcbp/materiais-paroquia/provas/2026-10/provas-novena-2026-10-10`; sem rolagem horizontal. Layout não foi alterado. A página publicada apresenta 8h30 como Outras comunidades, pois a observação atual não contém o campo textual `Local:` utilizado pela RPC.

Alteração aplicada diretamente no Supabase; não exige nova publicação Vercel.
