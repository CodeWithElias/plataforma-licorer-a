# --- Compilación ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Compila con mfe-pos/.env (solo rutas públicas VITE_*, sin secretos); si no existe, con .env.example
RUN [ -f .env ] || cp .env.example .env; npm run build

# --- Servidor estático ---
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
