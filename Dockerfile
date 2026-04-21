FROM node:20-alpine

# Native build tools for bcrypt and pg
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Cache dependency layer separately from source
COPY package.json package-lock.json ./
RUN npm ci

# Generate Prisma client (only needs schema.prisma)
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

EXPOSE 3000

# Run migrations then start app; exec makes node PID 1 for correct signal handling
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
