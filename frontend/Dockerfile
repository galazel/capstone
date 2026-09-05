FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* variables at build time, so the API URL has to be present
# *here*, not in the container's runtime environment. Without this the build
# fell back to http://localhost:8080 and every deployed image quietly shipped
# pointing at the developer's own machine -- which surfaces in the browser as a
# CORS failure against localhost, several steps from the actual cause.
#
# Left empty by default so a plain `docker compose up` still gets the localhost
# fallback that the local stack wants; deployments pass --build-arg.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
