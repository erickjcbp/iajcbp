// Confirmar a escala da semana: a regra INTEIRA, sem tela. Usada pelo botão "Confirmar escala
// da semana" (escala.html) e pelo robô do WhatsApp (botão Confirmar do dono). Uma regra só, para
// os dois caminhos nunca divergirem.
//
// Regra do dono de 18/08/2026: gerar a escala é rascunho; SÓ confirmar avisa. Confirmar avisa
// apenas quem ainda não foi avisado e pede a arte dos grupos UMA vez (a escala confirmada é a
// que vale; confirmar de novo não reenvia a arte).
//
// Pode ser chamada de novo depois de ter rodado pela metade, sem avisar ninguém duas vezes:
//   - cada pessoa recebe o próprio envio, e só quem teve o envio aceito é marcada como avisada;
//   - a lista de avisados é lida ANTES de qualquer envio; sem conseguir ler, nada é enviado;
//   - o pedido da arte confia na trava do banco (tarcisio_pedir_escala: chave_unica
//     'escala:<domingo>' em tarcisio_envios), então repetir é inofensivo; só um pedido que
//     FALHOU volta para a fila (migration 105).
//
// Nunca lança para falha esperada: devolve { ok:false, motivo, erro } com o texto para a pessoa.
// Formato de escala_avisados em acolitos_config: { 'AAAA-MM-DD (chave da semana)': [membro_id] }.
(function (global) {
  'use strict';

  var nucleo = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
    ? require('./confirmar-escala-core.js')
    : { aNotificar: global.aNotificar, podarAvisados: global.podarAvisados };

  var CHAVE_CFG = 'escala_avisados';
  var SIMULTANEOS = 4;   // envios ao mesmo tempo: rápido na tela sem afogar o servidor

  // A chave da semana é a MENOR data das celebrações dela (texto 'AAAA-MM-DD', sem fuso) —
  // a mesma conta da tela (renderCards). O robô tem de usar exatamente esta, ou a lista de
  // avisados da tela e a do robô viram duas e todo mundo recebe aviso duas vezes.
  function chaveDaSemana(celebracoes) {
    var datas = (celebracoes || []).map(function (c) { return c && c.data; }).filter(Boolean).sort();
    return datas.length ? String(datas[0]).slice(0, 10) : null;
  }

  // O domingo do fim de semana (o dia que a arte e a fila dos grupos usam).
  function domingoDaSemana(celebracoes) {
    var datas = (celebracoes || []).map(function (c) { return c && c.data; }).filter(Boolean).sort();
    if (!datas.length) return null;
    var d = new Date(String(datas[datas.length - 1]).slice(0, 10) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
    return d.toISOString().slice(0, 10);
  }

  // escalas: mapa { celebracao_id: [{membro_id}] } (o escalasMap da tela) ou lista de linhas
  // { celebracao_id, membro_id } (o que o robô lê do banco).
  function escaladosDaSemana(celebracoes, escalas) {
    var ids = {};
    (celebracoes || []).forEach(function (c) { if (c && c.id) ids[c.id] = true; });
    var saida = [];
    if (Array.isArray(escalas)) {
      escalas.forEach(function (e) { if (e && ids[e.celebracao_id] && e.membro_id) saida.push(e.membro_id); });
    } else if (escalas && typeof escalas === 'object') {
      Object.keys(ids).forEach(function (cid) {
        (escalas[cid] || []).forEach(function (e) { if (e && e.membro_id) saida.push(e.membro_id); });
      });
    }
    return saida;
  }

  // Segunda-feira (AAAA-MM-DD) da semana de uma data. A tela e o robô podem guardar a lista de avisados
  // sob chaves diferentes da MESMA semana (a da tela muda com filtros/dias úteis; a do robô é o sábado):
  // quem foi avisado sob qualquer chave da semana segunda–domingo já foi avisado.
  function segundaDe(chave) {
    var d = new Date(String(chave).slice(0, 10) + 'T12:00:00Z');
    if (isNaN(d)) return null;
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  function avisadosDaSemana(mapa, chave) {
    var seg = segundaDe(chave), vistos = {}, lista = [];
    Object.keys(mapa || {}).forEach(function (k) {
      if (k !== chave && (seg === null || segundaDe(k) !== seg)) return;
      (Array.isArray(mapa[k]) ? mapa[k] : []).forEach(function (id) { if (!vistos[id]) { vistos[id] = true; lista.push(id); } });
    });
    return lista;
  }
  function hojeSP() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (_) { return null; }   // sem data confiável a poda não descarta nada
  }

  function msgErro(e) { return (e && (e.message || e.error)) ? String(e.message || e.error) : String(e || 'erro'); }

  // Pede a arte dos grupos pelo caminho da TELA: a RPC confere o papel de quem está logado.
  async function pedirArtePelaRpc(sb, domingo) {
    var r = await sb.rpc('tarcisio_pedir_escala', { p_domingo: domingo });
    if (r.error) throw r.error;
    return r.data || {};
  }

  // Para quem entra com a chave de serviço (o robô): a RPC recusaria (não há usuário logado,
  // tarcisio_pode_gerir() dá falso). Faz o MESMO que ela, com a MESMA trava: chave_unica
  // 'escala:<domingo>' e ignorar se já existir.
  async function pedirArtePeloServico(sb, domingo) {
    var cfg = await sb.from('tarcisio_config').select('escala_ligada').eq('id', 1).maybeSingle();
    if (cfg.error) throw cfg.error;
    if (!cfg.data || !cfg.data.escala_ligada) return { ok: true, desligado: true };
    var ins = await sb.from('tarcisio_envios')
      .upsert({ tipo: 'escala', estado: 'aguardando_arte', domingo_data: domingo, chave_unica: 'escala:' + domingo, destino_nome: 'Grupos' },
        { onConflict: 'chave_unica', ignoreDuplicates: true })
      .select('id');
    if (ins.error) throw ins.error;
    if (Array.isArray(ins.data) && ins.data.length > 0) return { ok: true, novo: true };
    // Já existia. Se o pedido anterior FALHOU (a arte não ficou pronta em 30 min, nenhum grupo
    // ligado), confirmar de novo revive o MESMO pedido: volta a esperar a arte, com created_at novo
    // (o robô só envia arte gerada DEPOIS do pedido). Enviado ou ainda esperando: não mexe.
    // Igual à tarcisio_pedir_escala da migration 105.
    var rev = await sb.from('tarcisio_envios')
      .update({ estado: 'aguardando_arte', erro: null, created_at: new Date().toISOString() })
      .eq('chave_unica', 'escala:' + domingo).eq('estado', 'falhou')
      .select('id');
    if (rev.error) throw rev.error;
    return { ok: true, novo: Array.isArray(rev.data) && rev.data.length > 0 };
  }

  // Roda `fn` sobre cada item com no máximo `n` ao mesmo tempo. Nunca rejeita.
  async function emLotes(itens, n, fn) {
    var res = new Array(itens.length), i = 0;
    async function trabalhador() {
      while (i < itens.length) {
        var k = i++;
        try { res[k] = { ok: await fn(itens[k]) }; } catch (e) { res[k] = { ok: false, erro: e }; }
      }
    }
    var ts = [];
    for (var t = 0; t < Math.min(n, itens.length); t++) ts.push(trabalhador());
    await Promise.all(ts);
    return res;
  }

  // 4. A arte dos grupos. Também quando todos já estavam avisados: se a vez anterior parou
  // antes deste passo, é aqui que ela se completa; se não parou, a trava do banco não deixa
  // pedir duas vezes (novo:false). Nunca rejeita.
  async function pedirArteDosGrupos(o, sb, celebracoes) {
    var arte = { novo: false };
    try {
      var r = await (o.pedirArte || pedirArtePelaRpc)(sb, domingoDaSemana(celebracoes));
      if (r && r.erro) arte = { novo: false, erro: String(r.erro) };
      else arte = { novo: !!(r && r.novo), desligado: !!(r && r.desligado) };
      if (arte.novo && typeof o.regenerarArte === 'function') {
        try { await o.regenerarArte(); } catch (e) { arte.erroRegenerar = msgErro(e); }
      }
    } catch (e) { arte = { novo: false, erro: msgErro(e) }; }
    return arte;
  }

  // o: { sb, enviarPush, celebracoes, escalas, chaveSemana?, hoje?, perguntar?, pedirArte?, regenerarArte? }
  //   enviarPush(membros[]) → { ok } (a tela: apiPost tipo 'escalado'; o robô: tipo 'escalado_robo')
  //   perguntar(novos[])    → true/false; a tela pergunta "Avisar N pessoas?" (falso = cancelado)
  //   pedirArte(sb, domingo) → { novo, erro? } (padrão: a RPC; o robô passa pedirArtePeloServico)
  //   regenerarArte()        → chamado só quando a arte entrou na fila agora (a tela dispara o robô da arte)
  // Devolve { ok, avisados, jaTodosAvisados, novos, falharam, motivo?, erro?, arte? }.
  async function confirmarSemana(o) {
    o = o || {};
    var sb = o.sb, celebracoes = o.celebracoes || [];
    var base = { ok: false, avisados: 0, jaTodosAvisados: false, novos: [], falharam: [] };
    function falha(motivo, erro, extra) { var r = Object.assign({}, base, extra || {}); r.motivo = motivo; r.erro = erro; return r; }

    if (!sb || typeof o.enviarPush !== 'function') return falha('config', 'confirmarSemana chamada sem banco ou sem envio de push.');
    var chave = o.chaveSemana || chaveDaSemana(celebracoes);
    var escalados = escaladosDaSemana(celebracoes, o.escalas);
    if (!chave || !escalados.length) return falha('sem_escalados', 'Não há ninguém escalado nesta semana ainda.');

    // 1. Quem já foi avisado. Sem saber, confirmar avisaria todo mundo de novo: não envia nada.
    var lido;
    try { lido = await sb.from('acolitos_config').select('valor').eq('chave', CHAVE_CFG).maybeSingle(); }
    catch (e) { lido = { error: e }; }
    if (lido.error) {
      return falha('ler_avisados', 'Não foi possível conferir quem já foi avisado. Tente de novo daqui a pouco — confirmar agora poderia avisar todo mundo duas vezes.', { causa: msgErro(lido.error) });
    }
    var valor = lido.data && lido.data.valor;
    var mapa = (valor && typeof valor === 'object' && !Array.isArray(valor)) ? Object.assign({}, valor) : {};
    var novos = nucleo.aNotificar({ escalados: escalados, jaAvisados: avisadosDaSemana(mapa, chave) });
    base.novos = novos;

    var avisados = [];
    if (novos.length) {
      if (typeof o.perguntar === 'function' && !(await o.perguntar(novos))) {
        return Object.assign({}, base, { ok: true, cancelado: true, motivo: 'cancelado' });
      }

      // 2. Um envio por pessoa: assim, se cair no meio, quem recebeu fica marcado e a próxima
      // tentativa avisa só o resto.
      var res = await emLotes(novos, SIMULTANEOS, async function (id) {
        var r = await o.enviarPush([id]);
        return !!(r && r.ok !== false);
      });
      var falharam = [];
      novos.forEach(function (id, k) { (res[k] && res[k].ok ? avisados : falharam).push(id); });
      base.falharam = falharam;
      base.avisados = avisados.length;

      if (!avisados.length) {
        return falha('push', 'Não foi possível enviar os avisos. Ninguém foi marcado como avisado, então é só tentar de novo.');
      }

      // 3. Só marca DEPOIS de o envio dar certo: marcar antes faria a pessoa nunca receber.
      mapa[chave] = (mapa[chave] || []).concat(avisados);   // a leitura já soma todas as chaves da semana
      var podado = nucleo.podarAvisados({ mapa: mapa, hoje: o.hoje || hojeSP() });
      var gravado;
      try {
        gravado = await sb.from('acolitos_config')
          .upsert({ chave: CHAVE_CFG, valor: podado, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
      } catch (e) { gravado = { error: e }; }
      if (gravado && gravado.error) {
        // Os avisos já saíram: a semana está confirmada de fato, então a arte segue (como sempre
        // foi na tela). O erro volta para a pessoa saber que repetir avisa de novo.
        var arteG = await pedirArteDosGrupos(o, sb, celebracoes);
        return falha('gravar_avisados', 'Os avisos foram enviados, mas não consegui registrar quem já recebeu. Se apertar Confirmar de novo, essas pessoas receberão o aviso outra vez.', { avisados: avisados.length, causa: msgErro(gravado.error), arte: arteG });
      }

      if (falharam.length) {
        // Alguém já foi avisado: a semana está confirmada de fato, então a arte segue (senão a semana
        // fecharia sem arte). A falha volta para a pessoa tentar de novo só com quem faltou.
        var arteP = await pedirArteDosGrupos(o, sb, celebracoes);
        return falha('push_parcial', (falharam.length === 1 ? '1 pessoa não recebeu' : falharam.length + ' pessoas não receberam') +
          ' o aviso. Quem recebeu ficou marcado; tente de novo para avisar só o resto.', { avisados: avisados.length, arte: arteP });
      }
    }

    var arte = await pedirArteDosGrupos(o, sb, celebracoes);
    var saida = Object.assign({}, base, { ok: true, avisados: avisados.length, jaTodosAvisados: !novos.length, arte: arte });
    if (arte.erro) {
      saida.ok = false; saida.motivo = 'arte';
      saida.erro = 'A escala foi confirmada, mas a arte não entrou na fila do WhatsApp (' + arte.erro + '). Veja em São Tarcísio.';
    }
    return saida;
  }

  var api = {
    confirmarSemana: confirmarSemana, chaveDaSemana: chaveDaSemana, domingoDaSemana: domingoDaSemana,
    escaladosDaSemana: escaladosDaSemana, pedirArtePeloServico: pedirArtePeloServico, avisadosDaSemana: avisadosDaSemana,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ConfirmarSemanaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
