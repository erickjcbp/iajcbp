// Calendário compartilhado pela matriz de evolução e pelo Rodízio.
function duracaoPastoral(dias){
  const anos=Math.floor(dias/365.2425), meses=Math.floor((dias-anos*365.2425)/30.436875);
  return [anos?anos+(anos===1?' ano':' anos'):'',meses?meses+(meses===1?' mês':' meses'):''].filter(Boolean).join(' e ') || dias+(dias===1?' dia':' dias');
}
const RODIZIO_SEMANAS_HISTORICO = 16;
function _horLabel(ev){
  var d = formatDate(ev.data).slice(0,5);
  var h = ev.horario ? ' às ' + ev.horario : '';
  var st = ev.comoSubstituto ? 'substituiu — serviu'
    : ev.status==='presente' ? 'serviu'
    : ev.status==='atrasado' ? 'serviu (atrasado)'
    : ev.status==='ausente' ? 'faltou'
    : ev.status==='ausente_justificado' ? 'faltou (justificada)'
    : ev.status==='substituido' ? 'foi substituído'
    : ev.status==='escalado' ? 'escalado, chamada não fechada'
    : ev.status;
  return d + h + ' — ' + st;
}
async function abrirHistoricoMembro(m, opts = {}){
  let escalas = opts.escalas;
  try {
    if (!escalas) {
      const de = new Date(hojeLocal()+'T12:00:00'); de.setDate(de.getDate()-RODIZIO_SEMANAS_HISTORICO*7-7);
      const {data,error} = await lerTudo(() => sb.from('acolitos_escalas')
        .select('membro_id,substituto_id,status,acolitos_celebracoes!inner(data,horario)')
        .or('membro_id.eq.'+m.id+',substituto_id.eq.'+m.id)
        .gte('acolitos_celebracoes.data',de.toISOString().slice(0,10))
        .lte('acolitos_celebracoes.data',hojeLocal()));
      if(error) throw error;
      escalas=(data||[]).map(e=>({...e,data:e.acolitos_celebracoes?.data,horario:e.acolitos_celebracoes?.horario}));
    }
    if (!m.created_at) {
      const {data,error}=await sb.from('acolitos_membros').select('created_at').eq('id',m.id).maybeSingle();
      if(error) throw error;
      m={...m,created_at:data?.created_at};
    }
  } catch(e) { toast('Não consegui carregar o histórico. Tente de novo.','error'); return; }
  const semanas = RodizioCore.historicoSemanal({
    membroId: m.id, hoje: hojeLocal(), semanas: RODIZIO_SEMANAS_HISTORICO, escalas,
  });
  const ov=document.createElement('div'); ov.className='modal-overlay open'; ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
  const md=document.createElement('div'); md.className='modal'; md.style.setProperty('--modal-max', '380px');
  const titulo=document.createElement('div'); titulo.className='modal-title';
  titulo.textContent='📅 Últimas '+RODIZIO_SEMANAS_HISTORICO+' semanas — '+(m.apelido||m.nome);
  md.appendChild(titulo);
  const tempo=document.createElement('p'); tempo.className='historico-tempo'; tempo.style.cssText='font-size:13px;line-height:1.5;margin:8px 0;color:var(--text);';
  const inicio=m.created_at?new Date(m.created_at):null;
  const dias=inicio && !isNaN(inicio.getTime())?Math.floor((new Date(hojeLocal()+'T23:59:59')-inicio)/86400000):null;
  tempo.textContent=dias===null || dias<0?'Tempo na pastoral: data não registrada.':'Tempo registrado na pastoral: '+duracaoPastoral(dias)+' (cadastro em '+formatDate(m.created_at)+').';
  const nota=document.createElement('p'); nota.style.cssText='font-size:11px;line-height:1.5;color:var(--text-muted);';nota.textContent='Contado desde o cadastro no app. A data de ingresso na pastoral ainda não está registrada.';
  md.append(tempo,nota);
  const grid=document.createElement('div'); grid.className='historico-semanas'; grid.style.cssText='display:flex;flex-wrap:wrap;margin:6px -2px 4px;';
  const detalhe=document.createElement('p'); detalhe.style.cssText='font-size:12px;color:var(--text-muted);min-height:16px;margin:4px 0 2px;';
  detalhe.textContent='Toque ou passe o mouse numa bolinha pra ver a data.';
  semanas.forEach(s=>{
    // Pedido do dono (07/10/2026): juntas, quase em linha — mesmo que o alvo de toque
    // fique maior que a bolinha visual pra não perder o clique fácil.
    const dot=document.createElement('button'); dot.type='button';
    dot.style.cssText='width:44px;height:44px;border:none;background:none;cursor:pointer;padding:0;'
      + 'display:flex;align-items:center;justify-content:center;';
    const bolinha=document.createElement('span');
    const cor = s.serviu ? 'var(--success)' : s.faltou ? 'var(--danger)' : 'var(--border)';
    bolinha.style.cssText='width:24px;height:24px;border-radius:50%;display:block;background:'+cor+';';
    dot.appendChild(bolinha);
    const texto = s.eventos.length ? s.eventos.map(_horLabel).join(' · ') : ('semana de '+formatDate(s.fimSemana).slice(0,5)+' — sem escala');
    dot.title = texto;
    dot.setAttribute('aria-label', texto);
    dot.onclick = () => { detalhe.textContent = texto; };
    grid.appendChild(dot);
  });
  const legenda=document.createElement('div'); legenda.style.cssText='display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11px;color:var(--text-muted);margin-top:6px;';
  legenda.innerHTML='<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--success);margin-right:4px;"></span>serviu</span>'
    + '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--danger);margin-right:4px;"></span>escalado e faltou</span>'
    + '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--border);margin-right:4px;"></span>sem escala</span>';
  const bX=document.createElement('button'); bX.className='btn-sm gray'; bX.style.cssText='width:100%;margin-top:14px;'; bX.textContent='Fechar'; bX.onclick=()=>ov.remove();
  md.append(grid, detalhe, legenda, bX);
  ov.appendChild(md); document.body.appendChild(ov);
}

