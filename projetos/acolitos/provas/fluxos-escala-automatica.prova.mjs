// Provas de FLUXO da escala automática: não basta a tela desenhar — cada prova faz o que a
// pessoa faz (escolhe o PDF, marca a opção, toca em Salvar, confirma o diálogo) e confere o
// que foi MANDADO para o banco e para as APIs. Banco de mentira (bancoVivo do motor) e API
// de mentira: nada sai da máquina, nenhum dado real.
//   node projetos/acolitos/provas/fluxos-escala-automatica.prova.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { iniciarProvas } from './abrir-tela.mjs';
import { pdfMinimo, palavras } from './pdf-minimo.mjs';

const resultados = [];
function exigir(cond, titulo, detalhe) {
  resultados.push({ ok: !!cond, titulo });
  console.log('  ' + (cond ? '\x1b[32m✔\x1b[0m ' : '\x1b[31m✖\x1b[0m ') + titulo + (detalhe && !cond ? '\n      ' + String(detalhe).slice(0, 600) : ''));
}
// `esperados`: erros que o próprio caminho de falha escreve no console (o 500 de mentira, o
// console.error da tela ao avisar a falha) — qualquer outro continua reprovando.
const semErros = (r, onde, esperados = []) => {
  const erros = r.erros.filter((e) => !esperados.some((x) => e.includes(x)));
  exigir(!erros.length, onde + ': sem erro de JavaScript', erros.join(' | '));
  exigir(!(r.passosFalhos || []).length, onde + ': todos os passos acharam o alvo', JSON.stringify(r.passosFalhos));
};
// O que a tela ESCREVEU no banco. As RPCs de leitura do cabeçalho (pendências do sino) não contam.
const LEITURAS_RPC = ['rpc:acolitos_solicitacoes_pendentes', 'rpc:acolitos_ausencia_pendente_listar'];
const escritas = (r) => (r.gravacoes || []).filter((g) => !LEITURAS_RPC.includes(g.tabela));
const de = (r, tabela, acao) => (r.gravacoes || []).filter((g) => g.tabela === tabela && (!acao || g.acao === acao));
const PASTA = fs.mkdtempSync(path.join(os.tmpdir(), 'prova-fluxos-'));

// ── 1. Escala dos ministros: PDF → revisão → dúvida → Confirmar e salvar ───────────────
// PDF inventado no formato do Drive: títulos de dia à esquerda, uma linha por bloco de horários.
// "Cristiana M." casa só com a mãe do João; "Rita E." pode ser a mãe da Bia ou a do Caio.
const PDF_BOM = path.join(PASTA, 'ESCALA OUTUBRO.pdf');
fs.writeFileSync(PDF_BOM, pdfMinimo([
  [40, 540, 'Outubro'], [100, 540, '2026'],
  [40, 500, 'S\xC1BADO'], [100, 500, '3/out'],
  [40, 470, 'DOMINGO'], [100, 470, '4/out'],
  ...palavras(160, 500, '17:00h Cristiana M. Rita E. Paulo 18:30h Ana'),
  ...palavras(160, 488, '7:00h Joana 9:00h Rita E. Marcos'),
]));
const PDF_SEM_DIAS = path.join(PASTA, 'cardapio.pdf');
fs.writeFileSync(PDF_SEM_DIAS, pdfMinimo([[40, 500, 'Cardápio'], [120, 500, 'da'], [160, 500, 'festa']]));
const PDF_QUEBRADO = path.join(PASTA, 'quebrado.pdf');
fs.writeFileSync(PDF_QUEBRADO, Buffer.from('isto não é um PDF, é texto com outra extensão'));

