// Prova da tela São Tarcísio | JCBP e do portão do WhatsApp do responsável (migration 098).
// Roda o init() de verdade com sessão simulada, nos 4 papéis e nas 4 larguras da casa.
//   node projetos/acolitos/provas/tarcisio.prova.mjs
// Fotos em FOTOS_TARCISIO (padrão: ~/arquivos/auditorias/coroinhas/2026-10/sao-tarcisio).
import fs from 'node:fs';
import os from 'node:os';
import { iniciarProvas, PAPEIS } from './abrir-tela.mjs';

const destino = process.env.FOTOS_TARCISIO || os.homedir() + '/arquivos/auditorias/coroinhas/2026-10/sao-tarcisio';
fs.mkdirSync(destino, { recursive: true });

const agora = new Date().toISOString();
const cfg = {
  id: 1, pausado: false, teto_diario: 150, janela_inicio: '08:00:00', janela_fim: '21:00:00', hora_lembrete: '19:00:00',
  hora_aniversario: '08:00:00', escala_ligada: true, lembrete_ligado: true, aniversario_ligado: true, conexao: 'open',
  numero_conectado: '5519998765432', qr_code: null, qr_em: null, robo_visto_em: agora,
};
const envio = (o) => ({ id: Math.random().toString(36).slice(2), tipo: 'lembrete', estado: 'pendente', destino_numero: '5519998765432',
  destino_nome: 'Maria Clara, João Pedro', texto: 'Olá! Amanhã (domingo, 25/10) Maria Clara serve na missa das 9h — Matriz, função Missal; João Pedro serve na missa das 9h — Matriz, função Velas. Chegar 20 min antes.',
  agendado_para: agora, created_at: agora, enviado_em: null, erro: null, ...o });
const tabelas = {
  tarcisio_config: { data: [cfg] },
  tarcisio_envios: { data: [
    envio({}), envio({ tipo: 'escala', estado: 'aguardando_arte', destino_nome: 'Grupos', texto: null, destino_numero: null }),
    envio({ estado: 'enviado', enviado_em: agora }), envio({ estado: 'falhou', erro: 'Número sem WhatsApp' }),
    envio({ estado: 'sem_numero', destino_nome: 'Pedro Henrique Albuquerque Siqueira', erro: 'Sem WhatsApp do responsável no cadastro', membro_id: 'm9' }),
  ] },
  tarcisio_grupos: { data: [
    { jid: '1@g.us', nome: 'Pais dos Coroinhas JCBP', papel: 'pais', visto_em: agora },
    { jid: '2@g.us', nome: 'Acólitos e Coroinhas — Paróquia Jesus Cristo Bom Pastor', papel: 'acolitos', visto_em: agora },
    { jid: '3@g.us', nome: 'Cerimoniários', papel: null, visto_em: agora },
  ] },
  tarcisio_mensagens: { data: [
    { id: 'x1', numero: '5519998765432', direcao: 'entrada', texto: 'Oi, o João não vai poder ir domingo dia 1º, vamos viajar', membro_ids: ['m1'], respondida: true, created_at: agora },
    { id: 'x2', numero: '5519998765432', direcao: 'saida', texto: 'Tudo bem! Registrei a ausência do João em 01/11. A Maria, que serve junto, também ficou fora nesse dia. Boa viagem! 🙏', membro_ids: ['m1'], ferramentas: [{ ferramenta: 'registrar_ausencia' }], respondida: true, created_at: agora },
    { id: 'x3', numero: '5511900000000', direcao: 'entrada', texto: 'Boa tarde, sou a mãe do Pedro', membro_ids: [], respondida: false, created_at: agora },
  ] },
  tarcisio_pendencias: { data: [
    { id: 'p1', tipo: 'vincular_numero', numero: '5511900000000', resumo: 'Ligar número ao servo "Pedro Henrique Albuquerque Siqueira" (mae)', estado: 'aberta', created_at: agora,
      dados: { relacao: 'mae', quem_fala: 'Ana', data_nascimento: '2014-05-01', candidatos: [{ id: 'm9', nome: 'Pedro Henrique Albuquerque Siqueira', data_nascimento: '2014-05-01' }] } },
    { id: 'p2', tipo: 'coordenacao', numero: '5519998765432', resumo: 'Mãe pergunta se o João pode trocar de função para Cruz no retiro', estado: 'aberta', created_at: agora, dados: {} },
  ] },
  acolitos_membros: { data: [{ id: 'm1', nome: 'João Pedro Albuquerque' }] },
  tarcisio_avisos: { data: [
    { id: 'a1', titulo: 'Reunião de formação', texto: 'Segunda às 19h30 no salão.', imagem_url: null, grupos: ['acolitos', 'pais'], privado: [],
      quando: agora, repetir: 'semanal', ate: '2026-12-20', ativo: true },
    { id: 'a2', titulo: 'Retiro de Advento', texto: 'Inscrições abertas.', imagem_url: null, grupos: [], privado: ['pais'],
      quando: agora, repetir: 'nao', ate: null, ativo: false },
  ] },
};

