# Vídeo de integração (Pastoral dos Coroinhas e Acólitos)

Vídeo vertical 1080×1920 (~1min40s) que o Tarcísio envia na etapa de integração.

- `roteiro.mjs`: falas e legendas por cena (19 frases). `narracao-para-gravar.txt`: o mesmo texto para gravar.
- `audio/01.mp3 … 19.mp3`: narração do dono, uma por frase, na ordem do roteiro.
- `arte/`: 7 ilustrações do dono (`abertura, pastoral, missas, escala, veste, chegada, fecho`.png) — não versionadas (pesadas). Prompts em `prompts-ilustracoes.txt`.
- `sfx/`: efeitos do pacote de motion (não versionados; nomes em `montar.mjs`).
- `index.html` + `arte.js`: cena animada com GSAP (arte.js é o SVG de reserva se faltar a imagem).
- Refazer: `node voz.mjs && node quadros.mjs todos && node montar.mjs` (Chrome instalado + ffmpeg). Versão para WhatsApp (5,5 MB): `ffmpeg -i integracao-pastoral.mp4 -vf scale=720:1280 -crf 27 …`; hospedada em `tarcisio/integracao/apresentacao-pastoral-v1.mp4`.
- Horários das missas no vídeo são fixos (Matriz sáb 17h, dom 7h/9h/19h; Santo Antônio sáb 18h30): se mudarem, refazer.
