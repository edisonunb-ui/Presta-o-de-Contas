# Estágio 1: Clonar e Buildar
FROM node:20-alpine AS builder

# Instala o git no container para podermos baixar o código
RUN apk add --no-cache git

WORKDIR /app

# Clona o repositório do GitHub diretamente na pasta /app do container
RUN git clone https://github.com/edisonunb-ui/Presta-o-de-Contas.git .

# Copia o SEU arquivo .env (que está no servidor/Arcane) para dentro da pasta clonada
# Isso é obrigatório porque o Vite precisa ler essas chaves na hora do "npm run build"
COPY .env .env

# Instala as dependências do projeto que acabou de ser baixado
RUN npm install

# Gera os arquivos estáticos do Vite
RUN npm run build


# Estágio 2: Servidor Leve de Produção
FROM node:20-alpine

WORKDIR /app

# Instala um servidor web simples
RUN npm install -g serve

# Pega apenas a pasta 'dist' (o código já empacotado e com o .env injetado) do passo anterior
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Roda o servidor
CMD ["serve", "-s", "dist", "-l", "3000"]
