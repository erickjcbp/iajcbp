// Vercel serverless — reconhece, no momento do cadastro, quem JÁ está na pastoral.
//
// Por que no servidor e não no navegador: para responder "essa pessoa já existe?"
// é preciso ler o cadastro inteiro, e quem está se cadastrando ainda não é ninguém
// no sistema. Se a conta fizesse essa busca, viraria uma máquina de descobrir quem
// existe na pastoral e a data de nascimento de cada criança. Aqui dentro, a
// resposta que sai é só um veredito: nunca um nome, nunca uma ficha.
//
// Fluxo, por pessoa do formulário:
//   nenhum parecido        -> 'seguir'        (o cadastro segue e cria pessoa nova)
//   parecido + prova bate  -> 'confirmado'    (liga a conta à ficha que já existe)
//   parecido + prova falha -> 'seguir'        (segue, MAS vai para a fila da coordenação)
//   parecido já tem dono   -> 'ja_tem_conta'  (a ficha já está ligada a outra conta)
//   três erros em 24h      -> 'seguir'        (o freio trava a LIGAÇÃO, nunca o cadastro)
//
// EM 30/08/2026 A REGRA MUDOU, por decisão do dono: prova que não bate NÃO trava mais
// o cadastro. Antes travava (decisão de 27/08). Medido: 25 das 139 fichas sem login não
// têm nem data de nascimento nem nome da mãe guardados — nessas a prova nunca pode
// bater, e a família bateria numa parede impossível de vencer. Agora ela entra e o caso
// aparece em Config › Cadastros barrados no mesmo dia.
//
// Quem DECIDE não é este arquivo: é o api/_vinculo.js, que a porta Família usa também.
// Enquanto a regra morou aqui dentro, a outra porta seguiu sem conferir nada.
import { decidirVinculo, LIMITE_ERROS } from './_vinculo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !ANON || !SRK) return res.status(500).json({ error: 'Server misconfigured' });

  // Só para quem já criou a conta e está logado — o cadastro acontece depois do login.
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  const uRes = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!uRes.ok) return res.status(401).json({ error: 'Token inválido' });
  const caller = await uRes.json();

  const h = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  const jh = { ...h, 'Content-Type': 'application/json' };
  // vincular=false é o caso do IRMÃO: a família cadastra três filhos e um deles já
  // está na pastoral. Ali só interessa não criar a pessoa de novo — a conta continua
  // sendo de quem preencheu, não do irmão.
  const { nome, nascimento, nome_mae, vincular } = req.body || {};
  const ligarConta = vincular !== false;
  if (!nome || !String(nome).trim()) return res.status(400).json({ error: 'Nome é obrigatório.' });

  async function registrar(resultado, membro_id) {
    try {
      await fetch(`${URL}/rest/v1/acolitos_vinculo_tentativas`, {
        method: 'POST', headers: { ...jh, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: caller.id, nome_digitado: String(nome).trim(),
          nascimento_informado: nascimento || null,
          nome_mae_informado: nome_mae || null,
          resultado, membro_id: membro_id || null,
        })
      });
    } catch (e) { /* o registro é para a coordenação; nunca pode derrubar o cadastro */ }
  }

  // Freio: quem erra a prova três vezes em 24h para de tentar. Sem isso, alguém com
  // o nome de uma criança na mão chutaria datas de nascimento até acertar.
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const errosRes = await fetch(
    `${URL}/rest/v1/acolitos_vinculo_tentativas?select=id&user_id=eq.${caller.id}` +
    `&resultado=in.(prova_nao_bateu,travado)&quando=gte.${desde}`, { headers: h });
  const erros = errosRes.ok ? (await errosRes.json()).length : 0;
  if (erros >= LIMITE_ERROS) {
    await registrar('travado', null);
    return res.status(200).json({ situacao: 'travado' });
  }

  const mRes = await fetch(
    `${URL}/rest/v1/acolitos_membros?select=id,nome,data_nascimento,nome_mae,user_id,nivel,status&limit=2000`,
    { headers: h });
  if (!mRes.ok) return res.status(500).json({ error: 'Não consegui consultar o cadastro.' });
  const membros = await mRes.json();

  // A coordenação já olhou o caso desta conta e disse "não é a mesma pessoa": passa.
  const liberadoRes = await fetch(
    `${URL}/rest/v1/acolitos_vinculo_tentativas?select=id&user_id=eq.${caller.id}&liberado=is.true&limit=1`,
    { headers: h });
  if (liberadoRes.ok && (await liberadoRes.json()).length) {
    return res.status(200).json({ situacao: 'seguir', liberado: true });
  }

  const v = decidirVinculo({
    nome, nascimento, nome_mae, membros, userId: caller.id, errosRecentes: erros,
  });
  if (v.registrar) await registrar(v.registrar, v.membro_id || v.parecido_id);

  // Segue o cadastro. O caso, quando há um, já ficou registrado logo acima.
  if (v.acao === 'seguir') return res.status(200).json({ situacao: 'seguir' });

  // A ficha já é de OUTRA conta. Aqui a parede continua de pé de propósito: a prova
  // BATEU, então a pessoa já tem login e o certo é recuperar a senha — nunca nascer
  // uma segunda ficha por cima da que já existe.
  if (v.acao === 'ja_tem_conta') return res.status(200).json({ situacao: 'ja_tem_conta' });

  const bateu = { id: v.membro_id };
  if (!ligarConta) {                       // irmão reconhecido: não cria de novo, e só
    return res.status(200).json({ situacao: 'confirmado', membro_id: bateu.id, vinculado: false });
  }

  // Reconhecida: a conta passa a ser DESTA ficha, sem criar uma segunda pessoa.
  await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${bateu.id}`, {
    method: 'PATCH', headers: { ...jh, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: caller.id })
  });

  // O papel vem do NÍVEL de quem já é da pastoral (quem calcula é o _vinculo.js, para
  // a porta Família fazer igual). Sem isso a pessoa entra como recém-chegada e fica
  // presa na tela de integração, mesmo servindo há anos.
  const papel = v.papel;
  const modRes = await fetch(`${URL}/rest/v1/pastoral_modules?select=id&slug=eq.acolitos`, { headers: h });
  const mod = modRes.ok ? (await modRes.json())[0] : null;
  if (mod) {
    await fetch(`${URL}/rest/v1/pastoral_members`, {
      method: 'POST', headers: { ...jh, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: caller.id, module_id: mod.id, role: papel })
    });
  }
  return res.status(200).json({ situacao: 'confirmado', membro_id: bateu.id, papel });
}
