/* Edição editorial: altere o ID somente quando houver novidades relevantes. */
(function () {
  'use strict';
  const EDICAO = '2026-11-03', enfileirados = new Set();
  const itens = [
    {titulo:'Desafios mais próximos do altar', texto:'Os desafios semanais trazem situações do serviço na missa. Faça sua escolha e descubra o motivo da resposta.', href:'missoes.html#aventuras', acao:'Explorar Quests'},
    {titulo:'Sua identidade ganhou novos detalhes', texto:'Toque no brasão de nível, no símbolo da casa ou no medalhão do seu avatar para ver a arte e entender seu significado.', href:'conquistas.html', acao:'Ver minhas insígnias'},
    {titulo:'Uma coleção para acompanhar sua história', texto:'Explore as novas artes das medalhas, filtre suas conquistas e consulte os requisitos das próximas. O tempo de pastoral também tem seus medalhões.', href:'conquistas.html', acao:'Explorar conquistas'}
  ];
  const chave = m => 'acolitos-novidades-' + m.id + '-' + EDICAO;
  function elegivel(m) { return !!m?.id && m.serve !== false && m._crmEtapa !== 'aprovacao_cadastro'; }
  function elemento(tag, classe, texto) { const e=document.createElement(tag); if(classe)e.className=classe;if(texto)e.textContent=texto;return e; }
  function abrir(membro, done) {
    if(document.querySelector('.novidades-overlay'))return;
    const origem=document.activeElement, antes=document.body.style.overflow;
    const ov=elemento('div','modal-overlay open novidades-overlay'), md=elemento('section','novidades-dialog');
    md.setAttribute('role','dialog');md.setAttribute('aria-modal','true');md.setAttribute('aria-labelledby','novidades-titulo');
    let fechado=false;
    function fechar(){if(fechado)return;fechado=true;try{localStorage.setItem(chave(membro),'1');}catch(_){}ov.remove();document.body.style.overflow=antes;if(origem?.isConnected)origem.focus({preventScroll:true});if(typeof done==='function')done();}
    ov._acResolveClose=fechar;
    const head=elemento('header','novidades-head'), titulos=elemento('div');
    titulos.append(elemento('p','novidades-edicao','Novidades · 3 de novembro de 2026'));
    const titulo=elemento('h2','','Sua jornada tem novidades');titulo.id='novidades-titulo';titulos.append(titulo);
    const x=elemento('button','novidades-close','✕');x.type='button';x.setAttribute('aria-label','Fechar novidades');x.onclick=fechar;head.append(titulos,x);
    const corpo=elemento('div','novidades-body'), destaque=elemento('article','novidades-destaque');
    const img=elemento('img');img.src='games-art/mensageiro/abertura-leve-v3.webp';img.alt='Tíquico levando uma carta pelas ruas da cidade';img.width=1024;img.height=683;img.decoding='async';
    const info=elemento('div','novidades-destaque-info');info.append(elemento('p','novidades-selo','Novo game em Quests'),elemento('h3','','Uma carta. Um caminho cheio de desafios.'),elemento('p','','Corra com Tíquico, desvie dos guardas e entregue a carta de Paulo. A rota fica mais difícil conforme você avança.'));
    const detalhes=elemento('ul','novidades-detalhes');for(const texto of ['Primeira entrega aos 1.500 m; depois, continue para bater seu recorde.','Trilha sonora, efeitos e ranking com distância.','Até 20 XP por corrida e 60 XP por dia nos games.'])detalhes.append(elemento('li','',texto));info.append(detalhes);
    const jogar=elemento('a','btn gold','Conhecer o game');jogar.href='games.html';jogar.addEventListener('click',fechar);info.append(jogar);destaque.append(img,info);
    const lista=elemento('div','novidades-lista');for(const item of itens){const card=elemento('article','novidades-item');card.append(elemento('h3','',item.titulo),elemento('p','',item.texto));const link=elemento('a','novidades-link',item.acao);link.href=item.href;link.addEventListener('click',fechar);card.append(link);lista.append(card);}
    corpo.append(destaque,lista);
    const rodape=elemento('footer','novidades-footer');rodape.append(elemento('p','','Você pode rever estas novidades pelo ícone ao lado do sino.'));
    const continuar=elemento('button','btn gold','Continuar no app');continuar.type='button';continuar.onclick=fechar;rodape.append(continuar);md.append(head,corpo,rodape);ov.append(md);
    md.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();fechar();return;}if(e.key!=='Tab')return;const links=[...md.querySelectorAll('button,a[href]')],primeiro=links[0],ultimo=links.at(-1);if(e.shiftKey&&document.activeElement===primeiro){e.preventDefault();ultimo.focus();}else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primeiro.focus();}});
    document.body.style.overflow='hidden';document.body.append(ov);x.focus({preventScroll:true});
  }
  window.enfileirarNovidades=function(membro){if(!elegivel(membro)||enfileirados.has(chave(membro)))return;try{if(localStorage.getItem(chave(membro)))return;}catch(_){}enfileirados.add(chave(membro));enqueueNotif(40,done=>abrir(membro,done));};
  window.abrirNovidades=abrir;
})();
