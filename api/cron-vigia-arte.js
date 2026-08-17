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
import crypto from 'node:crypto';
import { alvoFimDeSemana } from '../arte-escala/fim-de-semana.mjs';

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

  // Mesmo cálculo de fim de semana que o gerador usa — importado, não copiado, senão
  // as duas contas divergem com o tempo e o vigia passa a cobrar o domingo errado.
  const { domingo } = alvoFimDeSemana(new Date());

  const r = await fetch(`${URL_SB}/rest/v1/acolitos_escala_artes?domingo_data=eq.${domingo}&select=domingo_data`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  if (!r.ok) {
    // Não dá pra afirmar que falta arte se nem consegui perguntar. Silenciar aqui é o
    // certo: um alarme falso toda semana treina a coordenação a ignorar o alarme.
    console.error('cron-vigia-arte: não consegui consultar o banco —', r.status, await r.text());
    return res.status(502).json({ error: 'Não foi possível consultar as artes' });
  }
  const existe = ((await r.json()) || []).length > 0;
  if (existe) return res.status(200).json({ ok: true, domingo, arte: 'existe' });

  // Falta a arte: avisa quem pode resolver.
  const site = (process.env.SITE_URL || '').replace(/\/+$/, '');
  if (!site) {
    console.error('cron-vigia-arte: arte de', domingo, 'NÃO existe, mas falta SITE_URL para avisar.');
    return res.status(200).json({ ok: true, domingo, arte: 'faltando', aviso: 'sem SITE_URL' });
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
  console.error('cron-vigia-arte: a arte de', domingo, 'NÃO existe. Coordenação avisada:', JSON.stringify(aviso));
  return res.status(200).json({ ok: true, domingo, arte: 'faltando', aviso });
}