const MEMBROS = [
  { id: 'm1', nome: 'João Pedro', apelido: 'João', status: 'ativo', serve: true, tem_mae_ministro: true, nome_mae_ministro: 'Cristiana Moreira', tem_pai_ministro: false },
  { id: 'm2', nome: 'Bia Souza', apelido: 'Bia', status: 'ativo', serve: true, tem_mae_ministro: true, nome_mae_ministro: 'Rita Esteves', tem_pai_ministro: false },
  { id: 'm3', nome: 'Caio Lima', apelido: 'Caio', status: 'ativo', serve: true, tem_mae_ministro: true, nome_mae_ministro: 'Rita Elias', tem_pai_ministro: false },
];
const ESCALA_VELHA = [
  // e1 volta igual no PDF novo (mesma chave): fica, com o mesmo id. e2 não está mais: sai.
  { id: 'e1', mes: '2026-10-01', data: '2026-10-03', horario: '17h', comunidade: 'matriz', membro_id: 'm1', pai_ou_mae: 'mae', arquivo: 'velho.pdf' },
  { id: 'e2', mes: '2026-10-01', data: '2026-10-04', horario: '9h', comunidade: 'matriz', membro_id: 'm1', pai_ou_mae: 'mae', arquivo: 'velho.pdf' },
  // outro mês: não é tocado
  { id: 'e9', mes: '2026-09-01', data: '2026-09-05', horario: '17h', comunidade: 'matriz', membro_id: 'm3', pai_ou_mae: 'mae', arquivo: 'setembro.pdf' },
];
const tabelasMinistros = () => ({
  acolitos_membros: { data: MEMBROS },
  acolitos_escala_ministros: { data: ESCALA_VELHA },
  acolitos_ministro_apelidos: { data: [] },
});
const subirPdf = (arquivo, depois = []) => [
  { chamar: 'abrirSecao', args: ['tarcisio_ministros'] },
  { anexar: '#tm-arquivo', arquivo, tipo: 'application/pdf' },
  ...depois,
];

