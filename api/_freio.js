// Freio por FICHA-ALVO. O freio por nome digitado (signup-familia) e por conta
// (reconhecer-cadastro) se contorna: o nome do alvo vale em qualquer grafia (sem
// acento, abreviado, caixa diferente) e a conta nova é de graça. A ficha da criança é
// a única coisa que não muda quando o atacante troca de grafia ou de conta — então a
// contagem de tentativas erradas também é feita por ela, somando todo mundo.
//
// O limite é maior que o do nome (LIMITE_ERROS = 3) de propósito: aqui somam famílias
// diferentes que digitaram um nome parecido, e uma parede curta barraria cadastro de
// gente de boa-fé. Seis por dia ainda leva séculos para varrer as datas de nascimento.
const nomes = require('./_nomes.js');

const LIMITE_POR_FICHA = 6;

// → { erros, ids }  (ids = fichas parecidas com o nome, para registrar a tentativa nelas)
async function errosPorFicha({ URL, h, nome, membros }) {
  const ids = nomes.acharParecidos(nome, membros || []).map((m) => m.id);
  if (!ids.length) return { erros: 0, ids };
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const r = await fetch(
    `${URL}/rest/v1/acolitos_vinculo_tentativas?select=id&membro_id=in.(${ids.join(',')})` +
    `&resultado=in.(prova_nao_bateu,travado)&quando=gte.${desde}`, { headers: h });
  if (!r.ok) throw new Error('Não consegui conferir as tentativas. Tente novamente em instantes.');
  return { erros: (await r.json()).length, ids };
}

module.exports = { errosPorFicha, LIMITE_POR_FICHA };
