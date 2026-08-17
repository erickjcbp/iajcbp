// arte-escala/fim-de-semana.mjs
// A conta em si mora em ../api/_fim-de-semana.mjs — a Vercel só empacota o que está
// dentro de api/, e o vigia da arte (api/cron-vigia-arte.js) precisa da MESMA conta.
// Este arquivo continua existindo para não quebrar quem já importava daqui
// (gerar.mjs e os testes), e para deixar claro que a regra é uma só.
export { alvoFimDeSemana } from '../api/_fim-de-semana.mjs';
