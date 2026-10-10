# Novena e recorrência — 10/10/2026

## Aplicado no Supabase Coroinhas

Projeto `fttjgsotuosjfrasttds`. Migração `novena_local_e_outras_comunidades` aplicada. A restrição de celebrações agora aceita `outras_comunidades`, como configurado pelo dono, além de Matriz/Santo Antônio e o legado `outra`.

As três celebrações de 12/10 já existiam e estavam sem escalas. Registros e IDs mantidos. As de 7h e 11h foram vinculadas ao modelo específico `aparecida_12_outubro`: 23 vagas, incluindo 10 apoios. A de 8h30 passou a usar o modelo `solene|outras_comunidades` já criado pelo dono: 7 vagas (dois cerimoniários, missal, turíbulo, naveta e dois altares). Observações indicam `Local: Morro Alto`.

A RPC pública retorna as três missas em ordem, vagas e `local_nome = Morro Alto` para 8h30. Inscrição em Altar, troca para Missal e saída passaram nas três celebrações dentro de transação com ROLLBACK. Nenhum participante ficou inscrito pelo teste.

## Recorrência

Marca `celebracoes_geradas_ate.ate = 2026-12-04`; `updated_at = 2026-10-09T11:41:17.110Z` (8h41 Brasília). Grade conferida por data, minutos e comunidade. Não há lacunas até a marca. Na janela de hoje + 56 dias faltam apenas 05/12 às 17h (Matriz) e 18h30 (Santo Antônio), além da marca anterior; devem entrar na próxima execução.

Isso comprova abastecimento remoto, mas não identifica por si só uma chamada agendada. Logs Vercel ainda não consultados. Não foi disparado cron-crm, pois ele também envia avisos da CRM.

## Código local e limites

398 testes de regras passaram na preparação. Após ajuste ao slug real do banco, sintaxe das duas páginas e nomes dos locais conferidos. A verificação de tela falhou por restrição do ambiente (`listen EPERM` em 127.0.0.1); não há fotos atuais.

Página pública e seletores foram corrigidos localmente, mas NÃO publicados. A página atualmente publicada ainda fixa “Matriz” nos cards. Git remoto inacessível pelo terminal: `Could not resolve host: github.com`. Integrações GitHub e Vercel ainda não confirmadas nesta sessão. BUILD do service worker atualizado no commit preparado para publicação.

Advisors executado: nenhum aviso de search_path para a RPC alterada. Avisos de execução SECURITY DEFINER pública correspondem ao fluxo público já existente; extensão unaccent e configuração de senhas não foram alteradas nesta tarefa.
