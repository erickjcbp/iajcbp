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

    // Escala automática de terça e aviso de ausências (migration 104)
    const cAuto = cartao('Escala automática e ausências');
    cAuto.append(el('p', 'tc-st-muted', 'Terça, 18h01, o robô monta a escala do fim de semana e manda a conferência para o número abaixo, com os botões Confirmar e Revisar. De domingo a terça ele lembra os grupos de avisar as ausências.'));
    const campo = (rotulo, el0) => { cAuto.append(el('label', 'tc-rotulo', rotulo)); cAuto.append(el0); return el0; };
    const entrada = (valor, ph) => { const i = el('input', 'tc-campo'); i.type = 'text'; i.value = valor || ''; if (ph) i.placeholder = ph; return i; };
    const iNum = campo('Número que recebe a conferência (com DDD)', entrada(foneBonito(conf.numero_conferencia) || conf.numero_conferencia, '(19) 99999-9999'));
    iNum.inputMode = 'tel';
    const aRem = campo('Outros números que podem mandar o PDF dos ministros (um por linha)', el('textarea', 'tc-area'));
    aRem.value = (conf.remetentes_pdf || []).map(foneBonito).join('\n'); aRem.style.minHeight = '64px';
    const iHor = campo('Horários do aviso de ausência (ex.: 09:00, 18:00)', entrada((conf.ausencia_horas || []).join(', '), '09:00'));
    const iUlt = campo('Último aviso (terça, até as…)', entrada(conf.ausencia_ultimo, '15:00'));
    const aTxt = campo('Texto do aviso — deixe vazio para usar o padrão', el('textarea', 'tc-area'));
    aTxt.value = conf.ausencia_texto || ''; aTxt.style.minHeight = '80px';
    const acAuto = el('div', 'tc-st-acoes');
    acAuto.append(botao('Salvar', 'gold', async () => {
      const digitos = (t) => String(t || '').replace(/\D/g, '');
      const norm = (t) => { let d = digitos(t); if (d.length === 10 || d.length === 11) d = '55' + d; return /^55\d{10,11}$/.test(d) ? d : null; };
      const num = norm(iNum.value);
      if (!num) { uiAlert('Número inválido. Use DDD + número, por exemplo (19) 99999-9999.'); return; }
      const rem = []; for (const l of aRem.value.split(/\n+/).map((x) => x.trim()).filter(Boolean)) { const n = norm(l); if (!n) { uiAlert('Número inválido na lista de remetentes: ' + l); return; } rem.push(n); }
      const horas = iHor.value.split(/[,;\s]+/).filter(Boolean);
      const hh = /^([01]?\d|2[0-3]):[0-5]\d$/;
      if (!horas.length || !horas.every((h) => hh.test(h))) { uiAlert('Horários inválidos. Use o formato 09:00, 18:00.'); return; }
      if (!hh.test(iUlt.value.trim())) { uiAlert('Horário do último aviso inválido. Use o formato 15:00.'); return; }
      const pad = (h) => (h.length === 4 ? '0' + h : h);
      await salvarConfig({ numero_conferencia: num, remetentes_pdf: rem, ausencia_horas: horas.map(pad), ausencia_ultimo: pad(iUlt.value.trim()), ausencia_texto: aTxt.value.trim() || null }, 'Salvo.');
    }));
    cAuto.append(acAuto); box.append(cAuto);

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

  // ── CONVERSAS: estilo WhatsApp — lista de contatos à esquerda, conversa à direita (últimos 30 dias) ──
  const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone:FUSO, hour:'2-digit', minute:'2-digit' });
  const diaChave = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone:FUSO });
  const diaRotulo = (iso) => {
    const k = diaChave(iso), hoje = diaChave(new Date().toISOString()), ontem = diaChave(new Date(Date.now() - 864e5).toISOString());
    if (k === hoje) return 'Hoje';
    if (k === ontem) return 'Ontem';
    return new Date(iso).toLocaleDateString('pt-BR', { timeZone:FUSO, weekday:'long', day:'2-digit', month:'long' });
  };
  const iniciais = (nome) => (nome || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const ROTULO_FERRAMENTA = { escala_dos_meus:'consultou a escala', registrar_ausencia:'registrou ausência', chamar_coordenacao:'chamou a coordenação', identificar:'pediu vínculo do número' };
  const previa = (m) => (m.direcao === 'saida' ? '✓ ' : '') + (m.texto || `[${m.midia || 'mídia'}]`).replace(/\s+/g, ' ');

  const conversas = montar(async (box, ctl) => {
    const desde = new Date(Date.now() - 30 * 864e5).toISOString();
    const [msgs, pend, envios] = await Promise.all([
      sb.from('tarcisio_mensagens').select('*').gte('created_at', desde).order('created_at', { ascending:false }).limit(1500),
      sb.from('tarcisio_pendencias').select('numero').eq('estado', 'aberta'),
      sb.from('tarcisio_envios').select('id,destino_numero,texto,enviado_em,created_at,membro_id')
        .eq('estado', 'enviado').not('destino_numero', 'is', null).gte('enviado_em', desde)
        .order('enviado_em', { ascending:false }).limit(1500),
    ]);
    if (erroBanco(msgs, 'ler as conversas')) return;
    if (erroBanco(envios, 'ler os envios privados')) return;
    // Respostas do bot já aparecem em tarcisio_mensagens. Avisos e lembretes automáticos
    // ficam em tarcisio_envios; incluí-los completa o histórico de saída sem duplicar uma
    // resposta registrada nos dois lugares no mesmo instante.
    const historico = [...(msgs.data || [])];
    const normalizarTexto = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    (envios.data || []).forEach((e) => {
      const horario = e.enviado_em || e.created_at;
      const duplicada = historico.some((m) => m.direcao === 'saida' && m.numero === e.destino_numero
        && normalizarTexto(m.texto) === normalizarTexto(e.texto) && Math.abs(new Date(m.created_at) - new Date(horario)) <= 30_000);
      if (!duplicada) historico.push({ id:'envio:'+e.id, numero:e.destino_numero, direcao:'saida', texto:e.texto,
        midia:null, external_id:null, membro_ids:e.membro_id ? [e.membro_id] : [], ferramentas:null,
        respondida:true, created_at:horario, envio_estado:'enviado' });
    });
    const comPendencia = new Set((pend.data || []).map((p) => p.numero));
    const ids = [...new Set(historico.flatMap((m) => m.membro_ids || []))];
    const nomes = {};
    if (ids.length) { const r = await sb.from('acolitos_membros').select('id,nome').in('id', ids); (r.data || []).forEach((m) => { nomes[m.id] = m.nome; }); }

    // Uma conversa por número; mensagens em ordem cronológica.
    const mapa = new Map();
    historico.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .forEach((m) => { if (!mapa.has(m.numero)) mapa.set(m.numero, []); mapa.get(m.numero).push(m); });
    const contatos = [...mapa.entries()].map(([numero, lista]) => {
      const quem = [...new Set(lista.flatMap((m) => m.membro_ids || []))].map((id) => nomes[id]).filter(Boolean);
      return { numero, lista, ultima: lista.at(-1), quem, titulo: quem.length ? quem.join(', ') : foneBonito(numero),
        aguardando: lista.filter((m) => m.direcao === 'entrada' && !m.respondida).length, pendencia: comPendencia.has(numero) };
    }).sort((a, b) => b.ultima.created_at.localeCompare(a.ultima.created_at));

    box.append(el('p', 'tc-st-muted', `Últimos 30 dias · ${contatos.length} conversa(s) · ${comPendencia.size} com pendência aberta na Caixa.`));
    if (!contatos.length) { box.append(el('div', 'tc-st-muted', 'Nenhuma conversa ainda.')); return; }

    const zap = el('div', 'zp');
    const colLista = el('div', 'zp-lista'), colChat = el('div', 'zp-chat');
    zap.append(colLista, colChat);
    box.append(zap);

    let aberto = null, filtro = 'todas', busca = '';
    const cab = el('div', 'zp-cab');
    const campoBusca = el('input', 'zp-busca'); campoBusca.type = 'search'; campoBusca.placeholder = 'Buscar nome ou número';
    const filtros = el('div', 'zp-filtros');
    const itens = el('div', 'zp-itens');
    const botaoAtualizar = botao('↻', 'gray zp-atualizar', () => ctl.redesenhar()); botaoAtualizar.title = 'Atualizar'; botaoAtualizar.setAttribute('aria-label', 'Atualizar');
    const topo = el('div', 'zp-topo'); topo.append(campoBusca, botaoAtualizar);
    cab.append(topo, filtros);
    colLista.append(cab, itens);

    const FILTROS = [['todas', 'Todas'], ['aguardando', 'Aguardando'], ['pendencia', 'Com pendência']];
    const desenharFiltros = () => {
      filtros.textContent = '';
      FILTROS.forEach(([k, rot]) => {
        const n = k === 'aguardando' ? contatos.filter((c) => c.aguardando).length : k === 'pendencia' ? contatos.filter((c) => c.pendencia).length : contatos.length;
        const b = el('button', 'zp-filtro' + (filtro === k ? ' on' : ''), `${rot} ${n}`); b.type = 'button';
        b.onclick = () => { filtro = k; desenharFiltros(); desenharItens(); };
        filtros.append(b);
      });
    };
    const visiveis = () => {
      const q = busca.trim().toLowerCase(), qd = q.replace(/\D/g, '');
      return contatos.filter((c) => (filtro === 'todas' || (filtro === 'aguardando' ? c.aguardando : c.pendencia))
        && (!q || c.titulo.toLowerCase().includes(q) || (qd && c.numero.includes(qd))));
    };
    const desenharItens = () => {
      itens.textContent = '';
      const lista = visiveis();
      if (!lista.length) itens.append(el('div', 'tc-st-muted zp-vazio', 'Nada por aqui.'));
      lista.forEach((c) => {
        const b = el('button', 'zp-item' + (aberto === c.numero ? ' on' : '')); b.type = 'button';
        const av = el('div', 'zp-av', iniciais(c.quem[0]) || '#');
        const meio = el('div', 'zp-meio');
        meio.append(el('div', 'zp-nome', c.titulo), el('div', 'zp-previa', previa(c.ultima)));
        const dir = el('div', 'zp-dir');
        const hoje = diaChave(c.ultima.created_at) === diaChave(new Date().toISOString());
        dir.append(el('div', 'zp-hora' + (c.aguardando ? ' novo' : ''), hoje ? hora(c.ultima.created_at) : diaRotulo(c.ultima.created_at).slice(0, 10)));
        if (c.aguardando) dir.append(el('span', 'zp-badge', String(c.aguardando)));
        else if (c.pendencia) { const w = el('span', 'zp-alerta', '!'); w.title = 'Pendência aberta na Caixa'; dir.append(w); }
        b.append(av, meio, dir);
        b.onclick = () => { aberto = c.numero; zap.classList.add('zp-lendo'); desenharItens(); desenharChat(); };
        itens.append(b);
      });
    };
    const desenharChat = () => {
      colChat.textContent = '';
      const c = contatos.find((x) => x.numero === aberto);
      if (!c) { const v = el('div', 'zp-sem'); v.append(el('div', 'zp-sem-ico', '💬'), el('div', null, 'Escolha uma conversa para ler.')); colChat.append(v); return; }
      const topoChat = el('div', 'zp-chat-topo');
      const voltar = el('button', 'zp-voltar', '←'); voltar.type = 'button'; voltar.setAttribute('aria-label', 'Voltar');
      voltar.onclick = () => { aberto = null; zap.classList.remove('zp-lendo'); desenharItens(); desenharChat(); };
      const info = el('div', 'zp-chat-info');
      info.append(el('div', 'zp-nome', c.titulo), el('div', 'zp-sub', c.quem.length ? foneBonito(c.numero) : 'número sem cadastro ligado'));
      topoChat.append(voltar, el('div', 'zp-av', iniciais(c.quem[0]) || '#'), info);
      if (c.pendencia) topoChat.append(el('span', 'zp-chip-pend', 'pendência aberta'));
      const corpo = el('div', 'zp-corpo');
      let diaAtual = '';
      c.lista.forEach((m) => {
        const k = diaChave(m.created_at);
        if (k !== diaAtual) { diaAtual = k; corpo.append(el('div', 'zp-dia', diaRotulo(m.created_at))); }
        const b = el('div', 'zp-bolha zp-' + m.direcao);
        b.append(el('span', 'zp-txt', m.texto || `[${m.midia || 'mídia'}]`));
        b.append(el('span', 'zp-rodape', hora(m.created_at) + (m.direcao === 'saida' ? ' ✓✓' : (m.respondida ? '' : ' · aguardando'))));
        const fer = [...new Set((m.ferramentas || []).map((f) => ROTULO_FERRAMENTA[f.ferramenta] || f.ferramenta))];
        if (fer.length) { const t = el('div', 'zp-ferr'); fer.forEach((f) => t.append(el('span', 'zp-ferr-chip' + (f === 'chamou a coordenação' ? ' alerta' : ''), '⚙ ' + f))); b.append(t); }
        corpo.append(b);
      });
      colChat.append(topoChat, corpo);
      corpo.scrollTop = corpo.scrollHeight;
    };
    campoBusca.oninput = () => { busca = campoBusca.value; desenharItens(); };
    desenharFiltros(); desenharItens(); desenharChat();
  });

  function avisosDasRegras(cfg) {
    const link='https://coroinhas.jcbplimeira.com.br/ausencias';
    const ausencia=cfg.ausencia_texto || 'Paz e bem! Se você ou seu filho(a) não puder servir no próximo fim de semana, registre a ausência até terça-feira, às 18h.';
    const base=(regra,titulo,texto,ativo,destinos,horario)=>({id:'regra:'+regra,titulo,texto,ativo,grupos:[],privado:[],quando:null,repetir:'regra',imagem_url:null,
      configuracao:{tipo:'regra_nativa',regra,destinos_rotulo:destinos,horario_rotulo:horario},_cfg:cfg});
    return [
      base('ausencia','Ausências — domingo, segunda e terça',ausencia.includes(link)?ausencia:ausencia+'\n\nRegistre pelo link universal:\n'+link,
        !!((cfg.ausencia_horas||[]).length || cfg.ausencia_ultimo),'Grupos vinculados da pastoral',
        'Domingo, segunda e terça: '+(cfg.ausencia_horas||[]).map(h=>h.slice(0,5)).join(', ')+' · último lembrete da terça: '+(cfg.ausencia_ultimo||'desligado').slice(0,5)),
      base('lembrete','Lembrete da escala — véspera da Missa',cfg.texto_lembrete||'',!!cfg.lembrete_ligado,'No particular de quem está escalado, sem números repetidos','Na véspera de escala confirmada, às '+(cfg.hora_lembrete||'19:00').slice(0,5)),
      base('aniversario','Aniversários',cfg.texto_aniversario||'',!!cfg.aniversario_ligado,'No particular do aniversariante ou responsável','No dia do aniversário, às '+(cfg.hora_aniversario||'08:00').slice(0,5)),
      base('escala','Arte da escala nos grupos','A imagem é gerada a partir da escala confirmada. Cada grupo recebe a arte uma única vez por semana.',!!cfg.escala_ligada,'Grupos vinculados da pastoral','Após a confirmação da escala e a geração da arte'),
      base('conferencia','Conferência da escala — terça-feira','Gera ou lê o rascunho, envia a imagem no particular da coordenação e apresenta Confirmar / Revisar.',!cfg.pausado,'No número de conferência da coordenação','Terça, a partir das 18h01; lembretes terça às 20h e quarta às 09h')
    ];
  }

  function abrirRegra(a, ctl) {
    if(a.configuracao.regra==='conferencia'){ if(typeof abrirSecao==='function')abrirSecao('tarcisio_whatsapp'); return; }
    const cfg=a._cfg, regra=a.configuracao.regra;
    const ov=el('div','modal-overlay open');ov.id='modal-aviso';
    const m=el('div','modal tc-form-av');m.style.overflowY='auto';m.append(el('h2','modal-title',a.titulo));
    m.append(el('p','tc-sub','Esta é a regra automática existente. Salvar aqui atualiza a própria regra, sem criar outro disparo.'));
    const campo=(rot,tipo,valor)=>{const l=el('label',null,rot),i=el(tipo==='textarea'?'textarea':'input');if(tipo!=='textarea')i.type=tipo;i.value=valor||'';m.append(l,i);return i;};
    const label=el('label');const ativo=el('input');ativo.type='checkbox';ativo.checked=a.ativo;label.append(ativo,document.createTextNode(' Regra ativa'));m.append(label);
    let texto=null,hora=null,ultimo=null;
    if(regra!=='escala')texto=campo('Mensagem','textarea',a.texto);
    else m.append(el('p','tc-sub',a.texto));
    if(regra==='ausencia'){
      hora=campo('Horários de domingo, segunda e terça (HH:MM, separados por vírgula)','text',(cfg.ausencia_horas?.length?cfg.ausencia_horas:['09:00']).map(h=>h.slice(0,5)).join(', '));
      ultimo=campo('Último lembrete da terça','time',(cfg.ausencia_ultimo||'15:00').slice(0,5));
      m.append(el('p','tc-sub','O link universal é obrigatório e será incluído automaticamente. Prazo: terça às 18h.'));
    }else if(regra!=='escala')hora=campo('Horário','time',(regra==='lembrete'?(cfg.hora_lembrete||'19:00'):(cfg.hora_aniversario||'08:00')).slice(0,5));
    const msg=el('div','msg');m.append(msg);const acs=el('div','modal-actions');
    const fechar=()=>{ov.remove();ctl.redesenhar();};acs.append(botao('Cancelar','gray',fechar));
    const salvar=botao('Salvar regra','gold',async()=>{
      const dados={};
      if(regra==='ausencia'){
        const horas=hora.value.split(',').map(h=>h.trim()).filter(Boolean);
        if(horas.some(h=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(h)||h>'18:00')){msg.textContent='Use horários HH:MM até 18h.';return;}
        const link='https://coroinhas.jcbplimeira.com.br/ausencias';let t=texto.value.trim();if(!t.includes(link))t+='\n\nRegistre sua ausência pelo link universal:\n'+link;
        dados.ausencia_texto=t;dados.ausencia_horas=ativo.checked?[...new Set(horas)]:[];dados.ausencia_ultimo=ativo.checked?(ultimo.value||null):null;
      }else if(regra==='lembrete'){dados.lembrete_ligado=ativo.checked;dados.texto_lembrete=texto.value.trim();dados.hora_lembrete=hora.value;}
      else if(regra==='aniversario'){dados.aniversario_ligado=ativo.checked;dados.texto_aniversario=texto.value.trim();dados.hora_aniversario=hora.value;}
      else dados.escala_ligada=ativo.checked;
      salvar.disabled=true;const r=await sb.from('tarcisio_config').update(dados).eq('id',1);salvar.disabled=false;
      if(r.error){msg.textContent='Não foi possível salvar: '+r.error.message;return;}toast('Regra atualizada.');fechar();
    });acs.append(salvar);m.append(acs);ov.append(m);document.body.append(ov);ov.onclick=e=>{if(e.target===ov)fechar();};
  }

  // ── AVISOS (coordenação) ──
  const avisos = montar(async (box, ctl) => {
    const [r,config]=await Promise.all([
      sb.from('tarcisio_avisos').select('*').order('ativo',{ascending:false}).order('quando'),
      sb.from('tarcisio_config').select('*').eq('id',1).single()
    ]);
    if(erroBanco(r,'ler os avisos')||erroBanco(config,'ler as regras'))return;
    const programados=r.data||[],regras=avisosDasRegras(config.data||{});
    const tela=el('div','ta-painel');
    const toolbar=el('div','ta-toolbar');
    const busca=el('input','ta-busca');busca.type='search';busca.placeholder='Buscar aviso ou regra';busca.setAttribute('aria-label','Buscar aviso ou regra');
    toolbar.append(busca,botao('+ Novo aviso','gold',()=>abrirAviso(null,ctl)));tela.append(toolbar);
    const filtros=el('div','ta-filtros');filtros.setAttribute('aria-label','Filtrar avisos');
    let filtro='todos';const botoes=new Map();
    for(const [id,label] of [['todos','Todos'],['agendados','Agendados'],['recorrentes','Recorrentes'],['regras','Regras automáticas'],['arquivo','Arquivo']]){
      const b=botao(label,'gray ta-filtro',()=>{filtro=id;desenhar();});botoes.set(id,b);filtros.append(b);
    }
    tela.append(filtros);const conteudo=el('div','ta-conteudo');tela.append(conteudo);box.append(tela);
    const normalizar=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const metadados=a=>{
      const cfg=a.configuracao||{},nativa=cfg.tipo==='regra_nativa';
      const destinos=cfg.destinos_rotulo||[...a.grupos.map(p=>'Grupo '+PAPEIS[p]),...a.privado.map(p=>'Privado '+PAPEIS[p])].join(', ');
      let quandoTexto=quando(a.quando),frequencia=REPETIR[a.repetir]||'Regra automática',destino=destinos,alcance='';
      if(nativa){
        const c=a._cfg;
        const horarios={ausencia:['Dom, seg e ter',(c.ausencia_horas||[]).map(h=>h.slice(0,5)).join(', ')+' · terça também '+(c.ausencia_ultimo||'—').slice(0,5)],
          lembrete:[(c.hora_lembrete||'19:00').slice(0,5),'Na véspera da Missa'],aniversario:[(c.hora_aniversario||'08:00').slice(0,5),'No dia do aniversário'],
          escala:['Após confirmar','Quando a arte estiver pronta'],conferencia:['Terça, 18h01','Conferência da coordenação']};
        [quandoTexto,frequencia]=horarios[cfg.regra];
        destino=cfg.regra==='lembrete'?'Quem está escalado':cfg.regra==='aniversario'?'Aniversariante':cfg.regra==='conferencia'?'Coordenação':'Grupos da pastoral';
        alcance=['lembrete','aniversario','conferencia'].includes(cfg.regra)?'No particular':'Nos grupos vinculados';
      }else if(a.chave?.startsWith('retiro-')||cfg.destinos_rotulo?.includes('participantes')){
        const total=destinos.match(/^([0-9]+) números/);destino=(total?total[1]+' participantes':'Participantes elegíveis')+' + cerimoniários';alcance='Particular e grupo';
      }else if(cfg.tipo==='preparacao_missa'){destino='Grupos da pastoral';alcance='Somente nos grupos';frequencia=cfg.horario?'Toda semana':(cfg.antecedencia_min||60)+' min antes da primeira Missa';}
      else if(cfg.prefixo?.includes(':apresentacao:')){destino='Todos os grupos';alcance='Uma apresentação por grupo';}
      return {nativa,destinos,quandoTexto,frequencia,destino,alcance};
    };
    const encerrar=async a=>{
      if(!await uiConfirm('Encerrar e arquivar "'+a.titulo+'"? Os envios pendentes serão cancelados.'))return;
      const x=await sb.from('tarcisio_avisos').update({ativo:false}).eq('id',a.id);
      if(erroBanco(x,'encerrar'))return;
      const fila=await sb.from('tarcisio_envios').update({estado:'cancelado',erro:'Aviso encerrado na configuração'}).eq('aviso_id',a.id).in('estado',['pendente','sem_numero','aguardando_arte']);
      if(!erroBanco(fila,'cancelar os envios'))ctl.redesenhar();
    };
    const excluirDoArquivo=async a=>{
      if(a.ativo||a.configuracao?.tipo==='regra_nativa')return;
      if(!await uiConfirm('Excluir "'+a.titulo+'" do arquivo? O histórico de envios será preservado.'))return;
      const emCurso=await sb.from('tarcisio_envios').select('id').eq('aviso_id',a.id).eq('estado','enviando').limit(1);
      if(erroBanco(emCurso,'conferir envios em andamento'))return;
      if(emCurso.data?.length){uiAlert('Há um envio deste aviso em andamento. Aguarde terminar antes de excluir.');return;}
      const fila=await sb.from('tarcisio_envios').update({estado:'cancelado',erro:'Aviso excluído do arquivo'}).eq('aviso_id',a.id).in('estado',['pendente','sem_numero','aguardando_arte']);
      if(erroBanco(fila,'cancelar os envios pendentes'))return;
      const x=await sb.from('tarcisio_avisos').delete().eq('id',a.id).eq('ativo',false).select('id');
      if(erroBanco(x,'excluir do arquivo'))return;
      if(!x.data?.length){toast('O aviso mudou de estado. Atualizei o arquivo.','error');ctl.redesenhar();return;}
      toast('Aviso excluído do arquivo; histórico preservado.');ctl.redesenhar();
    };
    const linha=a=>{
      const meta=metadados(a),item=el('article','ta-item'),row=el('div','ta-row');
      const titulo=el('div','ta-identidade');titulo.append(el('div','ta-nome',a.titulo));
      const estado=el('span','ta-status '+(a.ativo?'ta-status-ativo':'ta-status-encerrado'),a.ativo?'Ativo':'Arquivado');
      titulo.append(estado);if(a.imagem_url)titulo.append(el('span','ta-anexo','Com arte'));
      const hora=el('div','ta-quando');hora.append(el('strong',null,meta.quandoTexto),el('span',null,meta.frequencia));
      const destino=el('div','ta-destino');destino.title=meta.destinos;destino.append(el('strong',null,meta.destino));if(meta.alcance)destino.append(el('span',null,meta.alcance));
      const acoes=el('div','ta-acoes');
      const detalhe=el('div','ta-detalhe');detalhe.hidden=true;detalhe.id='ta-detalhe-'+a.id.replace(/[^a-z0-9-]/gi,'-');
      const ver=botao('Ver','gray ta-ver',()=>{detalhe.hidden=!detalhe.hidden;ver.textContent=detalhe.hidden?'Ver':'Fechar';ver.setAttribute('aria-expanded',String(!detalhe.hidden));});
      ver.setAttribute('aria-label','Ver mensagem de '+a.titulo);ver.setAttribute('aria-expanded','false');ver.setAttribute('aria-controls',detalhe.id);
      acoes.append(ver,botao(meta.nativa?'Configurar regra':'Editar','gold ta-editar',()=>meta.nativa?abrirRegra(a,ctl):abrirAviso(a,ctl)));
      row.append(titulo,hora,destino,acoes);item.append(row);
      const preview=el('div','ta-preview');
      const texto=el('div','ta-mensagem',a.texto||'O conteúdo é gerado automaticamente a partir da regra.');preview.append(texto);
      if(a.imagem_url){const img=el('img','ta-arte');img.src=a.imagem_url;img.alt='Arte de '+a.titulo;img.loading='lazy';preview.append(img);}
      detalhe.append(preview);const info=el('div','ta-info');info.append(el('span',null,meta.destinos));if(a.configuracao?.horario_rotulo)info.append(el('span',null,a.configuracao.horario_rotulo));detalhe.append(info);
      if(a.ativo&&!meta.nativa){
        const extras=el('div','ta-extras');
        if(!a.configuracao?.tipo)extras.append(botao('Enviar agora','gold',async()=>{
          if(!await uiConfirm('Enviar "'+a.titulo+'" agora?'))return;
          const x=await sb.from('tarcisio_avisos').update({quando:new Date().toISOString()}).eq('id',a.id);
          if(!erroBanco(x,'enviar')){toast('Aviso colocado na fila.');ctl.redesenhar();}
        }));
        extras.append(botao('Encerrar e arquivar','red ta-encerrar',()=>encerrar(a)));detalhe.append(extras);
      }else if(!a.ativo&&!meta.nativa){
        const extras=el('div','ta-extras');
        extras.append(botao('Excluir do arquivo','red ta-excluir',()=>excluirDoArquivo(a)));detalhe.append(extras);
      }
      item.append(detalhe);return item;
    };
    function desenhar(){
      for(const [id,b]of botoes){b.classList.toggle('ta-selecionado',id===filtro);b.setAttribute('aria-pressed',String(id===filtro));}
      conteudo.textContent='';const termo=normalizar(busca.value);
      const combina=a=>!termo||normalizar([a.titulo,a.texto,a.configuracao?.destinos_rotulo].join(' ')).includes(termo);
      const grupos=[];
      if(['todos','agendados'].includes(filtro))grupos.push(['Agendados e recorrentes',programados.filter(a=>a.ativo&&combina(a))]);
      if(filtro==='recorrentes'){
        grupos.push(['Avisos com repetição',programados.filter(a=>a.ativo&&combina(a)&&(a.repetir!=='nao'||a.configuracao?.tipo==='preparacao_missa'))]);
        grupos.push(['Regras automáticas ativas',regras.filter(a=>a.ativo&&combina(a))]);
      }
      if(['todos','regras'].includes(filtro))grupos.push(['Regras automáticas',regras.filter(combina)]);
      if(['todos','arquivo'].includes(filtro))grupos.push(['Arquivo',programados.filter(a=>!a.ativo&&combina(a))]);
      let total=0;
      for(const [titulo,avisos]of grupos){
        if(!avisos.length)continue;total+=avisos.length;
        const secao=el('section','ta-secao'),cab=el('div','ta-secao-topo');cab.append(el('h3',null,titulo),el('span','ta-contagem',String(avisos.length)));secao.append(cab);
        const colunas=el('div','ta-colunas');for(const nome of ['Aviso','Quando','Destino',''])colunas.append(el('span',null,nome));secao.append(colunas);
        const lista=el('div','ta-lista');avisos.forEach(a=>lista.append(linha(a)));secao.append(lista);conteudo.append(secao);
      }
      if(!total)conteudo.append(el('div','ta-vazio',termo?'Nenhum aviso encontrado.':'Nenhum aviso nesta categoria.'));
    }
    busca.oninput=desenhar;desenhar();
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
    const gerenciado = !!a?.configuracao?.tipo;
    if (gerenciado) m.append(el('div', 'tc-sub', a.configuracao.destinos_rotulo + '\n' + (a.configuracao.horario_rotulo || '')));
    const lerGrupos = gerenciado ? () => a.grupos : marcas('Mandar nos grupos', a?.grupos);
    const lerPrivado = gerenciado ? () => a.privado : marcas('Mandar no privado de (pais = responsável de cada menor)', a?.privado);
    const fQuando = campo('Quando sai', 'datetime-local', paraCampoData(a?.quando));
    m.append(el('label', null, 'Repetir'));
    const fRep = el('select'); Object.entries(REPETIR).forEach(([k, t]) => { const o = el('option', null, t); o.value = k; fRep.append(o); }); fRep.value = a?.repetir || 'nao'; m.append(fRep);
    const fAte = campo('Repetir até (opcional)', 'date', a?.ate);
    if (gerenciado) {
      fRep.style.display = 'none'; fAte.style.display = 'none';
      m.append(el('p', 'tc-sub', a.repetir === 'semanal' ? 'Repetição semanal. O horário e a mensagem podem ser ajustados.' : 'Disparo único, conforme configurado para este aviso.'));
    }
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
      if (gerenciado) {
        dados.repetir = a.repetir;
        const configuracao = { ...a.configuracao };
        if (configuracao.tipo === 'preparacao_missa') {
          if (configuracao.horario) {
            configuracao.horario = fQuando.value.slice(11,16);
            configuracao.horario_rotulo = 'Semanalmente às ' + configuracao.horario;
          } else {
            const cels = await sb.from('acolitos_celebracoes').select('minutos').eq('data', fQuando.value.slice(0,10));
            if (cels.error) { salvar.disabled=false; salvar.textContent='Salvar aviso'; return erro('Não foi possível consultar a primeira Missa.'); }
            const mins=(cels.data||[]).map(c=>c.minutos).filter(Number.isInteger);
            const marcado=Number(fQuando.value.slice(11,13))*60+Number(fQuando.value.slice(14,16));
            const antecedencia=mins.length ? Math.min(...mins)-marcado : null;
            if (antecedencia == null || antecedencia <= 0) { salvar.disabled=false; salvar.textContent='Salvar aviso'; return erro('Escolha um horário anterior à primeira Missa cadastrada nesse dia.'); }
            configuracao.antecedencia_min=antecedencia;
            configuracao.horario_rotulo=antecedencia+' minutos antes da primeira Missa cadastrada';
          }
        }
        dados.configuracao=configuracao;
      }
      const r = a ? await sb.from('tarcisio_avisos').update(dados).eq('id', a.id) : await sb.from('tarcisio_avisos').insert(dados);
      if (r.error) { salvar.disabled = false; salvar.textContent = 'Salvar aviso'; return erro('Não foi possível salvar: ' + r.error.message); }
      if (gerenciado) {
        const atualiza = { texto:dados.texto, imagem_url:dados.imagem_url };
        if (a.configuracao.tipo === 'fila_existente') atualiza.agendado_para=dados.quando;
        const fila=await sb.from('tarcisio_envios').update(atualiza).eq('aviso_id', a.id).in('estado',['pendente','sem_numero']);
        if (fila.error) { salvar.disabled=false; salvar.textContent='Salvar aviso'; return erro('Aviso salvo, mas não foi possível atualizar a fila: '+fila.error.message); }
      }
      toast('Aviso salvo.'); fechar();
    });
    acs.append(salvar); m.append(acs); ov.append(m); document.body.append(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov) fechar(); });
    fTit.focus();
  }

  // ── SEM NÚMERO ──
  const semNumero = montar(async (box,ctl) => {
    const desde=new Date(Date.now()-60*864e5).toISOString();
    const r=await sb.from('tarcisio_envios').select('membro_id,destino_nome,erro,created_at,tipo,estado')
      .or('estado.eq.sem_numero,erro.eq."Número sem WhatsApp"').gte('created_at',desde).order('created_at',{ascending:false}).limit(500);
    if(erroBanco(r,'ler a lista'))return;
    const porMembro=new Map();r.data.forEach(e=>{const k=e.membro_id||e.destino_nome;if(k&&!porMembro.has(k))porMembro.set(k,e);});
    const ids=[...porMembro.values()].map(e=>e.membro_id).filter(Boolean);
    const fichas=ids.length?await sb.from('acolitos_membros').select('id,nome,telefone,celular_recado,celular_responsavel,celular_mae').in('id',ids):{data:[]};
    if(erroBanco(fichas,'ler os contatos'))return;
    const membros=new Map((fichas.data||[]).map(m=>[m.id,m]));
    box.append(el('p','tc-st-muted','Cadastre o WhatsApp com DDD abaixo. O contato será salvo na ficha; avisos futuros serão atualizados sem repetir números. Mensagens antigas não serão reenviadas.'));
    const lista=el('div','tn-lista');
    if(!porMembro.size)lista.append(el('div','tc-st-muted tc-st-ok','Ninguém sem número. 🎉'));
    const normalizar=v=>{let n=String(v||'').replace(/\D/g,'').replace(/^0+/,'');if(n.length===10||n.length===11)n='55'+n;if(n.length===12&&n.startsWith('55')&&/[6-9]/.test(n[4]))n=n.slice(0,4)+'9'+n.slice(4);return /^55\d{2}9\d{8}$/.test(n)?n:null;};
    for(const e of porMembro.values()){
      const ficha=membros.get(e.membro_id),linha=el('div','tn-linha'),info=el('div','tn-info');
      info.append(el('div','tc-tit',ficha?.nome||e.destino_nome||'—'),el('div','tc-sub',e.erro||'Sem contato utilizável'));
      linha.append(info);
      if(!e.membro_id||!ficha){info.append(el('div','tc-sub','Este destino não está ligado a uma pessoa. Confira o vínculo na aba Grupos.'));lista.append(linha);continue;}
      const form=el('div','tn-form'),relacao=el('select','tc-campo');relacao.id='tn-tipo-'+e.membro_id;
      for(const [v,t]of [['proprio','Do participante'],['responsavel','Do responsável']]){const o=el('option',null,t);o.value=v;relacao.append(o);}
      const lTipo=el('label','tn-campo');lTipo.htmlFor=relacao.id;lTipo.append(el('span',null,'De quem é o número?'),relacao);
      const numero=el('input','tc-campo');numero.type='tel';numero.inputMode='tel';numero.autocomplete='tel';numero.maxLength=24;numero.placeholder='(19) 99999-9999';numero.id='tn-numero-'+e.membro_id;
      const lNumero=el('label','tn-campo');lNumero.htmlFor=numero.id;lNumero.append(el('span',null,'WhatsApp com DDD'),numero);
      const preencher=()=>{numero.value=foneBonito(relacao.value==='proprio'?ficha.telefone:(ficha.celular_recado||ficha.celular_responsavel||ficha.celular_mae))||'';};relacao.onchange=preencher;preencher();
      const msg=el('div','tn-msg');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');
      const salvar=botao('Salvar','gold',async()=>{
        const n=normalizar(numero.value);if(!n){msg.textContent='Informe um celular válido com DDD.';numero.focus();return;}
        salvar.disabled=true;numero.disabled=true;relacao.disabled=true;salvar.textContent='Salvando…';msg.textContent='';
        try{
          const x=await sb.rpc('tarcisio_salvar_contato',{p_membro:e.membro_id,p_numero:n,p_relacao:relacao.value});
          if(x.error||x.data?.erro||!x.data?.ok){const erros={sem_permissao:'Seu acesso não permite alterar esse contato.',numero_invalido:'Informe um celular válido com DDD.',membro_nao_encontrado:'A ficha não foi encontrada. Atualize a página.'};throw new Error(erros[x.data?.erro]||x.error?.message||'Não foi possível salvar o contato.');}
          toast('Contato salvo.'+(x.data?.futuros_atualizados?' '+x.data.futuros_atualizados+' aviso(s) futuro(s) atualizado(s).':''));
          await ctl.redesenhar();
        }catch(err){msg.textContent=err.message||'Não foi possível salvar. Tente novamente.';}
        finally{salvar.disabled=false;numero.disabled=false;relacao.disabled=false;salvar.textContent='Salvar';}
      });
      salvar.setAttribute('aria-label','Salvar número de '+(ficha.nome||e.destino_nome));numero.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();salvar.click();}};
      form.append(lTipo,lNumero,salvar,msg);linha.append(form);lista.append(linha);
    }
    box.append(lista);
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
