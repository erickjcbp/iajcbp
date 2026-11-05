# Checkpoint para retomar no Codex — 30/10/2026

Estado: tudo commitado e publicado. `main == origin/main`, árvore limpa. Último commit: `72ffe36`.

## Contas e deploy (ler antes de qualquer push)
- GitHub: `erickjcbp/iajcbp`. Push comum funciona (ajudante de credencial local). Nunca rodar `gh auth switch` nem `vercel switch`.
- Vercel: projeto `iajcbp`, sempre `vercel --global-config ~/.vercel-iajcbp`. Push na `main` publica sozinho (domínio `https://coroinhas.jcbplimeira.com.br`).
- `sw.js` tem `const BUILD = 'AAAAMMDDHHMMSS'`; subir a cada publicação de tela.
- Banco: `SUPABASE_DB_URL` no `.env`; psql em `/opt/homebrew/opt/postgresql@17/bin/psql`. Migrations em `docs/migrations/NNN_*.sql`. Ensaiar em `begin; … rollback;` antes de aplicar. Função nova no `public` recebe EXECUTE para `authenticated` por padrão; `revoke from public` não basta (ver migration 120).
- Robô Tarcísio na VPS: `cd tarcisio-robo && VPS_USER=root ./implantar.sh` (container `wa-tarcisio-robo-1`, dir `/opt/whatsapp/tarcisio`). Testes: `node --test` (185/185).

## O que foi feito hoje
1. **Medalhas ordenáveis por data real** (commits `31d5f61`, `e19b514`, `b3af770`)
   - Migration 119: tabela `acolitos_badge_ganhos`, helper `_badge_data_ganho`, RPC `acolitos_badges_registrar`, `acolitos_badges_membro` devolve `ganho_em`.
   - Migration 120: helper sem acesso direto (vazava data derivada do nascimento).
   - `projetos/acolitos/conquistas.html`: seletor "Ordenar por" (padrão / mais recentes / A–Z), modal mostra "Conquistada em".
   - Limite: 869 conquistas de habilitação e `funcoes_aptas` não têm data; ficam depois das datadas, com aviso na tela. A data é a do primeiro acesso a Conquistas após ganhar.
   - Detalhes: `docs/conquistas-colecao-trofeus-2026-10-30.md`.
2. **Visual** (commits `e19b514`, `7cdba1c`, `cb85fcf`)
   - Todo `<select>` precisa de `className='form-input'`; o componente da casa (`escolha-app.js/css`) copia a classe para o botão. Sem ela fica branco com texto preto.
   - Jornada: abas renomeadas "Criar missões" e "Automático", com frase explicando cada uma.
   - Destaques: `.dest-tab` com `min-width:max-content !important` (regra global do `shared.css:421` forçava 44px e cortava o texto).
   - `bonus-semana.css`: campos de hora/data endurecidos para iOS, caixinhas douradas, aba a 320px.
3. **Segurança do repositório** (`dfc4bd8`): `.gitignore` + `.vercelignore` bloqueiam `/historico-tarcisio/`, `/materiais-paroquia/`, `/publicacoes/`, `/estudos/`, `/docs/encontros-nov-2026/` (nomes e telefones de menores). A raiz inteira é publicada como site; nunca commitar essas pastas.
4. **Caminhos** (`28e2419`): `~/arquivos` reescrito para `~/projetos/iajcbp` em provas e docs.
5. **Tarcísio, despedida** (`72ffe36`)
   - Problema: "obrigada", "ok", "amém", 👍 soltos recebiam "Em que posso ajudar hoje?" (a IA inventava).
   - `regras.mjs`: `ehDespedida(texto)`. `assistente.mjs`: `jaConversou(numero)` (saída nos últimos 3 dias); se todas as pendentes são despedida e já conversou, marca atendida sem chamar a IA nem enviar. Regra extra no prompt como reserva.
   - Primeiro contato com "obrigada" ainda vai para a IA. Pergunta, saudação e pedido nunca contam como despedida.
   - No ar na VPS. Não testado com WhatsApp real.

## Pendências e dúvidas abertas
- Conferir Conquistas com conta de membro real em produção (só testei com dados de prova).
- "Horários de lembretes" cortando texto no celular do dono: não reproduzi no Chrome; reforcei às cegas. Pedir a tela exata se persistir.
- "Criar missões" empilha 4 ferramentas; opção de dividir em blocos recolhíveis ou subabas. Nomes das abas podem mudar se o dono preferir outros.
- Se o Tarcísio ainda responder a uma despedida, pegar a mensagem exata e incluir a palavra na lista de `ehDespedida`.
- `projetos/acolitos/provas/jornada-visibilidade.prova.mjs` falha com `ERR_INVALID_URL 'undefined'` (já falhava antes; precisa de URL no ambiente).

## Ferramentas de prova
- `projetos/acolitos/provas/abrir-tela.mjs`: `iniciarProvas`, `env.abrir(tela,{sessao,papel:PAPEIS.admin,largura,apis,rpcs,foto,avaliar})`. `avaliar` precisa de `return`. Remover o splash antes de fotografar (`document.getElementById('splash')?.remove()`). Sem suporte a `?aba=`: clicar na aba pelo texto.
- Regra do dono: fotografar em 360–390 px, tablet, notebook e 2560 px antes de dizer "pronto". Desktop ocupa toda a lateral (sem `max-width` + `margin:auto`). Alvos de toque de 44 px, campos de 16 px.
- Rascunhos locais (ignorados pelo git): `estudos/medalhas/ordem-2026-10-30/`, `estudos/jornada-abas-2026-10-30/`.

## Regras vivas do Tarcísio
Túnica recebida = sai da CRM. Catequese só por texto no WhatsApp. Integração = um vídeo. O robô se chama "Tarcísio" (não "São"). Contexto completo: `docs/RETOMADA-TARCISIO-CRM.md`.

## Commits com co-autoria
Terminar a mensagem com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` quando o Claude escrever o commit.
