// Vercel serverless — reconhece, no momento do cadastro, quem JÁ está na pastoral.
//
// Por que no servidor e não no navegador: para responder "essa pessoa já existe?"
// é preciso ler o cadastro inteiro, e quem está se cadastrando ainda não é ninguém
// no sistema. Se a conta fizesse essa busca, viraria uma máquina de descobrir quem
// existe na pastoral e a data de nascimento de cada criança. Aqui dentro, a
// resposta que sai é só um veredito: nunca um nome, nunca uma ficha.
//
// Fluxo, por pessoa do formulário:
//   nenhum parecido        -> 'sem_parecido'      (o cadastro segue e cria pessoa nova)
//   parecido + prova bate  -> 'confirmado'        (liga a conta à ficha que já existe)
//   parecido + prova falha -> 'prova_nao_bateu'   (trava; vai para a fila da coordenação)
//   parecido já tem dono   -> 'ja_tem_conta'      (a ficha já está ligada a outra conta)
//   três erros em 24h      -> 'travado'           (freio contra chute de data de nascimento)
import nomes from './_nomes.js';

const LIMITE_ERROS = 3;

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
    return res.status(200).json({ situacao: 'sem_parecido', liberado: true });
  }

  const parecidos = nomes.acharParecidos(nome, membros);
  if (!parecidos.length) return res.status(200).json({ situacao: 'sem_parecido' });

  const bateu = parecidos.find(m => nomes.provaBate(m, { nascimento, nome_mae }));
  if (!bateu) {
    await registrar('prova_nao_bateu', parecidos[0].id);
    return res.status(200).json({ situacao: 'prova_nao_bateu', tentativas_restantes: LIMITE_ERROS - erros - 1 });
  }
  if (ligarConta && bateu.user_id && bateu.user_id !== caller.id) {
    await registrar('prova_nao_bateu', bateu.id);
    return res.status(200).json({ situacao: 'ja_tem_conta' });
  }
  if (!ligarConta) {                       // irmão reconhecido: não cria de novo, e só
    await registrar('confirmado', bateu.id);
    return res.status(200).json({ situacao: 'confirmado', membro_id: bateu.id, vinculado: false });
  }

  // Reconhecida: a conta passa a ser DESTA ficha, sem criar uma segunda pessoa.
  await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${bateu.id}`, {
    method: 'PATCH', headers: { ...jh, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: caller.id })
  });

  // O papel vem do NÍVEL de quem já é da pastoral. Sem isso a pessoa entra como
  // recém-chegada e fica presa na tela de integração, mesmo servindo há anos.
  const nivel = bateu.nivel || '';
  const papel = nivel.startsWith('cerimoniario') ? 'cerimonario'
    : (nivel.startsWith('acolito') || nivel === 'aspirante_cerimoniario') ? 'acolito'
    : nivel === 'coroinha' ? 'coroinha'
    : nivel === 'aspirante' ? 'aspirante' : 'novo';
  const modRes = await fetch(`${URL}/rest/v1/pastoral_modules?select=id&slug=eq.acolitos`, { headers: h });
  const mod = modRes.ok ? (await modRes.json())[0] : null;
  if (mod) {
    await fetch(`${URL}/rest/v1/pastoral_members`, {
      method: 'POST', headers: { ...jh, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: caller.id, module_id: mod.id, role: papel })
    });
  }
  await registrar('confirmado', bateu.id);
  return res.status(200).json({ situacao: 'confirmado', membro_id: bateu.id, papel });
}
