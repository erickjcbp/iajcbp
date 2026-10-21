// Prova que os núcleos do app carregam como o robô os carrega (createRequire a partir de ACOLITOS_CORE_DIR).
// Uso: ACOLITOS_CORE_DIR=/app/cores node verificar-cores.mjs   (sai com 1 se algum falhar)
import { createRequire } from 'node:module'
import path from 'node:path'

const pasta = process.env.ACOLITOS_CORE_DIR
if (!pasta) { console.error('ACOLITOS_CORE_DIR não definido'); process.exit(2) }
const exigir = createRequire(import.meta.url)
// arquivo → o que o robô usa dele
const NUCLEOS = {
  'gerador-escala-core.js': (m) => typeof (m.gerarSemana ? m : m.GeradorEscalaCore)?.gerarSemana === 'function',
  'rodizio-core.js': (m) => m && typeof m === 'object',
  'servir-semanal-core.js': (m) => m && typeof m === 'object',
  'paginar-core.js': (m) => typeof m.lerTudo === 'function',
  'escala-ministros-core.js': (m) => typeof m.lerEscalaMinistros === 'function' && typeof m.casarNomes === 'function',
  'kits-core.js': (m) => m && typeof m === 'object',
  'horario-core.js': (m) => m && typeof m === 'object',
  'confirmar-semana-core.js': (m) => typeof m.confirmarSemana === 'function' && typeof m.pedirArtePeloServico === 'function',
  'confirmar-escala-core.js': (m) => typeof m.aNotificar === 'function',
}
let falhas = 0
for (const [arq, ok] of Object.entries(NUCLEOS)) {
  if (process.env.SEM_GERADOR === '1' && arq === 'gerador-escala-core.js') { console.log('pulado', arq); continue }
  try {
    const m = exigir(path.join(pasta, arq))
    if (!ok(m)) throw new Error('carregou, mas a API esperada não está lá')
    console.log('ok   ', arq)
  } catch (e) { falhas++; console.error('FALHA', arq, '-', e.message) }
}
process.exit(falhas ? 1 : 0)
