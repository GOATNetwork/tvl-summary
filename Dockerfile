FROM node:16-alpine

WORKDIR /app

COPY dist/server.js .
COPY dist/server.js.map .

EXPOSE 3000

CMD ["node", "server.js"] 