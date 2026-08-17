// Qual fim de semana a arte da escala cobre. Trabalha em BRT (UTC-3).
//
// POR QUE MORA AQUI E NÃO EM arte-escala/: a Vercel só empacota o que está dentro de
// api/ — uma função que importa de uma pasta vizinha sobe e quebra com 500 na hora de
// carregar (aconteceu em 17/08/2026 com o vigia da arte). Como esta conta é usada pelos
// DOIS lados (o gerador, no GitHub Actions, e o vigia, na Vercel), ela fica no lado mais
// exigente e o outro busca aqui. Duplicar seria pior: as duas contas divergiriam com o
// tempo e o vigia passaria a cobrar o domingo errado.
// O arquivo arte-escala/fim-de-semana.mjs continua existindo e reexporta daqui.
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

function toBRT(date) {
  return new Date(date.getTime() + BRT_OFFSET_MS);
}
function iso(d) {
  // d já é um Date "deslocado" para BRT; usar componentes UTC dele
  return d.toISOString().slice(0, 10);
}

export function alvoFimDeSemana(agora) {
  const local = toBRT(agora);
  const dow = local.getUTCDay(); // 0=Dom .. 6=Sáb
  // Próximo sábado ESTRITAMENTE após hoje. Se hoje é sábado, pega o da semana que vem.
  let addSab = (6 - dow + 7) % 7;
  if (addSab === 0) addSab = 7;
  const sabado = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + addSab));
  const domingo = new Date(sabado.getTime() + 24 * 60 * 60 * 1000);
  return { sabado: iso(sabado), domingo: iso(domingo) };
}