const avaliar = `
  await document.fonts.ready;
  document.getElementById('splash')?.remove();
  const visivel = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const rolavel = (e) => { let p = e.parentElement; while (p && p !== document.body) { if (/auto|scroll/.test(getComputedStyle(p).overflowX)) return true; p = p.parentElement; } return false; };
  const alvo = '#main-content, .modal-overlay, #parede-whatsapp';
  const els = [...document.querySelectorAll(alvo)].flatMap((r) => [...r.querySelectorAll('button,a,input,select,textarea')]).filter(visivel);
  const pequenos = innerWidth < 640 ? els.filter((e) => !['checkbox', 'radio', 'file'].includes(e.type) && e.getBoundingClientRect().height < 43.5).map((e) => (e.textContent || e.placeholder || e.tagName).trim().slice(0, 40)) : [];
  const letra = innerWidth < 640 ? els.filter((e) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName) && !['checkbox', 'radio', 'file'].includes(e.type) && parseFloat(getComputedStyle(e).fontSize) < 16).length : 0;
  const fora = els.filter((e) => { const r = e.getBoundingClientRect(); return (r.right > innerWidth + 1 || r.left < -1) && !rolavel(e); }).length;
  const modal = document.querySelector('#modal-aviso .modal');
  return { rolagemLateral: document.documentElement.scrollWidth > innerWidth + 1, pequenos, letra, fora,
    larguraMain: document.querySelector('.main')?.getBoundingClientRect().width, larguraModal: modal ? modal.getBoundingClientRect().width : null,
    parede: !!document.getElementById('parede-whatsapp'), abas: [...document.querySelectorAll('.tc-aba-btn')].map((b) => b.textContent),
    textoTc: document.querySelectorAll('.tc-st-card, .tc-linha, .tc-conversa, .tc-st-muted').length };
`;

const cenarios = [
  { id: 'avisos', tela: 'tarcisio.html', passos: [], abas: 2 },
  { id: 'aviso-novo', tela: 'tarcisio.html', passos: [{ clicar: '+ Novo aviso' }], abas: 2 },
  { id: 'sem-numero', tela: 'tarcisio.html', passos: [{ clicar: 'Sem número' }], abas: 2 },
  { id: 'config-whatsapp', tela: 'config.html', passos: [{ chamar: 'abrirSecao', args: ['tarcisio_whatsapp'] }] },
  { id: 'config-grupos', tela: 'config.html', passos: [{ chamar: 'abrirSecao', args: ['tarcisio_grupos'] }] },
  { id: 'config-ia', tela: 'config.html', passos: [{ chamar: 'abrirSecao', args: ['tarcisio_ia'] }] },
  { id: 'config-conversas', tela: 'config.html', passos: [{ chamar: 'abrirSecao', args: ['tarcisio_conversas'] }] },
  { id: 'caixa-pendencias', tela: 'caixa.html', passos: [] },
];
const larguras = [[375, 812], [768, 1024], [1366, 900], [2560, 1440]];
const falhas = [];
const exigir = (ok, msg) => { if (!ok) falhas.push(msg); };

