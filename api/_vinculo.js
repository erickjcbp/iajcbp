// A DECISÃO de vincular alguém que já está na pastoral — uma regra só, para as DUAS
// portas de cadastro.
//
// Por que este arquivo existe: até 30/08/2026 essa regra morava dentro de UMA das
// portas. A porta "Novos" (novos.html) perguntava; a porta "Família" (login.html →
// signup-familia.js) criava a pessoa direto, sem perguntar nada. Das 4 fichas criadas
// desde que a conferência subiu, 3 entraram pela porta que não conferia — e foi por
// ali que a Beatriz Dutra Correia virou duas fichas com o nome IDÊNTICO.
//
// Escrito em CommonJS de propósito, como o _nomes.js: assim `node --test` carrega
// direto e a regra que decide o destino de uma criança dá para provar sem banco.
//
// A REGRA MUDOU EM 30/08/2026, por decisão do dono. Antes, nome parecido com prova
// que não bate TRAVAVA o cadastro. Agora segue, e o caso aparece em Config ›
// Cadastros barrados. Motivo: 25 das 139 fichas sem login não têm nem data de
// nascimento nem nome da mãe guardados — nessas a prova NUNCA pode bater, e uma
// parede numa tela pública faria a família sumir na porta sem ninguém saber. Ficha
// duplicada VISÍVEL a coordenação junta em minutos; invisível ninguém junta.
const nomes = require('./_nomes.js');

const LIMITE_ERROS = 3;

// O papel vem do NÍVEL de quem já é da pastoral. Sem isto a pessoa entra como
// recém-chegada e fica presa na tela de integração, mesmo servindo há anos — foi
// literalmente o que aconteceu com a Rafaella, sentinela com 7 habilitações.
function papelDoNivel(nivel) {
  const n = String(nivel || '');
  if (n.startsWith('cerimoniario')) return 'cerimonario';
  if (n.startsWith('acolito') || n === 'aspirante_cerimoniario') return 'acolito';
  if (n === 'coroinha') return 'coroinha';
  if (n === 'aspirante') return 'aspirante';
  return 'novo';
}

// → { acao, membro_id, parecido_id, papel, registrar }
//
//   acao 'seguir'       = o cadastro conclui normalmente (cria a pessoa)
//   acao 'ligar'        = a conta é desta ficha; NÃO se cria uma segunda pessoa
//   acao 'ja_tem_conta' = a ficha já é de OUTRA conta; não liga e não cria em cima dela
//
//   registrar é o que vai para acolitos_vinculo_tentativas (a fila da coordenação),
//   ou null quando não há nada que gente precise olhar.
function decidirVinculo(o) {
  o = o || {};
  const nada = { acao: 'seguir', membro_id: null, parecido_id: null, papel: null, registrar: null };
  if (!o.nome || !String(o.nome).trim()) return nada;

  // FREIO. Sem parede, chutar data de nascimento não custa nada a quem chuta, e um
  // acerto entrega a ficha de uma criança. Ele ficou MAIS necessário depois de 30/08,
  // não menos — mas agora ele trava a LIGAÇÃO, nunca o cadastro.
  if ((o.errosRecentes || 0) >= LIMITE_ERROS) {
    return { ...nada, registrar: 'travado' };
  }

  const parecidos = nomes.acharParecidos(o.nome, o.membros || []);
  if (!parecidos.length) return nada;

  const prova = { nascimento: o.nascimento, nome_mae: o.nome_mae };
  const bateu = parecidos.find((m) => nomes.provaBate(m, prova));

  // Parecido, sem prova: SEGUE (nada de parede) e a coordenação fica sabendo hoje.
  if (!bateu) {
    return { ...nada, parecido_id: parecidos[0].id, registrar: 'prova_nao_bateu' };
  }

  // A ficha já é de outra conta. Provou ser ela? Então ela já tem login e o caminho é
  // recuperar a senha — não nascer uma segunda ficha por cima da que já existe.
  if (bateu.user_id && bateu.user_id !== o.userId) {
    return { ...nada, acao: 'ja_tem_conta', membro_id: bateu.id, registrar: 'prova_nao_bateu' };
  }

  return {
    acao: 'ligar', membro_id: bateu.id, parecido_id: bateu.id,
    papel: papelDoNivel(bateu.nivel), registrar: 'confirmado',
  };
}

module.exports = { decidirVinculo, papelDoNivel, LIMITE_ERROS };