async function provaMinistrosPdf(provas) {
  console.log('\n\x1b[1mEscala dos ministros: PDF → revisão → dúvida respondida → Confirmar e salvar\x1b[0m');
  const r = await provas.abrir('config.html', {
    bancoVivo: true, tabelas: tabelasMinistros(),
    passos: subirPdf(PDF_BOM, [
      { esperarTexto: 'Dúvidas', ate: 15000 },
      { marcar: 'mãe de Bia' },
      { clicar: 'Confirmar e salvar' },
      { esperarDito: 'toast:Escala dos ministros salva', ate: 10000 },
    ]),
  });
  semErros(r, 'subir o PDF');
  // a revisão (lida antes do clique) mostrou o reconhecido e a dúvida com as opções
  const revisao = (r.ditos || []).join('\n');
  exigir((r.ditos || []).includes('toast:Escala dos ministros salva.'), 'salvou e disse "Escala dos ministros salva."', revisao);

  const apel = de(r, 'acolitos_ministro_apelidos', 'upsert');
  const linhasApel = apel.length ? apel[0].dados : [];
  exigir(apel.length === 1 && apel[0].op && apel[0].op.onConflict === 'nome_pdf,membro_id,pai_ou_mae',
    'guarda as respostas em acolitos_ministro_apelidos (upsert pela chave nome_pdf+membro+pai/mãe)', JSON.stringify(apel));
  const resp = Object.fromEntries(linhasApel.map((x) => [x.membro_id + '/' + x.pai_ou_mae + '/' + x.nome_pdf, x.resposta]));
  exigir(JSON.stringify(resp) === JSON.stringify({ 'm2/mae/rita e.': 'sim', 'm3/mae/rita e.': 'nao' }) && linhasApel.every((x) => x.respondido_por === 'app'),
    '"sim" para a escolhida (mãe da Bia), "não" para a outra candidata (mãe do Caio)', JSON.stringify(linhasApel));

  const esc = de(r, 'acolitos_escala_ministros');
  const up = esc.find((g) => g.acao === 'upsert');
  const chave = (x) => [x.data, x.horario, x.comunidade, x.membro_id, x.pai_ou_mae].join('|');
  const esperado = ['2026-10-03|17h|matriz|m1|mae', '2026-10-03|17h|matriz|m2|mae', '2026-10-04|9h|matriz|m2|mae'];
  exigir(up && JSON.stringify(up.dados.map(chave).sort()) === JSON.stringify(esperado) && up.dados.every((x) => x.mes === '2026-10-01' && x.arquivo === 'ESCALA OUTUBRO.pdf'),
    'grava o mês de outubro: Cristiana (mãe do João) e as duas Ritas, agora casadas com a Bia', JSON.stringify(up && up.dados));
  exigir(up && up.op && up.op.onConflict === 'data,horario,comunidade,membro_id', 'a escala usa upsert pela chave única da tabela', JSON.stringify(up && up.op));
  const del = esc.find((g) => g.acao === 'delete');
  exigir(del && JSON.stringify(del.filtros) === JSON.stringify([['in', 'id', ['e2']]]),
    'tira do mês só a linha velha que não veio no PDF novo (e2)', JSON.stringify(del));
  exigir(up && del && esc.indexOf(up) < esc.indexOf(del), 'as velhas saem DEPOIS de as novas estarem gravadas', JSON.stringify(esc.map((g) => g.acao)));
  const final = (r.estadoFinal || {}).acolitos_escala_ministros || [];
  exigir(final.some((x) => x.id === 'e9') && final.some((x) => x.id === 'e1') && !final.some((x) => x.id === 'e2') && final.length === 4,
    'no fim: setembro intacto, e1 continua, e2 saiu, 4 linhas no total', JSON.stringify(final.map((x) => x.id + ':' + x.data + ':' + x.membro_id)));
  const esqueceu = de(r, 'acolitos_ministro_apelidos', 'delete').length + de(r, 'acolitos_membros').length;
  exigir(esqueceu === 0, 'não apaga nome lembrado nem mexe em membro', JSON.stringify(r.gravacoes));

  // Antes do clique: a revisão em si (reconhecidos, dúvida com as 3 opções)
  const rv = await provas.abrir('config.html', {
    bancoVivo: true, tabelas: tabelasMinistros(),
    passos: subirPdf(PDF_BOM, [{ esperarTexto: 'Dúvidas', ate: 15000 }]),
    avaliar: `return { secoes: [...document.querySelectorAll('.tm-revisao .tc-secao')].map((e) => e.textContent),
      reconhecidos: [...document.querySelectorAll('.tm-revisao .tc-lista .tc-tit')].map((e) => e.textContent),
      opcoes: [...document.querySelectorAll('.tm-duvida label')].map((e) => e.textContent),
      resumo: document.querySelector('.tm-revisao .tc-st-big')?.textContent };`,
  });
  semErros(rv, 'revisão');
  const a = rv.avaliado || {};
  exigir(a.resumo === 'outubro de 2026', 'a revisão diz o mês lido (outubro de 2026)', JSON.stringify(a));
  exigir(JSON.stringify(a.reconhecidos) === JSON.stringify(['João · mãe (Cristiana M.)']), 'reconhecidos: só a Cristiana, mãe do João', JSON.stringify(a.reconhecidos));
  exigir(JSON.stringify(a.opcoes) === JSON.stringify(['mãe de Bia', 'mãe de Caio', 'Nenhum deles']), 'a dúvida "Rita E." oferece mãe da Bia, mãe do Caio e Nenhum deles', JSON.stringify(a.opcoes));
  exigir(escritas(rv).length === 0, 'só revisar não grava nada', JSON.stringify(rv.gravacoes));

  // Gravar o mês falha: as velhas NÃO saem (o mês anterior fica inteiro)
  const f = await provas.abrir('config.html', {
    bancoVivo: true, tabelas: tabelasMinistros(), falhar: { 'acolitos_escala_ministros:upsert': { message: 'recusado' } },
    passos: subirPdf(PDF_BOM, [{ esperarTexto: 'Dúvidas', ate: 15000 }, { marcar: 'mãe de Bia' }, { clicar: 'Confirmar e salvar' }, { esperarDito: 'toast:Não foi possível', ate: 10000 }]),
  });
  semErros(f, 'gravar falha', ['Ministros: gravar a escala dos ministros']);
  exigir(de(f, 'acolitos_escala_ministros', 'delete').length === 0, 'gravar a escala falhou: nenhuma linha velha é apagada', JSON.stringify(f.gravacoes));
  exigir(((f.estadoFinal || {}).acolitos_escala_ministros || []).length === 3, 'e o mês continua com as 3 linhas de antes', JSON.stringify(f.estadoFinal && f.estadoFinal.acolitos_escala_ministros));
  exigir((f.ditos || []).includes('toast:Não foi possível gravar a escala dos ministros.'), 'e a pessoa lê que não gravou', JSON.stringify(f.ditos));

  // PDF sem dias/horários e arquivo que nem é PDF: a mensagem aparece e NADA é gravado
  for (const [arquivo, msg, nome] of [
    [PDF_SEM_DIAS, 'Não encontrei dias e horários neste PDF. Nada foi gravado.', 'PDF sem dias e horários'],
    [PDF_QUEBRADO, 'Não consegui ler este PDF.', 'arquivo que não é PDF'],
  ]) {
    const x = await provas.abrir('config.html', { bancoVivo: true, tabelas: tabelasMinistros(),
      passos: subirPdf(arquivo, [{ esperarTexto: msg, ate: 15000 }]),
      avaliar: `return { botao: [...document.querySelectorAll('.tm-revisao button')].map((b) => b.textContent) };` });
    semErros(x, nome, ['Ministros: ler PDF']);
    exigir(!(x.passosFalhos || []).length, nome + ': a tela diz "' + msg + '"', JSON.stringify(x.passosFalhos) + ' ' + (x.texto || '').slice(-300));
    exigir(escritas(x).length === 0, nome + ': nada é gravado', JSON.stringify(x.gravacoes));
    exigir(!(x.avaliado && x.avaliado.botao || []).includes('Confirmar e salvar'), nome + ': não oferece "Confirmar e salvar"', JSON.stringify(x.avaliado));
  }
}

