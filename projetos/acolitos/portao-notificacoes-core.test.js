// Testes do portão de notificações: quem entra no app e quem para na parede.
// Rodar: node --test projetos/acolitos/portao-notificacoes-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { decidirPortaoNotificacoes } = require('./portao-notificacoes-core.js');

// Situação de um celular normal, com o sino ligado. Cada teste muda só o que interessa.
const sit = (o) => Object.assign({
  suporte: 'ok', permissao: 'granted', iosSemInstalar: false, inscrito: true, etapaCrm: null,
}, o);

test('quem tem o sino ligado entra', () => {
  const r = decidirPortaoNotificacoes(sit({}));
  assert.strictEqual(r.entra, true);
  assert.strictEqual(r.parede, null);
});

test('quem ainda pode ser perguntado para na parede que pede', () => {
  const r = decidirPortaoNotificacoes(sit({ permissao: 'default', inscrito: false }));
  assert.strictEqual(r.entra, false);
  assert.strictEqual(r.parede, 'pedir');
});

test('quem tocou em "Não permitir" para na parede da receita — não entra', () => {
  const r = decidirPortaoNotificacoes(sit({ permissao: 'denied', inscrito: false }));
  assert.strictEqual(r.entra, false);
  assert.strictEqual(r.parede, 'negado');
});

// O caso que mais vai acontecer: a pessoa desativou em Minha Conta, ou a linha do banco
// sumiu. A permissão continua dada, mas ela NÃO recebe nada — então não pode entrar.
test('permissão dada mas sem inscrição no banco = parede', () => {
  const r = decidirPortaoNotificacoes(sit({ permissao: 'granted', inscrito: false }));
  assert.strictEqual(r.entra, false);
  assert.strictEqual(r.parede, 'pedir');
});

test('iPhone aberto no navegador manda instalar na Tela de Início', () => {
  const r = decidirPortaoNotificacoes(sit({ iosSemInstalar: true, permissao: 'default', inscrito: false }));
  assert.strictEqual(r.parede, 'instalar-ios');
});

// A ARMADILHA: no iPhone fora do app instalado, o próprio Safari diz "não suportado" e às
// vezes "negado". Se a ordem das perguntas estiver errada, a parede manda a pessoa abrir no
// celular (ela JÁ está no celular) ou mexer no Ajustes (não é lá que resolve). Instalar é a
// única saída, e por isso essa pergunta vem antes das outras duas.
test('iPhone no navegador vence "não suportado"', () => {
  const r = decidirPortaoNotificacoes(sit({ iosSemInstalar: true, suporte: 'nao-suportado', inscrito: false }));
  assert.strictEqual(r.parede, 'instalar-ios');
});

test('iPhone no navegador vence "negado"', () => {
  const r = decidirPortaoNotificacoes(sit({ iosSemInstalar: true, permissao: 'denied', inscrito: false }));
  assert.strictEqual(r.parede, 'instalar-ios');
});

test('navegador sem suporte manda abrir pelo celular', () => {
  const r = decidirPortaoNotificacoes(sit({ suporte: 'nao-suportado', permissao: 'default', inscrito: false }));
  assert.strictEqual(r.parede, 'sem-suporte');
});

// A ÚNICA isenção combinada: quem ainda espera aprovação do cadastro não é membro, não é
// escalado e não tem o que receber. Travar essa pessoa seria trancá-la antes de ela entrar.
test('quem aguarda aprovação do cadastro entra sem o sino', () => {
  const r = decidirPortaoNotificacoes(sit({ etapaCrm: 'aprovacao_cadastro', permissao: 'denied', inscrito: false }));
  assert.strictEqual(r.entra, true);
  assert.strictEqual(r.parede, null);
});

test('a isenção do cadastro vale até no navegador sem suporte', () => {
  const r = decidirPortaoNotificacoes(sit({ etapaCrm: 'aprovacao_cadastro', suporte: 'nao-suportado', inscrito: false }));
  assert.strictEqual(r.entra, true);
});

// Ninguém mais escapa: nem coordenação, nem superadmin. O portão nem pergunta o papel.
test('quem já passou da aprovação não tem isenção nenhuma', () => {
  const r = decidirPortaoNotificacoes(sit({ etapaCrm: 'formacao', permissao: 'default', inscrito: false }));
  assert.strictEqual(r.entra, false);
});

// Sem situação nenhuma o portão não pode LIBERAR por engano: na dúvida, ele fecha.
test('sem informação o portão fecha', () => {
  assert.strictEqual(decidirPortaoNotificacoes().entra, false);
  assert.strictEqual(decidirPortaoNotificacoes({}).entra, false);
});

