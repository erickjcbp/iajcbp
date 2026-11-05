// Prova de tela do tutorial guiado do membro. Rodar: node projetos/acolitos/provas/tutorial.prova.mjs
// Cobre o que um teste de regra não vê: botão ? só onde deve, abre sozinho uma vez por tela, grava "já vi" pelo banco
// (defeito vivido: o cliente `sb` é const do shared.js e NÃO está em window), nada estoura a largura e alvos de 44 px.
import assert from 'node:assert/strict';
import { iniciarProvas, PAPEIS } from './abrir-tela.mjs';

const TELAS = { home: 'index.html', missoes: 'missoes.html', 'escalas-membro': 'escalas-membro.html', agenda: 'agenda.html', conquistas: 'conquistas.html', destaques: 'destaques.html' };
const ESPERA = { home: 'Minhas Próximas Escalas', missoes: 'Sua próxima descoberta', 'escalas-membro': 'Minhas missas', agenda: 'Calendário', conquistas: 'INSÍGNIAS DE NÍVEL', destaques: 'Servos do Altar' };
const gravouTutorial = (r) => (r.gravacoes || []).filter((g) => /tutorial/.test(g.tabela)).map((g) => g.dados);
const p = await iniciarProvas();
let falhas = 0;
async function prova(nome, fn) { try { await fn(); console.log('  \x1b[32m✔\x1b[0m ' + nome); } catch (e) { falhas++; console.log('  \x1b[31m✖\x1b[0m ' + nome + '\n      ' + e.message); } }
try {
  for (const [tela, arquivo] of Object.entries(TELAS)) {
    await prova(`${arquivo}: membro vê o ? e o tutorial abre sozinho na primeira vez; Pular grava "${tela}" no banco`, async () => {
      const r = await p.abrir(arquivo, { papel: PAPEIS.membro, passos: [{ esperarTexto: 'Pular', ate: 25000 }, { esperarTexto: ESPERA[tela], ate: 15000 }, { responder: 'Pular' }] });
      assert.deepEqual(r.passosFalhos, []);
      assert.deepEqual(r.erros, []);
      assert.deepEqual(gravouTutorial(r), [{ p_membro: 'm1', p_tela: tela }]);
    });
  }
  for (const [tela, arquivo] of Object.entries(TELAS)) {
    await prova(`${arquivo}: todo passo que aponta para algo na tela acha o alvo (nenhum cai no centro por engano)`, async () => {
      const r = await p.abrir(arquivo, { papel: PAPEIS.membro, passos: [{ esperarTexto: 'Pular', ate: 25000 }, { esperarTexto: ESPERA[tela], ate: 15000 }],
        avaliar: `const def=window.TutorialCore.tutorialDa(${JSON.stringify(tela)});return def.passos.filter(p=>p.ancora||p.seletor).filter(p=>!window.TutorialGuiado.achar(p)).map(p=>p.ancora||p.seletor)` });
      assert.deepEqual(r.avaliado, []);
    });
  }
  await prova('concluir a Home até "Entendi!" grava uma vez só', async () => {
    const r = await p.abrir('index.html', { papel: PAPEIS.membro, passos: [{ esperarTexto: 'Pular', ate: 25000 }, { esperarTexto: ESPERA.home, ate: 15000 }, ...Array(5).fill({ responder: 'Próximo' }), { responder: 'Entendi!' }] });
    assert.deepEqual(r.passosFalhos, []);
    assert.equal(gravouTutorial(r).length, 1);
  });
  await prova('minha-casa não tem tutorial nem botão ?', async () => {
    const r = await p.abrir('minha-casa.html', { papel: PAPEIS.membro, avaliar: `await new Promise(r=>setTimeout(r,6000));return {ajuda:!!document.getElementById('tutorial-ajuda'),balao:!!document.getElementById('tutorial-guiado')}` });
    assert.deepEqual(r.avaliado, { ajuda: false, balao: false });
  });
  await prova('coordenação (equipe) não recebe tutorial nem botão ?', async () => {
    const r = await p.abrir('agenda.html', { papel: PAPEIS.equipe, avaliar: `await new Promise(r=>setTimeout(r,6000));return {ajuda:!!document.getElementById('tutorial-ajuda'),balao:!!document.getElementById('tutorial-guiado')}` });
    assert.deepEqual(r.avaliado, { ajuda: false, balao: false });
    assert.deepEqual(gravouTutorial(r), []);
  });
  await prova('já visto = não abre sozinho, mas o ? reabre', async () => {
    const r = await p.abrir('agenda.html', { papel: PAPEIS.membro, tabelas: {}, antes: undefined,
      avaliar: `document.getElementById('splash')?.remove();return !!document.getElementById('tutorial-ajuda')` });
    assert.equal(r.avaliado, true);
  });
  for (const largura of [360, 390, 768, 1366, 2560]) {
    await prova(`${largura}px: balão cabe, sem rolagem horizontal, botões de 44 px ou mais`, async () => {
      const r = await p.abrir('index.html', { papel: PAPEIS.membro, largura, altura: largura > 1000 ? 1000 : 800, passos: [{ esperarTexto: 'Pular', ate: 25000 }, { esperarTexto: ESPERA.home, ate: 15000 }, { responder: 'Próximo' }],
        avaliar: `const b=document.querySelector('#tutorial-guiado .tg-balao').getBoundingClientRect();const bt=[...document.querySelectorAll('#tutorial-guiado button')].map(x=>x.getBoundingClientRect());return {estoura:document.documentElement.scrollWidth>window.innerWidth,dentro:b.left>=0&&b.right<=window.innerWidth&&b.top>=0&&b.bottom<=window.innerHeight,minAlt:Math.min(...bt.map(x=>x.height)),minLarg:Math.min(...bt.map(x=>x.width))}` });
      assert.equal(r.avaliado.estoura, false);
      assert.equal(r.avaliado.dentro, true);
      assert.ok(r.avaliado.minAlt >= 44 && r.avaliado.minLarg >= 44, JSON.stringify(r.avaliado));
    });
  }
} finally { await p.encerrar(); }
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