// ── 2. Nomes lembrados: Remover → confirmar ─────────────────────────────────────────────
async function provaNomesLembrados(provas) {
  console.log('\n\x1b[1mNomes lembrados: Remover pede confirmação e apaga só aquela linha\x1b[0m');
  const agora = '2026-10-20T12:00:00Z';
  const tabelas = {
    acolitos_membros: { data: MEMBROS },
    acolitos_ministro_apelidos: { data: [
      { id: 'ap1', nome_pdf: 'cristiana m.', membro_id: 'm1', pai_ou_mae: 'mae', resposta: 'sim', respondido_por: 'app', em: agora },
      { id: 'ap2', nome_pdf: 'rita e.', membro_id: 'm3', pai_ou_mae: 'mae', resposta: 'nao', respondido_por: '5519999990000', em: agora },
    ] },
  };
  const linhas = `return [...document.querySelectorAll('.tc-lista .tc-linha .tc-tit')].map((e) => e.textContent);`;
  const r = await provas.abrir('config.html', { bancoVivo: true, tabelas, avaliar: linhas,
    passos: [{ chamar: 'abrirSecao', args: ['tarcisio_nomes'] }, { clicar: 'Remover' }, { responder: 'Confirmar' }, { esperarDito: 'toast:Nome esquecido', ate: 10000 }] });
  semErros(r, 'remover');
  exigir((r.ditos || []).some((d) => d.startsWith('confirm:Esquecer “cristiana m.”')), 'pergunta antes de esquecer "cristiana m."', JSON.stringify(r.ditos));
  const del = de(r, 'acolitos_ministro_apelidos', 'delete');
  exigir(del.length === 1 && JSON.stringify(del[0].filtros) === JSON.stringify([['eq', 'id', 'ap1']]), 'apaga pelo id daquela linha (ap1), e só ela', JSON.stringify(del));
  exigir(JSON.stringify(r.avaliado) === JSON.stringify(['“rita e.” não é mãe de Caio']), 'a linha some da lista; a outra fica', JSON.stringify(r.avaliado));
  exigir(JSON.stringify(((r.estadoFinal || {}).acolitos_ministro_apelidos || []).map((x) => x.id)) === JSON.stringify(['ap2']), 'no banco sobra só ap2', JSON.stringify(r.estadoFinal));
  exigir((r.ditos || []).includes('toast:Nome esquecido.'), 'diz "Nome esquecido."', JSON.stringify(r.ditos));

  const c = await provas.abrir('config.html', { bancoVivo: true, tabelas, avaliar: linhas,
    passos: [{ chamar: 'abrirSecao', args: ['tarcisio_nomes'] }, { clicar: 'Remover' }, { responder: 'Cancelar' }] });
  semErros(c, 'cancelar');
  exigir(escritas(c).length === 0 && (c.avaliado || []).length === 2, 'Cancelar no diálogo: nada é apagado, as duas linhas ficam', JSON.stringify([c.gravacoes, c.avaliado]));

  const f = await provas.abrir('config.html', { bancoVivo: true, tabelas, avaliar: linhas, falhar: { 'acolitos_ministro_apelidos:delete': { message: 'recusado' } },
    passos: [{ chamar: 'abrirSecao', args: ['tarcisio_nomes'] }, { clicar: 'Remover' }, { responder: 'Confirmar' }, { esperarDito: 'toast:Não foi possível', ate: 10000 }] });
  exigir((f.avaliado || []).length === 2 && (f.ditos || []).includes('toast:Não foi possível remover o nome.'), 'banco recusa: a linha continua na tela e a pessoa lê o erro', JSON.stringify([f.avaliado, f.ditos]));
}

