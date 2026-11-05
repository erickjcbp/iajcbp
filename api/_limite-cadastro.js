// Limite de cadastros públicos por IP (signup-acolito e signup-familia). Essas duas portas
// criam conta já confirmada, sem login, e a "trava" é a aprovação da coordenação — sem limite,
// qualquer script enche o Auth e a fila do CRM de lixo.
//
// 20 por hora por IP: a paróquia pode cadastrar várias famílias seguidas no mesmo wifi.
// FALHA ABERTA de propósito se a tabela não responder: é freio contra abuso, não é a porta
// de segurança (essa é o freio por ficha, em _freio.js, e a aprovação do CRM). Derrubar o
// cadastro das famílias porque o freio quebrou seria pior que o abuso.
//
// Escrito em CommonJS como _vinculo.js e _freio.js, para `node --test` carregar direto.
const crypto = require('node:crypto');

const LIMITE_POR_HORA = 20;

// → true se pode seguir; false se estourou o limite (e já registra a tentativa quando pode)
async function podeCadastrar({ URL, SRK, req, max = LIMITE_POR_HORA }) {
  try {
    const ip = String((req.headers && req.headers['x-forwarded-for']) || (req.socket && req.socket.remoteAddress) || '')
      .split(',')[0].trim();
    if (!ip) return true;
    const ipHash = crypto.createHash('sha256').update(`${SRK}:${ip}`).digest('hex');
    const h = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };
    const desde = new Date(Date.now() - 3600 * 1000).toISOString();
    // GRAVA ANTES DE CONTAR. Contar e depois gravar deixava N pedidos simultâneos verem a mesma
    // contagem e passarem todos. Gravando primeiro, cada um já se enxerga na conta: o excesso de
    // uma rajada é no máximo o que ainda não gravou. (O pedido barrado também fica registrado:
    // quem insiste só renova a própria janela.)
    const w = await fetch(`${URL}/rest/v1/acolitos_signup_tentativas`, {
      method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ip_hash: ipHash }),
    });
    if (!w.ok) return true;
    const r = await fetch(`${URL}/rest/v1/acolitos_signup_tentativas?select=id&ip_hash=eq.${ipHash}` +
      `&created_at=gte.${encodeURIComponent(desde)}&limit=${max + 1}`, { headers: h });
    if (!r.ok) return true;
    if ((await r.json()).length > max) return false;
    return true;
  } catch (e) { return true; }
}

module.exports = { podeCadastrar, LIMITE_POR_HORA };
