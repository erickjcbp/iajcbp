// São Tarcísio | JCBP — as telas, num lugar só. Usadas por:
//   config.html  (superadmin): WhatsApp, Grupos, Assistente de IA, Conversas
//   config.html › São Tarcísio (admin/subadmin: Avisos, Sem número; superadmin: tudo)
// Cada função recebe a caixa onde desenhar e sabe se redesenhar sozinha. O app e o robô
// conversam só pelas tabelas tarcisio_* (migrations 098–102). Precisa de shared.js (sb, toast…).
(function (global) {
  'use strict';

  const PAPEIS = { pais:'Pais', acolitos:'Acólitos', cerimoniarios:'Cerimoniários', equipe:'Equipe/coordenação' };
  const TIPOS = { escala:'Escala', lembrete:'Lembrete', aviso:'Aviso', aniversario:'Aniversário' };
  const ESTADOS = { aguardando_arte:'esperando a arte', pendente:'na fila', enviando:'enviando', enviado:'enviado', falhou:'falhou', cancelado:'cancelado', sem_numero:'sem número' };
  const REPETIR = { nao:'Uma vez', diario:'Todo dia', semanal:'Toda semana', mensal:'Todo mês' };
  const FUSO = 'America/Sao_Paulo';

  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const quando = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { timeZone:FUSO, day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
  const foneBonito = (n) => { const d = String(n || '').replace(/\D/g, ''); return d.length === 13 ? `(${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}` : (n || ''); };
  const botao = (txt, cls, onclick) => { const b = el('button', 'btn-sm ' + cls, txt); b.type = 'button'; b.onclick = onclick; return b; };
  const erroBanco = (r, oque) => { if (r.error) { console.error('São Tarcísio:', oque, r.error); toast('Não foi possível ' + oque + '.', 'error'); return true; } return false; };
  const cartao = (titulo) => { const c = el('div', 'tc-st-card'); c.append(el('h3', null, titulo)); return c; };

  async function lerConfig() {
    const r = await sb.from('tarcisio_config').select('*').eq('id', 1).single();
    return erroBanco(r, 'ler a configuração') ? null : r.data;
  }
  async function salvarConfig(mudancas, msg) {
    const r = await sb.from('tarcisio_config').update({ ...mudancas, updated_at: new Date().toISOString() }).eq('id', 1);
    if (erroBanco(r, 'salvar')) return false;
    if (msg) toast(msg);
    return true;
  }

  // Redesenha `fn` na `caixa`; `vigiar` repete por um tempo (QR, busca de grupos, rascunho).
  function montar(fn) {
    return async function desenhar(caixa) {
      let vigia = null;
      const redesenhar = async () => {
        if (!caixa.isConnected) { clearInterval(vigia); return; }
        if (document.querySelector('#modal-aviso')) return;
        caixa.textContent = '';
        try { await fn(caixa, ctl); } catch (e) { console.error('São Tarcísio: desenhar', e); caixa.append(el('p', 'tc-st-muted tc-st-ruim', 'Algo deu errado ao carregar. Recarregue a página.')); }
      };
      const ctl = {
        redesenhar,
        vigiar(cada, por) {
          clearInterval(vigia);
          const fim = Date.now() + por;
          vigia = setInterval(() => { if (Date.now() > fim || document.hidden || !caixa.isConnected) { clearInterval(vigia); return; } redesenhar(); }, cada);
          redesenhar();
        },
      };
      await redesenhar();
    };
  }

  // ── WHATSAPP: conexão, envios, regras, fila ──
  const whatsapp = montar(async (box, ctl) => {
    const conf = await lerConfig(); if (!conf) return;
    const inicioDia = new Date(new Date().toLocaleDateString('en-CA', { timeZone:FUSO }) + 'T00:00:00-03:00').toISOString();
    const [hoje, fila, recentes] = await Promise.all([
      sb.from('tarcisio_envios').select('id', { count:'exact', head:true }).eq('estado', 'enviado').not('destino_numero', 'is', null).gte('enviado_em', inicioDia),
      sb.from('tarcisio_envios').select('*').in('estado', ['pendente', 'aguardando_arte', 'enviando']).order('agendado_para').limit(40),
      sb.from('tarcisio_envios').select('*').in('estado', ['enviado', 'falhou', 'cancelado']).order('created_at', { ascending:false }).limit(40),
    ]);
    if (erroBanco(fila, 'ler a fila') || erroBanco(recentes, 'ler os envios')) return;
    const grid = el('div', 'tc-st-grid');

    const cCon = cartao('Número do WhatsApp');
    const aberto = conf.conexao === 'open';
    const roboVivo = conf.robo_visto_em && (Date.now() - new Date(conf.robo_visto_em)) < 2 * 60_000;
    cCon.append(el('div', 'tc-st-big ' + (aberto ? 'tc-st-ok' : 'tc-st-ruim'), aberto ? '● Conectado' : '● Desconectado'));
    cCon.append(el('div', 'tc-st-muted', aberto ? 'Número: ' + foneBonito(conf.numero_conectado)
      : 'Conecte o chip do São Tarcísio: no celular, WhatsApp → Aparelhos conectados → Conectar aparelho, e leia o QR Code.'));
    if (!roboVivo) cCon.append(el('div', 'tc-st-muted tc-st-ruim', '⚠ O robô não responde desde ' + quando(conf.robo_visto_em) + '. Nada sai até ele voltar.'));
    if (!aberto && conf.qr_code && conf.qr_em && (Date.now() - new Date(conf.qr_em)) < 60_000) {
      const img = el('img', 'tc-qr'); img.src = conf.qr_code; img.alt = 'QR Code para conectar o WhatsApp'; cCon.append(img);
      cCon.append(el('div', 'tc-st-muted', 'O código se renova sozinho a cada 20 segundos.'));
    }
    const acCon = el('div', 'tc-st-acoes');
    if (!aberto) acCon.append(botao('Mostrar QR Code', 'gold', async () => {
      if (await salvarConfig({ pedir_qr_em: new Date().toISOString(), qr_code: null }, 'Pedindo o QR Code…')) ctl.vigiar(4000, 3 * 60_000);
    }));
    cCon.append(acCon); grid.append(cCon);

    const cEnv = cartao('Envios');
    cEnv.append(el('div', 'tc-st-big', conf.pausado ? '⏸ Pausado' : '▶ Enviando'));
    cEnv.append(el('div', 'tc-st-muted', `Hoje no privado: ${hoje.count ?? 0} de ${conf.teto_diario}. Na fila: ${fila.data.length}. Horário: ${String(conf.janela_inicio).slice(0,5)} às ${String(conf.janela_fim).slice(0,5)}.`));
    const acEnv = el('div', 'tc-st-acoes');
    acEnv.append(botao(conf.pausado ? 'Retomar envios' : 'Pausar tudo', conf.pausado ? 'gold' : 'wine', async () => {
      if (!conf.pausado && !await uiConfirm('Pausar todos os envios do São Tarcísio? A fila fica guardada.')) return;
      if (await salvarConfig({ pausado: !conf.pausado }, conf.pausado ? 'Envios retomados.' : 'Envios pausados.')) ctl.redesenhar();
    }));
    cEnv.append(acEnv); grid.append(cEnv);

    const cReg = cartao('Regras automáticas');
    cReg.append(caixinha(conf, 'escala_ligada', 'Arte da escala nos grupos ao confirmar a semana'));
    cReg.append(caixinha(conf, 'lembrete_ligado', `Lembrete no privado na véspera, às ${String(conf.hora_lembrete).slice(0,5)}`));
    cReg.append(caixinha(conf, 'aniversario_ligado', `Parabéns no privado no aniversário, às ${String(conf.hora_aniversario).slice(0,5)}`));
    const lt = el('label', 'tc-regra'); const nt = el('input'); nt.type = 'number'; nt.min = 0; nt.max = 1000; nt.value = conf.teto_diario;
    nt.onchange = async () => { const v = Math.max(0, Math.min(1000, parseInt(nt.value, 10) || 0)); nt.value = v; await salvarConfig({ teto_diario: v }, 'Limite salvo.'); };
    lt.append(document.createTextNode('Limite de mensagens no privado por dia:'), nt);
    cReg.append(lt); grid.append(cReg);
    box.append(grid);

    const cTx = cartao('Textos fixos');
    const tLem = textoEditavel(cTx, 'Lembrete — use {dia} e {itens}', conf.texto_lembrete);
    const tAni = textoEditavel(cTx, 'Aniversário — use {nome}', conf.texto_aniversario);
    const tRod = textoEditavel(cTx, 'Rodapé de toda mensagem no privado', conf.rodape);
    const acTx = el('div', 'tc-st-acoes');
    acTx.append(botao('Salvar textos', 'gold', async () => {
      if (!tLem.value.includes('{itens}')) { uiAlert('O texto do lembrete precisa ter {itens}: é onde entram nome, missa e função.'); return; }
      await salvarConfig({ texto_lembrete: tLem.value.trim(), texto_aniversario: tAni.value.trim(), rodape: tRod.value.trim() }, 'Textos salvos.');
    }));
    cTx.append(acTx); box.append(cTx);

    box.append(el('div', 'tc-secao', 'Próximos envios'));
    box.append(listaEnvios(fila.data, true, 'Nada na fila.', ctl));
    box.append(el('div', 'tc-secao', 'Últimos envios'));
    box.append(listaEnvios(recentes.data, false, 'Nada enviado ainda.', ctl));
  });

  function caixinha(conf, campo, texto) {
    const l = el('label', 'tc-regra'); const c = el('input'); c.type = 'checkbox'; c.checked = !!conf[campo];
    c.onchange = async () => { if (!await salvarConfig({ [campo]: c.checked }, 'Salvo.')) c.checked = !c.checked; };
    l.append(c, document.createTextNode(texto)); return l;
  }
  function textoEditavel(pai, rotulo, valor) {
    pai.append(el('label', 'tc-rotulo', rotulo));
    const t = el('textarea', 'tc-area'); t.value = valor || ''; t.style.minHeight = '80px'; pai.append(t); return t;
  }

  function listaEnvios(linhas, comCancelar, vazio, ctl) {
    const l = el('div', 'tc-lista');
    if (!linhas.length) { l.append(el('div', 'tc-st-muted', vazio)); return l; }
    linhas.forEach((e) => {
      const r = el('div', 'tc-linha'); const c = el('div', 'tc-corpo');
      const t = el('div', 'tc-tit'); t.append(el('span', 'tc-chip tc-' + e.estado, ESTADOS[e.estado] || e.estado),
        document.createTextNode(`${TIPOS[e.tipo] || e.tipo} → ${e.destino_nome || foneBonito(e.destino_numero) || '—'}`));
      const linhaHora = e.estado === 'enviado' ? 'Enviado ' + quando(e.enviado_em) : 'Para ' + quando(e.agendado_para);
      const texto = (e.texto || '').slice(0, 160) + ((e.texto || '').length > 160 ? '…' : '');
      c.append(t, el('div', 'tc-sub', [linhaHora, e.erro ? '⚠ ' + e.erro : '', texto].filter(Boolean).join('\n')));
      r.append(c);
      if (comCancelar && e.estado !== 'enviando') r.append(botao('Cancelar', 'gray', async () => {
        const x = await sb.from('tarcisio_envios').update({ estado:'cancelado', erro:'Cancelado pela coordenação' }).eq('id', e.id).in('estado', ['pendente', 'aguardando_arte']);
        if (!erroBanco(x, 'cancelar')) { toast('Cancelado.'); ctl.redesenhar(); }
      }));
      l.append(r);
    });
    return l;
  }

  // ── GRUPOS ──
  const grupos = montar(async (box, ctl) => {
    const conf = await lerConfig(); if (!conf) return;
    const r = await sb.from('tarcisio_grupos').select('*').order('nome');
    if (erroBanco(r, 'ler os grupos')) return;
    box.append(el('p', 'tc-st-muted', 'Coloque o número do São Tarcísio nos 4 grupos do WhatsApp (como administrador, se o grupo só deixa administradores mandarem mensagem). Depois toque em "Buscar grupos" e diga qual grupo é qual.'));
    const ac = el('div', 'tc-st-acoes');
    ac.append(botao('Buscar grupos do WhatsApp', 'gold', async () => {
      if (conf.conexao !== 'open') { uiAlert('Conecte o número primeiro (seção WhatsApp).'); return; }
      if (await salvarConfig({ pedir_grupos_em: new Date().toISOString() }, 'Buscando os grupos…')) ctl.vigiar(4000, 40_000);
    }));
    box.append(ac);
    const faltam = Object.keys(PAPEIS).filter((p) => !r.data.some((g) => g.papel === p));
    if (faltam.length) box.append(el('p', 'tc-st-muted tc-st-ruim', 'Falta ligar: ' + faltam.map((p) => PAPEIS[p]).join(', ') + '.'));
    const l = el('div', 'tc-lista'); l.style.marginTop = '14px';
    if (!r.data.length) l.append(el('div', 'tc-st-muted', 'Nenhum grupo ainda.'));
    r.data.forEach((g) => {
      const linha = el('div', 'tc-linha'); const c = el('div', 'tc-corpo');
      c.append(el('div', 'tc-tit', g.nome), el('div', 'tc-sub', 'Visto em ' + quando(g.visto_em)));
      const s = el('select', 'tc-grupo-sel'); s.setAttribute('aria-label', 'Papel do grupo ' + g.nome);
      [['', '— não usar —'], ...Object.entries(PAPEIS)].forEach(([v, t]) => { const o = el('option', null, t); o.value = v; s.append(o); });
      s.value = g.papel || '';
      s.onchange = async () => {
        if (s.value) { const x = await sb.from('tarcisio_grupos').update({ papel:null }).eq('papel', s.value); if (erroBanco(x, 'trocar o grupo')) return; }
        const y = await sb.from('tarcisio_grupos').update({ papel: s.value || null }).eq('jid', g.jid);
        if (!erroBanco(y, 'salvar o grupo')) { toast('Grupo salvo.'); ctl.redesenhar(); }
      };
      c.append(s); linha.append(c); l.append(linha);
    });
    box.append(l);
  });

  // ── ASSISTENTE DE IA: persona, respostas, variação ──
  const assistente = montar(async (box) => {
    const conf = await lerConfig(); if (!conf) return;
    const grid = el('div', 'tc-st-grid');
    const cSit = cartao('Situação');
    cSit.append(el('div', 'tc-st-big ' + (conf.ia_disponivel ? 'tc-st-ok' : 'tc-st-ruim'), conf.ia_disponivel ? '● IA pronta' : '● IA sem chave'));
    cSit.append(el('div', 'tc-st-muted', conf.ia_disponivel ? 'Modelo: ' + conf.ia_modelo
      : 'Falta a chave da Anthropic no robô. Enquanto isso, nada é respondido e os textos saem sem variação.'));
    cSit.append(caixinha(conf, 'respostas_ligadas', 'Responder quem escreve no WhatsApp'));
    cSit.append(caixinha(conf, 'variar_textos', 'Variar o cumprimento do lembrete e do parabéns'));
    cSit.append(el('div', 'tc-st-muted', 'Responde a qualquer hora (foi a pessoa que escreveu). Ausência só é registrada em semana ainda não confirmada. Número desconhecido: pede nome completo, nascimento e quem fala, e manda para a Caixa — nunca liga sozinha.'));
    grid.append(cSit);

    const cPer = cartao('Persona');
    cPer.append(el('label', 'tc-rotulo', 'Nome'));
    const fNome = el('input', 'tc-campo'); fNome.type = 'text'; fNome.value = conf.persona_nome; cPer.append(fNome);
    const fTom = textoEditavel(cPer, 'Tom de voz', conf.persona_tom);
    const fReg = textoEditavel(cPer, 'Regras (o que pode e o que não pode)', conf.persona_regras);
    const ac = el('div', 'tc-st-acoes');
    ac.append(botao('Salvar persona', 'gold', async () => {
      if (!fNome.value.trim()) { uiAlert('Dê um nome ao assistente.'); return; }
      await salvarConfig({ persona_nome: fNome.value.trim(), persona_tom: fTom.value.trim(), persona_regras: fReg.value.trim() }, 'Persona salva.');
    }));
    cPer.append(ac); grid.append(cPer);
    box.append(grid);
  });

  // ── CONVERSAS: o que chegou e o que foi respondido (últimos 7 dias) ──
  const conversas = montar(async (box, ctl) => {
    const desde = new Date(Date.now() - 7 * 864e5).toISOString();
    const [msgs, pend] = await Promise.all([
      sb.from('tarcisio_mensagens').select('*').gte('created_at', desde).order('created_at', { ascending:false }).limit(400),
      sb.from('tarcisio_pendencias').select('id', { count:'exact', head:true }).eq('estado', 'aberta'),
    ]);
    if (erroBanco(msgs, 'ler as conversas')) return;
    const ids = [...new Set(msgs.data.flatMap((m) => m.membro_ids || []))];
    const nomes = {};
    if (ids.length) { const r = await sb.from('acolitos_membros').select('id,nome').in('id', ids); (r.data || []).forEach((m) => { nomes[m.id] = m.nome; }); }
    box.append(el('p', 'tc-st-muted', `Últimos 7 dias. Pendências abertas na Caixa: ${pend.count ?? 0}.`));
    const ac = el('div', 'tc-st-acoes'); ac.append(botao('Atualizar', 'gray', () => ctl.redesenhar())); box.append(ac);
    const porNumero = new Map();
    msgs.data.forEach((m) => { if (!porNumero.has(m.numero)) porNumero.set(m.numero, []); porNumero.get(m.numero).push(m); });
    const l = el('div', 'tc-lista'); l.style.marginTop = '14px';
    if (!porNumero.size) l.append(el('div', 'tc-st-muted', 'Nenhuma conversa ainda.'));
    porNumero.forEach((lista, numero) => {
      const c = el('div', 'tc-conversa');
      const quem = [...new Set(lista.flatMap((m) => m.membro_ids || []))].map((id) => nomes[id]).filter(Boolean);
      c.append(el('div', 'tc-tit', foneBonito(numero) + (quem.length ? ' · ' + quem.join(', ') : ' · número desconhecido')));
      lista.slice(0, 12).reverse().forEach((m) => {
        const b = el('div', 'tc-bolha tc-' + m.direcao, m.texto || `[${m.midia || 'mídia'}]`);
        const fez = (m.ferramentas || []).map((f) => f.ferramenta).join(', ');
        b.append(el('small', null, quando(m.created_at) + (fez ? ' · usou: ' + fez : '') + (m.direcao === 'entrada' && !m.respondida ? ' · aguardando' : '')));
        c.append(b);
      });
      l.append(c);
    });
    box.append(l);
  });

  // ── AVISOS (coordenação) ──
  const avisos = montar(async (box, ctl) => {
    const r = await sb.from('tarcisio_avisos').select('*').order('ativo', { ascending:false }).order('quando');
    if (erroBanco(r, 'ler os avisos')) return;
    const ac = el('div', 'tc-st-acoes'); ac.style.marginTop = '0';
    ac.append(botao('+ Novo aviso', 'gold', () => abrirAviso(null, ctl)));
    box.append(ac);
    const l = el('div', 'tc-lista'); l.style.marginTop = '14px';
    if (!r.data.length) l.append(el('div', 'tc-st-muted', 'Nenhum aviso agendado.'));
    r.data.forEach((a) => {
      const linha = el('div', 'tc-linha'); const c = el('div', 'tc-corpo');
      const t = el('div', 'tc-tit'); t.append(el('span', 'tc-chip ' + (a.ativo ? 'tc-pendente' : 'tc-cancelado'), a.ativo ? 'ativo' : 'encerrado'), document.createTextNode(a.titulo));
      const destinos = [...a.grupos.map((p) => 'Grupo ' + PAPEIS[p]), ...a.privado.map((p) => 'Privado ' + PAPEIS[p])].join(', ');
      c.append(t, el('div', 'tc-sub', `${a.ativo ? 'Próximo: ' + quando(a.quando) : 'Último: ' + quando(a.quando)} · ${REPETIR[a.repetir]}${a.ate ? ' até ' + a.ate.split('-').reverse().join('/') : ''}\n${destinos}${a.imagem_url ? ' · 🖼 com imagem' : ''}`));
      const acs = el('div', 'tc-st-acoes');
      acs.append(botao('Editar', 'gray', () => abrirAviso(a, ctl)));
      if (a.ativo) {
        acs.append(botao('Enviar agora', 'gold', async () => {
          if (!await uiConfirm('Enviar "' + a.titulo + '" agora? Se ele se repete, a próxima vez conta a partir de hoje.')) return;
          const x = await sb.from('tarcisio_avisos').update({ quando: new Date().toISOString() }).eq('id', a.id);
          if (!erroBanco(x, 'enviar')) { toast('Na fila: sai em alguns segundos.'); ctl.redesenhar(); }
        }));
        acs.append(botao('Encerrar', 'wine', async () => {
          if (!await uiConfirm('Encerrar o aviso "' + a.titulo + '"? Ele não sai mais.')) return;
          const x = await sb.from('tarcisio_avisos').update({ ativo:false }).eq('id', a.id);
          if (!erroBanco(x, 'encerrar')) ctl.redesenhar();
        }));
      }
      c.append(acs); linha.append(c); l.append(linha);
    });
    box.append(l);
  });

  function paraCampoData(iso) {
    const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60_000);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone:FUSO, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  }

  // Pede o rascunho ao robô (pela tabela) e espera até 40 s.
  async function rascunhoIA(ideia) {
    const r = await sb.from('tarcisio_ia_pedidos').insert({ entrada: ideia }).select('id').single();
    if (r.error) throw new Error(r.error.message);
    const fim = Date.now() + 40_000;
    while (Date.now() < fim) {
      await new Promise((ok) => setTimeout(ok, 2000));
      const x = await sb.from('tarcisio_ia_pedidos').select('estado,saida,erro').eq('id', r.data.id).single();
      if (x.error) throw new Error(x.error.message);
      if (x.data.estado === 'pronto') return x.data.saida;
      if (x.data.estado === 'falhou') throw new Error(x.data.erro || 'a IA não respondeu');
    }
    throw new Error('a IA demorou demais; tente de novo');
  }

  function abrirAviso(a, ctl) {
    const ov = el('div', 'modal-overlay open'); ov.id = 'modal-aviso';
    const m = el('div', 'modal tc-form-av'); m.style.overflowY = 'auto';
    m.append(el('h2', 'modal-title', a ? 'Editar aviso' : 'Novo aviso'));
    const campo = (rot, tipo, val) => { const l = el('label', null, rot); const i = el(tipo === 'textarea' ? 'textarea' : 'input'); if (tipo !== 'textarea') i.type = tipo; i.value = val || ''; m.append(l, i); return i; };
    const fTit = campo('Título (só para a coordenação)', 'text', a?.titulo);
    const fTxt = campo('Mensagem', 'textarea', a?.texto);
    const ia = botao('✨ Escrever com IA a partir do que está na mensagem', 'gray', async () => {
      const ideia = fTxt.value.trim();
      if (ideia.length < 3) { uiAlert('Escreva a ideia na mensagem (ex.: "reunião de formação segunda 19h30 no salão") e toque de novo.'); return; }
      ia.disabled = true; const t0 = ia.textContent; ia.textContent = 'Escrevendo…';
      try { fTxt.value = await rascunhoIA(ideia); toast('Rascunho pronto. Revise antes de salvar.'); }
      catch (e) { uiAlert('Não deu para escrever com IA: ' + e.message); }
      ia.disabled = false; ia.textContent = t0;
    });
    ia.style.marginTop = '8px'; m.append(ia);
    m.append(el('label', null, 'Imagem (opcional)'));
    const fImg = el('input'); fImg.type = 'file'; fImg.accept = 'image/png,image/jpeg,image/webp'; m.append(fImg);
    let imagemUrl = a?.imagem_url || null;
    const prev = el('img', 'tc-prev-img'); if (imagemUrl) prev.src = imagemUrl; else prev.style.display = 'none'; m.append(prev);
    const tirar = botao('Tirar imagem', 'gray', () => { imagemUrl = null; prev.style.display = 'none'; tirar.style.display = 'none'; fImg.value = ''; });
    if (!imagemUrl) tirar.style.display = 'none'; m.append(tirar);
    fImg.onchange = () => { const f = fImg.files[0]; if (f) { prev.src = URL.createObjectURL(f); prev.style.display = ''; tirar.style.display = ''; } };
    const marcas = (rot, sel) => {
      m.append(el('label', null, rot)); const g = el('div', 'tc-marcas'); const caixas = {};
      Object.entries(PAPEIS).forEach(([k, t]) => { const l = el('label'); const c = el('input'); c.type = 'checkbox'; c.checked = (sel || []).includes(k); caixas[k] = c; l.append(c, document.createTextNode(t)); g.append(l); });
      m.append(g); return () => Object.keys(caixas).filter((k) => caixas[k].checked);
    };
    const lerGrupos = marcas('Mandar nos grupos', a?.grupos);
    const lerPrivado = marcas('Mandar no privado de (pais = responsável de cada menor)', a?.privado);
    const fQuando = campo('Quando sai', 'datetime-local', paraCampoData(a?.quando));
    m.append(el('label', null, 'Repetir'));
    const fRep = el('select'); Object.entries(REPETIR).forEach(([k, t]) => { const o = el('option', null, t); o.value = k; fRep.append(o); }); fRep.value = a?.repetir || 'nao'; m.append(fRep);
    const fAte = campo('Repetir até (opcional)', 'date', a?.ate);
    const msg = el('div', 'msg'); m.append(msg);
    const acs = el('div', 'modal-actions');
    const fechar = () => { ov.remove(); ctl.redesenhar(); };
    acs.append(botao('Cancelar', 'gray', fechar));
    const salvar = botao('Salvar aviso', 'gold', async () => {
      const grupos = lerGrupos(), privado = lerPrivado();
      const erro = (t) => { msg.className = 'msg error'; msg.textContent = t; };
      if (!fTit.value.trim()) return erro('Dê um título ao aviso.');
      if (!fTxt.value.trim() && !imagemUrl && !fImg.files[0]) return erro('Escreva a mensagem ou escolha uma imagem.');
      if (!grupos.length && !privado.length) return erro('Escolha ao menos um grupo ou um público no privado.');
      if (!fQuando.value) return erro('Diga quando o aviso sai.');
      if (privado.length && !await uiConfirm('Este aviso vai no PRIVADO de várias pessoas, aos poucos (uma a cada 20–40 s). Confirma?')) return;
      salvar.disabled = true; salvar.textContent = 'Salvando…';
      if (fImg.files[0]) {
        const f = fImg.files[0];
        const caminho = `avisos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
        const up = await sb.storage.from('tarcisio').upload(caminho, f, { contentType: f.type });
        if (up.error) { salvar.disabled = false; salvar.textContent = 'Salvar aviso'; return erro('A imagem não subiu: ' + up.error.message); }
        imagemUrl = sb.storage.from('tarcisio').getPublicUrl(caminho).data.publicUrl;
      }
      const dados = { titulo: fTit.value.trim(), texto: fTxt.value.trim() || null, imagem_url: imagemUrl, grupos, privado,
        quando: new Date(fQuando.value + ':00-03:00').toISOString(), repetir: fRep.value, ate: fAte.value || null, ativo: true };
      const r = a ? await sb.from('tarcisio_avisos').update(dados).eq('id', a.id) : await sb.from('tarcisio_avisos').insert(dados);
      if (r.error) { salvar.disabled = false; salvar.textContent = 'Salvar aviso'; return erro('Não foi possível salvar: ' + r.error.message); }
      toast('Aviso salvo.'); fechar();
    });
    acs.append(salvar); m.append(acs); ov.append(m); document.body.append(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov) fechar(); });
    fTit.focus();
  }

  // ── SEM NÚMERO ──
  const semNumero = montar(async (box) => {
    const desde = new Date(Date.now() - 60 * 864e5).toISOString();
    const r = await sb.from('tarcisio_envios').select('membro_id,destino_nome,erro,created_at,tipo,estado')
      .or('estado.eq.sem_numero,erro.eq."Número sem WhatsApp"').gte('created_at', desde).order('created_at', { ascending:false }).limit(500);
    if (erroBanco(r, 'ler a lista')) return;
    const porMembro = new Map();
    r.data.forEach((e) => { const k = e.membro_id || e.destino_nome; if (k && !porMembro.has(k)) porMembro.set(k, e); });
    box.append(el('p', 'tc-st-muted', 'Quem deveria ter recebido algo nos últimos 60 dias e não recebeu por falta de WhatsApp. O app já pede o número do responsável ao abrir; para corrigir agora, edite o telefone de recado na ficha em Membros.'));
    const l = el('div', 'tc-lista'); l.style.marginTop = '14px';
    if (!porMembro.size) l.append(el('div', 'tc-st-muted tc-st-ok', 'Ninguém sem número. 🎉'));
    [...porMembro.values()].forEach((e) => {
      const linha = el('div', 'tc-linha'); const c = el('div', 'tc-corpo');
      c.append(el('div', 'tc-tit', e.destino_nome || '—'), el('div', 'tc-sub', `${e.erro || 'Sem número'} · ${TIPOS[e.tipo] || e.tipo} de ${quando(e.created_at)}`));
      linha.append(c); l.append(linha);
    });
    box.append(l);
  });

  // ── CAIXA: pendências que o assistente abriu (ligar número, chamar a coordenação) ──
  // Devolve quantas desenhou; lança o erro de carga para a Caixa nunca dizer "Tudo em dia" à toa.
  async function pendenciasCaixa(container) {
    const r = await sb.from('tarcisio_pendencias').select('*').eq('estado', 'aberta').order('created_at');
    if (r.error) throw r.error;
    if (!r.data.length) return 0;
    const card = el('div', 'tc-conversa'); card.style.marginTop = '14px';
    card.append(el('div', 'tc-tit', `📲 São Tarcísio — ${r.data.length} pendência(s)`));
    r.data.forEach((p) => {
      const d = p.dados || {};
      const linha = el('div', 'tc-linha'); linha.style.marginTop = '10px';
      const c = el('div', 'tc-corpo');
      c.append(el('div', 'tc-tit', p.resumo));
      const det = [`Número: ${foneBonito(p.numero)} · ${quando(p.created_at)}`];
      if (p.tipo === 'vincular_numero') det.push(`Quem fala: ${d.quem_fala || '—'} (${d.relacao || '—'}) · Nascimento: ${d.data_nascimento ? d.data_nascimento.split('-').reverse().join('/') : (d.idade ? d.idade + ' anos' : '—')}`);
      c.append(el('div', 'tc-sub', det.join('\n')));
      const acs = el('div', 'tc-st-acoes');
      if (p.tipo === 'vincular_numero') {
        (d.candidatos || []).forEach((cand) => acs.append(botao(`Ligar a ${cand.nome}${cand.data_nascimento ? ' (' + cand.data_nascimento.split('-').reverse().join('/') + ')' : ''}`, 'gold', async () => {
          if (!await uiConfirm(`Ligar ${foneBonito(p.numero)} a ${cand.nome} como ${d.relacao === 'proprio' ? 'telefone do próprio servo' : 'WhatsApp do responsável'}?`)) return;
          const x = await sb.rpc('tarcisio_vincular_numero', { p_pendencia: p.id, p_membro: cand.id, p_relacao: d.relacao || 'responsavel' });
          if (x.error || (x.data && x.data.erro)) { uiAlert('Não foi possível ligar: ' + (x.error ? x.error.message : x.data.erro)); return; }
          toast('Número ligado.'); linha.remove();
        })));
        if (!(d.candidatos || []).length) c.append(el('div', 'tc-sub tc-st-ruim', 'Nenhum cadastro bate com esse nome. Confira em Membros e preencha o telefone de recado na ficha.'));
      }
      acs.append(botao(p.tipo === 'coordenacao' ? 'Resolvido' : 'Descartar', 'gray', async () => {
        const x = await sb.from('tarcisio_pendencias').update({ estado: p.tipo === 'coordenacao' ? 'resolvida' : 'descartada', resolvido_em: new Date().toISOString() }).eq('id', p.id);
        if (!erroBanco(x, 'fechar a pendência')) linha.remove();
      }));
      c.append(acs); linha.append(c); card.append(linha);
    });
    container.append(card);
    return r.data.length;
  }

  global.TarcisioPainel = { whatsapp, grupos, assistente, conversas, avisos, semNumero, pendenciasCaixa };
})(window);
