// Gera os dois PDFs da equipe: ACESSOS (usuário e senha de cada pessoa) e TUTORIAL (entrar,
// Tesouraria e Retiros). O estilo é o do guia das famílias (tutorial.html), para a pastoral
// reconhecer a casa. As fotos saem de tirar-fotos-equipe.mjs.
//
//   node criar-logins/gerar-pdfs-equipe.mjs <acessos.json> <pasta-de-saida>
//
// ⚠️ O PDF de ACESSOS tem SENHAS. Nasce em entregas/ (ignorado pelo git) e nunca vai para o repositório.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pup = require('puppeteer-core');
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const [ARQ, SAIDA] = process.argv.slice(2);
if (!ARQ || !SAIDA) { console.error('Uso: gerar-pdfs-equipe.mjs <acessos.json> <pasta-de-saida>'); process.exit(1); }
const pessoas = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const estilo = fs.readFileSync(path.join(AQUI, 'tutorial.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1] + `
  .cartao { border:1.5px dashed var(--gold); border-radius:10px; padding:7mm 7mm; margin:0;
            break-inside:avoid; background:#fff; }
  .cartao .nome { font-size:17px; font-weight:800; color:var(--wine); margin-bottom:3mm; }
  .cartao .linha { display:flex; gap:6mm; margin-bottom:2mm; font-size:11.5px; }
  .cartao .rot { flex:0 0 22mm; color:var(--suave); }
  .cartao .val { font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:700; color:var(--gold-deep); font-size:11.5px; overflow-wrap:anywhere; }
  .cartao .nota { font-size:10px; color:var(--suave); margin-top:3mm; line-height:1.5; }
  .cartao .val.url { font-size:9.2px; white-space:nowrap; }
  .cartoes { display:grid; grid-template-columns:1fr 1fr; gap:6mm; }
  .tesoura { font-size:9.5px; color:#a49a8d; text-align:center; margin:-3mm 0 4mm; letter-spacing:.2em; }
  .tela .legenda { min-height: 8mm; }
  img.tela-un { width: 100%; display:block; border-radius:10px; }
`;
const cab = (titulo) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>${estilo}</style></head><body>`;
const PAROQUIA = 'Paróquia Jesus Cristo Bom Pastor · Limeira/SP';
let n = 1;
const RODAPE = 'Guia da Equipe — Pastoral dos Acólitos e Coroinhas';
const pag = (num, titulo, linha, corpo) => `<section class="pagina"><div class="faixa"><div class="num">${num}</div><h2>${titulo}</h2>${linha ? `<div class="linha-fina">${linha}</div>` : ''}</div>${corpo}<div class="rodape"><span>${RODAPE}</span><span>${++n}</span></div></section>`;
const duas = (texto, img, legenda, pasta) => `<div class="duas"><div class="texto">${texto}</div><div class="tela"><div class="moldura"><img src="${pasta || 'fotos-equipe'}/${img}.png" alt=""></div><div class="legenda">${legenda}</div></div></div>`;
const caixa = (rot, txt, forte) => `<div class="caixa${forte ? ' forte' : ''}"><span class="rot">${rot}</span> ${txt}</div>`;
const SITE = 'coroinhas.jcbplimeira.com.br';
const ZAP = '(19) 99907-1702';

// ───────────────────────── 1) ACESSOS ─────────────────────────
const linhasTab = pessoas.map((p) => `<tr><td><b>${esc(p.nome)}</b></td><td style="font-family:ui-monospace,Menlo,monospace"><b>${esc(p.usuario)}</b></td><td style="font-family:ui-monospace,Menlo,monospace">${esc(p.senha)}</td></tr>`).join('');
const cartoes = pessoas.map((p) => `<div class="cartao"><div class="nome">${esc(p.nome)}</div>
  <div class="linha"><span class="rot">Endereço</span><span class="val url">${SITE}</span></div>
  <div class="linha"><span class="rot">Usuário</span><span class="val">${esc(p.usuario)}</span></div>
  <div class="linha"><span class="rot">Senha provisória</span><span class="val">${esc(p.senha)}</span></div>
  <div class="nota">No primeiro acesso o aplicativo pede que você crie uma senha só sua; a provisória deixa de funcionar nesse momento. Dúvidas: coordenação, WhatsApp ${ZAP}.</div></div>`).join('');
n = 1;
const acessos = cab('Acessos da equipe — Pastoral dos Acólitos e Coroinhas') + `
<section class="pagina"><div class="faixa"><div class="num">Equipe · acesso ao aplicativo</div><h2>Acessos da equipe</h2><div class="linha-fina">${PAROQUIA}</div></div>
<p>Estas são as contas criadas para a equipe que organiza retiros, formações e cuida do caixa da pastoral.
Cada pessoa entra com o <b>seu usuário</b> e a <b>sua senha provisória</b>.</p>
<table><tr><th style="width:34%">Nome</th><th style="width:30%">Usuário</th><th>Senha provisória</th></tr>${linhasTab}</table>
<h3>Como entrar</h3>
<ol class="passos">
<li>Abra <b>${SITE}</b> no navegador do celular ou do computador.</li>
<li>Na aba <b>Entrar</b>, escreva o <b>usuário</b> (tudo junto, minúsculo) e a <b>senha provisória</b>, e toque em <b>Entrar</b>.</li>
<li>O aplicativo pede uma <b>senha nova</b>. Escolha uma só sua, com ao menos 6 letras ou números, e repita nas duas caixas. A provisória deixa de valer.</li>
</ol>
<h3>O que cada pessoa vê</h3>
<ul><li><b>Início</b> e <b>Agenda</b>, como todo mundo.</li>
<li><b>Tesouraria</b> — o caixa da pastoral (entradas e saídas).</li>
<li><b>Retiros</b> — o planejamento de retiros, espiritualidade e formações, com compras e caixa.</li></ul>
<p>Ninguém da equipe aparece na escala das missas, no rodízio ou na contagem de quem serve: são pessoas que organizam, não que servem no altar.</p>
${caixa('Cuide desta folha.', 'Ela tem senhas. Entregue a cada pessoa só o <b>seu</b> cartão (próxima página), de preferência em mãos ou em mensagem direta — nunca no grupo. Quem esquecer a senha que criou fala com a coordenação, que devolve o acesso.', true)}
<div class="rodape"><span>${RODAPE}</span><span>1</span></div></section>
<section class="pagina"><div class="faixa"><div class="num">Para recortar</div><h2>Um cartão para cada pessoa</h2><div class="linha-fina">Recorte na linha pontilhada e entregue só o cartão de cada uma</div></div>
<div class="cartoes">${cartoes}</div>
<div class="rodape"><span>${RODAPE}</span><span>2</span></div></section></body></html>`;

// ───────────────────────── 2) TUTORIAL ─────────────────────────
n = 1;
const T = [];
T.push(pag('Antes de tudo', 'O que você vai poder fazer', 'Três coisas, num aplicativo só', `
<p>Você recebeu um acesso ao aplicativo da <b>Pastoral dos Acólitos e Coroinhas</b>. Ele funciona no celular
(como um aplicativo comum) e também no computador. Com o seu acesso você pode:</p>
<div class="trilha">
<div class="etapa"><div class="bolha">1</div><div><b>Cuidar do caixa — Tesouraria</b><span>Registrar o que entra (doações, mensalidades, vendas) e o que sai (compras, despesas), e ver o saldo da pastoral.</span></div></div>
<div class="etapa"><div class="bolha">2</div><div><b>Planejar retiros, espiritualidade e formações — Retiros</b><span>Criar uma <b>área</b> para cada evento e organizar dentro dela o cronograma, as pregações, as dinâmicas, as gincanas e as refeições, cada item com responsável e data máxima. Monte também as <b>equipes</b> (cozinha, liturgia...) com as pessoas e o WhatsApp de cada uma.</span></div></div>
<div class="etapa"><div class="bolha">3</div><div><b>Controlar as compras e cotações</b><span>Montar a lista de compras (ingredientes, decoração, lembranças, papelaria, higiene, limpeza), comparar fornecedores e lançar a compra no caixa com um toque.</span></div></div>
</div>
${caixa('A ideia é centralizar.', 'Tudo de um retiro fica num lugar só — o plano, quem faz o quê, quanto vai custar, quanto já foi gasto e quanto entrou. Assim a decisão é tomada olhando o quadro inteiro, e não várias conversas soltas.')}
<h3>O que este guia ensina</h3>
<table><tr><th style="width:8%">Pág.</th><th>Assunto</th></tr>
<tr><td>3–5</td><td>Abrir o aplicativo, entrar, criar a sua senha e pôr o ícone na tela do celular</td></tr>
<tr><td>6–7</td><td>Tesouraria: ver o saldo e registrar entradas e saídas</td></tr>
<tr><td>8–11</td><td>Retiros: criar a área, montar o plano e dar responsável e prazo a cada item</td></tr>
<tr><td>12</td><td>Equipes do retiro, com as pessoas e o WhatsApp de cada uma</td></tr>
<tr><td>13–15</td><td>Compras: lista, cotações de fornecedores e lançamento no caixa</td></tr>
<tr><td>16–17</td><td>Caixa do retiro: doações, vendas de itens da pastoral e conferência</td></tr>
<tr><td>18</td><td>Quando algo dá errado</td></tr></table>`));

T.push(pag('Passo 1 de 3', 'Abrir o aplicativo e entrar', 'Com o usuário e a senha provisória da sua folha', duas(`
<p>Você recebeu uma folha com o seu <b>usuário</b> e uma <b>senha provisória</b>.</p>
<ol class="passos">
<li>Abra <b>${SITE}</b> no navegador (Safari no iPhone, Chrome no Android, ou qualquer navegador no computador).</li>
<li>Na aba <b>Entrar</b>, escreva o <b>usuário</b> da folha. Tudo junto, em minúsculo, sem espaço.</li>
<li>Escreva a <b>senha provisória</b>.</li>
<li>Toque em <b>Entrar</b>.</li>
</ol>
${caixa('Se disser que está errado:', 'confira se não sobrou espaço no fim e se as letras da senha estão iguais às da folha (a senha provisória usa letras minúsculas e números, e um traço no meio).')}
${caixa('Não use a aba "Quero servir".', 'Ela é para quem quer se cadastrar como acólito ou coroinha. Você já tem conta.')}`, '01-login', 'A tela de entrada.<br>A aba certa é "Entrar".')));

T.push(pag('Passo 2 de 3', 'Criar a sua senha', 'O aplicativo não abre antes disso', duas(`
<p>Logo depois de entrar aparece uma tela com o seu <b>primeiro nome</b> pedindo uma senha nova. Escreva a mesma senha nas duas caixas e toque em <b>Guardar a minha senha</b>.</p>
<h3>O que vale como senha</h3>
<ul><li>Ao menos <b>6 letras ou números</b>.</li><li>As duas caixas com <b>exatamente a mesma coisa</b>.</li><li>Diferente da senha provisória da folha.</li></ul>
${caixa('Por que é obrigatório?', 'A folha com a senha provisória passou por várias mãos. Ao criar a sua, só você sabe entrar na sua conta.')}
<p>Depois de guardar, o aplicativo recarrega sozinho e você já está dentro. <b>Essa tela não aparece nunca mais.</b></p>
${caixa('Anote a senha nova num lugar seguro.', 'Quem esquece precisa pedir à coordenação para voltar a entrar.')}`, '02-parede-senha', 'Beatriz é um exemplo —<br>ali vai o seu nome')));

T.push(pag('Passo 3 de 3', 'Pôr o aplicativo na tela do celular', 'Ele ganha ícone e abre em tela cheia', duas(`
<p>Assim o aplicativo fica como qualquer outro no seu celular. O próprio aplicativo oferece isso num balão embaixo da tela.</p>
<h3>No iPhone (Safari)</h3>
<ol class="passos"><li>Toque em <b>Compartilhar</b> — o quadradinho com a seta para cima.</li><li>Toque em <b>"Adicionar à Tela de Início"</b>.</li><li>Toque em <b>Adicionar</b>.</li></ol>
<h3>No Android (Chrome)</h3>
<ol class="passos"><li>Toque no <b>menu (⋮)</b> no canto de cima.</li><li>Toque em <b>"Instalar app"</b> (ou "Adicionar à tela inicial").</li><li>Confirme.</li></ol>
<p>No computador não precisa instalar: basta guardar o endereço nos favoritos.</p>
${caixa('Depois de instalar, use sempre o ícone.', 'Ele abre mais rápido e fica sempre logado no seu celular.')}
<h3>A barra de baixo</h3>
<p>No seu acesso a barra mostra: <b>Início</b>, <b>Agenda</b>, <b>Tesouraria</b> e <b>Retiros</b>. Toque no que quiser abrir.</p>`, '03-instalar', 'O balão "Instale o app na sua<br>tela inicial", embaixo da tela', 'fotos')));

T.push(pag('Tesouraria · 1 de 2', 'O caixa da pastoral', 'Saldo, entradas e saídas', duas(`
<p>Toque em <b>Tesouraria</b> na barra de baixo. No alto você vê o <b>saldo em caixa</b> (tudo que entrou menos tudo que saiu) e, logo abaixo, as <b>entradas</b> e as <b>saídas do mês</b>.</p>
<p>Embaixo ficam os <b>lançamentos</b>, do mais novo para o mais antigo. A seta para cima verde é <b>entrada</b>; a seta para baixo vermelha é <b>saída</b>.</p>
<h3>O que dá para fazer</h3>
<ul><li><b>Novo lançamento</b> — o botão dourado (próxima página).</li>
<li><b>Corrigir</b> — toque no lançamento para editar.</li>
<li><b>Excluir</b> — toque na lixeira à direita. O app pergunta antes.</li></ul>
${caixa('O saldo é um só.', 'Tudo que for lançado nos Retiros (compras, doações, vendas) também aparece aqui, com o nome do retiro na descrição. Você não precisa lançar duas vezes.')}`, '04-tesouraria', 'A Tesouraria: saldo no alto,<br>lançamentos embaixo')));

T.push(pag('Tesouraria · 2 de 2', 'Registrar uma entrada ou uma saída', 'Toque em "+ Novo lançamento"', duas(`
<ol class="passos">
<li>Escolha <b>Entrada</b> (dinheiro que chegou) ou <b>Saída</b> (dinheiro que foi gasto).</li>
<li>Escolha a <b>categoria</b>. Entradas: dízimo/doação, mensalidade, evento, rifa/venda, outro. Saídas: compras, túnicas/vestes, evento, transporte, manutenção, outro.</li>
<li>Digite o <b>valor</b> em reais (ex.: 57,50).</li>
<li>Escreva a <b>descrição</b> — o que foi, de quem veio ou para quem foi. Uma boa descrição poupa muita dúvida depois.</li>
<li>Confira a <b>data</b> (já vem a de hoje) e toque em <b>Salvar</b>.</li></ol>
<h3>Doação, venda de item e outros tipos</h3>
<p>Nas <b>entradas</b> existem os tipos <b>Doação</b> e <b>Venda de item</b> (pingentes, terços...), os mesmos que a aba Retiros usa. Assim o caixa da pastoral e o caixa de cada retiro falam a mesma língua.</p>
<h3>Vincular a um retiro</h3>
<p>Se o lançamento é de um retiro, de uma formação ou de um momento de espiritualidade, escolha no campo <b>"Vincular a um retiro, formação ou espiritualidade"</b>. Ele passa a aparecer também na aba <b>Caixa</b> daquela área. Lá em cima da lista há um filtro para ver só os lançamentos de uma área (ou só os sem vínculo).</p>
<h3>Categoria nova</h3>
<p>Não achou a categoria? Toque em <b>+ nova</b> ao lado de "Categoria", escreva o nome e ela passa a existir para todos.</p>
${caixa('Dica de ouro:', 'lance no mesmo dia. Esperar juntar recibo para lançar tudo no fim do mês é como o saldo deixa de bater.')}`, '05-tesouraria-lancamento', 'A janela de novo lançamento')));

T.push(pag('Retiros · 1 de 4', 'A aba Retiros e as áreas', 'Uma área para cada retiro, formação ou momento de espiritualidade', duas(`
<p>Toque em <b>Retiros</b> na barra de baixo. Cada card da lista é uma <b>área</b> — por exemplo "Retiro de Advento 2026" ou "Formação de novos coroinhas". No card você vê o tipo, as datas, o local, a barra de <b>quanto já está pronto</b>, o orçamento das compras, o saldo do caixa e, em vermelho, quantas coisas estão com o <b>prazo vencido</b>.</p>
<p>Toque no card para entrar na área.</p>
<h3>Criar uma área nova</h3>
<ol class="passos"><li>Toque em <b>+ Nova área</b>.</li><li>Escreva o <b>nome</b> e escolha o <b>tipo</b> (retiro, espiritualidade, formação ou outro).</li><li>Preencha local e datas (se já souber) e uma frase sobre o objetivo.</li><li>Toque em <b>Salvar</b>.</li></ol>
${caixa('Quando acabar,', 'toque em <b>Editar</b> dentro da área e mude a situação para <b>Concluída</b> ou <b>Arquivada</b>. Nada se perde: as arquivadas ficam guardadas.')}`, '06-retiros-lista', 'A lista de áreas')));

T.push(pag('Retiros · 2 de 4', 'Dentro da área: o plano', 'Cronograma, pregações, dinâmicas, gincanas e refeições', duas(`
<p>No alto da área ficam quatro números: quanto já está <b>pronto</b>, quantos itens estão <b>atrasados</b>, o <b>orçamento</b> das compras e o <b>saldo</b> do caixa do retiro.</p>
<p>Logo abaixo, as <b>abas</b>: <b>Cronograma</b>, <b>Pregações</b>, <b>Dinâmicas</b>, <b>Gincanas</b>, <b>Refeições</b>, <b>Compras</b> e <b>Caixa</b>. Deslize para o lado para ver todas. O número ao lado do nome mostra quantos itens há.</p>
<h3>O que tem em cada item do plano</h3>
<ul><li><b>Título</b> e <b>detalhes</b> (o que é, material, observações).</li>
<li><b>Dia</b>, <b>hora</b> e <b>duração</b> — o cronograma sai em ordem de horário.</li>
<li><b>Responsável</b> — escolha na lista (a equipe vem primeiro). Nas pregações vira <b>Pregador</b>.</li>
<li><b>Data máxima</b> para ficar pronto. Passou da data sem estar feito, aparece em vermelho: <b>VENCIDO</b>.</li>
<li><b>Andamento</b>: A fazer, Em andamento ou Feito.</li></ul>`, '08-area-cronograma', 'A área, com o cronograma')));

T.push(pag('Retiros · 3 de 4', 'Adicionar e acompanhar itens', 'O mesmo jeito em todas as abas do plano', duas(`
<ol class="passos">
<li>Entre na aba que quiser (por exemplo, <b>Cronograma</b>) e toque no botão dourado: <b>+ Atividade</b> (nas outras abas: <b>+ Pregação</b>, <b>+ Dinâmica</b>, <b>+ Gincana</b>, <b>+ Refeição</b>).</li>
<li>Preencha o título, o dia e a hora. Escolha o <b>responsável</b> e a <b>data máxima</b>.</li>
<li>Toque em <b>Salvar</b>.</li></ol>
<h3>No dia a dia</h3>
<ul><li>O botão verde do card muda o andamento: <b>Começar</b> → <b>Concluir</b>. Concluído, vira <b>Reabrir</b> se precisar voltar atrás.</li>
<li><b>Editar</b> corrige qualquer campo; <b>Excluir</b> remove o item (o app pergunta antes).</li></ul>
<h3>Refeições</h3>
<p>Escolha se é <b>café da manhã, almoço, lanche ou janta</b> e escreva o cardápio no título. Use os <b>detalhes</b> para anotar quantas pessoas e restrições (alergias, sem glúten...). O que precisa ser comprado vai na aba <b>Compras</b>.</p>`, '09-novo-item', 'A janela de nova atividade')));

T.push(pag('Retiros · 4 de 4', 'Refeições: a mesa do retiro', 'Café, almoço, lanche e janta', duas(`
<p>Cada refeição é um item, com <b>tipo</b>, <b>cardápio</b>, <b>dia e hora</b>, <b>responsável</b> e <b>prazo</b> — quem fica de preparar e até quando o cardápio precisa estar fechado.</p>
<p>Uma sugestão de rotina: para cada refeição, crie o item aqui e, em seguida, vá em <b>Compras › + Item</b> e liste os ingredientes na categoria <b>Ingredientes</b>.</p>
${caixa('As outras abas funcionam igual.', 'Pregações, dinâmicas e gincanas usam a mesma janela — a diferença é só o nome dos campos. Em <b>Pregações</b>, o responsável é o <b>pregador</b>.')}
${caixa('Quem vê tudo isto?', 'Todas as pessoas da equipe com acesso a Retiros. Por isso, se alguém mudar um item, os outros enxergam na hora.')}`, '10-refeicoes', 'A aba Refeições')));

T.push(pag('Retiros · equipes', 'As equipes do retiro e o WhatsApp', 'Cozinha, liturgia, decoração... cada uma com as suas pessoas', duas(`
<p>Na aba <b>Equipes</b> você organiza quem faz parte de cada frente do retiro. O card de cada equipe mostra quantas <b>pessoas</b> e quantas <b>tarefas</b> ela tem.</p>
<h3>Criar e editar uma equipe</h3>
<ol class="passos"><li>Toque em <b>+ Equipe</b> e escreva o nome (Cozinha, Liturgia...).</li><li>Conte o que a equipe faz.</li><li>Cole o <b>link do grupo do WhatsApp</b> (no WhatsApp: abra o grupo › Dados do grupo › Convidar via link › Copiar link). Só links de <b>chat.whatsapp.com</b> são aceitos.</li></ol>
<p>Com o link salvo aparece o botão <b>Grupo no WhatsApp</b>, que abre o grupo direto. Para mudar qualquer coisa: <b>Editar equipe</b>.</p>
<h3>Adicionar pessoas</h3>
<p>Toque em <b>+ Pessoa</b>. Se for alguém da pastoral, escolha na lista e o nome vem sozinho; se for de fora (pais, voluntários), basta digitar. Informe o <b>WhatsApp com DDD</b> e a função. Marque <b>líder</b> para a pessoa aparecer primeiro.</p>
<p>O botão <b>WhatsApp</b> de cada pessoa abre a conversa com ela. O aplicativo avisa se o número estiver errado.</p>
${caixa('Equipe nas tarefas.', 'Ao criar um item do plano ou uma compra, escolha também a <b>Equipe</b>: o card mostra "Equipe Cozinha" e o contador da equipe sobe.')}`, '10b-equipes', 'A aba Equipes, com grupo<br>e WhatsApp de cada pessoa')));

T.push(pag('Compras · 1 de 3', 'A lista de compras', 'Ingredientes, decoração, lembranças, papelaria, higiene e limpeza', duas(`
<p>Na aba <b>Compras</b> ficam todos os itens a comprar, <b>agrupados por categoria</b>. Cada categoria mostra o total. No topo, o <b>orçamento</b> geral, quanto já foi <b>pago</b> e quantos itens ainda estão <b>sem valor</b>.</p>
<h3>Adicionar um item</h3>
<ol class="passos"><li>Toque em <b>+ Item</b>.</li><li>Escreva o item (ex.: Arroz 5 kg), escolha a <b>categoria</b> e informe <b>quantidade</b> e <b>unidade</b> (kg, un, pacotes).</li><li>Se já souber, escreva o <b>valor estimado total</b>. Se for cotar, deixe vazio.</li><li>Escolha <b>quem compra</b> e a <b>data máxima</b> para comprar.</li></ol>
<h3>Os quatro estados de um item</h3>
<ul><li><b>Pendente</b> — ainda não cotou.</li><li><b>Cotando</b> — há preços de fornecedores.</li><li><b>Aprovada</b> — foi escolhido o fornecedor e o preço.</li><li><b>Comprada</b> — já foi pago e lançado no caixa.</li></ul>`, '11-compras', 'A lista de compras,<br>agrupada por categoria')));

T.push(pag('Compras · 2 de 3', 'Cotações e fornecedores', 'Compare os preços antes de decidir', duas(`
<h3>Cadastrar fornecedores</h3>
<p>Toque em <b>Fornecedores</b> › <b>+ Novo fornecedor</b>. Guarde o nome, a pessoa de contato, o telefone e observações (entrega, forma de pagamento). A lista é da pastoral: serve para todos os retiros.</p>
<h3>Pedir e comparar cotações</h3>
<ol class="passos">
<li>No item, toque em <b>Cotações</b>.</li>
<li>Escolha o fornecedor (ou <b>Outro</b>, para digitar um nome na hora), informe o <b>preço por unidade</b>, a validade e observações (prazo de entrega, frete).</li>
<li>Toque em <b>Adicionar cotação</b>. Repita para cada fornecedor.</li>
<li>A tela mostra o <b>total</b> de cada um, marca o <b>Menor preço</b> e diz <b>quanto você economiza</b>.</li>
<li>Toque em <b>Escolher esta</b>: o valor entra no orçamento e o item fica <b>Aprovado</b>.</li></ol>
${caixa('Cotação vencida', 'não é considerada para o "menor preço". Se a validade passou, peça outra.')}`, '13-cotacoes', 'As cotações do arroz:<br>3 fornecedores, 1 escolhida')));

T.push(pag('Compras · 3 de 3', 'Comprei! Lançar no caixa', 'Um toque grava a compra e a saída na Tesouraria', duas(`
<p>Quando a compra for feita, toque em <b>Comprei</b> no item.</p>
<ol class="passos"><li>Confira o <b>valor pago</b> (total, em reais). Já vem o valor estimado: corrija se pagou outro.</li><li>Confira a <b>data</b> e escolha <b>onde comprou</b>.</li><li>Toque em <b>Registrar e lançar no caixa</b>.</li></ol>
<p>Pronto: o item vira <b>Comprada</b> e, <b>ao mesmo tempo</b>, aparece uma <b>saída</b> na Tesouraria, com o nome do retiro e do item. Não precisa lançar de novo.</p>
<h3>Errou?</h3>
<p>Toque em <b>Desfazer compra</b>. O item volta a <b>Aprovada</b> e a saída <b>some</b> da Tesouraria. Depois é só registrar de novo, com o valor certo.</p>
${caixa('Importante:', 'para corrigir uma compra, use sempre <b>Desfazer compra</b> — não apague o lançamento direto na Tesouraria. Se alguém apagar lá, o retiro avisa (próxima seção).', true)}`, '15-comprei', 'A janela de registrar a compra')));

T.push(pag('Caixa do retiro · 1 de 2', 'Doações, vendas e gastos avulsos', 'Tudo o que entra e sai do retiro, num lugar só', duas(`
<p>Na aba <b>Caixa</b> você vê quanto o retiro arrecadou e gastou: <b>entradas</b>, <b>saídas</b>, <b>doações</b>, <b>vendas</b> e o <b>resultado</b> (entradas menos saídas).</p>
<h3>Os quatro botões</h3>
<ul>
<li><b>+ Doação</b> — dinheiro recebido de alguém. Anote de quem veio.</li>
<li><b>+ Venda de item</b> — itens da pastoral vendidos (pingentes, terços...). Informe o item, a <b>quantidade</b> e o <b>preço de cada um</b>: o aplicativo multiplica.</li>
<li><b>+ Outra entrada</b> — qualquer outro dinheiro que chegou para o retiro.</li>
<li><b>+ Gasto avulso</b> — despesa que não estava na lista de compras (transporte, taxa do local).</li></ul>
<p>Cada um deles vira um lançamento na <b>Tesouraria</b>, ligado a este retiro. E o caminho inverso também funciona: um lançamento feito direto na Tesouraria e vinculado a esta área aparece aqui.</p>`, '17-venda', 'A janela de venda de item<br>da pastoral')));

T.push(pag('Caixa do retiro · 2 de 2', 'Conferir se o caixa bate', 'O aplicativo avisa quando algo está fora do lugar', duas(`
<p>Embaixo dos números ficam os <b>lançamentos deste retiro</b>. As compras da lista aparecem como "compra da lista"; para tirá-las, use <b>Desfazer compra</b> na aba Compras. Os outros lançamentos têm o botão <b>Excluir</b>.</p>
<h3>Os avisos</h3>
<ul>
<li><b>"Compra marcada como comprada está SEM lançamento na Tesouraria"</b> — alguém apagou a saída direto na Tesouraria. Toque no botão <b>Lançar de novo</b> para refazer.</li>
<li><b>"A compra diz R$ X, mas o lançamento diz R$ Y"</b> — o valor foi mudado em um lado só. Confira com quem mexeu e corrija na Tesouraria.</li></ul>
${caixa('Para o balanço do retiro:', 'quando o evento acabar, abra a aba <b>Caixa</b>. O <b>resultado</b> é o que sobrou (ou faltou) e você sabe quanto veio de doação e de venda de itens.')}`, '16-caixa', 'A aba Caixa do retiro')));

T.push(pag('Ajuda', 'Quando algo dá errado', 'Os casos que mais aparecem', `
<table><tr><th style="width:36%">O que acontece</th><th>O que fazer</th></tr>
<tr><td><b>"Usuário ou senha inválidos"</b> na primeira vez</td><td>Confira o usuário e a senha na sua folha, sem espaço no fim. A senha provisória tem letras minúsculas, números e um traço no meio.</td></tr>
<tr><td><b>Esqueci a senha que criei</b></td><td>Fale com a coordenação. Ela consegue devolver o acesso.</td></tr>
<tr><td><b>A tela de senha fica voltando</b></td><td>A senha nova precisa ter 6 letras ou números, ser diferente da provisória e ser igual nas duas caixas. A frase em vermelho diz qual das três faltou.</td></tr>
<tr><td><b>Não vejo a aba Retiros ou Tesouraria</b></td><td>Saia e entre de novo. Se continuar, avise a coordenação: o acesso a cada aba é liberado por pessoa.</td></tr>
<tr><td><b>Não consegui salvar</b></td><td>A internet pode ter caído. Confira a conexão e tente de novo — o aplicativo não perde o que já foi salvo.</td></tr>
<tr><td><b>Apaguei um item sem querer</b></td><td>Itens excluídos não voltam; crie de novo. Por isso o aplicativo pergunta antes de excluir.</td></tr>
<tr><td><b>O aplicativo parece desatualizado</b></td><td>Feche de vez (não só minimize) e abra outra vez pelo ícone.</td></tr>
<tr><td><b>Quero uma pessoa a mais com acesso</b></td><td>Peça à coordenação. Ela cria o acesso e libera as abas.</td></tr></table>
<h3>Precisou de ajuda?</h3><p>Fale com a coordenação da pastoral no WhatsApp:</p>
<div class="caixa" style="text-align:center;font-size:14px;"><b>${ZAP}</b></div>
<div style="margin-top:12mm;text-align:center;padding:8mm 0;background:radial-gradient(90% 120% at 50% 40%, #3a1520 0%, var(--wine) 70%);border-radius:10px;color:#e8d5c8;">
<div style="font-family:Lora,Georgia,serif;font-style:italic;font-size:14px;">Somos do altar</div>
<div style="font-size:10.5px;color:#b39a90;margin-top:5px;letter-spacing:.05em;">PASTORAL DOS ACÓLITOS E COROINHAS · ${PAROQUIA.toUpperCase()}</div></div>`));

const capa = `<section class="pagina capa"><div class="veu"></div><div class="titulo"><h1>Guia da <em>Equipe</em></h1><div class="fio"></div>
<div class="sub">Como entrar no aplicativo, cuidar do caixa<br>e planejar retiros, espiritualidade e formações</div></div><div class="pe">${PAROQUIA.toUpperCase()}</div></section>`;
const tutorial = cab('Guia da Equipe — Pastoral dos Acólitos e Coroinhas') + capa + T.join('\n') + '</body></html>';

// ───────────────────────── PDF ─────────────────────────
fs.mkdirSync(SAIDA, { recursive: true });
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((c) => fs.existsSync(c));
const nav = await pup.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
async function pdf(html, nome) {
  const htmlArq = path.join(AQUI, nome + '.tmp.html');
  fs.writeFileSync(htmlArq, html, 'utf8');
  const pg = await nav.newPage();
  await pg.goto('file://' + htmlArq, { waitUntil: 'networkidle0', timeout: 60000 });
  await pg.evaluate(() => document.fonts.ready);
  const imgs = await pg.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
  if (imgs.length) { console.error('IMAGEM QUEBRADA em ' + nome + ':', imgs); process.exit(1); }
  const dest = path.join(SAIDA, nome + '.pdf');
  await pg.pdf({ path: dest, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const paginas = await pg.evaluate(() => document.querySelectorAll('.pagina').length);
  await pg.close(); fs.unlinkSync(htmlArq);
  console.log('  ' + dest + '  (' + paginas + ' páginas, ' + Math.round(fs.statSync(dest).size / 1024) + ' KB)');
}
const agora = new Date(); const p2 = (x) => String(x).padStart(2, '0');
const carimbo = `${agora.getFullYear()}-${p2(agora.getMonth() + 1)}-${p2(agora.getDate())}_${p2(agora.getHours())}${p2(agora.getMinutes())}`;
const VER = process.env.VERSAO || 'v1';
await pdf(acessos, `acessos-da-equipe_${carimbo}_${VER}`);
await pdf(tutorial, `tutorial-da-equipe_${carimbo}_${VER}`);
await nav.close();
