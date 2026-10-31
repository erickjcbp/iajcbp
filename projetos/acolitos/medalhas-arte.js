// Artes das medalhas: catálogo ampliado em 31/10/2026.
(function () {
  'use strict';
  const keys = new Set(["calice-bronze", "calice-prata", "calice_sagrado-ouro", "coracao-bronze", "coracao-prata", "coroa-ouro", "coroa-prata", "crucifixo-ouro", "crucifixo-prata", "espadas-ouro", "estrela-bronze", "estrela-ouro", "estrela-prata", "hostia-ouro", "livro-bronze", "livro-ouro", "livro-prata", "pomba-ouro", "pomba-prata", "rosario-ouro", "rosario-prata", "sino-prata", "sino2-prata", "trigo-bronze", "trigo-prata", "turibulo-ouro", "vela-bronze", "samaritano-ouro", "acolhedor-ouro", "bastidores-ouro", "ponte_paz-ouro", "criacao-ouro", "escuta-ouro", "recomecar-ouro", "palavra_semeada-ouro", "amigo_todos-ouro", "memoria-ouro"]);
  window.MedalhasArte = Object.freeze({
    html(simbolo, tier, size) {
      const key = simbolo + '-' + tier;
      if (!keys.has(key)) return '';
      const n = Number(size);
      const width = Number.isFinite(n) && n > 0 ? Math.min(n, 1024) : 64;
      const height = Math.round(width * 88 / 72);
      return '<img src="/projetos/acolitos/medalhas-arte/' + key + '.webp" width="' + width + '" height="' + height + '" alt="" decoding="async" style="object-fit:contain;flex:none">';
    }
  });
})();
