# Estágio 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Declara os argumentos que o docker-compose vai enviar
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_DATABASE_ID

# 2. Converte os argumentos em Variáveis de Ambiente pro Vite enxergar
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_DATABASE_ID=$VITE_FIREBASE_DATABASE_ID

# Copia os arquivos de dependência
COPY package*.json ./
RUN npm install

# Copia todo o restante do código
COPY . .

# Roda o build. O Vite automaticamente vai pegar os 'ENV' definidos acima e injetar no código
RUN npm run build


# Estágio 2: Servidor Leve de Produção
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

# Pega o build pronto do estágio anterior
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Roda o servidor
CMD ["serve", "-s", "dist", "-l", "3000"]
