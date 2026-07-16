// One-off: recorta os elementos de ~/Downloads/elementos.png em assets/ (transparente, trim).
import sharp from 'sharp'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const SRC = join(homedir(), 'Downloads', 'elementos.png')
mkdirSync('assets', { recursive: true })

const src = await sharp(SRC).metadata()
console.log('SRC', `${src.width}x${src.height}`, 'orient=', src.orientation, 'alpha=', src.hasAlpha)

// Caixas generosas (orig 2160x4800); trim remove a borda transparente.
const CROPS = [
  { nome: 'brasao',           left: 100,  top: 40,   width: 760, height: 960 },
  { nome: 'bandeira-verde',   left: 250,  top: 1150, width: 490, height: 700 },
  { nome: 'bandeira-vermelho',left: 760,  top: 1180, width: 440, height: 650 },
  { nome: 'bandeira-branco',  left: 1270, top: 1180, width: 490, height: 640 },
  { nome: 'bandeira-rosa',    left: 470,  top: 1960, width: 480, height: 700 },
  { nome: 'bandeira-roxo',    left: 970,  top: 1970, width: 480, height: 650 },
]

for (const c of CROPS) {
  const out = `assets/${c.nome}.png`
  const meta = await sharp(SRC)
    .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
    .toFile(out)
  console.log(out, `${meta.width}x${meta.height}`)
}
