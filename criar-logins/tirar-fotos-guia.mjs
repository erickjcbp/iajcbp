// Tira as fotos que o guia das famílias usa. O motor é o tirar-fotos.mjs.
//
// A pessoa das fotos é inventada, com um nome que NÃO existe no cadastro: guia impresso
// circula, e ninguém precisa ver o nome de uma criança de verdade num exemplo.
import { foto, nav, servidor, barrados, SAIDA } from './tirar-fotos.mjs';

const EU = { id: 'm1', user_id: 'u1', nome: 'Marina Souza Lima', apelido: 'Marina',
  nivel: 'acolito_guardiao', eh_equipe: false, permissoes: [], serve: true,
  comunidade: 'matriz', casa_id: null, avisos: [], status: 'ativo', senha_provisoria: false };
const PAPEL = { role: 'acolito', nivel: 'acolito_guardiao', eh_equipe: false,
  permissoes: [], modo: 'jornada', email: 'marina@teste' };

// Datas sempre no futuro: uma escala com data velha some da tela (a consulta filtra por
// hoje), e a foto sairia vazia daqui a uma semana sem ninguém perceber.
const d = (dias) => { const x = new Date(); x.setDate(x.getDate() + dias);
  return x.toISOString().slice(0, 10); };
const cel = (id, dia, hora, tipo) => ({ id, data: d(dia), horario: hora, comunidade: 'matriz', tipo });
const ESCALAS = [
  { id: 'e1', funcao: 'cruz',     acolitos_celebracoes: cel('c1', 3, '19:00', 'missa') },
  { id: 'e2', funcao: 'vela',     acolitos_celebracoes: cel('c2', 6, '09:00', 'missa') },
  { id: 'e3', funcao: 'turibulo', acolitos_celebracoes: cel('c3', 10, '19:00', 'missa') },
];
const CELEBRACOES = [cel('c1', 3, '19:00', 'missa'), cel('c2', 6, '09:00', 'missa'),
                     cel('c3', 10, '19:00', 'missa'), cel('c4', 13, '19:00', 'missa')];

const f = [];
// A ARTE DA CAPA: a tela de abertura do próprio app, com o turíbulo em ouro. Melhor que
// qualquer emoji — é o desenho que a pastoral já reconhece.
f.push(await foto({ nome: '00-abertura', arquivo: 'index.html', papel: PAPEL, membro: EU,
  ficarNaAbertura: true }));
f.push(await foto({ nome: '01-parede-senha', arquivo: 'index.html', papel: PAPEL, membro: EU,
  passos: [{ chamar: 'mostrarParedeSenha', args: [EU] }] }));
f.push(await foto({ nome: '02-parede-sino', arquivo: 'index.html', papel: PAPEL, membro: EU,
  passos: [{ chamar: 'mostrarParedeNotificacoes', args: ['pedir', 'u1'] }] }));
f.push(await foto({ nome: '03-instalar', arquivo: 'index.html', papel: PAPEL, membro: EU,
  fecharBanner: false }));
f.push(await foto({ nome: '04-home', arquivo: 'index.html', papel: PAPEL, membro: EU }));
f.push(await foto({ nome: '05-escalas', arquivo: 'escalas-membro.html', papel: PAPEL, membro: EU,
  tabelas: { acolitos_escalas: ESCALAS, acolitos_celebracoes: CELEBRACOES } }));
f.push(await foto({ nome: '06-ausencias', arquivo: 'ausencias.html', papel: PAPEL, membro: EU,
  tabelas: { acolitos_celebracoes: CELEBRACOES, acolitos_ausencias: [] } }));
f.push(await foto({ nome: '07-agenda', arquivo: 'agenda.html', papel: PAPEL, membro: EU,
  tabelas: { acolitos_celebracoes: CELEBRACOES } }));
f.push(await foto({ nome: '08-jornada', arquivo: 'missoes.html', papel: PAPEL, membro: EU }));
f.push(await foto({ nome: '09-conquistas', arquivo: 'conquistas.html', papel: PAPEL, membro: EU }));
f.push(await foto({ nome: '10-minha-casa', arquivo: 'minha-casa.html', papel: PAPEL, membro: EU }));
f.push(await foto({ nome: '11-destaques', arquivo: 'destaques.html', papel: PAPEL, membro: EU }));

console.log('\n  fotos boas: ' + f.filter(x => x.ok).length + ' de ' + f.length);
const ruins = f.filter(x => !x.ok).map(x => x.nome);
if (ruins.length) console.log('  ⚠ conferir: ' + ruins.join(', '));
console.log('\n  o que tentou sair para fora (prova de que a produção não foi tocada):');
const u = [...new Set(barrados.map(b => b.split('?')[0].slice(0, 52)))];
console.log('   ' + (u.length ? u.join('\n   ') : 'NADA ✔'));
console.log('\n  fotos em: ' + SAIDA);
await nav.close(); servidor.close();
