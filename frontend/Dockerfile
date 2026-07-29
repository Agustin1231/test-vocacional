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
# URL de conexion al backend. Localmente: http://backend:5000 (docker-compose).
# En Coolify: https://coolify-proxy (Traefik interno, red coolify).
ENV BACKEND_URL=http://backend:5000
# Host header que nginx envia al proxy. Localmente coincide con el service name.
# En Coolify: el FQDN del backend para que Traefik lo rutee al contenedor correcto.
ENV BACKEND_HOST=backend
# envsubst sustituye todas las vars que empiecen con BACKEND (URL y HOST),
# dejando intactas las variables propias de nginx ($uri, $host, etc).
ENV NGINX_ENVSUBST_FILTER=^BACKEND
COPY --from=build /app/dist/test-vocacional-front/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]