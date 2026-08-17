// Compartilhado pelos dois caminhos que mandam o robô da arte trabalhar
// (o botão da tela, em regenerar-arte.js, e o cron de domingo, em cron-arte.js).
// Arquivos começados com "_" não viram rota na Vercel.

// Traduz a recusa do GitHub para uma frase que diga o que fazer. Sem isto, todo problema
// diferente vira a mesma mensagem inútil ("Falha ao disparar") na tela da coordenação.
// Em 17/08/2026 o crachá venceu e a razão — que o GitHub mandou — era jogada fora.
export function motivoGitHub(status, corpo) {
  if (status === 401) return 'O acesso ao GitHub venceu ou foi revogado — é preciso gerar um novo e atualizar na Vercel.';
  if (status === 403) return 'O acesso ao GitHub existe mas não tem permissão de Actions (precisa de "Read and write").';
  if (status === 404) return 'O GitHub não encontrou o repositório ou o robô da arte — confira o nome em GH_REPO.';
  if (status === 422) return 'O GitHub recusou o pedido: a branch "main" ou o robô da arte não existem mais.';
  if (status >= 500) return 'O GitHub está fora do ar neste momento. Tente de novo em alguns minutos.';
  let msg = '';
  try { msg = (JSON.parse(corpo) || {}).message || ''; } catch (e) {}
  return 'O GitHub recusou o pedido' + (msg ? ': ' + msg : ' (código ' + status + ').');
}

// Manda o robô da arte trabalhar. `origem` vira o carimbo de quem pediu ('cron' ou
// 'manual') — antes o workflow deduzia isso do tipo do evento, e desde que o
// agendamento saiu do GitHub TODA geração passou a se dizer "manual", inclusive as
// do robô. Agora quem pede é que diz.
export async function dispararArte({ GH_PAT, GH_REPO, origem }) {
  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/arte-escala.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GH_PAT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'iajcbp-arte-escala',
    },
    body: JSON.stringify({ ref: 'main', inputs: { origem: origem || 'manual' } }),
  });
  if (r.ok) return { ok: true };
  const corpo = await r.text();
  return { ok: false, status: r.status, motivo: motivoGitHub(r.status, corpo), detalhe: corpo };
}
