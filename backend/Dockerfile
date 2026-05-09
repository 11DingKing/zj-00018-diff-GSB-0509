FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD sh -c "npx prisma migrate deploy && npx tsx prisma/seed.ts && npm run dev"
