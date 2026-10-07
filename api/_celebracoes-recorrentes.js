// api/_celebracoes-recorrentes.js — mantém a grade fixa de missas sempre cadastrada à
// frente, sem ninguém precisar clicar em "+ Celebração" toda semana.
//
// NÃO é um endpoint (nome começa com `_`): o plano gratuito da Vercel só dá 2 robôs
// agendados, e os dois já são o cron-crm (manhã/tarde) — ver o comentário lá. Criar um
// terceiro arquivo em api/ sem o `_` virava uma 13ª função e quebrava TODA publicação em
// silêncio (aconteceu em 18/09, ver docs/pendencias-fechados.md). Este arquivo é chamado
// de DENTRO do cron-crm, pegando carona nos 2 robôs que já existem.
//
// A GRADE (confirmada com o dono em 06/10/2026): sábado 17h (Matriz), sábado 18h30 (Sto.
// Antônio), domingo 7h/9h/19h (Matriz). Mudou a grade na vida real? Muda só o array abaixo.
//
// CONTÍNUO SEM REPETIR O PASSADO: guarda em acolitos_config (chave
// 'celebracoes_geradas_ate') até QUE DATA já garantiu a grade. Cada chamada só olha do dia
// seguinte a essa marca até hoje+HORIZONTE_DIAS, nunca para trás — então se alguém excluir
// manualmente a missa de um sábado específico (evento especial, sem missa naquele dia), o
// robô NÃO recria: aquela data já passou da marca. Sem watermark, toda rodada reconferiria
// a janela inteira e desfaria exclusões manuais.
const GRADE = [
  { dow: 6, horario: '17h',   comunidade: 'matriz' },        // sábado
  { dow: 6, horario: '18h30', comunidade: 'santo_antonio' },  // sábado
  { dow: 0, horario: '7h',    comunidade: 'matriz' },         // domingo
  { dow: 0, horario: '9h',    comunidade: 'matriz' },         // domingo
  { dow: 0, horario: '19h',   comunidade: 'matriz' },         // domingo
];
const HORIZONTE_DIAS = 56; // 8 semanas — mesma janela que a aba Escala já carrega
const CHAVE_MARCA = 'celebracoes_geradas_ate';

function soData(d) { return d.toISOString().slice(0, 10); }

export async function garantirCelebracoesRecorrentes({ url, serviceKey }) {
  const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
  const alvo = new Date(hoje); alvo.setUTCDate(alvo.getUTCDate() + HORIZONTE_DIAS);

  const rMarca = await fetch(`${url}/rest/v1/acolitos_config?chave=eq.${CHAVE_MARCA}&select=valor`, { headers: h });
  if (!rMarca.ok) throw new Error('celebracoes-recorrentes: lendo marca — ' + rMarca.status);
  const linhasMarca = await rMarca.json();
  const marcaAnterior = linhasMarca[0]?.valor?.ate || null;

  let inicio = hoje;
  if (marcaAnterior) {
    const m = new Date(marcaAnterior + 'T00:00:00Z');
    if (m >= hoje) { inicio = new Date(m); inicio.setUTCDate(inicio.getUTCDate() + 1); }
  }
  if (inicio > alvo) return { ok: true, inseridas: 0, motivo: 'já coberto até ' + soData(alvo) };

  // Defesa: confere o que já existe no pedaço antes de inserir (reentrada segura se a marca
  // não tiver sido salva numa chamada anterior que falhou a meio caminho).
  const rExist = await fetch(
    `${url}/rest/v1/acolitos_celebracoes?select=data,horario,comunidade&data=gte.${soData(inicio)}&data=lte.${soData(alvo)}`,
    { headers: h });
  if (!rExist.ok) throw new Error('celebracoes-recorrentes: lendo existentes — ' + rExist.status);
  const existentes = new Set((await rExist.json()).map(c => c.data + '|' + c.horario + '|' + c.comunidade));

  const novas = [];
  for (let d = new Date(inicio); d <= alvo; d.setUTCDate(d.getUTCDate() + 1)) {
    const dataISO = soData(d);
    GRADE.filter(g => g.dow === d.getUTCDay()).forEach(g => {
      const chave = dataISO + '|' + g.horario + '|' + g.comunidade;
      if (!existentes.has(chave)) {
        novas.push({ data: dataISO, horario: g.horario, comunidade: g.comunidade, tipo: 'missa_comum' });
      }
    });
  }

  if (novas.length) {
    const rIns = await fetch(`${url}/rest/v1/acolitos_celebracoes`, {
      method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(novas),
    });
    if (!rIns.ok) throw new Error('celebracoes-recorrentes: inserindo — ' + rIns.status + ' ' + (await rIns.text()));
  }

  // Avança a marca até o alvo mesmo sem novas (cobre quando a semana já tinha sido criada
  // manualmente) — é isso que impede reconferir (e desfazer exclusões) na próxima chamada.
  const rSalva = await fetch(`${url}/rest/v1/acolitos_config?on_conflict=chave`, {
    method: 'POST',
    headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ chave: CHAVE_MARCA, valor: { ate: soData(alvo) }, updated_at: new Date().toISOString() }),
  });
  if (!rSalva.ok) throw new Error('celebracoes-recorrentes: salvando marca — ' + rSalva.status + ' ' + (await rSalva.text()));

  return { ok: true, inseridas: novas.length, ate: soData(alvo) };
}
