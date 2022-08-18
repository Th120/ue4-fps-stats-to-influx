FROM node:16 AS builder
WORKDIR /app

COPY ./static ./static
COPY ./src ./src
COPY package.json yarn.lock tsconfig.json ./

RUN yarn install --frozen-lockfile
RUN yarn build:prod
RUN rm -rf ./node_modules && yarn install --frozen-lockfile --production

FROM node:16-alpine
WORKDIR /home/node/app
COPY --chown=node:node --from=builder /app /home/node/app
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["yarn", "start"]