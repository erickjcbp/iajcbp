// Regras PURAS da Identidade do app (Config › Identidade): as fontes que se pode escolher e a
// validação da imagem do logo. Sem DOM, sem rede — o shared.js e o config.html só desenham.
//
// COMO A FONTE MUDA O APP INTEIRO SEM TOCAR EM 200 LINHAS DE CSS: o app escreve
// `font-family:'Sora'` em centenas de lugares (CSS, atributos e JS). Em vez de trocar cada um,
// a fonte escolhida é baixada do Google Fonts e o nome da família no CSS dela é REESCRITO para
// 'Sora'. Como o @font-face injetado vem depois do original, ele vence — e todo o app passa a
// desenhar com a fonte nova. Quem ficou com a padrão não baixa nada.
(function (global) {
  'use strict';

  var PADRAO = 'sora';
  // `familia` = nome no Google Fonts; `pesos` = só os que a família TEM (pedir peso que não existe
  // faz o Google devolver erro 400 e a fonte nem chega).
  var FONTES = [
    { chave: 'sora',         rotulo: 'Sora',         nota: 'A padrão do app — moderna e limpa',   familia: null,           pesos: null },
    { chave: 'nunito',       rotulo: 'Nunito',       nota: 'Arredondada e amigável',              familia: 'Nunito',       pesos: '400;500;600;700;800' },
    { chave: 'merriweather', rotulo: 'Merriweather', nota: 'Serifada, clássica e solene',         familia: 'Merriweather', pesos: '400;700' },
    { chave: 'poppins',      rotulo: 'Poppins',      nota: 'Geométrica, firme e moderna',         familia: 'Poppins',      pesos: '400;500;600;700;800' },
  ];

  function fontePorChave(chave) {
    for (var i = 0; i < FONTES.length; i++) if (FONTES[i].chave === chave) return FONTES[i];
    return FONTES[0];   // chave desconhecida (apagada, lixo no banco) = a padrão, nunca quebra
  }
  function ehPadrao(chave) { return !fontePorChave(chave).familia; }

  // Endereço do CSS da fonte no Google Fonts.
  function urlGoogle(chave) {
    var f = fontePorChave(chave);
    if (!f.familia) return null;
    return 'https://fonts.googleapis.com/css2?family=' + f.familia.replace(/ /g, '+') + ':wght@' + f.pesos + '&display=swap';
  }

  // Troca o nome da família no CSS baixado pelo nome que o app já usa ('Sora'). Só mexe na
  // linha `font-family:` de dentro do @font-face — o resto do CSS fica como veio.
  function reescreverFamilia(css, chave, comoChamar) {
    var f = fontePorChave(chave);
    if (!f.familia) return '';
    var alvo = comoChamar || 'Sora';
    var re = new RegExp("font-family:\\s*['\"]?" + f.familia.replace(/ /g, '\\s+') + "['\"]?\\s*;", 'g');
    return String(css || '').replace(re, "font-family: '" + alvo + "';");
  }

  // Logo: imagem raster, até 2 MB. SVG fica de fora de propósito (pode levar script).
  var TIPOS_LOGO = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  var LIMITE_LOGO = 2 * 1024 * 1024;
  function validarLogo(arq) {
    if (!arq) return { ok: false, erro: 'Escolha uma imagem.' };
    if (!TIPOS_LOGO[arq.type]) return { ok: false, erro: 'Use uma imagem PNG, JPG ou WEBP.' };
    if (!(arq.size > 0)) return { ok: false, erro: 'O arquivo está vazio.' };
    if (arq.size > LIMITE_LOGO) return { ok: false, erro: 'A imagem passa de 2 MB. Diminua e tente de novo.' };
    return { ok: true, ext: TIPOS_LOGO[arq.type] };
  }
  // Nome sempre novo (com a hora): o navegador guarda imagem em cache pelo endereço, e trocar o
  // arquivo por um de mesmo nome faria o logo antigo continuar aparecendo.
  function caminhoLogo(agoraMs, ext) { return 'logo_' + Number(agoraMs) + '.' + ext; }

  var api = { PADRAO: PADRAO, FONTES: FONTES, fontePorChave: fontePorChave, ehPadrao: ehPadrao,
              urlGoogle: urlGoogle, reescreverFamilia: reescreverFamilia, validarLogo: validarLogo,
              caminhoLogo: caminhoLogo, LIMITE_LOGO: LIMITE_LOGO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.IdentidadeCore = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
