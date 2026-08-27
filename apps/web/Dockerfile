FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace apps/web

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/next.config.mjs apps/web/next.config.mjs
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "start"]
