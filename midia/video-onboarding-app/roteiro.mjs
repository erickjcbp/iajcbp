// Roteiro do vídeo de onboarding do app (piloto). say = fala (por extenso, para a voz); show = legenda na tela.
// A senha da folha NÃO é dita nem escrita: o vídeo circula no WhatsApp.
export const CENAS = [
  { id: 'abertura', chave: 'Paz e bem', frases: [
    { say: 'Paz e bem! O seu acesso ao aplicativo da pastoral já está pronto.', show: 'Paz e bem! Seu acesso ao app já está pronto.' },
    { say: 'Falta só entrar pela primeira vez.', show: 'Falta só entrar pela primeira vez.' } ] },
  { id: 'entrar', chave: 'Entrar', frases: [
    { say: 'Abra coroinhas ponto jcbplimeira ponto com ponto be érre.', show: 'coroinhas.jcbplimeira.com.br' },
    { say: 'Em usuário, escreva o seu primeiro nome e o último sobrenome, tudo junto e sem acento.', show: 'Usuário: primeiro nome + último sobrenome, junto, sem acento.' },
    { say: 'A senha é a que veio na folha da sua família.', show: 'Senha: a da folha da sua família.' } ] },
  { id: 'senha', chave: 'Senha nova', frases: [
    { say: 'No primeiro acesso, o aplicativo pede uma senha nova.', show: 'No 1º acesso, o app pede uma senha nova.' },
    { say: 'Escolha uma que só você saiba.', show: 'Escolha uma que só você saiba.' } ] },
  { id: 'inicio', chave: 'Início', frases: [
    { say: 'Pronto! Na tela inicial ficam os seus avisos e a sua próxima escala.', show: 'Na tela inicial: seus avisos e sua próxima escala.' } ] },
  { id: 'escala', chave: 'Escala', frases: [
    { say: 'Em escalas, veja quando você serve.', show: 'Em escalas, veja quando você serve.' },
    { say: 'Se não puder, registre a ausência com antecedência.', show: 'Não pode? Registre a ausência com antecedência.' } ] },
  { id: 'avisos', chave: 'Avisos', frases: [
    { say: 'Ative as notificações para receber a escala e os recados da coordenação.', show: 'Ative as notificações: escala e recados da coordenação.' } ] },
  { id: 'fecho', chave: 'Paz e bem', frases: [
    { say: 'Alguma dúvida? Fale com a coordenação.', show: 'Dúvida? Fale com a coordenação.' },
    { say: 'Estamos juntos. Paz e bem!', show: 'Estamos juntos. Paz e bem!' } ] },
];
