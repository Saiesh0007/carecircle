FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
USER node
ENV PORT=8080 DATA_FILE=/tmp/carecircle/db.json
EXPOSE 8080
CMD ["node", "server.js"]
