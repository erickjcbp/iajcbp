// Tira as fotos do tutorial da EQUIPE (acesso, Tesouraria e Retiros). Motor: tirar-fotos.mjs.
//
//   node criar-logins/tirar-fotos-equipe.mjs criar-logins/fotos-equipe
//
// O argumento é a pasta de saída (o motor a lê de process.argv[2]); sem ele as fotos cairiam
// em criar-logins/fotos e sobrescreveriam as do guia das famílias.
//
// As telas são as de VERDADE; só a resposta do banco é inventada, e nenhuma pessoa ou valor
// real aparece. A pessoa das fotos ("Beatriz Exemplo") não existe no cadastro.
import { foto, nav, servidor, barrados, SAIDA } from './tirar-fotos.mjs';
if (!process.argv[2]) { console.error('Passe a pasta de saída: criar-logins/fotos-equipe'); process.exit(1); }
const EU = { id: 'm1', user_id: 'u1', nome: 'Beatriz Exemplo', apelido: 'Beatriz', nivel: null,
  eh_equipe: true, permissoes: ['retiros', 'tesouraria'], serve: false, comunidade: 'matriz',
  casa_id: null, avisos: [], status: 'ativo', senha_provisoria: false };
const PAPEL = { role: 'membro_equipe', nivel: null, eh_equipe: true, permissoes: ['retiros', 'tesouraria'],
  modo: 'coordenacao', email: 'beatriz@teste' };

// Datas SEMPRE relativas a hoje: com data fixa o prazo vira "vencido" ou some, e a foto muda
// de sentido sem ninguém perceber.
const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

const MEMBROS = [
  { id: 'm1', nome: 'Beatriz Exemplo', eh_equipe: true, status: 'ativo' },
  { id: 'm2', nome: 'Carla Modelo', eh_equipe: true, status: 'ativo' },
  { id: 'm3', nome: 'Paulo Exemplo', eh_equipe: false, status: 'ativo' },
];
const FORNEC = [
  { id: 'f1', nome: 'Atacadão', contato: 'Atendimento', telefone: '(19) 3000-0000', observacao: 'Entrega só acima de R$ 300' },
  { id: 'f2', nome: 'Papelaria Central', contato: null, telefone: '(19) 3000-1111', observacao: null },
  { id: 'f3', nome: 'Mercadinho do Bairro', contato: null, telefone: null, observacao: null },
];
const AREAS = [
  { id: 'a1', nome: 'Retiro de Advento 2026', tipo: 'retiro', local: 'Casa de Retiros', data_inicio: d(40), data_fim: d(41), status: 'planejando', descricao: 'Dois dias de formação e oração para os acólitos.' },
  { id: 'a2', nome: 'Formação de novos coroinhas', tipo: 'formacao', local: 'Salão paroquial', data_inicio: d(15), data_fim: d(15), status: 'em_andamento', descricao: null },
];
const ITENS = [
  { id: 'i1', area_id: 'a1', secao: 'cronograma', titulo: 'Acolhida e café da manhã', data: d(40), hora: '08:00:00', duracao_min: 45, status: 'feito', responsavel_id: 'm2', prazo: d(20) },
  { id: 'i2', area_id: 'a1', secao: 'cronograma', titulo: 'Missa de abertura', data: d(40), hora: '09:00:00', duracao_min: 60, status: 'andamento', responsavel_id: 'm1', prazo: d(10) },
  { id: 'i3', area_id: 'a1', secao: 'cronograma', titulo: 'Pregação: A fé de Maria', data: d(40), hora: '10:30:00', duracao_min: 40, status: 'a_fazer', responsavel_id: 'm3', prazo: d(-2) },
  { id: 'i4', area_id: 'a1', secao: 'refeicao', subtipo: 'almoco', titulo: 'Arroz, feijão, frango assado e salada', descricao: '40 pessoas. Uma criança sem glúten.', data: d(40), hora: '12:00:00', status: 'a_fazer', responsavel_id: 'm2', prazo: d(30) },
  { id: 'i5', area_id: 'a1', secao: 'refeicao', subtipo: 'cafe', titulo: 'Pão, queijo, café e leite', data: d(40), hora: '07:30:00', status: 'a_fazer', responsavel_id: 'm1', prazo: d(30) },
];
const COTACOES = [
  { id: 'k1', compra_id: 'c1', fornecedor_id: 'f1', valor_unitario: 28.9, escolhida: true, validade: d(12), observacao: 'Entrega em 2 dias' },
  { id: 'k2', compra_id: 'c1', fornecedor_id: 'f3', valor_unitario: 32.5, escolhida: false, validade: null, observacao: 'Pagamento só em dinheiro' },
  { id: 'k3', compra_id: 'c1', fornecedor_nome: 'Distribuidora Sul', valor_unitario: 30.0, escolhida: false, validade: d(5), observacao: null },
];
const COMPRAS = [
  { id: 'c1', area_id: 'a1', categoria: 'ingredientes', item: 'Arroz 5 kg', quantidade: 4, unidade: 'pacotes', valor_estimado: 115.6, status: 'aprovada', fornecedor_id: 'f1', responsavel_id: 'm2', prazo: d(25), cotacoes: COTACOES },
  { id: 'c2', area_id: 'a1', categoria: 'ingredientes', item: 'Frango (peito)', quantidade: 12, unidade: 'kg', valor_estimado: null, status: 'cotando', responsavel_id: 'm2', prazo: d(30), cotacoes: [{ id: 'k4', compra_id: 'c2', fornecedor_id: 'f1', valor_unitario: 19.9 }] },
  { id: 'c3', area_id: 'a1', categoria: 'papelaria', item: 'Cartolinas coloridas', quantidade: 30, unidade: 'un', valor_estimado: 60, status: 'comprada', valor_pago: 57.5, comprada_em: d(-3), fornecedor_id: 'f2', responsavel_id: 'm1', prazo: d(-5), cotacoes: [] },
  { id: 'c4', area_id: 'a1', categoria: 'decoracao', item: 'Velas brancas', quantidade: 20, unidade: 'un', valor_estimado: 48, status: 'pendente', prazo: d(35), cotacoes: [] },
  { id: 'c5', area_id: 'a1', categoria: 'lembrancas', item: 'Terços de madeira', quantidade: 40, unidade: 'un', valor_estimado: 200, status: 'pendente', cotacoes: [] },
  { id: 'c6', area_id: 'a1', categoria: 'limpeza', item: 'Detergente e esponjas', quantidade: 1, unidade: 'kit', valor_estimado: 35, status: 'pendente', cotacoes: [] },
];
const FINANC_RETIRO = [
  { id: 'l1', tipo: 'saida', categoria: 'compras', valor: 57.5, descricao: 'Retiro de Advento 2026 · Cartolinas coloridas', data: d(-3), retiro_area_id: 'a1', retiro_compra_id: 'c3' },
  { id: 'l2', tipo: 'entrada', categoria: 'dizimo', valor: 300, descricao: 'Retiro de Advento 2026 · Doação: Família Exemplo', data: d(-6), retiro_area_id: 'a1' },
  { id: 'l3', tipo: 'entrada', categoria: 'rifa', valor: 135, descricao: 'Retiro de Advento 2026 · Venda: 9 × pingente', data: d(-8), retiro_area_id: 'a1' },
];
const FINANC_TESOURARIA = [
  ...FINANC_RETIRO,
  { id: 'l4', tipo: 'entrada', categoria: 'mensalidade', valor: 420, descricao: 'Mensalidades do mês', data: d(0) },
  { id: 'l5', tipo: 'saida', categoria: 'tunicas', valor: 180, descricao: 'Conserto de túnicas', data: d(0) },
];
const LISTAS = [];   // categorias padrão do código
const T = { acolitos_membros: MEMBROS, acolitos_retiro_fornecedores: FORNEC, acolitos_retiro_areas: AREAS,
  acolitos_retiro_itens: ITENS, acolitos_retiro_compras: COMPRAS, acolitos_financeiro: FINANC_RETIRO, acolitos_listas: LISTAS };
