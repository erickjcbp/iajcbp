// Provas da regra "confirmar a escala da semana" (confirmar-semana-core.js), usada pela tela e
// pelo robô. Banco e push de mentira; nada sai daqui.
// Rodar: node --test projetos/acolitos/confirmar-semana-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('./confirmar-semana-core.js');

// Fim de semana de 24–25/10/2026: chave = menor data (24), domingo = 25.
const CELEBS = [{ id: 'c1', data: '2026-10-24' }, { id: 'c2', data: '2026-10-25' }];
const ESCALAS = { c1: [{ membro_id: 'a' }, { membro_id: 'b' }], c2: [{ membro_id: 'c' }, { membro_id: 'a' }, { membro_id: null }] };
const HOJE = '2026-10-21';

// Banco de mentira: acolitos_config + a RPC com a MESMA trava da real (chave_unica em tarcisio_envios).
function bancoFalso(op = {}) {
  const st = {
    config: op.avisados === undefined ? null : { valor: op.avisados },
    envios: new Set(op.envios || []), rpcs: 0, gravacoes: 0,
  };
  const sb = {
    st,
    from(tab) {
      const q = {
        select() { return q; }, eq() { return q; },
        async maybeSingle() {
          if (tab !== 'acolitos_config') throw new Error('tabela inesperada ' + tab);
          if (op.lerFalha) return { data: null, error: { message: 'rede caiu' } };
          return { data: st.config ? { valor: JSON.parse(JSON.stringify(st.config.valor)) } : null, error: null };
        },
        async upsert(linha) {
          st.gravacoes++;
          if (op.gravarFalha) return { error: { message: 'sem permissão de escrita' } };
          st.config = { valor: linha.valor }; return { error: null };
        },
      };
      return q;
    },
    async rpc(nome, args) {
      assert.strictEqual(nome, 'tarcisio_pedir_escala');
      st.rpcs++;
      if (op.rpcFalha) return { data: null, error: { message: 'rpc caiu' } };
      const chave = 'escala:' + args.p_domingo;
      const novo = !st.envios.has(chave); st.envios.add(chave);
      return { data: { ok: true, novo }, error: null };
    },
  };
  return sb;
}

// Push de mentira: guarda quem recebeu; `falhaPara` = ids cujo envio é recusado.
function pushFalso(falhaPara = []) {
  const recebidos = [];
  const fn = async (membros) => {
    assert.strictEqual(membros.length, 1, 'um envio por pessoa');
    if (falhaPara.includes(membros[0])) return { ok: false };
    recebidos.push(membros[0]); return { ok: true, enviados: 1 };
  };
  fn.recebidos = recebidos;
  return fn;
}

const rodar = (sb, enviarPush, extra) => C.confirmarSemana(Object.assign({ sb, enviarPush, celebracoes: CELEBS, escalas: ESCALAS, hoje: HOJE }, extra));

test('chave da semana = menor data; domingo = o do fim de semana', () => {
  assert.strictEqual(C.chaveDaSemana(CELEBS), '2026-10-24');
  assert.strictEqual(C.domingoDaSemana(CELEBS), '2026-10-25');
  assert.strictEqual(C.domingoDaSemana([{ data: '2026-10-25' }]), '2026-10-25');
  assert.deepStrictEqual(C.escaladosDaSemana(CELEBS, [{ celebracao_id: 'c1', membro_id: 'x' }, { celebracao_id: 'zz', membro_id: 'y' }]), ['x']);
});

test('avisa só quem ainda não foi avisado', async () => {
  const sb = bancoFalso({ avisados: { '2026-10-24': ['a'] } });
  const push = pushFalso();
  const r = await rodar(sb, push);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(push.recebidos.sort(), ['b', 'c']);
  assert.strictEqual(r.avisados, 2);
  assert.strictEqual(r.jaTodosAvisados, false);
  assert.deepStrictEqual(sb.st.config.valor['2026-10-24'].sort(), ['a', 'b', 'c']);
  assert.strictEqual(r.arte.novo, true);
  assert.ok(sb.st.envios.has('escala:2026-10-25'));
});

test('push falha: ninguém é marcado como avisado', async () => {
  const sb = bancoFalso({ avisados: {} });
  const r = await rodar(sb, pushFalso(['a', 'b', 'c']));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.motivo, 'push');
  assert.match(r.erro, /Ninguém foi marcado/);
  assert.strictEqual(r.avisados, 0);
  assert.strictEqual(sb.st.gravacoes, 0, 'não grava nada');
  assert.deepStrictEqual(sb.st.config.valor, {});
  assert.strictEqual(sb.st.rpcs, 0, 'sem aviso não pede arte');
});

test('push que lança também conta como falha, sem lançar para fora', async () => {
  const sb = bancoFalso({ avisados: {} });
  const r = await rodar(sb, async () => { throw new Error('offline'); });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.motivo, 'push');
  assert.strictEqual(sb.st.gravacoes, 0);
});

