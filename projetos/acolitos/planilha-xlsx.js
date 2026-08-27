// ── PLANILHA DE VERDADE, SEM BIBLIOTECA ────────────────────────────────
// Um arquivo .xlsx é um ZIP com alguns arquivos XML dentro. Aqui o ZIP é
// montado "sem compressão" (método 0), que o formato permite e dispensa
// qualquer compressor: o navegador só precisa somar um CRC32.
//
// Existe biblioteca pronta para isso, e nenhuma serve aqui: a famosa não
// escreve cor na versão livre, e a que escreve pesa 1 MB num app que as
// pessoas abrem no celular. São 200 linhas — cabem.
//
// Uso:
//   baixarXLSX('cadastro-da-pastoral', colunas, linhas)
//   colunas = [{ titulo:'NOME', largura:34, tipo:'texto'|'centro'|'data' }]
//   linhas  = [[valor, valor, ...]]   (Date para data, boolean vira Sim/Não)
(function (global) {
  'use strict';

  // ── CRC32, a única conta que o ZIP exige ──
  var TABELA = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = TABELA[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function bytes(txt) { return new TextEncoder().encode(txt); }

  // ── o ZIP: cabeçalho local por arquivo + índice central no fim ──
  function zipar(arquivos) {
    var partes = [], indice = [], desloc = 0;
    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    arquivos.forEach(function (a) {
      var nome = bytes(a.nome), dados = a.dados, crc = crc32(dados);
      var local = [].concat([80, 75, 3, 4], u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(dados.length), u32(dados.length), u16(nome.length), u16(0));
      partes.push(new Uint8Array(local), nome, dados);
      indice.push({ nome: nome, crc: crc, tam: dados.length, desloc: desloc });
      desloc += local.length + nome.length + dados.length;
    });
    var central = [], tamCentral = 0;
    indice.forEach(function (e) {
      var cab = [].concat([80, 75, 1, 2], u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(e.crc), u32(e.tam), u32(e.tam), u16(e.nome.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.desloc));
      central.push(new Uint8Array(cab), e.nome);
      tamCentral += cab.length + e.nome.length;
    });
    var fim = new Uint8Array([].concat([80, 75, 5, 6], u16(0), u16(0),
      u16(indice.length), u16(indice.length), u32(tamCentral), u32(desloc), u16(0)));
    return new Blob(partes.concat(central, [fim]), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  // ── ajudantes de XML ──
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');   // caractere de controle quebra o Excel
  }
  function letraColuna(i) {
    var s = ''; i += 1;
    while (i) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = (i - 1 - r) / 26; }
    return s;
  }
  // Texto -> Date, SEM voltar um dia. "2017-11-21" sozinho é lido pelo JavaScript
  // como meia-noite em Londres, que no Brasil ainda é dia 20 — e a planilha sairia
  // com todo mundo nascendo um dia antes. Data pura se monta pelos pedaços, no fuso
  // de quem está olhando. Texto COM hora (o "entrou no app em") continua indo pelo
  // caminho normal, porque aí o instante é real e a conversão de fuso é o certo.
  function dataLocal(texto) {
    if (!texto) return null;
    var s = String(texto);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function serialData(d) {   // data do Excel = dias desde 30/12/1899
    var base = Date.UTC(1899, 11, 30);
    var dia = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((dia - base) / 86400000);
  }

  // Estilos: 0 padrão · 1 texto · 2 centralizado · 3 cabeçalho · 4 data
  var ESTILOS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="200" formatCode="dd/mm/yyyy"/></numFmts>' +
    '<fonts count="2">' +
      '<font><sz val="11"/><color theme="1"/><name val="Neue Montreal"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Neue Montreal"/></font>' +
    '</fonts>' +
    '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF262A33"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="200" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '<dxfs count="2">' +
      '<dxf><font><color rgb="FF14634A"/></font><fill><patternFill><bgColor rgb="FFDDF3E4"/></patternFill></fill></dxf>' +
      '<dxf><font><color rgb="FF9B1C1C"/></font><fill><patternFill><bgColor rgb="FFFBE3E3"/></patternFill></fill></dxf>' +
    '</dxfs>' +
    '<tableStyles count="0"/></styleSheet>';

  function montarAba(colunas, linhas, colSimNao) {
    var ultima = letraColuna(colunas.length - 1), fim = linhas.length + 1;
    var cols = colunas.map(function (c, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.largura || 18) +
             '" style="' + (c.tipo === 'centro' ? 2 : 1) + '" customWidth="1"/>';
    }).join('');
    var corpo = ['<row r="1" ht="34" customHeight="1" s="3" customFormat="1">' +
      colunas.map(function (c, i) {
        return '<c r="' + letraColuna(i) + '1" s="3" t="inlineStr"><is><t>' + esc(c.titulo) + '</t></is></c>';
      }).join('') + '</row>'];
    linhas.forEach(function (linha, k) {
      var n = k + 2;
      var celulas = colunas.map(function (c, i) {
        var v = linha[i], ref = letraColuna(i) + n;
        var estilo = c.tipo === 'data' ? 4 : (c.tipo === 'centro' ? 2 : 1);
        if (v === null || v === undefined || v === '') return '<c r="' + ref + '" s="' + estilo + '"/>';
        if (c.tipo === 'data' && v instanceof Date) return '<c r="' + ref + '" s="4"><v>' + serialData(v) + '</v></c>';
        if (typeof v === 'number') return '<c r="' + ref + '" s="' + estilo + '"><v>' + v + '</v></c>';
        if (typeof v === 'boolean') v = v ? 'Sim' : 'Não';
        return '<c r="' + ref + '" s="' + estilo + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      }).join('');
      corpo.push('<row r="' + n + '" ht="19" customHeight="1">' + celulas + '</row>');
    });
    // ATENÇÃO À ORDEM: o Excel exige conditionalFormatting ANTES de dataValidations,
    // e recusa o arquivo inteiro se estiver trocado.
    var cores = '';
    if (colSimNao >= 0) {
      var L = letraColuna(colSimNao);
      cores = '<conditionalFormatting sqref="' + L + '2:' + L + fim + '">' +
        '<cfRule type="cellIs" dxfId="0" priority="1" operator="equal"><formula>"SIM"</formula></cfRule>' +
        '<cfRule type="cellIs" dxfId="1" priority="2" operator="equal"><formula>"NÃO"</formula></cfRule>' +
        '</conditionalFormatting>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<dimension ref="A1:' + ultima + fim + '"/>' +
      '<sheetViews><sheetView showGridLines="0" tabSelected="1" workbookViewId="0">' +
      '<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>' +
      '<selection pane="bottomRight" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="19"/><cols>' + cols + '</cols>' +
      '<sheetData>' + corpo.join('') + '</sheetData>' + cores +
      '<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
      '<tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>';
  }

  function montarTabela(colunas, qtdLinhas) {
    var ultima = letraColuna(colunas.length - 1), fim = qtdLinhas + 1, ref = 'A1:' + ultima + fim;
    // nome de coluna repetido faz o Excel recusar a tabela
    var vistos = {}, nomes = colunas.map(function (c) {
      var t = esc(c.titulo), base = t, n = 2;
      while (vistos[t]) { t = base + ' ' + n; n++; }
      vistos[t] = 1; return t;
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" ' +
      'name="CADASTRO_DA_PASTORAL" displayName="CADASTRO_DA_PASTORAL" ref="' + ref + '" totalsRowShown="0">' +
      '<autoFilter ref="' + ref + '"/>' +
      '<tableColumns count="' + nomes.length + '">' +
      nomes.map(function (t, i) { return '<tableColumn id="' + (i + 1) + '" name="' + t + '"/>'; }).join('') +
      '</tableColumns>' +
      '<tableStyleInfo name="TableStyleLight1" showFirstColumn="0" showLastColumn="0" ' +
      'showRowStripes="1" showColumnStripes="0"/></table>';
  }

  function gerarXLSX(colunas, linhas, nomeAba, colSimNao) {
    var arquivos = [
      { nome: '[Content_Types].xml', txt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>' +
        '</Types>' },
      { nome: '_rels/.rels', txt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>' },
      { nome: 'xl/workbook.xml', txt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="' + esc(nomeAba) + '" sheetId="1" r:id="rId1"/></sheets>' +
        '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { nome: 'xl/_rels/workbook.xml.rels', txt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>' },
      { nome: 'xl/styles.xml', txt: ESTILOS },
      { nome: 'xl/worksheets/sheet1.xml', txt: montarAba(colunas, linhas, colSimNao) },
      { nome: 'xl/worksheets/_rels/sheet1.xml.rels', txt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>' +
        '</Relationships>' },
      { nome: 'xl/tables/table1.xml', txt: montarTabela(colunas, linhas.length) }
    ];
    return zipar(arquivos.map(function (a) { return { nome: a.nome, dados: bytes(a.txt) }; }));
  }

  global.gerarXLSX = gerarXLSX;
  global.dataLocal = dataLocal;
  global.baixarXLSX = function (nomeBase, colunas, linhas, opcoes) {
    opcoes = opcoes || {};
    var blob = gerarXLSX(colunas, linhas, opcoes.aba || 'CADASTRO',
                         opcoes.colunaSimNao == null ? -1 : opcoes.colunaSimNao);
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = (nomeBase || 'planilha') + '-' + (typeof hojeLocal === 'function' ? hojeLocal() : '') + '.xlsx';
    a.click(); URL.revokeObjectURL(url);
    if (typeof toast === 'function') toast('✓ Planilha gerada');
  };
})(typeof window !== 'undefined' ? window : globalThis);