// ── Gravar a inscrição de push ─────────────────────────────────────────────────────────────
// Caso real (05/11/2026, Jullyana): o aparelho já tinha uma inscrição gravada por OUTRA conta
// (celular compartilhado em família). A tabela só deixa cada conta mexer nas próprias linhas, o
// upsert por endpoint era negado e a parede ficava para sempre em "Ativar" sem dizer nada.
const { registrarInscricaoPush, explicarFalhaNotificacao } = require('./portao-notificacoes-core.js');

const subDe = (o) => Object.assign({ endpoint: 'https://push.test/abc', toJSON() { return { keys: { p256dh: 'P', auth: 'A' } }; } }, o);
function bancoPush({ rpc, upsert }) {
  const chamadas = [];
  return {
    chamadas,
    rpc: async (nome, args) => { chamadas.push(['rpc', nome, args]); if (rpc instanceof Error) throw rpc; return rpc; },
    from: (tabela) => ({ upsert: async (linha, opcoes) => { chamadas.push(['upsert', tabela, linha, opcoes]); return upsert || { error: null }; } }),
  };
}

test('grava pela função do banco (que sabe trocar o dono do aparelho)', async () => {
  const sb = bancoPush({ rpc: { error: null } });
  const r = await registrarInscricaoPush(sb, 'u1', subDe(), 'UA');
  assert.deepStrictEqual(r, { ok: true, via: 'rpc' });
  assert.deepStrictEqual(sb.chamadas[0], ['rpc', 'acolitos_push_registrar', { p_endpoint: 'https://push.test/abc', p_p256dh: 'P', p_auth: 'A', p_user_agent: 'UA' }]);
  assert.strictEqual(sb.chamadas.length, 1, 'não faz upsert por cima');
});

test('função ainda não existe no banco (migration não rodou): cai para o upsert de antes', async () => {
  for (const erro of [{ code: 'PGRST202', message: 'Could not find the function' }, { code: '42883', message: 'function does not exist' }]) {
    const sb = bancoPush({ rpc: { error: erro } });
    const r = await registrarInscricaoPush(sb, 'u1', subDe(), 'UA');
    assert.deepStrictEqual(r, { ok: true, via: 'upsert' });
    assert.deepStrictEqual(sb.chamadas[1][2], { user_id: 'u1', endpoint: 'https://push.test/abc', p256dh: 'P', auth: 'A', user_agent: 'UA' });
    assert.deepStrictEqual(sb.chamadas[1][3], { onConflict: 'endpoint' });
  }
});

test('rede cai na chamada da função: tenta o upsert em vez de desistir', async () => {
  const sb = bancoPush({ rpc: new Error('Failed to fetch') });
  assert.deepStrictEqual(await registrarInscricaoPush(sb, 'u1', subDe(), 'UA'), { ok: true, via: 'upsert' });
});

test('aparelho de outra conta com chaves diferentes: recusa e diz o motivo', async () => {
  const sb = bancoPush({ rpc: { error: { code: '42501', message: 'inscrição de outro aparelho' } } });
  const r = await registrarInscricaoPush(sb, 'u1', subDe(), 'UA');
  assert.deepStrictEqual(r, { ok: false, via: 'rpc', motivo: 'outro-aparelho', detalhe: '42501' });
  assert.strictEqual(sb.chamadas.length, 1, 'não tenta o upsert depois de uma recusa de segurança');
});

test('erro qualquer da função vira "salvar" com o código', async () => {
  const sb = bancoPush({ rpc: { error: { code: '57014', message: 'timeout' } } });
  assert.deepStrictEqual(await registrarInscricaoPush(sb, 'u1', subDe(), 'UA'), { ok: false, via: 'rpc', motivo: 'salvar', detalhe: '57014' });
});

test('upsert de reserva que falha devolve o código do erro', async () => {
  const sb = bancoPush({ rpc: { error: { code: 'PGRST202', message: 'x' } }, upsert: { error: { code: '42501', message: 'rls' } } });
  assert.deepStrictEqual(await registrarInscricaoPush(sb, 'u1', subDe(), 'UA'), { ok: false, via: 'upsert', motivo: 'salvar', detalhe: '42501' });
});

test('todo motivo tem uma frase que diz o que fazer, e o código aparece quando existe', () => {
  for (const m of ['permissao', 'suporte', 'sw', 'inscricao', 'outro-aparelho', 'salvar', 'qualquer-outro']) {
    const t = explicarFalhaNotificacao(m, 'X123');
    assert.ok(typeof t === 'string' && t.length > 30, m);
    assert.ok(!/undefined|null/.test(t), m);
  }
  assert.match(explicarFalhaNotificacao('salvar', 'X123'), /X123/);
  assert.doesNotMatch(explicarFalhaNotificacao('permissao', 'X123'), /X123/, 'motivo que a pessoa resolve sozinha não mostra código');
});
