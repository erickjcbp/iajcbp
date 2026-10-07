// api/cron-crm.js — o lembrete da integração de novos (CRM), 2× por dia: 8h e 18h (Brasília).
//
// 01/10/2026: o dono achou o aviso fraco e pediu "umas 2× no dia". O plano gratuito da Vercel só
// aceita robô que roda UMA vez por dia — então são DOIS robôs (`?turno=manha` e `?turno=tarde`),
// cada um diário. Os dois gastam as 2 vagas do plano, que a arte da escala já não usa mais.
// A tarde fala mais forte: é o segundo aviso do dia sobre a mesma pendência.
//
// PEDIDO DO DONO (18/09/2026): avisar quando chega gente nova na CRM e lembrar todo dia de
// acompanhar o funil, para quem tem acesso à CRM (hoje 4 pessoas).
//
// 06/10/2026: ganhou uma SEGUNDA tarefa, sem relação com a CRM — manter a grade fixa de
// missas cadastrada 8 semanas à frente (ver api/_celebracoes-recorrentes.js). Mesmo motivo:
// não tem robô sobrando, então pega carona neste.
//
// POR QUE ELE EXISTE NO LUGAR DOS OUTROS DOIS: o plano da Vercel é o gratuito, que dá 2
// robôs agendados — e os dois estavam ocupados com a arte da escala (gerar e vigiar). O dono
// decidiu, com o custo na mesa, trocar os dois por este. Consequência registrada: **a arte do
// fim de semana passa a depender de alguém apertar "Gerar/Atualizar" na tela de Escala**, e
// ninguém avisa se ela não sair.
//
// SÓ FALA QUANDO TEM O QUE DIZER: se não chegou ninguém novo e ninguém está parado, o robô
// se cala. Aviso diário que chega vazio ensina a ignorar aviso — e aí o dia em que importa
// passa batido também.
import crypto from 'node:crypto';
import { garantirCelebracoesRecorrentes } from './_celebracoes-recorrentes.js';

// Compara segredos sem vazar tempo. Falso se qualquer um estiver vazio.
function segredoConfere(recebido, esperado) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(String(recebido)), b = Buffer.from(String(esperado));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const PARADO_DIAS = 7;   // tempo na MESMA etapa que já merece um empurrão

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  const CRON_SECRET = process.env.CRON_SECRET;
  const URL = process.env.SUPABASE_URL;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!CRON_SECRET) return res.status(500).json({ error: 'CRON_SECRET não configurado' });
  if (!URL || !SRK) return res.status(500).json({ error: 'Supabase não configurado' });

  // A Vercel manda `Authorization: Bearer <CRON_SECRET>` nas chamadas de cron.
  const enviado = (req.headers.authorization || '').replace('Bearer ', '');
  if (!segredoConfere(enviado, CRON_SECRET)) return res.status(403).json({ error: 'Acesso negado' });

  const h = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  const jget = async (path) => {
    try {
      const r = await fetch(`${URL}/rest/v1/${path}`, { headers: h });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  };

  // Pega carona neste robô para manter a grade fixa de missas cadastrada 8 semanas à
  // frente (pedido do dono, 06/10/2026) — não tem vaga de cron sobrando pra um robô só
  // disso. Ver api/_celebracoes-recorrentes.js. Erro aqui NÃO pode calar o lembrete da
  // CRM abaixo, por isso fica isolado num try/catch que só loga.
  try {
    const resultado = await garantirCelebracoesRecorrentes({ url: URL, serviceKey: SRK });
    if (resultado.inseridas) console.log('cron-crm: celebrações recorrentes — inseridas', resultado.inseridas, 'até', resultado.ate);
  } catch (e) {
    console.error('cron-crm: celebrações recorrentes falhou —', String(e));
  }

  const turno = req.query && req.query.turno === 'tarde' ? 'tarde' : 'manha';
  const agora = new Date();
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const limiteParado = new Date(agora.getTime() - PARADO_DIAS * 24 * 60 * 60 * 1000).toISOString();

  // Chegou gente nova: entrou no funil nas últimas 24h. A CRM não guarda "criado em", ela
  // guarda quando a ETAPA começou — e para quem acabou de chegar as duas coisas são a mesma.
  const novos = await jget(
    `acolitos_crm?select=id&etapa=neq.integrado&etapa_iniciada_em=gte.${encodeURIComponent(ontem)}`);
  // Parado: mais de 7 dias na mesma etapa, sem ter chegado ao fim do funil.
  const parados = await jget(
    `acolitos_crm?select=id&etapa=neq.integrado&etapa_iniciada_em=lt.${encodeURIComponent(limiteParado)}`);

  // Consulta que falhou NÃO é "ninguém no funil". Melhor não mandar nada do que mandar um
  // "está tudo em dia" que ninguém conferiu.
  if (novos === null || parados === null) {
    console.error('cron-crm: não consegui ler a CRM — nada foi enviado');
    return res.status(502).json({ error: 'Não consegui ler a CRM' });
  }

  const quantosNovos = novos.length, quantosParados = parados.length;
  if (!quantosNovos && !quantosParados) {
    return res.status(200).json({ ok: true, enviados: 0, nadaAFazer: true });
  }

  // O texto é montado no servidor de push (a partir destes números), nunca aqui: assim o
  // segredo do robô não vira um megafone para escrever o que quiser no celular de ninguém.
  const base = process.env.URL_BASE || `https://${req.headers.host}`;
  const r = await fetch(`${base}/api/enviar-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
    body: JSON.stringify({ tipo: 'crm', novos: quantosNovos, parados: quantosParados, turno }),
  });
  const saida = await r.json().catch(() => null);
  if (!r.ok) {
    console.error('cron-crm: o envio recusou —', r.status, saida);
    return res.status(502).json({ error: 'Envio recusado', detalhe: saida });
  }
  return res.status(200).json({ ok: true, novos: quantosNovos, parados: quantosParados, envio: saida });
}
