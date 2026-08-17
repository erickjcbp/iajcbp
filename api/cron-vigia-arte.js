// api/cron-vigia-arte.js — o vigia da Arte da Escala.
//
// POR QUE ISTO EXISTE: até 17/08/2026 a arte só avisava quando DAVA CERTO. Quando o
// crachá do GitHub venceu, o robô parou de ser chamado e ninguém soube: nem o cron de
// domingo, nem o botão da tela funcionavam, e a coordenação só descobriu por acaso —
// com o fim de semana já em cima e sem arte. Uma falha que não avisa é pior do que um
// erro na cara: ela parece que está tudo bem.
//
// Este vigia roda na segunda ao meio-dia, DEPOIS da hora em que a arte deveria ter
// saído (domingo 22h), e faz uma pergunta só: a arte do próximo fim de semana existe?
// Se não existe, avisa a coordenação por push. Ele não tenta consertar nada — quem
// gera é o robô; o trabalho do vigia é não deixar o silêncio passar por sucesso.
// NÃO importe a conta de fim de semana daqui. Tentei duas vezes e as duas quebraram
// com 500 no carregamento: primeiro importando ../arte-escala/fim-de-semana.mjs (a
// Vercel só empacota o que está dentro de api/), depois movendo o arquivo pra cá como
// .mjs. A prova de que é a EXTENSÃO: cron-arte e regenerar-arte importam ./_github.js
// e sobem vivas; só esta, importando um .mjs, morria.
// A saída não foi uma terceira tentativa no mesmo caminho — foi tirar a necessidade:
// o vigia não calcula data nenhuma (ver a pergunta que ele faz ao banco, mais abaixo).
import crypto from 'node:crypto';

function segredoConfere(recebido, esperado) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(String(recebido)), b = Buffer.from(String(esperado));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  const CRON_SECRET = process.env.CRON_SECRET;
  const URL_SB = process.env.SUPABASE_URL;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!CRON_SECRET) return res.status(500).json({ error: 'CRON_SECRET não configurado' });
  if (!URL_SB || !SRK) return res.status(500).json({ error: 'Supabase não configurado' });

  const enviado = (req.headers.authorization || '').replace('Bearer ', '');
  if (!segredoConfere(enviado, CRON_SECRET)) return res.status(403).json({ error: 'Acesso negado' });

  // A PERGUNTA DO VIGIA: existe arte para algum domingo de hoje em diante?
  //
  // Repare que ele NÃO calcula qual é o fim de semana alvo — de propósito. Copiar essa
  // conta do gerador criaria duas verdades que divergem com o tempo, e importá-la de
  // fora não funciona na Vercel. Mas o vigia não precisa dela: se a arte da semana foi
  // gerada, existe uma linha com domingo futuro; se não foi, a mais recente é a do
  // domingo que já passou. A mesma resposta, sem conta nenhuma para errar.
  //
  // Ele roda na segunda ao meio-dia, então "a mais recente" é sempre ou o domingo de
  // ontem (arte não saiu) ou o domingo que vem (arte saiu).
  const hoje = new Date().toISOString().slice(0, 10);
  const r = await fetch(`${URL_SB}/rest/v1/acolitos_escala_artes?domingo_data=gte.${hoje}&select=domingo_data&order=domingo_data.asc&limit=1`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  if (!r.ok) {
    // Não dá pra afirmar que falta arte se nem consegui perguntar. Silenciar aqui é o
    // certo: um alarme falso toda semana treina a coordenação a ignorar o alarme.
    console.error('cron-vigia-arte: não consegui consultar o banco —', r.status, await r.text());
    return res.status(502).json({ error: 'Não foi possível consultar as artes' });
  }
  const linhas = (await r.json()) || [];
  const domingo = linhas.length ? linhas[0].domingo_data : null;   // só p/ o texto do aviso
  if (domingo) return res.status(200).json({ ok: true, domingo, arte: 'existe' });

  // Falta a arte: avisa quem pode resolver.
  //
  // O endereço do site NÃO pode depender de configuração manual nem vir do pedido.
  //  - SITE_URL existe como segredo do GitHub (o gerar.mjs usa) mas nunca foi criada na
  //    Vercel; exigi-la deixaria o vigia mudo justamente na hora de avisar — o mesmo
  //    defeito que ele veio matar.
  //  - O cabeçalho Host do pedido seria pior: quem o controla escolheria para onde esta
  //    função manda a chamada (e o segredo junto). Passa só quem tem o CRON_SECRET, mas
  //    "já teria o segredo mesmo" não é motivo pra deixar a porta encostada.
  // A saída é o endereço que a própria Vercel injeta na função, que ninguém de fora move.
  const daVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const site = (process.env.SITE_URL || (daVercel ? 'https://' + daVercel : '')).replace(/\/+$/, '');
  if (!site) {
    console.error('cron-vigia-arte: não há arte para nenhum domingo futuro, e não descobri o endereço do site para avisar.');
    return res.status(200).json({ ok: true, domingo, arte: 'faltando', aviso: 'sem endereço' });
  }
  let aviso = null;
  try {
    const p = await fetch(`${site}/api/enviar-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
      body: JSON.stringify({ tipo: 'arte_faltando', domingo }),
    });
    aviso = await p.json().catch(() => null);
  } catch (e) {
    console.error('cron-vigia-arte: o aviso falhou —', String(e));
  }
  console.error('cron-vigia-arte: não há arte para nenhum domingo futuro. Coordenação avisada:', JSON.stringify(aviso));
  return res.status(200).json({ ok: true, domingo, arte: 'faltando', aviso });
}
