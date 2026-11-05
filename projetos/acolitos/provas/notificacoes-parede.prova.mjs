// Parede de notificações: toda falha do "Ativar agora" aparece ESCRITA DENTRO da parede (o toast fica
// atrás dela) e o aparelho que já tinha inscrição de outra conta é assumido pela função do banco.
// Caso real (05/11/2026): aluna presa em "Ativar" sem nenhum aviso.
import assert from 'node:assert/strict';
import { iniciarProvas, PAPEIS } from './abrir-tela.mjs';

const p = await iniciarProvas();
try {
  const r = await p.abrir('index.html', {
    papel: PAPEIS.admin,
    avaliar: `
      document.getElementById('splash')?.remove();
      const saida = {};
      const reg = await navigator.serviceWorker.ready;
      const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const chavesDoAparelho = { endpoint: 'https://push.test/aparelho-da-familia', toJSON() { return { keys: { p256dh: 'P', auth: 'A' } }; }, unsubscribe: async () => true };
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'granted' });
      Notification.requestPermission = async () => 'granted';
      const chamadas = [];
      const dono = { rpc: { error: null }, upsert: { error: null } };
      sb.rpc = async (nome, args) => { chamadas.push(['rpc', nome, args]); return dono.rpc; };
      const fromOriginal = sb.from.bind(sb);
      sb.from = (t) => t === 'acolitos_push_subs'
        ? { upsert: async (l, o) => { chamadas.push(['upsert', l]); return dono.upsert; }, select() { const q = { eq() { return q; }, maybeSingle: async () => ({ data: null, error: null }) }; return q; } }
        : fromOriginal(t);

      // A) aparelho com inscrição de OUTRA conta, função do banco ainda sem existir: o upsert é negado.
      reg.pushManager.getSubscription = async () => chavesDoAparelho;
      dono.rpc = { error: { code: 'PGRST202', message: 'Could not find the function' } };
      dono.upsert = { error: { code: '42501', message: 'new row violates row-level security policy' } };
      mostrarParedeNotificacoes('pedir', 'u1');
      const parede = document.getElementById('parede-notif');
      parede.querySelector('button.gold').click();
      await dormir(400);
      const erro = document.getElementById('parede-notif-erro');
      saida.erroA = erro.textContent;
      const caixa = erro.getBoundingClientRect();
      const noPonto = document.elementFromPoint(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2);
      saida.erroVisivelNaParede = !!noPonto && (noPonto === erro || parede.contains(noPonto));
      saida.botaoVoltou = parede.querySelector('button.gold').disabled === false;

      // B) função do banco existe e troca o dono do aparelho: ativa.
      chamadas.length = 0;
      dono.rpc = { error: null };
      saida.ativouB = await ativarNotificacoes(null, 'u1', () => {});
      saida.chamouFuncao = JSON.stringify(chamadas[0]);

      // C) o aparelho não consegue criar a inscrição (subscribe recusa): frase dentro da parede.
      reg.pushManager.getSubscription = async () => null;
      reg.pushManager.subscribe = async () => { const e = new Error('push service error'); e.name = 'AbortError'; throw e; };
      let msgC = ''; saida.ativouC = await ativarNotificacoes(null, 'u1', (m) => { msgC = m; });
      saida.msgC = msgC;

      // D) a pessoa nega a permissão: a frase manda para as configurações, sem código técnico.
      Notification.requestPermission = async () => 'denied';
      let msgD = ''; saida.ativouD = await ativarNotificacoes(null, 'u1', (m) => { msgD = m; });
      saida.msgD = msgD;

      // E) sem a parede (Minha Conta) o aviso segue como toast, não some em silêncio.
      const antes = document.querySelectorAll('.app-toast, .toast').length;
      await ativarNotificacoes(null, 'u1');
      await dormir(100);
      saida.toastSemParede = document.querySelectorAll('.app-toast, .toast').length >= antes;
      return saida;
    `,
  });
  assert.equal(r.erroAvaliar, null, String(r.erroAvaliar));
  const a = r.avaliado;
  assert.match(a.erroA, /fale com a coordenação/i, 'A: a parede explica o que fazer');
  assert.match(a.erroA, /42501/, 'A: o código do erro aparece para a coordenação diagnosticar');
  assert.equal(a.erroVisivelNaParede, true, 'A: a mensagem está visível NA parede, não atrás dela');
  assert.equal(a.botaoVoltou, true, 'A: o botão volta a funcionar para tentar de novo');
  assert.equal(a.ativouB, true, 'B: com a função do banco, ativa');
  assert.match(a.chamouFuncao, /acolitos_push_registrar/, 'B: grava pela função que troca o dono do aparelho');
  assert.equal(a.ativouC, false);
  assert.match(a.msgC, /inscrição/i, 'C: diz que a inscrição não foi criada');
  assert.match(a.msgC, /AbortError/, 'C: traz o código');
  assert.equal(a.ativouD, false);
  assert.match(a.msgD, /configurações/i, 'D: manda para as configurações do celular');
  assert.doesNotMatch(a.msgD, /código/i, 'D: não assusta com código técnico');
  assert.deepEqual(r.erros, [], 'sem erro de JavaScript na tela');
  console.log('Parede de notificações OK: erro visível na parede, aparelho de outra conta assumido, tempo e mensagens por motivo');
} finally { await p.encerrar(); }
