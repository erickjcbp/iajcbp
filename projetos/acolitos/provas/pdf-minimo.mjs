// PDF mínimo, feito à mão, para as provas que sobem um PDF de verdade na tela (sem nome de
// ninguém real e sem depender de biblioteca). Mesma receita do teste do robô
// (tarcisio-robo/entrada-dono.test.mjs): Helvetica padrão com WinAnsiEncoding, um pedaço de
// texto por palavra, cada um na sua posição — é assim que o PDF do Drive chega ao pdf.js.
//
// linhas: [[x, y, 'texto'], ...] (y cresce para cima, como no PDF). Texto em latin1 (Á, Ô…).
export function pdfMinimo(linhas) {
  const esc = (s) => String(s).replace(/([\\()])/g, '\\$1');
  const conteudo = linhas.map(([x, y, s]) => `BT /F1 10 Tf ${x} ${y} Td (${esc(s)}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}\nendstream`,
  ];
  let s = '%PDF-1.4\n';
  const pos = [];
  objs.forEach((o, i) => { pos.push(Buffer.byteLength(s, 'latin1')); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(s, 'latin1');
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + pos.map((p) => String(p).padStart(10, '0') + ' 00000 n \n').join('');
  s += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(s, 'latin1');
}

// Uma linha de palavras a partir de x, uma palavra por pedaço de texto.
export function palavras(x, y, texto, passo = 62) {
  return texto.split(' ').map((p, i) => [x + i * passo, y, p]);
}
