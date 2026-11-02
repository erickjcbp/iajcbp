import { iniciarProvas } from './abrir-tela.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out = new URL('../../../estudos/cadastro-joao-marcos-2026-11-01/provas/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
const env = await iniciarProvas();
try {
  for (const largura of [360, 390, 768, 1366, 2560]) {
    const r = await env.abrir('novos.html', {
      largura, sessao: { user: { id: 'u1' }, access_token: 'token-de-teste' },
      tabelas: { pastoral_modules: { data: [{ id: 'modulo' }] }, pastoral_members: { data: [] } },
      apis: { '/api/reconhecer-cadastro': { situacao: 'travado' } },
      avaliar: `
        document.getElementById('splash')?.remove();
        document.getElementById('r-cel-mae').value='';document.getElementById('r-cel-recado').value='';document.getElementById('m1-nome').value = 'Pessoa de Teste';
        document.getElementById('m1-nasc').value = '2020-01-01';
        await enviarCadastro();
        document.getElementById('msg-cadastro').scrollIntoView({block:'center'});
        return {mensagem:document.getElementById('msg-cadastro').textContent,botaoAtivo:!document.getElementById('btn-cadastrar').disabled,overflow:document.documentElement.scrollWidth>innerWidth};`,
      foto: { caminho: new URL('bloqueio-' + largura + '.png', out).pathname, viewport: true }
    });
    assert.equal(r.erroAvaliar, null);
    assert.match(r.avaliado.mensagem, /limite de tentativas/i);
    assert.equal(r.avaliado.botaoAtivo, true);
    assert.equal(r.avaliado.overflow, false);
    assert.equal(r.gravacoes.length, 0, 'bloqueio não insere ficha ou CRM');
    assert.equal(r.erros.length, 0, JSON.stringify(r.erros));
  }
  // Resposta desconhecida também não pode autorizar uma ficha nova.
  const r = await env.abrir('novos.html', {
    sessao: { user: { id: 'u1' }, access_token: 'token-de-teste' },
    tabelas: { pastoral_modules: { data: [{ id: 'modulo' }] } },
    apis: { '/api/reconhecer-cadastro': { situacao: 'inesperada' } },
    avaliar: `document.getElementById('r-cel-mae').value='';document.getElementById('r-cel-recado').value='';document.getElementById('m1-nome').value='Pessoa de Teste';document.getElementById('m1-nasc').value='2020-01-01';await enviarCadastro();return document.getElementById('msg-cadastro').textContent;`
  });
  assert.equal(r.erroAvaliar, null);
  assert.match(r.avaliado, /Não consegui confirmar/);
  assert.equal(r.gravacoes.length, 0);
  console.log('PASS: limite e resposta desconhecida não criam ficha/CRM; fotos em cinco larguras, sem overflow.');
} finally { await env.encerrar(); }
