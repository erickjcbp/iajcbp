FROM node:22-alpine
WORKDIR /robo
COPY package.json package-lock.json ./
# pdfjs-dist só para tirar o texto do PDF dos ministros; o canvas opcional (desenho) não entra
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
COPY regras.mjs evolution.mjs robo.mjs ia.mjs assistente.mjs escala-auto.mjs ministros-pdf.mjs entrada-dono.mjs site.mjs principal.mjs ./
# Núcleos compartilhados com o app (montados por implantar.sh em cores/); são CommonJS/UMD, lidos por createRequire
COPY cores/ /app/cores/
COPY verificar-cores.mjs ./
ENV ACOLITOS_CORE_DIR=/app/cores
USER node
CMD ["node", "principal.mjs"]
