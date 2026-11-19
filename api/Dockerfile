# API MPortal (V1) pour le serveur maison.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY . .
RUN yarn build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --non-interactive && yarn cache clean
COPY --from=build /app/dist ./dist
COPY assets ./assets
RUN mkdir -p logs/debug logs/error && chown -R node:node logs
USER node
# Secrets : /etc/mportal/api.env sur l'hôte, monté en lecture seule.
CMD ["node", "--env-file=/run/secrets/api.env", "dist/server.js"]
