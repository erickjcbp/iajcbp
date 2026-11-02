# Tíquico — versão mobile v3

Artes originais aprovadas e otimizadas para celular. PNGs e versões anteriores preservados em `materiais-paroquia/games/mensageiro/fontes/`.

- Quatro artes iniciais somam cerca de501KB, ante1,57MB. Cidade/abertura1024px; atlas de poses1152px e objetos1086px.
- Atlas medido previamente: `atlas-v3.json`; dados embutidos no renderer, sem varredura de pixels no celular. Reprodução: `node projetos/acolitos/provas/mensageiro-build-arte.mjs` com a prévia iniciada.
- Mantos alternativos em arquivos separados sob demanda. Narração solicitada pelo usuário: voz sintética Jesus - The Chosen, Fish Audio,14,89s,74.996bytes; áudio só baixa após toque. Arquivo local, sem credencial ou chamada ao provedor no navegador.
- Câmera acompanha o recorte real da imagem. Ponto de fuga normalizado(.536,.535). O mesmo plano define posições, escala e linha de encontro com o personagem.
- Cache do fundo; limite1,2M pixels e DPR1,5; desenho30FPS e física60Hz; HUD10Hz. Abertura/pausa só redesenham quando mudam.
- Ef6,21–22 é a base narrativa. Aparência, caminho e falas são dramatização artística. Fonte em português no jogo.

Relatório: `materiais-paroquia/provas/mensageiro/VALIDACAO-MOBILE-V3.md`. A configuração de publicação inclui cache longo somente para os sete arquivos versionados desta versão.
