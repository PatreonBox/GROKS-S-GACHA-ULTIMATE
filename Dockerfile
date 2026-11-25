FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/runtime.mjs /app/server/sqlite.mjs /app/server/discord.mjs ./server/
COPY drizzle ./drizzle
EXPOSE 8080
CMD ["node","server/runtime.mjs"]
