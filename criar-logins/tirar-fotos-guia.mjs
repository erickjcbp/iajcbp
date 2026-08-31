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

// ── AS QUESTS ────────────────────────────────────────────────────────────────
// A forma veio do CORPO da função acolitos_missoes_board (ela devolve 'sem_permissao'
// pelo psql, porque confere auth.uid()), e os TÍTULOS são os de verdade, lidos da
// tabela acolitos_missoes — que é configuração da pastoral, não dado de criança.
// Inventar quest daria uma foto que não existe em lugar nenhum.
const q = (o) => Object.assign({ validacao: null, seriedade: null, competencia: null,
  fonte: null, atual: null, alvo: null, obrigatoria: true, status: 'pendente' }, o);
const BOARD = {
  nivel: 'acolito_guardiao', proximo_nivel: 'acolito_sentinela', xp_total: 245,
  elegivel: false, pendencias: [],
  capitulos: [
    { capitulo: 1, desbloqueado: true, completo: false, missoes: [
      q({ id: 'q1', titulo: 'Apto no Sinão', descricao: 'Fique habilitado (apto) na função Sinão.',
          xp: 35, fonte: 'habilitacao', status: 'concluida' }),
      q({ id: 'q2', titulo: 'Servir 6 missas', descricao: 'Sirva 6 missas neste nível.',
          xp: 20, fonte: 'missas_servidas', atual: 4, alvo: 6 }),
      q({ id: 'q3', titulo: 'Participar de 2 ensaios', descricao: 'Presença em 2 ensaios neste nível.',
          xp: 15, fonte: 'ensaio', atual: 2, alvo: 2, status: 'concluida' }),
      q({ id: 'q4', titulo: 'Nome de 3 paramentos',
          descricao: 'Aprenda o nome de 3 paramentos e pra que servem.', xp: 15 }),
      q({ id: 'q5', titulo: 'Encare o Missal',
          descricao: 'Sirva no Missal pela primeira vez (coragem!).', xp: 15, status: 'em_analise' }),
      q({ id: 'q6', titulo: 'Preparador', descricao: 'Chegue cedo e ajude a montar tudo.', xp: 12 }),
    ] },
    { capitulo: 2, desbloqueado: false, completo: false, missoes: [
      q({ id: 'q7', titulo: 'Servir mais 5 missas', descricao: 'Chegue a 11 missas no nível.',
          xp: 20, fonte: 'missas_servidas', atual: 4, alvo: 11 }),
      q({ id: 'q8', titulo: 'Mestre do silêncio',
          descricao: '5 minutos de oração em silêncio antes da missa.', xp: 15 }),
    ] },
  ],
  bonus: [
    q({ id: 'b1', titulo: 'Caçador de sorrisos', descricao: 'Faça um colega sorrir antes da missa.',
        xp: 10, seriedade: 'divertida', obrigatoria: false }),
    q({ id: 'b2', titulo: 'Caça ao santo',
        descricao: 'Conte quantas imagens de santos tem na igreja.', xp: 10,
        seriedade: 'divertida', obrigatoria: false }),
    q({ id: 'b3', titulo: 'Dupla dinâmica',
        descricao: 'Combine um sinal secreto com seu parceiro de altar.', xp: 10,
        seriedade: 'divertida', obrigatoria: false }),
  ],
};

// A tela também pergunta as ESTRELAS. Devolver [] fazia a tela escrever
// "faltam undefined XP" — não é defeito do app, é amostra com a forma errada. A forma
// certa saiu do corpo da acolitos_estrelas.
const ESTRELAS = { estrelas: 2, xp_nivel: 245, xp_prox: 55, limiar: 100 };

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
f.push(await foto({ nome: '08-jornada', arquivo: 'missoes.html', papel: PAPEL, membro: EU,
  rpcs: { acolitos_missoes_board: BOARD, acolitos_estrelas: ESTRELAS } }));
// a mesma tela rolada até as quests bônus — é onde mora a graça do app
f.push(await foto({ nome: '08b-quests-bonus', arquivo: 'missoes.html', papel: PAPEL, membro: EU,
  rpcs: { acolitos_missoes_board: BOARD, acolitos_estrelas: ESTRELAS }, rolarAte: 'Missões bônus' }));
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
