import assert from 'node:assert/strict';
import { iniciarProvas, PAPEIS } from './abrir-tela.mjs';
const provas = await iniciarProvas();
const pasta = process.env.FOTOS_AUDITORIA || '/Users/erickmartins/arquivos/auditoria-coroinhas-2026-10-10';
const celeb = { id:'c1', data:'2026-10-11', horario:'10:00', comunidade:'matriz', tipo:'dominical' };
try {
  for (const [largura, altura] of [[390,844], [768,1024], [1366,900], [2560,1440]]) {
    const r = await provas.abrir('escala.html', {
      papel:PAPEIS.admin, largura, altura,
      tabelas: { acolitos_habilitacoes:{data:[{membro_id:'m1',funcao:'apoio',proficiencia:'apto'}]}, acolitos_modelos:{data:[{tipo:'dominical',comunidade:'matriz',funcao:'apoio',quantidade:2,ordem:1}]}, acolitos_celebracoes:{ data:[celeb] }, acolitos_membros:{ data:[{id:'m1',nome:'Pedro Teste',nivel:'coroinha',status:'ativo',comunidade:'matriz'}] } },
      passos:[{chamar:'abrirMontagem',args:[celeb]}],
      foto: pasta + '/escala-' + largura + '.png',
      avaliar:`
        document.getElementById('splash')?.remove();
        const ov = document.getElementById('modal-montagem');
        const modal = ov.querySelector('.modal');
        const main = document.querySelector('.main');
        const rect = modal.getBoundingClientRect();
        const mainRect = main.getBoundingClientRect();
        const input = modal.querySelector('select');
        input.value = 'm1';
        const original = input.value;
        if(original !== 'm1') throw new Error('a pessoa apta precisa aparecer no campo');
        const fieldFont = parseFloat(getComputedStyle(input).fontSize);
        const smallButtons = [...modal.querySelectorAll('button')].filter(x=>x.getBoundingClientRect().width && x.getBoundingClientRect().height<44).length;
        // Abrir e dispensar uma confirmação aninhada não pode fechar a montagem.
        const answer = uiConfirm('Teste de confirmação');
        await new Promise(r=>setTimeout(r,30));
        const top = [...document.querySelectorAll('.modal-overlay.open')].at(-1);
        top._acResolveClose();
        await answer;
        await new Promise(r=>setTimeout(r,150));
        const preserved = ov.classList.contains('open') && input.value === original;
        // Salvar deve manter o modal aberto, com confirmação visível.
        const fromOriginal = sb.from.bind(sb);
        sb.from = table => table === 'acolitos_escalas' ? {
          delete: () => ({eq: async () => ({error:null})}),
          insert: rows => ({select: async () => ({data:rows.map((row,i)=>({...row,id:'nova-'+i})),error:null})})
        } : fromOriginal(table);
        await salvarEscala();
        const savedOpen = ov.classList.contains('open') && input.value === original &&
          document.getElementById('montagem-status').textContent.includes('1 posições') &&
          !document.getElementById('btn-sv-escala').disabled;
        sb.from = fromOriginal;
        // Todos os caminhos de fechar (X, Esc, gesto e Voltar) atualizam os cards.
        montagemDirty = true;
        let refreshed = 0;
        desenharAba = () => { refreshed++; };
        ov.querySelector('.modal-close').click();
        await new Promise(r=>setTimeout(r,150));
        const closedRefresh = !ov.classList.contains('open') && refreshed === 1;
        abrirMontagem(${JSON.stringify(celeb)});
        await new Promise(r=>setTimeout(r,50));
        return { preserved, savedOpen, closedRefresh, modalWidth:rect.width, mainWidth:mainRect.width,
          overflow:document.documentElement.scrollWidth > innerWidth,
          fieldFont, smallButtons
        };
      `,
    });
    console.log(largura, JSON.stringify(r.avaliado), r.erroAvaliar || '', r.erros);
    assert.equal(r.erroAvaliar, null);
    const a = r.avaliado;
    // Acumula resultados para enxergar todos os tamanhos antes de falhar.
    globalThis.falhas ||= [];
    if (!a.preserved) falhas.push(largura + ': confirmação fecha a montagem');
    if (!a.savedOpen) falhas.push(largura + ': salvar fecha modal ou não confirma gravação');
    if (!a.closedRefresh) falhas.push(largura + ': X não atualiza a escala');
    if (a.overflow) falhas.push(largura + ': rolagem horizontal da página');
    if (largura < 640 && Math.abs(a.modalWidth-largura)>1) falhas.push(largura + ': modal não preenche a largura');
    if (largura < 640 && (a.fieldFont < 16 || a.smallButtons)) falhas.push(largura + ': campos/alvos pequenos');
    if (largura >= 1366 && Math.abs(a.mainWidth-largura)>1) falhas.push(largura + ': página limitada no desktop');
  }
  assert.deepEqual(globalThis.falhas, []);
} finally { await provas.encerrar(); }