const base = { papel: PAPEL, membro: EU, tabelas: T };
const abrir = (nome, passos, extra) => foto({ nome, arquivo: 'retiros.html', ...base, passos, ...(extra || {}) });
const AREA = { chamar: 'abrirArea', args: ['a1'] };

const f = [];
f.push(await foto({ nome: '01-login', arquivo: 'login.html', papel: PAPEL, membro: EU, semInit: true }));
f.push(await foto({ nome: '02-parede-senha', arquivo: 'index.html', papel: PAPEL, membro: EU, passos: [{ chamar: 'mostrarParedeSenha', args: [EU] }] }));
f.push(await foto({ nome: '03-inicio', arquivo: 'index.html', papel: PAPEL, membro: EU, tabelas: T }));
f.push(await foto({ nome: '04-tesouraria', arquivo: 'tesouraria.html', papel: PAPEL, membro: EU, tabelas: { ...T, acolitos_financeiro: FINANC_TESOURARIA } }));
f.push(await foto({ nome: '05-tesouraria-lancamento', arquivo: 'tesouraria.html', papel: PAPEL, membro: EU, tabelas: { ...T, acolitos_financeiro: FINANC_TESOURARIA }, passos: [{ chamar: 'abrirLancamento' }] }));
f.push(await abrir('06-retiros-lista', []));
f.push(await abrir('07-nova-area', [{ chamar: 'editarArea', args: [null] }]));
f.push(await abrir('08-area-cronograma', [AREA]));
f.push(await abrir('09-novo-item', [AREA, { chamar: 'editarItem', args: ['cronograma', null] }]));
f.push(await abrir('10-refeicoes', [AREA, { clicar: 'Refeições' }]));
f.push(await abrir('11-compras', [AREA, { clicar: 'Compras' }]));
f.push(await abrir('12-novo-item-compra', [AREA, { chamar: 'editarCompra', args: [null] }]));
f.push(await abrir('13-cotacoes', [AREA, { chamar: 'abrirCotacoes', args: ['c1'] }]));
f.push(await abrir('14-fornecedores', [AREA, { chamar: 'gerirFornecedores' }]));
f.push(await abrir('15-comprei', [AREA, { chamar: 'comprar', args: [COMPRAS[0]] }]));
f.push(await abrir('16-caixa', [AREA, { clicar: 'Caixa' }]));
f.push(await abrir('17-venda', [AREA, { chamar: 'lancarEntrada', args: ['venda'] }]));

console.log('\n  fotos boas: ' + f.filter((x) => x.ok).length + ' de ' + f.length);
const ruins = f.filter((x) => !x.ok).map((x) => x.nome);
if (ruins.length) console.log('  ⚠ conferir: ' + ruins.join(', '));
console.log('\n  o que tentou sair para fora (prova de que a produção não foi tocada):');
const u = [...new Set(barrados.map((b) => b.split('?')[0].slice(0, 52)))];
console.log('   ' + (u.length ? u.join('\n   ') : 'NADA ✔'));
await nav.close(); servidor.close();
console.log('\n  fotos em: ' + SAIDA);
