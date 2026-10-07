// Ficha rápida do membro — chamada de dentro da Escala (Operacional/Planilha/Rodízio), sem
// navegar pra Membros. Pedido do dono (07/10/2026): "botão na frente do nome... não ser
// redirecionado, mas sim uma extensão do modal". Cobre o uso do dia a dia (dados básicos,
// disponibilidade, suspender, arquivar); edição mais funda (Família/Frequência/Mensagem/
// Acessos) continua só em Membros — o link "Ver ficha completa" leva lá.
//
// Depende só do que já é global via shared.js (nivelInfo, abrirSeletorNivel, buildAvatarEl,
// casaSlugDe, uiConfirm, toast, formatDate, hojeLocal, HORARIOS, RodizioCore) + `sb` (o
// cliente Supabase já usado pelas escritas de escala.html — mesma regra de permissão).
(function (global) {
  'use strict';

  const COMUNIDADES = [['matriz', 'Matriz'], ['santo_antonio', 'Sto. Antônio'], ['outra', 'Outra']];

  function fGroup(label) {
    const g = document.createElement('div'); g.className = 'form-group';
    const l = document.createElement('label'); l.className = 'form-label'; l.textContent = label;
    g.appendChild(l); return g;
  }
  function campoTexto(label, valorInicial, onChange) {
    const g = fGroup(label);
    const i = document.createElement('input'); i.className = 'form-input'; i.type = 'text';
    i.value = valorInicial || '';
    i.oninput = () => onChange(i.value);
    g.appendChild(i); return g;
  }
  function campoSelect(label, valorInicial, opcoes, onChange) {
    const g = fGroup(label);
    const s = document.createElement('select'); s.className = 'form-input';
    opcoes.forEach(([v, lab]) => { const o = document.createElement('option'); o.value = v; o.textContent = lab; if (v === valorInicial) o.selected = true; s.appendChild(o); });
    s.onchange = () => onChange(s.value);
    g.appendChild(s); return g;
  }

  // Suspensão — mesmo comportamento de membros.html (blocoSuspensao), com `sb` no lugar de
  // `sbAdmin`: a escala já escreve suspenso_em/suspenso_ate direto com esse cliente.
  function blocoSuspensaoRapida(m, aoMudar) {
    const hoje = hojeLocal();
    const box = document.createElement('div');
    box.style.cssText = 'margin:16px 0 4px;padding:10px 12px;border:1px solid var(--border-wine);border-radius:6px;background:var(--surface2);';
    const ativa = RodizioCore.suspensoNaData(m, hoje);
    const t = document.createElement('div');
    t.style.cssText = 'font-size:12px;line-height:1.5;margin-bottom:8px;color:var(--text);';
    t.textContent = ativa
      ? 'Suspenso até ' + formatDate(m.suspenso_ate).slice(0, 5) + ' — não entra em nenhuma escala até lá.'
      : 'Suspender tira a pessoa da escala por ' + RodizioCore.DIAS_SUSPENSAO + ' dias, sem mexer na disponibilidade.';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-sm ' + (ativa ? 'gray' : 'wine');
    b.textContent = ativa ? '▶ Reativar antes do prazo' : '⏸ Suspender por ' + RodizioCore.DIAS_SUSPENSAO + ' dias';
    b.onclick = async () => {
      const nome = m.apelido || m.nome;
      const ate = RodizioCore.suspensoAteDe(hoje);
      const ok = await uiConfirm(ativa
        ? 'A suspensão de ' + nome + ' vai até ' + formatDate(m.suspenso_ate).slice(0, 5) + '. Reativar agora faz a pessoa voltar a ser escalada já na próxima escala. Reativar mesmo?'
        : 'Suspender ' + nome + ' até ' + formatDate(ate).slice(0, 5) + '? Fica fora de todas as escalas nesse prazo.',
        { ok: ativa ? 'Reativar agora' : 'Suspender', cancel: 'Cancelar' });
      if (!ok) return;
      const novo = ativa ? { suspenso_em: null, suspenso_ate: null } : { suspenso_em: hoje, suspenso_ate: ate };
      const { error } = await sb.from('acolitos_membros').update(novo).eq('id', m.id);
      if (error) { toast('Não consegui gravar: ' + error.message, 'error'); return; }
      Object.assign(m, novo);
      toast(ativa ? nome + ' reativado' : nome + ' suspenso até ' + formatDate(ate).slice(0, 5));
      box.replaceWith(blocoSuspensaoRapida(m, aoMudar));
      aoMudar();
    };
    box.append(t, b);
    return box;
  }

  async function abrirFichaRapida(membro, opts) {
    opts = opts || {};
    const aoMudar = () => { try { opts.aoMudar && opts.aoMudar(); } catch (e) { console.error(e); } };

    const ov = document.createElement('div'); ov.className = 'modal-overlay open';
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    const md = document.createElement('div'); md.className = 'modal';
    md.style.setProperty('--modal-max', '520px');
    const close = document.createElement('button'); close.type = 'button'; close.className = 'modal-close'; close.textContent = '✕'; close.onclick = () => ov.remove();
    md.appendChild(close);
    const handle = document.createElement('div'); handle.className = 'modal-handle'; md.appendChild(handle);

    // ── Header: avatar + nome + nível ──
    const hdr = document.createElement('div'); hdr.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:14px;';
    hdr.appendChild(buildAvatarEl(membro.foto_url, membro.role, 72, {
      casaSlug: casaSlugDe(membro), nivelSlug: membro.nivel || 'aspirante',
    }));
    const nomeEl = document.createElement('div'); nomeEl.style.cssText = 'font-family:Sora,sans-serif;font-weight:700;font-size:16px;text-align:center;';
    nomeEl.textContent = membro.apelido || membro.nome;
    if (membro.apelido) { const sub = document.createElement('div'); sub.style.cssText = 'font-size:12px;color:var(--text-muted);'; sub.textContent = membro.nome; hdr.appendChild(nomeEl); hdr.appendChild(sub); }
    else hdr.appendChild(nomeEl);
    const rankBtn = document.createElement('button'); rankBtn.type = 'button'; rankBtn.className = 'btn-sm gold'; rankBtn.style.marginTop = '4px';
    rankBtn.textContent = '⬆ Alterar nível · ' + nivelInfo(membro.nivel || 'aspirante').label;
    rankBtn.onclick = () => abrirSeletorNivel(membro, { onSalvo: (nv) => { membro.nivel = nv; rankBtn.textContent = '⬆ Alterar nível · ' + nivelInfo(nv).label; aoMudar(); } });
    hdr.appendChild(rankBtn);
    md.appendChild(hdr);

    if (RodizioCore.suspensoNaData(membro, hojeLocal())) {
      const susp = document.createElement('div'); susp.className = 'rodizio-susp'; susp.style.cssText += 'display:block;text-align:center;margin-bottom:10px;';
      susp.textContent = 'suspenso até ' + formatDate(membro.suspenso_ate).slice(0, 5);
      md.appendChild(susp);
    }

    // ── Campos básicos ──
    const edits = {};
    md.appendChild(campoTexto('Apelido', membro.apelido, (v) => { edits.apelido = v || null; }));
    md.appendChild(campoTexto('Telefone', membro.telefone, (v) => { edits.telefone = v || null; }));
    md.appendChild(campoSelect('Comunidade', membro.comunidade || 'matriz', COMUNIDADES, (v) => { edits.comunidade = v; }));

    // ── Disponibilidade ──
    const tituloDisp = document.createElement('div'); tituloDisp.className = 'form-label'; tituloDisp.style.marginTop = '10px'; tituloDisp.textContent = 'Disponibilidade';
    md.appendChild(tituloDisp);
    const dispWrap = document.createElement('div'); dispWrap.style.cssText = 'margin-bottom:6px;';
    const carregando = document.createElement('p'); carregando.className = 'empty'; carregando.style.fontSize = '12px'; carregando.textContent = 'Carregando...';
    dispWrap.appendChild(carregando);
    md.appendChild(dispWrap);
    let dispSet = null;
    sb.from('acolitos_disponibilidade').select('dia,horario').eq('membro_id', membro.id).then(({ data }) => {
      dispSet = new Set((data || []).map((d) => d.dia + '_' + d.horario));
      dispWrap.textContent = '';
      HORARIOS.forEach((h) => {
        const key = h.dia + '_' + h.horario;
        const row = document.createElement('div'); row.className = 'toggle-row';
        const lbl = document.createElement('label'); lbl.textContent = h.label;
        const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'toggle-checkbox';
        chk.checked = dispSet.has(key);
        chk.onchange = () => { if (chk.checked) dispSet.add(key); else dispSet.delete(key); };
        row.append(lbl, chk); dispWrap.appendChild(row);
      });
    });

    // ── Suspensão / Arquivar ──
    md.appendChild(blocoSuspensaoRapida(membro, aoMudar));
    const acoes = document.createElement('div'); acoes.style.cssText = 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;';
    const bArq = document.createElement('button'); bArq.type = 'button';
    const ehAfastado = membro.status === 'afastado';
    bArq.className = 'btn-sm ' + (ehAfastado ? 'green' : 'wine');
    bArq.textContent = ehAfastado ? '♻️ Restaurar membro' : '🗄 Arquivar membro';
    bArq.onclick = async () => {
      const nome = membro.apelido || membro.nome;
      if (ehAfastado) {
        const { error } = await sb.from('acolitos_membros').update({ status: 'ativo' }).eq('id', membro.id);
        if (error) { await uiAlert('Não foi possível restaurar.'); return; }
        toast(nome + ' restaurado');
      } else {
        const ok = await uiConfirm('Arquivar ' + nome + '?\nSai das listas e da escala, mas o cadastro e o histórico são mantidos. Dá pra restaurar depois.');
        if (!ok) return;
        const { error } = await sb.from('acolitos_membros').update({ status: 'afastado' }).eq('id', membro.id);
        if (error) { await uiAlert('Não foi possível arquivar.'); return; }
        toast(nome + ' arquivado');
      }
      ov.remove(); aoMudar();
    };
    acoes.appendChild(bArq);
    md.appendChild(acoes);

    // ── Ver ficha completa (Família/Frequência/Mensagem/Acessos) ──
    const linkCompleta = document.createElement('a');
    linkCompleta.href = 'membros.html?membro=' + encodeURIComponent(membro.id);
    linkCompleta.className = 'btn-sm gray'; linkCompleta.style.cssText = 'display:block;text-align:center;margin-top:14px;text-decoration:none;';
    linkCompleta.textContent = 'Ver ficha completa →';
    md.appendChild(linkCompleta);

    // ── Salvar / Fechar ──
    const msg = document.createElement('p'); msg.className = 'msg'; msg.style.marginTop = '10px'; md.appendChild(msg);
    const rodape = document.createElement('div'); rodape.style.cssText = 'display:flex;gap:8px;margin-top:6px;';
    const bFechar = document.createElement('button'); bFechar.type = 'button'; bFechar.className = 'btn-sm gray'; bFechar.style.flex = '1'; bFechar.textContent = 'Fechar'; bFechar.onclick = () => ov.remove();
    const bSalvar = document.createElement('button'); bSalvar.type = 'button'; bSalvar.className = 'btn gold'; bSalvar.style.flex = '1'; bSalvar.textContent = 'Salvar';
    bSalvar.onclick = async () => {
      bSalvar.disabled = true; bSalvar.textContent = 'Salvando...';
      try {
        if (Object.keys(edits).length) {
          const { error } = await sb.from('acolitos_membros').update(edits).eq('id', membro.id);
          if (error) throw error;
          Object.assign(membro, edits);
        }
        if (dispSet !== null) {
          await sb.from('acolitos_disponibilidade').delete().eq('membro_id', membro.id);
          const sel = [...dispSet].map((k) => { const i = k.indexOf('_'); return { membro_id: membro.id, dia: k.slice(0, i), horario: k.slice(i + 1) }; });
          if (sel.length) { const { error } = await sb.from('acolitos_disponibilidade').insert(sel); if (error) throw error; }
        }
      } catch (e) {
        msg.className = 'msg error'; msg.textContent = 'Erro ao salvar: ' + (e.message || 'tente de novo.');
        bSalvar.disabled = false; bSalvar.textContent = 'Salvar'; return;
      }
      msg.className = 'msg success'; msg.textContent = '✓ Salvo';
      bSalvar.disabled = false; bSalvar.textContent = 'Salvar';
      aoMudar();
    };
    rodape.append(bFechar, bSalvar);
    md.appendChild(rodape);

    ov.appendChild(md); document.body.appendChild(ov);
  }

  global.abrirFichaRapida = abrirFichaRapida;
})(typeof window !== 'undefined' ? window : this);
