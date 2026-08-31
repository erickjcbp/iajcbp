// Reconhecer se um nome digitado é de alguém que JÁ está no cadastro.
//
// Escrito em CommonJS de propósito (o resto de api/ é ESM): assim as provas do
// projeto, que rodam em `node --test`, conseguem carregar este arquivo direto.
// Quem usa isto no servidor importa com `import nomes from './_nomes.js'`.
//
// POR QUE NÃO "PORCENTAGEM DE SEMELHANÇA": medido no cadastro real em 27/08/2026,
// comparar nomes por semelhança acusou 26 pares parecidos e só UM era a mesma
// pessoa. "Heloísa Costa Oliveira" e "Helena Costa Moreira" dão 76% e são duas
// meninas diferentes; "Pedro Henrique Lima" e "Davi Henrique Lima" dão 81% e têm
// 16 anos de diferença. Juntar por semelhança entregaria a ficha de uma criança
// para a família de outra.
//
// O que este arquivo faz em vez disso: exige que o PRIMEIRO NOME seja igual e que
// cada palavra do nome mais curto encontre a sua no mais longo, NA ORDEM, com
// inicial casando com palavra que começa por ela ("Maria E. Carli" = "Maria
// Eduarda Carli"). Esse mesmo alinhamento casou 189 fichas de 189 sem um único
// falso positivo. Ainda assim ele é só a PORTA: quem confirma é a prova (data de
// nascimento ou nome da mãe), conferida por quem chama.

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'del']);

// VARIAÇÃO DE GRAFIA DO MESMO NOME — não é semelhança, é a mesma palavra escrita de
// outro jeito. Em 30/08/2026 "Rafaella Ferreira Moinhos" não reconheceu "Rafaela
// Ferreira" e virou uma segunda ficha para uma acólita com 7 habilitações, que passou
// a aparecer no app como novata. A prova batia DOS DOIS jeitos aceitos (mesma data de
// nascimento e mesmo nome de mãe) — a porta é que fechou antes de alguém perguntar.
//
// O que entra aqui: só troca de letra que não muda como o nome SOA em português.
// O que NÃO entra: 'rr' e 'ss' (caro/carro, casa/cassa mudam a palavra), e nada de
// distância de edição — a régua deste arquivo continua sendo alinhamento, não %.
function chaveGrafia(p) {
  return String(p)
    .replace(/ph/g, 'f')                 // Sophia/Sofia, Stephanie/Stefanie
    .replace(/ct/g, 't')                 // Victoria/Vitória
    .replace(/([lntfmgdbpc])\1/g, '$1') // Rafaella/Rafaela, Giovanna/Giovana, Matteus/Mateus
    .replace(/k/g, 'c')                  // Kamila/Camila, Kauã/Cauã
    .replace(/w/g, 'v')
    .replace(/y/g, 'i')                  // Nayara/Naiara, Kelly/Kelli
    .replace(/h$/, '');                  // Sarah/Sara
}

// Duas palavras são a mesma? Igualdade primeiro; grafia só como segunda chance.
function mesmaPalavra(x, y) {
  return x === y || chaveGrafia(x) === chaveGrafia(y);
}

function normalizar(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tira acento
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pedacos(s) {
  return normalizar(s).split(' ').filter(p => p && !PARTICULAS.has(p));
}

// O curto "cabe" no longo? (cada palavra alinha em ordem; inicial vale por palavra)
function cabeEm(curto, longo) {
  const a = pedacos(curto), b = pedacos(longo);
  if (!a.length || !b.length) return false;
  if (!mesmaPalavra(a[0], b[0])) return false;  // o primeiro nome tem de bater inteiro
  let i = 1, alinhados = 1;
  for (const p of a.slice(1)) {
    let achou = false;
    while (i < b.length) {
      if (mesmaPalavra(p, b[i]) || (p.length === 1 && b[i].startsWith(p))) { achou = true; i++; alinhados++; break; }
      i++;
    }
    if (!achou) return false;
  }
  // DUAS palavras alinhadas, no mínimo. Só o primeiro nome não reconhece ninguém:
  // são 20 "Maria" no cadastro, e quem digitasse "Maria" casaria com todas elas.
  // Ninguém está cadastrado com uma palavra só (conferido em 27/08/2026), então
  // esta régua não deixa ninguém de fora.
  return alinhados >= 2;
}

// Mesmo nome, aceitando que um dos lados esteja abreviado ou mais curto.
function ehMesmoNome(a, b) {
  if (!normalizar(a) || !normalizar(b)) return false;
  if (normalizar(a) === normalizar(b)) return true;
  return cabeEm(a, b) || cabeEm(b, a);
}

// Entre os membros, quais podem ser esta pessoa.
function acharParecidos(nome, membros) {
  return (membros || []).filter(m => ehMesmoNome(nome, m.nome));
}

// A prova: data de nascimento exata OU nome da mãe. Sem prova, não confirma nada.
function provaBate(membro, prova) {
  if (!membro || !prova) return false;
  const nasc = String(prova.nascimento || '').slice(0, 10);
  if (nasc && membro.data_nascimento && String(membro.data_nascimento).slice(0, 10) === nasc) return true;
  if (prova.nome_mae && membro.nome_mae && ehMesmoNome(prova.nome_mae, membro.nome_mae)) return true;
  return false;
}

module.exports = { normalizar, pedacos, chaveGrafia, mesmaPalavra, cabeEm, ehMesmoNome, acharParecidos, provaBate };