const provas = await iniciarProvas();
try {
  // 1) A tela, como admin, em todas as larguras
  for (const c of cenarios) for (const [largura, altura] of larguras) {
    const r = await provas.abrir(c.tela, { papel: PAPEIS.admin, tabelas, largura, altura, passos: c.passos, avaliar,
      foto: { caminho: `${destino}/${c.id}-${largura}.png`, viewport: true } });
    const a = r.avaliado || {};
    const id = `${c.id} @${largura}`;
    exigir(!r.erros.length, `${id}: erros ${r.erros.join(' | ')}`);
    exigir(!(r.passosFalhos || []).length, `${id}: passo não achou o alvo ${JSON.stringify(r.passosFalhos)}`);
    if (c.abas) exigir(a.abas?.length === c.abas, `${id}: as abas não apareceram`);
    exigir(a.textoTc > 0, `${id}: a tela do São Tarcísio não desenhou`);
    exigir(!a.rolagemLateral, `${id}: rolagem lateral`);
    exigir(!a.pequenos?.length, `${id}: alvo menor que 44px: ${a.pequenos}`);
    exigir(!a.letra, `${id}: campo com letra < 16px`);
    exigir(!a.fora, `${id}: ${a.fora} controle(s) para fora da tela`);
    if (largura >= 1366) exigir(Math.abs(a.larguraMain - largura) <= 1, `${id}: a tela não ocupa a largura toda (${a.larguraMain})`);
    if (largura < 640 && a.larguraModal != null) exigir(Math.abs(a.larguraModal - largura) <= 1, `${id}: diálogo não é tela cheia (${a.larguraModal})`);
    console.log(id, JSON.stringify(a));
  }
  // 2) Quem não é admin/subadmin não vê nada
  for (const papel of [PAPEIS.membro, PAPEIS.cerimonario, PAPEIS.equipe]) {
    const r = await provas.abrir('tarcisio.html', { papel, tabelas, avaliar });
    exigir(!r.avaliado?.abas?.length && /só do admin/.test(r.texto), `${papel.nome}: deveria ver "só do admin" e viu outra coisa`);
  }
  // 3) Portão do WhatsApp do responsável. O motor de provas troca o initModulo por um falso,
  //    então o portão é chamado aqui do mesmo jeito que o initModulo de verdade chama.
  const menor = { id: 'm1', nome: 'Maria Clara', status: 'ativo', serve: true, data_nascimento: '2014-05-11' };
  const portao = (ficha) => `
    const faltam = await whatsappResponsavelFaltando(${JSON.stringify(ficha)}, []);
    if (faltam.length) WhatsappResponsavel.mostrarParede(faltam, sb, () => {});
  ` + avaliar;
  const semNumero = await provas.abrir('index.html', { papel: PAPEIS.membro, largura: 375, avaliar: portao(menor),
    foto: { caminho: `${destino}/portao-whatsapp-375.png`, viewport: true } });
  exigir(!semNumero.erros.length, 'portão: erros ' + semNumero.erros.join(' | '));
  exigir(semNumero.avaliado?.parede === true, 'menor sem número: a parede do WhatsApp não apareceu');
  exigir(!semNumero.avaliado?.pequenos?.length && !semNumero.avaliado?.letra, `parede: alvo pequeno ou letra < 16px ${JSON.stringify(semNumero.avaliado)}`);
  const comNumero = await provas.abrir('index.html', { papel: PAPEIS.membro, largura: 375, avaliar: portao({ ...menor, celular_recado: '(19) 99876-5432' }) });
  exigir(comNumero.avaliado?.parede === false, 'menor com número: a parede apareceu sem precisar');
  const adulto = await provas.abrir('index.html', { papel: PAPEIS.membro, largura: 375, avaliar: portao({ ...menor, data_nascimento: '2000-01-01' }) });
  exigir(adulto.avaliado?.parede === false, 'adulto: a parede apareceu sem precisar');
} finally {
  await provas.encerrar();
}
if (falhas.length) { console.error('\nFALHAS:\n- ' + falhas.join('\n- ')); process.exitCode = 1; }
else console.log('\nTudo certo. Fotos em ' + destino);
