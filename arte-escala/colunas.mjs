// arte-escala/colunas.mjs
// Distribui as missas de um dia nas 2 colunas da arte. Antes eram pares fixos (1ª+2ª, 3ª+4ª…):
// a altura de cada par é a da missa MAIOR, e a menor deixava um buraco embaixo dela. Com 6
// missas (3/10/2026) isso passou de 4.800 px e cortou o domingo 19h. Agora cada missa, em
// ordem de horário, vai para a coluna que está mais curta — a de 8 nomes recebe a próxima
// logo abaixo dela.

// altura de uma missa em "linhas de nome": o pill + o rótulo da comunidade ocupam ~4.
export const PESO_PILL = 4
const peso = m => Math.max(m.itens.length, 1) + PESO_PILL

export function distribuirColunas(missas) {
  const col = { esq: [], dir: [] }, alt = { esq: 0, dir: 0 }
  for (const m of missas) {
    const k = alt.esq <= alt.dir ? 'esq' : 'dir'   // empate vai para a esquerda: 1ª missa à esquerda
    col[k].push(m); alt[k] += peso(m)
  }
  return col
}
