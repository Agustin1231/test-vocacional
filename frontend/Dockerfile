# Multi-stage: build Angular con Node, sirve estatico con nginx.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

FROM nginx:alpine
# nginx.conf es una plantilla: el entrypoint de la imagen oficial corre envsubst
# sobre /etc/nginx/templates/*.template y escribe el resultado en
# /etc/nginx/conf.d/ (default.conf.template -> default.conf) antes de arrancar.
COPY nginx.conf /etc/nginx/templates/default.conf.template
# URL a la que nginx proxea /api. Se sobreescribe por environment
# (infra/docker-compose.yml o Coolify). Si el backend no existe, /api da 502
# pero la SPA se sigue sirviendo: el contenedor arranca igual.
ENV BACKEND_URL=http://backend:5000
# envsubst solo toca las variables que matcheen este filtro; asi no pisa las
# variables propias de nginx ($uri, $host, $request_uri, ...).
ENV NGINX_ENVSUBST_FILTER=^BACKEND_URL
COPY --from=build /app/dist/test-vocacional-front/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]