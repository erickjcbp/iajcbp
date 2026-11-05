// Versão 1 (membros): onboarding + jornada. Rascunho para aprovação. Só cita o que existe no app.
// O endereço não é falado: a fala aponta para o texto enviado nas mensagens; show mostra o link.
export const CENAS = [
  { id: 'chamado', chave: 'Sua jornada', frases: [
    { say: 'Você serve no altar. Mas sabia que tem uma jornada inteira te esperando?', show: 'Você serve no altar. Tem uma jornada inteira te esperando.' },
    { say: 'E ela já começou. Falta só você entrar.', show: 'Ela já começou. Falta só você entrar.' } ] },
  { id: 'niveis', chave: 'Níveis', frases: [
    { say: 'São dez degraus. Você começa como Aspirante, passa por Coroinha, Acólito Guardião, Sentinela, e pode chegar a Cerimoniário Mor.', show: 'De Aspirante a Cerimoniário Mor: 10 degraus.' },
    { say: 'Cada degrau tem capítulos, e cada capítulo se abre com as missões que você cumpre.', show: 'Cada degrau tem capítulos e missões.' } ] },
  { id: 'aventuras', chave: 'Aventuras', frases: [
    { say: 'Toda semana tem aventura nova. Tem jogo para jogar na hora, descoberta para registrar com foto, e desafio com a galera.', show: 'Jogue agora, Descobertas e Com a galera.' },
    { say: 'Tem até caso aberto na sacristia para você resolver.', show: 'Caso aberto na sacristia.' } ] },
  { id: 'medalhas', chave: 'Medalhas', frases: [
    { say: 'Cada conquista rende XP e medalhas de bronze, prata e ouro.', show: 'XP e medalhas de bronze, prata e ouro.' },
    { say: 'E elas ficam guardadas nas suas conquistas.', show: 'Tudo nas suas conquistas.' } ] },
  { id: 'casas', chave: 'Casas', frases: [
    { say: 'São cinco casas: Sanctaris, Seraphim, Templaris, Veritatis e Consilium. Cada uma com brasão e lema. A seleção das casas vem aí.', show: '5 casas. Seleção em breve.' } ] },
  { id: 'temporada', chave: 'Temporada', frases: [
    { say: 'E na temporada, todo mundo disputa o ranking de XP, por liga. O campeão de cada liga vira Destaque.', show: 'Ranking por liga. O campeão vira Destaque.' } ] },
  { id: 'entrar', chave: 'Entrar', frases: [
    { say: 'Para começar, use o link que enviamos aqui nas mensagens.', show: 'Use o link enviado nas mensagens.' },
    { say: 'O usuário e a senha estão no texto que veio junto. No primeiro acesso, crie uma senha só sua.', show: 'Usuário e senha no texto. Depois, crie a sua.' } ] },
  { id: 'fecho', chave: 'Vem servir', frases: [
    { say: 'Sua jornada já está esperando. Paz e bem!', show: 'Sua jornada está esperando.' } ] },
];