// ── 3. WhatsApp: campos da escala automática ───────────────────────────────────────────
const CONFIG_TARCISIO = {
  id: 1, pausado: false, teto_diario: 150, janela_inicio: '08:00:00', janela_fim: '21:00:00', hora_lembrete: '19:00:00',
  hora_aniversario: '08:00:00', escala_ligada: true, lembrete_ligado: true, aniversario_ligado: true, conexao: 'open',
  numero_conectado: '5519998765432', robo_visto_em: new Date().toISOString(),
  numero_conferencia: '5519999990000', remetentes_pdf: [], ausencia_horas: ['09:00', '18:00'], ausencia_ultimo: '15:00', ausencia_texto: null,
};
async function provaWhatsappEscalaAutomatica(provas) {
  console.log('\n\x1b[1mWhatsApp: os campos da escala automática salvam normalizados e o inválido é barrado\x1b[0m');
  const abrir = (campos, fim) => provas.abrir('config.html', {
    bancoVivo: true, tabelas: { tarcisio_config: { data: [CONFIG_TARCISIO] }, tarcisio_envios: { data: [] } },
    passos: [{ chamar: 'abrirSecao', args: ['tarcisio_whatsapp'] },
      ...Object.entries(campos).map(([rotulo, valor]) => ({ preencher: rotulo, valor })),
      { clicar: 'Salvar' }, { esperarDito: fim, ate: 10000 }],
  });
  const r = await abrir({
    'Número que recebe a conferência': '(19) 98765-4321',
    'Outros números que podem mandar o PDF': '19 3456-7890\n\n (11) 91234-5678 ',
    'Horários do aviso de ausência': '9:00, 18:30',
    'Último aviso': '9:30',
    'Texto do aviso': '  Avisem as ausências até terça!  ',
  }, 'toast:Salvo.');
  semErros(r, 'salvar');
  const up = de(r, 'tarcisio_config', 'update');
  const d = up.length ? up[0].dados : {};
  exigir(up.length === 1 && JSON.stringify(up[0].filtros) === JSON.stringify([['eq', 'id', 1]]), 'uma gravação, na linha id=1 de tarcisio_config', JSON.stringify(up));
  exigir(d.numero_conferencia === '5519987654321', 'número da conferência vira 55 + DDD + número', d.numero_conferencia);
  exigir(JSON.stringify(d.remetentes_pdf) === JSON.stringify(['551934567890', '5511912345678']), 'remetentes do PDF: um por linha, linhas vazias fora, todos com 55', JSON.stringify(d.remetentes_pdf));
  exigir(JSON.stringify(d.ausencia_horas) === JSON.stringify(['09:00', '18:30']) && d.ausencia_ultimo === '09:30', 'horários com zero à esquerda (9:00 → 09:00)', JSON.stringify([d.ausencia_horas, d.ausencia_ultimo]));
  exigir(d.ausencia_texto === 'Avisem as ausências até terça!', 'texto do aviso sem espaços nas pontas', JSON.stringify(d.ausencia_texto));
  exigir((r.ditos || []).includes('toast:Salvo.'), 'diz "Salvo."', JSON.stringify(r.ditos));

  for (const [campos, msg, nome] of [
    [{ 'Número que recebe a conferência': '123' }, 'alert:Número inválido. Use DDD + número', 'número curto demais'],
    [{ 'Outros números que podem mandar o PDF': '(19) 98765-4321\nabc' }, 'alert:Número inválido na lista de remetentes: abc', 'remetente inválido'],
    [{ 'Horários do aviso de ausência': '09:00, 25:00' }, 'alert:Horários inválidos', 'horário 25:00'],
    [{ 'Horários do aviso de ausência': '' }, 'alert:Horários inválidos', 'nenhum horário'],
    [{ 'Último aviso': '15h' }, 'alert:Horário do último aviso inválido', 'último aviso "15h"'],
  ]) {
    const x = await abrir(campos, msg);
    semErros(x, nome);
    exigir(de(x, 'tarcisio_config').length === 0 && (x.ditos || []).some((t) => t.startsWith(msg)), nome + ': barrado com a mensagem, nada gravado', JSON.stringify([x.gravacoes, x.ditos]));
  }
}

