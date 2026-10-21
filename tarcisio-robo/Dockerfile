FROM node:22-alpine
WORKDIR /robo
COPY package.json package-lock.json ./
# pdfjs-dist só para tirar o texto do PDF dos ministros; o canvas opcional (desenho) não entra
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
COPY regras.mjs evolution.mjs robo.mjs ia.mjs assistente.mjs escala-auto.mjs ministros-pdf.mjs entrada-dono.mjs principal.mjs ./
USER node
CMD ["node", "principal.mjs"]
