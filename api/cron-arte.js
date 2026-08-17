// api/cron-arte.js — gatilho semanal da Arte da Escala, chamado pelo Cron da Vercel.
//
// POR QUE ISTO EXISTE: o agendamento do GitHub Actions não tem hora. Nas duas únicas
// execuções agendadas que existiram, ele atrasou 3h e 3h38 — a arte de domingo 22h saía
// perto das 2h da manhã de segunda. O Cron da Vercel respeita a hora (no plano Hobby,
// "dentro da hora marcada"), então ele passa a ser quem dá a partida.
//
// POR QUE NÃO GERAR A ARTE AQUI: o gerador usa Puppeteer + Chromium pra renderizar um PNG
// de 2160x4800 e já levou 23 minutos. Função da Vercel no Hobby morre em 60s. Então só o
// GATILHO migra; o trabalho pesado continua no GitHub Actions, via workflow_dispatch —
// que dispara na hora, ao contrário do schedule.
import crypto from 'node:crypto';
import { dispararArte } from './_github.js';

// Compara segredos sem vazar tempo. Falso se qualquer um estiver vazio.
function segredoConfere(recebido, esperado) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(String(recebido)), b = Buffer.from(String(esperado));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  // O Cron da Vercel chama por GET.
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  const CRON_SECRET = process.env.CRON_SECRET;
  const GH_PAT = process.env.GH_PAT;
  const GH_REPO = process.env.GH_REPO; // ex.: erickjcbp/iajcbp
  if (!CRON_SECRET) return res.status(500).json({ error: 'CRON_SECRET não configurado' });
  if (!GH_PAT || !GH_REPO) return res.status(500).json({ error: 'GitHub não configurado' });

  // A Vercel manda `Authorization: Bearer <CRON_SECRET>` automaticamente nas chamadas
  // de cron quando a variável existe. Sem isso, qualquer um na internet dispararia o job.
  const enviado = (req.headers.authorization || '').replace('Bearer ', '');
  if (!segredoConfere(enviado, CRON_SECRET)) return res.status(403).json({ error: 'Acesso negado' });

  const gh = await dispararArte({ GH_PAT, GH_REPO, origem: 'cron' });
  if (!gh.ok) {
    // Ninguém está olhando o retorno de um cron às 22h de domingo. Deixar o motivo no
    // registro é o mínimo — quem AVISA a coordenação é o vigia (cron-vigia-arte.js).
    console.error('cron-arte: o GitHub recusou —', gh.status, gh.motivo, gh.detalhe);
    return res.status(502).json({ error: gh.motivo, detalhe: gh.detalhe });
  }
  return res.status(202).json({ ok: true, disparado: 'arte-escala.yml' });
}