// ── 4. Regras do gerador: Mínimo por mês ───────────────────────────────────────────────
async function provaMinimoPorMes(provas) {
  console.log('\n\x1b[1mRegras do gerador: "Mínimo por mês" salva gerador.minimo_mes (1 a 8) sem perder janela e kits\x1b[0m');
  const KITS = [{ id: 'proc', nome: 'Kit processional', ativo: true, modo: 'trava', comunidades: ['matriz'], funcoes: ['cruz', 'vela'], idade_min: 14, liberados: ['m1'] }];
  const abrir = (valor) => provas.abrir('config.html', {
    config: { gerador: { janela_dias: 28, minimo_mes: 2, kits: KITS } },
    passos: [{ chamar: 'abrirSecao', args: ['gerador'] }, { preencher: 'Mínimo por mês', valor }, { clicar: 'Salvar regras' }, { esperarDito: 'toast:✓ Salvo!', ate: 10000 }],
  });
  for (const [valor, esperado] of [['3', 3], ['12', 8], ['-3', 1]]) {
    const r = await abrir(valor);
    semErros(r, 'mínimo ' + valor);
    const up = de(r, 'acolitos_config', 'upsert').find((g) => g.dados.chave === 'gerador');
    const v = up ? up.dados.valor : {};
    exigir(v.minimo_mes === esperado, `"${valor}" grava minimo_mes = ${esperado}`, JSON.stringify(v));
    exigir(v.janela_dias === 28 && JSON.stringify(v.kits) === JSON.stringify(KITS), `"${valor}": janela_dias (28) e kits continuam os mesmos`, JSON.stringify(v));
    exigir(up && up.op && up.op.onConflict === 'chave', `"${valor}": upsert pela chave`, JSON.stringify(up && up.op));
  }
}

