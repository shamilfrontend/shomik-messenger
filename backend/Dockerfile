FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=build /app/dist ./dist

RUN mkdir -p /app/uploads

EXPOSE 5001

CMD ["node", "dist/server.js"]