test('segunda chamada não avisa nem pede arte de novo', async () => {
  const sb = bancoFalso({ avisados: {} });
  const r1 = await rodar(sb, pushFalso());
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.arte.novo, true);
  let regenerou = 0;
  const push2 = pushFalso();
  const r2 = await rodar(sb, push2, { regenerarArte: async () => { regenerou++; } });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.jaTodosAvisados, true);
  assert.strictEqual(r2.avisados, 0);
  assert.deepStrictEqual(push2.recebidos, []);
  assert.strictEqual(r2.arte.novo, false, 'a trava do banco segura o segundo pedido');
  assert.strictEqual(regenerou, 0, 'não dispara a arte de novo');
  assert.strictEqual(sb.st.envios.size, 1);
});

test('rodou pela metade: a nova tentativa avisa só o resto', async () => {
  const sb = bancoFalso({ avisados: {} });
  const r1 = await rodar(sb, pushFalso(['c']));
  assert.strictEqual(r1.ok, false);
  assert.strictEqual(r1.motivo, 'push_parcial');
  assert.strictEqual(r1.avisados, 2);
  assert.deepStrictEqual(r1.falharam, ['c']);
  assert.strictEqual(sb.st.rpcs, 0, 'confirmação incompleta ainda não pede a arte');
  const push2 = pushFalso();
  const r2 = await rodar(sb, push2);
  assert.strictEqual(r2.ok, true);
  assert.deepStrictEqual(push2.recebidos, ['c']);
  assert.strictEqual(r2.arte.novo, true);
});

test('arte falhou na vez anterior: tentar de novo completa só a arte', async () => {
  const sb = bancoFalso({ avisados: {}, rpcFalha: true });
  const r1 = await rodar(sb, pushFalso());
  assert.strictEqual(r1.ok, false);
  assert.strictEqual(r1.motivo, 'arte');
  assert.strictEqual(r1.avisados, 3);
  const sb2 = bancoFalso({ avisados: sb.st.config.valor });
  const push2 = pushFalso();
  const r2 = await rodar(sb2, push2);
  assert.strictEqual(r2.ok, true);
  assert.deepStrictEqual(push2.recebidos, []);
  assert.strictEqual(r2.arte.novo, true);
});

test('gravar avisados falha: devolve erro claro', async () => {
  const sb = bancoFalso({ avisados: {}, gravarFalha: true });
  const r = await rodar(sb, pushFalso());
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.motivo, 'gravar_avisados');
  assert.match(r.erro, /não consegui registrar quem já recebeu/);
  assert.strictEqual(r.avisados, 3);
});

test('ler avisados falha: não envia nada', async () => {
  const sb = bancoFalso({ lerFalha: true });
  const push = pushFalso();
  const r = await rodar(sb, push);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.motivo, 'ler_avisados');
  assert.deepStrictEqual(push.recebidos, []);
});

test('semana sem ninguém escalado: erro claro, nada enviado', async () => {
  const push = pushFalso();
  const r = await rodar(bancoFalso({}), push, { escalas: {} });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.motivo, 'sem_escalados');
  assert.deepStrictEqual(push.recebidos, []);
});

test('perguntar falso cancela antes de enviar', async () => {
  const sb = bancoFalso({ avisados: {} });
  const push = pushFalso();
  let viu;
  const r = await rodar(sb, push, { perguntar: async (novos) => { viu = novos; return false; } });
  assert.strictEqual(r.cancelado, true);
  assert.deepStrictEqual(viu, ['a', 'b', 'c']);
  assert.deepStrictEqual(push.recebidos, []);
  assert.strictEqual(sb.st.gravacoes, 0);
});

test('RPC responde sem_permissao: ok:false com o motivo', async () => {
  const sb = bancoFalso({ avisados: {} });
  sb.rpc = async () => ({ data: { erro: 'sem_permissao' }, error: null });
  const r = await rodar(sb, pushFalso());
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.motivo, 'arte');
  assert.strictEqual(r.arte.erro, 'sem_permissao');
});

test('pedirArtePeloServico usa a mesma trava (chave_unica) e respeita escala desligada', async () => {
  const linhas = new Set();
  let ligada = true, upsertArgs;
  const sb = {
    from(tab) {
      if (tab === 'tarcisio_config') {
        const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { data: { escala_ligada: ligada }, error: null }; } };
        return q;
      }
      assert.strictEqual(tab, 'tarcisio_envios');
      return {
        upsert(linha, opc) {
          upsertArgs = { linha, opc };
          return { async select() { if (linhas.has(linha.chave_unica)) return { data: [], error: null }; linhas.add(linha.chave_unica); return { data: [{ id: 1 }], error: null }; } };
        },
      };
    },
  };
  assert.deepStrictEqual(await C.pedirArtePeloServico(sb, '2026-10-25'), { ok: true, novo: true });
  assert.deepStrictEqual(await C.pedirArtePeloServico(sb, '2026-10-25'), { ok: true, novo: false });
  assert.strictEqual(upsertArgs.linha.chave_unica, 'escala:2026-10-25');
  assert.deepStrictEqual(upsertArgs.opc, { onConflict: 'chave_unica', ignoreDuplicates: true });
  ligada = false;
  assert.deepStrictEqual(await C.pedirArtePeloServico(sb, '2026-11-01'), { ok: true, desligado: true });
});
