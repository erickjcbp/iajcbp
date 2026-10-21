FROM node:22-alpine
WORKDIR /robo
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY regras.mjs evolution.mjs robo.mjs ia.mjs assistente.mjs escala-auto.mjs principal.mjs ./
USER node
CMD ["node", "principal.mjs"]
