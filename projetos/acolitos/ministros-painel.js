// Escala dos ministros (PDF do mês) e nomes lembrados — Configurações › São Tarcísio.
// O PDF é lido AQUI, no navegador (pdf.js em vendor/pdfjs), com o mesmo leitor do robô
// (escala-ministros-core.js). Nada é gravado até o dono tocar em "Confirmar e salvar".
// Tabelas: acolitos_escala_ministros, acolitos_ministro_apelidos (migration 104).
// Precisa de shared.js (sb, toast, uiAlert, uiConfirm) e de escala-ministros-core.js.
(function (global) {
  'use strict';

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const botao = (txt, cls, onclick) => { const b = el('button', 'btn-sm ' + cls, txt); b.type = 'button'; b.onclick = onclick; return b; };
  const dataBr = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  const nomeDoMes = (mes) => MESES[+mes.slice(5, 7) - 1] + ' de ' + mes.slice(0, 4);
  const falhou = (r, oque) => { if (r.error) { console.error('Ministros:', oque, r.error); toast('Não foi possível ' + oque + '.', 'error'); return true; } return false; };
  const cartao = (titulo) => { const c = el('div', 'tc-st-card'); c.append(el('h3', null, titulo)); return c; };
  const papel = (p) => (p === 'pai' ? 'pai' : 'mãe');

  async function lerMembros() {
    const r = await sb.from('acolitos_membros').select('id,nome,apelido,tem_pai_ministro,nome_pai_ministro,tem_mae_ministro,nome_mae_ministro').eq('status', 'ativo').eq('serve', true);
    return falhou(r, 'ler os membros') ? null : r.data;
  }
  async function lerApelidos() {
    const r = await sb.from('acolitos_ministro_apelidos').select('id,nome_pdf,membro_id,pai_ou_mae,resposta,respondido_por,em');
    return falhou(r, 'ler os nomes lembrados') ? null : r.data;
  }

  // PDF → texto (pdf.js carregado só agora; o arquivo é ~1,7 MB e quase ninguém abre esta tela).
  async function extrairTexto(buffer) {
    const base = new URL('vendor/pdfjs/', document.baseURI).href;
    const pdfjs = await import(base + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    const tarefa = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
    try {
      const doc = await tarefa.promise, paginas = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const c = await (await doc.getPage(p)).getTextContent();
        paginas.push(c.items.map((i) => ({ str: i.str, x: i.transform && i.transform[4], y: i.transform && i.transform[5] })));
      }
      return EscalaMinistrosCore.montarTextoDosItens(paginas);
    } finally { await tarefa.destroy(); }
  }

  // Uma linha por (data, horário, comunidade, membro): é a chave única da tabela.
  function linhasParaGravar(casados, mes, arquivo) {
    const visto = new Set(), linhas = [];
    casados.forEach((c) => {
      const k = [c.data, c.horario, c.comunidade, c.membro_id].join('|');
      if (visto.has(k)) return;
      visto.add(k);
      linhas.push({ mes, data: c.data, horario: c.horario, comunidade: c.comunidade, membro_id: c.membro_id, pai_ou_mae: c.pai_ou_mae, arquivo });
    });
    return linhas;
  }
  // Grava as novas e só depois tira as velhas do mês: se gravar falhar, o mês anterior fica inteiro.
  async function gravarMes(linhas, mes) {
    const velhas = await sb.from('acolitos_escala_ministros').select('id').eq('mes', mes);
    if (falhou(velhas, 'ler a escala do mês')) return false;
    let novas = [];
    if (linhas.length) {
      const up = await sb.from('acolitos_escala_ministros').upsert(linhas, { onConflict: 'data,horario,comunidade,membro_id' }).select('id');
      if (falhou(up, 'gravar a escala dos ministros')) return false;
      novas = up.data.map((x) => x.id);
    }
    const sair = velhas.data.map((x) => x.id).filter((id) => !novas.includes(id));
    if (sair.length) {
      const del = await sb.from('acolitos_escala_ministros').delete().in('id', sair);
      if (del.error) { uiAlert('A escala foi gravada, mas ' + sair.length + ' linha(s) antiga(s) do mês ficaram misturadas. Suba o PDF de novo.'); return false; }
    }
    return true;
  }

  async function ministros(box) {
    box.textContent = '';
    const card = cartao('Escala dos ministros');
    const resumo = el('p', 'tc-st-muted', 'Carregando…');
    card.append(resumo);
    const sobre = await sb.from('acolitos_escala_ministros').select('mes').order('mes', { ascending: false }).limit(1000);
    if (!falhou(sobre, 'ler a escala dos ministros')) {
      const meses = {}; sobre.data.forEach((x) => { meses[x.mes] = (meses[x.mes] || 0) + 1; });
      const lista = Object.keys(meses).sort().reverse();
      resumo.textContent = lista.length ? 'No sistema: ' + lista.slice(0, 3).map((m) => nomeDoMes(m) + ' (' + meses[m] + ' casos)').join(' · ') + '.'
        : 'Nenhum mês no sistema ainda. Sem a escala do mês, o gerador não reserva os filhos de ministros e o dono é avisado.';
    }
    card.append(el('p', 'tc-st-muted', 'Escolha o PDF do mês (pasta MECE do Drive). Você também pode mandá-lo para o WhatsApp do São Tarcísio.'));
    const rotulo = el('label', 'tc-rotulo', 'PDF da escala dos ministros');
    const arq = el('input', 'tm-arquivo'); arq.type = 'file'; arq.accept = 'application/pdf,.pdf'; arq.id = 'tm-arquivo'; rotulo.htmlFor = 'tm-arquivo';
    const area = el('div', 'tm-revisao');
    card.append(rotulo, arq, area);
    box.append(card);
    arq.onchange = async () => {
      const f = arq.files && arq.files[0]; if (!f) return;
      area.textContent = ''; area.append(el('p', 'tc-st-muted', 'Lendo o PDF…'));
      try { await revisar(area, f, () => ministros(box)); }
      catch (e) { console.error('Ministros: ler PDF', e); area.textContent = ''; area.append(el('p', 'tc-st-ruim', 'Não consegui ler este PDF. Confirme que é o PDF do mês (com texto, não foto).')); }
    };
  }

  async function revisar(area, arquivo, recarregar) {
    const texto = await extrairTexto(await arquivo.arrayBuffer());
    const lidos = EscalaMinistrosCore.lerEscalaMinistros(texto, EscalaMinistrosCore.anoDoTexto(texto));
    area.textContent = '';
    if (!lidos.length) { area.append(el('p', 'tc-st-ruim', 'Não encontrei dias e horários neste PDF. Nada foi gravado.')); return; }
    const mes = EscalaMinistrosCore.mesDosLidos(lidos) + '-01';
    const [membros, apelidos] = await Promise.all([lerMembros(), lerApelidos()]);
    if (!membros || !apelidos) { area.textContent = ''; return; }
    const r = EscalaMinistrosCore.casarNomes(lidos, membros, apelidos);
    const nomeMembro = (id) => { const m = membros.find((x) => x.id === id); return m ? (m.apelido || m.nome) : 'um acólito'; };

    area.append(el('div', 'tc-st-big', nomeDoMes(mes)));
    area.append(el('p', 'tc-st-muted', `${linhasParaGravar(r.casados, mes, arquivo.name).length} casos reconhecidos · ${r.duvidas.length} com dúvida · ${r.ignorados.length} sem cadastro.`));

    if (r.casados.length) {
      const ul = el('div', 'tc-lista');
      r.casados.forEach((c) => {
        const l = el('div', 'tc-linha'); const corpo = el('div', 'tc-corpo');
        corpo.append(el('div', 'tc-tit', `${nomeMembro(c.membro_id)} · ${papel(c.pai_ou_mae)} (${c.nome})`));
        corpo.append(el('div', 'tc-sub', `${dataBr(c.data)} às ${c.horario}${c.comunidade === 'matriz' ? '' : ' · ' + c.comunidade.replace('_', ' ')}`));
        l.append(corpo); ul.append(l);
      });
      area.append(el('div', 'tc-secao', 'Reconhecidos'), ul);
    }

    const escolhas = [];   // por dúvida: { duvida, nome (radio group) }
    if (r.duvidas.length) {
      area.append(el('div', 'tc-secao', 'Dúvidas — quem é?'));
      r.duvidas.forEach((d, i) => {
        const c = el('div', 'tc-linha tm-duvida'); const corpo = el('div', 'tc-corpo');
        corpo.append(el('div', 'tc-tit', `“${d.nome}” no PDF pode ser:`));
        const grupo = 'tm-d' + i;
        const opcoes = d.opcoes.map((o, k) => ({ o, rotulo: `${papel(o.pai_ou_mae)} de ${nomeMembro(o.membro_id)}`, valor: String(k) }))
          .concat([{ o: null, rotulo: 'Nenhum deles', valor: 'nenhum' }]);
        opcoes.forEach((op) => {
          const l = el('label', 'tc-regra tm-op'); const rb = el('input'); rb.type = 'radio'; rb.name = grupo; rb.value = op.valor;
          l.append(rb, document.createTextNode(op.rotulo)); corpo.append(l);
        });
        escolhas.push({ d, grupo });
        c.append(corpo); area.append(c);
      });
    }
    if (r.ignorados.length) area.append(el('p', 'tc-st-muted', 'Sem cadastro correspondente (ignorados): ' + r.ignorados.join(', ') + '.'));

    const acoes = el('div', 'tc-st-acoes');
    acoes.append(botao('Confirmar e salvar', 'gold', async () => {
      // respostas → nomes lembrados (sim para o escolhido, não para os outros candidatos)
      const novos = [];
      escolhas.forEach(({ d, grupo }) => {
        const marcado = area.querySelector('input[name="' + grupo + '"]:checked'); if (!marcado) return;
        d.opcoes.forEach((o, k) => novos.push({ nome_pdf: EscalaMinistrosCore.nomeLimpo(d.nome), membro_id: o.membro_id, pai_ou_mae: o.pai_ou_mae,
          resposta: marcado.value === String(k) ? 'sim' : 'nao', respondido_por: 'app', em: new Date().toISOString() }));
      });
      if (novos.length) {
        const up = await sb.from('acolitos_ministro_apelidos').upsert(novos, { onConflict: 'nome_pdf,membro_id,pai_ou_mae' });
        if (falhou(up, 'guardar os nomes lembrados')) return;
      }
      const apel2 = novos.length ? await lerApelidos() : apelidos;
      if (!apel2) return;
      const r2 = EscalaMinistrosCore.casarNomes(lidos, membros, apel2);
      if (!await gravarMes(linhasParaGravar(r2.casados, mes, arquivo.name), mes)) return;
      const faltam = r2.duvidas.length;
      toast(faltam ? `Escala salva. ${faltam} dúvida(s) continuam sem resposta.` : 'Escala dos ministros salva.');
      recarregar();
    }));
    acoes.append(botao('Cancelar', 'gray', () => recarregar()));
    area.append(acoes);
  }

  async function nomesLembrados(box) {
    box.textContent = '';
    const card = cartao('Nomes lembrados');
    card.append(el('p', 'tc-st-muted', 'Cada resposta que você deu fica guardada: o mesmo nome não é perguntado de novo. Remova uma linha para voltar a perguntar.'));
    const [apelidos, membros] = await Promise.all([lerApelidos(), lerMembros()]);
    if (!apelidos || !membros) { box.append(card); return; }
    const nome = (id) => { const m = membros.find((x) => x.id === id); return m ? (m.apelido || m.nome) : 'cadastro fora da lista'; };
    const lista = el('div', 'tc-lista');
    if (!apelidos.length) lista.append(el('div', 'tc-st-muted', 'Nenhum nome lembrado ainda.'));
    apelidos.slice().sort((a, b) => a.nome_pdf.localeCompare(b.nome_pdf)).forEach((a) => {
      const l = el('div', 'tc-linha'); const corpo = el('div', 'tc-corpo');
      corpo.append(el('div', 'tc-tit', `“${a.nome_pdf}” ${a.resposta === 'sim' ? 'é' : 'não é'} ${papel(a.pai_ou_mae)} de ${nome(a.membro_id)}`));
      corpo.append(el('div', 'tc-sub', `Resposta: ${a.resposta === 'sim' ? 'sim' : 'não'} · ${a.respondido_por === 'app' ? 'no app' : 'pelo WhatsApp'} · ${new Date(a.em).toLocaleDateString('pt-BR')}`));
      const x = botao('Remover', 'gray', async () => {
        if (!await uiConfirm(`Esquecer “${a.nome_pdf}”? O sistema volta a perguntar na próxima leitura.`)) return;
        const d = await sb.from('acolitos_ministro_apelidos').delete().eq('id', a.id);
        if (!falhou(d, 'remover o nome')) { toast('Nome esquecido.'); l.remove(); }
      });
      x.setAttribute('aria-label', `Remover ${a.nome_pdf}`);
      l.append(corpo, x); lista.append(l);
    });
    card.append(lista); box.append(card);
  }

  global.MinistrosPainel = { ministros, nomesLembrados };
})(window);
