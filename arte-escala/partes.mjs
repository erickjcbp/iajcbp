// Automático: até cinco missas numa imagem; acima disso, separar por dia.
export function partesDaArte(dados, formato = 'automatico') {
  if (!['automatico', 'unica', 'por_dia'].includes(formato)) throw new Error('Formato de arte inválido')
  const total = dados.missasSabado.length + dados.missasDomingo.length
  if (!total) return []
  if (formato === 'unica' || (formato === 'automatico' && total <= 5)) return ['unica']
  // Com apenas um dia, uma imagem basta e continua compatível com o app.
  if (!dados.missasSabado.length || !dados.missasDomingo.length) return ['unica']
  return ['sabado', 'domingo']
}
