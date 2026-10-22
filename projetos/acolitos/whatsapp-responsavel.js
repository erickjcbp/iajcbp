// PORTÃO DO WHATSAPP DO RESPONSÁVEL — São Tarcísio | JCBP (migration 098).
//
// O São Tarcísio manda o lembrete da véspera e o parabéns de um MENOR só no WhatsApp de
// quem responde por ele (decisão do dono). Em 20/10/2026, 66 dos 152 menores que servem
// não tinham número nenhum de responsável. Ao abrir o app, quem está nessa situação (a
// própria ficha ou a de um irmão da conta de família) só segue depois de informar o número.
//
// O número vai para `celular_recado`, o campo que o app mantém (ver telefones-core.js).
(function (global) {
  'use strict';

  // Celular brasileiro válido → "55DDD9XXXXXXXX"; senão null. Mesma regra do robô (tarcisio-robo/regras.mjs).
  function normalizarCelular(bruto) {
    var n = String(bruto == null ? '' : bruto).replace(/\D/g, '').replace(/^0+/, '');
    if (n.length === 10 || n.length === 11) n = '55' + n;
    if (n.length === 12 && n.indexOf('55') === 0 && /[6-9]/.test(n[4])) n = n.slice(0, 4) + '9' + n.slice(4);
    return /^55\d{2}9\d{8}$/.test(n) ? n : null;
  }

  function ehMenor(m, hoje) {
    if (!m.data_nascimento) return true;   // sem data: trata como menor, igual ao robô
    var a = m.data_nascimento.split('-').map(Number), h = hoje.split('-').map(Number);
    var idade = h[0] - a[0] - ((h[1] < a[1] || (h[1] === a[1] && h[2] < a[2])) ? 1 : 0);
    return idade < 18;
  }

  // Quem da conta precisa do número: menor, ativo, que serve, sem nenhum celular válido de responsável.
  function faltando(perfis, hoje) {
    var vistos = {};
    return (perfis || []).filter(function (m) {
      if (!m || vistos[m.id]) return false;
      vistos[m.id] = true;
      if (m.status !== 'ativo' || m.serve === false || !ehMenor(m, hoje)) return false;
      return !(normalizarCelular(m.celular_recado) || normalizarCelular(m.celular_responsavel) || normalizarCelular(m.celular_mae));
    });
  }

  // Parede de tela cheia, uma criança por vez. Só some quando todas tiverem número.
  function mostrarParede(lista, sb, aoTerminar) {
    if (document.getElementById('parede-whatsapp')) return;
    var fila = lista.slice();
    var tela = document.createElement('div');
    tela.id = 'parede-whatsapp';
    tela.style.cssText = 'position:fixed;inset:0;z-index:9000;background:var(--bg,#0a0406);overflow-y:auto;' +
      'display:flex;align-items:center;justify-content:center;padding:24px clamp(14px,2.4vw,44px);';
    var cartao = document.createElement('div');
    cartao.style.cssText = 'width:100%;max-width:440px;text-align:center;';
    tela.appendChild(cartao);
    document.body.appendChild(tela);

    function passo() {
      var m = fila[0];
      cartao.textContent = '';
      var ic = document.createElement('div');
      ic.style.cssText = 'font-size:46px;line-height:1;margin-bottom:14px;';
      comIcone(ic, 'celular', '', 'Celular');
      var tt = document.createElement('div');
      tt.style.cssText = 'font-family:var(--font-title);font-weight:700;font-size:21px;color:var(--gold-light,#ffd97a);margin-bottom:10px;';
      var nome = String(m.apelido || m.nome || '').trim().split(' ')[0] || 'o servo';
      tt.textContent = 'WhatsApp do responsável por ' + nome;
      var p = document.createElement('p');
      p.style.cssText = 'font-size:14.5px;line-height:1.65;color:var(--text,#fff);margin:0 0 18px;';
      p.textContent = 'A pastoral vai avisar pelo WhatsApp do São Tarcísio | JCBP: lembrete na véspera de cada missa ' +
        'em que ' + nome + ' estiver escalado. Informe o celular do pai, da mãe ou de quem responde por ' + nome + '.';
      var campo = document.createElement('input');
      campo.type = 'tel'; campo.inputMode = 'tel'; campo.autocomplete = 'tel';
      campo.placeholder = '(19) 99999-9999';
      campo.setAttribute('aria-label', 'Celular do responsável');
      campo.style.cssText = 'width:100%;min-height:48px;padding:13px 14px;margin-bottom:10px;border-radius:10px;' +
        'border:1px solid var(--border,#3a2a2f);background:var(--surface2,#1a0f13);color:var(--text,#fff);font-size:16px;text-align:center;';
      if (typeof global.mascaraTel === 'function') campo.addEventListener('input', function () { campo.value = global.mascaraTel(campo.value); });
      var erro = document.createElement('div');
      erro.style.cssText = 'font-size:13.5px;line-height:1.5;color:var(--danger-text,#ff9c9c);margin:0 0 10px;min-height:19px;';
      var btn = document.createElement('button');
      btn.className = 'btn gold'; btn.style.cssText = 'width:100%;min-height:48px;touch-action:manipulation;';
      btn.textContent = fila.length > 1 ? 'Guardar e seguir (' + fila.length + ' faltando)' : 'Guardar o número';
      btn.onclick = async function () {
        var num = normalizarCelular(campo.value);
        if (!num) { erro.textContent = 'Confira o número: precisa ser um celular com DDD.'; campo.focus(); return; }
        btn.disabled = true; erro.textContent = '';
        var r = await sb.from('acolitos_membros').update({ celular_recado: campo.value.trim() }).eq('id', m.id).select('id');
        if (r.error || !r.data || !r.data.length) {
          erro.textContent = 'Não foi possível guardar agora. Tente de novo em instantes.';
          btn.disabled = false; return;
        }
        fila.shift();
        if (fila.length) { passo(); return; }
        tela.remove();
        aoTerminar();
      };
      campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
      cartao.append(ic, tt, p, campo, erro, btn);
      setTimeout(function () { campo.focus(); }, 50);
    }
    passo();
  }

  var api = { normalizarCelular: normalizarCelular, faltando: faltando, ehMenor: ehMenor, mostrarParede: mostrarParede };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.WhatsappResponsavel = api;
})(typeof window !== 'undefined' ? window : globalThis);