// ── 5. Escala: Confirmar escala da semana, pelo botão de verdade ──────────────────────
// Banco vivo + /api/enviar-push de mentira: a 1ª confirmação avisa só quem falta e grava os
// avisados; a 2ª não avisa ninguém. E com o push falhando, ninguém é marcado.
function proximoSabado() {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + (((6 - d.getDay()) + 7) % 7 || 7));
  const iso = (x) => [x.getFullYear(), String(x.getMonth() + 1).padStart(2, '0'), String(x.getDate()).padStart(2, '0')].join('-');
  const dom = new Date(d); dom.setDate(d.getDate() + 1);
  return [iso(d), iso(dom)];
}
async function provaConfirmarPeloBotao(provas) {
  console.log('\n\x1b[1mEscala: "Confirmar escala da semana" pelo botão — avisa só quem falta, e só uma vez\x1b[0m');
  const [sab, dom] = proximoSabado();
  const pessoa = (id, nome) => ({ id, nome, status: 'ativo', serve: true, comunidade: 'matriz', nivel: 'acolito' });
  const membros = [pessoa('m-a', 'Ana'), pessoa('m-b', 'Bruno'), pessoa('m-c', 'Caio')];
  const esc = (id, cel, m, f) => ({ id, celebracao_id: cel, membro_id: m, funcao: f, status: 'escalado', acolitos_membros: { id: m, nome: membros.find((x) => x.id === m).nome } });
  const tabelas = () => ({
    acolitos_celebracoes: { data: [
      { id: 'c1', data: sab, horario: '17h', minutos: 1020, comunidade: 'matriz', tipo: 'missa_comum' },
      { id: 'c2', data: dom, horario: '9h', minutos: 540, comunidade: 'matriz', tipo: 'missa_comum' },
    ] },
    acolitos_escalas: { data: [esc('s1', 'c1', 'm-a', 'cruz'), esc('s2', 'c1', 'm-b', 'vela'), esc('s3', 'c2', 'm-c', 'cruz')] },
    acolitos_membros: { data: membros },
    acolitos_config: { data: [{ chave: 'escala_avisados', valor: { [sab]: ['m-a'] } }] },
  });
  const pushes = (r) => (r.chamadasApi || []).filter((c) => c.rota === '/api/enviar-push');
  const confirmar = (fim) => [{ clicar: 'Confirmar escala da semana' }, { responder: 'Confirmar' }, { esperarDito: fim, ate: 15000 }];
  const r = await provas.abrir('escala.html', {
    bancoVivo: true, tabelas: tabelas(), rpcs: { tarcisio_pedir_escala: { data: { ok: true, novo: false } } },
    apis: { '/api/enviar-push': { ok: true }, '/api/regenerar-arte': { ok: true } },
    passos: [...confirmar('toast:✓ 2 pessoas avisadas'), { clicar: 'Confirmar escala da semana' }, { esperarDito: 'alert:Todo mundo', ate: 15000 }, { responder: 'OK' }],
  });
  semErros(r, 'confirmar duas vezes');
  const p = pushes(r);
  exigir(p.length === 2 && JSON.stringify(p.map((x) => x.corpo.membros[0]).sort()) === JSON.stringify(['m-b', 'm-c']) && p.every((x) => x.corpo.tipo === 'escalado' && x.corpo.membros.length === 1),
    '1º toque: um push "escalado" para Bruno e um para Caio; Ana (já avisada) não recebe', JSON.stringify(p));
  const ups = de(r, 'acolitos_config', 'upsert');
  exigir(ups.length === 1 && JSON.stringify(ups[0].dados.valor[sab].slice().sort()) === JSON.stringify(['m-a', 'm-b', 'm-c']),
    'grava os avisados (os de antes + os novos), uma vez só', JSON.stringify(ups));
  exigir((r.ditos || []).some((d) => d.startsWith('confirm:Avisar 2 pessoas')) && (r.ditos || []).includes('toast:✓ 2 pessoas avisadas'), 'pergunta "Avisar 2 pessoas" e diz quantos foram avisados', JSON.stringify(r.ditos));
  exigir((r.ditos || []).includes('alert:Todo mundo desta semana já foi avisado. Ninguém recebeu aviso repetido.'), '2º toque: ninguém recebe push e a tela diz que todos já foram avisados', JSON.stringify(r.ditos));
  exigir((r.ditos || []).filter((d) => d.startsWith('confirm:')).length === 1, '2º toque nem pergunta (não há a quem avisar)', JSON.stringify(r.ditos));

  const f = await provas.abrir('escala.html', {
    bancoVivo: true, tabelas: tabelas(), rpcs: { tarcisio_pedir_escala: { data: { ok: true, novo: false } } },
    apis: { '/api/enviar-push': { __status: 500, erro: 'caiu' } },
    passos: confirmar('alert:Não foi possível enviar os avisos'),
  });
  semErros(f, 'push falha', ['status of 500']);
  exigir(pushes(f).length === 2, 'push falhando: tentou os dois', JSON.stringify(f.chamadasApi));
  exigir(de(f, 'acolitos_config').length === 0 && JSON.stringify(f.estadoFinal.acolitos_config[0].valor[sab]) === JSON.stringify(['m-a']), 'push falhou: ninguém é marcado como avisado', JSON.stringify(f.gravacoes));
  exigir(!de(f, 'rpc:tarcisio_pedir_escala').length, 'push falhou: a arte não é pedida', JSON.stringify(f.gravacoes));
}

// ── Partida ─────────────────────────────────────────────────────────────────────────────
const provas = await iniciarProvas();
const comecou = Date.now();
// Uma só: node …/fluxos-escala-automatica.prova.mjs ministros|nomes|whatsapp|minimo|confirmar
const so = process.argv[2] || null;
const TODAS = { ministros: provaMinistrosPdf, nomes: provaNomesLembrados, whatsapp: provaWhatsappEscalaAutomatica,
  minimo: provaMinimoPorMes, confirmar: provaConfirmarPeloBotao };
try {
  if (so && !TODAS[so]) throw new Error('prova desconhecida: ' + so + ' (use ' + Object.keys(TODAS).join('|') + ')');
  for (const [nome, prova] of Object.entries(TODAS)) if (!so || so === nome) await prova(provas);
} finally {
  await provas.encerrar();
  fs.rmSync(PASTA, { recursive: true, force: true });
}
const falhas = resultados.filter((r) => !r.ok);
console.log('\n' + '─'.repeat(60));
console.log(resultados.length + ' provas de fluxo em ' + Math.round((Date.now() - comecou) / 1000) + 's — ' + (resultados.length - falhas.length) + ' passaram, ' + falhas.length + ' falharam');
if (falhas.length) falhas.forEach((x) => console.log('  ✖ ' + x.titulo));
process.exit(falhas.length ? 1 : 0);
